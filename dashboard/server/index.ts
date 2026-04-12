import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { cors } from "hono/cors";
import { getDb } from "../../lib/db";
import dashboardStats from "./routes/dashboard-stats";
import runs from "./routes/runs";
import cases from "./routes/cases";
import sources from "./routes/sources";
import reflections from "./routes/reflections";
import logs from "./routes/logs";

const app = new Hono();

app.use("*", cors());

// Health check endpoint
app.get("/api/health", (c) => {
  try {
    const db = getDb();
    db.run("SELECT 1");
    const latestRun = db
      .query(
        "SELECT run_id, status, started_at FROM runs ORDER BY started_at DESC LIMIT 1"
      )
      .get() as Record<string, unknown> | null;
    return c.json({
      status: "healthy",
      db: "ok",
      latest_run: latestRun || null,
      uptime: process.uptime(),
    });
  } catch (e) {
    return c.json({ status: "unhealthy", error: String(e) }, 503);
  }
});

// API routes
app.route("/", dashboardStats);
app.route("/", runs);
app.route("/", cases);
app.route("/", sources);
app.route("/", reflections);
app.route("/", logs);

// Serve static files in production
app.use("/*", serveStatic({ root: "./dashboard/dist" }));
app.use("/*", serveStatic({ path: "./dashboard/dist/index.html" }));

const port = Number(process.env.PORT || 3000);

export default {
  port,
  fetch: app.fetch,
};

console.log(`Dashboard server running on http://localhost:${port}`);
