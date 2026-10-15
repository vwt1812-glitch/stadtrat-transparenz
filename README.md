# Transparenzplattform Lukas Küffner

Persönliche Website als Stadtrat in Nürnberg: Schwerpunkte, Ausschüsse, Anträge, Termine und Geld.
Läuft als statische Seite über GitHub Pages: https://vwt1812-glitch.github.io/stadtrat-transparenz/

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite – die Bereiche zwischen `<!-- render:… -->` werden automatisch befüllt |
| `impressum.html`, `datenschutz.html` | Rechtliches |
| `assets/style.css` | Gestaltung |
| `assets/render.mjs` | Erzeugt das HTML für Termine, Anträge, Ausschüsse und Sprechstunde (Browser **und** Action) |
| `assets/app.mjs` | Aktualisiert die Bereiche im Browser, Antragsfilter, Menü-Markierung |
| `data/termine.json` | Termine – automatisch, **nicht von Hand bearbeiten** |
| `data/antraege.json` | Anträge – teils automatisch, Texte von Hand |
| `data/ausschuesse.json` | Ausschüsse und Kommission |
| `scripts/` | Abruf von Kalender und Ratsinformationssystem, Vorab-Rendern |
| `test/` | Tests mit echten Seiten aus dem Ratsinformationssystem (`npm test`) |

## Automatische Aktualisierung

| Action | Wann | Was |
|---|---|---|
| **Termine aktualisieren** | stündlich | holt den Nextcloud-Kalender, schreibt `data/termine.json` und aktualisiert `index.html` |
| **Anträge aktualisieren** | täglich gegen 7:23 Uhr | gleicht mit dem Ratsinformationssystem ab, ergänzt neue Anträge und Beschlüsse |
| **Tests** | bei Pull Requests | prüft Parser und Rendern |

Sofort starten: **Actions → gewünschte Action → Run workflow**.

Termine, die in Nextcloud als „Privat“ oder „Vertraulich“ markiert sind, erscheinen nur als „Interner Termin“ ohne Ort.
Ein Termin mit „Sprechstunde“ im Titel erscheint automatisch als nächste Bürgersprechstunde.

## Anträge

Die Action findet neue Anträge, an denen PIRATEN & Humanisten beteiligt sind, und trägt sie mit Status `offen`
und dem Hinweis „Zusammenfassung folgt“ ein. Danach in `data/antraege.json` von Hand ergänzen:

```json
{
  "nummer": "AN/123/2027",
  "titel": "Kurzer, verständlicher Titel",
  "art": "Antrag",
  "datum": "01.03.2027",
  "gremium": "Stadtrat",
  "mit": "politbande, Tierschutzpartei und Linke Liste",
  "status": "offen",
  "zusammenfassung": "Worum es geht, in ein bis zwei Sätzen.",
  "ergebnis": "",
  "links": [
    { "label": "Antrag im Ratsinformationssystem", "url": "https://…" }
  ]
}
```

- `status`: `offen`, `angenommen`, `teilweise`, `abgelehnt`, `nicht_uebernommen`, `bericht`, `gescheitert`, `zurueckgezogen` oder `beantwortet`
- `mit`: Mitantragsteller bei gemeinsamen Anträgen (optional)
- `beratungen` und `kagnr` trägt die Action ein. Beratungen werden angezeigt, solange `ergebnis` leer ist.
- Das Feld `neu` kann nach dem Ergänzen gelöscht werden.
- Von Hand gepflegte Felder überschreibt die Action nie.

## Arbeitsbudget

Der Stand steht direkt in `index.html` (Abschnitt `#transparenz` und die Kachel „Arbeitsbudget ausgegeben“).
Später soll er automatisch aus Actual Budget kommen.

## Lokal entwickeln

```bash
npm ci
npm test            # Tests
npm run render      # index.html aus den Daten neu befüllen
python3 -m http.server   # Vorschau unter http://localhost:8000
```
