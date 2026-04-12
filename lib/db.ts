import { Database } from "bun:sqlite";
import { resolve } from "path";

const PROJECT_ROOT = resolve(import.meta.dir, "..");
const DB_PATH = resolve(PROJECT_ROOT, "data/usecase.db");

let _db: Database | null = null;

export function getDb(options?: { create?: boolean }): Database {
  if (_db) return _db;

  _db = new Database(DB_PATH, { create: options?.create ?? true });
  _db.run("PRAGMA journal_mode=WAL");
  _db.run("PRAGMA busy_timeout=5000");

  return _db;
}

export { DB_PATH, PROJECT_ROOT };
