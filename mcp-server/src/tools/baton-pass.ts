import { ApiClient } from '../api/client';

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

    // 3. TODO: Deploy escrow contract on TON and lock funds
    // For now, we create the job directly
    const escrowAddress = 'EQ_ESCROW_PLACEHOLDER'; // Will be replaced with real escrow deployment

    // 4. Create job in backend
    const job = await api.createJob({
      hirer_address: process.env.WALLET_ADDRESS || 'hirer',
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
