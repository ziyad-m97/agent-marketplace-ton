import "@stdlib/deploy";
import "@stdlib/ownable";

message Register {
    skills: String;
    pricePerJob: Int as coins;
}

message Unregister {}

message UpdateReputation {
    agent: Address;
    rating: Int as uint8;  // 1-5
}

message Slash {
    agent: Address;
}

struct AgentInfo {
    skills: String;
    pricePerJob: Int as coins;
    stakedAmount: Int as coins;
    reputation: Int as uint16;   // 0-500 (representing 0.0-5.0 scaled by 100)
    totalJobs: Int as uint32;
    totalDisputes: Int as uint32;
    active: Bool;
}

contract Registry with Deployable, Ownable {

    owner: Address;
    minStake: Int as coins;
    slashAmount: Int as coins;
    maxDisputes: Int as uint8;
    agents: map<Address, AgentInfo>;

    init(owner: Address) {
        self.owner = owner;
        self.minStake = ton("10");      // 10 TON minimum stake
        self.slashAmount = ton("2");    // 2 TON slashed per dispute
        self.maxDisputes = 3;
    }

    // Register as a specialist — must send >= minStake
    receive(msg: Register) {
        let staked: Int = context().value;
        require(staked >= self.minStake, "Insufficient stake");

        let info = AgentInfo{
            skills: msg.skills,
            pricePerJob: msg.pricePerJob,
            stakedAmount: staked,
            reputation: 0,
            totalJobs: 0,
            totalDisputes: 0,
            active: true
        };

        self.agents.set(sender(), info);
    }

    // Unregister — returns stake if no active disputes
    receive(msg: Unregister) {
        let info = self.agents.get(sender());
        require(info != null, "Not registered");

        let agent = info!!;
        require(agent.active, "Already inactive");

        // Return remaining stake
        if (agent.stakedAmount > 0) {
            send(SendParameters{
                to: sender(),
                value: agent.stakedAmount,
                mode: SendIgnoreErrors,
                body: "Baton: stake returned".asComment()
            });
        }

        agent.active = false;
        agent.stakedAmount = 0;
        self.agents.set(sender(), agent);
    }

    // Update reputation after job completion — only callable by owner (protocol)
    receive(msg: UpdateReputation) {
        self.requireOwner();

        let info = self.agents.get(msg.agent);
        require(info != null, "Agent not found");

        let agent = info!!;
        agent.totalJobs = agent.totalJobs + 1;

        // Weighted average: newRep = ((oldRep * (totalJobs-1)) + rating*100) / totalJobs
        let ratingScaled: Int = msg.rating * 100;
        if (agent.totalJobs == 1) {
            agent.reputation = ratingScaled;
        } else {
            agent.reputation = ((agent.reputation * (agent.totalJobs - 1)) + ratingScaled) / agent.totalJobs;
        }

        self.agents.set(msg.agent, agent);
    }

    // Slash agent on dispute/timeout — only callable by owner (protocol)
    receive(msg: Slash) {
        self.requireOwner();

        let info = self.agents.get(msg.agent);
        require(info != null, "Agent not found");

        let agent = info!!;
        agent.totalDisputes = agent.totalDisputes + 1;

        // Reduce stake
        if (agent.stakedAmount >= self.slashAmount) {
            agent.stakedAmount = agent.stakedAmount - self.slashAmount;
        } else {
            agent.stakedAmount = 0;
        }

        // Auto-deactivate after max disputes
        if (agent.totalDisputes >= self.maxDisputes) {
            agent.active = false;
        }

        self.agents.set(msg.agent, agent);
    }

    // Getters

    get fun agentInfo(agent: Address): AgentInfo? {
        return self.agents.get(agent);
    }

    get fun minStake(): Int {
        return self.minStake;
    }

    get fun isActive(agent: Address): Bool {
        let info = self.agents.get(agent);
        if (info == null) {
            return false;
        }
        return info!!.active;
    }
}
