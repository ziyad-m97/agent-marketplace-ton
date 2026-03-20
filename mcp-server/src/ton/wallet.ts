import { TonClient, WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey, KeyPair } from '@ton/crypto';
import { Address, Sender } from '@ton/core';

let client: TonClient | null = null;
let keypair: KeyPair | null = null;
let wallet: WalletContractV4 | null = null;
let sender: Sender | null = null;

async function init() {
  if (client) return;

  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) {
    throw new Error('WALLET_MNEMONIC env var is required (24 space-separated words)');
  }

  keypair = await mnemonicToWalletKey(mnemonic.split(' '));
  wallet = WalletContractV4.create({ workchain: 0, publicKey: keypair.publicKey });

  const network = process.env.TON_NETWORK || 'testnet';
  const endpoint = network === 'mainnet'
    ? 'https://toncenter.com/api/v2/jsonRPC'
    : 'https://testnet.toncenter.com/api/v2/jsonRPC';

  client = new TonClient({
    endpoint,
    apiKey: process.env.TONCENTER_API_KEY,
  });

  const openedWallet = client.open(wallet);
  sender = openedWallet.sender(keypair.secretKey);
}

export async function getClient(): Promise<TonClient> {
  await init();
  return client!;
}

export async function getSender(): Promise<Sender> {
  await init();
  return sender!;
}

export async function getWalletAddress(): Promise<Address> {
  await init();
  return wallet!.address;
}

export async function getBalance(): Promise<bigint> {
  await init();
  const openedWallet = client!.open(wallet!);
  return await openedWallet.getBalance();
}
