import { Hono } from "hono";
import { db } from "../db";

const app = new Hono();

app.get("/api/runs", (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 20), 100);
  const offset = Math.max(Number(c.req.query("offset") || 0), 0);

  const d = db();
  const runs = d.query(`
    SELECT r.run_id, r.started_at, r.ended_at, r.status, r.summary,
           (SELECT COUNT(*) FROM cases WHERE run_id = r.run_id) as case_count
    FROM runs r
    ORDER BY r.started_at DESC
    LIMIT ? OFFSET ?
  `).all(limit, offset);

  const total = d.query("SELECT COUNT(*) as count FROM runs").get() as { count: number };

  return c.json({ runs, total: total.count });
});

app.get("/api/runs/:id", (c) => {
  const runId = c.req.param("id");
  const d = db();

  const run = d.query(`
    SELECT run_id, started_at, ended_at, status, summary
    FROM runs WHERE run_id = ?
  `).get(runId);

  if (!run) return c.json({ error: "Run not found" }, 404);

  const cases = d.query(`
    SELECT c.case_id, c.title, c.url, c.level, c.summary, c.tags_json, c.created_at,
           s.name as source_name
    FROM cases c JOIN sources s ON c.source_id = s.source_id
    WHERE c.run_id = ?
    ORDER BY c.created_at DESC
  `).all(runId).map((row: any) => ({
    ...row,
    tags: row.tags_json ? JSON.parse(row.tags_json) : [],
    tags_json: undefined,
  }));

  return c.json({ run, cases });
});

export default app;
