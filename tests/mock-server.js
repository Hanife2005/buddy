// Testserver: liefert die App aus und spielt die Gemini-Live- und REST-API nach.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');

const WURZEL = path.join(__dirname, '..');
const LOG = [];
const VERBINDUNGEN = {};
const TYPEN = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webmanifest': 'application/manifest+json', '.json': 'application/json' };

function sinus(sek, rate = 24000) {
  const n = Math.round(sek * rate);
  const b = Buffer.alloc(n * 2);
  for (let i = 0; i < n; i++) b.writeInt16LE(Math.round(Math.sin((2 * Math.PI * 300 * i) / rate) * 8000), i * 2);
  return b.toString('base64');
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  if (url.pathname === '/log') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify(LOG));
  }
  if (url.pathname.startsWith('/rest/')) {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      const modell = url.pathname.slice(6).split(':')[0];
      LOG.push({ typ: 'rest', modell, key: url.searchParams.get('key'), promptLaenge: body.length, prompt: JSON.parse(body).contents[0].parts[0].text });
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (modell === 'gemini-3.5-flash-lite') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: { message: `models/${modell} is not found for API version v1beta` } }));
      }
      const antwort = {
        zusammenfassung: 'Hanife hat vom Arbeitstag erzählt; ein Meeting lief schlecht.',
        neue_fakten: ['Hat am Freitag ein Gehaltsgespräch'],
        veraltete_fakten: [],
        mitnehmen: [{ gedanke: 'Missverständnisse entstehen oft durch fehlenden Kontext.', nachpruefen: '' }, { gedanke: 'Tiefes Ausatmen senkt kurzfristig die Anspannung.', nachpruefen: 'Atemübung Stress Studie' }],
      };
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ candidates: [{ content: { parts: [{ text: '```json\n' + JSON.stringify(antwort) + '\n```' }] } }] }));
    });
    req.on('error', () => {});
    return;
  }
  if (req.method === 'OPTIONS') {
    res.writeHead(204, { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Methods': 'POST' });
    return res.end();
  }
  let p = url.pathname === '/' ? '/index.html' : url.pathname;
  const datei = path.join(WURZEL, p);
  fs.readFile(datei, (err, data) => {
    if (err) {
      res.writeHead(404);
      return res.end('nicht gefunden');
    }
    res.writeHead(200, { 'Content-Type': TYPEN[path.extname(datei)] || 'application/octet-stream' });
    res.end(data);
  });
});

const wss = new WebSocketServer({ server, path: '/ws' });
wss.on('connection', (ws, req) => {
  const key = new URL(req.url, 'http://x').searchParams.get('key');
  let audioPakete = 0;
  let geantwortet = false;
  VERBINDUNGEN[key] = (VERBINDUNGEN[key] || 0) + 1;
  const ersteVerbindung = VERBINDUNGEN[key] === 1;
  const abbruch = key.startsWith('TESTKEY-abbruch') && ersteVerbindung;
  const stumm = key.startsWith('TESTKEY-stumm') && ersteVerbindung;
  const modus = key === 'FALSCHER-SCHLUESSEL-1234567890' ? 'falsch' : 'ok';
  ws.on('message', (raw) => {
    const m = JSON.parse(raw.toString());
    if (m.setup) {
      LOG.push({ typ: 'setup', key, setup: m.setup });
      if (modus === 'falsch') return ws.close(1007, 'API key not valid. Please pass a valid API key.');
      if (m.setup.tools && process.env.OHNE_SUCHE) return ws.close(1007, 'Invalid JSON payload received. Unknown name "googleSearch"');
      if (m.setup.realtimeInputConfig && process.env.SETUP_STRENG) return ws.close(1007, 'Invalid JSON payload received. Unknown name "realtimeInputConfig"');
      // Als Binärframe senden, wie Google es oft tut (prüft Blob-Behandlung).
      return ws.send(Buffer.from(JSON.stringify({ setupComplete: {} })));
    }
    if (m.realtimeInput && m.realtimeInput.text) {
      LOG.push({ typ: 'text', text: m.realtimeInput.text });
      ws.send(JSON.stringify({ serverContent: { outputTranscription: { text: 'Hallo Hanife, ' } } }));
      ws.send(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: sinus(0.6) } }] } } }));
      ws.send(JSON.stringify({ serverContent: { outputTranscription: { text: 'wie war dein Tag?' } } }));
      ws.send(JSON.stringify({ serverContent: { generationComplete: true } }));
      ws.send(JSON.stringify({ serverContent: { turnComplete: true } }));
      return;
    }
    if (m.realtimeInput && m.realtimeInput.audio) {
      audioPakete++;
      const a = m.realtimeInput.audio;
      if (audioPakete === 1) LOG.push({ typ: 'audio-erstes', mime: a.mimeType, bytes: Buffer.from(a.data, 'base64').length });
      if (abbruch && audioPakete === 30) {
        LOG.push({ typ: 'server-bricht-ab' });
        return ws.close(1011, 'Internal error encountered.');
      }
      if (stumm && audioPakete === 20) {
        geantwortet = true;
        LOG.push({ typ: 'server-schweigt' });
        ws.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Hallo, hörst du mich?' } } }));
      }
      if (audioPakete === 20 && !geantwortet) {
        geantwortet = true;
        ws.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'Mein Meeting lief ' } } }));
        ws.send(JSON.stringify({ serverContent: { inputTranscription: { text: 'heute ziemlich schlecht.' } } }));
        ws.send(JSON.stringify({ serverContent: { outputTranscription: { text: 'Oh, das klingt anstrengend. Was ist passiert?' } } }));
        ws.send(JSON.stringify({ serverContent: { modelTurn: { parts: [{ inlineData: { mimeType: 'audio/pcm;rate=24000', data: sinus(0.4) } }] } } }));
        ws.send(JSON.stringify({ serverContent: { interrupted: true } }));
        ws.send(JSON.stringify({ serverContent: { turnComplete: true } }));
      }
      LOG.push && (LOG.audioZaehler = audioPakete);
      return;
    }
    if (m.realtimeInput && m.realtimeInput.audioStreamEnd) LOG.push({ typ: 'audioStreamEnd' });
  });
  ws.on('close', () => LOG.push({ typ: 'ws-zu', audioPakete }));
});

server.listen(8080, () => console.log('Testserver auf :8080'));
