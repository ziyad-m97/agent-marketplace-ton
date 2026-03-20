import { Address, toNano } from '@ton/core';
import { Escrow } from '../../../contracts/build/Escrow/tact_Escrow';
import { getClient, getSender, getWalletAddress } from './wallet';

const DEPLOY_DELAY_MS = 5000; // wait for deploy to confirm on testnet

export async function deployAndLockEscrow(
  workerAddress: string,
  jobId: string,
  amountTon: number,
): Promise<{ escrowAddress: string }> {
  const client = await getClient();
  const sender = await getSender();
  const hirerAddress = await getWalletAddress();
  const treasuryAddress = Address.parse(process.env.TREASURY_ADDRESS || hirerAddress.toString());
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 86400); // 24h

  // Create escrow instance (fromInit sets code+data, first send deploys)
  const escrow = await Escrow.fromInit(
    hirerAddress,
    Address.parse(workerAddress),
    treasuryAddress,
    deadline,
    jobId,
  );

  const openedEscrow = client.open(escrow);

  // Deploy the contract
  await openedEscrow.send(sender, { value: toNano('0.05') }, { $$type: 'Deploy', queryId: 0n });

  // Wait for deployment to confirm
  await new Promise(r => setTimeout(r, DEPLOY_DELAY_MS));

  // Lock TON in escrow
  await openedEscrow.send(
    sender,
    { value: toNano(amountTon.toString()) },
    { $$type: 'Lock', jobId },
  );

  return { escrowAddress: escrow.address.toString() };
}

export async function confirmEscrow(escrowAddress: string, jobId: string): Promise<void> {
  const client = await getClient();
  const sender = await getSender();

  const escrow = Escrow.fromAddress(Address.parse(escrowAddress));
  const openedEscrow = client.open(escrow);

  await openedEscrow.send(
    sender,
    { value: toNano('0.05') },
    { $$type: 'Confirm', jobId },
  );
}

export async function deliverOnChain(escrowAddress: string, jobId: string): Promise<void> {
  const client = await getClient();
  const sender = await getSender();

  const escrow = Escrow.fromAddress(Address.parse(escrowAddress));
  const openedEscrow = client.open(escrow);

  await openedEscrow.send(
    sender,
    { value: toNano('0.05') },
    { $$type: 'Deliver', jobId },
  );
}

export async function disputeEscrow(escrowAddress: string, jobId: string): Promise<void> {
  const client = await getClient();
  const sender = await getSender();

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
