import { Hono } from "hono";
import { db } from "../db";

const app = new Hono();

app.get("/api/reflections", (c) => {
  const d = db();
  const reflections = d.query(`
    SELECT ref.reflection_id, ref.run_id, ref.what_worked, ref.what_failed,
           ref.strategy_improvements, ref.open_questions,
           r.started_at as run_date
    FROM reflections ref
    JOIN runs r ON ref.run_id = r.run_id
    ORDER BY ref.reflection_id DESC
    LIMIT 50
  `).all();

  return c.json({ reflections });
});

export default app;
