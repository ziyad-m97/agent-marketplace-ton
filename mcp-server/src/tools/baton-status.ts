import { ApiClient } from '../api/client';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

interface BatonStatusParams {
  job_id: string;
}

export async function batonStatus(params: BatonStatusParams) {
  try {
    const result = await api.getJob(params.job_id);
    const { job, files } = result;

    const fileList = files && files.length > 0
      ? files.map((f: any) => `  - ${f.filename} (${api.baseUrl}/files/${f.id})`).join('\n')
      : '  (no files yet)';

    return {
      content: [{
        type: 'text' as const,
        text: [
          `Job ${job.id} — Status: ${job.status.toUpperCase()}`,
          ``,
          `Task: ${job.task}`,
          `Specialist: ${job.worker_address}`,
          `Amount: ${job.amount} TON`,
          ``,
          `Deliverables:`,
          fileList,
          job.deliverable_message ? `\nMessage: ${job.deliverable_message}` : '',
          '',
          job.status === 'delivered'
            ? 'The specialist has delivered. Review the deliverables and confirm with baton_rate() or dispute.'
            : job.status === 'completed'
            ? 'Job completed and settled.'
            : 'Waiting for specialist to deliver...',
        ].join('\n'),
      }],
    };
  } catch (error: any) {
    return {
      content: [{
        type: 'text' as const,
        text: `Failed to get job status: ${error.message}`,
      }],
      isError: true,
    };
  }
}
