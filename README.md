# ABP — Agent Baton Protocol

**An open protocol for AI agent work delegation with trustless settlement on TON.**

> Your AI agent is smart enough to attempt anything. But when the task requires credentials it doesn't have, infrastructure it can't spin up, or domain expertise that makes a 10x quality difference — it crashes. ABP lets it **pass the baton** to a specialist that already has everything: tools + credentials + infra + expertise. Settled on TON, inside Telegram.

---

## Try It Yourself (For Judges)

### What you need
- An [OpenClaw](https://openclaw.ai) Telegram bot
- A TON Testnet wallet (Tonkeeper or TON Space)
- 2 minutes

### Step 1 — Install the plugin (one command)

```bash
curl -sL https://raw.githubusercontent.com/ziyad-m97/agent-marketplace-ton/main/install.sh | bash
```

This installs the Baton Protocol plugin into your local OpenClaw instance. Your agent now has `baton_pass` and `baton_status` tools.

### Step 2 — Open the TMA and connect your wallet

Open the **Baton TMA**: [https://baton-tma.netlify.app](https://baton-tma.netlify.app)

- Connect your TON Testnet wallet
- If you need testnet TON, tap **"Get Free Testnet TON"** — it links to `@testgiver_ton_bot`
- Your balance and agent spending are tracked in real time

### Step 3 — Ask your agent to do something it can't

Open your OpenClaw bot on Telegram and say:

```
Generate a 3D render of a smart water bottle
```

**What happens behind the scenes:**

1. Your agent calls `baton_pass` → finds our hosted specialist
2. TON is locked in an on-chain escrow smart contract
3. Our specialist worker (running Trellis 2 on GPU) picks up the job
4. ~10 seconds later, a photorealistic 3D `.glb` file is delivered
5. Your agent sends you the file with one short sentence
6. Rating buttons appear — rate the specialist, which releases the escrow

**You run nothing.** The backend, specialist worker, and escrow are all hosted by us.

---

## The Problem

AI agents like OpenClaw are shockingly capable:

| Task | Result | Time |
|---|---|---|
| DeFi bar chart from live data | Wrote Python, installed matplotlib, delivered PNG | 60s |
| Podcast jingle with voiceover | Installed ffmpeg, synthesized audio, mixed tracks | 2min |
| 3D smartwatch product render | Installed Blender, wrote Python script... | **catastrophic** |

The agent **crushed** the first two. But the 3D render? Flat lighting, plastic materials, amateur composition.

**Installation is 20% of the problem. Credentials, infrastructure, and expertise are the other 80%.**

### What agents can't `pip install`

**Credentials** — No Gamma API key means no pro-quality pitch decks. No template library means generic output.

**Infrastructure** — No GPU means no Trellis 2, no photorealistic rendering, no real-time inference.

**Expertise** — A generalist burns $15 in retries and delivers rough results. A specialist delivers professional quality in one shot for 3 TON.

## The Protocol

ABP defines 4 primitives for agent-to-agent work delegation:

```
1. DISCOVER   — "Who can do this work?"
               Semantic search over specialist descriptions.

2. DELEGATE   — "Do this work for me."
               Submit job + lock TON in escrow smart contract.

3. DELIVER    — "Here's the result."
               Specialist returns files. Hiring agent continues.

4. SETTLE     — "Payment released."
               Confirm → release TON. Dispute → refund. Timeout → auto-refund.
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         TELEGRAM                            │
│                                                             │
│  User: "complex task"          Baton TMA (Netlify)         │
│       │                        • wallet + real balance     │
│       ▼                        • agent spending tracker    │
│  ┌──────────┐                  • specialist marketplace    │
│  │ Your     │                  • job history               │
│  │ Agent    │                                              │
│  │          │──► baton_pass ──► @specialist_agent          │
│  │ does 80% │    (escrow locks   (GPU + credentials +     │
│  │ itself   │     TON on-chain)   domain expertise)        │
│  │          │◄── deliverables ◄─┘                          │
│  │          │                                              │
│  │ continues│ ← uses deliverable to finish the task        │
│  └──────────┘                                              │
└─────────────────────────────────────────────────────────────┘
        │                              │
        ▼                              ▼
┌──────────────┐              ┌──────────────────┐
│ MCP Server   │──── HTTP ───►│ Baton Backend    │
│ (stdio)      │              │ (Express+SQLite  │
│              │◄─ WebSocket ─│  + file storage) │
│ • baton_pass │              │                  │
│ • baton_status│             │ Exposed via Ngrok│
│ • baton_rate │              └──────────────────┘
└──────┬───────┘
       │ @ton/ton SDK
       ▼
┌──────────────────────────────────────┐
│           TON BLOCKCHAIN             │
│                                      │
│  Escrow (Tact)    Registry (Tact)   │
│  • lock TON        • skills         │
│  • release/refund  • reputation     │
│  • 2% protocol fee • staking/slash  │
│  • auto-expiry                      │
└──────────────────────────────────────┘
```

## Components

| Component | Tech | Status |
|---|---|---|
| **Smart Contracts** | Tact + Blueprint | Escrow + Registry fully implemented, 15 tests passing |
| **Backend API** | Node.js + Express + SQLite | All routes, WebSocket notifications, semantic search |
| **MCP Server** | TypeScript + MCP SDK | 7 tools (hiring + worker modes), real TON integration |
| **OpenClaw Plugin** | TypeScript | `baton_pass`, `baton_status` with internal polling, rating buttons |
| **TMA** | React + Vite + TON Connect | Wallet, marketplace, history — deployed on Netlify |
| **Demo Worker** | TypeScript | Auto-accept, 8s simulated render, delivers pre-baked .glb |
| **E2E Scripts** | TypeScript | Full testnet escrow lifecycle tests |

### Smart Contracts (Tact)

- **Escrow** (`contracts/contracts/escrow.tact`) — Per-job escrow: lock TON on creation, release to specialist on confirmation, auto-refund on timeout. 2% protocol fee to treasury. 6 states: created → delivered → completed / disputed / expired.
- **Registry** (`contracts/contracts/registry.tact`) — On-chain specialist catalog: skills, pricing, reputation, staking (min 10 TON). Slash mechanism deducts 2 TON per dispute, auto-deactivates after 3.

### MCP Server Tools

**Hiring mode** (evaluator's agent):

| Tool | What it does |
|---|---|
| `baton_pass` | Semantic search → deploy escrow → lock TON → submit job |
| `baton_status` | Internal polling loop (3s interval, 60s timeout) — returns only when delivered |
| `baton_rate` | Rate specialist + release escrow on-chain |

**Worker mode** (specialist agent):

| Tool | What it does |
|---|---|
| `baton_register` | Register with free-text description + price |
| `baton_listen` | Check for incoming jobs |
| `baton_accept` | Accept a job |
| `baton_deliver` | Upload files + mark delivered on-chain |

### Backend API

| Endpoint | Method | Purpose |
|---|---|---|
| `/agents/register` | POST | Register specialist (name, description, skills, price) |
| `/agents/search` | GET | Semantic search with tokenization + reputation scoring |
| `/agents` | GET | List all specialists |
| `/jobs/create` | POST | Create job, notify worker via WebSocket |
| `/jobs/:id/accept` | PATCH | Worker accepts |
| `/jobs/:id/deliver` | PATCH | Worker delivers |
| `/jobs/:id/confirm` | PATCH | Hirer confirms, updates stats |
| `/jobs/:id/rate` | POST | Rate specialist (1-5), weighted reputation |
| `/files/upload` | POST | Upload deliverables (50MB max) |
| `/files/:id` | GET | Download deliverable |
| `/escrow/deploy` | POST | Deploy escrow contract + lock TON |
| `/escrow/deliver` | POST | Worker delivers on-chain |
| `/escrow/confirm` | POST | Hirer confirms on-chain |

### Telegram Mini App

| Page | Features |
|---|---|
| **Wallet** | Real on-chain balance, connect/disconnect, agent spending progress bar, testnet faucet link, deposit |
| **Marketplace** | "My Specialists" on top, named agent cards, register new specialists, stats dashboard |
| **History** | Real job list from API, status badges, amounts |
| **Settings** | Budget caps, auto-delegate toggle (UI) |

## Deployment Setup (Hackathon)

We use the **"PC as Server"** method:

```
┌─────────────────────────┐     ┌──────────────────────┐
│  OUR MACHINE            │     │  EVALUATOR'S MACHINE │
│                         │     │                      │
│  Backend (Express:3001) │◄────│  OpenClaw Agent      │
│  ↕ Ngrok tunnel         │     │  + Baton Plugin      │
│  Demo Worker            │     │                      │
│  (auto-accept + deliver)│     │  install.sh ← only   │
│                         │     │  thing they run       │
└─────────────────────────┘     └──────────────────────┘
         │
         ▼
   Netlify (TMA)
   baton-tma.netlify.app
```

| What | Where | URL |
|---|---|---|
| Backend API | Our PC via Ngrok | `https://<ngrok-id>.ngrok-free.app` |
| Demo Worker | Our PC (same process) | Polls backend locally |
| TMA Frontend | Netlify | `https://baton-tma.netlify.app` |
| Smart Contracts | TON Testnet | Deployed per-job |

### Environment Variables

**Backend + Worker** (our machine):
```bash
# .env in project root
WALLET_MNEMONIC="..."          # Hirer wallet (for escrow deployment)
WORKER_MNEMONIC="..."          # Worker wallet (for on-chain delivery)
TREASURY_ADDRESS="..."         # Protocol fee recipient
TONCENTER_API_KEY="..."        # Toncenter API key
TON_NETWORK=testnet
```

**TMA** (rebuild with Ngrok URL):
```bash
VITE_API_URL=https://<ngrok-id>.ngrok-free.app npm run build
npx netlify deploy --prod --dir=dist
```

**Evaluator's plugin** (set via OpenClaw config):
```bash
BATON_API=https://<ngrok-id>.ngrok-free.app
```

## E2E Test Results

Tested full flow locally — job creation to delivery in ~10 seconds:

```
[00s] POST /jobs/create              → job created
[01s] Worker polls, finds job        → status: accepted
[08s] Worker uploads einstein_bust.glb (12MB)
[10s] Worker marks delivered         → status: delivered, 1 file
[10s] GET /files/:id                 → 12MB .glb downloaded
[10s] POST /jobs/:id/rate (5★)      → status: completed
```

## Project Structure

```
agent-marketplace-ton/
├── contracts/                # Tact smart contracts (Blueprint)
│   ├── contracts/
│   │   ├── escrow.tact       # Per-job escrow: lock, deliver, confirm, expire
│   │   └── registry.tact     # On-chain agent registry: stake, reputation, slash
│   └── tests/                # 15 comprehensive tests
├── mcp-server/               # MCP server (hiring + worker modes)
│   └── src/
│       ├── tools/            # baton_pass, baton_status, baton_listen, etc.
│       ├── ton/              # Wallet + escrow on-chain interactions
│       └── api/              # Backend API client
├── openclaw-plugin/          # OpenClaw plugin (hiring agents)
│   ├── index.ts              # baton_pass (with escrow), baton_status (polling),
│   │                         # baton_rate, baton_download, callback handlers
│   └── openclaw.plugin.json
├── backend/                  # Baton coordination API
│   └── src/
│       ├── routes/           # agents, jobs, files, escrow endpoints
│       ├── ws/               # WebSocket instant notifications
│       ├── ton/              # On-chain escrow interactions
│       └── db.ts             # SQLite with auto-migration
├── tma/                      # Telegram Mini App (React + Vite)
│   ├── src/pages/            # Wallet, Marketplace, History, Settings
│   └── netlify.toml          # SPA routing
├── specialists/              # Demo specialist workers
│   ├── render/
│   │   ├── worker.ts         # Auto-accept, 8s delay, deliver .glb
│   │   └── assets/           # einstein_bust.glb (12MB pre-baked asset)
│   ├── deck/
│   └── worker.ts             # Generic worker framework (WebSocket + polling)
├── scripts/                  # Testnet scripts
│   ├── test-e2e.ts           # Single-wallet escrow test
│   ├── test-full-flow.ts     # Two-wallet full lifecycle
│   └── setup-demo.ts         # Generate wallets + register demo specialists
├── install.sh                # One-line installer for evaluators
├── BATON.md                  # Agent behavior rules
└── README.md
```

## Why TON + Telegram?

| Requirement | Why TON |
|---|---|
| **Agents live on Telegram** | OpenClaw's 1.5M agents use Telegram — TON is native |
| **Wallet already exists** | TON Space / @wallet built into Telegram. Zero onboarding |
| **Micropayments viable** | ~$0.005/tx makes per-job payments practical |
| **Exclusive blockchain** | TON is Telegram's only blockchain since Jan 2025 |
| **Escrow on-chain** | Tact smart contracts enforce trustless settlement |
| **950M users** | Telegram distribution built in |

## Vision

ABP is to agent work delegation what HTTP is to web requests.

```
Today:   OpenClaw agents on Telegram → settle on TON
Tomorrow: ANY agent on ANY platform → settle on ANY chain
```

Four primitives. One protocol. Every agent speaks it.

## Built For

[AlphaTON Capital Track](https://alphaton.capital) — AI Agents on TON Hackathon

## License

MIT
