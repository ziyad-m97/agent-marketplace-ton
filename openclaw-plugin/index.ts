/**
 * Baton Protocol plugin for OpenClaw.
 *
 * Registers 3 agent tools (hiring mode):
 *   - baton_pass:   find specialist, lock TON in escrow, delegate task
 *   - baton_status: check job progress and retrieve deliverables
 *   - baton_rate:   confirm delivery, release escrow, rate specialist
 *
 * The tools call the Baton backend API (default http://localhost:3001)
 * and the TON blockchain for escrow operations.
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

const BATON_API = process.env.BATON_API || "http://localhost:3001";
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || resolve(process.env.HOME || "~", ".openclaw/workspace");

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

// Set the Telegram bot's menu button to open the Baton TMA
async function setupTelegramMenuButton(botToken: string) {
  try {
    const tmaUrl = process.env.BATON_TMA_URL || "https://baton-tma.vercel.app";
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "Baton Account",
          web_app: { url: tmaUrl },
        },
      }),
    });
    const data = await res.json();
    if (data.ok) console.log("[baton] Menu button set: Baton Account →", tmaUrl);
  } catch {}
}

export default function (api: any) {
  // Set menu button on plugin load
  const botToken = api.config?.channels?.telegram?.botToken;
  if (botToken) setupTelegramMenuButton(botToken);
  // --- baton_pass ---
  api.registerTool({
    name: "baton_pass",
    description:
      "Delegate a task to a specialist agent. Searches the Baton marketplace for the best match, locks TON in an on-chain escrow, and submits the job. Use this when you need capabilities you don't have (3D rendering, pitch decks, specialized APIs).",
    parameters: {
      type: "object",
      properties: {
        task: {
          type: "string",
          description: "Short description of the task to delegate",
        },
        context: {
          type: "string",
          description: "Detailed context, requirements, specifications",
        },
        required_skills: {
          type: "array",
          items: { type: "string" },
          description: 'Skills the specialist must have (e.g. ["3d-rendering", "pitch-deck"])',
        },
        max_budget: {
          type: "number",
          description: "Maximum TON to spend on this delegation",
        },
      },
      required: ["task"],
    },
    async execute(_id: string, params: any) {
      try {
        // Search for specialists
        const skill = params.required_skills?.[0];
        const searchResult = await apiRequest("/jobs/search", {
          method: "POST",
          body: JSON.stringify({ skill, max_budget: params.max_budget }),
        });

        if (!searchResult.agents?.length) {
          return {
            content: [{ type: "text", text: `No specialists found for skill: ${skill || "any"}. Try different skills or increase budget.` }],
          };
        }

        const specialist = searchResult.agents[0];

        // Create job in backend (escrow deployment happens via the MCP server / worker side)
        const jobId = crypto.randomUUID();
        const job = await apiRequest("/jobs/create", {
          method: "POST",
          body: JSON.stringify({
            id: jobId,
            hirer_address: "openclaw-hirer",
            worker_address: specialist.address,
            task: params.task,
            context: params.context || "",
            escrow_address: `pending-${jobId}`,
            amount: specialist.price_per_job,
          }),
        });

        return {
          content: [
            {
              type: "text",
              text: [
                `✅ Baton passed! Job delegated to specialist.`,
                ``,
                `Job ID: ${job.job_id}`,
                `Specialist: ${specialist.address}`,
                `Skills: ${specialist.skills}`,
                `Price: ${specialist.price_per_job} TON`,
                ``,
                `The specialist has been notified. I'll check on progress — use baton_status to see updates.`,
              ].join("\n"),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Baton pass failed: ${err.message}` }],
          isError: true,
        };
      }
    },
  });

  // --- baton_status ---
  api.registerTool({
    name: "baton_status",
    description: "Check the status of a delegated job. Returns current state, deliverables, and file attachments.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The job ID returned by baton_pass",
        },
      },
      required: ["job_id"],
    },
    async execute(_id: string, params: any) {
      try {
        const { job, files } = await apiRequest(`/jobs/${params.job_id}`);

        const statusMap: Record<string, string> = {
          created: "⏳ Waiting for specialist to accept",
          accepted: "🔧 Specialist is working",
          delivered: "📦 Delivered — awaiting your review",
          confirmed: "✅ Completed",
          disputed: "⚠️ Disputed",
        };

        const fileList = files?.length
          ? files.map((f: any) => `  - ${f.filename} (${f.id})`).join("\n")
          : "  No files yet";

        return {
          content: [
            {
              type: "text",
              text: [
                `Job: ${job.id}`,
                `Status: ${statusMap[job.status] || job.status}`,
                `Task: ${job.task}`,
                `Amount: ${job.amount} TON`,
                ``,
                `Files:`,
                fileList,
                job.delivery_message ? `\nDelivery message: ${job.delivery_message}` : "",
              ].join("\n"),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Status check failed: ${err.message}` }],
          isError: true,
        };
      }
    },
  });

  // --- baton_rate ---
  api.registerTool({
    name: "baton_rate",
    description:
      "Rate a specialist after delivery and release payment. This confirms the job, releases TON from escrow to the specialist, and records the rating.",
    parameters: {
      type: "object",
      properties: {
        job_id: {
          type: "string",
          description: "The job ID to rate",
        },
        rating: {
          type: "number",
          minimum: 1,
          maximum: 5,
          description: "Rating from 1 (poor) to 5 (excellent)",
        },
      },
      required: ["job_id", "rating"],
    },
    async execute(_id: string, params: any) {
      try {
        // Confirm job
        await apiRequest(`/jobs/${params.job_id}/confirm`, { method: "PATCH" });

        // Submit rating
        await apiRequest(`/jobs/${params.job_id}/rate`, {
          method: "POST",
          body: JSON.stringify({ rating: params.rating }),
        });

        return {
          content: [
            {
              type: "text",
              text: [
                `Job ${params.job_id} completed and rated ${params.rating}★`,
                ``,
                `Escrow released. Specialist has been paid.`,
              ].join("\n"),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Rating failed: ${err.message}` }],
          isError: true,
        };
      }
    },
  });

  // --- baton_download ---
  api.registerTool({
    name: "baton_download",
    description:
      "Download a deliverable file from a completed Baton job to your workspace. Returns the local file path so you can send it to the user.",
    parameters: {
      type: "object",
      properties: {
        file_id: {
          type: "string",
          description: "The file ID from baton_status output",
        },
        filename: {
          type: "string",
          description: "Original filename (e.g. einstein_bust.glb)",
        },
      },
      required: ["file_id"],
    },
    async execute(_id: string, params: any) {
      try {
        const res = await fetch(`${BATON_API}/files/${params.file_id}`);
        if (!res.ok) {
          throw new Error(`Download failed: HTTP ${res.status}`);
        }

        const buffer = Buffer.from(await res.arrayBuffer());
        const filename = params.filename || `baton_file_${params.file_id}`;
        const outputPath = resolve(WORKSPACE, filename);

        writeFileSync(outputPath, buffer);

        return {
          content: [
            {
              type: "text",
              text: [
                `File downloaded to workspace: ${outputPath}`,
                `Filename: ${filename}`,
                `Size: ${(buffer.length / 1024 / 1024).toFixed(1)} MB`,
                ``,
                `You can now send this file to the user.`,
              ].join("\n"),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: `Download failed: ${err.message}` }],
          isError: true,
        };
      }
    },
  });
}
