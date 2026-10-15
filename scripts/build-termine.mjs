// Lädt den öffentlichen Nextcloud-Kalender und schreibt die kommenden Termine
// nach data/termine.json. Läuft stündlich per GitHub Action, damit die Website
// keine fremden CORS-Proxys braucht und Besucherdaten nicht an Dritte gehen.
//
// Aufruf:  node scripts/build-termine.mjs [lokale-datei.ics]
process.env.TZ = "Europe/Berlin"; // Termine ohne Zeitzone gelten als Nürnberger Ortszeit

import fs from "node:fs/promises";
import path from "node:path";
import ICAL from "ical.js";

const CALENDAR_URL = process.env.CALENDAR_URL
  || "https://cloud.rpiblog.de/remote.php/dav/public-calendars/cRR6cHi9SMf4Gtd4?export";
const OUTPUT = path.join(import.meta.dirname, "..", "data", "termine.json");
const DAYS_AHEAD = 365;
const MAX_EVENTS = 100;
const MAX_ITERATIONS = 5000; // Schutz gegen sehr lange Serien

async function loadICS() {
  const localFile = process.argv[2];
  if (localFile) return fs.readFile(localFile, "utf8");
  const res = await fetch(CALENDAR_URL, { headers: { "User-Agent": "stadtrat-transparenz" } });
  if (!res.ok) throw new Error(`Kalender nicht erreichbar: HTTP ${res.status}`);
  return res.text();
}

function toOutput(item, start, end) {
  const isPrivate = ["PRIVATE", "CONFIDENTIAL"].includes(
    String(item.component.getFirstPropertyValue("class") || "").toUpperCase()
  );
  const allDay = start.isDate;
  const fmt = (t) => (t.isDate ? t.toString() : t.toJSDate().toISOString());
  return {
    title: isPrivate ? "Interner Termin" : (item.summary || "Termin").trim(),
    location: isPrivate ? "" : (item.location || "").trim(),
    start: fmt(start),
    end: end ? fmt(end) : null,
    allDay
  };
}

function isCancelled(item) {
  return String(item.component.getFirstPropertyValue("status") || "").toUpperCase() === "CANCELLED";
}

export function extractEvents(icsText, now = new Date()) {
  const root = new ICAL.Component(ICAL.parse(icsText));
  root.getAllSubcomponents("vtimezone").forEach((tz) => ICAL.TimezoneService.register(tz));

  const rangeStart = ICAL.Time.fromJSDate(now, true);
  const rangeEnd = ICAL.Time.fromJSDate(new Date(now.getTime() + DAYS_AHEAD * 86400000), true);
  const nowMs = now.getTime();

  // Serien-Master und Ausnahmen (RECURRENCE-ID) nach UID gruppieren.
  const masters = new Map();
  const exceptions = [];
  for (const comp of root.getAllSubcomponents("vevent")) {
    if (comp.hasProperty("recurrence-id")) exceptions.push(comp);
    else masters.set(comp.getFirstPropertyValue("uid") || Symbol("ohne-uid"), new ICAL.Event(comp));
  }
  const standalone = [];
  for (const comp of exceptions) {
    const master = masters.get(comp.getFirstPropertyValue("uid"));
    if (master) master.relateException(comp);
    else standalone.push(new ICAL.Event(comp));
  }

  const events = [];
  const endsInFuture = (start, end) => {
    const last = end || start;
    // Ganztägige Termine bleiben bis zum Ende ihres letzten Tages sichtbar.
    const lastMs = last.isDate ? last.toJSDate().getTime() + (end ? 0 : 86400000) : last.toJSDate().getTime();
    return lastMs > nowMs;
  };

  for (const event of [...masters.values(), ...standalone]) {
    if (!event.startDate) continue;
    if (!event.isRecurring()) {
      if (!isCancelled(event) && endsInFuture(event.startDate, event.endDate)
          && event.startDate.compare(rangeEnd) <= 0) {
        events.push(toOutput(event, event.startDate, event.endDate));
      }
      continue;
    }
    const iterator = event.iterator();
    for (let i = 0, next; i < MAX_ITERATIONS && (next = iterator.next()); i++) {
      if (next.compare(rangeEnd) > 0) break;
      const details = event.getOccurrenceDetails(next);
      if (details.endDate.compare(rangeStart) < 0) continue;
      if (isCancelled(details.item) || !endsInFuture(details.startDate, details.endDate)) continue;
      events.push(toOutput(details.item, details.startDate, details.endDate));
    }
  }

  const seen = new Set();
  return events
    .filter((e) => {
      const key = `${e.start}|${e.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => new Date(a.start) - new Date(b.start))
    .slice(0, MAX_EVENTS);
}

async function main() {
  const events = extractEvents(await loadICS());
  let previous = null;
  try { previous = JSON.parse(await fs.readFile(OUTPUT, "utf8")); } catch {}

  // Zeitstempel nur ändern, wenn sich die Termine geändert haben – so entstehen keine leeren Commits.
  const unchanged = previous && JSON.stringify(previous.events) === JSON.stringify(events);
  const output = {
    updated: unchanged ? previous.updated : new Date().toISOString(),
    events
  };
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  await fs.writeFile(OUTPUT, JSON.stringify(output, null, 2) + "\n");
  console.log(`${events.length} Termine ${unchanged ? "(unverändert)" : "geschrieben"} → ${OUTPUT}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
