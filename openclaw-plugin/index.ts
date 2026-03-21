/**
 * Baton Protocol plugin for OpenClaw.
 *
 * UX rules:
 * - Plugin sends "Delegating..." message with Cancel button (from baton_pass)
 * - Plugin sends rating buttons 4s after delivery (from baton_status)
 * - Plugin handles button callbacks (rating + wallet)
 * - Agent ONLY sends the deliverable file + one short sentence
 * - No job IDs, prices, or specialist details shown to user
 */

import { writeFileSync } from "fs";
import { resolve } from "path";

const BATON_API = process.env.BATON_API || "http://localhost:3001";
const TMA_URL = process.env.BATON_TMA_URL || "https://baton-tma.vercel.app";
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

async function setupTelegramMenuButton(botToken: string) {
  try {
    await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "web_app", text: "Baton Account", web_app: { url: TMA_URL } },
      }),
    });
  } catch {}
}

// Track active jobs for cancel support
const activeJobs = new Map<string, string>(); // jobId → status

export default function (api: any) {
  const botToken = api.config?.channels?.telegram?.botToken;
  if (botToken) setupTelegramMenuButton(botToken);

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
        const jobId = crypto.randomUUID();
        await apiRequest("/jobs/create", {
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

        activeJobs.set(jobId, "created");

        // Send "Delegating..." with Cancel button — this arrives BEFORE agent response
        if (chatId && botToken) {
          await tgSend(botToken, chatId,
            `🔄 Delegating to a specialist...`,
            [[{ text: "✕ Cancel", callback_data: `bc:${jobId}` }]]
          );
        }

        return {
          content: [{
            type: "text",
            text: `[internal] job_id=${jobId}\nSay NOTHING to the user. Start polling baton_status("${jobId}") every 10s immediately.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Delegation failed: ${err.message}` }], isError: true };
      }
    },
  }));

  // --- baton_status ---
  api.registerTool((ctx: any) => ({
    name: "baton_status",
    description: "Check job status. When delivered, files are auto-downloaded. Send file to user with one short sentence. Say nothing else.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string", description: "Job ID from baton_pass" },
      },
      required: ["job_id"],
    },
    async execute(_id: string, params: any) {
      const chatId = parseChatId(ctx.sessionKey);
      try {
        // Check if cancelled
        if (activeJobs.get(params.job_id) === "cancelled") {
          return { content: [{ type: "text", text: "Job was cancelled. Stop polling." }] };
        }

        const { job, files } = await apiRequest(`/jobs/${params.job_id}`);

        if (job.status === "delivered") {
          activeJobs.set(params.job_id, "delivered");

          // Download files to workspace
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

        // Still in progress
        return {
          content: [{
            type: "text",
            text: `Status: ${job.status}. Poll again in 10s. Say NOTHING to the user.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
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
        await apiRequest(`/jobs/${params.job_id}/confirm`, { method: "PATCH" });
        await apiRequest(`/jobs/${params.job_id}/rate`, {
          method: "POST",
          body: JSON.stringify({ rating: params.rating }),
        });
        return { content: [{ type: "text", text: "Done." }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
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
            await apiRequest(`/jobs/${jobId}/confirm`, { method: "PATCH" });
            await apiRequest(`/jobs/${jobId}/rate`, {
              method: "POST",
              body: JSON.stringify({ rating }),
            });
            await tgSend(botToken, chatId,
              `✅ ${rating}★ — Specialist paid.`,
              [[{ text: "💰 My Account", callback_data: "bw" }]]
            );
          } catch (err: any) {
            await tgSend(botToken, chatId, `❌ ${err.message}`);
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
