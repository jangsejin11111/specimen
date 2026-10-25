// Quiet, dry Web Audio cues, unlocked by direct user gestures.
export class SpecimenAudio {
  constructor(factory = () => { const C = globalThis.AudioContext || globalThis.webkitAudioContext; return C ? new C() : null; }) { this.factory = factory; this.context = null; this.active = new Set(); }
  // iOS can render Web Audio while its ambient output is still muted. A real,
  // unmuted media element establishes the playback route on a user gesture.
  primeMediaRoute() {
    if (!globalThis.document || !/iPhone|iPad|iPod/.test(navigator.userAgent) && !(navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) return;
    if (!this.mediaRoute) {
      const rate = 8000, samples = rate, bytes = new Uint8Array(44 + samples * 2), view = new DataView(bytes.buffer);
      const text = (offset, value) => { for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i); };
      text(0, 'RIFF'); view.setUint32(4, bytes.length - 8, true); text(8, 'WAVE'); text(12, 'fmt ');
      view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
      view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
      text(36, 'data'); view.setUint32(40, samples * 2, true);
      // Non-zero at -90dB: inaudible, but not a muted media element.
      for (let i = 0; i < samples; i++) view.setInt16(44 + i * 2, i % 2 ? 1 : -1, true);
      const audio = document.createElement('audio');
      audio.src = URL.createObjectURL(new Blob([bytes], { type: 'audio/wav' }));
      audio.loop = true; audio.preload = 'auto'; audio.setAttribute('playsinline', '');
      audio.setAttribute('aria-hidden', 'true'); audio.hidden = true;
      document.body.append(audio); this.mediaRoute = audio;
    }
    if (this.mediaRoute.paused) {
      const playing = this.mediaRoute.play();
      playing?.catch(() => {}); // Next touch retries; never mark a rejection as unlocked.
    }
  }
  pauseForBackground() {
    this.mediaRoute?.pause();
    this.refreshRoute = true;
    this.stop();
  }
  async unlock() {
    try {
      // Request the media playback route where supported (not ambient audio).
      try {
        if (globalThis.navigator?.audioSession) {
          if (this.refreshRoute) globalThis.navigator.audioSession.type = 'auto';
          globalThis.navigator.audioSession.type = 'playback';
        }
      } catch {}
      this.refreshRoute = false;
      this.primeMediaRoute();
      if (!this.context || this.context.state === 'closed') this.context = this.factory();
      const ctx = this.context;
      if (!ctx || ctx.state === 'running') return;
      // Both calls must happen synchronously inside the touch/click gesture.
      // Safari can report interrupted as well as suspended after app switching.
      const resumed = ctx.resume();
      const prime = ctx.createBufferSource();
      prime.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      prime.connect(ctx.destination);
      this.track(prime);
      prime.start(0);
      await resumed;
    } catch { /* Keep the context so the next real gesture can retry. */ }
  }
  track(source) {
    this.active.add(source);
    source.onended = () => { this.active.delete(source); source.disconnect(); };
  }
  tone(frequency, duration, volume, type = 'sine', delay = 0) {
    const ctx = this.context; if (!ctx || ctx.state !== 'running') return;
    const source = ctx.createOscillator(), gain = ctx.createGain(), now = ctx.currentTime + delay;
    source.type = type; source.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(.0001, now); gain.gain.exponentialRampToValueAtTime(volume, now + .003); gain.gain.exponentialRampToValueAtTime(.0001, now + duration);
    source.connect(gain); gain.connect(ctx.destination); this.track(source);
    source.start(now); source.stop(now + duration + .01);
  }
  noise(duration, volume, frequency) {
    const ctx = this.context; if (!ctx || ctx.state !== 'running') return;
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate), data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = frequency; filter.Q.value = .8;
    gain.gain.value = volume; source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); this.track(source);
    source.start(); source.stop(ctx.currentTime + duration + .01);
  }
  click() { this.tone(2700, .055, .035); this.tone(4300, .03, .016); this.noise(.022, .018, 3200); }
  rustle() { this.noise(.12, .025, 1900); }
  friction() { this.noise(.055, .009, 2300); }
  reject() { this.tone(125, .095, .022, 'sawtooth'); this.noise(.045, .015, 550); }
  land() {
    const ctx = this.context; if (!ctx || ctx.state !== 'running') return;
    // Dry, uneven scrapes: no musical pitch bend or spring-like bounce.
    const duration = .31, buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0), bursts = [[0,.025,1],[.047,.042,.7],[.112,.027,.85],[.164,.052,.55],[.238,.046,.3]];
    let grain = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / ctx.sampleRate;
      let envelope = 0;
      for (const [start, length, strength] of bursts) {
        const u = (t - start) / length;
        if (u >= 0 && u < 1) envelope += strength * Math.pow(1 - u, 1.7) * Math.min(1, u * 15);
      }
      grain = grain * .55 + (Math.random() * 2 - 1) * .45;
      data[i] = grain * envelope;
    }
    const source = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), gain = ctx.createGain();
    source.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 1650; filter.Q.value = .65;
    gain.gain.value = .25;
    source.connect(filter); filter.connect(gain); gain.connect(ctx.destination); this.track(source);
    source.start(); source.stop(ctx.currentTime + duration + .01);
    this.tone(95, .035, .025, 'triangle');
  }
  playCue(callback) {
    const generation = this.generation || 0;
    if (this.context?.state === 'running') { callback(); return; }
    void this.unlock().then(() => {
      if ((this.generation || 0) === generation && this.context?.state === 'running') callback();
    });
  }
  openSafe(count = 1) {
    // Only a few quiet ticks for a flood, never one loud cue per cell.
    const ticks = count > 1 ? Math.min(4, 1 + Math.ceil(Math.log2(count))) : 1;
    for (let i = 0; i < ticks; i++) {
      this.tone(2350 + i * 137, .018, .026 / (1 + i * .5), 'triangle', i * .043);
      this.tone(3700 + i * 91, .011, .009 / (1 + i), 'sine', i * .043);
    }
  }
  openMine() {
    // A dull opening into a hollow space, with no explosion or alarm.
    this.tone(108, .10, .085, 'sine');
    this.tone(173, .43, .027, 'sine', .018);
    this.noise(.065, .035, 520);
  }
  unpin() {
    // Fine metal tension and a dry body scrape, not a fleshy sound.
    this.noise(.65, .035, 2300);
    this.tone(1860, .32, .009, 'sine');
    this.tone(1937, .40, .007, 'sine', .09);
  }
  scuttle() {
    this.noise(.045, .022, 1700);
    this.tone(850, .012, .006, 'triangle', .026);
  }
  endingAmbience() {
    const ctx = this.context; if (!ctx || ctx.state !== 'running') return;
    const now = ctx.currentTime, duration = 2.8;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(.075, now + .18);
    envelope.gain.exponentialRampToValueAtTime(.025, now + .95);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    envelope.connect(ctx.destination);
    // A hollow, gently beating low resonance, without a tune or impact.
    for (const frequency of [116, 119.5]) {
      const source = ctx.createOscillator(); source.type = 'sine';
      source.frequency.setValueAtTime(frequency, now);
      source.connect(envelope); this.track(source);
      source.start(now); source.stop(now + duration);
    }
    const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * .35;
    const air = ctx.createBufferSource(), filter = ctx.createBiquadFilter();
    air.buffer = buffer; filter.type = 'bandpass'; filter.frequency.value = 460; filter.Q.value = .55;
    air.connect(filter); filter.connect(envelope); this.track(air);
    air.start(now); air.stop(now + duration);
  }
  tap() { this.tone(3400, .012, .018); this.tone(210, .028, .045); this.noise(.018, .035, 1100); }
  stop() { this.generation = (this.generation || 0) + 1; for (const source of this.active) { try { source.stop(); } catch {} } this.active.clear(); }
}
