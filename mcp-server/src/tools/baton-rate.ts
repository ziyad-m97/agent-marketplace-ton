import { ApiClient } from '../api/client';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonRateParams {
  job_id: string;
  rating: number;
}

export async function batonRate(params: BatonRateParams) {
  try {
    // 1. Release escrow via backend — it handles deploy/deliver/confirm/retries
    await api.confirmEscrow(params.job_id);

    // 2. Confirm the job in the backend
    try {
      await api.confirmJob(params.job_id);
    } catch { /* /escrow/confirm already set status to completed */ }

    // 3. Submit rating
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
        text: `Failed to rate and pay: ${error.message}`,
      }],
      isError: true,
    };
  }
}
