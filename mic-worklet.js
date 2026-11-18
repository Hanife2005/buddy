// Nimmt das Mikrofon auf, rechnet auf 16 kHz herunter und schickt
// 100-ms-Pakete als 16-Bit-PCM an die App (Format, das die Gemini Live API erwartet).

class MicAufnahme extends AudioWorkletProcessor {
  constructor() {
    super();
    this.schritt = sampleRate / 16000; // z. B. 3 bei 48 kHz
    this.phase = 0;
    this.summe = 0;
    this.anzahl = 0;
    this.puffer = new Int16Array(1600); // 100 ms bei 16 kHz
    this.pos = 0;
    this.pegelSumme = 0;
    this.pegelN = 0;
  }

  process(inputs) {
    const kanal = inputs[0] && inputs[0][0];
    if (!kanal) return true;

    for (let i = 0; i < kanal.length; i++) {
      const s = kanal[i];
      this.summe += s;
      this.anzahl++;
      this.pegelSumme += s * s;
      this.pegelN++;
      this.phase += 1;

      if (this.phase >= this.schritt) {
        this.phase -= this.schritt;
        // Mittelwert über die zusammengefassten Samples (einfacher Tiefpass gegen Aliasing).
        let v = this.summe / this.anzahl;
        this.summe = 0;
        this.anzahl = 0;
        if (v > 1) v = 1;
        else if (v < -1) v = -1;
        this.puffer[this.pos++] = v < 0 ? v * 0x8000 : v * 0x7fff;

        if (this.pos === this.puffer.length) {
          const fertig = this.puffer;
          this.port.postMessage({ pcm: fertig.buffer }, [fertig.buffer]);
          this.puffer = new Int16Array(1600);
          this.pos = 0;
          this.port.postMessage({ pegel: Math.sqrt(this.pegelSumme / Math.max(1, this.pegelN)) });
          this.pegelSumme = 0;
          this.pegelN = 0;
        }
      }
    }
    return true;
  }
}

registerProcessor('mic-aufnahme', MicAufnahme);
