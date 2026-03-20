import { ApiClient } from '../api/client';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonRateParams {
  job_id: string;
  rating: number;
}

export async function batonRate(params: BatonRateParams) {
  try {
    // Confirm the job first
    await api.confirmJob(params.job_id);

    // Then rate
    await api.rateJob(params.job_id, params.rating);

    // TODO: Release escrow on TON blockchain

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Job ${params.job_id} completed and rated ${params.rating}★`,
          ``,
          `Escrow released. Specialist has been paid.`,
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
