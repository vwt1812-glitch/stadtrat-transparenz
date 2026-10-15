// Schreibt Termine, Anträge, Ausschüsse und Sprechstunde direkt in index.html,
// damit die Inhalte auch ohne JavaScript und für Suchmaschinen sichtbar sind.
// Die Bereiche stehen zwischen <!-- render:NAME --> und <!-- /render:NAME -->.
//
// Aufruf: node scripts/render.mjs
process.env.TZ = "Europe/Berlin";

import fs from "node:fs/promises";
import path from "node:path";
import {
  renderCalendar, renderStatTermine, renderAntraege, renderAusschuesse, renderSprechstunde
} from "../assets/render.mjs";

const ROOT = path.join(import.meta.dirname, "..");
const INDEX = path.join(ROOT, "index.html");

async function readJSON(name) {
  try {
    return JSON.parse(await fs.readFile(path.join(ROOT, "data", name), "utf8"));
  } catch {
    return null;
  }
}

export function fillRegions(html, regions) {
  for (const [name, content] of Object.entries(regions)) {
    const re = new RegExp(`(<!-- render:${name} -->)[\\s\\S]*?(<!-- /render:${name} -->)`);
    if (!re.test(html)) throw new Error(`Bereich "${name}" fehlt in index.html`);
    html = html.replace(re, (_, open, close) => `${open}${content}${close}`);
  }
  return html;
}

async function main() {
  const [termine, antraege, gremien] = await Promise.all([
    readJSON("termine.json"), readJSON("antraege.json"), readJSON("ausschuesse.json")
  ]);
  const now = Date.now();
  const before = await fs.readFile(INDEX, "utf8");
  const after = fillRegions(before, {
    statTermine: renderStatTermine(termine, now),
    calendar: renderCalendar(termine, now),
    antraege: renderAntraege(antraege),
    ausschuesse: renderAusschuesse(gremien?.ausschuesse, termine, now),
    sprechstunde: renderSprechstunde(termine, now)
  });
  if (after !== before) await fs.writeFile(INDEX, after);
  console.log(after === before ? "index.html unverändert" : "index.html aktualisiert");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
