import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Registry } from '../build/Registry/tact_Registry';
import '@ton/test-utils';

describe('Registry', () => {
    let blockchain: Blockchain;
    let owner: SandboxContract<TreasuryContract>;
    let agent1: SandboxContract<TreasuryContract>;
    let agent2: SandboxContract<TreasuryContract>;
    let registry: SandboxContract<Registry>;

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        owner = await blockchain.treasury('owner');
        agent1 = await blockchain.treasury('agent1');
        agent2 = await blockchain.treasury('agent2');

        registry = blockchain.openContract(
            await Registry.fromInit(owner.address)
        );

        // Deploy
        const deployResult = await registry.send(
            owner.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
        expect(deployResult.transactions).toHaveTransaction({
            from: owner.address,
            to: registry.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy with correct owner', async () => {
        const contractOwner = await registry.getOwner();
        expect(contractOwner.equals(owner.address)).toBe(true);

        const minStake = await registry.getMinStake();
        expect(minStake).toEqual(toNano('10'));
    });

    it('should register agent with sufficient stake', async () => {
        const registerResult = await registry.send(
            agent1.getSender(),
            { value: toNano('10') },
            {
                $$type: 'Register',
                skills: '3d-rendering,product-mockup',
                pricePerJob: toNano('3'),
            }
        );

        expect(registerResult.transactions).toHaveTransaction({
            from: agent1.address,
            to: registry.address,
            success: true,
        });

        const isActive = await registry.getIsActive(agent1.address);
        expect(isActive).toBe(true);

        const info = await registry.getAgentInfo(agent1.address);
        expect(info).not.toBeNull();
        expect(info!.skills).toEqual('3d-rendering,product-mockup');
        expect(info!.pricePerJob).toEqual(toNano('3'));
        expect(info!.active).toBe(true);
        expect(info!.totalJobs).toEqual(0n);
        expect(info!.totalDisputes).toEqual(0n);
    });

    it('should reject registration with insufficient stake', async () => {
        const registerResult = await registry.send(
            agent1.getSender(),
            { value: toNano('5') }, // Less than 10 TON minimum
            {
                $$type: 'Register',
                skills: '3d-rendering',
                pricePerJob: toNano('3'),
            }
        );

        expect(registerResult.transactions).toHaveTransaction({
            from: agent1.address,
            to: registry.address,
            success: false,
        });
    });

    it('should update reputation (owner only)', async () => {
        // Register agent first
        await registry.send(
            agent1.getSender(),
            { value: toNano('10') },
            {
                $$type: 'Register',
                skills: '3d-rendering',
                pricePerJob: toNano('3'),
            }
        );

        // Update reputation (as owner)
        const updateResult = await registry.send(
            owner.getSender(),
            { value: toNano('0.05') },
            {
                $$type: 'UpdateReputation',
                agent: agent1.address,
                rating: 5n,
            }
        );

        expect(updateResult.transactions).toHaveTransaction({
            from: owner.address,
            to: registry.address,
            success: true,
        });

        const info = await registry.getAgentInfo(agent1.address);
        expect(info!.totalJobs).toEqual(1n);
        expect(info!.reputation).toEqual(500n); // 5.0 * 100
    });

    it('should reject reputation update from non-owner', async () => {
        await registry.send(
            agent1.getSender(),
            { value: toNano('10') },
            {
                $$type: 'Register',
                skills: '3d-rendering',
                pricePerJob: toNano('3'),
            }
        );

        const updateResult = await registry.send(
            agent2.getSender(), // not owner
            { value: toNano('0.05') },
            {
                $$type: 'UpdateReputation',
                agent: agent1.address,
                rating: 5n,
            }
        );

        expect(updateResult.transactions).toHaveTransaction({
            from: agent2.address,
            to: registry.address,
            success: false,
        });
    });

    it('should calculate weighted average reputation', async () => {
        await registry.send(
            agent1.getSender(),
            { value: toNano('10') },
            {
                $$type: 'Register',
                skills: '3d-rendering',
                pricePerJob: toNano('3'),
            }
        );

        // Rate 5 stars
        await registry.send(
            owner.getSender(),
            { value: toNano('0.05') },
            { $$type: 'UpdateReputation', agent: agent1.address, rating: 5n }
        );

        // Rate 3 stars
        await registry.send(
            owner.getSender(),
            { value: toNano('0.05') },
            { $$type: 'UpdateReputation', agent: agent1.address, rating: 3n }
        );

        const info = await registry.getAgentInfo(agent1.address);
        expect(info!.totalJobs).toEqual(2n);
        // Weighted avg: (500 * 1 + 300) / 2 = 400
        expect(info!.reputation).toEqual(400n); // 4.0
    });

    it('should slash agent on dispute', async () => {
        await registry.send(
            agent1.getSender(),
            { value: toNano('10') },
            {
                $$type: 'Register',
                skills: '3d-rendering',
                pricePerJob: toNano('3'),
            }
        );

        // Slash (as owner)
        const slashResult = await registry.send(
            owner.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Slash', agent: agent1.address }
        );

        expect(slashResult.transactions).toHaveTransaction({
            from: owner.address,
            to: registry.address,
            success: true,
        });

        const info = await registry.getAgentInfo(agent1.address);
        expect(info!.totalDisputes).toEqual(1n);
        expect(info!.active).toBe(true); // Still active after 1 slash
    });

    it('should deactivate agent after 3 slashes', async () => {
        await registry.send(
            agent1.getSender(),
            { value: toNano('10') },
            {
                $$type: 'Register',
                skills: '3d-rendering',
                pricePerJob: toNano('3'),
            }
        );

        // Slash 3 times
        for (let i = 0; i < 3; i++) {
            await registry.send(
                owner.getSender(),
                { value: toNano('0.05') },
                { $$type: 'Slash', agent: agent1.address }
            );
        }

        const info = await registry.getAgentInfo(agent1.address);
        expect(info!.totalDisputes).toEqual(3n);
        expect(info!.active).toBe(false); // Deactivated

        const isActive = await registry.getIsActive(agent1.address);
        expect(isActive).toBe(false);
    });

    it('should allow unregister and return stake', async () => {
        await registry.send(
            agent1.getSender(),
            { value: toNano('10') },
            {
                $$type: 'Register',
                skills: '3d-rendering',
                pricePerJob: toNano('3'),
            }
        );

        const balanceBefore = await agent1.getBalance();

        const unregResult = await registry.send(
            agent1.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Unregister' }
        );

        expect(unregResult.transactions).toHaveTransaction({
            from: registry.address,
            to: agent1.address,
            success: true,
        });

        const info = await registry.getAgentInfo(agent1.address);
        expect(info!.active).toBe(false);

        // Should have received stake back
        const balanceAfter = await agent1.getBalance();
        expect(balanceAfter).toBeGreaterThan(balanceBefore);
    });
});
