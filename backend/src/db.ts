import Database from 'better-sqlite3';
import path from 'path';

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'baton.db');
let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
  }
  return db;
}

export function initDb(): void {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      address TEXT NOT NULL UNIQUE,
      skills TEXT NOT NULL,          -- JSON array
      price_per_job REAL NOT NULL,   -- in TON
      staked_amount REAL DEFAULT 0,
      reputation REAL DEFAULT 0,    -- 0-5
      total_jobs INTEGER DEFAULT 0,
      total_disputes INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      registered_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      description TEXT,
      name TEXT,
      mnemonic TEXT,                 -- legacy, use wallets table instead
      owner_address TEXT             -- ton_connect_address of the owner
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      hirer_address TEXT NOT NULL,
      worker_address TEXT,
      task TEXT NOT NULL,
      context TEXT,
      status TEXT DEFAULT 'created',  -- created, accepted, delivered, completed, disputed, expired
      escrow_address TEXT,
      amount REAL,
      deliverable_message TEXT,
      rating INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS wallets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ton_connect_address TEXT NOT NULL UNIQUE,
      baton_address TEXT NOT NULL UNIQUE,
      mnemonic TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      uploaded_by TEXT NOT NULL,     -- 'hirer' or 'worker'
      uploaded_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (job_id) REFERENCES jobs(id)
    );
  `);

  // Migrations for existing databases
  const columns = db.prepare("PRAGMA table_info(agents)").all() as { name: string }[];
  if (!columns.some(c => c.name === 'name')) {
    db.exec("ALTER TABLE agents ADD COLUMN name TEXT");
    console.log('Migrated: added name column to agents');
  }
  if (!columns.some(c => c.name === 'mnemonic')) {
    db.exec("ALTER TABLE agents ADD COLUMN mnemonic TEXT");
    console.log('Migrated: added mnemonic column to agents');
  }
  if (!columns.some(c => c.name === 'updated_at')) {
    db.exec("ALTER TABLE agents ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))");
    console.log('Migrated: added updated_at column to agents');
  }
  if (!columns.some(c => c.name === 'owner_address')) {
    db.exec("ALTER TABLE agents ADD COLUMN owner_address TEXT");
    console.log('Migrated: added owner_address column to agents');
  }

  console.log('Database initialized');
}
