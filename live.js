// Buddy – Live-Sprachverbindung zu Google Gemini (WebSocket) inkl. Mikrofon und Wiedergabe.

const STANDARD_WS =
  'wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContent';

function wsAdresse() {
  // Nur für automatische Tests: erlaubt einen Testserver statt Google.
  try {
    return localStorage.getItem('buddy.debug.ws') || STANDARD_WS;
  } catch {
    return STANDARD_WS;
  }
}

// Wie lange Stille als „fertig gesprochen“ gilt – je nach Sprechtempo.
const TEMPO_VAD = {
  normal: { silenceDurationMs: 800 },
  ruhig: { silenceDurationMs: 1500, endOfSpeechSensitivity: 'END_SENSITIVITY_LOW' },
  langsam: { silenceDurationMs: 2500, endOfSpeechSensitivity: 'END_SENSITIVITY_LOW', prefixPaddingMs: 300 },
};

export function setupNachricht({ modell, systemText, stimme, tempo, minimal }) {
  const setup = {
    model: `models/${modell}`,
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: stimme } } },
    },
    systemInstruction: { parts: [{ text: systemText }] },
    inputAudioTranscription: {},
    outputAudioTranscription: {},
  };
  if (!minimal) {
    setup.realtimeInputConfig = { automaticActivityDetection: { ...(TEMPO_VAD[tempo] || TEMPO_VAD.normal) } };
    setup.contextWindowCompression = { slidingWindow: {} };
  }
  return { setup };
}

export function fehlerText(code, grund) {
  const g = grund || '';
  if (/api[ _-]?key|API_KEY|permission|unauthori[sz]ed|PERMISSION_DENIED/i.test(g)) {
    return 'Google lehnt den Schlüssel ab. Prüfe in den Einstellungen, ob der Gemini-Schlüssel vollständig und richtig eingefügt ist.';
  }
  if (/quota|RESOURCE_EXHAUSTED|rate limit|exceeded/i.test(g)) {
    return 'Das kostenlose Kontingent von Google ist gerade ausgeschöpft. Versuch es später noch einmal.';
  }
  if (/not found|not supported|unsupported|is not available|models\//i.test(g)) {
    return `Das KI-Modell ist bei Google nicht (mehr) verfügbar. Unter Einstellungen → Technik kannst du ein anderes Modell eintragen. (Google meldet: ${g})`;
  }
  if (code === 1006) return 'Die Verbindung zu Google ist abgebrochen. Prüfe dein Internet.';
  return `Verbindung beendet (Code ${code}${g ? `: ${g}` : ''}).`;
}

function istKonfigFehler(code, grund) {
  return code === 1007 && !/api[ _-]?key|quota|exhaust|models\/|not found/i.test(grund || '');
}

function zuBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  }
  return btoa(s);
}

function ausBase64ZuFloat(b64) {
  const bin = atob(b64);
  const n = bin.length >> 1;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let v = bin.charCodeAt(2 * i) | (bin.charCodeAt(2 * i + 1) << 8);
    if (v >= 0x8000) v -= 0x10000;
    out[i] = v / 32768;
  }
  return out;
}

function abtastrate(mime) {
  const m = /rate=(\d+)/.exec(mime || '');
  return m ? parseInt(m[1], 10) : 24000;
}

async function nachrichtLesen(roh) {
  if (typeof Blob !== 'undefined' && roh instanceof Blob) roh = await roh.text();
  else if (roh instanceof ArrayBuffer) roh = new TextDecoder().decode(roh);
  try {
    return JSON.parse(roh);
  } catch {
    return null;
  }
}

function istFatal(grund) {
  return /api[ _-]?key|API_KEY|permission|PERMISSION_DENIED|quota|RESOURCE_EXHAUSTED|exceeded/i.test(grund || '');
}

function uhr(ms) {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

const MAX_NEUVERSUCHE = 3;
const ANTWORT_TIMEOUT_MS = 12000;

export class LiveAnruf {
  /**
   * opts: apiKey, modell, systemText, stimme, tempo, unterbrechen, begruessung, nameNutzer,
   *       onStatus(text), onUntertitel(wer, text), onPegel(wert), onTonUnterbrochen(bool),
   *       onEnde({grund, text, dauerSek, transkript, protokoll})
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.transkript = [];
    this.protokoll = [];
    this.aktUser = '';
    this.aktBuddy = '';
    this.quellen = new Set();
    this.playHead = 0;
    this.stumm = false;
    this.beendet = false;
    this.bereit = false;
    this.minimal = false;
    this.fortsetzen = false;
    this.startZeit = 0;
    this.erstellt = Date.now();
    this.neuVersuche = 0;
    this.verbindungen = 0;
    this.letzteUserZeit = 0;
    this.letzteModellZeit = 0;
    this.letzteMicZeit = 0;
    this.goAway = false;
    this.tonGestoert = false;
    this.tokens = 0;
  }

  _log(text) {
    const eintrag = `${uhr(Date.now() - this.erstellt)}  ${text}`;
    this.protokoll.push(eintrag);
    if (this.protokoll.length > 300) this.protokoll.splice(0, 50);
    console.log('[Buddy]', eintrag);
  }

  // Muss direkt im Klick-Handler aufgerufen werden (iOS erlaubt Audio nur nach Nutzeraktion).
  starten() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.ctx.resume().catch(() => {});
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'play-and-record';
    } catch {}
    this._log(`Start · ${navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90)}`);
    this._init().catch((e) => this._ende('fehler', (e && e.message) || String(e)));
  }

  async _init() {
    this.onStatus('Mikrofon wird gestartet …');
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Dieser Browser erlaubt keinen Mikrofonzugriff. Bitte öffne Buddy in Safari.');
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 },
      });
    } catch (e) {
      throw new Error(
        'Kein Zugriff aufs Mikrofon. Erlaube das Mikrofon in Safari: auf „aA“ links in der Adressleiste tippen → Website-Einstellungen → Mikrofon → Erlauben.',
      );
    }
    if (this.beendet) return this._aufraeumen();
    const spur = this.stream.getAudioTracks()[0];
    if (spur) {
      spur.onended = () => this._log('Mikrofon wurde vom System beendet');
      spur.onmute = () => this._log('Mikrofon vom System stummgeschaltet');
      spur.onunmute = () => this._log('Mikrofon wieder aktiv');
    }

    // iOS hält den Audio-Kontext manchmal an (Mikrofonstart, Mitteilung, Siri …).
    this.ctx.onstatechange = () => {
      if (this.beendet) return;
      this._log(`Audio-Status: ${this.ctx.state}`);
      if (this.ctx.state !== 'running' && this.ctx.state !== 'closed') {
        this.ctx.resume().catch(() => {});
        setTimeout(() => {
          if (!this.beendet && this.ctx.state !== 'running') this._tonStoerung(true);
        }, 1500);
      } else if (this.ctx.state === 'running') {
        this._tonStoerung(false);
      }
    };
    await this.ctx.resume().catch(() => {});
    this._log(`Audio bereit (${this.ctx.sampleRate} Hz, Status ${this.ctx.state})`);

    await this.ctx.audioWorklet.addModule(new URL('./mic-worklet.js?v=2', import.meta.url));
    if (this.beendet) return this._aufraeumen();

    this.quelle = this.ctx.createMediaStreamSource(this.stream);
    this.mic = new AudioWorkletNode(this.ctx, 'mic-aufnahme');
    this.mic.port.onmessage = (e) => this._micDaten(e.data);
    const leise = this.ctx.createGain();
    leise.gain.value = 0; // Mikrofon nicht über den Lautsprecher ausgeben
    this.quelle.connect(this.mic);
    this.mic.connect(leise).connect(this.ctx.destination);

    this.ausgang = this.ctx.createGain();
    this.ausgang.connect(this.ctx.destination);

    try {
      if (navigator.wakeLock) this.wakeLock = await navigator.wakeLock.request('screen');
    } catch {}

    this.wachhund = setInterval(() => this._wachhund(), 2000);
    this._verbinden();
  }

  _tonStoerung(wert) {
    if (this.tonGestoert === wert) return;
    this.tonGestoert = wert;
    if (wert) this._log('Ton/Mikrofon unterbrochen – warte auf Antippen');
    if (this.onTonUnterbrochen) this.onTonUnterbrochen(wert);
  }

  // Wird vom Knopf „Ton wieder einschalten“ aufgerufen (braucht ein Antippen auf iOS).
  tonFortsetzen() {
    if (!this.ctx || this.beendet) return;
    this.ctx
      .resume()
      .then(() => {
        this._log(`Antippen → Audio-Status ${this.ctx.state}`);
        if (this.ctx.state === 'running') {
          this.letzteMicZeit = Date.now();
          this._tonStoerung(false);
        }
      })
      .catch((e) => this._log(`Fortsetzen fehlgeschlagen: ${e && e.message}`));
  }

  _verlaufText() {
    const zeilen = this.transkript
      .slice(-40)
      .map((z) => `${z.wer === 'du' ? this.nameNutzer || 'Gegenüber' : 'Du'}: ${z.text}`)
      .join('\n');
    return zeilen
      ? `\n\n# Bisheriger Verlauf dieses Telefonats\nDie Leitung war kurz unterbrochen. Das wurde bis eben gesagt:\n${zeilen}`
      : '';
  }

  _verbinden() {
    this.verbindungen++;
    const nr = this.verbindungen;
    this.onStatus(this.fortsetzen ? 'Verbindung wird wiederhergestellt …' : 'Verbinde …');
    this._log(`Verbindung ${nr} wird aufgebaut${this.minimal ? ' (vereinfacht)' : ''}`);
    const ws = new WebSocket(`${wsAdresse()}?key=${encodeURIComponent(this.apiKey)}`);
    this.ws = ws;
    clearTimeout(this.setupTimer);
    this.setupTimer = setTimeout(() => {
      if (!this.bereit && ws === this.ws) {
        this._log('Keine Antwort auf Verbindungsaufbau (15 s)');
        this._ende(
          this.startZeit ? 'getrennt' : 'fehler',
          'Google antwortet nicht. Prüfe deine Internetverbindung und versuch es noch einmal.',
        );
      }
    }, 15000);

    const systemText = this.fortsetzen ? this.systemText + this._verlaufText() : this.systemText;
    ws.onopen = () => {
      ws.send(
        JSON.stringify(
          setupNachricht({ modell: this.modell, systemText, stimme: this.stimme, tempo: this.tempo, minimal: this.minimal }),
        ),
      );
    };
    ws.onmessage = (e) => {
      if (ws !== this.ws) return;
      this._nachricht(e.data).catch((err) => this._log(`Fehler beim Verarbeiten: ${err && err.message}`));
    };
    ws.onclose = (e) => {
      if (this.beendet || ws !== this.ws) return;
      clearTimeout(this.setupTimer);
      this._log(`Verbindung ${nr} geschlossen: Code ${e.code}${e.reason ? ` – ${e.reason}` : ''}`);
      if (!this.bereit && !this.startZeit) {
        if (!this.minimal && istKonfigFehler(e.code, e.reason)) {
          this.minimal = true;
          return this._verbinden();
        }
        return this._ende('fehler', fehlerText(e.code, e.reason));
      }
      if (istFatal(e.reason)) return this._ende('getrennt', fehlerText(e.code, e.reason));
      this._neuVerbinden('Verbindung getrennt');
    };
  }

  _neuVerbinden(grund) {
    if (this.beendet) return;
    this.neuVersuche++;
    this._log(`Neu verbinden (${grund}), Versuch ${this.neuVersuche}`);
    if (this.neuVersuche > MAX_NEUVERSUCHE) {
      return this._ende(
        'getrennt',
        'Die Verbindung zu Google ist mehrmals abgebrochen. Vermutlich ist das kostenlose Kontingent gerade knapp. Versuch es in ein paar Minuten noch einmal.',
      );
    }
    this._userAbschliessen();
    this._buddyAbschliessen();
    this._wiedergabeStoppen();
    this.bereit = false;
    this.goAway = false;
    this.letzteUserZeit = 0;
    this.fortsetzen = true;
    const alt = this.ws;
    this.ws = null;
    try {
      if (alt && alt.readyState <= 1) alt.close(1000);
    } catch {}
    this._verbinden();
  }

  _wachhund() {
    if (this.beendet || !this.bereit) return;
    const jetzt = Date.now();

    // Mikrofon liefert nichts mehr → Audio-Kontext hängt (typisch iOS).
    if (!this.stumm && this.letzteMicZeit && jetzt - this.letzteMicZeit > 4000 && !this.tonGestoert) {
      this._log(`Mikrofon liefert seit 4 s keine Daten (Audio-Status ${this.ctx.state})`);
      this.ctx.resume().catch(() => {});
      this._tonStoerung(true);
    }

    // Nutzer hat gesprochen, Google antwortet nicht.
    if (this.letzteUserZeit > this.letzteModellZeit && jetzt - this.letzteUserZeit > ANTWORT_TIMEOUT_MS) {
      this._log(`Keine Antwort von Google seit ${Math.round((jetzt - this.letzteUserZeit) / 1000)} s`);
      this._neuVerbinden('keine Antwort');
      return;
    }

    // Google hat das Ende angekündigt → in einer Gesprächspause neu verbinden.
    if (this.goAway && !this._spieltGerade() && jetzt - this.letzteUserZeit > 1500) {
      this._neuVerbinden('Zeitlimit von Google');
    }
  }

  async _nachricht(roh) {
    const m = await nachrichtLesen(roh);
    if (!m || this.beendet) return;

    if (m.setupComplete) {
      this.bereit = true;
      clearTimeout(this.setupTimer);
      if (!this.startZeit) this.startZeit = Date.now();
      this.letzteMicZeit = Date.now();
      this._log(`Verbindung ${this.verbindungen} steht`);
      this.onStatus('verbunden');
      if (this.fortsetzen) {
        this._senden({
          realtimeInput: {
            text: '(Hinweis der App, nicht laut vorlesen: Die Leitung war kurz unterbrochen. Begrüße nicht neu. Sag kurz so etwas wie „Da bin ich wieder“ und knüpf an das Letzte an. Wenn die letzte Frage oder Aussage deines Gegenübers noch keine Antwort hatte, geh jetzt darauf ein.)',
          },
        });
      } else {
        this._senden({ realtimeInput: { text: this.begruessung } });
      }
      return;
    }

    if (m.usageMetadata && m.usageMetadata.totalTokenCount) this.tokens = m.usageMetadata.totalTokenCount;

    const sc = m.serverContent;
    if (sc) {
      if (sc.interrupted) {
        this._wiedergabeStoppen();
        this._buddyAbschliessen();
      }
      if (sc.inputTranscription && sc.inputTranscription.text) {
        this.aktUser += sc.inputTranscription.text;
        this.letzteUserZeit = Date.now();
        this.onUntertitel('du', this.aktUser);
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        this._modellAktiv();
        this._userAbschliessen();
        this.aktBuddy += sc.outputTranscription.text;
        this.onUntertitel('buddy', this.aktBuddy);
      }
      const teile = (sc.modelTurn && sc.modelTurn.parts) || [];
      for (const p of teile) {
        if (p.inlineData && p.inlineData.data && /audio/i.test(p.inlineData.mimeType || 'audio/pcm')) {
          this._modellAktiv();
          this._userAbschliessen();
          this._abspielen(p.inlineData.data, abtastrate(p.inlineData.mimeType));
        }
      }
      if (sc.turnComplete) {
        this._modellAktiv();
        this._userAbschliessen();
        this._buddyAbschliessen();
      }
    }

    if (m.goAway) {
      this._log(`Google kündigt Verbindungsende an (Restzeit ${JSON.stringify(m.goAway.timeLeft || '?')}, Tokens bisher ${this.tokens})`);
      this.goAway = true;
    }
    if (m.error) this._log(`Fehlermeldung von Google: ${JSON.stringify(m.error).slice(0, 300)}`);
  }

  _modellAktiv() {
    this.letzteModellZeit = Date.now();
    this.neuVersuche = 0;
  }

  _senden(obj) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(obj));
  }

  _spieltGerade() {
    return this.ctx && this.playHead > this.ctx.currentTime;
  }

  _micDaten(d) {
    if (d.pegel !== undefined) {
      if (this.onPegel) this.onPegel(this.stumm ? 0 : d.pegel);
      return;
    }
    this.letzteMicZeit = Date.now();
    if (this.tonGestoert) this._tonStoerung(false);
    if (!d.pcm || !this.bereit || this.stumm || this.beendet) return;
    // Option „Buddy ausreden lassen“: Während der Buddy spricht, wird das Mikrofon nicht gesendet.
    if (!this.unterbrechen && this._spieltGerade()) return;
    this._senden({ realtimeInput: { audio: { data: zuBase64(d.pcm), mimeType: 'audio/pcm;rate=16000' } } });
  }

  _abspielen(b64, rate) {
    if (!this.ctx || this.ctx.state === 'closed') return;
    const daten = ausBase64ZuFloat(b64);
    if (!daten.length) return;
    const buf = this.ctx.createBuffer(1, daten.length, rate);
    buf.copyToChannel(daten, 0);
    const q = this.ctx.createBufferSource();
    q.buffer = buf;
    q.connect(this.ausgang);
    const t = Math.max(this.ctx.currentTime + 0.05, this.playHead);
    q.start(t);
    this.playHead = t + buf.duration;
    this.quellen.add(q);
    q.onended = () => this.quellen.delete(q);
  }

  _wiedergabeStoppen() {
    for (const q of this.quellen) {
      try {
        q.stop();
      } catch {}
    }
    this.quellen.clear();
    this.playHead = 0;
  }

  _userAbschliessen() {
    const t = this.aktUser.trim();
    if (t) this.transkript.push({ wer: 'du', text: t, zeit: Date.now() });
    this.aktUser = '';
  }

  _buddyAbschliessen() {
    const t = this.aktBuddy.trim();
    if (t) this.transkript.push({ wer: 'buddy', text: t, zeit: Date.now() });
    this.aktBuddy = '';
  }

  setStumm(wert) {
    this.stumm = wert;
    this._log(wert ? 'Stumm an' : 'Stumm aus');
    if (wert) this._senden({ realtimeInput: { audioStreamEnd: true } });
    else this.letzteMicZeit = Date.now();
  }

  auflegen() {
    this._ende('aufgelegt', '');
  }

  _ende(grund, text) {
    if (this.beendet) return;
    this._log(`Ende: ${grund}${text ? ` – ${text}` : ''}${this.tokens ? ` (Tokens ${this.tokens})` : ''}`);
    this.beendet = true;
    clearTimeout(this.setupTimer);
    clearInterval(this.wachhund);
    this._userAbschliessen();
    this._buddyAbschliessen();
    const dauerSek = this.startZeit ? Math.round((Date.now() - this.startZeit) / 1000) : 0;
    this._aufraeumen();
    this.onEnde({ grund, text, dauerSek, transkript: this.transkript, protokoll: this.protokoll });
  }

  _aufraeumen() {
    clearInterval(this.wachhund);
    this._wiedergabeStoppen();
    try {
      if (this.ws && this.ws.readyState <= 1) this.ws.close(1000);
    } catch {}
    try {
      if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
    } catch {}
    try {
      if (this.mic) this.mic.port.onmessage = null;
      if (this.quelle) this.quelle.disconnect();
      if (this.mic) this.mic.disconnect();
    } catch {}
    try {
      if (this.ctx && this.ctx.state !== 'closed') {
        this.ctx.onstatechange = null;
        this.ctx.close();
      }
    } catch {}
    try {
      if (this.wakeLock) this.wakeLock.release();
    } catch {}
  }
}

// Prüft, ob Schlüssel und Modell funktionieren – ohne Mikrofon.
export function verbindungTesten({ apiKey, modell }) {
  return new Promise((resolve) => {
    let fertig = false;
    const ende = (ok, text) => {
      if (fertig) return;
      fertig = true;
      clearTimeout(timer);
      try {
        ws.close(1000);
      } catch {}
      resolve({ ok, text });
    };
    let ws;
    try {
      ws = new WebSocket(`${wsAdresse()}?key=${encodeURIComponent(apiKey)}`);
    } catch (e) {
      resolve({ ok: false, text: e.message });
      return;
    }
    const timer = setTimeout(() => ende(false, 'Keine Antwort von Google (Zeitüberschreitung).'), 15000);
    ws.onopen = () =>
      ws.send(
        JSON.stringify(
          setupNachricht({ modell, systemText: 'Test.', stimme: 'Kore', tempo: 'normal', minimal: false }),
        ),
      );
    ws.onmessage = async (e) => {
      const m = await nachrichtLesen(e.data);
      if (m && m.setupComplete) ende(true, `Verbindung klappt. Modell: ${modell}`);
    };
    ws.onclose = (e) => ende(false, fehlerText(e.code, e.reason));
  });
}
