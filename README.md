# Transparenzplattform Lukas Küffner

Persönliche Website als Stadtrat in Nürnberg: Schwerpunkte, Ausschüsse, Anträge, Termine und Geld.
Läuft als statische Seite über GitHub Pages: https://vwt1812-glitch.github.io/stadtrat-transparenz/

## Aufbau

| Datei | Inhalt |
|---|---|
| `index.html` | Startseite |
| `impressum.html`, `datenschutz.html` | Rechtliches |
| `assets/style.css` | Gestaltung der Startseite |
| `data/termine.json` | Termine – wird automatisch erzeugt, **nicht von Hand bearbeiten** |
| `data/antraege.json` | Anträge & Anfragen – wird von Hand gepflegt |
| `scripts/build-termine.mjs` | Holt den Nextcloud-Kalender und schreibt `data/termine.json` |

## Termine

Die GitHub Action „Termine aktualisieren“ holt den Kalender jede Stunde ab.
Sofort aktualisieren: **Actions → Termine aktualisieren → Run workflow**.

Termine, die in Nextcloud als „Privat“ oder „Vertraulich“ markiert sind, erscheinen nur als „Interner Termin“ ohne Ort.

## Anträge eintragen

In `data/antraege.json` einen Eintrag oben in die Liste `antraege` einfügen (neueste zuerst):

```json
{
  "nummer": "AN/123/2027",
  "titel": "Kurzer Titel des Antrags",
  "art": "Antrag",
  "datum": "März 2027",
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

- `art`: z. B. `Antrag`, `Anfrage`, `Berichtsantrag`
- `status`: `offen`, `angenommen`, `teilweise`, `abgelehnt`, `nicht_uebernommen`, `bericht`, `gescheitert`, `zurueckgezogen` oder `beantwortet`
- `mit`: Mitantragsteller bei gemeinsamen Anträgen (optional)
- Nummer, Antrag und Beschluss findest du im [Ratsinformationssystem](https://online-service2.nuernberg.de/buergerinfo/ag0040.asp).
- Leere Felder werden einfach nicht angezeigt.

## Arbeitsbudget

Der Stand steht direkt in `index.html` (Abschnitt `#transparenz` und die Kachel „Arbeitsbudget ausgegeben“).
Später soll er automatisch aus Actual Budget kommen.
