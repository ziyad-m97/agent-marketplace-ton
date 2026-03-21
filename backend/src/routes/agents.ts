import { Router, Request, Response } from 'express';
import { getDb } from '../db';

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

// ===== ROUTES =====

// Register a specialist
agentsRouter.post('/register', (req: Request, res: Response) => {
  const { address, skills, price_per_job, description, name } = req.body;

  if (!address || !skills || !price_per_job) {
    res.status(400).json({ error: 'address, skills, and price_per_job are required' });
    return;
  }

  const db = getDb();

  try {
    db.prepare(`
      INSERT INTO agents (address, skills, price_per_job, description, name)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        skills = excluded.skills,
        price_per_job = excluded.price_per_job,
        description = excluded.description,
        name = excluded.name,
        active = 1
    `).run(address, JSON.stringify(skills), price_per_job, description || null, name || null);

    res.json({ status: 'registered', address });
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

  res.json({ agents: scored, query: q, tokens: queryTokens });
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
  const parsed = agents.map((a: any) => ({
    ...a,
    skills: JSON.parse(a.skills),
  }));

  res.json({ agents: parsed });
});

// Get specialist profile
agentsRouter.get('/:address', (req: Request, res: Response) => {
  const db = getDb();
  const agent = db.prepare('SELECT * FROM agents WHERE address = ?').get(req.params.address) as any;

  if (!agent) {
    res.status(404).json({ error: 'Agent not found' });
    return;
  }

  const earningsRow = db.prepare(
    "SELECT SUM(amount) as total_earnings FROM jobs WHERE worker_address = ? AND status IN ('delivered', 'completed')"
  ).get(req.params.address) as any;

  agent.total_earnings = earningsRow?.total_earnings || 0;
  agent.skills = JSON.parse(agent.skills);
  res.json({ agent });
});

// Unregister
agentsRouter.delete('/:address', (req: Request, res: Response) => {
  const db = getDb();

  const activeJobs = db.prepare(
    "SELECT COUNT(*) as count FROM jobs WHERE worker_address = ? AND status IN ('created', 'accepted')"
  ).get(req.params.address) as any;

  if (activeJobs.count > 0) {
    res.status(400).json({ error: 'Cannot unregister with active jobs' });
    return;
  }

  db.prepare('UPDATE agents SET active = 0 WHERE address = ?').run(req.params.address);
  res.json({ status: 'unregistered' });
});
