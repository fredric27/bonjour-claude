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

// Wall-clock time of an instant in the given timezone.
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

// Offset (ms) of the timezone relative to UTC at the given instant.
function tzOffsetMs(date, tz) {
  const w = wallClock(date, tz);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute, w.second);
  return asUtc - Math.floor(date.getTime() / 1000) * 1000;
}

// UTC instant matching the wall-clock y-m-d hh:mm in the given timezone.
// The offset depends on the instant itself (DST), so iterate to converge.
function utcInstantFor(year, month, day, hh, mm, tz) {
  const asUtc = Date.UTC(year, month - 1, day, hh, mm, 0);
  let ts = asUtc;
  for (let i = 0; i < 2; i++) {
    ts = asUtc - tzOffsetMs(new Date(ts), tz);
  }
  return new Date(ts);
}

// Next instant (UTC Date) at which the clock in timezone `tz` reads hh:mm.
export function nextOccurrence(hh, mm, tz, now = new Date()) {
  for (let k = 0; k < 3; k++) {
    const ref = new Date(now.getTime() + k * DAY_MS);
    const w = wallClock(ref, tz);
    const candidate = utcInstantFor(w.year, w.month, w.day, hh, mm, tz);
    if (candidate.getTime() > now.getTime()) return candidate;
  }
  throw new Error(`Cannot compute the next occurrence of ${hh}:${mm} in ${tz}`);
}

export function formatInTz(date, tz) {
  return date.toLocaleString("en-GB", {
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

// Waits until the given instant. Wakes up at least once an hour and re-checks
// the clock, so machine suspends or timer drift don't throw it off.
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
