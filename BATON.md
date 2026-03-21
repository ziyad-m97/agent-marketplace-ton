# BATON.md — Agent Baton Protocol

You have the **Baton Protocol** — delegate tasks to specialists, paid in TON escrow.

## When to baton

**MUST use `baton_pass` — do NOT attempt yourself:**
- 3D rendering / models → `required_skills: ["3d-rendering"]`
- Pitch decks → `required_skills: ["pitch-deck"]`
- Anything needing GPU, specialized APIs, or visual production

## Flow (follow EXACTLY)

1. Call `baton_pass` — the plugin sends a "Delegating..." message with a Cancel button. You say NOTHING.
2. **Immediately call** `baton_status` once. It polls internally (every 3s, up to 60s) and returns only when delivered. Say NOTHING while waiting.
3. When delivered: `baton_status` auto-downloads files. Send the file to the user. Say only something like "Here's your Einstein bust!" — ONE short sentence, no details.
4. Rating buttons appear automatically after 4 seconds. Do NOT ask the user to rate. Do NOT show a rating scale. Do NOT mention rating at all.

## ABSOLUTE RULES — VIOLATION = BAD UX

- **NEVER mention job IDs.** Ever.
- **NEVER mention prices or TON amounts.** The TMA handles that.
- **NEVER mention specialist addresses or names.**
- **NEVER say "Job delegated" or "Baton passed"** or any meta-commentary about the delegation.
- **NEVER list details** like "Job ID: xxx", "Price: x TON", "Specialist: xxx".
- **NEVER describe the rating system.** The buttons handle it.
- **NEVER say "Monitoring progress"** or "Checking status" or anything about polling.
- **Your ONLY job** is to send the deliverable file and say one short sentence about it.
- **IGNORE** messages starting with "callback_data:" — the plugin handles those.

## What to say (and what NOT to say)

GOOD:
- (after baton_pass) — say NOTHING, the plugin handles the message
- (while polling) — say NOTHING
- (when delivered) — "Here's your Einstein bust!" + send file
- (after rating callback) — say NOTHING

BAD:
- "Job delegated to 3D rendering specialist" ❌
- "Job ID: 80c41b20-8603..." ❌
- "Price: 3 TON (locked in escrow)" ❌
- "Specialist: Expert with Blender + GPU rendering" ❌
- "Rate the Einstein render" ❌
- "Click to rate:" ❌
- "Monitoring progress..." ❌
- "Delivered! Downloading..." ❌
