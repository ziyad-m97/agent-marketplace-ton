import { TonClient, WalletContractV4 } from '@ton/ton';
import { mnemonicToWalletKey, mnemonicNew } from '@ton/crypto';
import { Address, Sender, toNano, internal } from '@ton/core';

let client: TonClient | null = null;

async function initClient(): Promise<TonClient> {
  if (client) return client;

  const network = process.env.TON_NETWORK || 'testnet';
  const endpoint = network === 'mainnet'
    ? 'https://toncenter.com/api/v2/jsonRPC'
    : 'https://testnet.toncenter.com/api/v2/jsonRPC';

  client = new TonClient({
    endpoint,
    apiKey: process.env.TONCENTER_API_KEY,
  });

  return client;
}

export async function getClient(): Promise<TonClient> {
  return initClient();
}

export async function getSenderFromMnemonic(mnemonic: string): Promise<{ sender: Sender; address: Address }> {
  const c = await getClient();
  const kp = await mnemonicToWalletKey(mnemonic.split(' '));
  const w = WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey });
  const opened = c.open(w);
  return { sender: opened.sender(kp.secretKey), address: w.address };
}

export async function addressFromMnemonic(mnemonic: string): Promise<Address> {
  const kp = await mnemonicToWalletKey(mnemonic.split(' '));
  const w = WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey });
  return w.address;
}

export async function generateWallet(): Promise<{ mnemonic: string; address: string }> {
  const words = await mnemonicNew(24);
  const mnemonic = words.join(' ');
  const kp = await mnemonicToWalletKey(words);
  const w = WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey });
  return { mnemonic, address: w.address.toString() };
}

export async function getBalanceForAddress(address: string): Promise<bigint> {
  const c = await getClient();
  const addr = Address.parse(address);
  const state = await c.getContractState(addr);
  return BigInt(state.balance);
}

export async function transferTon(
  fromMnemonic: string,
  toAddress: string,
  amountTon: number,
): Promise<void> {
  const c = await getClient();
  const kp = await mnemonicToWalletKey(fromMnemonic.split(' '));
  const w = WalletContractV4.create({ workchain: 0, publicKey: kp.publicKey });
  const opened = c.open(w);
  const seqno = await opened.getSeqno();

  await opened.sendTransfer({
    secretKey: kp.secretKey,
    seqno,
    messages: [
      internal({
        to: Address.parse(toAddress),
        value: toNano(amountTon.toString()),
        bounce: false,
      }),
    ],
  });
}

// Legacy exports for backward compat (use getSenderFromMnemonic instead)
export async function getSender(): Promise<Sender> {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) throw new Error('WALLET_MNEMONIC env var is required');
  const { sender } = await getSenderFromMnemonic(mnemonic);
  return sender;
}

export async function getWalletAddress(): Promise<Address> {
  const mnemonic = process.env.WALLET_MNEMONIC;
  if (!mnemonic) throw new Error('WALLET_MNEMONIC env var is required');
  return addressFromMnemonic(mnemonic);
}

export async function getBalance(): Promise<bigint> {
  const addr = await getWalletAddress();
  return getBalanceForAddress(addr.toString());
}
