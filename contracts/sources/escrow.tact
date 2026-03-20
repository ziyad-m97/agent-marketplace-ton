import "@stdlib/deploy";
import "@stdlib/ownable";

message Lock {
    jobId: String;
}

message Deliver {
    jobId: String;
}

message Confirm {
    jobId: String;
}

message Dispute {
    jobId: String;
}

message Expire {
    jobId: String;
}

contract Escrow with Deployable {

    hirer: Address;
    worker: Address;
    treasury: Address;
    amount: Int as coins;
    deadline: Int as uint64;       // Unix timestamp
    jobId: String;
    protocolFeeBps: Int as uint16; // basis points (200 = 2%)
    status: Int as uint8;          // 0=created, 1=delivered, 2=completed, 3=disputed, 4=expired

    init(hirer: Address, worker: Address, treasury: Address, deadline: Int, jobId: String) {
        self.hirer = hirer;
        self.worker = worker;
        self.treasury = treasury;
        self.amount = 0;
        self.deadline = deadline;
        self.jobId = jobId;
        self.protocolFeeBps = 200; // 2%
        self.status = 0; // created
    }

    // Lock TON into escrow — called by hirer
    receive(msg: Lock) {
        require(sender() == self.hirer, "Only hirer can lock funds");
        require(self.status == 0, "Escrow not in created state");
        require(msg.jobId == self.jobId, "Job ID mismatch");

        self.amount = self.amount + context().value;
    }

    // Specialist marks delivery
    receive(msg: Deliver) {
        require(sender() == self.worker, "Only worker can deliver");
        require(self.status == 0, "Escrow not in created state");
        require(msg.jobId == self.jobId, "Job ID mismatch");

        self.status = 1; // delivered
    }

    // Hirer confirms — releases funds to worker
    receive(msg: Confirm) {
        require(sender() == self.hirer, "Only hirer can confirm");
        require(self.status == 1, "Must be delivered first");
        require(msg.jobId == self.jobId, "Job ID mismatch");

        self.status = 2; // completed

        // Calculate protocol fee
        let fee: Int = self.amount * self.protocolFeeBps / 10000;
        let workerPayment: Int = self.amount - fee;

        // Pay worker
        send(SendParameters{
            to: self.worker,
            value: workerPayment,
            mode: SendIgnoreErrors,
            body: "Baton: job completed".asComment()
        });

        // Pay protocol fee
        if (fee > 0) {
            send(SendParameters{
                to: self.treasury,
                value: fee,
                mode: SendIgnoreErrors,
                body: "Baton: protocol fee".asComment()
            });
        }
    }

    // Hirer disputes — refunds
    receive(msg: Dispute) {
        require(sender() == self.hirer, "Only hirer can dispute");
        require(self.status == 1, "Must be delivered first");
        require(msg.jobId == self.jobId, "Job ID mismatch");

        self.status = 3; // disputed

        // Refund hirer
        send(SendParameters{
            to: self.hirer,
            value: self.amount,
            mode: SendIgnoreErrors,
            body: "Baton: job disputed, refunded".asComment()
        });
    }

    // Anyone can trigger expiry after deadline
    receive(msg: Expire) {
        require(now() >= self.deadline, "Deadline not reached");
        require(self.status == 0 || self.status == 1, "Cannot expire in current state");
        require(msg.jobId == self.jobId, "Job ID mismatch");

        self.status = 4; // expired

        // Refund hirer
        send(SendParameters{
            to: self.hirer,
            value: self.amount,
            mode: SendIgnoreErrors,
            body: "Baton: job expired, refunded".asComment()
        });
    }

    // Getters

    get fun status(): Int {
        return self.status;
    }

    get fun amount(): Int {
        return self.amount;
    }

    get fun jobId(): String {
        return self.jobId;
    }

    get fun hirer(): Address {
        return self.hirer;
    }

    get fun worker(): Address {
        return self.worker;
    }

    get fun deadline(): Int {
        return self.deadline;
    }
}
