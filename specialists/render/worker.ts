/**
 * Render Specialist Worker
 *
 * Polls the backend for incoming jobs, accepts them, and delivers 3D models.
 *
 * - "Einstein" requests → pre-baked asset (instant, free)
 * - Everything else → Tripo3D API (real generation)
 *
 * Usage:
 *   BATON_API=http://localhost:3001 \
 *   WORKER_ADDRESS=EQ... \
 *   TRIPO_API_KEY=tsk_... \
 *   npx tsx specialists/render/worker.ts
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve } from "path";

const BATON_API = process.env.BATON_API || "http://localhost:3001";
const WORKER_ADDRESS = process.env.WORKER_ADDRESS || "";
const WORKER_MNEMONIC = process.env.WORKER_MNEMONIC || "";
const TRIPO_API_KEY = process.env.TRIPO_API_KEY || "";
const POLL_INTERVAL = 5000;

// Pre-baked assets
const EINSTEIN_ASSET = resolve(__dirname, "assets/einstein_bust.glb");
const OUTPUT_DIR = resolve(__dirname, "output");

// Keywords that trigger the pre-baked Einstein asset
const EINSTEIN_KEYWORDS = ["einstein", "albert einstein", "einstein bust"];

function isEinsteinRequest(task: string): boolean {
  const lower = task.toLowerCase();
  return EINSTEIN_KEYWORDS.some(kw => lower.includes(kw));
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

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ── Tripo3D API ──

async function generateWithTripo(prompt: string): Promise<string> {
  if (!TRIPO_API_KEY) throw new Error("TRIPO_API_KEY not set");

  // 1. Create task
  console.log("  [tripo] Creating generation task...");
  const createRes = await fetch("https://api.tripo3d.ai/v2/openapi/task", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${TRIPO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ type: "text_to_model", prompt }),
  });
  const createData = await createRes.json();
  if (!createData.data?.task_id) {
    throw new Error(`Tripo task creation failed: ${JSON.stringify(createData)}`);
  }
  const taskId = createData.data.task_id;
  console.log(`  [tripo] Task created: ${taskId}`);

  // 2. Poll until done (max 5 minutes)
  const maxWait = 300000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    await sleep(5000);
    const statusRes = await fetch(`https://api.tripo3d.ai/v2/openapi/task/${taskId}`, {
      headers: { "Authorization": `Bearer ${TRIPO_API_KEY}` },
    });
    const statusData = await statusRes.json();
    const status = statusData.data?.status;
    console.log(`  [tripo] Status: ${status}`);

    if (status === "success") {
      const modelUrl = statusData.data?.output?.model;
      if (!modelUrl) throw new Error("Tripo returned success but no model URL");

      // 3. Download .glb
      console.log("  [tripo] Downloading model...");
      const modelRes = await fetch(modelUrl);
      if (!modelRes.ok) throw new Error(`Model download failed: ${modelRes.status}`);
      const buffer = Buffer.from(await modelRes.arrayBuffer());

      if (!existsSync(OUTPUT_DIR)) mkdirSync(OUTPUT_DIR, { recursive: true });
      const outputPath = resolve(OUTPUT_DIR, `${taskId}.glb`);
      writeFileSync(outputPath, buffer);
      console.log(`  [tripo] Model saved: ${outputPath}`);
      return outputPath;
    }

    if (status === "failed") {
      throw new Error(`Tripo generation failed: ${JSON.stringify(statusData.data)}`);
    }
  }
  throw new Error("Tripo generation timed out (5 min)");
}

// ── Job processing ──

async function processJob(job: any) {
  console.log(`\n--- New job: ${job.id} ---`);
  console.log(`Task: ${job.task}`);
  console.log(`Amount: ${job.amount} TON`);

  // Accept
  await apiRequest(`/jobs/${job.id}/accept`, {
    method: "PATCH",
    body: JSON.stringify({ worker_address: WORKER_ADDRESS }),
  });
  console.log("✓ Job accepted");

  let deliveryMessage: string;
  let filePath: string | null = null;

  if (isEinsteinRequest(job.task)) {
    // Pre-baked Einstein
    console.log("⚡ Einstein detected → using pre-baked asset");
    await sleep(3000); // Brief delay for realism
    filePath = EINSTEIN_ASSET;
    deliveryMessage = "3D Einstein bust generated. File: einstein_bust.glb";
  } else if (TRIPO_API_KEY) {
    // Real generation via Tripo
    console.log("🔨 Generating via Tripo3D API...");
    try {
      filePath = await generateWithTripo(job.task);
      deliveryMessage = `3D model generated from: "${job.task}". File: ${filePath.split("/").pop()}`;
    } catch (err: any) {
      console.error(`✗ Tripo generation failed: ${err.message}`);
      deliveryMessage = `3D generation failed: ${err.message}. No file delivered.`;
    }
  } else {
    // No API key, fallback to Einstein asset for everything
    console.log("⚠ No TRIPO_API_KEY — falling back to pre-baked Einstein asset");
    await sleep(3000);
    filePath = EINSTEIN_ASSET;
    deliveryMessage = "3D model delivered (demo mode). File: einstein_bust.glb";
  }

  // Upload
  if (filePath) {
    try {
      await uploadFile(job.id, filePath);
      console.log("✓ File uploaded");
    } catch (err: any) {
      console.error(`✗ Upload failed: ${err.message}`);
    }
  }

  // On-chain delivery
  if (job.escrow_address && !job.escrow_address.startsWith("pending")) {
    try {
      await apiRequest(`/escrow/deliver`, {
        method: "POST",
        body: JSON.stringify({ job_id: job.id }),
      });
      console.log("✓ On-chain delivery confirmed");
    } catch (err: any) {
      console.log(`⚠ On-chain delivery failed: ${err.message}`);
    }
  }

  // Backend delivery
  await apiRequest(`/jobs/${job.id}/deliver`, {
    method: "PATCH",
    body: JSON.stringify({ message: deliveryMessage }),
  });
  console.log("✓ Job delivered");
}

// ── Main loop ──

async function pollLoop() {
  console.log("=".repeat(50));
  console.log("Baton Render Specialist — Worker");
  console.log(`Address:  ${WORKER_ADDRESS}`);
  console.log(`Backend:  ${BATON_API}`);
  console.log(`Tripo:    ${TRIPO_API_KEY ? "enabled" : "disabled (Einstein only)"}`);
  console.log("=".repeat(50));

  while (true) {
    try {
      const result = await apiRequest(`/jobs?worker=${WORKER_ADDRESS}&status=created`);
      if (result.jobs?.length > 0) {
        for (const job of result.jobs) {
          await processJob(job);
        }
      }
    } catch (err: any) {
      if (!err.message.includes("ECONNREFUSED")) {
        console.error(`Poll error: ${err.message}`);
      }
    }
    await sleep(POLL_INTERVAL);
  }
}

pollLoop();
