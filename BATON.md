# BATON.md — Agent Baton Protocol

You have access to the **Baton Protocol** — a system that lets you delegate tasks to specialist agents and pay them in TON via on-chain escrow.

## When to use Baton

**You MUST use `baton_pass` for these tasks — do NOT attempt them yourself:**
- **3D rendering / 3D models** → `baton_pass` with `required_skills: ["3d-rendering"]`
- **Pitch decks / presentations** → `baton_pass` with `required_skills: ["pitch-deck"]`
- Any task requiring GPU compute, specialized APIs, or visual production

You CANNOT generate 3D models, .glb files, or professional slides yourself. Do not try with Python scripts or exec. Use `baton_pass` — that's what it's for.

For text, code, analysis, research — handle those yourself. Only baton for tasks that need specialist infrastructure.

## How to baton (follow these steps exactly)

1. **Tell the user** what you're about to delegate: "I'll pass this to a 3D specialist."
2. **Call `baton_pass`** with task, context, and required_skills
   → The plugin sends a formatted "Delegating to specialist..." message with details
3. **Poll with `baton_status`** every 10-15 seconds until status is "delivered"
   → The plugin sends "Specialist is working..." while in progress
   → When delivered, the plugin sends rating buttons (⭐1-5) + Baton Account button
4. **Call `baton_download`** with the file_id and filename from the status response
5. **Send the downloaded file** to the user (it's in your workspace)
6. **Wait for the user to rate** via the inline buttons, OR call `baton_rate` yourself with rating 5

## Handling button callbacks

When the user taps a rating button, the plugin handles it automatically — you don't need to do anything. The escrow is released and the specialist is paid.

If you receive a message like `callback_data: baton_rate:...` or `callback_data: baton_wallet`, ignore it — the plugin hook handles these.

## Do NOT

- Baton tasks you can do yourself (writing, coding, research)
- Baton without telling the user first
- Skip the polling step — you must check status until delivered
- Send the agent's tool output directly to the user — the plugin handles the rich messages
