import { ApiClient } from '../api/client';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonDeliverParams {
  job_id: string;
  message: string;
  file_paths?: string[];
}

export async function batonDeliver(params: BatonDeliverParams) {
  try {
    // Upload files if provided
    if (params.file_paths && params.file_paths.length > 0) {
      await api.uploadFiles(params.job_id, params.file_paths, 'worker');
    }

    // Mark job as delivered
    await api.deliverJob(params.job_id, params.message);

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Job ${params.job_id} delivered successfully.`,
          ``,
          `Message: ${params.message}`,
          `Files: ${params.file_paths?.length || 0} file(s) uploaded`,
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
