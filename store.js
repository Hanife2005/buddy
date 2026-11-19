// Buddy – Datenhaltung. Alles bleibt im Browser dieses Geräts (localStorage).

const DATEN_KEY = 'buddy.daten.v1';
const SCHLUESSEL_KEY = 'buddy.apikey';

export const ROLLEN = {
  coach: {
    label: 'Coach',
    beschreibung: 'Feierabend-Gespräch: Tag sortieren, Dampf ablassen, Gespräche üben',
    standardName: 'Clara',
    stimme: 'Kore',
    farbe: '#1f6f5c',
  },
  sport: {
    label: 'Sportbuddy',
    beschreibung: 'Motiviert dich zum Training und behält deine Woche im Blick',
    standardName: 'Max',
    stimme: 'Puck',
    farbe: '#d9662b',
  },
  reise: {
    label: 'Reisebuddy',
    beschreibung: 'Spinnt mit dir Reiseideen, Ziele und Jahreszeiten',
    standardName: 'Lina',
    stimme: 'Aoede',
    farbe: '#2a6fb0',
  },
  plaudern: {
    label: 'Plauderpartner',
    beschreibung: 'Alltagsgespräche: Wetter, Frühstück, Pläne, Erinnerungen',
    standardName: 'Anna',
    stimme: 'Leda',
    farbe: '#9b4f96',
  },
  denken: {
    label: 'Denkpartner',
    beschreibung: 'Wissenschaft, Philosophie, Trends und neue Ideen',
    standardName: 'Theo',
    stimme: 'Charon',
    farbe: '#5b5bd6',
  },
  marketing: {
    label: 'Marketing-Buddy',
    beschreibung: 'Marketing, Marke, Kommunikation, Kampagnen und Trends',
    standardName: 'Richard',
    stimme: 'Orus',
    farbe: '#c2185b',
    arbeit: true,
  },
  recruiting: {
    label: 'Recruiting-Buddy',
    beschreibung: 'Recruiting, Stellenanzeigen, Interviews, Employer Branding',
    standardName: 'Ela',
    stimme: 'Zephyr',
    farbe: '#00897b',
    arbeit: true,
  },
  chef: {
    label: 'CEO-Sparring',
    beschreibung: 'Arbeit, Strategie, Prioritäten und Führung aus Chef-Sicht',
    standardName: 'Paul',
    stimme: 'Charon',
    farbe: '#37474f',
    arbeit: true,
  },
  it: {
    label: 'IT-Buddy',
    beschreibung: 'Technik, Software, IT-Sicherheit, Digitalisierung, KI-Tools',
    standardName: 'Kiril',
    stimme: 'Fenrir',
    farbe: '#6d4c41',
    arbeit: true,
  },
  eigene: {
    label: 'Eigene Rolle',
    beschreibung: 'Du beschreibst selbst, wer dein Buddy ist',
    standardName: 'Sam',
    stimme: 'Kore',
    farbe: '#757575',
  },
};

export const STIMMEN = [
  { id: 'Kore', label: 'Kore (weiblich, ruhig)' },
  { id: 'Aoede', label: 'Aoede (weiblich, hell)' },
  { id: 'Leda', label: 'Leda (weiblich, jung)' },
  { id: 'Zephyr', label: 'Zephyr (weiblich, freundlich)' },
  { id: 'Puck', label: 'Puck (männlich, lebhaft)' },
  { id: 'Charon', label: 'Charon (männlich, tief)' },
  { id: 'Fenrir', label: 'Fenrir (männlich, energisch)' },
  { id: 'Orus', label: 'Orus (männlich, fest)' },
];

export const SPRACHEN = {
  de: 'Deutsch',
  fr: 'Französisch',
  en: 'Englisch',
};

export const TEMPI = {
  normal: 'Normal',
  ruhig: 'Etwas ruhiger, mit Pausen',
  langsam: 'Langsam, mit langen Pausen',
};

export const STANDARD_LIVE_MODELL = 'gemini-3.8-live';
export const STANDARD_TEXT_MODELLE = [
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-flash-lite-latest',
  'gemini-flash-latest',
];

export function neueId() {
  return Math.random().toString(36).slice(2, 9);
}

export function leereDaten() {
  return {
    version: 1,
    nutzer: null,
    buddies: [],
    fakten: [],
    gespraeche: [],
    technik: {
      liveModell: STANDARD_LIVE_MODELL,
      textModell: '',
      unterbrechen: true,
      untertitel: true,
    },
  };
}

function vervollstaendigen(d) {
  const leer = leereDaten();
  const out = { ...leer, ...d };
  out.technik = { ...leer.technik, ...(d.technik || {}) };
  out.buddies = Array.isArray(d.buddies) ? d.buddies : [];
  out.fakten = Array.isArray(d.fakten) ? d.fakten : [];
  out.gespraeche = Array.isArray(d.gespraeche) ? d.gespraeche : [];
  return out;
}

export function laden() {
  try {
    const roh = localStorage.getItem(DATEN_KEY);
    if (!roh) return null;
    return vervollstaendigen(JSON.parse(roh));
  } catch (e) {
    console.error('Laden fehlgeschlagen', e);
    return null;
  }
}

export function speichern(daten) {
  // Alte Wortprotokolle kürzen, damit der Speicher nicht vollläuft.
  // Zusammenfassungen, Bewertungen und Mitnehmen-Karten bleiben erhalten.
  const MAX_PROTOKOLLE = 15;
  let mitProtokoll = 0;
  for (const g of daten.gespraeche) {
    if (g.transkript && g.transkript.length) {
      mitProtokoll++;
      if (mitProtokoll > MAX_PROTOKOLLE && g.zusammenfassung) g.transkript = [];
    }
  }
  try {
    localStorage.setItem(DATEN_KEY, JSON.stringify(daten));
    return true;
  } catch (e) {
    console.error('Speichern fehlgeschlagen', e);
    return false;
  }
}

export function getApiKey() {
  try {
    return localStorage.getItem(SCHLUESSEL_KEY) || '';
  } catch {
    return '';
  }
}

export function setApiKey(k) {
  localStorage.setItem(SCHLUESSEL_KEY, (k || '').trim());
}

export function allesLoeschen() {
  localStorage.removeItem(DATEN_KEY);
  localStorage.removeItem(SCHLUESSEL_KEY);
}

// Sicherung ohne den Schlüssel – der gehört nicht in eine Datei, die man herumschickt.
export function exportJson(daten) {
  return JSON.stringify({ app: 'buddy', exportiert: new Date().toISOString(), daten }, null, 2);
}

export function importJson(text) {
  const obj = JSON.parse(text);
  const d = obj && obj.app === 'buddy' ? obj.daten : obj;
  if (!d || typeof d !== 'object' || !Array.isArray(d.buddies)) {
    throw new Error('Das ist keine Buddy-Sicherung.');
  }
  return vervollstaendigen(d);
}

// Lokales Datum als JJJJ-MM-TT (nicht UTC, sonst springt der Tag um Mitternacht falsch).
export function tagSchluessel(datum = new Date()) {
  const d = new Date(datum);
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const t = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${t}`;
}

// Pro Tag zählt die zuletzt abgegebene Bewertung.
export function bewertungenProTag(daten) {
  const proTag = {};
  const sortiert = [...daten.gespraeche].sort((a, b) => a.start - b.start);
  for (const g of sortiert) {
    if (g.bewertung) proTag[tagSchluessel(g.start)] = g.bewertung;
  }
  return proTag;
}
