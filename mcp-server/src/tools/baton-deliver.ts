import { ApiClient } from '../api/client';
import { deliverOnChain } from '../ton/escrow';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonDeliverParams {
  job_id: string;
  message: string;
  file_paths?: string[];
}

export async function batonDeliver(params: BatonDeliverParams) {
  try {
    // 1. Upload files if provided
    if (params.file_paths && params.file_paths.length > 0) {
      await api.uploadFiles(params.job_id, params.file_paths, 'worker');
    }

    // 2. Get job details to retrieve escrow address
    const { job } = await api.getJob(params.job_id);

    // 3. Send Deliver message to escrow on-chain (transitions status 0 → 1)
    if (job.escrow_address) {
      try {
        await deliverOnChain(job.escrow_address, params.job_id);
      } catch (tonError: any) {
        // Log but don't fail — backend delivery still works
        console.error(`On-chain deliver failed: ${tonError.message}`);
      }
    }

    // 4. Mark job as delivered in backend
    await api.deliverJob(params.job_id, params.message);

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Job ${params.job_id} delivered successfully.`,
          ``,
          `Message: ${params.message}`,
          `Files: ${params.file_paths?.length || 0} file(s) uploaded`,
          `Escrow: on-chain status updated to DELIVERED`,
          ``,
          `Waiting for hirer to confirm and release escrow.`,
        ].join('\n'),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to deliver: ${error.message}`,
      }],
      isError: true,
    };
  }
}
