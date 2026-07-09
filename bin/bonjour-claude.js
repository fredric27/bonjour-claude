#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { createInterface } from "node:readline/promises";
import {
  DEFAULT_MESSAGE,
  configDir,
  loadConfig,
  loadState,
  saveConfig,
} from "../src/config.js";
import {
  formatInTz,
  isValidTimeZone,
  nextOccurrence,
  sleepUntil,
  systemTimeZone,
} from "../src/schedule.js";
import { sendMessage } from "../src/send.js";

const HELP = `bonjour-claude — start your Claude Code session window at the time you choose

Usage:
  bonjour-claude login                       Set up access with your Anthropic account
  bonjour-claude set <HH:MM> [options]       Set the daily send time
      --tz <IANA timezone>                   e.g. Europe/Rome (default: system timezone)
      --message <text>                       message to send (default: "${DEFAULT_MESSAGE}")
  bonjour-claude start                       Start the daemon that sends every day at the set time
  bonjour-claude send                        Send the message right now (handy for testing)
  bonjour-claude status                      Show configuration, next send and last result

Example:
  bonjour-claude set 08:00 --tz Europe/Rome
  bonjour-claude start
`;

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString("en-GB")}] ${msg}`);
}

function die(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tz") flags.tz = args[++i];
    else if (args[i] === "--message") flags.message = args[++i];
    else die(`unknown option: ${args[i]}`);
  }
  return flags;
}

function parseTime(value) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  if (!match) die(`invalid time: "${value}". Use the HH:MM format, e.g. 08:00`);
  return { hh: Number(match[1]), mm: Number(match[2]) };
}

async function cmdLogin() {
  console.log(`If you are already logged into Claude Code on this machine (the "claude"
command), bonjour-claude will use that login and nothing else is needed:
try "bonjour-claude send".

For a server (or without a local login) you need a long-lived token: I will
now run "claude setup-token" — follow the flow, then paste the generated
token here.
`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const go = (await rl.question("Generate a token now? [y/N] ")).trim().toLowerCase();
  if (go !== "y" && go !== "yes") {
    rl.close();
    console.log("Ok, I'll use the local Claude Code login.");
    return;
  }
  const res = spawnSync("claude", ["setup-token"], { stdio: "inherit" });
  if (res.error) die(`cannot run "claude setup-token": ${res.error.message}`);
  const token = (await rl.question("\nPaste the token (enter to skip): ")).trim();
  rl.close();
  if (!token) {
    console.log("No token stored: I'll use the local Claude Code login.");
    return;
  }
  saveConfig({ ...loadConfig(), token });
  console.log(`Token stored in ${configDir}/config.json (600 permissions).`);
}

function cmdSet(args) {
  const { hh, mm } = parseTime(args[0]);
  const flags = parseFlags(args.slice(1));
  const tz = flags.tz || loadConfig().tz || systemTimeZone();
  if (!isValidTimeZone(tz)) die(`invalid timezone: "${tz}". Use an IANA name, e.g. Europe/Rome`);

  const config = { ...loadConfig(), time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, tz };
  if (flags.message) config.message = flags.message;
  saveConfig(config);

  const next = nextOccurrence(hh, mm, tz);
  console.log(`Configured: every day at ${config.time} (${tz})`);
  console.log(`Message: "${config.message || DEFAULT_MESSAGE}"`);
  console.log(`Next send: ${formatInTz(next, tz)}`);
}

async function cmdSend() {
  log("Sending the message to Claude…");
  const result = await sendMessage();
  if (result.ok) {
    log(`Sent ✓ — the session window has started. Response: ${result.detail}`);
  } else {
    die(result.detail);
  }
}

async function cmdStart() {
  const config = loadConfig();
  if (!config.time) die('no time configured. First run: bonjour-claude set HH:MM [--tz ...]');
  const { hh, mm } = parseTime(config.time);
  const tz = config.tz || systemTimeZone();
  log(`Daemon started: daily send at ${config.time} (${tz}), message "${config.message || DEFAULT_MESSAGE}"`);

  while (true) {
    const next = nextOccurrence(hh, mm, tz);
    log(`Next send: ${formatInTz(next, tz)}`);
    await sleepUntil(next);
    log("It's time: sending the message to Claude…");
    const result = await sendMessage();
    if (result.ok) log(`Sent ✓ — response: ${result.detail}`);
    else log(`SEND ERROR: ${result.detail}`);
  }
}

function cmdStatus() {
  const config = loadConfig();
  const state = loadState();
  if (!config.time) {
    console.log('No time configured. Run: bonjour-claude set HH:MM [--tz ...]');
    return;
  }
  const { hh, mm } = parseTime(config.time);
  const tz = config.tz || systemTimeZone();
  console.log(`Time:      ${config.time} (${tz}), every day`);
  console.log(`Message:   "${config.message || DEFAULT_MESSAGE}"`);
  console.log(`Login:     ${config.token ? "stored token" : "local Claude Code login"}`);
  console.log(`Next send: ${formatInTz(nextOccurrence(hh, mm, tz), tz)}`);
  if (state.lastSentAt) {
    console.log(`Last send: ${formatInTz(new Date(state.lastSentAt), tz)} — ${state.ok ? "ok ✓" : `ERROR: ${state.detail}`}`);
  } else {
    console.log("Last send: never");
  }
}

const [command, ...args] = process.argv.slice(2);
switch (command) {
  case "login":
    await cmdLogin();
    break;
  case "set":
    cmdSet(args);
    break;
  case "start":
    await cmdStart();
    break;
  case "send":
    await cmdSend();
    break;
  case "status":
    cmdStatus();
    break;
  case undefined:
  case "help":
  case "--help":
  case "-h":
    console.log(HELP);
    break;
  default:
    die(`unknown command: "${command}". Use "bonjour-claude help".`);
}
