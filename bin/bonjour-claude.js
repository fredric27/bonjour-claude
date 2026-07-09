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

const HELP = `bonjour-claude — fa partire la sessione di Claude Code all'ora che vuoi tu

Uso:
  bonjour-claude login                       Configura l'accesso con il tuo account Anthropic
  bonjour-claude set <HH:MM> [opzioni]       Imposta l'orario di invio giornaliero
      --tz <fuso IANA>                       es. Europe/Rome (default: fuso di sistema)
      --message <testo>                      messaggio da inviare (default: "${DEFAULT_MESSAGE}")
  bonjour-claude start                       Avvia il daemon che invia ogni giorno all'orario impostato
  bonjour-claude send                        Invia subito il messaggio (utile per testare)
  bonjour-claude status                      Mostra configurazione, prossimo invio e ultimo esito

Esempio:
  bonjour-claude set 08:00 --tz Europe/Rome
  bonjour-claude start
`;

function log(msg) {
  console.log(`[${new Date().toLocaleTimeString("it-IT")}] ${msg}`);
}

function die(msg) {
  console.error(`Errore: ${msg}`);
  process.exit(1);
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--tz") flags.tz = args[++i];
    else if (args[i] === "--message") flags.message = args[++i];
    else die(`opzione sconosciuta: ${args[i]}`);
  }
  return flags;
}

function parseTime(value) {
  const match = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(value || "");
  if (!match) die(`orario non valido: "${value}". Usa il formato HH:MM, es. 08:00`);
  return { hh: Number(match[1]), mm: Number(match[2]) };
}

async function cmdLogin() {
  console.log(`Se su questa macchina hai già fatto il login di Claude Code (comando "claude"),
bonjour-claude userà quello e non serve altro: prova con "bonjour-claude send".

Per un server (o senza login locale) ti serve un token long-lived: ora lancio
"claude setup-token", segui la procedura e poi incolla qui il token generato.
`);
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const go = (await rl.question("Generare un token adesso? [s/N] ")).trim().toLowerCase();
  if (go !== "s" && go !== "si" && go !== "sì" && go !== "y") {
    rl.close();
    console.log("Ok, userò il login locale di Claude Code.");
    return;
  }
  const res = spawnSync("claude", ["setup-token"], { stdio: "inherit" });
  if (res.error) die(`impossibile eseguire "claude setup-token": ${res.error.message}`);
  const token = (await rl.question("\nIncolla il token (invio per saltare): ")).trim();
  rl.close();
  if (!token) {
    console.log("Nessun token salvato: userò il login locale di Claude Code.");
    return;
  }
  saveConfig({ ...loadConfig(), token });
  console.log(`Token salvato in ${configDir}/config.json (permessi 600).`);
}

function cmdSet(args) {
  const { hh, mm } = parseTime(args[0]);
  const flags = parseFlags(args.slice(1));
  const tz = flags.tz || loadConfig().tz || systemTimeZone();
  if (!isValidTimeZone(tz)) die(`fuso orario non valido: "${tz}". Usa un nome IANA, es. Europe/Rome`);

  const config = { ...loadConfig(), time: `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`, tz };
  if (flags.message) config.message = flags.message;
  saveConfig(config);

  const next = nextOccurrence(hh, mm, tz);
  console.log(`Configurato: ogni giorno alle ${config.time} (${tz})`);
  console.log(`Messaggio: "${config.message || DEFAULT_MESSAGE}"`);
  console.log(`Prossimo invio: ${formatInTz(next, tz)}`);
}

async function cmdSend() {
  log("Invio del messaggio a Claude…");
  const result = await sendMessage();
  if (result.ok) {
    log(`Inviato ✓ — la finestra di sessione è partita. Risposta: ${result.detail}`);
  } else {
    die(result.detail);
  }
}

async function cmdStart() {
  const config = loadConfig();
  if (!config.time) die('nessun orario configurato. Prima esegui: bonjour-claude set HH:MM [--tz ...]');
  const { hh, mm } = parseTime(config.time);
  const tz = config.tz || systemTimeZone();
  log(`Daemon avviato: invio giornaliero alle ${config.time} (${tz}), messaggio "${config.message || DEFAULT_MESSAGE}"`);

  while (true) {
    const next = nextOccurrence(hh, mm, tz);
    log(`Prossimo invio: ${formatInTz(next, tz)}`);
    await sleepUntil(next);
    log("È ora: invio del messaggio a Claude…");
    const result = await sendMessage();
    if (result.ok) log(`Inviato ✓ — risposta: ${result.detail}`);
    else log(`ERRORE invio: ${result.detail}`);
  }
}

function cmdStatus() {
  const config = loadConfig();
  const state = loadState();
  if (!config.time) {
    console.log('Nessun orario configurato. Esegui: bonjour-claude set HH:MM [--tz ...]');
    return;
  }
  const { hh, mm } = parseTime(config.time);
  const tz = config.tz || systemTimeZone();
  console.log(`Orario:         ${config.time} (${tz}), ogni giorno`);
  console.log(`Messaggio:      "${config.message || DEFAULT_MESSAGE}"`);
  console.log(`Login:          ${config.token ? "token salvato" : "login locale di Claude Code"}`);
  console.log(`Prossimo invio: ${formatInTz(nextOccurrence(hh, mm, tz), tz)}`);
  if (state.lastSentAt) {
    console.log(`Ultimo invio:   ${formatInTz(new Date(state.lastSentAt), tz)} — ${state.ok ? "ok ✓" : `ERRORE: ${state.detail}`}`);
  } else {
    console.log("Ultimo invio:   mai");
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
    die(`comando sconosciuto: "${command}". Usa "bonjour-claude help".`);
}
