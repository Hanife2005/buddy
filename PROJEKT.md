# Buddy – Projektwissen

Dieses Dokument hält fest, was wir entschieden haben, warum, was fertig ist und was als Nächstes kommt.
Es wird bei jeder Weiterentwicklung aktualisiert.

Stand: 19.11.2026 · Version 1.3

---

## 1. Die Idee

Eine KI-Person „ruft an“ und führt echte Gespräche. Ziel ist nicht Unterhaltung, sondern dass Menschen
**im Gespräch bleiben**: das Sprechen üben, Gedanken sortieren, Neues mitnehmen und es in Gespräche mit
echten Menschen einbringen.

**Testpersonen (privat):**
- Ich selbst: abends nach Feierabend (Coach), dazu Sport-, Reise- und Denkpartner
- Meine Mutter: Gespräche auf Französisch, um die Sprache aufzufrischen
- Mein Vater (85, Demenz): kurze Alltagsgespräche am Morgen, damit Hören und Sprechen trainiert werden
- Meine Freundin: unabhängiges Feedback

**Später:** daraus ein Produkt machen, mit dem man Geld verdient.

---

## 2. Grundsätze (gelten für jede Version)

**Ehrlich statt glatt**
- Die KI gibt sich nie als Mensch aus.
- Sie gibt zu, wenn sie etwas nicht weiß, und unterscheidet: gut belegt / umstritten / Spekulation.
- Sie darf respektvoll widersprechen und ist kein Ja-Sager.

**Erst zuhören, dann umlenken**
- Bei Ärger oder schlechten Tagen wird erst zugehört. Erst danach kommen andere Perspektiven oder ein „atme mal durch“.
- Kein erzwungener Optimismus.

**Klare Grenzen**
- Keine Zustimmung zu Hass, Rassismus oder Menschenfeindlichkeit. Stattdessen ruhig andere Blickwinkel anbieten, ohne zu predigen. Bei Demenz lieber sanft das Thema wechseln.
- Bei Suizidgedanken nicht ablenken, sondern ernst nehmen und auf die TelefonSeelsorge (0800 111 0 111 / 0800 111 0 222) verweisen, bei Gefahr auf den Notruf 112.
- Bei Notfällen (Sturz, Brustschmerz …) sofort auf 112 verweisen.
- Keine Diagnosen, keine Medikamenten-, Rechts- oder Finanzberatung.

**Der Mensch redet mehr als die KI**
- Die KI fragt mehr, als sie erzählt. Wissen bringt sie als kurzen Impuls ein, nicht als Vortrag.
- Sie ermutigt zu echten Kontakten und ersetzt sie nicht.

**Der Nutzer entscheidet**
- Die Tagesbewertung (gut / mittel / schwer) gibt der Mensch selbst, nicht die KI.
- Die KI zeigt Muster, zieht aber keine Lebensentscheidungen („kündige deinen Job“).
- Alles, was sich die KI merkt, ist einsehbar und löschbar.

---

## 3. Wichtige Entscheidungen und warum

| Entscheidung | Warum | Nachteil |
|---|---|---|
| **Web-App** (läuft in Safari), keine App-Store-App | Kostet nichts, kein Apple-Entwicklerkonto (99 €/Jahr) nötig, sofort teilbar | Kein echtes Anrufgefühl, iOS-Einschränkungen |
| **„Anruf“ über iPhone-Wecker + Kurzbefehl** statt Telefonanbieter | Kostenlos, kein Telefonanbieter nötig | Nach dem Wecker: entsperren und auf die Mitteilung tippen (iOS-Regel, getestet am 18.11.) |
| **Google Gemini Live** (`gemini-3.8-live`) für Sprache | Kostenlose Stufe, natürliche Stimme, schnell | Kostenlose Stufe: Google darf Inhalte zur Verbesserung nutzen; Limits pro Minute |
| **Daten nur im Browser des Geräts** | Datenschutz, kein Server nötig | Safari kann Daten nach ca. 7 Tagen ohne Nutzung löschen → Sicherungsfunktion |
| **Jeder Nutzer hat seinen eigenen Gemini-Schlüssel** | Eigene Limits, eigene Zustimmung zu Googles Bedingungen | Einrichtung ist für Laien eine Hürde |
| **In Safari nutzen, nicht als Home-Bildschirm-App** | Der Wecker-Link öffnet Safari. Eine Home-Bildschirm-App hätte einen getrennten Speicher | Sieht weniger nach „App“ aus |
| **KI-Anbieter austauschbar halten** | Nicht dauerhaft an Google gebunden sein | Etwas mehr Aufwand im Code |

---

## 4. Was Version 1.1 kann

- Einrichtung: Name, Alter (schlägt Sprechtempo vor), Zweck, Sprechtempo, Hören, Sprache, Anrede, Schlüssel
- Mehrere Buddys: Coach, Sportbuddy, Reisebuddy, Plauderpartner, Denkpartner, Marketing-Buddy (Richard), Recruiting-Buddy (Ela), CEO-Sparring (Paul, fiktiv – nicht der echte Chef), IT-Buddy (Kiril) sowie **Eigene Rolle** mit selbst geschriebener Rollenbeschreibung, jeweils mit Name, Stimme, Sprache (DE/FR/EN), Anrede, Tempo und eigenen Wünschen
- Anrufbildschirm mit Annehmen/Ablehnen, Untertiteln, Stummschalten, Gesprächszeit, Mikrofonpegel
- Selbst anrufen (grüner Hörer) oder angerufen werden (Wecker-Link `?anruf=<id>`)
- Gedächtnis: Nach jedem Gespräch werden Fakten gemerkt, alte korrigiert, sichtbar und löschbar unter „Was sich Buddy merkt“
- Tagesbewertung und Übersicht der letzten 14 bzw. 30 Tage
- Karte „Zum Mitnehmen“ mit 1–3 Gedanken für echte Gespräche, bei Fakten mit „nachprüfen“-Link
- **Google-Suche im Gespräch** (pro Buddy schaltbar, Standard bei Reise, Denken, Marketing, Recruiting, CEO, IT): für Aktuelles und Spezielles, Quelle wird genannt. Wird die Suche von Google abgelehnt, verbindet die App automatisch ohne Suche
- Fachlich geschärfte Experten-Rollen (z. B. IT: systematische Fehlersuche, ein Schritt nach dem anderen, Warnung vor Werkseinstellungen; Recruiting: strukturierte Interviews, STAR, AGG)
- Arbeits-Buddys erinnern einmal pro Gespräch freundlich daran, keine Firmeninterna oder Daten Dritter zu nennen (kostenlose Stufe)
- Übungsgespräche (z. B. Gehaltsverhandlung), indem man es im Gespräch ansagt
- Automatisches Neuverbinden bei Abbruch, Zeitlimit oder wenn Google nicht antwortet; der Gesprächsverlauf wird mitgegeben
- Hinweis-Knopf, wenn iOS den Ton anhält
- Technisches Protokoll pro Gespräch (kopierbar, zur Fehlersuche)
- Sicherung herunterladen / einspielen, alles löschen

---

## 5. Bekannte Grenzen und Risiken

- **Anrufgefühl:** Nach dem Wecker sind entsperren und auf die Mitteilung tippen nötig. Für Menschen mit Demenz ist das zu kompliziert.
- **Verbindungsabbrüche:** Beim 2. und 3. Test am 18.11. brach die Antwort ab. Die Ursache ist noch unklar. Vermutet werden die Limits der kostenlosen Stufe, das Zeitlimit (~10 Min.) oder eine iOS-Ton-Unterbrechung. Version 1.1 fängt das ab; das Protokoll soll die Ursache zeigen.
- **Kostenlose Stufe:** Limits pro Minute und Tag (genaue Werte für 3.8 Live unbekannt), Daten werden von Google zur Verbesserung genutzt, Bedingungen können sich ändern.
- **Bezahlt:** ca. 0,005 $/Min. Audio rein + 0,018 $/Min. Audio raus (Stand Okt. 2026), also grob 10 $ pro Person und Monat bei 15 Min. täglich.
- **Halluzinationen:** Die KI kann sich irren. Gegenmittel: Unsicherheit aussprechen und den „nachprüfen“-Link nutzen.
- **„Immer aktuell“ gibt es nicht:** Die KI lernt nicht von selbst dazu. Aktuelles kommt nur über die Google-Suche im Gespräch; ob die in der kostenlosen Stufe zuverlässig läuft, ist noch nicht mit echtem Schlüssel getestet (Einstellungen → „Verbindung testen“ zeigt es an).
- **Wirkung unbewiesen:** Dass KI-Gespräche gegen Gesprächsscheu helfen oder geistigen Abbau bremsen, ist eine Hoffnung, kein belegter Fakt. Nicht damit werben.

---

## 6. Offene Fragen

- Welche Handys haben Vater und Mutter (iPhone, Android, Festnetz)? Kann der Vater selbst „Annehmen“ tippen? Hörgerät?
- Sollen Angehörige etwas mitbekommen (Zusammenfassung, Warnung)? Was sagt der Vater selbst dazu?
- Wie gehen wir damit um, wenn der Vater irgendwann nicht mehr versteht, dass es eine KI ist?
- Geschäftsmodell und Zielgruppe für das spätere Produkt (eine Zielgruppe wählen)

---

## 7. Fahrplan

**Als Nächstes**
1. Feedback sammeln: eigene Tests, Freundin (Stimme, Tempo, Unterbrechungen, „würdest du morgen wieder abnehmen?“)
2. Ursache der Abbrüche mit dem Protokoll klären
3. Französisch-Test mit der Mutter

**Danach**
4. Version für den Vater: Prüfen, ob eine echte iPhone-App mit AlarmKit (Mac vorhanden) das Gespräch direkt aus dem Klingeln heraus starten kann; Angehörigen-Modus (Profil wird von der Familie eingerichtet, Oberfläche nur „Annehmen“)
5. Automatische Erinnerung an die Sicherung

**Für ein Produkt (später)**
- Eigener kleiner Server, damit Nutzer keinen eigenen Schlüssel brauchen (kurzlebige Zugangstoken), bezahlte KI-Stufe ohne Datennutzung durch Google
- Datenschutz (DSGVO, Gesundheitsdaten), EU-KI-Verordnung (Transparenzpflicht), Vorsicht mit Gesundheitsversprechen (sonst ggf. Medizinprodukt) – rechtlich prüfen lassen
- Kosten pro Nutzer und Preismodell

---

## 8. Testprotokoll

| Datum | Wer | Ergebnis |
|---|---|---|
| 18.11.2026 | Ich | Wecker + Kurzbefehl funktioniert, öffnet aber erst nach Entsperren + Tippen auf die Mitteilung |
| 19.11.2026 | Ich | Erster Anruf gefällt gut. 2. und 3. Anruf: Buddy antwortete plötzlich nicht mehr → Version 1.1 |

---

## 9. Technik (Kurzfassung)

- Reines HTML/CSS/JavaScript, kein Build-Schritt, Hosting über GitHub Pages: https://hanife2005.github.io/buddy/
- `app.js` Oberfläche · `live.js` Sprachverbindung (WebSocket, Neuverbinden, Protokoll) · `mic-worklet.js` Mikrofon → 16 kHz PCM · `prompt.js` Persönlichkeit und Regeln · `summary.js` Zusammenfassung und Gedächtnis · `store.js` Speicher
- Tests: `tests/` (nachgebauter Google-Server + Browser-Tests), siehe `CLAUDE.md`

## Änderungsverlauf
- **1.3** (19.11.2026): Google-Suche im Gespräch (pro Buddy), fachlich geschärfte Experten-Rollen, Anleitungen Schritt für Schritt, stufenweiser Rückfall ohne Suche
- **1.2** (19.11.2026): neue Rollen Marketing, Recruiting, CEO-Sparring, IT und „Eigene Rolle“; Name und Stimme werden beim Rollenwechsel vorgeschlagen
- **1.1** (19.11.2026): automatisches Neuverbinden, Ton-Unterbrechung erkennen, technisches Protokoll
- **1.0** (19.11.2026): erste Version
