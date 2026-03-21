/**
 * Baton Protocol plugin for OpenClaw.
 *
 * Rich Telegram UX: inline rating buttons, progress messages, wallet link.
 * Uses Telegram Bot API directly for reliable button delivery.
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

// Extract Telegram chat ID from OpenClaw session key
// Format: "agent:<id>:telegram:dm:<chatId>" or "agent:<id>:telegram:group:<chatId>"
function parseChatId(sessionKey?: string): string | null {
  if (!sessionKey) return null;
  const parts = sessionKey.split(":");
  const idx = parts.indexOf("telegram");
  if (idx >= 0 && idx + 2 < parts.length) return parts[idx + 2];
  return null;
}

// Send message via Telegram Bot API directly (reliable, supports buttons)
async function tgSend(botToken: string, chatId: string, text: string, buttons?: any[][]) {
  const body: any = { chat_id: chatId, text, parse_mode: "HTML" };
  if (buttons?.length) {
    body.reply_markup = { inline_keyboard: buttons };
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) console.log("[baton] tgSend error:", data.description);
    return data;
  } catch (err: any) {
    console.log("[baton] tgSend failed:", err.message);
  }
}

// Send file via Telegram Bot API
async function tgSendFile(botToken: string, chatId: string, filePath: string, caption?: string) {
  const { createReadStream } = await import("fs");
  const FormData = (await import("node:buffer")).Blob ? globalThis.FormData : null;
  // Use fetch with form data
  try {
    const fileBuffer = await import("fs").then(fs => fs.readFileSync(filePath));
    const filename = filePath.split("/").pop() || "file";
    const blob = new Blob([fileBuffer]);
    const form = new FormData();
    form.append("chat_id", chatId);
    form.append("document", blob, filename);
    if (caption) form.append("caption", caption);
    if (caption) form.append("parse_mode", "HTML");
    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
      method: "POST",
      body: form as any,
    });
    const data = await res.json();
    if (!data.ok) console.log("[baton] tgSendFile error:", data.description);
    return data;
  } catch (err: any) {
    console.log("[baton] tgSendFile failed:", err.message);
  }
}

// Set the Telegram bot's menu button to open the Baton TMA
async function setupTelegramMenuButton(botToken: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: { type: "web_app", text: "Baton Account", web_app: { url: TMA_URL } },
      }),
    });
    const data = await res.json();
    if (data.ok) console.log("[baton] Menu button set →", TMA_URL);
  } catch {}
}

export default function (api: any) {
  const botToken = api.config?.channels?.telegram?.botToken;
  if (botToken) setupTelegramMenuButton(botToken);

  // --- baton_pass ---
  api.registerTool((ctx: any) => ({
    name: "baton_pass",
    description:
      "Delegate a task to a specialist. Finds the best match, locks TON in escrow, submits the job. Returns job_id for polling.",
    parameters: {
      type: "object",
      properties: {
        task: { type: "string", description: "Short task description" },
        context: { type: "string", description: "Detailed requirements" },
        required_skills: {
          type: "array", items: { type: "string" },
          description: 'e.g. ["3d-rendering"]',
        },
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
          return { content: [{ type: "text", text: `No specialists found for "${skill || "any"}".` }] };
        }

        const specialist = searchResult.agents[0];
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

        // Rich Telegram message
        if (chatId && botToken) {
          await tgSend(botToken, chatId,
            `🔄 <b>Specialist found</b> — ${specialist.price_per_job} TON\nWorking on: <i>${params.task}</i>`
          );
        }

        return {
          content: [{
            type: "text",
            text: `Job created: ${job.job_id}\nSpecialist: ${specialist.address}\nPrice: ${specialist.price_per_job} TON\n\nNow poll baton_status("${job.job_id}") every 10s until delivered. Do NOT wait for the user.`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Baton pass failed: ${err.message}` }], isError: true };
      }
    },
  }));

  // --- baton_status ---
  api.registerTool((ctx: any) => ({
    name: "baton_status",
    description: "Check job status. Poll every 10s until delivered. When delivered, download the file immediately and send it.",
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

        // When delivered: send file + rating buttons
        if (job.status === "delivered" && chatId && botToken) {
          // Download and send file directly to Telegram
          if (files?.length) {
            for (const f of files) {
              try {
                const fileRes = await fetch(`${BATON_API}/files/${f.id}`);
                if (fileRes.ok) {
                  const buffer = Buffer.from(await fileRes.arrayBuffer());
                  const outputPath = resolve(WORKSPACE, f.filename);
                  writeFileSync(outputPath, buffer);
                  await tgSendFile(botToken, chatId, outputPath,
                    `📦 <b>${f.filename}</b> — ${(buffer.length / 1024 / 1024).toFixed(1)} MB`
                  );
                }
              } catch {}
            }
          }

          // Rating buttons
          await tgSend(botToken, chatId,
            `✅ <b>Delivered!</b> Rate to release ${job.amount} TON:`,
            [
              [
                { text: "1 ⭐", callback_data: `br:${job.id}:1` },
                { text: "2 ⭐", callback_data: `br:${job.id}:2` },
                { text: "3 ⭐", callback_data: `br:${job.id}:3` },
                { text: "4 ⭐", callback_data: `br:${job.id}:4` },
                { text: "5 ⭐", callback_data: `br:${job.id}:5` },
              ],
              [
                { text: "💰 My Account", callback_data: "bw" },
              ],
            ]
          );

          const fileList = files?.map((f: any) => `${f.filename} (${f.id})`).join(", ") || "none";
          return {
            content: [{
              type: "text",
              text: `DELIVERED. Files sent to user. Rating buttons shown.\nFiles: ${fileList}\nDo NOT ask the user to rate — the buttons handle it. Move on.`,
            }],
          };
        }

        const statusLabels: Record<string, string> = {
          created: "waiting",
          accepted: "working",
          delivered: "delivered",
          confirmed: "completed",
        };

        return {
          content: [{
            type: "text",
            text: `Status: ${statusLabels[job.status] || job.status}. ${job.status === "accepted" || job.status === "created" ? "Poll again in 10s." : ""}`,
          }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Status check failed: ${err.message}` }], isError: true };
      }
    },
  }));

  // --- baton_rate ---
  api.registerTool((ctx: any) => ({
    name: "baton_rate",
    description: "Rate specialist and release escrow payment.",
    parameters: {
      type: "object",
      properties: {
        job_id: { type: "string" },
        rating: { type: "number", minimum: 1, maximum: 5 },
      },
      required: ["job_id", "rating"],
    },
    async execute(_id: string, params: any) {
      const chatId = parseChatId(ctx.sessionKey);
      try {
        await apiRequest(`/jobs/${params.job_id}/confirm`, { method: "PATCH" });
        await apiRequest(`/jobs/${params.job_id}/rate`, {
          method: "POST",
          body: JSON.stringify({ rating: params.rating }),
        });

        if (chatId && botToken) {
          await tgSend(botToken, chatId,
            `💸 <b>${params.rating}★ — Paid!</b> Escrow released.`,
            [[{ text: "💰 My Account", callback_data: "bw" }]]
          );
        }

        return { content: [{ type: "text", text: `Rated ${params.rating}★. Escrow released.` }] };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Rating failed: ${err.message}` }], isError: true };
      }
    },
  }));

  // --- baton_download (kept as fallback) ---
  api.registerTool({
    name: "baton_download",
    description: "Download a deliverable file to workspace. Usually baton_status handles this automatically.",
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
        return {
          content: [{ type: "text", text: `Downloaded: ${outputPath} (${(buffer.length / 1024 / 1024).toFixed(1)} MB)` }],
        };
      } catch (err: any) {
        return { content: [{ type: "text", text: `Download failed: ${err.message}` }], isError: true };
      }
    },
  });

  // --- Handle inline button callbacks ---
  if (botToken) {
    api.registerHook("message:inbound", async (event: any) => {
      const text = event?.message?.text || "";
      const chatId = parseChatId(event?.sessionKey);

      // Rating button: "callback_data: br:<jobId>:<rating>"
      if (text.startsWith("callback_data: br:")) {
        const [, jobId, ratingStr] = text.replace("callback_data: ", "").split(":");
        const rating = parseInt(ratingStr, 10);
        if (jobId && rating >= 1 && rating <= 5 && chatId) {
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
            await tgSend(botToken, chatId, `❌ Rating failed: ${err.message}`);
          }
          return { handled: true };
        }
      }

      // Wallet button
      if (text === "callback_data: bw" && chatId) {
        await tgSend(botToken, chatId,
          `💰 Tap <b>Baton Account</b> in the menu below ↙️\nOr open: ${TMA_URL}`
        );
        return { handled: true };
      }
    });
  }
}
