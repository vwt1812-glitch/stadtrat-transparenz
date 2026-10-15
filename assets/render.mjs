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

export function renderStatTermine(data, now = Date.now()) {
  return data ? String(eventsWithinDays(upcomingEvents(data, now), 30, now).length) : "–";
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

export function renderAusschuesse(ausschuesse, termine, now = Date.now()) {
  const events = upcomingEvents(termine, now);
  return (ausschuesse || []).map((a) => {
    const pattern = a.muster ? new RegExp(a.muster, "i") : null;
    const next = pattern && events.find((e) => pattern.test(e.title));
    const nextHTML = next
      ? `${escapeHTML(formatDay(toDate(next.start, next.allDay), next.allDay))}, ${escapeHTML(formatWhen(next))}`
      : "noch nicht im Kalender";
    const link = /^https:\/\//.test(a.ris || "")
      ? `<a class="text-link" href="${escapeHTML(a.ris)}" target="_blank" rel="noopener">Sitzungen im Ratsinformationssystem ↗</a>`
      : "";
    return `<article class="card topic-card committee-card">
            <span class="tag">${escapeHTML(a.art)}</span>
            <h3>${escapeHTML(a.name)}</h3>
            <p>${escapeHTML(a.beschreibung)}</p>
            <p class="committee-next"><b>Nächste Sitzung:</b> ${nextHTML}</p>
            ${link}
          </article>`;
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
  const meta = [a.nummer, a.art, a.datum, a.gremium].filter(Boolean).map(escapeHTML).join(" · ");
  const links = (a.links || [])
    .filter((l) => /^https:\/\//.test(l.url))
    .map((l) => `<a class="text-link" href="${escapeHTML(l.url)}" target="_blank" rel="noopener">${escapeHTML(l.label)} ↗</a>`)
    .join("");
  // Beratungen aus dem Ratsinformationssystem nur zeigen, solange kein eigenes Ergebnis eingetragen ist
  const beratungen = !a.ergebnis && a.beratungen?.length
    ? `<div class="antrag-beratungen"><b>Laut Ratsinformationssystem:</b><ul>${a.beratungen.map(formatBeratung).join("")}</ul></div>`
    : "";
  return `<article class="card antrag" data-gruppe="${groupOf(a)}">
        <div class="antrag-head"><span class="antrag-status status-${status}">${STATUS_LABELS[status]}</span>${meta ? `<span class="antrag-meta">${meta}</span>` : ""}</div>
        <h3>${escapeHTML(a.titel)}</h3>
        ${a.mit ? `<p class="antrag-mit">Gemeinsam mit ${escapeHTML(a.mit)}</p>` : ""}
        ${a.zusammenfassung ? `<p>${escapeHTML(a.zusammenfassung)}</p>` : `<p class="antrag-hinweis">Neu im Ratsinformationssystem – eine Zusammenfassung folgt.</p>`}
        ${a.ergebnis ? `<p class="antrag-ergebnis"><b>Ergebnis:</b> ${escapeHTML(a.ergebnis)}</p>` : ""}
        ${beratungen}
        ${links ? `<div class="antrag-links">${links}</div>` : ""}
      </article>`;
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
