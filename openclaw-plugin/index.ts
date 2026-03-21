/**
 * Baton Protocol plugin for OpenClaw.
 *
 * Tools return concise results to the agent. The agent handles all messaging.
 * The plugin ONLY sends Telegram messages for:
 *   - Rating inline buttons (delayed, after agent response)
 *   - Button callback responses (via hook)
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

// Send via Telegram Bot API (used ONLY for buttons + hook responses, never during tool exec)
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

export default function (api: any) {
  const botToken = api.config?.channels?.telegram?.botToken;
  if (botToken) setupTelegramMenuButton(botToken);

  // --- baton_pass ---
  api.registerTool((ctx: any) => ({
    name: "baton_pass",
    description: "Delegate a task to a specialist. Returns job_id to poll with baton_status.",
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
      try {
        const skill = params.required_skills?.[0];
        const searchResult = await apiRequest("/jobs/search", {
          method: "POST",
          body: JSON.stringify({ skill, max_budget: params.max_budget }),
        });

        if (!searchResult.agents?.length) {
          return { content: [{ type: "text", text: `No specialists found for "${skill || "any"}".` }] };
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

        return {
          content: [{
            type: "text",
            text: `job_id=${jobId} specialist=${specialist.address} price=${specialist.price_per_job}TON skills=${specialist.skills}\nPoll baton_status("${jobId}") every 10s. Do NOT wait for user.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
      }
    },
  }));

  // --- baton_status ---
  api.registerTool((ctx: any) => ({
    name: "baton_status",
    description: "Check job status. When delivered, files are auto-downloaded to workspace. Send them to user, then rating buttons will appear.",
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
        const { job, files } = await apiRequest(`/jobs/${params.job_id}`);

        if (job.status === "delivered") {
          // Download all files to workspace
          const downloaded: string[] = [];
          if (files?.length) {
            for (const f of files) {
              try {
                const fileRes = await fetch(`${BATON_API}/files/${f.id}`);
                if (fileRes.ok) {
                  const buffer = Buffer.from(await fileRes.arrayBuffer());
                  const outputPath = resolve(WORKSPACE, f.filename);
                  writeFileSync(outputPath, buffer);
                  downloaded.push(`${f.filename} → ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
                }
              } catch {}
            }
          }

          // Send rating buttons AFTER a delay (so agent's response arrives first)
          if (chatId && botToken) {
            setTimeout(() => {
              tgSend(botToken, chatId,
                `Rate to release ${job.amount} TON:`,
                [
                  [
                    { text: "1⭐", callback_data: `br:${job.id}:1` },
                    { text: "2⭐", callback_data: `br:${job.id}:2` },
                    { text: "3⭐", callback_data: `br:${job.id}:3` },
                    { text: "4⭐", callback_data: `br:${job.id}:4` },
                    { text: "5⭐", callback_data: `br:${job.id}:5` },
                  ],
                  [{ text: "💰 My Account", callback_data: "bw" }],
                ]
              );
            }, 4000);
          }

          return {
            content: [{
              type: "text",
              text: `DELIVERED.\nFiles: ${downloaded.join("; ") || "none"}\nSend the file to the user now. Rating buttons will appear automatically. Do NOT ask to rate.`,
            }],
          };
        }

        const labels: Record<string, string> = { created: "waiting", accepted: "working" };
        return {
          content: [{
            type: "text",
            text: `Status: ${labels[job.status] || job.status}. ${job.status !== "confirmed" ? "Poll again in 10s." : ""}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Failed: ${err.message}` }], isError: true };
      }
    },
  }));

  // --- baton_rate ---
  api.registerTool({
    name: "baton_rate",
    description: "Rate specialist and release escrow. Usually handled by inline buttons automatically.",
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
        return { content: [{ type: "text", text: `Rated ${params.rating}★. Escrow released.` }] };
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
        return { content: [{ type: "text", text: `${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)}MB)` }] };
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

      // Rating button: "callback_data: br:<jobId>:<rating>"
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
              `💸 <b>${rating}★ — Paid!</b> Escrow released.`,
              [[{ text: "💰 My Account", callback_data: "bw" }]]
            );
          } catch (err: any) {
            await tgSend(botToken, chatId, `❌ ${err.message}`);
          }
          return { handled: true };
        }
      }

      // Wallet button
      if (text === "callback_data: bw") {
        await tgSend(botToken, chatId, `Tap <b>Baton Account</b> in the menu ↙️`);
        return { handled: true };
      }
    });
  }
}
