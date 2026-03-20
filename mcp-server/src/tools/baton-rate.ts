import { ApiClient } from '../api/client';
import { confirmEscrow } from '../ton/escrow';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonRateParams {
  job_id: string;
  rating: number;
}

export async function batonRate(params: BatonRateParams) {
  try {
    // 1. Get job details to retrieve escrow address
    const { job } = await api.getJob(params.job_id);

    if (!job.escrow_address) {
      return {
        content: [{
          type: 'text' as const,
          text: `Job ${params.job_id} has no escrow address. Cannot release funds.`,
        }],
        isError: true,
      };
    }

    // 2. Release escrow on TON blockchain
    try {
      await confirmEscrow(job.escrow_address, params.job_id);
    } catch (tonError: any) {
      return {
        content: [{
          type: 'text' as const,
          text: `Failed to release escrow on-chain: ${tonError.message}. The job delivery is recorded but payment was not released.`,
        }],
        isError: true,
      };
    }

    // 3. Confirm the job in the backend
    await api.confirmJob(params.job_id);

    // 4. Submit rating
    await api.rateJob(params.job_id, params.rating);

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Job ${params.job_id} completed and rated ${params.rating}★`,
          ``,
          `Escrow released on-chain. Specialist received payment (minus 2% protocol fee).`,
          `Thank you for using Baton Protocol.`,
        ].join('\n'),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to rate: ${error.message}`,
      }],
      isError: true,
    };
  }
}
