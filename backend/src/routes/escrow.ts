import { Router } from 'express';
import { getDb } from '../db';
import { getBalance, getSenderFromMnemonic } from '../ton/wallet';
import {
  deployAndLockEscrow,
  confirmEscrow,
  deliverOnChainWithSender,
  getEscrowStatus,
  disputeEscrow,
  sleep,
} from '../ton/escrow';

export const escrowRouter = Router();

// Deploy escrow contract and lock TON
escrowRouter.post('/deploy', async (req, res) => {
  const { job_id, worker_address, amount } = req.body;

  if (!job_id || !worker_address || !amount) {
    return res.status(400).json({ error: 'job_id, worker_address, and amount required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Check hirer balance
  try {
    const balance = await getBalance();
    const requiredNano = BigInt(Math.ceil((amount + 0.15) * 1e9));
    if (balance < requiredNano) {
      return res.status(400).json({
        error: `Insufficient balance. Have ${Number(balance) / 1e9} TON, need ${amount + 0.15} TON`,
      });
    }
  } catch (err: any) {
    return res.status(500).json({ error: `Balance check failed: ${err.message}` });
  }

  try {
    const { escrowAddress } = await deployAndLockEscrow(worker_address, job_id, amount);

    db.prepare('UPDATE jobs SET escrow_address = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run(escrowAddress, job_id);

    res.json({ escrow_address: escrowAddress, status: 'locked' });
  } catch (err: any) {
    console.error(`[escrow] Deploy failed for job ${job_id}:`, err.message);
    res.status(500).json({ error: `Escrow deploy failed: ${err.message}` });
  }
});

// Worker delivers on-chain (with retries)
escrowRouter.post('/deliver', async (req, res) => {
  const { job_id, worker_mnemonic } = req.body;

  const mnemonic = worker_mnemonic || process.env.WORKER_MNEMONIC;
  if (!job_id || !mnemonic) {
    return res.status(400).json({ error: 'job_id and worker_mnemonic (or WORKER_MNEMONIC env) required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!job.escrow_address || job.escrow_address.startsWith('pending')) {
    return res.status(400).json({ error: 'No escrow deployed for this job' });
  }

  const { sender } = await getSenderFromMnemonic(mnemonic);

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await deliverOnChainWithSender(job.escrow_address, job_id, sender);
      return res.json({ status: 'delivered_onchain' });
    } catch (err: any) {
      console.error(`[escrow] Deliver attempt ${attempt} failed for job ${job_id}:`, err.message);
      if (attempt === 3) {
        return res.status(500).json({ error: `On-chain delivery failed after 3 attempts: ${err.message}` });
      }
      await sleep(3000);
    }
  }
});

// Hirer confirms — BULLETPROOF: handles deploy, deliver, confirm, retries
// This endpoint guarantees the specialist gets paid or returns a clear error.
escrowRouter.post('/confirm', async (req, res) => {
  const { job_id } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });

  let escrowAddress = job.escrow_address;

  // ── Step 1: Ensure escrow is deployed ──
  if (!escrowAddress || escrowAddress.startsWith('pending')) {
    if (!job.worker_address || !job.amount) {
      return res.status(400).json({ error: 'No escrow deployed and missing worker_address/amount to deploy one' });
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[escrow] Catch-up deploy attempt ${attempt}/3 for job ${job_id}...`);
        const result = await deployAndLockEscrow(job.worker_address, job_id, job.amount);
        escrowAddress = result.escrowAddress;
        db.prepare('UPDATE jobs SET escrow_address = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(escrowAddress, job_id);
        console.log(`[escrow] Catch-up deploy succeeded: ${escrowAddress}`);
        break;
      } catch (deployErr: any) {
        console.error(`[escrow] Catch-up deploy attempt ${attempt} failed:`, deployErr.message);
        if (attempt === 3) {
          return res.status(500).json({ error: `Escrow deploy failed after 3 attempts: ${deployErr.message}` });
        }
        await sleep(3000);
      }
    }
  }

  // ── Step 2: Check on-chain status and fix any missing steps ──
  try {
    const { status: onChainStatus } = await getEscrowStatus(escrowAddress);
    console.log(`[escrow] On-chain status for job ${job_id}: ${onChainStatus}`);

    // Already completed — nothing to do
    if (onChainStatus === 2n) {
      db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('completed', job_id);
      return res.json({ status: 'confirmed', escrow_address: escrowAddress, note: 'already completed on-chain' });
    }

    // Status 0 = created → worker never delivered on-chain. Do it now.
    if (onChainStatus === 0n) {
      // Try: 1) agent mnemonic from DB, 2) WORKER_MNEMONIC env var
      const agent = db.prepare('SELECT mnemonic FROM agents WHERE address = ?').get(job.worker_address) as any;
      const workerMnemonic = agent?.mnemonic || process.env.WORKER_MNEMONIC;
      if (!workerMnemonic) {
        return res.status(500).json({ error: 'Escrow on-chain status is 0 (not delivered). No worker mnemonic available to catch-up deliver.' });
      }
      console.log(`[escrow] Catch-up on-chain delivery for job ${job_id}...`);
      const { sender: workerSender } = await getSenderFromMnemonic(workerMnemonic);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await deliverOnChainWithSender(escrowAddress, job_id, workerSender);
          console.log(`[escrow] Catch-up delivery succeeded for job ${job_id}`);
          break;
        } catch (deliverErr: any) {
          console.error(`[escrow] Catch-up deliver attempt ${attempt} failed:`, deliverErr.message);
          if (attempt === 3) {
            return res.status(500).json({ error: `On-chain delivery failed after 3 attempts: ${deliverErr.message}` });
          }
          await sleep(3000);
        }
      }
    }

    // Status 3 = disputed → cannot confirm
    if (onChainStatus === 3n) {
      return res.status(400).json({ error: 'Escrow is disputed on-chain, cannot confirm' });
    }

    // Status 4 = expired → already auto-released
    if (onChainStatus === 4n) {
      db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('completed', job_id);
      return res.json({ status: 'confirmed', escrow_address: escrowAddress, note: 'expired — auto-released to worker' });
    }

  } catch (statusErr: any) {
    // If we can't read status, proceed with confirm anyway — the contract will reject if wrong state
    console.log(`[escrow] Could not read on-chain status: ${statusErr.message} — proceeding with confirm`);
  }

  // ── Step 3: Confirm (release payment to worker) with retries ──
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await confirmEscrow(escrowAddress, job_id);

      db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('completed', job_id);

      console.log(`[escrow] ✅ Payment released for job ${job_id}`);
      return res.json({ status: 'confirmed', escrow_address: escrowAddress });
    } catch (err: any) {
      console.error(`[escrow] Confirm attempt ${attempt} failed for job ${job_id}:`, err.message);
      if (attempt === 3) {
        return res.status(500).json({ error: `On-chain confirm failed after 3 attempts: ${err.message}` });
      }
      await sleep(3000);
    }
  }
});

// Hirer disputes
escrowRouter.post('/dispute', async (req, res) => {
  const { job_id } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!job.escrow_address || job.escrow_address.startsWith('pending')) {
    return res.status(400).json({ error: 'No escrow deployed for this job' });
  }

  try {
    await disputeEscrow(job.escrow_address, job_id);

    db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('disputed', job_id);

    res.json({ status: 'disputed' });
  } catch (err: any) {
    res.status(500).json({ error: `Dispute failed: ${err.message}` });
  }
});

// Check on-chain escrow status
escrowRouter.get('/:job_id/status', async (req, res) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!job.escrow_address || job.escrow_address.startsWith('pending')) {
    return res.json({ status: 'no_escrow', escrow_address: null });
  }

  try {
    const { status, amount } = await getEscrowStatus(job.escrow_address);
    const statusMap: Record<string, string> = { '0': 'created', '1': 'delivered', '2': 'completed', '3': 'disputed' };
    res.json({
      escrow_address: job.escrow_address,
      on_chain_status: statusMap[status.toString()] || `unknown(${status})`,
      locked_amount: Number(amount) / 1e9,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Status check failed: ${err.message}` });
  }
});
