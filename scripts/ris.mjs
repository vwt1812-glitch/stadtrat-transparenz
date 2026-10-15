// Liest Anträge und Beschlüsse aus dem Ratsinformationssystem (SessionNet) der Stadt Nürnberg.
// Die Parser arbeiten auf dem HTML der Seiten ag0050 (Antrag), vo0053 (Beratungen einer Vorlage)
// und to0050 (Tagesordnungspunkt mit Beschluss). Testdaten liegen in test/fixtures/ris/.

export const RIS_BASE = "https://online-service2.nuernberg.de/buergerinfo/";

const NAMED = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", auml: "ä", ouml: "ö", uuml: "ü", Auml: "Ä", Ouml: "Ö", Uuml: "Ü", szlig: "ß", eacute: "é", ndash: "–", mdash: "—" };

export function decodeEntities(s) {
  return String(s ?? "")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, name) => NAMED[name] ?? m);
}

function clean(html) {
  return decodeEntities(String(html ?? "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " "))
    .split("\n").map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}

function cell(html, cls) {
  const m = html.match(new RegExp(`<div class="smc-table-cell ${cls}">([\\s\\S]*?)</div>`));
  return m ? m[1] : null;
}

// Antragsseite ag0050.asp?__kagnr=…  →  null, wenn es den Antrag nicht gibt
export function parseAntrag(html, kagnr) {
  const nummer = clean(cell(html, "agname"));
  if (!nummer || !/^AN\/\d+\/\d{4}$/.test(nummer)) return null;
  const h1 = html.match(/<h1 class="smc_h1">([\s\S]*?)<\/h1>/);
  const [betreff, ...rest] = clean(h1?.[1]).split("\n");
  const hier = rest.join(" ").replace(/^hier:\s*/i, "");
  // Vorlagen stehen in der Datentabelle („Antrag für“, „Antrag zu Vorlage kopiert“), vor den Dokumenten
  const start = html.indexOf("smc_page_ag0050_contenttable1");
  const end = html.indexOf("smc-documents", start);
  const table = start < 0 ? "" : html.slice(start, end < 0 ? undefined : end);
  const vorlagen = [...new Set([...table.matchAll(/vo0050\.asp\?__kvonr=(\d+)/g)].map((m) => m[1]))];
  return {
    kagnr: String(kagnr),
    nummer,
    betreff: betreff || "",
    hier,
    datum: clean(cell(html, "agvdat")) || "",
    gremium: clean(cell(html, "grname")) || "",
    vorlagen
  };
}

// Beratungsfolge einer Vorlage: vo0053.asp?__kvonr=…
export function parseBeratungen(html) {
  const out = [];
  const blocks = html.split(/<div id="smcpanel\d+"/).slice(1);
  for (const block of blocks) {
    const head = clean(block.match(/<button[^>]*>([\s\S]*?)<\/button>/)?.[1]).replace(/\s*\d+ Dok\.$/, "");
    const m = head.match(/^(\d{2}\.\d{2}\.\d{4})\s+(.+?)\s+TOP\s+([\w.]+)/);
    const top = block.match(/to0050\.asp\?__ktonr=(\d+)/)?.[1] || null;
    if (m) out.push({ datum: m[1], gremium: m[2], top: m[3], ktonr: top });
  }
  return out;
}

// Tagesordnungspunkt: to0050.asp?__ktonr=…
export function parseBeschluss(html) {
  const field = (name) => clean(html.match(new RegExp(`<p class="smc_field_${name}">([\\s\\S]*?)</p>`))?.[1])
    .replace(/^[^:]+:\s*/, "");
  return { beschluss: field("btname") || "", abstimmung: field("toabst") || "" };
}

// Wer hat den Antrag mitgestellt? Aus „hier: gemeinsamer Antrag der X, Y und Z vom …“
const PH = /PIRATEN\s*(?:und|&)\s*HUMANISTEN(?:\s*e\.\s*V\.)?|Humanisten[\s-]*Piraten/gi;
export function mitAntragsteller(hier) {
  const m = String(hier).match(/Antrag (?:der|von)\s+(.+?)\s+vom\s+[\d.]+/i);
  if (!m || !PH.test(m[1])) return "";
  PH.lastIndex = 0;
  const parts = m[1].replace(PH, "§").split(/\s*,\s*|\s+und\s+|\/|\s+-\s+/)
    .map((p) => p.replace(/^(Stadtratsfraktion|Stadtratsgruppe)\s+/i, "").trim())
    .filter((p) => p && p !== "§");
  if (!parts.length) return "";
  return parts.length === 1 ? parts[0] : parts.slice(0, -1).join(", ") + " und " + parts.at(-1);
}

export function istUnserAntrag(antrag) {
  return /pirat|humanist|küffner/i.test(`${antrag.betreff} ${antrag.hier}`);
}

/* ---------- Abruf ---------- */

export async function fetchRIS(path, { retries = 2 } = {}) {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(RIS_BASE + path, {
        headers: { "User-Agent": "stadtrat-transparenz (https://github.com/vwt1812-glitch/stadtrat-transparenz)", "Accept-Language": "de-DE,de" },
        signal: AbortSignal.timeout(60000)
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} für ${path}`);
      return await res.text();
    } catch (error) {
      if (attempt >= retries) throw error;
      await new Promise((r) => setTimeout(r, 2000 * (attempt + 1)));
    }
  }
}
