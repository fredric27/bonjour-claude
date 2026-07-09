const DAY_MS = 24 * 60 * 60 * 1000;

export function isValidTimeZone(tz) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function systemTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

// Ora "da orologio a muro" di un istante nel fuso indicato.
function wallClock(date, tz) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = {};
  for (const p of fmt.formatToParts(date)) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  if (parts.hour === 24) parts.hour = 0;
  return parts;
}

// Offset (ms) del fuso rispetto a UTC nell'istante dato.
function tzOffsetMs(date, tz) {
  const w = wallClock(date, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// Istante UTC corrispondente al wall-clock y-m-d hh:mm nel fuso indicato.
// L'offset dipende dall'istante stesso (DST), quindi si itera per convergere.
function utcInstantFor(year, month, day, hh, mm, tz) {
  const asUtc = Date.UTC(year, month - 1, day, hh, mm, 0);
  let ts = asUtc;
  for (let i = 0; i < 2; i++) {
    ts = asUtc - tzOffsetMs(new Date(ts), tz);
  }
  return new Date(ts);
}

// Prossimo istante (Date UTC) in cui nel fuso `tz` l'orologio segna hh:mm.
export function nextOccurrence(hh, mm, tz, now = new Date()) {
  for (let k = 0; k < 3; k++) {
    const ref = new Date(now.getTime() + k * DAY_MS);
    const w = wallClock(ref, tz);
    const candidate = utcInstantFor(w.year, w.month, w.day, hh, mm, tz);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  throw new Error(`Impossibile calcolare la prossima occorrenza di ${hh}:${mm} in ${tz}`);
}

export function formatInTz(date, tz) {
  return date.toLocaleString("it-IT", {
    timeZone: tz,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

// Attende fino all'istante dato. Si risveglia almeno ogni ora e ricontrolla
// l'orologio, così sospensioni della macchina o derive del timer non sfasano.
export function sleepUntil(date) {
  return new Promise((resolve) => {
    const tick = () => {
      const remaining = date.getTime() - Date.now();
      if (remaining <= 0) return resolve();
      setTimeout(tick, Math.min(remaining, 60 * 60 * 1000));
    };
    tick();
  });
}
