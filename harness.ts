import { initDb } from "./init-db";
import { readFileSync, mkdirSync, existsSync } from "fs";

const HARD_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

async function dockerHealthcheck(): Promise<void> {
  const check = Bun.spawnSync(["docker", "compose", "ps", "crawl4ai"], {
    stdout: "pipe",
    stderr: "pipe",
  });
  const output = new TextDecoder().decode(check.stdout);

  if (check.exitCode === 0 && output.includes("running")) {
    console.log("Crawl4AI is already running");
    return;
  }

  console.log("Starting Crawl4AI...");
  const up = Bun.spawnSync(["docker", "compose", "up", "-d", "crawl4ai"], {
    stdout: "inherit",
    stderr: "inherit",
  });

  if (up.exitCode !== 0) {
    throw new Error(`Failed to start Crawl4AI (exit code ${up.exitCode})`);
  }

  console.log("Waiting 10s for Crawl4AI to become ready...");
  await Bun.sleep(10_000);
}

async function main() {
  const startTime = Date.now();

  // Step 1: Docker healthcheck
  try {
    await dockerHealthcheck();
  } catch (err) {
    console.error("Docker start failed:", (err as Error).message);
    process.exit(1);
  }

  // Step 2: Init database
  try {
    initDb();
  } catch (err) {
    console.error("Database init failed:", (err as Error).message);
    process.exit(1);
  }

  // Step 3: Generate run ID
  const runId = `run-${Date.now()}`;
  console.log(`Run ID: ${runId}`);

  // Step 4: Read agent prompt
  const promptContent = readFileSync("agent-prompt.md", "utf-8");

  // Step 5: Ensure log directory exists
  const logDir = "data/logs";
  if (!existsSync(logDir)) mkdirSync(logDir, { recursive: true });
  const logFile = Bun.file(`${logDir}/${runId}.log`);
  const logWriter = logFile.writer();

  // Step 6: Spawn Claude Code headless
  const proc = Bun.spawn(
    [
      "claude",
      "--print",
      "--dangerously-skip-permissions",
      "--model", "sonnet",
      "--max-turns", "50",
      promptContent,
    ],
    { stdout: "pipe", stderr: "pipe" }
  );

  // Pipe stdout and stderr to log file
  const pipeStream = async (stream: ReadableStream<Uint8Array>) => {
    for await (const chunk of stream) {
      logWriter.write(chunk);
    }
  };
  pipeStream(proc.stdout);
  pipeStream(proc.stderr);

  // Step 7: Hard timeout
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    console.log("Hard timeout reached (30min). Sending SIGTERM...");
    proc.kill("SIGTERM");
  }, HARD_TIMEOUT_MS);

  // Step 8: Wait for exit
  const exitCode = await proc.exited;
  clearTimeout(timer);
  logWriter.end();

  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  const status = timedOut ? "timeout" : exitCode === 0 ? "success" : "error";

  console.log(`Run complete: status=${status} exitCode=${exitCode} duration=${duration}s runId=${runId}`);

  if (exitCode !== 0 && !timedOut) {
    process.exit(1);
  }
}

main();
