// Tests für den Parser des Ratsinformationssystems und das Rendern. Aufruf: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { parseAntrag, parseBeratungen, parseBeschluss, mitAntragsteller, istUnserAntrag, decodeEntities } from "../scripts/ris.mjs";
import { renderAntraege, renderAusschuesse, renderUeberblick, renderBudget, groupOf } from "../assets/render.mjs";
import { fillRegions } from "../scripts/render.mjs";

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, "fixtures/ris", name), "utf8");

test("Antrag allein von PIRATEN & Humanisten", () => {
  const a = parseAntrag(fixture("ag0050_2368.html"), 2368);
  assert.equal(a.nummer, "AN/198/2026");
  assert.equal(a.betreff, "Nachtflugverbot Flughafen Nürnberg");
  assert.equal(a.hier, "Antrag der Piraten und Humanisten e.V. vom 11.09.2026");
  assert.equal(a.datum, "11.09.2026");
  assert.deepEqual(a.vorlagen, []);
  assert.ok(istUnserAntrag(a));
  assert.equal(mitAntragsteller(a.hier), "");
});

test("Gemeinsamer Antrag mit Vorlage", () => {
  const a = parseAntrag(fixture("ag0050_2304.html"), 2304);
  assert.equal(a.nummer, "AN/134/2026");
  assert.equal(a.gremium, "Stadtrat");
  assert.deepEqual(a.vorlagen, ["30260"]);
  assert.equal(mitAntragsteller(a.hier), "Die Linke, Ökologische Fraktion, politbande und Tierschutzpartei");
});

test("Antrag zu Vorlage kopiert", () => {
  const a = parseAntrag(fixture("ag0050_2267.html"), 2267);
  assert.equal(a.nummer, "AN/097/2026");
  assert.equal(a.gremium, "Jugendhilfeausschuss");
  assert.deepEqual(a.vorlagen, ["30220"]);
  assert.equal(mitAntragsteller(a.hier), "politbande, Tierschutzpartei und Linke Liste");
});

test("Bunte AG mit PIRATEN & Humanisten vorne", () => {
  const a = parseAntrag(fixture("ag0050_2263.html"), 2263);
  assert.equal(mitAntragsteller(a.hier), "politbande, Tierschutzpartei und Linke Liste");
});

test("Fremde Anträge werden nicht übernommen", () => {
  assert.equal(istUnserAntrag(parseAntrag(fixture("ag0050_2356.html"), 2356)), false);
  assert.equal(istUnserAntrag(parseAntrag(fixture("ag0050_2100.html"), 2100)), false);
});

test("Beratungsfolge einer Vorlage", () => {
  assert.deepEqual(parseBeratungen(fixture("vo0053_30260.html")),
    [{ datum: "22.07.2026", gremium: "Stadtrat", top: "13", ktonr: "106943" }]);
  assert.deepEqual(parseBeratungen(fixture("vo0053_30281.html")),
    [{ datum: "22.07.2026", gremium: "Stadtrat", top: "13.2", ktonr: "107019" }]);
  const jha = parseBeratungen(fixture("vo0053_30220.html"));
  assert.equal(jha[0].datum, "16.07.2026");
  assert.equal(jha[0].ktonr, null);
});

test("Beschluss und Abstimmung", () => {
  assert.deepEqual(parseBeschluss(fixture("to0050_106943.html")),
    { beschluss: "Mehrheitlich beschlossen", abstimmung: "Ja: 52, Nein: 12, Anwesend: 64" });
  assert.deepEqual(parseBeschluss(fixture("to0050_107019.html")),
    { beschluss: "Mehrheitlich abgelehnt", abstimmung: "" });
  assert.equal(parseBeschluss(fixture("to0050_106561.html")).beschluss, "Der Bericht dient der Kenntnis");
});

test("HTML-Entities", () => {
  assert.equal(decodeEntities("N&#252;rnberg &amp; F&uuml;rth"), "Nürnberg & Fürth");
});

test("Antragsliste: Bilanz, Filter, Escaping", () => {
  const html = renderAntraege({ antraege: [
    { titel: "<script>", status: "offen" },
    { titel: "B", status: "nicht_uebernommen" },
    { titel: "C", status: "unbekannt" }
  ] });
  assert.ok(html.includes("&lt;script&gt;"));
  assert.ok(html.includes("3 Anträge"));
  assert.ok(html.includes('data-filter="abgelehnt"'));
  assert.equal(groupOf({ status: "unbekannt" }), "offen");
});

test("Ausschuss findet nächste Sitzung, aber keine Besichtigung", () => {
  const termine = { events: [
    { title: "Besichtigungstour SUN", start: "2099-01-01T10:00:00.000Z", end: "2099-01-01T11:00:00.000Z" },
    { title: "Sitzung des Werkausschusses Stadtentwässerung und Umweltanalytik Nürnberg SUN", start: "2099-02-01T10:00:00.000Z", end: "2099-02-01T11:00:00.000Z" }
  ] };
  const html = renderAusschuesse([{ name: "SUN", art: "Werkausschuss", beschreibung: "", muster: "^Sitzung des Werkausschusses Stadtentwässerung" }], termine, Date.parse("2098-01-01"));
  assert.match(html, /Nächste Sitzung<\/span>[^<]*01\. Feb/);
  assert.doesNotMatch(html, /Jan/);
});

test("Auf einen Blick und Budget", () => {
  const now = Date.parse("2098-01-01");
  const termine = { events: [{ title: "Sitzung der Sportkommission", start: "2098-01-10T10:00:00.000Z", end: "2098-01-10T11:00:00.000Z" }] };
  const antraege = { antraege: [{ titel: "Neuer Antrag", status: "offen" }, { titel: "Alt", status: "abgelehnt" }] };
  const gremien = { ausschuesse: [{ name: "Sportkommission", art: "Kommission", muster: "Sportkommission" }, { name: "Bau", art: "Ausschuss" }] };
  const budget = { stand: "Januar 2098", anspruch_monat: 1050, seit: "Mai 2026", ausgezahlt: 0, ausgegeben: 1234.5 };
  const html = renderUeberblick({ termine, antraege, gremien, budget }, now);
  assert.match(html, /<strong>1<\/strong><span class="glance-label">Termine in den nächsten 30 Tagen/);
  assert.match(html, /<strong>2<\/strong><span class="glance-label">Anträge seit Mai 2026/);
  assert.match(html, /Neuester: Neuer Antrag – Offen/);
  assert.match(html, /<strong>1 \+ 1<\/strong>/);
  assert.match(html, /Nächste Sitzung: Sportkommission/);
  assert.match(html, /1\.050 €/);
  const karte = renderBudget(budget);
  assert.match(karte, /Bisher ausgegeben: 1\.234,5 €/);
  assert.match(karte, /bisher keine Auszahlung/);
});

test("Bereiche in index.html ersetzen", () => {
  const out = fillRegions("a<!-- render:x -->alt<!-- /render:x -->b", { x: "neu" });
  assert.equal(out, "a<!-- render:x -->neu<!-- /render:x -->b");
  assert.throws(() => fillRegions("ohne", { x: "neu" }));
});

test("Versionsnummern an CSS/JS", async () => {
  const { setVersion } = await import("../scripts/render.mjs");
  assert.equal(setVersion('<link href="assets/style.css?v=alt" />', "style.css", "neu"), '<link href="assets/style.css?v=neu" />');
  assert.equal(setVersion('} from "./render.mjs";', "render.mjs", "neu"), '} from "./render.mjs?v=neu";');
  assert.equal(setVersion('src="assets/app.mjs"', "style.css", "neu"), 'src="assets/app.mjs"');
});
