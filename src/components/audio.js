// Chiptune SFX + background music (Web Audio API, no files)
export let AC = null;
export let master = null;
export let noiseBuf = null;
export let muted = false;

const VOL = 0.22;
const lastPlay = {};

export const audio = {
  init() {
    if (AC) {
      if (AC.state === "suspended") AC.resume();
      return;
    }
    const Ctx = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
    if (!Ctx) return;

    AC = new Ctx();
    master = AC.createGain();
    master.gain.value = muted ? 0 : VOL;
    master.connect(AC.destination);

    // 0.6s of white noise, reused by every noise() call and the drums
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.6, AC.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  },
  setMuted(m) {
    muted = m;
    if (master) master.gain.value = m ? 0 : VOL;
  },
};

// one oscillator blip; f2 makes it slide from f to f2 over the duration
function tone({ f = 440, f2, type = "square", d = 0.1, v = 0.5, delay = 0 }) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay;
  const osc = AC.createOscillator();
  const gain = AC.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(f2, t + d);
  gain.gain.setValueAtTime(v, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + d);
  osc.connect(gain);
  gain.connect(master);
  osc.start(t);
  osc.stop(t + d + 0.02);
}

// band-passed noise burst
function noise({ d = 0.1, v = 0.4, f = 1200, delay = 0 }) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay;
  const src = AC.createBufferSource();
  const filter = AC.createBiquadFilter();
  const gain = AC.createGain();
  src.buffer = noiseBuf;
  filter.type = "bandpass";
  filter.frequency.value = f;
  filter.Q.value = 0.8;
  gain.gain.setValueAtTime(v, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + d);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start(t);
  src.stop(t + d + 0.02);
}

// a run of tones, `gap` seconds apart
function notes(freqs, o = {}) {
  freqs.forEach((f, i) => {
    tone({ f, d: o.d || 0.09, v: o.v || 0.3, type: o.type || "square", delay: i * (o.gap || 0.07) });
  });
}

const SFX = {
  swing: () => noise({ d: 0.08, v: 0.3, f: 3200 }),
  hit:   () => tone({ f: 240, f2: 110, d: 0.07, v: 0.35 }),
  kill:  () => tone({ f: 620, f2: 1040, d: 0.08, v: 0.25 }),
  hurt: () => {
    tone({ f: 220, f2: 60, type: "sawtooth", d: 0.28, v: 0.45 });
    noise({ d: 0.15, v: 0.3, f: 500 });
  },
  dash:  () => tone({ f: 260, f2: 900, type: "triangle", d: 0.13, v: 0.4 }),
  shot:  () => tone({ f: 1500, f2: 750, type: "triangle", d: 0.05, v: 0.12 }),
  pickup: () => notes([523, 659, 784, 1047], { gap: 0.06, v: 0.25 }),
  shield: () => {
    tone({ f: 900, f2: 280, type: "triangle", d: 0.22, v: 0.35 });
    noise({ d: 0.12, v: 0.25, f: 5000 });
  },
  bossIn:   () => notes([131, 123, 117, 110], { type: "sawtooth", d: 0.3, gap: 0.26, v: 0.35 }),
  wind:     () => tone({ f: 170, f2: 440, type: "sawtooth", d: 0.42, v: 0.22 }),
  bossShot: () => tone({ f: 520, f2: 260, d: 0.08, v: 0.12 }),
  bossDie: () => {
    noise({ d: 0.5, v: 0.45, f: 350 });
    notes([392, 523, 659, 784], { gap: 0.09, d: 0.14, delay: 0.1 });
  },
  win: () => {
    noise({ d: 0.5, v: 0.4, f: 350 });
    notes([523, 523, 523, 659, 784, 1047], { gap: 0.13, d: 0.18, v: 0.3 });
    tone({ f: 1047, d: 0.6, v: 0.25, delay: 0.8, type: "triangle" });
  },
  over:  () => notes([392, 330, 262, 196], { type: "triangle", d: 0.24, gap: 0.19, v: 0.35 }),
  click: () => tone({ f: 880, d: 0.03, v: 0.18 }),
  echo: () => {
    tone({ f: 1200, f2: 700, type: "triangle", d: 0.08, v: 0.13 });
    tone({ f: 1800, f2: 900, type: "sine", d: 0.1, v: 0.08, delay: 0.03 });
  },
  rewind: () => {
    tone({ f: 200, f2: 1600, type: "sawtooth", d: 0.22, v: 0.2 });
    noise({ d: 0.18, v: 0.16, f: 5000 });
  },
  bubble: () => {
    tone({ f: 500, f2: 300, type: "sine", d: 0.3, v: 0.2 });
    tone({ f: 750, f2: 450, type: "sine", d: 0.28, v: 0.12, delay: 0.05 });
  },
  stab: () => {
    noise({ d: 0.05, v: 0.28, f: 4200 });
    tone({ f: 900, f2: 500, type: "triangle", d: 0.05, v: 0.14 });
  },
  ambush: () => {
    noise({ d: 0.16, v: 0.4, f: 1800 });
    tone({ f: 300, f2: 120, type: "sawtooth", d: 0.14, v: 0.3 });
  },
  step: () => {
    tone({ f: 1500, f2: 260, type: "square", d: 0.1, v: 0.16 });
    noise({ d: 0.09, v: 0.18, f: 6500 });
  },
  pounce: () => {
    tone({ f: 500, f2: 900, type: "triangle", d: 0.09, v: 0.16 });
    tone({ f: 900, f2: 600, type: "triangle", d: 0.08, v: 0.14, delay: 0.09 });
  },
  gun: () => {
    noise({ d: 0.07, v: 0.4, f: 2600 });
    tone({ f: 240, f2: 90, type: "square", d: 0.09, v: 0.3 });
  },
  reload: () => {
    tone({ f: 620, d: 0.03, v: 0.2 });
    tone({ f: 940, d: 0.05, v: 0.22, delay: 0.09 });
  },
  recoil: () => {
    noise({ d: 0.22, v: 0.5, f: 700 });
    tone({ f: 150, f2: 50, type: "sawtooth", d: 0.2, v: 0.4 });
  },
  beep: () => tone({ f: 1250, d: 0.04, v: 0.2 }),
  boom: () => {
    noise({ d: 0.32, v: 0.5, f: 600 });
    tone({ f: 130, f2: 40, type: "sawtooth", d: 0.26, v: 0.4 });
  },
  armor: () => {
    tone({ f: 1100, f2: 480, type: "square", d: 0.09, v: 0.3 });
    noise({ d: 0.12, v: 0.3, f: 3500 });
  },
  armorUp: () => notes([784, 1047], { gap: 0.05, v: 0.2 }),
  blast: () => {
    noise({ d: 0.35, v: 0.5, f: 500 });
    tone({ f: 170, f2: 40, type: "sawtooth", d: 0.3, v: 0.45 });
  },
  arrow: () => {
    tone({ f: 760, f2: 320, type: "triangle", d: 0.07, v: 0.22 });
    noise({ d: 0.04, v: 0.12, f: 6000 });
  },
  cast:   () => tone({ f: 420, f2: 1250, type: "square", d: 0.14, v: 0.14 }),
  orbHit: () => noise({ d: 0.14, v: 0.28, f: 900 }),
  roll: () => {
    noise({ d: 0.12, v: 0.25, f: 1400 });
    tone({ f: 300, f2: 520, type: "triangle", d: 0.1, v: 0.2 });
  },
  blink: () => {
    tone({ f: 1400, f2: 260, type: "square", d: 0.12, v: 0.2 });
    noise({ d: 0.08, v: 0.18, f: 7000 });
  },
  hawk: () => {
    tone({ f: 1900, f2: 1100, type: "square", d: 0.12, v: 0.12 });
    noise({ d: 0.06, v: 0.1, f: 5000 });
  },
  block: () => {
    tone({ f: 1250, f2: 620, type: "triangle", d: 0.1, v: 0.3 });
    noise({ d: 0.06, v: 0.15, f: 6000 });
  },
  nova: () => {
    tone({ f: 200, f2: 820, type: "triangle", d: 0.28, v: 0.3 });
    noise({ d: 0.2, v: 0.15, f: 4000 });
  },
};

// ---- music ----

const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };

// "A4" -> 440
function hz(name) {
  const m = name.match(/^([A-G]#?)(\d)$/);
  return 440 * 2 ** ((NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12);
}

// pattern letters: r = root, o = octave, f = fifth, anything else = rest
function bassLine(pattern, chords) {
  return chords.flatMap(([root, octave, fifth]) =>
    pattern.split(" ").map(x => (x === "r" ? root : x === "o" ? octave : x === "f" ? fifth : "-")));
}

const TRACKS = {
  normal: {
    bpm: 140,
    leadLen: 0.9,
    lead: ("A4 - C5 - E5 - - - D5 - C5 - B4 - C5 - A4 - - - F4 - A4 - C5 - - - A4 - - - " +
           "G4 - C5 - E5 - G5 - E5 - - - D5 - C5 - D5 - - - B4 - G4 - B4 - D5 - - - - -").trim().split(" "),
    bass: bassLine("r - r - o - r - r - o - f - r -", [["A2", "A3", "E3"], ["F2", "F3", "C3"], ["C3", "C4", "G3"], ["G2", "G3", "D3"]]),
    drums: "k - h - s - h - k - k - s - h -".split(" "),
  },
  boss: {
    bpm: 168,
    leadLen: 0.8,
    lead: ("E5 - E5 - G5 - E5 - B5 - A5 - G5 - F#5 - E5 - - - C5 - E5 - G5 - - - E5 - - - " +
           "D5 - F#5 - A5 - F#5 - D6 - C6 - A5 - F#5 - B4 - D#5 - F#5 - B5 - A5 - F#5 - D#5 - B4 -").trim().split(" "),
    bass: bassLine("r - r o r - r o r - r o f - o -", [["E2", "E3", "B2"], ["C2", "C3", "G2"], ["D2", "D3", "A2"], ["B1", "B2", "F#2"]]),
    drums: "k h h h s h h k k h k h s h h h".split(" "),
  },
};
TRACKS.final = { ...TRACKS.boss, bpm: 184 };

let musicGain = null;
let musicOn = true;
const MUSIC_VOL = 0.55;

// melody / bass note
function musicTone(freq, t, dur, type, vol, out) {
  const osc = AC.createOscillator();
  const gain = AC.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

// snare / hi-hat: high-passed noise
function musicNoise(t, dur, vol, cutoff, out) {
  const src = AC.createBufferSource();
  const filter = AC.createBiquadFilter();
  const gain = AC.createGain();
  src.buffer = noiseBuf;
  filter.type = "highpass";
  filter.frequency.value = cutoff;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
}

function kick(t, out) {
  const osc = AC.createOscillator();
  const gain = AC.createGain();
  osc.frequency.setValueAtTime(150, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.12);
  gain.gain.setValueAtTime(0.55, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + 0.14);
  osc.connect(gain);
  gain.connect(out);
  osc.start(t);
  osc.stop(t + 0.16);
}

export const music = {
  cur: null,
  step: 0,
  next: 0,
  timer: null,

  set(name) {
    if (!AC || !musicOn || muted) name = null;
    if (name === this.cur) return;
    this.cur = name;
    if (!AC) return;

    if (!musicGain) {
      musicGain = AC.createGain();
      musicGain.gain.value = 0;
      musicGain.connect(master);
    }

    // fade out whatever was playing
    const t = AC.currentTime;
    const g = musicGain.gain;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(0, t + 0.15);
    clearInterval(this.timer);
    this.timer = null;
    if (!name) return;

    // ...and fade the new track in
    this.step = 0;
    this.next = t + 0.2;
    g.linearRampToValueAtTime(MUSIC_VOL, t + 0.5);
    this.timer = setInterval(() => this.tick(), 25);
  },

  // schedule every note that falls in the next ~120ms
  tick() {
    const track = TRACKS[this.cur];
    if (!track || !AC) return;
    const stepLen = 60 / track.bpm / 4;

    while (this.next < AC.currentTime + 0.12) {
      const i = this.step;
      const t = this.next;
      const lead = track.lead[i];
      const bass = track.bass[i];
      const drum = track.drums[i % 16];

      if (lead && lead !== "-") musicTone(hz(lead), t, stepLen * track.leadLen * 2, "square", 0.16, musicGain);
      if (bass && bass !== "-") musicTone(hz(bass), t, stepLen * 1.8, "triangle", 0.4, musicGain);
      if (drum === "k") kick(t, musicGain);
      else if (drum === "s") musicNoise(t, 0.1, 0.22, 1500, musicGain);
      else if (drum === "h") musicNoise(t, 0.03, 0.07, 7000, musicGain);

      this.step = (i + 1) % track.lead.length;
      this.next += stepLen;
    }
  },

  enable(on) {
    musicOn = on;
    if (!on) this.set(null);
  },
};

// the same sound can't retrigger within 40ms (stops stacking when many things happen at once)
export function sfx(name) {
  if (!AC || muted) return;
  const now = AC.currentTime;
  if (now - (lastPlay[name] || 0) < 0.04) return;
  lastPlay[name] = now;
  SFX[name]();
}
