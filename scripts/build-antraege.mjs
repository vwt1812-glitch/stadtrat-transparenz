// Gleicht data/antraege.json mit dem Ratsinformationssystem ab:
// - neue Anträge von PIRATEN & Humanisten werden ergänzt (Status „offen“, Texte leer)
// - zu allen Anträgen werden Beratungen und Beschlüsse aus dem RIS nachgetragen
// Von Hand gepflegte Felder (Titel, Zusammenfassung, Ergebnis, Status, Links) bleiben unverändert.
//
// Aufruf: node scripts/build-antraege.mjs
import fs from "node:fs/promises";
import path from "node:path";
import { RIS_BASE, fetchRIS, parseAntrag, parseBeratungen, parseBeschluss, mitAntragsteller, istUnserAntrag } from "./ris.mjs";

const FILE = path.join(import.meta.dirname, "..", "data", "antraege.json");
const LOOKBACK = 25;     // bereits geprüfte Nummern erneut ansehen (Freigabe kommt manchmal verspätet)
const MAX_MISSES = 30;   // nach so vielen leeren Nummern hintereinander aufhören
const START_KAGNR = 2150; // erste Antragsnummer der Wahlperiode 2026–2032 (ungefähr)

const kagnrAus = (antrag) => antrag.kagnr
  || (antrag.links || []).map((l) => l.url?.match(/ag0050\.asp\?__kagnr=(\d+)/)?.[1]).find(Boolean);

const datumWert = (d) => {
  const m = String(d || "").match(/(\d{2})\.(\d{2})\.(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};

async function beratungenFuer(vorlagen) {
  const result = [];
  for (const kvonr of vorlagen) {
    for (const b of parseBeratungen(await fetchRIS(`vo0053.asp?__kvonr=${kvonr}`))) {
      const eintrag = { datum: b.datum, gremium: b.gremium, top: b.top };
      if (b.ktonr) {
        Object.assign(eintrag, parseBeschluss(await fetchRIS(`to0050.asp?__ktonr=${b.ktonr}`)));
        eintrag.url = `${RIS_BASE}to0050.asp?__ktonr=${b.ktonr}`;
      }
      result.push(eintrag);
    }
  }
  return result;
}

async function main() {
  const data = JSON.parse(await fs.readFile(FILE, "utf8"));
  const before = JSON.stringify(data);
  const liste = data.antraege;
  liste.forEach((a) => { const k = kagnrAus(a); if (k) a.kagnr = k; });

  // 1) Neue Nummern absuchen
  const bekannt = liste.map((a) => Number(a.kagnr)).filter(Boolean);
  let letzte = Math.max(data.ris?.letzte_kagnr || 0, ...bekannt, START_KAGNR);
  let nr = letzte - LOOKBACK;
  const gefunden = new Map();
  for (let misses = 0; misses < MAX_MISSES; nr++) {
    const antrag = parseAntrag(await fetchRIS(`ag0050.asp?__kagnr=${nr}`), nr);
    if (!antrag) { if (nr > letzte) misses++; continue; }
    misses = 0;
    letzte = Math.max(letzte, nr);
    if (istUnserAntrag(antrag)) gefunden.set(antrag.nummer, antrag);
  }
  data.ris = { ...data.ris, letzte_kagnr: letzte };

  for (const antrag of gefunden.values()) {
    if (liste.some((a) => a.nummer === antrag.nummer)) continue;
    console.log(`Neuer Antrag: ${antrag.nummer} ${antrag.betreff}`);
    liste.push({
      nummer: antrag.nummer,
      kagnr: antrag.kagnr,
      titel: antrag.betreff,
      art: "Antrag",
      ...(mitAntragsteller(antrag.hier) ? { mit: mitAntragsteller(antrag.hier) } : {}),
      datum: antrag.datum,
      gremium: antrag.gremium,
      status: "offen",
      zusammenfassung: "",
      ergebnis: "",
      links: [{ label: "Antrag im Ratsinformationssystem", url: `${RIS_BASE}ag0050.asp?__kagnr=${antrag.kagnr}` }],
      neu: true
    });
  }

  // 2) Beratungen und Beschlüsse für alle Anträge aktualisieren
  for (const a of liste) {
    if (!a.kagnr) continue;
    const antrag = gefunden.get(a.nummer) || parseAntrag(await fetchRIS(`ag0050.asp?__kagnr=${a.kagnr}`), a.kagnr);
    if (!antrag?.vorlagen.length) continue;
    const beratungen = await beratungenFuer(antrag.vorlagen);
    if (beratungen.length) a.beratungen = beratungen;
  }

  liste.sort((x, y) => datumWert(y.datum).localeCompare(datumWert(x.datum)));
  if (JSON.stringify(data) === before) {
    console.log(`Keine Änderungen (geprüft bis Nummer ${letzte}).`);
    return;
  }
  data.stand = new Date().toISOString().slice(0, 10);
  await fs.writeFile(FILE, JSON.stringify(data, null, 2) + "\n");
  console.log(`data/antraege.json aktualisiert (${liste.length} Anträge, geprüft bis Nummer ${letzte}).`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
