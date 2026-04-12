import { Hono } from "hono";
import { db } from "../db";

const app = new Hono();

app.get("/api/dashboard/stats", (c) => {
  const d = db();

  const totalCases = d.query("SELECT COUNT(*) as count FROM cases").get() as { count: number };
  const levelDist = d.query("SELECT level, COUNT(*) as count FROM cases GROUP BY level").all() as Array<{ level: string; count: number }>;
  const totalRuns = d.query("SELECT COUNT(*) as count FROM runs").get() as { count: number };
  const activeSources = d.query("SELECT COUNT(*) as count FROM sources WHERE quarantined_until IS NULL OR quarantined_until < datetime('now')").get() as { count: number };

  const latestRun = d.query(`
    SELECT r.run_id, r.started_at, r.ended_at, r.status, r.summary,
           (SELECT COUNT(*) FROM cases WHERE run_id = r.run_id) as case_count
    FROM runs r ORDER BY r.started_at DESC LIMIT 1
  `).get() as { run_id: string; started_at: string; ended_at: string | null; status: string; summary: string | null; case_count: number } | null;

  const topSources = d.query("SELECT source_id, name, trust_score FROM sources ORDER BY trust_score DESC LIMIT 3").all();
  const bottomSources = d.query("SELECT source_id, name, trust_score FROM sources WHERE trust_score > 0 ORDER BY trust_score ASC LIMIT 3").all();

  const latestReflection = d.query(`
    SELECT what_worked, what_failed, strategy_improvements
    FROM reflections ORDER BY reflection_id DESC LIMIT 1
  `).get() as { what_worked: string; what_failed: string; strategy_improvements: string } | null;

  return c.json({
    total_cases: totalCases.count,
    level_distribution: Object.fromEntries(levelDist.map((r) => [r.level, r.count])),
    total_runs: totalRuns.count,
    active_sources: activeSources.count,
    latest_run: latestRun,
    top_sources: topSources,
    bottom_sources: bottomSources,
    latest_reflection: latestReflection,
  });
});

export default app;
