// Chiptune SFX + background music (Web Audio API, no files)
export let AC = null, master = null, noiseBuf = null, muted = false;
const VOL = 0.22, lastPlay = {};
export const audio = {
  init() {
    if (AC) { if (AC.state === "suspended") AC.resume(); return; }
    const C = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext); if (!C) return;
    AC = new C(); master = AC.createGain(); master.gain.value = muted ? 0 : VOL; master.connect(AC.destination);
    noiseBuf = AC.createBuffer(1, AC.sampleRate * 0.6, AC.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  },
  setMuted(m) { muted = m; if (master) master.gain.value = m ? 0 : VOL; },
};
function tone({ f = 440, f2, type = "square", d = 0.1, v = 0.5, delay = 0 }) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay, o = AC.createOscillator(), gn = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t); if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
  o.connect(gn); gn.connect(master); o.start(t); o.stop(t + d + 0.02);
}
function noise({ d = 0.1, v = 0.4, f = 1200, delay = 0 }) {
  if (!AC || muted) return;
  const t = AC.currentTime + delay, src = AC.createBufferSource(), fl = AC.createBiquadFilter(), gn = AC.createGain();
  src.buffer = noiseBuf; fl.type = "bandpass"; fl.frequency.value = f; fl.Q.value = 0.8;
  gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d);
  src.connect(fl); fl.connect(gn); gn.connect(master); src.start(t); src.stop(t + d + 0.02);
}
const notes = (fs, o = {}) => fs.forEach((f, i) => tone({ f, d: o.d || 0.09, v: o.v || 0.3, type: o.type || "square", delay: i * (o.gap || 0.07) }));
const SFX = {
  swing:    () => noise({ d: 0.08, v: 0.3, f: 3200 }),
  hit:      () => tone({ f: 240, f2: 110, d: 0.07, v: 0.35 }),
  kill:     () => tone({ f: 620, f2: 1040, d: 0.08, v: 0.25 }),
  hurt:     () => { tone({ f: 220, f2: 60, type: "sawtooth", d: 0.28, v: 0.45 }); noise({ d: 0.15, v: 0.3, f: 500 }); },
  dash:     () => tone({ f: 260, f2: 900, type: "triangle", d: 0.13, v: 0.4 }),
  shot:     () => tone({ f: 1500, f2: 750, type: "triangle", d: 0.05, v: 0.12 }),
  pickup:   () => notes([523, 659, 784, 1047], { gap: 0.06, v: 0.25 }),
  shield:   () => { tone({ f: 900, f2: 280, type: "triangle", d: 0.22, v: 0.35 }); noise({ d: 0.12, v: 0.25, f: 5000 }); },
  bossIn:   () => notes([131, 123, 117, 110], { type: "sawtooth", d: 0.3, gap: 0.26, v: 0.35 }),
  wind:     () => tone({ f: 170, f2: 440, type: "sawtooth", d: 0.42, v: 0.22 }),
  bossShot: () => tone({ f: 520, f2: 260, d: 0.08, v: 0.12 }),
  bossDie:  () => { noise({ d: 0.5, v: 0.45, f: 350 }); notes([392, 523, 659, 784], { gap: 0.09, d: 0.14, delay: 0.1 }); },
  win:      () => { noise({ d: 0.5, v: 0.4, f: 350 }); notes([523, 523, 523, 659, 784, 1047], { gap: 0.13, d: 0.18, v: 0.3 }); tone({ f: 1047, d: 0.6, v: 0.25, delay: 0.8, type: "triangle" }); },
  over:     () => notes([392, 330, 262, 196], { type: "triangle", d: 0.24, gap: 0.19, v: 0.35 }),
  click:    () => tone({ f: 880, d: 0.03, v: 0.18 }),
  arrow:    () => { tone({ f: 760, f2: 320, type: "triangle", d: 0.07, v: 0.22 }); noise({ d: 0.04, v: 0.12, f: 6000 }); },
  cast:     () => tone({ f: 420, f2: 1250, type: "square", d: 0.14, v: 0.14 }),
  orbHit:   () => noise({ d: 0.14, v: 0.28, f: 900 }),
  roll:     () => { noise({ d: 0.12, v: 0.25, f: 1400 }); tone({ f: 300, f2: 520, type: "triangle", d: 0.1, v: 0.2 }); },
  blink:    () => { tone({ f: 1400, f2: 260, type: "square", d: 0.12, v: 0.2 }); noise({ d: 0.08, v: 0.18, f: 7000 }); },
  hawk:     () => { tone({ f: 1900, f2: 1100, type: "square", d: 0.12, v: 0.12 }); noise({ d: 0.06, v: 0.1, f: 5000 }); },
  block:    () => { tone({ f: 1250, f2: 620, type: "triangle", d: 0.1, v: 0.3 }); noise({ d: 0.06, v: 0.15, f: 6000 }); },
  nova:     () => { tone({ f: 200, f2: 820, type: "triangle", d: 0.28, v: 0.3 }); noise({ d: 0.2, v: 0.15, f: 4000 }); },
};
const NOTE = { C:0, "C#":1, D:2, "D#":3, E:4, F:5, "F#":6, G:7, "G#":8, A:9, "A#":10, B:11 };
const hz = n => { const m = n.match(/^([A-G]#?)(\d)$/); return 440 * 2 ** ((NOTE[m[1]] + (+m[2] + 1) * 12 - 69) / 12); };
const bassLine = (pat, chords) => chords.flatMap(([r, o, f]) => pat.split(" ").map(x => x === "r" ? r : x === "o" ? o : x === "f" ? f : "-"));
const TRACKS = {
  normal: { bpm: 140, leadLen: 0.9,
    lead: ("A4 - C5 - E5 - - - D5 - C5 - B4 - C5 - A4 - - - F4 - A4 - C5 - - - A4 - - - " +
           "G4 - C5 - E5 - G5 - E5 - - - D5 - C5 - D5 - - - B4 - G4 - B4 - D5 - - - - -").trim().split(" "),
    bass: bassLine("r - r - o - r - r - o - f - r -", [["A2","A3","E3"],["F2","F3","C3"],["C3","C4","G3"],["G2","G3","D3"]]),
    drums: "k - h - s - h - k - k - s - h -".split(" ") },
  boss: { bpm: 168, leadLen: 0.8,
    lead: ("E5 - E5 - G5 - E5 - B5 - A5 - G5 - F#5 - E5 - - - C5 - E5 - G5 - - - E5 - - - " +
           "D5 - F#5 - A5 - F#5 - D6 - C6 - A5 - F#5 - B4 - D#5 - F#5 - B5 - A5 - F#5 - D#5 - B4 -").trim().split(" "),
    bass: bassLine("r - r o r - r o r - r o f - o -", [["E2","E3","B2"],["C2","C3","G2"],["D2","D3","A2"],["B1","B2","F#2"]]),
    drums: "k h h h s h h k k h k h s h h h".split(" ") },
};
TRACKS.final = { ...TRACKS.boss, bpm: 184 };
let musicGain = null, musicOn = true;
const MUSIC_VOL = 0.55;
function mt(f, t, d, type, v, out) { const o = AC.createOscillator(), gn = AC.createGain(); o.type = type; o.frequency.setValueAtTime(f, t); gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d); o.connect(gn); gn.connect(out); o.start(t); o.stop(t + d + 0.02); }
function mn(t, d, v, f, out) { const src = AC.createBufferSource(), fl = AC.createBiquadFilter(), gn = AC.createGain(); src.buffer = noiseBuf; fl.type = "highpass"; fl.frequency.value = f; gn.gain.setValueAtTime(v, t); gn.gain.exponentialRampToValueAtTime(0.001, t + d); src.connect(fl); fl.connect(gn); gn.connect(out); src.start(t); src.stop(t + d + 0.02); }
function kick(t, out) { const o = AC.createOscillator(), gn = AC.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12); gn.gain.setValueAtTime(0.55, t); gn.gain.exponentialRampToValueAtTime(0.001, t + 0.14); o.connect(gn); gn.connect(out); o.start(t); o.stop(t + 0.16); }
export const music = {
  cur: null, step: 0, next: 0, timer: null,
  set(name) {
    if (!AC || !musicOn || muted) name = null;
    if (name === this.cur) return;
    this.cur = name;
    if (!AC) return;
    if (!musicGain) { musicGain = AC.createGain(); musicGain.gain.value = 0; musicGain.connect(master); }
    const t = AC.currentTime, gg = musicGain.gain;
    gg.cancelScheduledValues(t); gg.setValueAtTime(gg.value, t); gg.linearRampToValueAtTime(0, t + 0.15);
    clearInterval(this.timer); this.timer = null;
    if (!name) return;
    this.step = 0; this.next = t + 0.2;
    gg.linearRampToValueAtTime(MUSIC_VOL, t + 0.5);
    this.timer = setInterval(() => this.tick(), 25);
  },
  tick() {
    const T = TRACKS[this.cur]; if (!T || !AC) return;
    const sp = 60 / T.bpm / 4;
    while (this.next < AC.currentTime + 0.12) {
      const i = this.step, t = this.next, L = T.lead[i], B = T.bass[i], D = T.drums[i % 16];
      if (L && L !== "-") mt(hz(L), t, sp * T.leadLen * 2, "square", 0.16, musicGain);
      if (B && B !== "-") mt(hz(B), t, sp * 1.8, "triangle", 0.4, musicGain);
      if (D === "k") kick(t, musicGain); else if (D === "s") mn(t, 0.1, 0.22, 1500, musicGain); else if (D === "h") mn(t, 0.03, 0.07, 7000, musicGain);
      this.step = (i + 1) % T.lead.length; this.next += sp;
    }
  },
  enable(on) { musicOn = on; if (!on) this.set(null); },
};
export function sfx(name) {
  if (!AC || muted) return;
  const now = AC.currentTime; if (now - (lastPlay[name] || 0) < 0.04) return;
  lastPlay[name] = now; SFX[name]();
}
