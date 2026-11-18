// Buddy – Zusammenfassung nach dem Gespräch (Text-Modell über die normale Gemini-API).

const STANDARD_REST = 'https://generativelanguage.googleapis.com/v1beta/models/';

function restAdresse() {
  try {
    return localStorage.getItem('buddy.debug.rest') || STANDARD_REST;
  } catch {
    return STANDARD_REST;
  }
}

function istModellFehler(text, status) {
  return status === 404 || /model|not found|not supported/i.test(text || '');
}

// Probiert die Modelle der Reihe nach, bis eines antwortet.
export async function textAnfrage(apiKey, modelle, prompt) {
  let letzterFehler = 'Kein Text-Modell verfügbar.';
  for (const modell of modelle) {
    let antwort;
    try {
      antwort = await fetch(`${restAdresse()}${modell}:generateContent?key=${encodeURIComponent(apiKey)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.3 },
        }),
      });
    } catch (e) {
      throw new Error('Keine Verbindung zu Google. Prüfe dein Internet.');
    }
    const json = await antwort.json().catch(() => ({}));
    if (!antwort.ok) {
      letzterFehler = (json.error && json.error.message) || `HTTP ${antwort.status}`;
      if (istModellFehler(letzterFehler, antwort.status)) continue;
      throw new Error(letzterFehler);
    }
    const kandidat = json.candidates && json.candidates[0];
    const text = ((kandidat && kandidat.content && kandidat.content.parts) || []).map((p) => p.text || '').join('');
    return { modell, text };
  }
  throw new Error(letzterFehler);
}

export function jsonAusText(text) {
  let t = (text || '').trim().replace(/^```(?:json)?/i, '').replace(/```$/, '').trim();
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a >= 0 && b > a) t = t.slice(a, b + 1);
  return JSON.parse(t);
}

export function ergebnisBereinigen(roh) {
  const liste = (x) => (Array.isArray(x) ? x : []);
  return {
    zusammenfassung: String(roh.zusammenfassung || '').trim(),
    neueFakten: liste(roh.neue_fakten).map((s) => String(s).trim()).filter(Boolean).slice(0, 5),
    veralteteFakten: liste(roh.veraltete_fakten).map((s) => String(s).trim()).filter(Boolean),
    mitnehmen: liste(roh.mitnehmen)
      .map((m) =>
        typeof m === 'string'
          ? { gedanke: m.trim(), nachpruefen: '' }
          : { gedanke: String(m.gedanke || '').trim(), nachpruefen: String(m.nachpruefen || '').trim() },
      )
      .filter((m) => m.gedanke)
      .slice(0, 3),
  };
}

// Übernimmt neue Fakten ins Gedächtnis und entfernt überholte.
export function faktenAktualisieren(daten, ergebnis, gespraechId) {
  const weg = new Set(ergebnis.veralteteFakten.map((s) => s.toLowerCase()));
  daten.fakten = daten.fakten.filter((f) => !weg.has(f.text.toLowerCase()));
  const vorhanden = new Set(daten.fakten.map((f) => f.text.toLowerCase()));
  for (const text of ergebnis.neueFakten) {
    if (!vorhanden.has(text.toLowerCase())) {
      daten.fakten.push({ text, seit: Date.now(), quelle: gespraechId });
      vorhanden.add(text.toLowerCase());
    }
  }
  if (daten.fakten.length > 80) daten.fakten = daten.fakten.slice(-80);
}
