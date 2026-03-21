/**
 * Full happy path test with two wallets: Hirer deploys+locks → Worker delivers → Hirer confirms.
 * Requires both HIRER and RENDER wallets to be funded on testnet.
 *
 * Usage: npx tsx scripts/test-full-flow.ts
 */

import { Address, toNano } from '@ton/core';
import { TonClient, WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey } from '@ton/crypto';
import { Escrow } from '../contracts/build/Escrow/tact_Escrow';
import { readFileSync } from 'fs';
import { resolve } from 'path';

// Load .env
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

// Mnemonics from setup-demo output
const HIRER_MNEMONIC = process.env.WALLET_MNEMONIC!;
const RENDER_MNEMONIC = 'illegal neither dry myth vacant trade window reason enact blouse field warfare follow moon day vessel success beef bachelor room input process enough disorder';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  const apiKey = process.env.TONCENTER_API_KEY;
  const client = new TonClient({
    endpoint: 'https://testnet.toncenter.com/api/v2/jsonRPC',
    apiKey,
  });

  // Setup hirer wallet
  const hirerKp = await mnemonicToWalletKey(HIRER_MNEMONIC.split(' '));
  const hirerWallet = WalletContractV4.create({ workchain: 0, publicKey: hirerKp.publicKey });
  const openedHirer = client.open(hirerWallet);
  const hirerSender = openedHirer.sender(hirerKp.secretKey);

  // Setup worker wallet
  const workerKp = await mnemonicToWalletKey(RENDER_MNEMONIC.split(' '));
  const workerWallet = WalletContractV4.create({ workchain: 0, publicKey: workerKp.publicKey });
  const openedWorker = client.open(workerWallet);
  const workerSender = openedWorker.sender(workerKp.secretKey);

  console.log(`Hirer:  ${hirerWallet.address.toString()}`);
  console.log(`Worker: ${workerWallet.address.toString()}`);

  const hirerBal = await openedHirer.getBalance();
  const workerBal = await openedWorker.getBalance();
  console.log(`Hirer balance:  ${Number(hirerBal) / 1e9} TON`);
  console.log(`Worker balance: ${Number(workerBal) / 1e9} TON`);

  if (hirerBal < toNano('0.5')) {
    console.error('Hirer needs at least 0.5 TON');
    process.exit(1);
  }
  if (workerBal < toNano('0.1')) {
    console.error('Worker needs at least 0.1 TON (for gas on Deliver tx)');
    process.exit(1);
  }

  const jobId = `flow-${Date.now()}`;
  const treasuryAddress = Address.parse(process.env.TREASURY_ADDRESS!);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400);
  const lockAmount = 0.1; // TON

  // === STEP 1: Deploy Escrow ===
  console.log(`\n=== Step 1: Deploy Escrow ===`);
  const escrow = await Escrow.fromInit(
    hirerWallet.address,
    workerWallet.address,
    treasuryAddress,
    deadline,
    jobId,
  );
  console.log(`Escrow: ${escrow.address.toString()}`);

  const openedEscrow = client.open(escrow);
  await openedEscrow.send(hirerSender, { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 0n });
  console.log('Deploy tx sent...');
  await sleep(15000);

  const state = await client.getContractState(escrow.address);
  console.log(`Contract state: ${state.state}`);

  // === STEP 2: Lock TON ===
  console.log(`\n=== Step 2: Lock ${lockAmount} TON ===`);
  await openedEscrow.send(
    hirerSender,
    { value: toNano(lockAmount.toString()) },
    { $$type: 'Lock', jobId },
  );
  console.log('Lock tx sent...');
  await sleep(15000);

  let status = await openedEscrow.getStatus();
  let amount = await openedEscrow.getAmount();
  console.log(`Status: ${status} (expected 0=CREATED)`);
  console.log(`Amount: ${Number(amount) / 1e9} TON`);

  // === STEP 3: Worker Delivers ===
  console.log(`\n=== Step 3: Worker Delivers ===`);
  await openedEscrow.send(
    workerSender,
    { value: toNano('0.05') },
    { $$type: 'Deliver', jobId },
  );
  console.log('Deliver tx sent (by worker)...');
  await sleep(15000);

  status = await openedEscrow.getStatus();
  console.log(`Status: ${status} (expected 1=DELIVERED)`);

  // === STEP 4: Hirer Confirms → releases payment ===
  console.log(`\n=== Step 4: Hirer Confirms ===`);
  await openedEscrow.send(
    hirerSender,
    { value: toNano('0.05') },
    { $$type: 'Confirm', jobId },
  );
  console.log('Confirm tx sent...');
  await sleep(15000);

  status = await openedEscrow.getStatus();
  amount = await openedEscrow.getAmount();
  console.log(`Status: ${status} (expected 2=COMPLETED)`);
  console.log(`Amount: ${Number(amount) / 1e9} TON (should be 0 after payout)`);

  // === Final balances ===
  const finalHirer = await openedHirer.getBalance();
  const finalWorker = await openedWorker.getBalance();
  console.log(`\n=== Final Balances ===`);
  console.log(`Hirer:  ${Number(finalHirer) / 1e9} TON (spent ${Number(hirerBal - finalHirer) / 1e9} TON)`);
  console.log(`Worker: ${Number(finalWorker) / 1e9} TON (earned ${Number(finalWorker - workerBal) / 1e9} TON)`);
  console.log(`Worker payment: ${lockAmount * 0.98} TON (98% of ${lockAmount})`);
  console.log(`Protocol fee:   ${lockAmount * 0.02} TON (2%)`);

  console.log(`\nExplorer: https://testnet.tonviewer.com/${escrow.address.toString()}`);
  console.log('\n=== FULL FLOW COMPLETE ===');
}

main().catch(err => {
  console.error('Full flow test failed:', err);
  process.exit(1);
});
