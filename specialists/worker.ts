/**
 * Generic Baton Protocol Worker
 *
 * A reusable CLI worker that any host can run to become a specialist on the network.
 * The host's TON wallet address is their identity — no auth needed.
 *
 * Features:
 *   - Auto-registers on startup with free-text description
 *   - Polls for incoming jobs via HTTP
 *   - Listens for instant notifications via WebSocket
 *   - Accepts, executes (via user-defined handler or stdout), and delivers work
 *
 * Usage:
 *   WORKER_ADDRESS="EQB..." \
 *   BATON_API="http://localhost:3001" \
 *   SKILLS="3d-rendering,product-visualization" \
 *   DESCRIPTION="RTX 4090 with Trellis 2, photorealistic 3D product renders" \
 *   PRICE=3 \
 *   npx tsx specialists/worker.ts
 *
 * Environment Variables:
 *   WORKER_ADDRESS - TON wallet address (required)
 *   BATON_API      - Backend URL (default: http://localhost:3001)
 *   SKILLS         - Comma-separated skill tags
 *   DESCRIPTION    - Free-text capability description
 *   PRICE          - Price per job in TON (default: 5)
 *   POLL_INTERVAL  - Polling interval in ms (default: 5000)
 *   OUTPUT_DIR     - Directory to watch for output files (default: ./output)
 */

import { readFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import WebSocket from 'ws';

// === CONFIG ===

const BATON_API = process.env.BATON_API || 'http://localhost:3001';
const WORKER_ADDRESS = process.env.WORKER_ADDRESS;
const SKILLS = (process.env.SKILLS || '').split(',').filter(Boolean);
const DESCRIPTION = process.env.DESCRIPTION || '';
const PRICE = Number(process.env.PRICE || 5);
const POLL_INTERVAL = Number(process.env.POLL_INTERVAL || 5000);
const OUTPUT_DIR = resolve(process.env.OUTPUT_DIR || './output');

if (!WORKER_ADDRESS) {
  console.error('ERROR: WORKER_ADDRESS environment variable is required');
  console.error('  This is your TON wallet address — your specialist identity on the protocol.');
  process.exit(1);
}

// === HELPERS ===

async function api(endpoint: string, options: RequestInit = {}): Promise<any> {
  const url = `${BATON_API}${endpoint}`;
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const err: any = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function uploadFiles(jobId: string, filePaths: string[]) {
  for (const filePath of filePaths) {
    const fileBuffer = readFileSync(filePath);
    const fileName = basename(filePath);
    const formData = new FormData();
    formData.append('job_id', jobId);
    formData.append('uploaded_by', WORKER_ADDRESS!);
    formData.append('files', new Blob([fileBuffer]), fileName);

    const res = await fetch(`${BATON_API}/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!res.ok) {
      throw new Error(`File upload failed for ${fileName}: ${res.statusText}`);
    }
    console.log(`  ✓ Uploaded: ${fileName}`);
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

// === REGISTRATION ===

async function register() {
  try {
    await api('/agents/register', {
      method: 'POST',
      body: JSON.stringify({
        address: WORKER_ADDRESS,
        skills: SKILLS,
        price_per_job: PRICE,
        description: DESCRIPTION,
      }),
    });
    console.log('✓ Registered as specialist');
  } catch (err: any) {
    console.error(`⚠ Registration failed: ${err.message} (will retry on next cycle)`);
  }
}

// === JOB PROCESSING ===

const processingJobs = new Set<string>();

async function processJob(job: any) {
  if (processingJobs.has(job.id)) return;
  processingJobs.add(job.id);

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`📥 New Job: ${job.id}`);
  console.log(`   Task:    ${job.task}`);
  console.log(`   Amount:  ${job.amount} TON`);
  if (job.context) console.log(`   Context: ${job.context}`);

  try {
    // 1. Accept the job
    await api(`/jobs/${job.id}/accept`, {
      method: 'PATCH',
      body: JSON.stringify({ worker_address: WORKER_ADDRESS }),
    });
    console.log('✓ Job accepted');

    // 2. Execute the work
    console.log('⏳ Executing...');
    console.log(`   Place output files in: ${OUTPUT_DIR}`);

    // Ensure output directory exists
    if (!existsSync(OUTPUT_DIR)) {
      mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    // Wait for output files to appear (poll output dir)
    // For demo/hackathon: auto-deliver after a short delay if no files appear
    let outputFiles: string[] = [];
    const maxWait = 60000; // 60 seconds max
    const checkInterval = 2000;
    let waited = 0;

    while (waited < maxWait) {
      await sleep(checkInterval);
      waited += checkInterval;

      if (existsSync(OUTPUT_DIR)) {
        const files = readdirSync(OUTPUT_DIR);
        if (files.length > 0) {
          outputFiles = files.map(f => resolve(OUTPUT_DIR, f));
          break;
        }
      }
    }

    // 3. Upload output files
    if (outputFiles.length > 0) {
      console.log(`📤 Uploading ${outputFiles.length} file(s)...`);
      await uploadFiles(job.id, outputFiles);
    }

    // 4. Deliver
    const message = outputFiles.length > 0
      ? `Task completed. ${outputFiles.length} file(s) delivered.`
      : 'Task completed (no output files — demo mode).';

    await api(`/jobs/${job.id}/deliver`, {
      method: 'PATCH',
      body: JSON.stringify({ message }),
    });
    console.log(`✓ Job delivered: ${message}`);
    console.log('─'.repeat(50));

  } catch (err: any) {
    console.error(`✗ Job ${job.id} failed: ${err.message}`);
  }
}

// === WEBSOCKET ===

let isReconnecting = false;

function connectWebSocket() {
  if (isReconnecting) return;
  const wsUrl = BATON_API.replace('http', 'ws') + '/ws';

  try {
    const ws = new WebSocket(wsUrl);

    ws.on('open', () => {
      console.log('✓ WebSocket connected (instant notifications)');
      isReconnecting = false;
      ws.send(JSON.stringify({ type: 'register', address: WORKER_ADDRESS }));
    });

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());
        if (msg.type === 'new_job') {
          console.log(`\n⚡ WebSocket notification: new job ${msg.job_id}`);
          // Trigger immediate poll
          pollOnce().catch(() => {});
        }
      } catch {}
    });

    ws.on('close', () => {
      if (!isReconnecting) {
        isReconnecting = true;
        console.log('⚠ WebSocket disconnected, reconnecting in 5s...');
        setTimeout(() => {
          isReconnecting = false;
          connectWebSocket();
        }, 5000);
      }
    });

    ws.on('error', () => {
      // Silently ignore, the 'close' event will handle reconnection
    });
  } catch {
    if (!isReconnecting) {
      isReconnecting = true;
      setTimeout(() => {
        isReconnecting = false;
        connectWebSocket();
      }, 5000);
    }
  }
}

// === POLLING ===

async function pollOnce() {
  try {
    const result = await api(`/jobs?worker=${WORKER_ADDRESS}&status=created`);
    if (result.jobs?.length > 0) {
      for (const job of result.jobs) {
        await processJob(job);
      }
    }
  } catch (err: any) {
    if (!err.message.includes('ECONNREFUSED')) {
      console.error(`Poll error: ${err.message}`);
    }
  }
}

// === MAIN ===

async function main() {
  console.log('═'.repeat(50));
  console.log('  Baton Protocol — Generic Worker');
  console.log('═'.repeat(50));
  console.log(`  Wallet:      ${WORKER_ADDRESS}`);
  console.log(`  Skills:      ${SKILLS.length > 0 ? SKILLS.join(', ') : '(from description)'}`);
  console.log(`  Description: ${DESCRIPTION || '(none)'}`);
  console.log(`  Price:       ${PRICE} TON / job`);
  console.log(`  Backend:     ${BATON_API}`);
  console.log(`  Output Dir:  ${OUTPUT_DIR}`);
  console.log('═'.repeat(50));

  // Auto-register
  await register();

  // Connect WebSocket for instant notifications
  connectWebSocket();

  // Start polling loop
  console.log(`\n👂 Listening for jobs (polling every ${POLL_INTERVAL / 1000}s)...\n`);
  while (true) {
    await pollOnce();
    await sleep(POLL_INTERVAL);
  }
}

main().catch(console.error);
