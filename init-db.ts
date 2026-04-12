import { existsSync, readFileSync } from "fs";
import { getDb, DB_PATH } from "./lib/db";

export function initDb() {
  const db = getDb({ create: true });

  db.run(`CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    ended_at TEXT,
    mode TEXT DEFAULT 'explore',
    status TEXT DEFAULT 'running',
    summary TEXT,
    token_usage_input INTEGER,
    token_usage_output INTEGER
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS sources (
    source_id TEXT PRIMARY KEY,
    url TEXT NOT NULL,
    name TEXT NOT NULL,
    category TEXT,
    depth INTEGER DEFAULT 1 CHECK (depth BETWEEN 1 AND 3),
    trust_score REAL DEFAULT 0.5 CHECK (trust_score BETWEEN 0.0 AND 1.0),
    last_crawled TEXT,
    quarantined_until TEXT,
    crawl_strategy_json TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS cases (
    case_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    title TEXT NOT NULL,
    url TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    level TEXT NOT NULL CHECK (level IN ('A', 'B', 'C')),
    summary TEXT,
    who TEXT,
    what TEXT,
    how TEXT,
    tools_json TEXT,
    lessons TEXT,
    tags_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS reflections (
    reflection_id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    what_worked TEXT,
    what_failed TEXT,
    source_evaluations_json TEXT,
    strategy_improvements TEXT,
    open_questions TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS tasks (
    task_id TEXT PRIMARY KEY,
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    description TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    assigned_agent TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS source_scores (
    score_id INTEGER PRIMARY KEY AUTOINCREMENT,
    source_id TEXT NOT NULL REFERENCES sources(source_id),
    run_id TEXT NOT NULL REFERENCES runs(run_id),
    hit_count INTEGER DEFAULT 0,
    noise_count INTEGER DEFAULT 0,
    quality_avg REAL DEFAULT 0.0,
    notes TEXT
  )`);

  db.run(`CREATE UNIQUE INDEX IF NOT EXISTS idx_cases_content_hash ON cases(content_hash)`);

  // Seed initial sources if table is empty
  const count = db.query("SELECT COUNT(*) as c FROM sources").get() as { c: number };
  if (count.c === 0 && existsSync("seeds.json")) {
    const seeds = JSON.parse(readFileSync("seeds.json", "utf-8")) as Array<{
      source_id: string;
      url: string;
      name: string;
      category?: string;
      depth?: number;
      trust_score?: number;
      crawl_strategy_json?: unknown;
    }>;
    const insert = db.prepare(
      "INSERT INTO sources (source_id, url, name, category, depth, trust_score, crawl_strategy_json) VALUES (?, ?, ?, ?, ?, ?, ?)"
    );
    for (const s of seeds) {
      insert.run(
        s.source_id, s.url, s.name, s.category ?? null, s.depth ?? 1, s.trust_score ?? 0.5,
        s.crawl_strategy_json ? JSON.stringify(s.crawl_strategy_json) : null
      );
    }
    console.log(`Seeded ${seeds.length} sources from seeds.json`);
  }

  console.log("Database initialized at", DB_PATH);
  return db;
}

if (import.meta.main) {
  initDb();
}
