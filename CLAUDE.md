# Hinweise für Claude

**Lies zuerst `PROJEKT.md`.** Dort stehen Idee, Grundsätze, Entscheidungen, Stand, offene Fragen und Fahrplan.

## Über den Auftraggeber
- Kein Entwickler. Erklärungen auf Deutsch, Schritt für Schritt, ohne Fachjargon.
- Möchte ehrliche Kritik: erst Schwachstellen nennen, dann loben. Bei Unsicherheit „ich weiß es nicht“ sagen, nichts erfinden.
- Budget: null. Keine Lösung vorschlagen, die Geld kostet, ohne es klar zu sagen.
- Nutzt iPhone + Mac.

## Arbeitsweise
1. Vor Änderungen `PROJEKT.md` lesen; die Grundsätze in Abschnitt 2 gelten immer (v. a. für `prompt.js`).
2. Nach Änderungen testen (siehe unten). Nichts hochladen, was die Tests nicht besteht.
3. **Versionsnummer erhöhen**, sonst lädt Safari alte Dateien aus dem Cache:
   - `?v=N` in `index.html` (CSS + app.js) **und** in allen `import`-Zeilen sowie beim `mic-worklet.js`-Pfad in `live.js`
   - Anzeige „Buddy · Version X“ in `app.js` (Einstellungen)
4. `PROJEKT.md` aktualisieren: Abschnitt 4 (Funktionen), 5/6 (Grenzen, Fragen), 8 (Testprotokoll), Änderungsverlauf.
5. Auf `main` pushen. GitHub Pages veröffentlicht automatisch (dauert einige Minuten).

## Tests
Voraussetzungen: Node, Python mit Playwright, Chrome unter `/usr/bin/google-chrome`.
```
cd tests && npm install
node mock-server.js &        # nachgebauter Google-Server + App auf http://localhost:8080
python3 test_app.py          # kompletter Ablauf: Einrichtung, Anruf, Zusammenfassung, Gedächtnis, Klingeln, Fehler
python3 test_robust.py       # Neuverbinden nach Abbruch und wenn Google schweigt
python3 test_rollen.py       # neue Rollen, eigene Rolle, Vertraulichkeitshinweis
SETUP_STRENG=1 node mock-server.js &  &&  python3 test_fallback.py   # vereinfachte Einstellungen
```
Die App liest im Test `localStorage['buddy.debug.ws']` und `['buddy.debug.rest']`, um den Testserver statt Google zu nutzen.

Echte Google-Verbindungen können nur auf dem Gerät des Nutzers getestet werden (sein Schlüssel). Bei Problemen um das **technische Protokoll** bitten (in der App unter dem Gespräch → „Protokoll kopieren“).

## Technische Eckdaten
- Live-Modell: `gemini-3.8-live`, WebSocket `…v1beta.GenerativeService.BidiGenerateContent?key=…`
- Mikrofon: 16 kHz PCM16, Antwort-Audio: PCM16 mit Rate aus `mimeType` (meist 24 kHz)
- Zusammenfassung: Text-Modelle aus `STANDARD_TEXT_MODELLE` (`store.js`), erstes funktionierendes wird gemerkt
- Daten: `localStorage` `buddy.daten.v1`, Schlüssel separat in `buddy.apikey` (nie in Sicherungen)
