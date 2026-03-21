/**
 * Render Specialist Worker
 *
 * Polls the backend for incoming jobs, accepts them, simulates 3D generation,
 * and delivers a pre-baked .glb file.
 *
 * For the hackathon demo, this uses a pre-generated asset.
 * In production, this would call Trellis 2 or a HuggingFace Inference API.
 *
 * Usage: BATON_API=http://localhost:3001 npx tsx specialists/render/worker.ts
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const BATON_API = process.env.BATON_API || "http://localhost:3001";
const WORKER_ADDRESS = process.env.WORKER_ADDRESS || "EQA2rYgDkCJ_bfip7-LL8y_TFSJDGHjq5L3ARlCK0ZzLibmW";
const WORKER_MNEMONIC = process.env.WORKER_MNEMONIC || "";
const POLL_INTERVAL = 5000; // 5 seconds
const FAKE_WORK_DURATION = 8000; // 8 seconds to simulate generation

// Pre-baked asset path (put your .glb here)
const ASSET_PATH = resolve(__dirname, "assets/einstein_bust.glb");

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

  if (!res.ok) {
    throw new Error(`File upload failed: ${res.statusText}`);
  }
  return res.json();
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processJob(job: any) {
  console.log(`\n--- New job: ${job.id} ---`);
  console.log(`Task: ${job.task}`);
  console.log(`Amount: ${job.amount} TON`);

  // Accept the job
  await apiRequest(`/jobs/${job.id}/accept`, {
    method: "PATCH",
    body: JSON.stringify({ worker_address: WORKER_ADDRESS }),
  });
  console.log("✓ Job accepted");

  // Simulate 3D generation work
  console.log("⏳ Generating 3D model (simulated)...");
  await sleep(FAKE_WORK_DURATION);

  // Check if we have the pre-baked asset
  let deliveryMessage: string;
  try {
    readFileSync(ASSET_PATH);
    // Upload the file
    await uploadFile(job.id, ASSET_PATH);
    deliveryMessage = "3D Einstein bust generated using Microsoft Trellis 2. File: einstein_bust.glb";
    console.log("✓ File uploaded");
  } catch {
    // No asset file — deliver without file
    deliveryMessage = "3D model generated (demo mode — file delivery simulated). In production, this would be a .glb file from Trellis 2.";
    console.log("⚠ No asset file found, delivering without file");
  }

  // Deliver on-chain (sends Deliver tx from worker wallet)
  if (WORKER_MNEMONIC && job.escrow_address && !job.escrow_address.startsWith("pending")) {
    try {
      await apiRequest(`/escrow/deliver`, {
        method: "POST",
        body: JSON.stringify({ job_id: job.id, worker_mnemonic: WORKER_MNEMONIC }),
      });
      console.log("✓ On-chain delivery confirmed");
    } catch (err: any) {
      console.log(`⚠ On-chain delivery failed: ${err.message} — continuing with backend delivery`);
    }
  }

  // Mark as delivered in backend
  await apiRequest(`/jobs/${job.id}/deliver`, {
    method: "PATCH",
    body: JSON.stringify({ message: deliveryMessage }),
  });
  console.log("✓ Job delivered");
}

async function pollLoop() {
  console.log("=".repeat(50));
  console.log("Baton Render Specialist — Worker");
  console.log(`Listening for jobs as: ${WORKER_ADDRESS}`);
  console.log(`Backend: ${BATON_API}`);
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
      // Backend might be down — just log and retry
      if (!err.message.includes("ECONNREFUSED")) {
        console.error(`Poll error: ${err.message}`);
      }
    }

    await sleep(POLL_INTERVAL);
  }
}

pollLoop();
