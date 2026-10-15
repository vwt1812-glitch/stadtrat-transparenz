// Erzeugt das HTML für Termine, Anträge, Ausschüsse und Sprechstunde.
// Wird im Browser (assets/app.mjs) und beim Vorab-Rendern (scripts/render.mjs) verwendet,
// damit die Inhalte auch ohne JavaScript und für Suchmaschinen im HTML stehen.

export const TZ = "Europe/Berlin";
export const VISIBLE_EVENTS = 5;
const DAY = 86400000;

export function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

/* ---------- Termine ---------- */

// Ganztägige Termine kommen als "YYYY-MM-DD", alle anderen als ISO-Zeitpunkt.
export function toDate(value, allDay) {
  return allDay ? new Date(value + "T00:00:00") : new Date(value);
}

function formatDay(date, allDay) {
  return date.toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "short", timeZone: allDay ? undefined : TZ });
}

function formatTime(date) {
  return date.toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit", timeZone: TZ });
}

function hasEnded(e, now) {
  const end = e.end ? toDate(e.end, e.allDay) : toDate(e.start, e.allDay);
  return (e.allDay && !e.end ? end.getTime() + DAY : end.getTime()) <= now;
}

export function upcomingEvents(data, now = Date.now()) {
  return (data?.events || []).filter((e) => !hasEnded(e, now));
}

export function eventsWithinDays(events, days, now = Date.now()) {
  return events.filter((e) => toDate(e.start, e.allDay).getTime() <= now + days * DAY);
}

export function formatWhen(e) {
  const start = toDate(e.start, e.allDay);
  const end = e.end ? toDate(e.end, e.allDay) : null;
  if (e.allDay) {
    const lastDay = end ? new Date(end.getTime() - DAY) : start;
    return lastDay > start ? "bis " + formatDay(lastDay, true) : "ganztägig";
  }
  let when = formatTime(start);
  if (end) {
    when += formatDay(end) === formatDay(start)
      ? "–" + formatTime(end)
      : " – " + formatDay(end) + " " + formatTime(end);
  }
  return when;
}

function formatEvent(e) {
  const location = e.location ? escapeHTML(e.location) : "Ort folgt";
  return `<div class="event">
        <div class="event-date">${formatDay(toDate(e.start, e.allDay), e.allDay)}<small>${formatWhen(e)}</small></div>
        <div><div class="event-title">${escapeHTML(e.title)}</div><div class="event-meta">📍 ${location}</div></div>
      </div>`;
}

export function formatUpdated(iso) {
  if (!iso) return "";
  return "Stand: " + new Date(iso).toLocaleString("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ
  }) + " Uhr";
}

// Kompletter Inhalt der Terminkarte unterhalb der Überschrift.
export function renderCalendar(data, now = Date.now()) {
  const events = upcomingEvents(data, now);
  const status = data
    ? (events.length ? "" : "Aktuell sind keine Termine eingetragen.")
    : "Die Termine können gerade nicht angezeigt werden. Bitte später noch einmal versuchen.";
  return `<div id="calendarStatus" class="notice"${status ? "" : " hidden"}>${status}</div>
            <input id="calendarExpand" class="calendar-expand-checkbox" type="checkbox" />
            <div id="calendarEvents" class="calendar-list">${events.map(formatEvent).join("")}</div>
            <label for="calendarExpand" class="btn calendar-toggle"${events.length > VISIBLE_EVENTS ? "" : " hidden"}><span class="more">Alle Termine anzeigen</span><span class="less">Weniger Termine anzeigen</span></label>
            <div class="calendar-footer">
              <small id="calendarUpdated">${escapeHTML(formatUpdated(data?.updated))}</small>
            </div>`;
}


/* ---------- Geld ---------- */

export function formatEuro(value) {
  return Number(value || 0).toLocaleString("de-DE", { maximumFractionDigits: 2 }) + " €";
}

export function renderBudget(budget) {
  if (!budget) return `<div class="notice">Der Stand des Arbeitsbudgets kann gerade nicht angezeigt werden.</div>`;
  const ausgaben = (budget.ausgaben || []).map((x) =>
    `<div class="row"><div><b>${escapeHTML(x.zweck)}</b><span>${escapeHTML(x.datum)}</span></div><strong>${escapeHTML(formatEuro(x.betrag))}</strong></div>`).join("");
  return `<span class="tag">Stand Arbeitsbudget · ${escapeHTML(budget.stand)}</span>
            <h3>Bisher ausgegeben: ${escapeHTML(formatEuro(budget.ausgegeben))}</h3>
            ${budget.text ? `<p>${escapeHTML(budget.text)}</p>` : ""}
            <div class="list">
              <div class="row"><div><b>Anspruch</b><span>monatlich seit ${escapeHTML(budget.seit)}</span></div><strong>${escapeHTML(formatEuro(budget.anspruch_monat))}</strong></div>
              <div class="row"><div><b>Ausgezahlt</b><span>${budget.ausgezahlt ? `seit ${escapeHTML(budget.seit)}` : "bisher keine Auszahlung"}</span></div><strong>${escapeHTML(formatEuro(budget.ausgezahlt))}</strong></div>
              <div class="row"><div><b>Ausgegeben</b><span>seit ${escapeHTML(budget.seit)}</span></div><strong>${escapeHTML(formatEuro(budget.ausgegeben))}</strong></div>
              ${budget.geplant ? `<div class="row"><div><b>Geplant</b><span>${escapeHTML(budget.geplant)}</span></div><strong>offen</strong></div>` : ""}
              ${ausgaben}
            </div>`;
}

/* ---------- Auf einen Blick ---------- */

function firstLine(text, max = 70) {
  const line = String(text || "").split("\n")[0].trim();
  return line.length > max ? line.slice(0, max - 1).trimEnd() + "…" : line;
}

function glance(href, icon, zahl, label, sub) {
  return `<a class="glance" href="${href}">
            <span class="glance-icon" aria-hidden="true">${icon}</span>
            <span class="glance-text"><strong>${escapeHTML(zahl)}</strong><span class="glance-label">${escapeHTML(label)}</span>${sub ? `<span class="glance-sub">${sub}</span>` : ""}</span>
          </a>`;
}

export function renderUeberblick({ termine, antraege, gremien, budget }, now = Date.now()) {
  const events = upcomingEvents(termine, now);
  const next = events[0];
  const liste = antraege?.antraege || [];
  const neuester = liste[0];
  const gremienListe = gremien?.ausschuesse || [];
  const anzahlAusschuesse = gremienListe.filter((g) => /ausschuss/i.test(g.art)).length;
  const anzahlKommissionen = gremienListe.length - anzahlAusschuesse;
  const naechsteSitzung = gremienListe
    .map((g) => ({ g, e: nextSessionFor(g, events) })).filter((x) => x.e)
    .sort((x, y) => toDate(x.e.start, x.e.allDay) - toDate(y.e.start, y.e.allDay))[0];

  return [
    glance("#termine", "📅", termine ? String(eventsWithinDays(events, 30, now).length) : "–", "Termine in den nächsten 30 Tagen",
      next ? `Nächster: ${escapeHTML(firstLine(next.title, 48))} · ${escapeHTML(formatDay(toDate(next.start, next.allDay), next.allDay))}` : ""),
    glance("#antraege", "📝", String(liste.length), `${liste.length === 1 ? "Antrag" : "Anträge"} seit Mai 2026`,
      neuester ? `Neuester: ${escapeHTML(firstLine(neuester.titel, 48))} – ${escapeHTML(STATUS_LABELS[statusOf(neuester)])}` : ""),
    glance("#ausschuesse", "🏛", anzahlKommissionen ? `${anzahlAusschuesse} + ${anzahlKommissionen}` : String(anzahlAusschuesse),
      anzahlKommissionen ? "Ausschüsse + Kommission" : "Ausschüsse",
      naechsteSitzung ? `Nächste Sitzung: ${escapeHTML(naechsteSitzung.g.name)} · ${escapeHTML(formatDay(toDate(naechsteSitzung.e.start, naechsteSitzung.e.allDay), naechsteSitzung.e.allDay))}` : ""),
    glance("#transparenz", "€", budget ? formatEuro(budget.anspruch_monat) : "–", "Arbeitsbudget pro Monat",
      budget ? `Bisher ausgegeben: ${escapeHTML(formatEuro(budget.ausgegeben))}` : "")
  ].join("\n          ");
}

/* ---------- Sprechstunde ---------- */

export function renderSprechstunde(data, now = Date.now()) {
  const next = upcomingEvents(data, now).find((e) => /sprechstunde/i.test(e.title));
  if (!next) {
    return `<p>Gerade ist keine Bürgersprechstunde eingetragen. Schreib mir oder ruf an – dann finden wir einen Termin.</p>`;
  }
  const day = toDate(next.start, next.allDay).toLocaleDateString("de-DE", {
    weekday: "long", day: "numeric", month: "long", timeZone: next.allDay ? undefined : TZ
  });
  return `<p><b>Nächste Bürgersprechstunde:</b> ${escapeHTML(day)}, ${escapeHTML(formatWhen(next))}${next.location ? ` · ${escapeHTML(next.location)}` : ""}</p>`;
}

/* ---------- Ausschüsse ---------- */

function nextSessionFor(gremium, events) {
  const pattern = gremium.muster ? new RegExp(gremium.muster, "i") : null;
  return pattern ? events.find((e) => pattern.test(e.title)) : null;
}

function shortDay(e) {
  return `${formatDay(toDate(e.start, e.allDay), e.allDay)}, ${formatWhen(e)}`;
}

// Kompakte Liste: Name und nächste Sitzung, Beschreibung und Link zum Aufklappen
export function renderAusschuesse(ausschuesse, termine, now = Date.now()) {
  const events = upcomingEvents(termine, now);
  return (ausschuesse || []).map((a) => {
    const next = nextSessionFor(a, events);
    const link = /^https:\/\//.test(a.ris || "")
      ? `<a class="text-link" href="${escapeHTML(a.ris)}" target="_blank" rel="noopener">Sitzungen im Ratsinformationssystem ↗</a>`
      : "";
    return `<details class="row-item committee-row">
            <summary>
              <span class="row-main"><span class="row-kicker">${escapeHTML(a.art)}</span><span class="row-title">${escapeHTML(a.name)}</span></span>
              <span class="row-side">${next ? `<span class="row-side-label">Nächste Sitzung</span>${escapeHTML(shortDay(next))}` : `<span class="row-side-label">Nächste Sitzung</span>noch nicht im Kalender`}</span>
            </summary>
            <div class="row-body"><p>${escapeHTML(a.beschreibung)}</p>${link}</div>
          </details>`;
  }).join("\n          ");
}

/* ---------- Anträge ---------- */

export const STATUS_LABELS = {
  offen: "Offen", angenommen: "Angenommen", teilweise: "Teilweise angenommen",
  abgelehnt: "Abgelehnt", gescheitert: "Gescheitert", nicht_uebernommen: "Nicht übernommen",
  bericht: "Bericht der Verwaltung", zurueckgezogen: "Zurückgezogen", beantwortet: "Beantwortet"
};

// Statusgruppen für Filter und Bilanz
export const STATUS_GROUPS = [
  { key: "offen", label: "Offen", bilanz: "offen", status: ["offen"] },
  { key: "angenommen", label: "Angenommen", bilanz: "angenommen", status: ["angenommen", "teilweise", "beantwortet"] },
  { key: "bericht", label: "Bericht der Verwaltung", bilanz: "mit Bericht der Verwaltung", status: ["bericht"] },
  { key: "abgelehnt", label: "Abgelehnt", bilanz: "abgelehnt oder nicht übernommen", status: ["abgelehnt", "gescheitert", "nicht_uebernommen", "zurueckgezogen"] }
];

function statusOf(a) {
  return STATUS_LABELS[a.status] ? a.status : "offen";
}

export function groupOf(a) {
  const s = statusOf(a);
  return STATUS_GROUPS.find((g) => g.status.includes(s)).key;
}

function formatBeratung(b) {
  const parts = [b.datum, b.gremium].filter(Boolean).map(escapeHTML).join(" · ");
  const ergebnis = [b.beschluss, b.abstimmung].filter(Boolean).map(escapeHTML).join(" – ");
  const text = `${parts}${ergebnis ? `: ${ergebnis}` : ""}`;
  return /^https:\/\//.test(b.url || "")
    ? `<li><a class="text-link" href="${escapeHTML(b.url)}" target="_blank" rel="noopener">${text}</a></li>`
    : `<li>${text}</li>`;
}

function formatAntrag(a) {
  const status = statusOf(a);
  const meta = [a.nummer, a.datum].filter(Boolean).map(escapeHTML).join(" · ");
  const details = [a.art, a.gremium].filter(Boolean).map(escapeHTML).join(" · ");
  const links = (a.links || [])
    .filter((l) => /^https:\/\//.test(l.url))
    .map((l) => `<a class="text-link" href="${escapeHTML(l.url)}" target="_blank" rel="noopener">${escapeHTML(l.label)} ↗</a>`)
    .join("");
  // Beratungen aus dem Ratsinformationssystem nur zeigen, solange kein eigenes Ergebnis eingetragen ist
  const beratungen = !a.ergebnis && a.beratungen?.length
    ? `<div class="antrag-beratungen"><b>Laut Ratsinformationssystem:</b><ul>${a.beratungen.map(formatBeratung).join("")}</ul></div>`
    : "";
  return `<details class="row-item antrag" data-gruppe="${groupOf(a)}">
        <summary>
          <span class="row-main"><span class="antrag-status status-${status}">${STATUS_LABELS[status]}</span><span class="row-title">${escapeHTML(a.titel)}</span></span>
          <span class="row-side">${meta}</span>
        </summary>
        <div class="row-body">
          ${details ? `<p class="antrag-meta">${details}</p>` : ""}
          ${a.mit ? `<p class="antrag-mit">Gemeinsam mit ${escapeHTML(a.mit)}</p>` : ""}
          ${a.zusammenfassung ? `<p>${escapeHTML(a.zusammenfassung)}</p>` : `<p class="antrag-hinweis">Neu im Ratsinformationssystem – eine Zusammenfassung folgt.</p>`}
          ${a.ergebnis ? `<p class="antrag-ergebnis"><b>Ergebnis:</b> ${escapeHTML(a.ergebnis)}</p>` : ""}
          ${beratungen}
          ${links ? `<div class="antrag-links">${links}</div>` : ""}
        </div>
      </details>`;
}

export function renderAntraege(data) {
  const antraege = data?.antraege || [];
  if (!data) {
    return `<div class="notice">Die Anträge können gerade nicht angezeigt werden. Bitte später noch einmal versuchen.</div>`;
  }
  if (!antraege.length) return `<div class="notice">Noch keine Anträge eingetragen.</div>`;

  const counts = Object.fromEntries(STATUS_GROUPS.map((g) => [g.key, 0]));
  antraege.forEach((a) => counts[groupOf(a)]++);
  const bilanz = STATUS_GROUPS.filter((g) => counts[g.key])
    .map((g) => `${counts[g.key]} ${g.bilanz}`)
    .join(" · ");
  const buttons = [`<button type="button" class="filter-btn" data-filter="alle" aria-pressed="true">Alle (${antraege.length})</button>`]
    .concat(STATUS_GROUPS.filter((g) => counts[g.key])
      .map((g) => `<button type="button" class="filter-btn" data-filter="${g.key}" aria-pressed="false">${g.label} (${counts[g.key]})</button>`))
    .join("");

  return `<p class="antrag-bilanz"><b>${antraege.length} ${antraege.length === 1 ? "Antrag" : "Anträge"}</b> seit Mai 2026: ${escapeHTML(bilanz)}</p>
        <div class="antrag-filter" role="group" aria-label="Anträge nach Status filtern" hidden>${buttons}</div>
        <div id="antraegeList" class="antrag-list">${antraege.map(formatAntrag).join("")}</div>`;
}
