import { Hono } from "hono";
import { resolve } from "path";
import { PROJECT_ROOT } from "../../../lib/db";

const app = new Hono();

const LOGS_DIR = resolve(PROJECT_ROOT, "data/logs");

app.get("/api/logs/:runId", (c) => {
  const runId = c.req.param("runId");

  // Path traversal protection
  if (runId.includes("..") || runId.includes("/") || runId.includes("\\")) {
    return c.json({ error: "Invalid run ID" }, 400);
  }

  const logPath = resolve(LOGS_DIR, `${runId}.log`);

  // Verify resolved path is still within LOGS_DIR
  if (!logPath.startsWith(LOGS_DIR.replace(/\\/g, "/"))) {
    const normalizedLog = logPath.replace(/\\/g, "/");
    const normalizedDir = LOGS_DIR.replace(/\\/g, "/");
    if (!normalizedLog.startsWith(normalizedDir)) {
      return c.json({ error: "Invalid run ID" }, 400);
    }
  }

  const file = Bun.file(logPath);

  return file.exists().then(async (exists) => {
    if (!exists) {
      return c.json({ run_id: runId, content: "", exists: false });
    }
    const content = await file.text();
    return c.json({ run_id: runId, content, exists: true });
  });
});

export default app;
