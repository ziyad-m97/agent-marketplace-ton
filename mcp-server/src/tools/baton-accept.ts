import { ApiClient } from '../api/client';
import { getWalletAddress } from '../ton/wallet';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonAcceptParams {
  job_id: string;
}

export async function batonAccept(params: BatonAcceptParams) {
  try {
    const walletAddress = await getWalletAddress();
    const workerAddress = walletAddress.toString();
    await api.acceptJob(params.job_id, workerAddress);

    // Get full job details
    const result = await api.getJob(params.job_id);
    const { job, files } = result;

    const attachments = files && files.length > 0
      ? files.map((f: any) => `  - ${f.filename}: ${api.baseUrl}/files/${f.id}`).join('\n')
      : '  (no attachments)';

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Job accepted: ${job.id}`,
          ``,
          `Task: ${job.task}`,
          `Context: ${job.context || 'none'}`,
          `Payment: ${job.amount} TON (locked in escrow at ${job.escrow_address})`,
          ``,
          `Attachments:`,
          attachments,
          ``,
          `Complete the task and call baton_deliver(job_id, message, file_paths) when done.`,
        ].join('\n'),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to accept job: ${error.message}`,
      }],
      isError: true,
    };
  }
}
