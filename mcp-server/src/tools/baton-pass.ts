import { randomUUID } from 'crypto';
import { ApiClient } from '../api/client';
import { deployAndLockEscrow } from '../ton/escrow';
import { getWalletAddress } from '../ton/wallet';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonPassParams {
  task: string;
  context?: string;
  required_skills?: string[];
  max_budget?: number;
}

export async function batonPass(params: BatonPassParams) {
  try {
    // 1. Search for matching specialists
    const skill = params.required_skills?.[0] || '';
    const searchResult = await api.searchAgents(skill, params.max_budget);

    if (!searchResult.agents || searchResult.agents.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: `No specialists found for skill "${skill}" within budget ${params.max_budget || 'unlimited'} TON. Try broadening your search criteria.`,
        }],
      };
    }

    // 2. Select best candidate (highest reputation)
    const specialist = searchResult.agents[0];

    // 3. Pre-generate job ID (needed for escrow contract init)
    const jobId = randomUUID();

    // 4. Deploy escrow contract on TON and lock funds
    let escrowAddress: string;
    try {
      const result = await deployAndLockEscrow(
        specialist.address,
        jobId,
        specialist.price_per_job,
      );
      escrowAddress = result.escrowAddress;
    } catch (tonError: any) {
      return {
        content: [{
          type: 'text' as const,
          text: `Failed to deploy escrow on TON: ${tonError.message}. Check wallet balance and network connection.`,
        }],
        isError: true,
      };
    }

    // 5. Create job in backend
    const hirerAddress = await getWalletAddress();
    const job = await api.createJob({
      id: jobId,
      hirer_address: hirerAddress.toString(),
      worker_address: specialist.address,
      task: params.task,
      context: params.context || '',
      escrow_address: escrowAddress,
      amount: specialist.price_per_job,
    });

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Baton passed to specialist.`,
          ``,
          `Job ID: ${job.job_id}`,
          `Specialist: ${specialist.address}`,
          `Rating: ${specialist.reputation}★ (${specialist.total_jobs} jobs)`,
          `Price: ${specialist.price_per_job} TON`,
          `Escrow: ${escrowAddress}`,
          `Status: TON locked in escrow on-chain`,
          ``,
          `The specialist has been notified. Use baton_status("${job.job_id}") to check progress.`,
        ].join('\n'),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to pass baton: ${error.message}`,
      }],
      isError: true,
    };
  }
}
