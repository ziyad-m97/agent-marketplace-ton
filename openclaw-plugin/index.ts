/**
 * Baton Protocol plugin for OpenClaw.
 *
 * Supports two modes via BATON_MODE env var:
 * - "hiring" (default): baton_pass, baton_status, baton_rate, baton_download
 * - "worker": baton_listen, baton_accept, baton_deliver
 *
 * Hiring UX rules:
 * - Plugin sends "Delegating..." message with Cancel button (from baton_pass)
 * - Plugin sends rating buttons 4s after delivery (from baton_status)
 * - Plugin handles button callbacks (rating + wallet)
 * - Agent ONLY sends the deliverable file + one short sentence
 * - No job IDs, prices, or specialist details shown to user
 */

import { writeFileSync, readFileSync } from "fs";
import { resolve } from "path";

const BATON_API = process.env.BATON_API || "http://localhost:3001";
const BATON_MODE = process.env.BATON_MODE || "hiring"; // "hiring" or "worker"
const TMA_URL = process.env.BATON_TMA_URL || "https://tma-theta-lovat.vercel.app";
const WORKSPACE = process.env.OPENCLAW_WORKSPACE || resolve(process.env.HOME || "~", ".openclaw/workspace");
const WORKER_ADDRESS = process.env.WORKER_ADDRESS || "";
const WORKER_MNEMONIC = process.env.WORKER_MNEMONIC || "";

// Hirer's Baton wallet address (resolved on first use)
let hirerBatonAddress: string | null = null;

async function getHirerBatonAddress(): Promise<string> {
  if (hirerBatonAddress) return hirerBatonAddress;
  try {
    const result = await apiRequest("/wallets/get-or-create", {
      method: "POST",
      body: JSON.stringify({ ton_connect_address: "openclaw-hirer" }),
    });
    hirerBatonAddress = result.baton_address;
    return hirerBatonAddress!;
  } catch (err: any) {
    console.log(`[baton] Failed to get hirer wallet: ${err.message}`);
    return "openclaw-hirer"; // fallback
  }
}

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

function parseChatId(sessionKey?: string): string | null {
  if (!sessionKey) return null;
  const parts = sessionKey.split(":");
  const idx = parts.indexOf("telegram");
  if (idx >= 0 && idx + 2 < parts.length) return parts[idx + 2];
  return null;
}

async function tgSend(botToken: string, chatId: string, text: string, buttons?: any[][]) {
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (buttons?.length) body.reply_markup = { inline_keyboard: buttons };
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch (err: any) {
    console.log("[baton] tgSend failed:", err.message);
  }
}

async function setupTelegramMenuButton(botToken: string, url: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "web_app", text: "Baton Account", web_app: { url } },
      }),
    });
  } catch {}
}

// Track active jobs for cancel support
const activeJobs = new Map<string, string>(); // jobId → status

async function uploadFile(jobId: string, filePath: string) {
  const fileBuffer = readFileSync(filePath);
  const fileName = filePath.split("/").pop()!;
  const formData = new FormData();
  formData.append("job_id", jobId);
  formData.append("uploaded_by", WORKER_ADDRESS);
  formData.append("files", new Blob([fileBuffer]), fileName);
  const res = await fetch(`${BATON_API}/files/upload`, { method: "POST", body: formData });
  if (!res.ok) throw new Error(`File upload failed: ${res.statusText}`);
  return res.json();
}

export default function (api: any) {
  const botToken = api.config?.channels?.telegram?.botToken;
  if (botToken) {
    const tmaUrl = BATON_MODE === "worker" ? `${TMA_URL}?mode=worker` : TMA_URL;
    setupTelegramMenuButton(botToken, tmaUrl);
  }

  // ============================================================
  // WORKER MODE — specialist tools
  // ============================================================
  if (BATON_MODE === "worker") {
    // --- baton_listen ---
    api.registerTool({
      name: "baton_listen",
      description: "Check for pending jobs assigned to this specialist. Poll every 10 seconds.",
      parameters: { type: "object", properties: {} },
      async execute() {
        try {
          const result = await apiRequest(`/jobs?worker=${WORKER_ADDRESS}&status=created`);
          if (!result.jobs?.length) {
            return { content: [{ type: "text", text: "No pending jobs. Poll again in 10s." }] };
          }
          const jobList = result.jobs.map((j: any) =>
            `- Job ${j.id}: "${j.task}" — ${j.amount} TON`
          ).join("\n");
          return {
            content: [{ type: "text", text: `${result.jobs.length} pending job(s):\n\n${jobList}\n\nUse baton_accept(job_id) to accept.` }],
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
        properties: { job_id: { type: "string", description: "Job ID from baton_listen" } },
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
              text: `Job accepted.\n\nTask: ${job.task}\nContext: ${job.context || "none"}\nPayment: ${job.amount} TON (locked in escrow)\n\nComplete the work and call baton_deliver(job_id, file_paths) when done.`,
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
          file_paths: { type: "array", items: { type: "string" }, description: "Absolute paths to deliverable files" },
          message: { type: "string", description: "Short delivery message" },
        },
        required: ["job_id"],
      },
      async execute(_id: string, params: any) {
        try {
          // Upload files
          if (params.file_paths?.length) {
            for (const fp of params.file_paths) {
              await uploadFile(params.job_id, fp);
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
            content: [{ type: "text", text: `Delivered. ${params.file_paths?.length || 0} file(s) uploaded. Waiting for hirer to confirm and release payment.` }],
          };
        } catch (err: any) {
          return { content: [{ type: "text", text: `Delivery failed: ${err.message}` }], isError: true };
        }
      },
    });

    return; // Worker mode — don't register hiring tools
  }

  // ============================================================
  // HIRING MODE — hirer tools (default)
  // ============================================================

  // --- baton_pass ---
  api.registerTool((ctx: any) => ({
    name: "baton_pass",
    description: "Delegate a task to a specialist. Say NOTHING to the user — the plugin sends a message.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Short task description" },
        context: { type: "string", description: "Detailed requirements" },
        required_skills: { type: "array", items: { type: "string" }, description: 'e.g. ["3d-rendering"]' },
        max_budget: { type: "number", description: "Max TON budget" },
      },
      required: ["task"],
    },
    async execute(_id: string, params: any) {
      const chatId = parseChatId(ctx.sessionKey);
      try {
        const skill = params.required_skills?.[0];
        const searchResult = await apiRequest("/jobs/search", {
          method: "POST",
          body: JSON.stringify({ skill, max_budget: params.max_budget }),
        });

        if (!searchResult.agents?.length) {
          return { content: [{ type: "text", text: "No specialists available right now." }] };
        }

        const specialist = searchResult.agents[0];
        const hirerAddr = await getHirerBatonAddress();
        const jobId = crypto.randomUUID();
        await apiRequest("/jobs/create", {
          method: "POST",
          body: JSON.stringify({
            id: jobId,
            hirer_address: hirerAddr,
            worker_address: specialist.address,
            task: params.task,
            context: params.context || "",
            escrow_address: `pending-${jobId}`,
            amount: specialist.price_per_job,
          }),
        });

        activeJobs.set(jobId, "created");

        // Send "Delegating..." with Cancel button — this arrives BEFORE agent response
        if (chatId && botToken) {
          await tgSend(botToken, chatId,
            `🔄 Delegating to a specialist...`,
            [[{ text: "✕ Cancel", callback_data: `bc:${jobId}` }]]
          );
        }

        // Deploy real escrow contract and lock TON on-chain (with retry)
        let escrowDeployed = false;
        for (let attempt = 1; attempt <= 2; attempt++) {
          try {
            await apiRequest("/escrow/deploy", {
              method: "POST",
              body: JSON.stringify({
                job_id: jobId,
                worker_address: specialist.address,
                amount: specialist.price_per_job,
              }),
            });
            escrowDeployed = true;
            break;
          } catch (escrowErr: any) {
            console.log(`[baton] Escrow deploy attempt ${attempt} failed: ${escrowErr.message}`);
            if (attempt < 2) await new Promise(r => setTimeout(r, 3000));
          }
        }
        if (!escrowDeployed) {
          console.log(`[baton] ⚠️ Escrow deploy failed after 2 attempts — job ${jobId} continues with pending escrow. Payment will be retried at confirm time.`);
        }

        return {
          content: [{
            type: "text",
            text: `[internal] job_id=${jobId}\nSay NOTHING to the user. Call baton_status("${jobId}") immediately — it will wait internally until the specialist delivers.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Delegation failed: ${err.message}` }], isError: true };
      }
    },
  }));

  // --- baton_status (with internal polling — blocks until delivered or 60s timeout) ---
  api.registerTool((ctx: any) => ({
    name: "baton_status",
    description: "Wait for a delegated job to complete. Blocks internally (up to 60s). When delivered, files are auto-downloaded. Send file to user with one short sentence. Say nothing else.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job ID from baton_pass" },
      },
      required: ["job_id"],
    },
    async execute(_id: string, params: any) {
      const chatId = parseChatId(ctx.sessionKey);
      const POLL_INTERVAL = 3000;
      const POLL_TIMEOUT = 60000;
      const start = Date.now();

      while (true) {
        // Check if cancelled
        if (activeJobs.get(params.job_id) === "cancelled") {
          return { content: [{ type: "text", text: "Job was cancelled by the user." }] };
        }

        try {
          const { job, files } = await apiRequest(`/jobs/${params.job_id}`);
          const status = job.status?.toLowerCase();

          // Terminal: delivered — download files and return
          if (status === "delivered" || status === "completed") {
            activeJobs.set(params.job_id, "delivered");

            const downloadedFiles: string[] = [];
            if (files?.length) {
              for (const f of files) {
                try {
                  const fileRes = await fetch(`${BATON_API}/files/${f.id}`);
                  if (fileRes.ok) {
                    const buffer = Buffer.from(await fileRes.arrayBuffer());
                    const outputPath = resolve(WORKSPACE, f.filename);
                    writeFileSync(outputPath, buffer);
                    downloadedFiles.push(outputPath);
                  }
                } catch {}
              }
            }

            // Rating buttons arrive 4s after agent's response
            if (chatId && botToken) {
              setTimeout(() => {
                tgSend(botToken, chatId, `Rate:`, [
                  [
                    { text: "⭐ 1", callback_data: `br:${job.id}:1` },
                    { text: "⭐ 2", callback_data: `br:${job.id}:2` },
                    { text: "⭐ 3", callback_data: `br:${job.id}:3` },
                    { text: "⭐ 4", callback_data: `br:${job.id}:4` },
                    { text: "⭐ 5", callback_data: `br:${job.id}:5` },
                  ],
                  [{ text: "💰 My Account", callback_data: "bw" }],
                ]);
              }, 4000);
            }

            return {
              content: [{
                type: "text",
                text: `DELIVERED. Files: ${downloadedFiles.join(", ")}\nSend the file to the user. Say ONE short sentence like "Here's your Einstein bust!" — nothing else. No job ID. No price. No details. No rating prompt.`,
              }],
            };
          }

          // Terminal: disputed or expired
          if (status === "disputed" || status === "expired") {
            return {
              content: [{
                type: "text",
                text: `Job ${status}. ${status === "disputed" ? "The job was disputed." : "The job expired — specialist did not deliver in time."}`,
              }],
            };
          }

          // Timeout
          if (Date.now() - start >= POLL_TIMEOUT) {
            return {
              content: [{
                type: "text",
                text: `Job is still "${status}" after 60s. The specialist may be busy. You can call baton_status again later.`,
              }],
            };
          }

          // Wait and poll again
          await new Promise(r => setTimeout(r, POLL_INTERVAL));

        } catch (err: any) {
          if (Date.now() - start >= POLL_TIMEOUT) {
            return { content: [{ type: "text", text: `Failed after 60s: ${err.message}` }], isError: true };
          }
          await new Promise(r => setTimeout(r, POLL_INTERVAL));
        }
      }
    },
  }));

  // --- baton_rate (fallback if buttons don't work) ---
  api.registerTool({
    name: "baton_rate",
    description: "Rate specialist and release escrow. Usually handled by buttons automatically.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        rating: { type: "number", minimum: 1, maximum: 5 },
      },
      required: ["job_id", "rating"],
    },
    async execute(_id: string, params: any) {
      try {
        // /escrow/confirm handles everything: deploy, deliver, confirm, retries
        await apiRequest(`/escrow/confirm`, {
          method: "POST",
          body: JSON.stringify({ job_id: params.job_id }),
        });

        try {
          await apiRequest(`/jobs/${params.job_id}/confirm`, { method: "PATCH" });
        } catch { /* already completed */ }

        await apiRequest(`/jobs/${params.job_id}/rate`, {
          method: "POST",
          body: JSON.stringify({ rating: params.rating }),
        });

        return { content: [{ type: "text", text: `Done. ${params.rating}★ — Specialist paid on-chain.` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Payment failed: ${err.message}` }], isError: true };
      }
    },
  });

  // --- baton_download (fallback) ---
  api.registerTool({
    name: "baton_download",
    description: "Download deliverable file. Usually baton_status does this automatically.",
    parameters: {
      type: "object",
      properties: {
        file_id: { type: "string" },
        filename: { type: "string" },
      },
      required: ["file_id"],
    },
    async execute(_id: string, params: any) {
      try {
        const res = await fetch(`${BATON_API}/files/${params.file_id}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const buffer = Buffer.from(await res.arrayBuffer());
        const filename = params.filename || `baton_file_${params.file_id}`;
        const outputPath = resolve(WORKSPACE, filename);
        writeFileSync(outputPath, buffer);
        return { content: [{ type: "text", text: outputPath }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
      }
    },
  });

  // --- Handle inline button callbacks ---
  if (botToken) {
    api.registerHook("message:inbound", async (event: any) => {
      const text = event?.message?.text || "";
      const chatId = parseChatId(event?.sessionKey);
      if (!chatId) return;

      // Rating: "callback_data: br:<jobId>:<rating>"
      if (text.startsWith("callback_data: br:")) {
        const [, jobId, ratingStr] = text.replace("callback_data: ", "").split(":");
        const rating = parseInt(ratingStr, 10);
        if (jobId && rating >= 1 && rating <= 5) {
          try {
            await tgSend(botToken, chatId, `⏳ Releasing payment on-chain...`);

            // /escrow/confirm handles EVERYTHING: deploy, deliver, confirm, retries
            // It only returns 200 if the specialist is actually paid on-chain
            await apiRequest(`/escrow/confirm`, {
              method: "POST",
              body: JSON.stringify({ job_id: jobId }),
            });

            // Backend confirm + rate (confirm may already be done by /escrow/confirm)
            try {
              await apiRequest(`/jobs/${jobId}/confirm`, { method: "PATCH" });
            } catch { /* already completed */ }

            await apiRequest(`/jobs/${jobId}/rate`, {
              method: "POST",
              body: JSON.stringify({ rating }),
            });

            await tgSend(botToken, chatId,
              `✅ ${rating}★ — Specialist paid on-chain.`,
              [[{ text: "💰 My Account", callback_data: "bw" }]]
            );
          } catch (err: any) {
            await tgSend(botToken, chatId, `❌ Payment failed: ${err.message}`);
          }
          return { handled: true };
        }
      }

      // Cancel: "callback_data: bc:<jobId>"
      if (text.startsWith("callback_data: bc:")) {
        const jobId = text.replace("callback_data: bc:", "");
        activeJobs.set(jobId, "cancelled");
        await tgSend(botToken, chatId, `Cancelled.`);
        return { handled: true };
      }

      // Wallet
      if (text === "callback_data: bw") {
        await tgSend(botToken, chatId, `Tap <b>Baton Account</b> in the menu ↙️`);
        return { handled: true };
      }
    });
  }
}
