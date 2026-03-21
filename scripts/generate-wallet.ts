/**
 * Generate a new TON wallet for use as a specialist worker.
 * Prints mnemonic and address. Optionally registers in backend.
 *
 * Usage: npx tsx scripts/generate-wallet.ts [--register]
 */

import { mnemonicNew, mnemonicToWalletKey } from '@ton/crypto';
import { WalletContractV4 } from '@ton/ton';

const BACKEND_URL = process.env.BATON_API || 'http://localhost:3001';

async function main() {
  const mnemonic = await mnemonicNew();
  const keypair = await mnemonicToWalletKey(mnemonic);
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });

  console.log('='.repeat(60));
  console.log('NEW SPECIALIST WALLET');
  console.log('='.repeat(60));
  console.log(`Address:  ${wallet.address.toString()}`);
  console.log(`Mnemonic: ${mnemonic.join(' ')}`);
  console.log('');
  console.log('Next steps:');
  console.log('1. Fund on testnet: send this address to @testgiver_ton_bot on Telegram');
  console.log('2. Add to .env:');
  console.log(`   WORKER_MNEMONIC="${mnemonic.join(' ')}"`);
  console.log(`   WORKER_ADDRESS="${wallet.address.toString()}"`);

  if (process.argv.includes('--register')) {
    console.log('\nRegistering in backend...');
    const res = await fetch(`${BACKEND_URL}/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: wallet.address.toString(),
        skills: ['3d-rendering', 'product-mockup', 'blender'],
        price_per_job: 3,
        description: 'Photorealistic 3D product renders via Trellis 2 on GPU.',
      }),
    });

    if (res.ok) {
      console.log('Registered successfully!');
    } else {
      console.error('Registration failed:', await res.text());
    }
  }
}

main().catch(console.error);
