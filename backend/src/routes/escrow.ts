import { Router } from 'express';
import { getDb } from '../db';
import { getBalance, getSenderFromMnemonic } from '../ton/wallet';
import {
  deployAndLockEscrow,
  confirmEscrow,
  deliverOnChainWithSender,
  getEscrowStatus,
  disputeEscrow,
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

// Worker delivers on-chain
escrowRouter.post('/deliver', async (req, res) => {
  const { job_id, worker_mnemonic } = req.body;

  if (!job_id || !worker_mnemonic) {
    return res.status(400).json({ error: 'job_id and worker_mnemonic required' });
  }

  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(job_id) as any;
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (!job.escrow_address || job.escrow_address.startsWith('pending')) {
    return res.status(400).json({ error: 'No escrow deployed for this job' });
  }

  try {
    const { sender } = await getSenderFromMnemonic(worker_mnemonic);
    await deliverOnChainWithSender(job.escrow_address, job_id, sender);
    res.json({ status: 'delivered_onchain' });
  } catch (err: any) {
    console.error(`[escrow] Deliver failed for job ${job_id}:`, err.message);
    res.status(500).json({ error: `On-chain delivery failed: ${err.message}` });
  }
});

// Hirer confirms — releases TON to worker
escrowRouter.post('/confirm', async (req, res) => {
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
    await confirmEscrow(job.escrow_address, job_id);

    db.prepare('UPDATE jobs SET status = ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('completed', job_id);

    res.json({ status: 'confirmed', escrow_address: job.escrow_address });
  } catch (err: any) {
    console.error(`[escrow] Confirm failed for job ${job_id}:`, err.message);
    res.status(500).json({ error: `On-chain confirm failed: ${err.message}` });
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
