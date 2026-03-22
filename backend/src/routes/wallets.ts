import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { generateWallet, getBalanceForAddress, transferTon } from '../ton/wallet';

export const walletsRouter = Router();

// Get or create a Baton wallet for a TonConnect identity
walletsRouter.post('/get-or-create', async (req: Request, res: Response) => {
  const { ton_connect_address } = req.body;

  if (!ton_connect_address) {
    return res.status(400).json({ error: 'ton_connect_address required' });
  }

  const db = getDb();

  // Check if wallet already exists
  const existing = db.prepare('SELECT baton_address FROM wallets WHERE ton_connect_address = ?')
    .get(ton_connect_address) as any;

  if (existing) {
    try {
      const balance = await getBalanceForAddress(existing.baton_address);
      return res.json({
        baton_address: existing.baton_address,
        balance_ton: Number(balance) / 1e9,
      });
    } catch {
      return res.json({
        baton_address: existing.baton_address,
        balance_ton: 0,
      });
    }
  }

  // Generate new wallet
  try {
    const { mnemonic, address: batonAddress } = await generateWallet();

    db.prepare('INSERT INTO wallets (ton_connect_address, baton_address, mnemonic) VALUES (?, ?, ?)')
      .run(ton_connect_address, batonAddress, mnemonic);

    res.json({
      baton_address: batonAddress,
      balance_ton: 0,
      is_new: true,
    });
  } catch (err: any) {
    // Race condition: another request created the wallet simultaneously
    const existing = db.prepare('SELECT baton_address FROM wallets WHERE ton_connect_address = ?')
      .get(ton_connect_address) as any;
    if (existing) {
      return res.json({ baton_address: existing.baton_address, balance_ton: 0 });
    }
    res.status(500).json({ error: err.message });
  }
});

// Get balance for a Baton wallet
walletsRouter.get('/:ton_connect_address/balance', async (req: Request, res: Response) => {
  const db = getDb();
  const wallet = db.prepare('SELECT baton_address FROM wallets WHERE ton_connect_address = ?')
    .get(req.params.ton_connect_address) as any;

  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  try {
    const balance = await getBalanceForAddress(wallet.baton_address);
    res.json({
      baton_address: wallet.baton_address,
      balance_nano: balance.toString(),
      balance_ton: Number(balance) / 1e9,
    });
  } catch (err: any) {
    res.status(500).json({ error: `Balance check failed: ${err.message}` });
  }
});

// Withdraw from Baton wallet to an external address
walletsRouter.post('/withdraw', async (req: Request, res: Response) => {
  const { ton_connect_address, to_address, amount } = req.body;

  if (!ton_connect_address || !to_address || !amount) {
    return res.status(400).json({ error: 'ton_connect_address, to_address, and amount required' });
  }

  const db = getDb();
  const wallet = db.prepare('SELECT mnemonic, baton_address FROM wallets WHERE ton_connect_address = ?')
    .get(ton_connect_address) as any;

  if (!wallet) {
    return res.status(404).json({ error: 'Wallet not found' });
  }

  // Check balance
  const balance = await getBalanceForAddress(wallet.baton_address);
  const requiredNano = BigInt(Math.ceil((amount + 0.01) * 1e9)); // +0.01 for gas
  if (balance < requiredNano) {
    return res.status(400).json({
      error: `Insufficient balance. Have ${Number(balance) / 1e9} TON, need ${amount + 0.01} TON (incl. gas)`,
    });
  }

  try {
    await transferTon(wallet.mnemonic, to_address, amount);
    res.json({ status: 'sent', from: wallet.baton_address, to: to_address, amount });
  } catch (err: any) {
    res.status(500).json({ error: `Withdrawal failed: ${err.message}` });
  }
});
