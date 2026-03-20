/**
 * Setup script for Baton Protocol demo.
 * Generates wallets, registers specialists, and prints instructions.
 *
 * Usage: npx tsx scripts/setup-demo.ts
 */

import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

const BACKEND_URL = process.env.BATON_API || 'http://localhost:3001';

async function generateWallet(name: string) {
  const mnemonic = await mnemonicNew();
  const keypair = await mnemonicToWalletKey(mnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });

  console.log(`\n=== ${name} ===`);
  console.log(`Address: ${wallet.address.toString()}`);
  console.log(`Mnemonic: ${mnemonic.join(' ')}`);

  return { mnemonic, address: wallet.address.toString() };
}

async function registerSpecialist(address: string, skills: string[], price: number, description: string) {
  const res = await fetch(`${BACKEND_URL}/agents/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ address, skills, price_per_job: price, description }),
  });

  if (!res.ok) {
    console.error(`Failed to register ${address}: ${await res.text()}`);
    return;
  }

  console.log(`Registered: ${address}`);
}

async function main() {
  console.log('='.repeat(60));
  console.log('BATON PROTOCOL — Demo Setup');
  console.log('='.repeat(60));

  // Generate wallets
  const hirer = await generateWallet('HIRER (your agent)');
  const renderSpec = await generateWallet('RENDER SPECIALIST (@render)');
  const deckSpec = await generateWallet('DECK SPECIALIST (@deck)');
  const treasury = await generateWallet('TREASURY (protocol fees)');

  // Register specialists in backend
  console.log('\n--- Registering specialists in backend ---');

  await registerSpecialist(
    renderSpec.address,
    ['3d-rendering', 'product-mockup', 'blender'],
    3,
    'Photorealistic 3D product renders via Trellis 2 on GPU.',
  );

  await registerSpecialist(
    deckSpec.address,
    ['pitch-deck', 'presentation', 'slides'],
    5,
    'Professional pitch decks via Gamma API.',
  );

  // Print instructions
  console.log('\n' + '='.repeat(60));
  console.log('NEXT STEPS:');
  console.log('='.repeat(60));
  console.log(`
1. Fund wallets on TON testnet:
   - Go to https://t.me/testgiver_ton_bot on Telegram
   - Send each address to get free testnet TON

   HIRER:    ${hirer.address}
   RENDER:   ${renderSpec.address}
   DECK:     ${deckSpec.address}

2. Create .env file at project root:

   # Hirer wallet
   WALLET_MNEMONIC="${hirer.mnemonic.join(' ')}"
   TREASURY_ADDRESS="${treasury.address}"
   TONCENTER_API_KEY="your-key-from-testnet.toncenter.com"
   TON_NETWORK=testnet
   BATON_API=http://localhost:3001
   MODE=hiring

3. Update specialist configs with their mnemonics:
   - specialists/render/openclaw.json → WALLET_MNEMONIC
   - specialists/deck/openclaw.json → WALLET_MNEMONIC

4. Start the backend:
   cd backend && npm run dev

5. Test the flow:
   - Hiring agent calls baton_pass
   - Specialist calls baton_listen → baton_accept → baton_deliver
   - Hiring agent calls baton_status → baton_rate
   - Check escrow on https://testnet.tonviewer.com/<escrow_address>
`);
}

main().catch(console.error);
