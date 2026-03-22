import { Router, Request, Response } from 'express';
import { getDb } from '../db';
import { generateWallet } from '../ton/wallet';

export const agentsRouter = Router();

// ===== HELPERS =====

/**
 * Tokenize a string into normalized lowercase words for matching.
 * Strips punctuation, splits on whitespace, removes short noise words.
 */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    'i', 'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
    'should', 'may', 'might', 'shall', 'must', 'need', 'to', 'of', 'in', 'on',
    'at', 'by', 'for', 'with', 'from', 'up', 'about', 'into', 'through',
    'and', 'but', 'or', 'so', 'if', 'then', 'than', 'that', 'this', 'it',
    'my', 'me', 'we', 'our', 'you', 'your', 'he', 'she', 'they', 'them',
    'its', 'not', 'no', 'very', 'just', 'also', 'some', 'any', 'all',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 1 && !stopWords.has(w));
}

/**
 * Score how well an agent matches a free-text query.
 * Uses token overlap + partial substring matching + reputation boost.
 */
function scoreAgent(agent: any, queryTokens: string[]): number {
  if (queryTokens.length === 0) return 0;

  // Build the agent's searchable text pool
  const skillsArr: string[] = (() => {
    try { return JSON.parse(agent.skills); } catch { return []; }
  })();
  const agentText = [
    ...(skillsArr || []),
    agent.description || '',
  ].join(' ');
  const agentTokens = tokenize(agentText);
  const agentTextLower = agentText.toLowerCase();

  let score = 0;

  for (const qt of queryTokens) {
    // Exact token match (highest weight)
    if (agentTokens.includes(qt)) {
      score += 10;
      continue;
    }

    // Substring match in any agent token (e.g. "render" matches "rendering")
    const substringMatch = agentTokens.some(at => at.includes(qt) || qt.includes(at));
    if (substringMatch) {
      score += 6;
      continue;
    }

    // Substring match in raw text (catches hyphenated terms, etc.)
    if (agentTextLower.includes(qt)) {
      score += 4;
    }
  }

  // Normalize by query length so longer queries don't auto-win
  const matchScore = score / queryTokens.length;

  // Reputation boost: 0-5 → add up to 2 points
  const reputationBoost = (agent.reputation || 0) * 0.4;

  // Experience boost: log scale of total jobs
  const experienceBoost = Math.log2((agent.total_jobs || 0) + 1) * 0.5;

  return matchScore + reputationBoost + experienceBoost;
}

/** Strip mnemonic from agent objects before sending to clients */
function sanitizeAgent(agent: any): any {
  const { mnemonic, ...safe } = agent;
  return safe;
}

// ===== ROUTES =====

// Register a specialist
// Uses ton_connect_address to look up/create a Baton wallet.
// The agent's on-chain address = the Baton wallet address (for escrow compatibility).
agentsRouter.post('/register', async (req: Request, res: Response) => {
  const { ton_connect_address, address: legacyAddress, skills, price_per_job, description, name } = req.body;

  if (!skills || !price_per_job) {
    res.status(400).json({ error: 'skills and price_per_job are required' });
    return;
  }

  // Determine identity: prefer ton_connect_address, fall back to legacy address
  const identity = ton_connect_address || legacyAddress;
  if (!identity) {
    res.status(400).json({ error: 'ton_connect_address (or address) required' });
    return;
  }

  const db = getDb();

  try {
    // Get or create Baton wallet for this identity
    let wallet = db.prepare('SELECT baton_address FROM wallets WHERE ton_connect_address = ?').get(identity) as any;

    if (!wallet) {
      const { mnemonic, address: batonAddress } = await generateWallet();
      db.prepare('INSERT INTO wallets (ton_connect_address, baton_address, mnemonic) VALUES (?, ?, ?)')
        .run(identity, batonAddress, mnemonic);
      wallet = { baton_address: batonAddress };
    }

    const agentAddress = wallet.baton_address;

    // Upsert: update if this owner already has an agent
    const existing = db.prepare('SELECT * FROM agents WHERE owner_address = ?').get(identity) as any;

    if (existing) {
      db.prepare(`
        UPDATE agents SET skills = ?, price_per_job = ?, description = ?, name = ?, address = ?, active = 1, updated_at = datetime('now')
        WHERE owner_address = ?
      `).run(JSON.stringify(skills), price_per_job, description || null, name || null, agentAddress, identity);

      res.json({ status: 'updated', address: agentAddress, baton_address: agentAddress });
    } else {
      db.prepare(`
        INSERT INTO agents (address, skills, price_per_job, description, name, owner_address)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(agentAddress, JSON.stringify(skills), price_per_job, description || null, name || null, identity);

      res.json({ status: 'registered', address: agentAddress, baton_address: agentAddress });
    }
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Semantic search for specialists
agentsRouter.get('/search', (req: Request, res: Response) => {
  const { q, max_budget } = req.query;

  if (!q || typeof q !== 'string') {
    res.status(400).json({ error: 'Query parameter "q" is required' });
    return;
  }

  const db = getDb();
  let query = 'SELECT * FROM agents WHERE active = 1';
  const params: any[] = [];

  if (max_budget) {
    query += ' AND price_per_job <= ?';
    params.push(Number(max_budget));
  }

  const agents = db.prepare(query).all(...params);

  // Score and rank
  const queryTokens = tokenize(q);
  const scored = agents
    .map((agent: any) => ({
      ...agent,
      skills: (() => { try { return JSON.parse(agent.skills); } catch { return []; } })(),
      _score: scoreAgent(agent, queryTokens),
    }))
    .filter((a: any) => a._score > 0)
    .sort((a: any, b: any) => b._score - a._score);

  res.json({ agents: scored.map(sanitizeAgent), query: q, tokens: queryTokens });
});

// List all specialists
agentsRouter.get('/', (req: Request, res: Response) => {
  const { skill, active } = req.query;
  const db = getDb();

  let query = 'SELECT * FROM agents WHERE 1=1';
  const params: any[] = [];

  if (skill) { query += ' AND skills LIKE ?'; params.push(`%${skill}%`); }
  if (active !== undefined) { query += ' AND active = ?'; params.push(active === 'true' ? 1 : 0); }

  query += ' ORDER BY reputation DESC';

  const agents = db.prepare(query).all(...params);

  // Parse skills JSON for each agent
  const parsed = agents.map((a: any) => sanitizeAgent({
    ...a,
    skills: JSON.parse(a.skills),
  }));

  res.json({ agents: parsed });
});

// Get specialist profile by id
agentsRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as any;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const earningsRow = db.prepare(
    "SELECT SUM(amount) as total_earnings FROM jobs WHERE worker_address = ? AND status IN ('delivered', 'completed')"
  ).get(agent.address) as any;

  agent.total_earnings = earningsRow?.total_earnings || 0;
  agent.skills = JSON.parse(agent.skills);
  res.json({ agent: sanitizeAgent(agent) });
});

// Unregister by id
agentsRouter.delete('/:id', (req: Request, res: Response) => {
  const db = getDb();

  const agent = db.prepare('SELECT * FROM agents WHERE id = ?').get(req.params.id) as any;
  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const activeJobs = db.prepare(
    "SELECT COUNT(*) as count FROM jobs WHERE worker_address = ? AND status IN ('created', 'accepted')"
  ).get(agent.address) as any;

  if (activeJobs.count > 0) {
    res.status(400).json({ error: 'Cannot unregister with active jobs' });
    return;
  }

  db.prepare('UPDATE agents SET active = 0 WHERE id = ?').run(req.params.id);
  res.json({ status: 'unregistered' });
});
