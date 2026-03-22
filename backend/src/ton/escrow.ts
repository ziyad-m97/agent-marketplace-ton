import { Address, toNano } from '@ton/core';
import { Sender } from '@ton/core';
import { Escrow } from './tact_Escrow';
import { getClient, getSenderFromMnemonic } from './wallet';

export const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function waitForDeploy(escrowAddress: Address, timeoutMs = 30000): Promise<boolean> {
  const client = await getClient();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const state = await client.getContractState(escrowAddress);
      if (state.state === 'active') return true;
    } catch {}
    await sleep(3000);
  }
  return false;
}

export async function deployAndLockEscrow(
  hirerMnemonic: string,
  workerAddress: string,
  jobId: string,
  amountTon: number,
): Promise<{ escrowAddress: string }> {
  const client = await getClient();
  const { sender, address: hirerAddress } = await getSenderFromMnemonic(hirerMnemonic);
  const treasuryAddress = Address.parse(process.env.TREASURY_ADDRESS || hirerAddress.toString());
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h

  const escrow = await Escrow.fromInit(
    hirerAddress,
    Address.parse(workerAddress),
    treasuryAddress,
    deadline,
    jobId,
  );

  const openedEscrow = client.open(escrow);

  // Deploy
  console.log(`[escrow] Deploying escrow for job ${jobId}...`);
  await openedEscrow.send(sender, { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 0n });

  // Wait for deploy to confirm
  const deployed = await waitForDeploy(escrow.address);
  if (!deployed) {
    throw new Error('Escrow contract deployment timed out (30s)');
  }
  console.log(`[escrow] Contract deployed at ${escrow.address.toString()}`);

  // Lock TON
  console.log(`[escrow] Locking ${amountTon} TON...`);
  await openedEscrow.send(
    sender,
    { value: toNano(amountTon.toString()) },
    { $$type: 'Lock', jobId },
  );

  // Wait for lock to process
  await sleep(5000);
  console.log(`[escrow] TON locked successfully`);

  return { escrowAddress: escrow.address.toString() };
}

export async function confirmEscrow(hirerMnemonic: string, escrowAddress: string, jobId: string): Promise<void> {
  const client = await getClient();
  const { sender } = await getSenderFromMnemonic(hirerMnemonic);

  const escrow = Escrow.fromAddress(Address.parse(escrowAddress));
  const openedEscrow = client.open(escrow);

  console.log(`[escrow] Confirming escrow ${escrowAddress} for job ${jobId}...`);
  await openedEscrow.send(
    sender,
    { value: toNano('0.05') },
    { $$type: 'Confirm', jobId },
  );
  await sleep(5000);
  console.log(`[escrow] Payment released to worker`);
}

export async function deliverOnChainWithSender(
  escrowAddress: string,
  jobId: string,
  workerSender: Sender,
): Promise<void> {
  const client = await getClient();

  const escrow = Escrow.fromAddress(Address.parse(escrowAddress));
  const openedEscrow = client.open(escrow);

  console.log(`[escrow] Worker delivering on-chain for job ${jobId}...`);
  await openedEscrow.send(
    workerSender,
    { value: toNano('0.05') },
    { $$type: 'Deliver', jobId },
  );
  await sleep(5000);
  console.log(`[escrow] On-chain delivery confirmed`);
}

export async function disputeEscrow(hirerMnemonic: string, escrowAddress: string, jobId: string): Promise<void> {
  const client = await getClient();
  const { sender } = await getSenderFromMnemonic(hirerMnemonic);

  const escrow = Escrow.fromAddress(Address.parse(escrowAddress));
  const openedEscrow = client.open(escrow);

  await openedEscrow.send(
    sender,
    { value: toNano('0.05') },
    { $$type: 'Dispute', jobId },
  );
}

export async function getEscrowStatus(escrowAddress: string): Promise<{ status: bigint; amount: bigint }> {
  const client = await getClient();

  const escrow = Escrow.fromAddress(Address.parse(escrowAddress));
  const openedEscrow = client.open(escrow);

  const status = await openedEscrow.getStatus();
  const amount = await openedEscrow.getAmount();

  return { status, amount };
}
