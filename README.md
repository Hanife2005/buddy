# Buddy

Ein KI-Gesprächspartner, der „anruft“: Coach, Sportbuddy, Reisebuddy, Plauder- oder Denkpartner.
Gesprochen wird über die Google Gemini Live API. Alle Daten (Profil, Gedächtnis, Tagesbewertungen)
bleiben im Browser des Geräts.

**Version 1** – privater Test.

## Funktionen
- Einrichtung mit Name, Alter, Zweck, Sprechtempo, Hören, Sprache und Anrede
- Mehrere Buddys mit eigener Rolle, Stimme, Sprache und eigenen Wünschen
- Anrufbildschirm mit Annehmen/Ablehnen, Untertiteln, Stummschalten
- Gedächtnis: Nach jedem Gespräch merkt sich Buddy wichtige Punkte (einsehbar und löschbar)
- Tagesbewertung (gut / mittel / schwer) und Übersicht der letzten Tage
- Karte „Zum Mitnehmen“ mit Gedanken für echte Gespräche, inkl. Link zum Nachprüfen
- Übungsgespräche (z. B. Gehaltsverhandlung) einfach im Gespräch ansagen
- Sicherung herunterladen / einspielen

## Einrichtung auf dem iPhone
1. Adresse der App in **Safari** öffnen.
2. Formular ausfüllen und den Gemini-Schlüssel aus Google AI Studio einfügen.
3. Mikrofon dauerhaft erlauben: `aA` in der Adressleiste → Website-Einstellungen → Mikrofon → Erlauben.
4. Automatischer Anruf: In den Buddy-Einstellungen steht ein Link. Diesen in Kurzbefehle als „URL öffnen“
   eintragen und per Automation an einen Wecker („Wird gestoppt“) koppeln.

Wichtig: Die App in Safari nutzen, nicht als separate Home-Bildschirm-App. Sonst öffnet der Wecker-Link
Safari mit leerem Speicher.

## Bekannte Grenzen
- iOS öffnet die App nach dem Wecker erst nach Entsperren und Tippen auf die Mitteilung.
- Kostenlose Gemini-Stufe: begrenztes Kontingent; Google darf die Inhalte zur Produktverbesserung nutzen.
- Safari kann Website-Daten nach ca. 7 Tagen ohne Nutzung löschen – regelmäßig sichern.
- Die KI kann sich irren. Sie ist kein Ersatz für Menschen, Ärzte oder Therapie.

## Technik
Reines HTML/CSS/JavaScript ohne Build-Schritt, gehostet über GitHub Pages.
`app.js` (Oberfläche), `live.js` (Sprachverbindung), `mic-worklet.js` (Mikrofon → 16 kHz PCM),
`prompt.js` (Persönlichkeit und Regeln), `summary.js` (Zusammenfassung), `store.js` (Speicher).
