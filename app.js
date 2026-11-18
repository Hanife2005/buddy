// Buddy – Oberfläche und Ablauf.

import {
  ROLLEN,
  STIMMEN,
  SPRACHEN,
  TEMPI,
  STANDARD_LIVE_MODELL,
  STANDARD_TEXT_MODELLE,
  laden,
  speichern,
  leereDaten,
  neueId,
  getApiKey,
  setApiKey,
  allesLoeschen,
  exportJson,
  importJson,
  tagSchluessel,
  bewertungenProTag,
} from './store.js';
import { systemPrompt, begruessung, zusammenfassungPrompt, effektivesTempo } from './prompt.js';
import { LiveAnruf, verbindungTesten } from './live.js';
import { textAnfrage, jsonAusText, ergebnisBereinigen, faktenAktualisieren } from './summary.js';

let daten = laden() || leereDaten();
const app = document.getElementById('app');
let ansicht = { name: 'home' };
let anruf = null;
let anrufTimer = null;
let klingel = null;
let klingelTimeout = null;

// ---------- Hilfsfunktionen ----------

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

function sichern() {
  if (!speichern(daten)) toast('Speichern hat nicht geklappt. Ist der Speicher des Browsers voll?');
}

function buddy(id) {
  return daten.buddies.find((b) => b.id === id);
}

function toast(text) {
  const alt = document.querySelector('.toast');
  if (alt) alt.remove();
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = text;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4500);
}

function avatar(b, gross) {
  const r = ROLLEN[b.rolle] || ROLLEN.coach;
  return `<div class="avatar${gross ? ' gross' : ''}" style="background:${r.farbe}">${esc((b.name || '?').charAt(0).toUpperCase())}</div>`;
}

function dauerText(sek) {
  const m = Math.floor(sek / 60);
  const s = String(sek % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function datumZeit(ts) {
  return new Date(ts).toLocaleString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function anrufLink(b) {
  const pfad = location.pathname.replace(/index\.html$/, '');
  return `${location.origin}${pfad}?anruf=${b.id}`;
}

function optionen(obj, aktiv) {
  return Object.entries(obj)
    .map(([k, v]) => `<option value="${esc(k)}" ${k === aktiv ? 'selected' : ''}>${esc(v)}</option>`)
    .join('');
}

const BEWERTUNG_TEXT = { gut: 'Guter Tag', mittel: 'Mittelmäßig', schlecht: 'Schwerer Tag' };

// ---------- Navigation ----------

function zeige(neu) {
  ansicht = neu;
  render();
  window.scrollTo(0, 0);
}

function render() {
  const v = ansicht.name;
  document.body.dataset.ansicht = v;
  const ansichten = {
    willkommen: vWillkommen,
    home: vHome,
    buddy: vBuddyBearbeiten,
    klingeln: vKlingeln,
    anruf: vAnruf,
    nachher: vNachher,
    verlauf: vVerlauf,
    gedaechtnis: vGedaechtnis,
    einstellungen: vEinstellungen,
  };
  app.innerHTML = (ansichten[v] || vHome)();
}

function kopf(titel, zurueck = 'home') {
  return `<header class="kopf"><button class="zurueck" data-aktion="gehe" data-ziel="${zurueck}" aria-label="Zurück">‹</button><h1>${esc(titel)}</h1></header>`;
}

// ---------- Ansichten ----------

function vWillkommen() {
  const nu = daten.nutzer || {};
  return `<main class="seite">
  <h1 class="gross-titel">Willkommen bei Buddy</h1>
  <p class="leise">Ein paar Fragen, damit dein Buddy zu dir passt. Alles bleibt auf diesem Gerät gespeichert.</p>
  <form id="f-willkommen" class="formular">
    <label>Wie heißt du?<input name="name" required autocomplete="given-name" value="${esc(nu.name)}"></label>
    <label>Wie alt bist du? <span class="leise">(optional)</span><input name="alter" type="number" min="5" max="120" inputmode="numeric" value="${esc(nu.alter)}"></label>
    <fieldset><legend>Wofür möchtest du Buddy nutzen?</legend>
      ${Object.entries(ROLLEN)
        .map(
          ([k, r], i) =>
            `<label class="wahl"><input type="radio" name="rolle" value="${k}" ${i === 0 ? 'checked' : ''}><span><b>${esc(r.label)}</b><br><small>${esc(r.beschreibung)}</small></span></label>`,
        )
        .join('')}
    </fieldset>
    <fieldset><legend>Brauchst du beim Sprechen manchmal mehr Zeit?</legend>
      <label class="wahl"><input type="radio" name="tempo" value="normal" checked><span>Nein</span></label>
      <label class="wahl"><input type="radio" name="tempo" value="ruhig"><span>Manchmal</span></label>
      <label class="wahl"><input type="radio" name="tempo" value="langsam"><span>Ja, oft</span></label>
    </fieldset>
    <fieldset><legend>Wie gut hörst du?</legend>
      <label class="wahl"><input type="radio" name="hoeren" value="gut" checked><span>Gut</span></label>
      <label class="wahl"><input type="radio" name="hoeren" value="schlecht"><span>Nicht so gut</span></label>
    </fieldset>
    <label>In welcher Sprache soll dein Buddy sprechen?<select name="sprache">${optionen(SPRACHEN, 'de')}</select></label>
    <fieldset><legend>Wie soll dein Buddy dich ansprechen?</legend>
      <label class="wahl"><input type="radio" name="anrede" value="du" checked><span>Mit „du“</span></label>
      <label class="wahl"><input type="radio" name="anrede" value="sie"><span>Mit „Sie“</span></label>
    </fieldset>
    <label>Dein Gemini-Schlüssel
      <input name="key" type="password" required autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="AIza…" value="${esc(getApiKey())}">
      <small class="leise">Aus Google AI Studio (Schlüssel-Symbol unten links). Er wird nur auf diesem Gerät gespeichert.</small>
    </label>
    <div class="hinweis">
      <b>Wichtig zum Datenschutz:</b> In der kostenlosen Stufe darf Google deine Gespräche zur Verbesserung seiner Produkte nutzen. Erzähl deshalb keine Passwörter, Firmengeheimnisse oder sehr private Gesundheitsdetails.
      <label class="wahl"><input type="checkbox" name="ok" required><span>Verstanden</span></label>
    </div>
    <button class="knopf haupt" type="submit">Los geht's</button>
  </form>
</main>`;
}

function vHome() {
  const nu = daten.nutzer || {};
  const proTag = bewertungenProTag(daten);
  const punkte = [];
  const zaehler = { gut: 0, mittel: 0, schlecht: 0 };
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const w = proTag[tagSchluessel(d)];
    if (w) zaehler[w]++;
    if (i < 14) {
      punkte.push(
        `<span class="punkt ${w || 'leer'}" title="${d.toLocaleDateString('de-DE')}${w ? ': ' + BEWERTUNG_TEXT[w] : ''}"></span>`,
      );
    }
  }
  const bewertet = zaehler.gut + zaehler.mittel + zaehler.schlecht;

  return `<main class="seite">
  <h1 class="gross-titel">Hallo ${esc(nu.name)}</h1>
  <section class="liste">
    ${daten.buddies
      .map((b) => {
        const r = ROLLEN[b.rolle] || ROLLEN.coach;
        return `<div class="karte buddy-karte">
        ${avatar(b)}
        <div class="buddy-info"><b>${esc(b.name)}</b><span class="leise">${esc(r.label)} · ${esc(SPRACHEN[b.sprache] || 'Deutsch')}</span></div>
        <div class="buddy-knoepfe">
          <button class="knopf anrufen" data-aktion="anrufen" data-id="${b.id}" aria-label="${esc(b.name)} anrufen">📞</button>
          <button class="knopf klein" data-aktion="bearbeiten" data-id="${b.id}">Bearbeiten</button>
        </div>
      </div>`;
      })
      .join('')}
    <button class="knopf zweit" data-aktion="neuerBuddy">+ Neuer Buddy</button>
  </section>

  <section class="karte">
    <h2>Deine Tage</h2>
    <div class="punkte">${punkte.join('')}</div>
    <p class="leise klein-text">Letzte 14 Tage (links älter, rechts heute)</p>
    ${
      bewertet
        ? `<p>In den letzten 30 Tagen: <b>${zaehler.gut}</b> gut · <b>${zaehler.mittel}</b> mittel · <b>${zaehler.schlecht}</b> schwer</p>`
        : `<p class="leise">Nach jedem Gespräch kannst du deinen Tag mit einem Tipp einordnen. Hier siehst du dann, wie deine Tage so laufen.</p>`
    }
  </section>

  <nav class="menue">
    <button class="knopf zweit" data-aktion="gehe" data-ziel="verlauf">Gespräche & Mitnehmen</button>
    <button class="knopf zweit" data-aktion="gehe" data-ziel="gedaechtnis">Was sich Buddy merkt</button>
    <button class="knopf zweit" data-aktion="gehe" data-ziel="einstellungen">Einstellungen</button>
  </nav>
</main>`;
}

function vBuddyBearbeiten() {
  const neu = !ansicht.id;
  const rolleStart = ansicht.rolle || 'coach';
  const b = neu
    ? {
        name: ROLLEN[rolleStart].standardName,
        rolle: rolleStart,
        sprache: 'de',
        anrede: 'du',
        stimme: ROLLEN[rolleStart].stimme,
        tempo: 'profil',
        wuensche: '',
      }
    : buddy(ansicht.id);
  if (!b) return vHome();

  return `<main class="seite">
  ${kopf(neu ? 'Neuer Buddy' : `${b.name} bearbeiten`)}
  <form id="f-buddy" class="formular">
    <label>Name<input name="name" required value="${esc(b.name)}"></label>
    <label>Rolle<select name="rolle">${Object.entries(ROLLEN)
      .map(([k, r]) => `<option value="${k}" ${k === b.rolle ? 'selected' : ''}>${esc(r.label)} – ${esc(r.beschreibung)}</option>`)
      .join('')}</select></label>
    <label>Sprache<select name="sprache">${optionen(SPRACHEN, b.sprache)}</select></label>
    <label>Anrede<select name="anrede">${optionen({ du: 'du', sie: 'Sie' }, b.anrede)}</select></label>
    <label>Stimme<select name="stimme">${STIMMEN.map((s) => `<option value="${s.id}" ${s.id === b.stimme ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}</select>
      <small class="leise">Am besten ausprobieren und bei Bedarf wechseln.</small></label>
    <label>Sprechtempo<select name="tempo">${optionen({ profil: 'Wie in meinem Profil', ...TEMPI }, b.tempo || 'profil')}</select></label>
    <label>Besondere Wünsche an ${neu ? 'deinen Buddy' : esc(b.name)} <span class="leise">(optional)</span>
      <textarea name="wuensche" rows="3" placeholder="z. B. „Frag mich abends nach meinen Meetings“ oder „Sei ruhig etwas frech“">${esc(b.wuensche)}</textarea></label>
    <button class="knopf haupt" type="submit">Speichern</button>
  </form>
  ${
    neu
      ? ''
      : `<section class="karte">
    <h2>Automatisch anrufen lassen</h2>
    <p>Damit ${esc(b.name)} dich zu einer festen Zeit „anruft“, verknüpfst du einen iPhone-Wecker mit diesem Link:</p>
    <div class="link-box"><code id="anruf-link">${esc(anrufLink(b))}</code></div>
    <button class="knopf zweit" data-aktion="kopieren" data-text="${esc(anrufLink(b))}">Link kopieren</button>
    <ol class="anleitung">
      <li>In der <b>Uhr</b>-App einen Wecker stellen, z. B. „${esc(b.name)} ruft an“ um 20:00.</li>
      <li>In <b>Kurzbefehle</b> einen Kurzbefehl mit der Aktion <b>„URL öffnen“</b> und diesem Link anlegen.</li>
      <li>Unter <b>Automation</b> → <b>Wecker</b> → <b>„Wird gestoppt“</b> den Wecker wählen, <b>„Sofort ausführen“</b>, dann den Kurzbefehl wählen.</li>
      <li>Wenn es klingelt: <b>Stoppen</b> → entsperren → auf die Mitteilung tippen → <b>Annehmen</b>.</li>
    </ol>
  </section>
  <button class="knopf gefahr" data-aktion="buddyLoeschen" data-id="${b.id}">${esc(b.name)} löschen</button>`
  }
</main>`;
}

function vKlingeln() {
  const b = buddy(ansicht.id);
  if (!b) return vHome();
  return `<main class="anrufseite">
  <div class="anruf-oben">
    <p class="anruf-label">KI-Anruf</p>
    ${avatar(b, true)}
    <h1>${esc(b.name)}</h1>
    <p class="anruf-status">ruft an …</p>
  </div>
  <div class="anruf-knoepfe zwei">
    <div><button class="rund rot" data-aktion="ablehnen" aria-label="Ablehnen">✕</button><span>Ablehnen</span></div>
    <div><button class="rund gruen wackeln" data-aktion="annehmen" aria-label="Annehmen">📞</button><span>Annehmen</span></div>
  </div>
</main>`;
}

function vAnruf() {
  const b = buddy(ansicht.id);
  if (!b) return vHome();
  const ut = daten.technik.untertitel;
  return `<main class="anrufseite">
  <div class="anruf-oben">
    <p class="anruf-label">KI-Anruf</p>
    ${avatar(b, true)}
    <h1>${esc(b.name)}</h1>
    <p class="anruf-status" id="status">Verbinde …</p>
    <p class="anruf-zeit" id="zeit"></p>
    <div class="pegel"><div id="pegel"></div></div>
  </div>
  <div class="untertitel ${ut ? '' : 'aus'}">
    <p class="ut-buddy" id="ut-buddy"></p>
    <p class="ut-du" id="ut-du"></p>
  </div>
  <div class="anruf-knoepfe zwei">
    <div><button class="rund grau" id="stumm-knopf" data-aktion="stumm" aria-label="Stummschalten">🎙️</button><span id="stumm-text">Stumm</span></div>
    <div><button class="rund rot" data-aktion="auflegen" aria-label="Auflegen">✕</button><span>Auflegen</span></div>
  </div>
</main>`;
}

function mitnehmenHtml(g) {
  if (!g.mitnehmen || !g.mitnehmen.length) return '';
  return `<div class="mitnehmen">
    <h3>Zum Mitnehmen</h3>
    <ul>${g.mitnehmen
      .map(
        (m) =>
          `<li>${esc(m.gedanke)}${
            m.nachpruefen
              ? ` <a class="pruefen" href="https://www.google.com/search?q=${encodeURIComponent(m.nachpruefen)}" target="_blank" rel="noopener">nachprüfen</a>`
              : ''
          }</li>`,
      )
      .join('')}</ul>
  </div>`;
}

function vNachher() {
  const g = daten.gespraeche.find((x) => x.id === ansicht.gespraechId);
  if (!g) return vHome();
  const b = buddy(g.buddyId) || { name: 'Buddy', rolle: 'coach' };
  let zusammen = '';
  if (g.zusammenfassungStatus === 'laeuft') {
    zusammen = `<p class="leise">Zusammenfassung wird erstellt …</p>`;
  } else if (g.zusammenfassungStatus === 'fehler') {
    zusammen = `<p class="fehler">Zusammenfassung hat nicht geklappt: ${esc(g.zusammenfassungFehler)}</p>
      <button class="knopf zweit" data-aktion="zusammenfassen" data-id="${g.id}">Nochmal versuchen</button>`;
  } else if (g.zusammenfassung) {
    zusammen = `<p>${esc(g.zusammenfassung)}</p>${mitnehmenHtml(g)}`;
  }

  return `<main class="seite">
  <div class="mitte">
    ${avatar(b, true)}
    <h1>Gespräch mit ${esc(b.name)} beendet</h1>
    <p class="leise">${dauerText(g.dauerSek || 0)} Minuten</p>
    ${g.endeText ? `<p class="${g.endeGrund === 'fehler' ? 'fehler' : 'leise'}">${esc(g.endeText)}</p>` : ''}
  </div>

  <section class="karte">
    <h2>Wie war dein Tag?</h2>
    <div class="bewertung">
      ${['gut', 'mittel', 'schlecht']
        .map(
          (w) =>
            `<button class="bew ${w} ${g.bewertung === w ? 'aktiv' : ''}" data-aktion="bewerten" data-wert="${w}" data-id="${g.id}"><span class="bew-punkt ${w}"></span>${BEWERTUNG_TEXT[w]}</button>`,
        )
        .join('')}
    </div>
    <p class="leise klein-text">Du entscheidest selbst. Die Einordnung siehst du später auf der Startseite.</p>
  </section>

  ${zusammen ? `<section class="karte">${zusammen}</section>` : ''}

  <button class="knopf haupt" data-aktion="gehe" data-ziel="home">Fertig</button>
</main>`;
}

function vVerlauf() {
  const liste = [...daten.gespraeche].sort((a, b) => b.start - a.start);
  return `<main class="seite">
  ${kopf('Gespräche & Mitnehmen')}
  ${liste.length ? '' : '<p class="leise">Noch keine Gespräche.</p>'}
  ${liste
    .map((g) => {
      const b = buddy(g.buddyId);
      return `<section class="karte">
      <div class="zeile"><b>${esc(b ? b.name : 'Buddy')}</b><span class="leise">${datumZeit(g.start)} · ${dauerText(g.dauerSek || 0)}</span></div>
      ${g.bewertung ? `<p><span class="bew-punkt ${g.bewertung}"></span> ${BEWERTUNG_TEXT[g.bewertung]}</p>` : ''}
      ${g.zusammenfassung ? `<p>${esc(g.zusammenfassung)}</p>` : ''}
      ${mitnehmenHtml(g)}
      ${
        !g.zusammenfassung && g.transkript && g.transkript.length
          ? `<button class="knopf klein" data-aktion="zusammenfassen" data-id="${g.id}">Zusammenfassung erstellen</button>`
          : ''
      }
      ${
        g.transkript && g.transkript.length
          ? `<details><summary>Gesprächsverlauf</summary>${g.transkript
              .map((z) => `<p class="${z.wer === 'du' ? 'tr-du' : 'tr-buddy'}"><b>${z.wer === 'du' ? 'Du' : esc(b ? b.name : 'Buddy')}:</b> ${esc(z.text)}</p>`)
              .join('')}</details>`
          : ''
      }
      <button class="knopf klein gefahr-text" data-aktion="gespraechLoeschen" data-id="${g.id}">Löschen</button>
    </section>`;
    })
    .join('')}
</main>`;
}

function vGedaechtnis() {
  return `<main class="seite">
  ${kopf('Was sich Buddy merkt')}
  <p class="leise">Diese Punkte haben deine Buddys aus euren Gesprächen behalten. Sie nutzen sie im nächsten Gespräch. Was nicht stimmt oder privat bleiben soll, kannst du löschen.</p>
  <form id="f-fakt" class="zeile-form"><input name="text" placeholder="Selbst etwas hinzufügen …"><button class="knopf klein" type="submit">+</button></form>
  ${daten.fakten.length ? '' : '<p class="leise">Noch nichts gemerkt.</p>'}
  <ul class="fakten">
    ${daten.fakten
      .map((f, i) => `<li><span>${esc(f.text)}</span><button class="x" data-aktion="faktLoeschen" data-index="${i}" aria-label="Löschen">✕</button></li>`)
      .join('')}
  </ul>
</main>`;
}

function vEinstellungen() {
  const nu = daten.nutzer || {};
  const t = daten.technik;
  return `<main class="seite">
  ${kopf('Einstellungen')}
  <form id="f-profil" class="formular karte">
    <h2>Über dich</h2>
    <label>Name<input name="name" required value="${esc(nu.name)}"></label>
    <label>Alter<input name="alter" type="number" min="5" max="120" inputmode="numeric" value="${esc(nu.alter)}"></label>
    <label>Über mich <span class="leise">(z. B. Beruf, Familie, Wohnort)</span><textarea name="ueberMich" rows="3">${esc(nu.ueberMich)}</textarea></label>
    <label>Interessen<textarea name="interessen" rows="2">${esc(nu.interessen)}</textarea></label>
    <label>Sprechtempo<select name="tempo">${optionen(TEMPI, nu.tempo || 'normal')}</select></label>
    <label>Hören<select name="hoeren">${optionen({ gut: 'Gut', schlecht: 'Nicht so gut' }, nu.hoeren || 'gut')}</select></label>
    <button class="knopf haupt" type="submit">Speichern</button>
  </form>

  <form id="f-schluessel" class="formular karte">
    <h2>Gemini-Schlüssel</h2>
    <p class="leise">Gespeichert: ${getApiKey() ? '••••' + esc(getApiKey().slice(-4)) : 'keiner'}</p>
    <label>Neuer Schlüssel<input name="key" type="password" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="AIza…"></label>
    <button class="knopf zweit" type="submit">Schlüssel ersetzen</button>
  </form>

  <form id="f-technik" class="formular karte">
    <h2>Technik</h2>
    <label class="wahl"><input type="checkbox" name="untertitel" ${t.untertitel ? 'checked' : ''}><span>Untertitel während des Gesprächs anzeigen</span></label>
    <label class="wahl"><input type="checkbox" name="unterbrechen" ${t.unterbrechen ? 'checked' : ''}><span>Ich darf den Buddy unterbrechen<br><small class="leise">Ausschalten, falls der Buddy sich selbst ins Wort fällt (Echo über den Lautsprecher).</small></span></label>
    <label>Sprach-Modell<input name="liveModell" value="${esc(t.liveModell)}" autocapitalize="off" spellcheck="false"><small class="leise">Standard: ${STANDARD_LIVE_MODELL}</small></label>
    <label>Text-Modell für Zusammenfassungen<input name="textModell" value="${esc(t.textModell)}" placeholder="automatisch" autocapitalize="off" spellcheck="false"></label>
    <button class="knopf zweit" type="submit">Speichern</button>
    <button class="knopf zweit" type="button" data-aktion="testen">Verbindung testen</button>
    <p id="test-ergebnis" class="leise"></p>
  </form>

  <section class="karte">
    <h2>Deine Daten</h2>
    <p class="leise">Safari kann Website-Daten löschen, wenn du Buddy länger als etwa eine Woche nicht öffnest. Mach ab und zu eine Sicherung.</p>
    <button class="knopf zweit" data-aktion="exportieren">Sicherung herunterladen</button>
    <label class="knopf zweit datei">Sicherung einspielen<input type="file" accept="application/json,.json" id="import-datei" hidden></label>
    <button class="knopf gefahr" data-aktion="allesLoeschen">Alles löschen</button>
  </section>
  <p class="leise klein-text mitte">Buddy · Version 1</p>
</main>`;
}

// ---------- Klingeln ----------

function klingelnStarten() {
  klingelnStoppen();
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    const ctx = new AC();
    ctx.resume().catch(() => {});
    const ton = () => {
      if (ctx.state !== 'running') return; // iOS: ohne Antippen kein Ton – der Wecker hat ja schon geklingelt
      const t = ctx.currentTime;
      for (const f of [440, 480]) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(0.06, t + 0.05);
        g.gain.setValueAtTime(0.06, t + 1.5);
        g.gain.linearRampToValueAtTime(0, t + 1.6);
        o.connect(g).connect(ctx.destination);
        o.start(t);
        o.stop(t + 1.7);
      }
    };
    ton();
    const iv = setInterval(ton, 3500);
    klingel = { ctx, iv };
  } catch {}
  clearTimeout(klingelTimeout);
  klingelTimeout = setTimeout(() => {
    if (ansicht.name === 'klingeln') {
      klingelnStoppen();
      zeige({ name: 'home' });
      toast('Verpasster Anruf. Du kannst jederzeit selbst anrufen.');
    }
  }, 90000);
}

function klingelnStoppen() {
  clearTimeout(klingelTimeout);
  if (!klingel) return;
  clearInterval(klingel.iv);
  klingel.ctx.close().catch(() => {});
  klingel = null;
}

// ---------- Anruf ----------

function anrufStarten(buddyId, richtung) {
  const b = buddy(buddyId);
  const key = getApiKey();
  if (!b) return;
  if (!key) {
    toast('Bitte zuerst den Gemini-Schlüssel in den Einstellungen eintragen.');
    return zeige({ name: 'einstellungen' });
  }
  klingelnStoppen();
  zeige({ name: 'anruf', id: b.id });

  const start = Date.now();
  const statusEl = () => document.getElementById('status');

  anruf = new LiveAnruf({
    apiKey: key,
    modell: daten.technik.liveModell || STANDARD_LIVE_MODELL,
    systemText: systemPrompt(daten, b),
    stimme: b.stimme || ROLLEN[b.rolle].stimme,
    tempo: effektivesTempo(daten, b),
    unterbrechen: daten.technik.unterbrechen,
    begruessung: begruessung(daten, b, richtung),
    onStatus: (text) => {
      const el = statusEl();
      if (!el) return;
      if (text === 'verbunden') {
        el.textContent = 'verbunden';
        clearInterval(anrufTimer);
        const t0 = Date.now();
        anrufTimer = setInterval(() => {
          const z = document.getElementById('zeit');
          if (z) z.textContent = dauerText(Math.round((Date.now() - t0) / 1000));
        }, 1000);
      } else {
        el.textContent = text;
      }
    },
    onUntertitel: (wer, text) => {
      const el = document.getElementById(wer === 'du' ? 'ut-du' : 'ut-buddy');
      if (el) el.textContent = text.length > 220 ? '… ' + text.slice(-220) : text;
    },
    onPegel: (wert) => {
      const el = document.getElementById('pegel');
      if (el) el.style.width = `${Math.min(100, Math.round(wert * 400))}%`;
    },
    onEnde: (ergebnis) => anrufBeendet(b, start, ergebnis),
  });
  anruf.starten();
}

function anrufBeendet(b, start, { grund, text, dauerSek, transkript }) {
  clearInterval(anrufTimer);
  anruf = null;
  const g = {
    id: neueId(),
    buddyId: b.id,
    start,
    dauerSek,
    endeGrund: grund,
    endeText: text,
    transkript,
    bewertung: null,
    zusammenfassung: '',
    mitnehmen: [],
  };
  const hatInhalt = transkript.some((z) => z.wer === 'du');
  if (!hatInhalt && grund === 'fehler') {
    // Nicht zustande gekommen: nicht im Verlauf speichern, nur Fehler zeigen.
    zeige({ name: 'home' });
    zeigeFehler(text);
    return;
  }
  daten.gespraeche.push(g);
  sichern();
  zeige({ name: 'nachher', gespraechId: g.id });
  if (hatInhalt) zusammenfassen(g.id);
}

function zeigeFehler(text) {
  const el = document.createElement('div');
  el.className = 'dialog-hinter';
  el.innerHTML = `<div class="dialog"><h2>Das hat nicht geklappt</h2><p>${esc(text)}</p><button class="knopf haupt" data-aktion="dialogZu">OK</button></div>`;
  document.body.appendChild(el);
}

async function zusammenfassen(gespraechId) {
  const g = daten.gespraeche.find((x) => x.id === gespraechId);
  if (!g) return;
  const b = buddy(g.buddyId) || { name: 'Buddy', rolle: 'coach' };
  g.zusammenfassungStatus = 'laeuft';
  if (ansicht.name === 'nachher' || ansicht.name === 'verlauf') render();
  try {
    const modelle = daten.technik.textModell
      ? [daten.technik.textModell, ...STANDARD_TEXT_MODELLE.filter((m) => m !== daten.technik.textModell)]
      : STANDARD_TEXT_MODELLE;
    const { modell, text } = await textAnfrage(getApiKey(), modelle, zusammenfassungPrompt(daten, b, g.transkript));
    const ergebnis = ergebnisBereinigen(jsonAusText(text));
    g.zusammenfassung = ergebnis.zusammenfassung || '(kurzes Gespräch)';
    g.mitnehmen = ergebnis.mitnehmen;
    faktenAktualisieren(daten, ergebnis, g.id);
    if (!daten.technik.textModell) daten.technik.textModell = modell;
    g.zusammenfassungStatus = 'fertig';
  } catch (e) {
    console.error(e);
    g.zusammenfassungStatus = 'fehler';
    g.zusammenfassungFehler = e.message || String(e);
  }
  sichern();
  if (ansicht.name === 'nachher' || ansicht.name === 'verlauf') render();
}

// ---------- Aktionen ----------

const aktionen = {
  gehe: (el) => zeige({ name: el.dataset.ziel }),
  anrufen: (el) => anrufStarten(el.dataset.id, 'ausgehend'),
  annehmen: () => anrufStarten(ansicht.id, 'eingehend'),
  ablehnen: () => {
    klingelnStoppen();
    zeige({ name: 'home' });
  },
  auflegen: () => {
    if (anruf) anruf.auflegen();
    else zeige({ name: 'home' });
  },
  stumm: () => {
    if (!anruf) return;
    const neu = !anruf.stumm;
    anruf.setStumm(neu);
    const k = document.getElementById('stumm-knopf');
    const t = document.getElementById('stumm-text');
    if (k) k.classList.toggle('aktiv', neu);
    if (t) t.textContent = neu ? 'Stumm an' : 'Stumm';
  },
  bearbeiten: (el) => zeige({ name: 'buddy', id: el.dataset.id }),
  neuerBuddy: () => zeige({ name: 'buddy' }),
  buddyLoeschen: (el) => {
    const b = buddy(el.dataset.id);
    if (!b || !confirm(`${b.name} wirklich löschen? Die Gespräche bleiben im Verlauf.`)) return;
    daten.buddies = daten.buddies.filter((x) => x.id !== b.id);
    sichern();
    zeige({ name: 'home' });
  },
  kopieren: async (el) => {
    try {
      await navigator.clipboard.writeText(el.dataset.text);
      toast('Link kopiert.');
    } catch {
      toast('Kopieren ging nicht. Halte den Link gedrückt und kopiere ihn von Hand.');
    }
  },
  bewerten: (el) => {
    const g = daten.gespraeche.find((x) => x.id === el.dataset.id);
    if (!g) return;
    g.bewertung = g.bewertung === el.dataset.wert ? null : el.dataset.wert;
    sichern();
    render();
  },
  zusammenfassen: (el) => zusammenfassen(el.dataset.id),
  gespraechLoeschen: (el) => {
    if (!confirm('Dieses Gespräch löschen?')) return;
    daten.gespraeche = daten.gespraeche.filter((g) => g.id !== el.dataset.id);
    sichern();
    render();
  },
  faktLoeschen: (el) => {
    daten.fakten.splice(Number(el.dataset.index), 1);
    sichern();
    render();
  },
  testen: async () => {
    const out = document.getElementById('test-ergebnis');
    if (out) out.textContent = 'Teste …';
    const r = await verbindungTesten({ apiKey: getApiKey(), modell: daten.technik.liveModell || STANDARD_LIVE_MODELL });
    if (out) {
      out.textContent = (r.ok ? '✓ ' : '✕ ') + r.text;
      out.className = r.ok ? 'ok' : 'fehler';
    }
  },
  exportieren: () => {
    const blob = new Blob([exportJson(daten)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `buddy-sicherung-${tagSchluessel()}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  },
  allesLoeschen: () => {
    if (!confirm('Wirklich alles löschen? Buddys, Gespräche, Gedächtnis und Schlüssel sind dann weg.')) return;
    allesLoeschen();
    daten = leereDaten();
    zeige({ name: 'willkommen' });
  },
  dialogZu: (el) => el.closest('.dialog-hinter').remove(),
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-aktion]');
  if (!el) return;
  const f = aktionen[el.dataset.aktion];
  if (f) {
    e.preventDefault();
    f(el, e);
  }
});

// ---------- Formulare ----------

function formDaten(form) {
  const fd = new FormData(form);
  const o = {};
  for (const [k, v] of fd.entries()) o[k] = typeof v === 'string' ? v.trim() : v;
  return o;
}

document.addEventListener('submit', (e) => {
  const form = e.target;
  e.preventDefault();
  const f = formDaten(form);

  if (form.id === 'f-willkommen') {
    if (!f.key || f.key.length < 20) return toast('Der Schlüssel sieht unvollständig aus. Bitte komplett einfügen.');
    setApiKey(f.key);
    daten.nutzer = {
      ...(daten.nutzer || {}),
      name: f.name,
      alter: f.alter || '',
      tempo: f.tempo || 'normal',
      hoeren: f.hoeren || 'gut',
    };
    if (!daten.buddies.length) {
      const r = ROLLEN[f.rolle] || ROLLEN.coach;
      daten.buddies.push({
        id: neueId(),
        name: r.standardName,
        rolle: f.rolle || 'coach',
        sprache: f.sprache || 'de',
        anrede: f.anrede || 'du',
        stimme: r.stimme,
        tempo: 'profil',
        wuensche: '',
      });
    }
    sichern();
    zeige({ name: 'home' });
    toast('Fertig! Tipp auf 📞, um deinen Buddy anzurufen.');
    return;
  }

  if (form.id === 'f-buddy') {
    const werte = {
      name: f.name,
      rolle: f.rolle,
      sprache: f.sprache,
      anrede: f.anrede,
      stimme: f.stimme,
      tempo: f.tempo,
      wuensche: f.wuensche,
    };
    if (ansicht.id) {
      Object.assign(buddy(ansicht.id), werte);
      sichern();
      toast('Gespeichert.');
      zeige({ name: 'buddy', id: ansicht.id });
    } else {
      const neu = { id: neueId(), ...werte };
      daten.buddies.push(neu);
      sichern();
      toast(`${neu.name} ist angelegt.`);
      zeige({ name: 'buddy', id: neu.id });
    }
    return;
  }

  if (form.id === 'f-profil') {
    daten.nutzer = { ...daten.nutzer, name: f.name, alter: f.alter, ueberMich: f.ueberMich, interessen: f.interessen, tempo: f.tempo, hoeren: f.hoeren };
    sichern();
    toast('Gespeichert.');
    return;
  }

  if (form.id === 'f-schluessel') {
    if (!f.key || f.key.length < 20) return toast('Der Schlüssel sieht unvollständig aus.');
    setApiKey(f.key);
    toast('Schlüssel gespeichert.');
    render();
    return;
  }

  if (form.id === 'f-technik') {
    daten.technik.untertitel = !!f.untertitel;
    daten.technik.unterbrechen = !!f.unterbrechen;
    daten.technik.liveModell = f.liveModell || STANDARD_LIVE_MODELL;
    daten.technik.textModell = f.textModell || '';
    sichern();
    toast('Gespeichert.');
    return;
  }

  if (form.id === 'f-fakt') {
    if (!f.text) return;
    daten.fakten.push({ text: f.text, seit: Date.now(), quelle: 'selbst' });
    sichern();
    render();
  }
});

// Wer im Willkommen-Formular ein höheres Alter einträgt, bekommt mehr Zeit beim Sprechen vorgeschlagen.
document.addEventListener('input', (e) => {
  if (e.target.name === 'alter' && e.target.form && e.target.form.id === 'f-willkommen') {
    const alter = parseInt(e.target.value, 10);
    const ziel = alter >= 80 ? 'langsam' : alter >= 70 ? 'ruhig' : 'normal';
    const radio = e.target.form.querySelector(`input[name="tempo"][value="${ziel}"]`);
    if (radio) radio.checked = true;
  }
});

document.addEventListener('change', async (e) => {
  if (e.target.id !== 'import-datei' || !e.target.files || !e.target.files[0]) return;
  try {
    const text = await e.target.files[0].text();
    const neu = importJson(text);
    if (!confirm('Sicherung einspielen? Die aktuellen Daten werden ersetzt (dein Schlüssel bleibt).')) return;
    daten = neu;
    sichern();
    toast('Sicherung eingespielt.');
    zeige({ name: 'home' });
  } catch (err) {
    toast('Einspielen fehlgeschlagen: ' + err.message);
  }
});

// Nach dem Rendern: Klingeln starten/stoppen.
const beobachter = new MutationObserver(() => {
  if (ansicht.name === 'klingeln' && !klingel) klingelnStarten();
  if (ansicht.name !== 'klingeln' && klingel) klingelnStoppen();
});
beobachter.observe(app, { childList: true });

window.addEventListener('pagehide', () => {
  if (anruf) anruf.auflegen();
});

// ---------- Start ----------

function start() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch {}
  const p = new URLSearchParams(location.search);
  const anrufId = p.get('anruf');
  if (anrufId !== null) history.replaceState(null, '', location.pathname);

  if (!daten.nutzer || !getApiKey() || !daten.buddies.length) {
    zeige({ name: 'willkommen' });
  } else if (anrufId !== null) {
    const b = buddy(anrufId) || daten.buddies[0];
    zeige({ name: 'klingeln', id: b.id });
  } else {
    zeige({ name: 'home' });
  }
}

start();
