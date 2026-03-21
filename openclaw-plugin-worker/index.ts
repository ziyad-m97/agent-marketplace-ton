/**
 * Baton Protocol WORKER plugin for OpenClaw.
 *
 * This plugin gives a specialist agent the ability to:
 * - Listen for incoming jobs matching its skills
 * - Accept jobs
 * - Deliver files + mark delivery on-chain
 *
 * The specialist agent should poll baton_listen periodically and
 * autonomously accept + complete matching work.
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const BATON_API = process.env.BATON_API || "http://localhost:3001";
const WORKER_ADDRESS = process.env.WORKER_ADDRESS || "";
const WORKER_MNEMONIC = process.env.WORKER_MNEMONIC || "";

async function apiRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${BATON_API}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function uploadFile(jobId: string, filePath: string) {
  const fileBuffer = readFileSync(filePath);
  const fileName = filePath.split("/").pop()!;
  const formData = new FormData();
  formData.append("job_id", jobId);
  formData.append("uploaded_by", WORKER_ADDRESS);
  formData.append("files", new Blob([fileBuffer]), fileName);

  const res = await fetch(`${BATON_API}/files/upload`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) throw new Error(`File upload failed: ${res.statusText}`);
  return res.json();
}

export default function (api: any) {

  // --- baton_listen ---
  api.registerTool({
    name: "baton_listen",
    description: "Check for pending jobs assigned to this specialist. Poll this every 10 seconds.",
    parameters: {
      type: "object",
      properties: {},
    },
    async execute() {
      try {
        const result = await apiRequest(`/jobs?worker=${WORKER_ADDRESS}&status=created`);

        if (!result.jobs?.length) {
          return {
            content: [{
              type: "text",
              text: "No pending jobs. Poll again in 10s.",
            }],
          };
        }

        const jobList = result.jobs.map((j: any) =>
          `- Job ${j.id}: "${j.task}" — ${j.amount} TON`
        ).join("\n");

        return {
          content: [{
            type: "text",
            text: `${result.jobs.length} pending job(s):\n\n${jobList}\n\nUse baton_accept(job_id) to accept.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Listen failed: ${err.message}` }], isError: true };
      }
    },
  });

  // --- baton_accept ---
  api.registerTool({
    name: "baton_accept",
    description: "Accept a pending job. Returns full task details and context.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job ID from baton_listen" },
      },
      required: ["job_id"],
    },
    async execute(_id: string, params: any) {
      try {
        await apiRequest(`/jobs/${params.job_id}/accept`, {
          method: "PATCH",
          body: JSON.stringify({ worker_address: WORKER_ADDRESS }),
        });

        const { job } = await apiRequest(`/jobs/${params.job_id}`);

        return {
          content: [{
            type: "text",
            text: [
              `Job accepted.`,
              ``,
              `Task: ${job.task}`,
              `Context: ${job.context || "none"}`,
              `Payment: ${job.amount} TON (locked in escrow)`,
              ``,
              `Complete the work and call baton_deliver(job_id, file_paths) when done.`,
            ].join("\n"),
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Accept failed: ${err.message}` }], isError: true };
      }
    },
  });

  // --- baton_deliver ---
  api.registerTool({
    name: "baton_deliver",
    description: "Deliver completed work. Upload files and mark job as delivered (including on-chain).",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job ID" },
        file_paths: {
          type: "array",
          items: { type: "string" },
          description: "Absolute paths to deliverable files",
        },
        message: { type: "string", description: "Short delivery message" },
      },
      required: ["job_id"],
    },
    async execute(_id: string, params: any) {
      try {
        // Upload files
        if (params.file_paths?.length) {
          for (const filePath of params.file_paths) {
            await uploadFile(params.job_id, filePath);
          }
        }

        // On-chain delivery
        const { job } = await apiRequest(`/jobs/${params.job_id}`);
        if (WORKER_MNEMONIC && job.escrow_address && !job.escrow_address.startsWith("pending")) {
          try {
            await apiRequest("/escrow/deliver", {
              method: "POST",
              body: JSON.stringify({ job_id: params.job_id, worker_mnemonic: WORKER_MNEMONIC }),
            });
          } catch (escrowErr: any) {
            console.log(`[baton-worker] On-chain deliver failed: ${escrowErr.message}`);
          }
        }

        // Mark delivered in backend
        await apiRequest(`/jobs/${params.job_id}/deliver`, {
          method: "PATCH",
          body: JSON.stringify({ message: params.message || "Work completed." }),
        });

        return {
          content: [{
            type: "text",
            text: `Delivered. ${params.file_paths?.length || 0} file(s) uploaded. Waiting for hirer to confirm and release payment.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Delivery failed: ${err.message}` }], isError: true };
      }
    },
  });
}
