import { ApiClient } from '../api/client';
import { getWalletAddress } from '../ton/wallet';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

export async function batonListen() {
  try {
    const walletAddress = await getWalletAddress();
    const workerAddress = walletAddress.toString();
    const result = await api.getJobs({ worker: workerAddress, status: 'created' });

    if (!result.jobs || result.jobs.length === 0) {
      return {
        content: [{
          type: 'text' as const,
          text: 'No pending jobs matching your skills. Waiting...',
        }],
      };
    }

    const jobList = result.jobs.map((j: any) =>
      `- Job ${j.id}: "${j.task}" — ${j.amount} TON`
    ).join('\n');

    return {
      content: [{
        type: 'text' as const,
        text: [
          `${result.jobs.length} pending job(s) found:`,
          '',
          jobList,
          '',
          'Use baton_accept(job_id) to accept a job.',
        ].join('\n'),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to listen for jobs: ${error.message}`,
      }],
      isError: true,
    };
  }
}
