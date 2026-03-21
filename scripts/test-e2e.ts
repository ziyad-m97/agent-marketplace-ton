/**
 * End-to-end test: Deploy escrow, lock TON, deliver, confirm, check status.
 * Runs against TON testnet with real wallets.
 *
 * Usage: WALLET_MNEMONIC="..." TREASURY_ADDRESS="..." TONCENTER_API_KEY="..." npx tsx scripts/test-e2e.ts
 */

import { Address, toNano } from '@ton/core';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import { Escrow } from '../contracts/build/Escrow/tact_Escrow';

// Load from .env manually
import { readFileSync } from 'fs';
import { resolve } from 'path';

const envPath = resolve(__dirname, '../.env');
try {
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let value = trimmed.slice(eqIdx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
} catch {}

const RENDER_SPECIALIST = 'EQBdluc-CpcxcKO1YG9cawsHBPUt9Haiq41UscZ-BUfuEKJr';

async function sleep(ms: number) {
  return new Promise(r => setTimeout(r, ms));
}

async function main() {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) throw new Error('WALLET_MNEMONIC required');

  const keypair = await mnemonicToWalletKey(mnemonic.split(' '));
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });

  const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey: process.env.TONCENTER_API_KEY,
  });

  const openedWallet = client.open(wallet);
  const sender = openedWallet.sender(keypair.secretKey);

  console.log(`Hirer wallet: ${wallet.address.toString()}`);

  const balance = await openedWallet.getBalance();
  console.log(`Balance: ${Number(balance) / 1e9} TON`);

  if (balance < toNano('0.5')) {
    console.error('Insufficient balance! Need at least 0.5 TON');
    process.exit(1);
  }

  const jobId = `test-${Date.now()}`;
  const treasuryAddress = Address.parse(process.env.TREASURY_ADDRESS || wallet.address.toString());
  const workerAddress = Address.parse(RENDER_SPECIALIST);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);

  console.log(`\n--- Step 1: Deploy Escrow ---`);
  console.log(`Job ID: ${jobId}`);
  console.log(`Worker: ${workerAddress.toString()}`);
  console.log(`Treasury: ${treasuryAddress.toString()}`);

  const escrow = await Escrow.fromInit(
    wallet.address,
    workerAddress,
    treasuryAddress,
    deadline,
    jobId,
  );
  const escrowAddress = escrow.address.toString();
  console.log(`Escrow address: ${escrowAddress}`);

  const openedEscrow = client.open(escrow);

  // Deploy
  await openedEscrow.send(sender, { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 0n });
  console.log('Deploy tx sent, waiting 10s for confirmation...');
  await sleep(10000);

  // Check if deployed
  const state = await client.getContractState(escrow.address);
  console.log(`Contract state: ${state.state}`);

  if (state.state !== 'active') {
    console.log('Contract not yet active, waiting 10 more seconds...');
    await sleep(10000);
    const state2 = await client.getContractState(escrow.address);
    console.log(`Contract state (retry): ${state2.state}`);
    if (state2.state !== 'active') {
      console.error('Contract failed to deploy!');
      process.exit(1);
    }
  }

  console.log(`\n--- Step 2: Lock 0.1 TON in Escrow ---`);
  await openedEscrow.send(
    sender,
    { value: toNano('0.1') },
    { $$type: 'Lock', jobId },
  );
  console.log('Lock tx sent, waiting 10s...');
  await sleep(10000);

  // Read status
  try {
    const status = await openedEscrow.getStatus();
    const amount = await openedEscrow.getAmount();
    console.log(`Escrow status: ${status} (0=CREATED, 1=DELIVERED, 2=COMPLETED)`);
    console.log(`Escrow amount: ${Number(amount) / 1e9} TON`);
  } catch (e: any) {
    console.log(`Could not read status: ${e.message}`);
  }

  console.log(`\n--- Step 3: Deliver (simulating worker) ---`);
  // NOTE: In real flow, the worker sends this. Here hirer sends it — the contract
  // should reject because only worker can deliver. Let's test that.
  try {
    await openedEscrow.send(
      sender,
      { value: toNano('0.05') },
      { $$type: 'Deliver', jobId },
    );
    console.log('Deliver tx sent (from hirer — should be rejected by contract), waiting 10s...');
    await sleep(10000);

    const status = await openedEscrow.getStatus();
    console.log(`Escrow status after hirer deliver attempt: ${status} (should still be 0)`);
  } catch (e: any) {
    console.log(`Deliver from hirer rejected: ${e.message} (expected!)`);
  }

  console.log(`\n--- Step 4: Confirm (skip deliver, test confirm) ---`);
  // The hirer can confirm directly — in the contract, confirm checks status == 1 (DELIVERED)
  // So this should fail since we're still at status 0
  try {
    await openedEscrow.send(
      sender,
      { value: toNano('0.05') },
      { $$type: 'Confirm', jobId },
    );
    console.log('Confirm tx sent, waiting 10s...');
    await sleep(10000);

    const status = await openedEscrow.getStatus();
    const amount = await openedEscrow.getAmount();
    console.log(`Escrow status: ${status}`);
    console.log(`Escrow amount: ${Number(amount) / 1e9} TON`);
  } catch (e: any) {
    console.log(`Confirm failed: ${e.message}`);
  }

  console.log(`\n--- Step 5: Dispute (refund to hirer) ---`);
  await openedEscrow.send(
    sender,
    { value: toNano('0.05') },
    { $$type: 'Dispute', jobId },
  );
  console.log('Dispute tx sent, waiting 10s...');
  await sleep(10000);

  try {
    const status = await openedEscrow.getStatus();
    const amount = await openedEscrow.getAmount();
    console.log(`Final escrow status: ${status} (3=DISPUTED)`);
    console.log(`Final escrow amount: ${Number(amount) / 1e9} TON`);
  } catch (e: any) {
    console.log(`Final status read: ${e.message}`);
  }

  const finalBalance = await openedWallet.getBalance();
  console.log(`\nFinal hirer balance: ${Number(finalBalance) / 1e9} TON`);
  console.log(`TON spent on gas: ${Number(balance - finalBalance) / 1e9} TON`);

  console.log(`\nView on explorer: https://testnet.tonviewer.com/${escrowAddress}`);
  console.log('\n✓ End-to-end test complete!');
}

main().catch(err => {
  console.error('E2E test failed:', err);
  process.exit(1);
});
