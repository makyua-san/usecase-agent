import { Hono } from "hono";
import { db } from "../db";

const app = new Hono();

app.get("/api/sources", (c) => {
  const d = db();
  const sources = d.query(`
    SELECT source_id, url, name, category, depth, trust_score,
           last_crawled, quarantined_until
    FROM sources
    ORDER BY trust_score DESC
  `).all();

  return c.json({ sources });
});

app.get("/api/sources/:id/history", (c) => {
  const sourceId = c.req.param("id");
  const d = db();

  const source = d.query(`
    SELECT source_id, name, url, trust_score
    FROM sources WHERE source_id = ?
  `).get(sourceId) as { source_id: string; name: string; url: string; trust_score: number } | null;

  if (!source) return c.json({ error: "Source not found" }, 404);

  const history = d.query(`
    SELECT ss.run_id, ss.hit_count, ss.noise_count, ss.quality_avg, ss.notes,
           r.started_at as run_date
    FROM source_scores ss
    JOIN runs r ON ss.run_id = r.run_id
    WHERE ss.source_id = ?
    ORDER BY r.started_at DESC
    LIMIT 20
  `).all(sourceId);

  return c.json({ source, history });
});

export default app;
