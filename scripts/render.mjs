// Schreibt Termine, Anträge, Ausschüsse und Sprechstunde direkt in index.html,
// damit die Inhalte auch ohne JavaScript und für Suchmaschinen sichtbar sind.
// Die Bereiche stehen zwischen <!-- render:NAME --> und <!-- /render:NAME -->.
//
// Aufruf: node scripts/render.mjs
process.env.TZ = "Europe/Berlin";

import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import {
  renderCalendar, renderAntraege, renderAusschuesse, renderSprechstunde, renderUeberblick, renderBudget
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

// Hängt an CSS/JS-Verweise eine Versionsnummer aus dem Dateiinhalt (?v=…),
// damit Browser nach einer Änderung nie eine alte, zwischengespeicherte Datei verwenden.
const hash = (text) => createHash("sha1").update(text).digest("hex").slice(0, 10);

export function setVersion(text, file, version) {
  const name = file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return text.replace(new RegExp(`(["'(]\\.?\\/?(?:assets\\/)?${name})(?:\\?v=[\\w]+)?(["')])`, "g"), `$1?v=${version}$2`);
}

async function updateFile(file, transform) {
  const before = await fs.readFile(file, "utf8");
  const after = transform(before);
  if (after !== before) await fs.writeFile(file, after);
  return after !== before;
}

async function versionAssets() {
  const asset = (name) => path.join(ROOT, "assets", name);
  // render.mjs wird von app.mjs importiert – erst diesen Verweis aktualisieren, dann app.mjs versionieren
  const renderVersion = hash(await fs.readFile(asset("render.mjs"), "utf8"));
  let changed = await updateFile(asset("app.mjs"), (t) => setVersion(t, "render.mjs", renderVersion));
  const versions = {};
  for (const name of ["style.css", "app.mjs", "legal.css"]) versions[name] = hash(await fs.readFile(asset(name), "utf8"));
  for (const page of ["index.html", "impressum.html", "datenschutz.html"]) {
    changed = await updateFile(path.join(ROOT, page), (t) =>
      Object.entries(versions).reduce((acc, [name, v]) => setVersion(acc, name, v), t)) || changed;
  }
  return changed;
}

async function main() {
  const assetsChanged = await versionAssets();
  const [termine, antraege, gremien, budget] = await Promise.all([
    readJSON("termine.json"), readJSON("antraege.json"), readJSON("ausschuesse.json"), readJSON("budget.json")
  ]);
  const now = Date.now();
  const before = await fs.readFile(INDEX, "utf8");
  const after = fillRegions(before, {
    ueberblick: renderUeberblick({ termine, antraege, gremien, budget }, now),
    budget: renderBudget(budget),
    calendar: renderCalendar(termine, now),
    antraege: renderAntraege(antraege),
    ausschuesse: renderAusschuesse(gremien?.ausschuesse, termine, now),
    sprechstunde: renderSprechstunde(termine, now)
  });
  if (after !== before) await fs.writeFile(INDEX, after);
  console.log(after === before ? "index.html unverändert" : "index.html aktualisiert");
  if (assetsChanged) console.log("Versionsnummern von CSS/JS aktualisiert");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
