import { Router, Request, Response } from 'express';
import { getDb } from '../db';

export const agentsRouter = Router();

// Register a specialist
agentsRouter.post('/register', (req: Request, res: Response) => {
  const { address, skills, price_per_job, description } = req.body;

  if (!address || !skills || !price_per_job) {
    res.status(400).json({ error: 'address, skills, and price_per_job are required' });
    return;
  }

  const db = getDb();

  try {
    db.prepare(`
      INSERT INTO agents (address, skills, price_per_job, description)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(address) DO UPDATE SET
        skills = excluded.skills,
        price_per_job = excluded.price_per_job,
        description = excluded.description,
        active = 1
    `).run(address, JSON.stringify(skills), price_per_job, description || null);

    res.json({ status: 'registered', address });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
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
