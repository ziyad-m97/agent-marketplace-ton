import { Blockchain, SandboxContract, TreasuryContract } from '@ton/sandbox';
import { toNano } from '@ton/core';
import { Escrow } from '../build/Escrow/tact_Escrow';
import '@ton/test-utils';

describe('Escrow', () => {
    let blockchain: Blockchain;
    let hirer: SandboxContract<TreasuryContract>;
    let worker: SandboxContract<TreasuryContract>;
    let treasury: SandboxContract<TreasuryContract>;
    let escrow: SandboxContract<Escrow>;

    const JOB_ID = 'job_test_123';

    beforeEach(async () => {
        blockchain = await Blockchain.create();
        hirer = await blockchain.treasury('hirer');
        worker = await blockchain.treasury('worker');
        treasury = await blockchain.treasury('treasury');

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h from now

        escrow = blockchain.openContract(
            await Escrow.fromInit(
                hirer.address,
                worker.address,
                treasury.address,
                deadline,
                JOB_ID
            )
        );

        // Deploy
        const deployResult = await escrow.send(
            hirer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deploy', queryId: 0n }
        );
        expect(deployResult.transactions).toHaveTransaction({
            from: hirer.address,
            to: escrow.address,
            deploy: true,
            success: true,
        });
    });

    it('should deploy with correct initial state', async () => {
        const status = await escrow.getStatus();
        expect(status).toEqual(0n); // created

        const amount = await escrow.getAmount();
        expect(amount).toEqual(0n);

        const jobId = await escrow.getJobId();
        expect(jobId).toEqual(JOB_ID);
    });

    it('should lock TON from hirer', async () => {
        const lockResult = await escrow.send(
            hirer.getSender(),
            { value: toNano('10') },
            { $$type: 'Lock', jobId: JOB_ID }
        );

        expect(lockResult.transactions).toHaveTransaction({
            from: hirer.address,
            to: escrow.address,
            success: true,
        });

        const amount = await escrow.getAmount();
        expect(amount).toBeGreaterThan(0n);
    });

    it('should reject lock from non-hirer', async () => {
        const lockResult = await escrow.send(
            worker.getSender(),
            { value: toNano('10') },
            { $$type: 'Lock', jobId: JOB_ID }
        );

        expect(lockResult.transactions).toHaveTransaction({
            from: worker.address,
            to: escrow.address,
            success: false,
        });
    });

    it('should complete full flow: lock → deliver → confirm', async () => {
        // Lock
        await escrow.send(
            hirer.getSender(),
            { value: toNano('10') },
            { $$type: 'Lock', jobId: JOB_ID }
        );

        // Deliver
        const deliverResult = await escrow.send(
            worker.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deliver', jobId: JOB_ID }
        );
        expect(deliverResult.transactions).toHaveTransaction({
            from: worker.address,
            to: escrow.address,
            success: true,
        });

        const statusAfterDeliver = await escrow.getStatus();
        expect(statusAfterDeliver).toEqual(1n); // delivered

        // Confirm
        const workerBalanceBefore = await worker.getBalance();
        const treasuryBalanceBefore = await treasury.getBalance();

        const confirmResult = await escrow.send(
            hirer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Confirm', jobId: JOB_ID }
        );
        expect(confirmResult.transactions).toHaveTransaction({
            from: escrow.address,
            to: worker.address,
            success: true,
        });

        const statusAfterConfirm = await escrow.getStatus();
        expect(statusAfterConfirm).toEqual(2n); // completed

        // Worker should have received payment
        const workerBalanceAfter = await worker.getBalance();
        expect(workerBalanceAfter).toBeGreaterThan(workerBalanceBefore);

        // Treasury should have received fee
        const treasuryBalanceAfter = await treasury.getBalance();
        expect(treasuryBalanceAfter).toBeGreaterThan(treasuryBalanceBefore);
    });

    it('should handle dispute: lock → deliver → dispute → refund', async () => {
        // Lock
        await escrow.send(
            hirer.getSender(),
            { value: toNano('10') },
            { $$type: 'Lock', jobId: JOB_ID }
        );

        // Deliver
        await escrow.send(
            worker.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Deliver', jobId: JOB_ID }
        );

        // Dispute
        const hirerBalanceBefore = await hirer.getBalance();

        const disputeResult = await escrow.send(
            hirer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Dispute', jobId: JOB_ID }
        );
        expect(disputeResult.transactions).toHaveTransaction({
            from: escrow.address,
            to: hirer.address,
            success: true,
        });

        const statusAfterDispute = await escrow.getStatus();
        expect(statusAfterDispute).toEqual(3n); // disputed

        // Hirer should have been refunded
        const hirerBalanceAfter = await hirer.getBalance();
        expect(hirerBalanceAfter).toBeGreaterThan(hirerBalanceBefore);
    });

    it('should auto-release to worker when expired after delivery', async () => {
        // Use a short deadline (1 second from now)
        const shortDeadline = BigInt(Math.floor(Date.now() / 1000) + 1);
        const shortEscrow = blockchain.openContract(
            await Escrow.fromInit(hirer.address, worker.address, treasury.address, shortDeadline, 'job_expire')
        );
        await shortEscrow.send(hirer.getSender(), { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 0n });

        // Lock
        await shortEscrow.send(hirer.getSender(), { value: toNano('10') }, { $$type: 'Lock', jobId: 'job_expire' });

        // Deliver
        await shortEscrow.send(worker.getSender(), { value: toNano('0.05') }, { $$type: 'Deliver', jobId: 'job_expire' });
        const statusAfterDeliver = await shortEscrow.getStatus();
        expect(statusAfterDeliver).toEqual(1n);

        // Wait for deadline to pass
        blockchain.now = Math.floor(Date.now() / 1000) + 10;

        // Expire — should auto-release to worker, not refund hirer
        const workerBalanceBefore = await worker.getBalance();
        const treasuryBalanceBefore = await treasury.getBalance();

        const expireResult = await shortEscrow.send(
            hirer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Expire', jobId: 'job_expire' }
        );

        expect(expireResult.transactions).toHaveTransaction({
            from: shortEscrow.address,
            to: worker.address,
            success: true,
        });

        const status = await shortEscrow.getStatus();
        expect(status).toEqual(4n); // expired

        // Worker should have received payment
        const workerBalanceAfter = await worker.getBalance();
        expect(workerBalanceAfter).toBeGreaterThan(workerBalanceBefore);

        // Treasury should have received fee
        const treasuryBalanceAfter = await treasury.getBalance();
        expect(treasuryBalanceAfter).toBeGreaterThan(treasuryBalanceBefore);
    });

    it('should refund hirer when expired before delivery', async () => {
        const shortDeadline = BigInt(Math.floor(Date.now() / 1000) + 1);
        const shortEscrow = blockchain.openContract(
            await Escrow.fromInit(hirer.address, worker.address, treasury.address, shortDeadline, 'job_expire2')
        );
        await shortEscrow.send(hirer.getSender(), { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 0n });

        // Lock but NO deliver
        await shortEscrow.send(hirer.getSender(), { value: toNano('10') }, { $$type: 'Lock', jobId: 'job_expire2' });

        blockchain.now = Math.floor(Date.now() / 1000) + 10;

        const hirerBalanceBefore = await hirer.getBalance();

        await shortEscrow.send(
            hirer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Expire', jobId: 'job_expire2' }
        );

        const status = await shortEscrow.getStatus();
        expect(status).toEqual(4n);

        // Hirer should have been refunded
        const hirerBalanceAfter = await hirer.getBalance();
        expect(hirerBalanceAfter).toBeGreaterThan(hirerBalanceBefore);
    });

    it('should reject confirm before delivery', async () => {
        // Lock
        await escrow.send(
            hirer.getSender(),
            { value: toNano('10') },
            { $$type: 'Lock', jobId: JOB_ID }
        );

        // Try to confirm without delivery
        const confirmResult = await escrow.send(
            hirer.getSender(),
            { value: toNano('0.05') },
            { $$type: 'Confirm', jobId: JOB_ID }
        );
        expect(confirmResult.transactions).toHaveTransaction({
            from: hirer.address,
            to: escrow.address,
            success: false,
        });
    });
});
