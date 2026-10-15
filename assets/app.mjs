// Aktualisiert die vorgerenderten Bereiche mit den neuesten Daten (z. B. vergangene Termine
// ausblenden), steuert den Antragsfilter und markiert den aktuellen Menüpunkt.
import {
  renderCalendar, renderAntraege, renderAusschuesse, renderSprechstunde, renderUeberblick, renderBudget
} from "./render.mjs?v=4658b31515";

async function loadJSON(name) {
  try {
    const res = await fetch(`data/${name}`, { cache: "no-cache" });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (error) {
    console.warn(`${name} konnte nicht geladen werden:`, error);
    return null; // vorgerenderter Inhalt bleibt dann stehen
  }
}

function setRegion(name, html) {
  const el = document.querySelector(`[data-region="${name}"]`);
  if (el) el.innerHTML = html;
}

function initAntragFilter() {
  const bar = document.querySelector(".antrag-filter");
  if (!bar) return;
  bar.hidden = false;
  bar.addEventListener("click", (event) => {
    const button = event.target.closest(".filter-btn");
    if (!button) return;
    const filter = button.dataset.filter;
    bar.querySelectorAll(".filter-btn").forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
    document.querySelectorAll("#antraegeList .antrag").forEach((card) => {
      card.hidden = filter !== "alle" && card.dataset.gruppe !== filter;
    });
  });
}

async function refresh() {
  const [termine, antraege, gremien, budget] = await Promise.all([
    loadJSON("termine.json"), loadJSON("antraege.json"), loadJSON("ausschuesse.json"), loadJSON("budget.json")
  ]);
  const now = Date.now();
  if (termine && antraege && gremien && budget) setRegion("ueberblick", renderUeberblick({ termine, antraege, gremien, budget }, now));
  if (budget) setRegion("budget", renderBudget(budget));
  if (termine) {
    setRegion("calendar", renderCalendar(termine, now));
    setRegion("sprechstunde", renderSprechstunde(termine, now));
    if (gremien) setRegion("ausschuesse", renderAusschuesse(gremien.ausschuesse, termine, now));
  }
  if (antraege) setRegion("antraege", renderAntraege(antraege));
  initAntragFilter();
}

/* ---------- Navigation: aktuellen Abschnitt im Menü markieren ---------- */
function initNavigation() {
  const header = document.querySelector("header");
  const links = [...document.querySelectorAll("header nav a[href^='#']")];
  const sections = links.map((a) => document.getElementById(a.hash.slice(1))).filter(Boolean);

  const nav = document.querySelector("header nav");
  let activeId = null;
  function setActive(id) {
    if (id === activeId) return;
    activeId = id;
    links.forEach((a) => {
      const active = a.hash === "#" + id;
      a.classList.toggle("active", active);
      if (active) a.setAttribute("aria-current", "true");
      else a.removeAttribute("aria-current");
      // Auf schmalen Bildschirmen ist das Menü wischbar: aktiven Punkt sichtbar halten
      if (active && nav.scrollWidth > nav.clientWidth) {
        nav.scrollTo({ left: a.offsetLeft - (nav.clientWidth - a.offsetWidth) / 2, behavior: "smooth" });
      }
    });
  }

  let ticking = false;
  function update() {
    ticking = false;
    // gleiche Grenze wie die Sprungmarken (scroll-padding-top im CSS)
    const padding = parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop) || header.offsetHeight;
    const y = Math.max(padding, header.offsetHeight) + 12;
    let current = sections[0]?.id;
    for (const section of sections) {
      if (section.getBoundingClientRect().top <= y) current = section.id;
    }
    // Ganz unten angekommen: letzten Abschnitt markieren
    if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) {
      current = sections[sections.length - 1]?.id;
    }
    if (current) setActive(current);
  }
  const schedule = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

  window.addEventListener("scroll", schedule, { passive: true });
  window.addEventListener("resize", schedule);
  links.forEach((a) => a.addEventListener("click", () => setActive(a.hash.slice(1))));
  update();
}

initNavigation();
refresh();
