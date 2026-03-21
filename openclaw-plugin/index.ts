/**
 * Baton Protocol plugin for OpenClaw.
 *
 * Registers 4 agent tools (hiring mode) with rich Telegram UX:
 *   - baton_pass:     find specialist, lock TON in escrow, delegate task
 *   - baton_status:   check job progress and retrieve deliverables
 *   - baton_rate:     confirm delivery, release escrow, rate specialist
 *   - baton_download: fetch deliverable file to workspace
 *
 * Uses OpenClaw's sendMessageTelegram for inline buttons and formatted messages.
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
// Format: "agent:<agentId>:telegram:dm:<chatId>" or "agent:<agentId>:telegram:group:<chatId>"
function parseChatId(sessionKey?: string): string | null {
  if (!sessionKey) return null;
  const parts = sessionKey.split(":");
  const telegramIdx = parts.indexOf("telegram");
  if (telegramIdx >= 0 && telegramIdx + 2 < parts.length) {
    return parts[telegramIdx + 2];
  }
  return null;
}

// Set the Telegram bot's menu button to open the Baton TMA
async function setupTelegramMenuButton(botToken: string) {
  try {
    const res = await fetch(`https://api.telegram.org/bot${botToken}/setChatMenuButton`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        menu_button: {
          type: "web_app",
          text: "Baton Account",
          web_app: { url: TMA_URL },
        },
      }),
    });
    const data = await res.json();
    if (data.ok) console.log("[baton] Menu button set: Baton Account →", TMA_URL);
  } catch {}
}

// Send a rich Telegram message with optional inline buttons
async function sendTelegram(api: any, chatId: string, text: string, buttons?: any[][]) {
  try {
    const sendFn = api.runtime?.channel?.telegram?.sendMessageTelegram;
    if (sendFn) {
      await sendFn(chatId, text, { buttons });
    }
  } catch (err: any) {
    console.log("[baton] sendTelegram failed:", err.message);
  }
}

export default function (api: any) {
  // Set menu button on plugin load
  const botToken = api.config?.channels?.telegram?.botToken;
  if (botToken) setupTelegramMenuButton(botToken);

  // --- baton_pass (factory — captures session context for chat_id) ---
  api.registerTool((ctx: any) => ({
    name: "baton_pass",
    description:
      "Delegate a task to a specialist agent. Searches the Baton marketplace for the best match, locks TON in an on-chain escrow, and submits the job.",
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
      const chatId = parseChatId(ctx.sessionKey);

      try {
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

        // Send progress message to Telegram
        if (chatId) {
          await sendTelegram(api, chatId,
            `🔄 <b>Delegating to specialist...</b>\n\n` +
            `Task: ${params.task}\n` +
            `Specialist: <code>${specialist.address.slice(0, 12)}...</code>\n` +
            `Skills: ${specialist.skills}\n` +
            `Price: ${specialist.price_per_job} TON`
          );
        }

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
                `Baton passed. Job delegated to specialist.`,
                ``,
                `Job ID: ${job.job_id}`,
                `Specialist: ${specialist.address}`,
                `Skills: ${specialist.skills}`,
                `Price: ${specialist.price_per_job} TON`,
                ``,
                `Poll baton_status every 10s until status is "delivered".`,
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
  }));

  // --- baton_status (factory) ---
  api.registerTool((ctx: any) => ({
    name: "baton_status",
    description: "Check the status of a delegated job. Returns current state, deliverables, and file attachments. When status is 'delivered', send rating buttons.",
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
      const chatId = parseChatId(ctx.sessionKey);

      try {
        const { job, files } = await apiRequest(`/jobs/${params.job_id}`);

        const statusMap: Record<string, string> = {
          created: "Waiting for specialist to accept",
          accepted: "Specialist is working",
          delivered: "Delivered — awaiting your review",
          confirmed: "Completed",
          disputed: "Disputed",
        };

        // When delivered, send rich message with rating buttons + wallet link
        if (job.status === "delivered" && chatId) {
          const fileNames = files?.length
            ? files.map((f: any) => f.filename).join(", ")
            : "—";

          await sendTelegram(api, chatId,
            `📦 <b>Specialist delivered!</b>\n\n` +
            `Task: ${job.task}\n` +
            `Files: ${fileNames}\n` +
            (job.delivery_message ? `Message: ${job.delivery_message}\n` : "") +
            `Amount: ${job.amount} TON\n\n` +
            `Rate the specialist to release payment:`,
            [
              [
                { text: "⭐", callback_data: `baton_rate:${job.id}:1` },
                { text: "⭐⭐", callback_data: `baton_rate:${job.id}:2` },
                { text: "⭐⭐⭐", callback_data: `baton_rate:${job.id}:3` },
                { text: "⭐⭐⭐⭐", callback_data: `baton_rate:${job.id}:4` },
                { text: "⭐⭐⭐⭐⭐", callback_data: `baton_rate:${job.id}:5` },
              ],
              [
                { text: "💰 Baton Account", callback_data: `baton_wallet` },
              ],
            ]
          );
        }

        // When still working, send progress message
        if (job.status === "accepted" && chatId) {
          await sendTelegram(api, chatId,
            `🔧 <b>Specialist is working...</b>\n\n` +
            `Task: ${job.task}\n` +
            `Amount: ${job.amount} TON`
          );
        }

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
  }));

  // --- baton_rate (factory) ---
  api.registerTool((ctx: any) => ({
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
      const chatId = parseChatId(ctx.sessionKey);

      try {
        await apiRequest(`/jobs/${params.job_id}/confirm`, { method: "PATCH" });
        await apiRequest(`/jobs/${params.job_id}/rate`, {
          method: "POST",
          body: JSON.stringify({ rating: params.rating }),
        });

        // Send confirmation with wallet link
        if (chatId) {
          await sendTelegram(api, chatId,
            `✅ <b>Job completed — ${params.rating}★</b>\n\n` +
            `Escrow released. Specialist has been paid.\n\n` +
            `<a href="${TMA_URL}">View your Baton Account →</a>`,
            [
              [
                { text: "💰 Baton Account", callback_data: "baton_wallet" },
              ],
            ]
          );
        }

        return {
          content: [
            {
              type: "text",
              text: `Job ${params.job_id} completed and rated ${params.rating}★. Escrow released.`,
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
  }));

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

  // --- Handle button callbacks ---
  api.registerHook("message:inbound", async (event: any) => {
    const text = event?.message?.text || "";

    // Handle rating button callback: "callback_data: baton_rate:<jobId>:<rating>"
    if (text.startsWith("callback_data: baton_rate:")) {
      const parts = text.replace("callback_data: ", "").split(":");
      const jobId = parts[1];
      const rating = parseInt(parts[2], 10);
      if (jobId && rating >= 1 && rating <= 5) {
        try {
          await apiRequest(`/jobs/${jobId}/confirm`, { method: "PATCH" });
          await apiRequest(`/jobs/${jobId}/rate`, {
            method: "POST",
            body: JSON.stringify({ rating }),
          });

          const chatId = parseChatId(event?.sessionKey);
          if (chatId) {
            await sendTelegram(api, chatId,
              `✅ <b>Job completed — ${"⭐".repeat(rating)}</b>\n\n` +
              `Escrow released. Specialist has been paid.\n\n` +
              `<a href="${TMA_URL}">View your Baton Account →</a>`,
              [
                [{ text: "💰 Baton Account", callback_data: "baton_wallet" }],
              ]
            );
          }
        } catch (err: any) {
          console.log("[baton] Rating via callback failed:", err.message);
        }
        return { handled: true };
      }
    }

    // Handle wallet button callback
    if (text === "callback_data: baton_wallet") {
      const chatId = parseChatId(event?.sessionKey);
      if (chatId) {
        await sendTelegram(api, chatId,
          `💰 <b>Baton Account</b>\n\n` +
          `Open your Baton Account to check balance, history, and permissions:\n\n` +
          `<a href="${TMA_URL}">${TMA_URL}</a>\n\n` +
          `Or tap the <b>Baton Account</b> button in the menu below ↙️`
        );
      }
      return { handled: true };
    }
  });
}
