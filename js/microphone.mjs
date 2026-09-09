/** Opt-in, in-memory Web Audio analysis. Never records, uploads or routes to speakers. */
export const clamp01 = x => Math.max(0, Math.min(1, Number.isFinite(x) ? x : 0));
export function spectrumEnergy(wave, bins, sampleRate = 48000, fftSize = 2048) {
  let sum = 0;
  for (const x of wave) sum += x * x;
  const rms = Math.sqrt(sum / Math.max(1, wave.length));
  const band = (low, high) => {
    const a = Math.max(1, Math.floor(low * fftSize / sampleRate));
    const b = Math.min(bins.length, Math.ceil(high * fftSize / sampleRate));
    let energy = 0;
    for (let i = a; i < b; i++) energy += bins[i] / 255;
    return clamp01(energy / Math.max(1, b - a));
  };
  return { level: clamp01(Math.sqrt(Math.max(0, rms - .003) * 5)), low: band(50, 250), mid: band(250, 2000), high: band(2000, 10000) };
}
export class LocalMicrophone {
  constructor(onChange = () => {}, env = globalThis) {
    this.env = env; this.onChange = onChange; this.session = null; this.state = 'off';
  }
  get supported() { return !!(this.env.isSecureContext && this.env.navigator?.mediaDevices?.getUserMedia && (this.env.AudioContext || this.env.webkitAudioContext)); }
  update(state, message) { this.state = state; this.onChange({ state, message }); }
  stop(message = 'Microphone off · nothing recorded or sent.') {
    const s = this.session; this.session = null;
    if (s) {
      clearTimeout(s.timer);
      s.stream?.getTracks().forEach(t => t.stop());
      try { s.source?.disconnect(); } catch { /* Already disconnected. */ }
      try { Promise.resolve(s.context.close()).catch(() => {}); } catch { /* Already closed. */ }
    }
    this.update('off', message);
  }
  async start() {
    if (this.session) return false;
    if (!this.supported) { this.update('error', 'Microphone mode needs HTTPS and a supported browser. Pointer mode still works.'); return false; }
    let s;
    try {
      const Context = this.env.AudioContext || this.env.webkitAudioContext;
      s = { context: new Context(), stream: null, source: null, timer: null };
      this.session = s;
      // Called from a button gesture before awaiting the permission prompt (Safari included).
      const resumed = Promise.resolve(s.context.resume()).then(() => true, () => false);
      this.update('requesting', 'Allow microphone access, or cancel. No recording or playback.');
      s.timer = setTimeout(() => { if (this.session === s) this.stop('Request timed out. You can try again; dismiss any open browser prompt.'); }, 30000);
      const stream = await this.env.navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false }, video: false });
      // getUserMedia cannot cancel its prompt: always release a late permission grant.
      if (this.session !== s) { stream.getTracks().forEach(t => t.stop()); return false; }
      s.stream = stream;
      if (!await resumed || this.session !== s) {
        if (this.session === s) this.stop('Audio could not start. Press Enable microphone to retry.');
        return false;
      }
      clearTimeout(s.timer);
      s.analyser = s.context.createAnalyser(); s.analyser.fftSize = 2048; s.analyser.smoothingTimeConstant = .72;
      s.wave = new Float32Array(s.analyser.fftSize); s.bins = new Uint8Array(s.analyser.frequencyBinCount);
      s.source = s.context.createMediaStreamSource(stream); s.source.connect(s.analyser);
      // Intentionally no connection to context.destination: no monitoring or feedback.
      for (const track of stream.getTracks()) track.addEventListener('ended', () => { if (this.session === s) this.stop('Microphone disconnected. Pointer mode is still active.'); }, { once: true });
      this.update('live', 'Microphone live · local analysis only. Sing, clap or play.');
      return true;
    } catch (error) {
      if (s && this.session !== s) return false;
      this.stop();
      const message = error?.name === 'NotAllowedError' ? 'Microphone permission declined. Pointer mode still works.' : error?.name === 'NotFoundError' ? 'No microphone found. Pointer mode still works.' : 'Microphone unavailable. Check your device or browser permissions.';
      this.update('error', message); return false;
    }
  }
  sample() {
    const s = this.session;
    if (this.state !== 'live' || !s?.analyser) return { level: 0, low: 0, mid: 0, high: 0 };
    s.analyser.getFloatTimeDomainData(s.wave); s.analyser.getByteFrequencyData(s.bins);
    return spectrumEnergy(s.wave, s.bins, s.context.sampleRate, s.analyser.fftSize);
  }
}
