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

export class LiveAnruf {
  /**
   * opts: apiKey, modell, systemText, stimme, tempo, unterbrechen, begruessung,
   *       onStatus(text), onUntertitel(wer, text), onPegel(wert), onEnde({grund, text, dauerSek, transkript})
   */
  constructor(opts) {
    Object.assign(this, opts);
    this.transkript = [];
    this.aktUser = '';
    this.aktBuddy = '';
    this.quellen = new Set();
    this.playHead = 0;
    this.stumm = false;
    this.beendet = false;
    this.bereit = false;
    this.startZeit = 0;
  }

  // Muss direkt im Klick-Handler aufgerufen werden (iOS erlaubt Audio nur nach Nutzeraktion).
  starten() {
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    this.ctx.resume().catch(() => {});
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'play-and-record';
    } catch {}
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

    // iOS hält den Audio-Kontext manchmal an, sobald das Mikrofon startet.
    this.ctx.onstatechange = () => {
      if (!this.beendet && this.ctx.state !== 'running' && this.ctx.state !== 'closed') this.ctx.resume().catch(() => {});
    };
    await this.ctx.resume().catch(() => {});

    await this.ctx.audioWorklet.addModule(new URL('./mic-worklet.js', import.meta.url));
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

    this._verbinden(false);
  }

  _verbinden(minimal) {
    this.onStatus('Verbinde …');
    const ws = new WebSocket(`${wsAdresse()}?key=${encodeURIComponent(this.apiKey)}`);
    this.ws = ws;
    clearTimeout(this.setupTimer);
    this.setupTimer = setTimeout(() => {
      if (!this.bereit && ws === this.ws) {
        this._ende('fehler', 'Google antwortet nicht. Prüfe deine Internetverbindung und versuch es noch einmal.');
      }
    }, 15000);

    ws.onopen = () => {
      ws.send(
        JSON.stringify(
          setupNachricht({
            modell: this.modell,
            systemText: this.systemText,
            stimme: this.stimme,
            tempo: this.tempo,
            minimal,
          }),
        ),
      );
    };
    ws.onmessage = (e) => this._nachricht(e.data).catch((err) => console.error(err));
    ws.onclose = (e) => {
      if (this.beendet || ws !== this.ws) return;
      clearTimeout(this.setupTimer);
      if (!this.bereit) {
        if (!minimal && istKonfigFehler(e.code, e.reason)) {
          console.warn('Setup abgelehnt, versuche vereinfachte Einstellungen:', e.reason);
          return this._verbinden(true);
        }
        return this._ende('fehler', fehlerText(e.code, e.reason));
      }
      this._ende('getrennt', e.code === 1000 ? 'Google hat die Verbindung beendet.' : fehlerText(e.code, e.reason));
    };
  }

  async _nachricht(roh) {
    const m = await nachrichtLesen(roh);
    if (!m || this.beendet) return;

    if (m.setupComplete) {
      this.bereit = true;
      clearTimeout(this.setupTimer);
      this.startZeit = Date.now();
      this.onStatus('verbunden');
      this._senden({ realtimeInput: { text: this.begruessung } });
      return;
    }

    const sc = m.serverContent;
    if (sc) {
      if (sc.interrupted) {
        this._wiedergabeStoppen();
        this._buddyAbschliessen();
      }
      if (sc.inputTranscription && sc.inputTranscription.text) {
        this.aktUser += sc.inputTranscription.text;
        this.onUntertitel('du', this.aktUser);
      }
      if (sc.outputTranscription && sc.outputTranscription.text) {
        this._userAbschliessen();
        this.aktBuddy += sc.outputTranscription.text;
        this.onUntertitel('buddy', this.aktBuddy);
      }
      const teile = (sc.modelTurn && sc.modelTurn.parts) || [];
      for (const p of teile) {
        if (p.inlineData && p.inlineData.data && /audio/i.test(p.inlineData.mimeType || 'audio/pcm')) {
          this._userAbschliessen();
          this._abspielen(p.inlineData.data, abtastrate(p.inlineData.mimeType));
        }
      }
      if (sc.turnComplete) {
        this._userAbschliessen();
        this._buddyAbschliessen();
      }
    }

    if (m.goAway) this.onStatus('Google beendet die Verbindung gleich (Zeitlimit).');
    if (m.error) console.error('Fehler von Google:', m.error);
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
    if (wert) this._senden({ realtimeInput: { audioStreamEnd: true } });
  }

  auflegen() {
    this._ende('aufgelegt', '');
  }

  _ende(grund, text) {
    if (this.beendet) return;
    this.beendet = true;
    clearTimeout(this.setupTimer);
    this._userAbschliessen();
    this._buddyAbschliessen();
    const dauerSek = this.startZeit ? Math.round((Date.now() - this.startZeit) / 1000) : 0;
    this._aufraeumen();
    this.onEnde({ grund, text, dauerSek, transkript: this.transkript });
  }

  _aufraeumen() {
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
