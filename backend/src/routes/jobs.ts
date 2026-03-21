import { Router, Request, Response } from 'express';
import { v4 as uuid } from 'uuid';
import { getDb } from '../db';
import { broadcastToWorkers } from '../ws/notifications';

export const jobsRouter = Router();

// Search specialists — delegates to /agents/search for semantic matching
// Kept for backward compat with MCP tools that POST here
jobsRouter.post('/search', async (req: Request, res: Response) => {
  const { skill, max_budget, query: freeTextQuery } = req.body;
  const db = getDb();

  // If a free-text query is provided, use semantic search
  const searchQuery = freeTextQuery || skill || '';

  // Forward to the agents search logic inline
  let dbQuery = 'SELECT * FROM agents WHERE active = 1';
  const params: any[] = [];

  if (max_budget) {
    dbQuery += ' AND price_per_job <= ?';
    params.push(max_budget);
  }

  const agents = db.prepare(dbQuery).all(...params);

  // Tokenize and score (same logic as /agents/search)
  const stopWords = new Set([
    'i', 'a', 'an', 'the', 'is', 'am', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'can', 'could',
    'should', 'may', 'might', 'to', 'of', 'in', 'on', 'at', 'by', 'for',
    'with', 'from', 'and', 'but', 'or', 'so', 'if', 'that', 'this', 'it',
    'my', 'me', 'we', 'our', 'you', 'your', 'not', 'no', 'very', 'just',
  ]);
  const queryTokens = searchQuery.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/).filter((w: string) => w.length > 1 && !stopWords.has(w));

  const scored = agents.map((agent: any) => {
    const skillsArr: string[] = (() => { try { return JSON.parse(agent.skills); } catch { return []; } })();
    const agentText = [...skillsArr, agent.description || ''].join(' ');
    const agentTokens = agentText.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ')
      .split(/\s+/).filter((w: string) => w.length > 1);
    const agentTextLower = agentText.toLowerCase();

    let score = 0;
    for (const qt of queryTokens) {
      if (agentTokens.includes(qt)) { score += 10; continue; }
      if (agentTokens.some((at: string) => at.includes(qt) || qt.includes(at))) { score += 6; continue; }
      if (agentTextLower.includes(qt)) { score += 4; }
    }
    const matchScore = queryTokens.length > 0 ? score / queryTokens.length : 0;
    const repBoost = (agent.reputation || 0) * 0.4;
    const expBoost = Math.log2((agent.total_jobs || 0) + 1) * 0.5;

    return { ...agent, skills: skillsArr, _score: matchScore + repBoost + expBoost };
  }).filter((a: any) => a._score > 0 || queryTokens.length === 0)
    .sort((a: any, b: any) => b._score - a._score);

  res.json({ agents: scored });
});

// Create a new job
jobsRouter.post('/create', (req: Request, res: Response) => {
  const { id: providedId, hirer_address, worker_address, task, context, escrow_address, amount } = req.body;
  const id = providedId || uuid();
  const db = getDb();

  db.prepare(`
    INSERT INTO jobs (id, hirer_address, worker_address, task, context, escrow_address, amount, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'created')
  `).run(id, hirer_address, worker_address, task, context || null, escrow_address || null, amount || null);

  // Notify specialist via WebSocket
  if (worker_address) {
    broadcastToWorkers(worker_address, {
      type: 'new_job',
      job_id: id,
      task,
      amount,
    });
  }

  res.json({ job_id: id });
});

// Get job status
jobsRouter.get('/:id', (req: Request, res: Response) => {
  const db = getDb();
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id);

  if (!job) {
    res.status(404).json({ error: 'Job not found' });
    return;
  }

  // Get associated files
  const files = db.prepare('SELECT * FROM files WHERE job_id = ?').all(req.params.id);

  res.json({ job, files });
});

// Accept a job (specialist)
jobsRouter.patch('/:id/accept', (req: Request, res: Response) => {
  const { worker_address } = req.body;
  const db = getDb();

  const result = db.prepare(`
    UPDATE jobs SET status = 'accepted', worker_address = ?, updated_at = datetime('now')
    WHERE id = ? AND status = 'created'
  `).run(worker_address, req.params.id);

  if (result.changes === 0) {
    res.status(400).json({ error: 'Job cannot be accepted' });
    return;
  }

  res.json({ status: 'accepted' });
});

// Deliver (specialist submits result)
jobsRouter.patch('/:id/deliver', (req: Request, res: Response) => {
  const { message } = req.body;
  const db = getDb();

  const result = db.prepare(`
    UPDATE jobs SET status = 'delivered', deliverable_message = ?, updated_at = datetime('now')
    WHERE id = ? AND status = 'accepted'
  `).run(message || null, req.params.id);

  if (result.changes === 0) {
    res.status(400).json({ error: 'Job cannot be delivered' });
    return;
  }

  // Notify hirer
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
  if (job) {
    broadcastToWorkers(job.hirer_address, {
      type: 'job_delivered',
      job_id: req.params.id,
      message,
    });
  }

  res.json({ status: 'delivered' });
});

// Confirm delivery (hirer approves)
jobsRouter.patch('/:id/confirm', (req: Request, res: Response) => {
  const db = getDb();

  const result = db.prepare(`
    UPDATE jobs SET status = 'completed', updated_at = datetime('now')
    WHERE id = ? AND status = 'delivered'
  `).run(req.params.id);

  if (result.changes === 0) {
    res.status(400).json({ error: 'Job cannot be confirmed' });
    return;
  }

  // Update specialist stats
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
  if (job?.worker_address) {
    db.prepare(`
      UPDATE agents SET total_jobs = total_jobs + 1, updated_at = datetime('now')
      WHERE address = ?
    `).run(job.worker_address);
  }

  res.json({ status: 'completed' });
});

// Dispute (hirer rejects)
jobsRouter.patch('/:id/dispute', (req: Request, res: Response) => {
  const db = getDb();

  const result = db.prepare(`
    UPDATE jobs SET status = 'disputed', updated_at = datetime('now')
    WHERE id = ? AND status = 'delivered'
  `).run(req.params.id);

  if (result.changes === 0) {
    res.status(400).json({ error: 'Job cannot be disputed' });
    return;
  }

  // Slash specialist
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
  if (job?.worker_address) {
    db.prepare(`
      UPDATE agents SET total_disputes = total_disputes + 1
      WHERE address = ?
    `).run(job.worker_address);

    // Auto-deactivate after 3 disputes
    db.prepare(`
      UPDATE agents SET active = 0
      WHERE address = ? AND total_disputes >= 3
    `).run(job.worker_address);
  }

  res.json({ status: 'disputed' });
});

// Rate specialist
jobsRouter.post('/:id/rate', (req: Request, res: Response) => {
  const { rating } = req.body;
  if (!rating || rating < 1 || rating > 5) {
    res.status(400).json({ error: 'Rating must be 1-5' });
    return;
  }

  const db = getDb();

  db.prepare(`
    UPDATE jobs SET rating = ?, updated_at = datetime('now')
    WHERE id = ?
  `).run(rating, req.params.id);

  // Update specialist reputation (weighted average)
  const job = db.prepare('SELECT * FROM jobs WHERE id = ?').get(req.params.id) as any;
  if (job?.worker_address) {
    const agent = db.prepare('SELECT * FROM agents WHERE address = ?').get(job.worker_address) as any;
    if (agent) {
      const newReputation = agent.total_jobs > 0
        ? ((agent.reputation * (agent.total_jobs - 1)) + rating) / agent.total_jobs
        : rating;

      db.prepare(`
        UPDATE agents SET reputation = ? WHERE address = ?
      `).run(Math.round(newReputation * 100) / 100, job.worker_address);
    }
  }

  res.json({ status: 'rated', rating });
});

// List all jobs (with optional filters)
jobsRouter.get('/', (req: Request, res: Response) => {
  const { hirer, worker, status } = req.query;
  const db = getDb();

  let query = 'SELECT * FROM jobs WHERE 1=1';
  const params: any[] = [];

  if (hirer) { query += ' AND hirer_address = ?'; params.push(hirer); }
  if (worker) { query += ' AND worker_address = ?'; params.push(worker); }
  if (status) { query += ' AND status = ?'; params.push(status); }

  query += ' ORDER BY created_at DESC';

  const jobs = db.prepare(query).all(...params);
  res.json({ jobs });
});
