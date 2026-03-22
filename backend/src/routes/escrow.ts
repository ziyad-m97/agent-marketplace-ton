import { Router } from 'express';
import { getDb } from '../db';
import { getBalanceForAddress, getSenderFromMnemonic } from '../ton/wallet';
import {
  deployAndLockEscrow,
  confirmEscrow,
  deliverOnChainWithSender,
  getEscrowStatus,
  disputeEscrow,
  sleep,
} from '../ton/escrow';

export const escrowRouter = Router();

/** Look up a wallet mnemonic by baton_address */
function getWalletMnemonic(batonAddress: string): string | null {
  const db = getDb();
  const wallet = db.prepare('SELECT mnemonic FROM wallets WHERE baton_address = ?').get(batonAddress) as any;
  return wallet?.mnemonic || null;
}

/** Look up worker mnemonic: try wallets table (via agent owner), then agent.mnemonic, then env */
function getWorkerMnemonic(workerAddress: string): string | null {
  const db = getDb();
  // 1. Find agent by address, get owner, look up wallet
  const agent = db.prepare('SELECT owner_address, mnemonic FROM agents WHERE address = ?').get(workerAddress) as any;
  if (agent?.owner_address) {
    const wallet = db.prepare('SELECT mnemonic FROM wallets WHERE ton_connect_address = ?').get(agent.owner_address) as any;
    if (wallet?.mnemonic) return wallet.mnemonic;
  }
  // 2. Legacy: agent.mnemonic
  if (agent?.mnemonic) return agent.mnemonic;
  // 3. Fallback: env
  return process.env.WORKER_MNEMONIC || null;
}

// Deploy escrow contract and lock TON
escrowRouter.post('/deploy', async (req, res) => {
  const { job_id, worker_address, amount } = req.body;

  if (!job_id || !worker_address || !amount) {
    return res.status(400).json({ error: 'job_id, worker_address, and amount required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Look up hirer wallet mnemonic
  const hirerMnemonic = getWalletMnemonic(job.hirer_address);
  if (!hirerMnemonic) {
    return res.status(400).json({ error: `No wallet found for hirer ${job.hirer_address}` });
  }

  // Check hirer balance
  try {
    const balance = await getBalanceForAddress(job.hirer_address);
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
    const { escrowAddress } = await deployAndLockEscrow(hirerMnemonic, worker_address, job_id, amount);

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

  if (!job_id) {
    return res.status(400).json({ error: 'job_id required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!job.escrow_address || job.escrow_address.startsWith('pending')) {
    return res.status(400).json({ error: 'No escrow deployed for this job' });
  }

  const mnemonic = worker_mnemonic || getWorkerMnemonic(job.worker_address);
  if (!mnemonic) {
    return res.status(400).json({ error: 'No worker mnemonic available' });
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
escrowRouter.post('/confirm', async (req, res) => {
  const { job_id } = req.body;

  if (!job_id) {
    return res.status(400).json({ error: 'job_id required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });

  // Look up hirer wallet
  const hirerMnemonic = getWalletMnemonic(job.hirer_address);
  if (!hirerMnemonic) {
    return res.status(400).json({ error: `No wallet found for hirer ${job.hirer_address}` });
  }

  let escrowAddress = job.escrow_address;

  // ── Step 1: Ensure escrow is deployed ──
  if (!escrowAddress || escrowAddress.startsWith('pending')) {
    if (!job.worker_address || !job.amount) {
      return res.status(400).json({ error: 'No escrow deployed and missing worker_address/amount' });
    }
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        console.log(`[escrow] Catch-up deploy attempt ${attempt}/3 for job ${job_id}...`);
        const result = await deployAndLockEscrow(hirerMnemonic, job.worker_address, job_id, job.amount);
        escrowAddress = result.escrowAddress;
        db.prepare('UPDATE jobs SET escrow_address = ?, updated_at = datetime(\'now\') WHERE id = ?')
          .run(escrowAddress, job_id);
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

  // ── Step 2: Check on-chain status and fix missing steps ──
  try {
    const { status: onChainStatus } = await getEscrowStatus(escrowAddress);
    console.log(`[escrow] On-chain status for job ${job_id}: ${onChainStatus}`);

    if (onChainStatus === 2n) {
      db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('completed', job_id);
      return res.json({ status: 'confirmed', escrow_address: escrowAddress, note: 'already completed on-chain' });
    }

    // Status 0 = worker never delivered on-chain → do it now
    if (onChainStatus === 0n) {
      const workerMnemonic = getWorkerMnemonic(job.worker_address);
      if (!workerMnemonic) {
        return res.status(500).json({ error: 'On-chain status is 0 (not delivered). No worker mnemonic available.' });
      }
      console.log(`[escrow] Catch-up on-chain delivery for job ${job_id}...`);
      const { sender: workerSender } = await getSenderFromMnemonic(workerMnemonic);
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          await deliverOnChainWithSender(escrowAddress, job_id, workerSender);
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

    if (onChainStatus === 3n) {
      return res.status(400).json({ error: 'Escrow is disputed on-chain, cannot confirm' });
    }

    if (onChainStatus === 4n) {
      db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
        .run('completed', job_id);
      return res.json({ status: 'confirmed', escrow_address: escrowAddress, note: 'expired — auto-released to worker' });
    }
  } catch (statusErr: any) {
    console.log(`[escrow] Could not read on-chain status: ${statusErr.message} — proceeding with confirm`);
  }

  // ── Step 3: Confirm (release payment) with retries ──
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await confirmEscrow(hirerMnemonic, escrowAddress, job_id);

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

  const hirerMnemonic = getWalletMnemonic(job.hirer_address);
  if (!hirerMnemonic) {
    return res.status(400).json({ error: `No wallet found for hirer ${job.hirer_address}` });
  }

  try {
    await disputeEscrow(hirerMnemonic, job.escrow_address, job_id);

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
