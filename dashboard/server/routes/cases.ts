import { Hono } from "hono";
import { db } from "../db";

const app = new Hono();

app.get("/api/cases", (c) => {
  const limit = Math.min(Number(c.req.query("limit") || 50), 200);
  const offset = Math.max(Number(c.req.query("offset") || 0), 0);
  const level = c.req.query("level");
  const sourceId = c.req.query("source_id");
  const tag = c.req.query("tag");
  const sort = c.req.query("sort") || "created_at";
  const order = c.req.query("order") === "asc" ? "ASC" : "DESC";

  const d = db();
  const conditions: string[] = [];
  const params: any[] = [];

  if (level) {
    conditions.push("c.level = ?");
    params.push(level);
  }
  if (sourceId) {
    conditions.push("c.source_id = ?");
    params.push(sourceId);
  }
  if (tag) {
    conditions.push("c.tags_json LIKE ?");
    params.push(`%${tag}%`);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const sortCol = ["created_at", "level", "title"].includes(sort) ? `c.${sort}` : "c.created_at";

  const cases = d.query(`
    SELECT c.case_id, c.run_id, c.source_id, c.title, c.url, c.level,
           c.summary, c.who, c.what, c.how, c.tags_json, c.created_at,
           s.name as source_name
    FROM cases c JOIN sources s ON c.source_id = s.source_id
    ${where}
    ORDER BY ${sortCol} ${order}
    LIMIT ? OFFSET ?
  `).all(...params, limit, offset).map((row: any) => ({
    ...row,
    tags: row.tags_json ? (() => { try { return JSON.parse(row.tags_json); } catch { return []; } })() : [],
    tags_json: undefined,
  }));

  const total = d.query(`SELECT COUNT(*) as count FROM cases c ${where}`).get(...params) as { count: number };

  return c.json({ cases, total: total.count });
});

export default app;
