import { readFileSync, writeFileSync, mkdirSync, chmodSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const configDir =
  process.env.BONJOUR_CLAUDE_DIR || join(homedir(), ".config", "bonjour-claude");

const configPath = join(configDir, "config.json");
const statePath = join(configDir, "state.json");

export const DEFAULT_MESSAGE = "Bonjour Claude!";

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return {};
  }
}

// Il config può contenere il token OAuth: dir 0700, file 0600.
function writeJson(path, data) {
  mkdirSync(configDir, { recursive: true, mode: 0o700 });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n", { mode: 0o600 });
  chmodSync(path, 0o600);
}

export function loadConfig() {
  return readJson(configPath);
}

export function saveConfig(config) {
  writeJson(configPath, config);
}

export function loadState() {
  return readJson(statePath);
}

export function saveState(state) {
  writeJson(statePath, state);
}
