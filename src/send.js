import { spawn } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_MESSAGE, loadConfig, saveState } from "./config.js";

const SEND_TIMEOUT_MS = 2 * 60 * 1000;

// Manda il messaggio con `claude -p`: usa il login OAuth già presente sulla
// macchina, oppure il token salvato con `bonjour-claude login` (per i server).
export function sendMessage() {
  const config = loadConfig();
  const message = config.message || DEFAULT_MESSAGE;
  const env = { ...process.env };
  if (config.token) env.CLAUDE_CODE_OAUTH_TOKEN = config.token;

  // cwd in una dir vuota, per non caricare il contesto di nessun progetto
  const cwd = mkdtempSync(join(tmpdir(), "bonjour-claude-"));

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok, detail) => {
      if (settled) return;
      settled = true;
      const result = {
        lastSentAt: new Date().toISOString(),
        ok,
        message,
        detail: String(detail).trim().split("\n").slice(0, 5).join("\n"),
      };
      saveState(result);
      resolve(result);
    };

    const child = spawn("claude", ["-p", message], {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let out = "";
    let err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));

    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      finish(false, "timeout: nessuna risposta da claude entro 2 minuti");
    }, SEND_TIMEOUT_MS);

    child.on("error", (e) => {
      clearTimeout(timer);
      finish(false, `impossibile eseguire "claude": ${e.message} — è installato Claude Code?`);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) finish(true, out);
      else finish(false, err || out || `claude è uscito con codice ${code} (sei loggato?)`);
    });
  });
}
