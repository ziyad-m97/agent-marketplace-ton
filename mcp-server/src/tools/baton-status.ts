import { ApiClient } from '../api/client';

const api = new ApiClient(process.env.BATON_API || 'http://localhost:3001');

const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 60000;

interface BatonStatusParams {
  job_id: string;
}

/**
 * Internal polling loop: polls GET /jobs/:id every 3s until the job reaches
 * a terminal state (delivered, completed, disputed, expired) or 60s timeout.
 * Returns only when there is something actionable for the LLM.
 */
export async function batonStatus(params: BatonStatusParams) {
  const start = Date.now();

  while (true) {
    try {
      const result = await api.getJob(params.job_id);
      const { job, files } = result;
      const status = job.status?.toLowerCase();

      // Terminal states — return immediately
      if (status === 'delivered' || status === 'completed' || status === 'disputed' || status === 'expired') {
        const fileList = files && files.length > 0
          ? files.map((f: any) => `  - ${f.filename} (${api.baseUrl}/files/${f.id})`).join('\n')
          : '  (no files yet)';

        return {
          content: [{
            type: 'text' as const,
            text: [
              `Job ${job.id} — Status: ${status.toUpperCase()}`,
              ``,
              `Task: ${job.task}`,
              `Specialist: ${job.worker_address}`,
              `Amount: ${job.amount} TON`,
              ``,
              `Deliverables:`,
              fileList,
              job.deliverable_message ? `\nMessage: ${job.deliverable_message}` : '',
              '',
              status === 'delivered'
                ? 'The specialist has delivered. Review the deliverables and confirm with baton_rate() or dispute.'
                : status === 'completed'
                ? 'Job completed and settled.'
                : status === 'disputed'
                ? 'Job was disputed.'
                : 'Job expired.',
            ].join('\n'),
          }],
        };
      }

      // Timeout check
      if (Date.now() - start >= POLL_TIMEOUT_MS) {
        return {
          content: [{
            type: 'text' as const,
            text: `Job ${job.id} is still "${status}" after 60s. The specialist may be busy. Try calling baton_status again later.`,
          }],
        };
      }

      // Wait and poll again
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

    } catch (error: any) {
      // On transient errors, keep retrying until timeout
      if (Date.now() - start >= POLL_TIMEOUT_MS) {
        return {
          content: [{
            type: 'text' as const,
            text: `Failed to get job status after 60s: ${error.message}`,
          }],
          isError: true,
        };
      }
      await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
  }
}
