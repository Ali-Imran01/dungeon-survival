import { useEffect, useRef, useState } from "react";
import { audio, sfx, music } from "./audio.js";
import { PAL, DIM, TROPHY, spr, drawHero } from "./sprites.js";
import { UPGRADES, UP_ICONS, RARITY, describe } from "./upgrades.js";
import { CLASSES, CLASS_KEYS, UNLOCK } from "./classes.js";
import {
  W, H, fitSize, newGame, step, draw, orbit, triggerAbility, chooseUpgrade, rerollChoices,
  musicTrack, stageOf, continueEndless,
} from "./engine.js";

const ui = {
  bar: { position: "absolute", bottom: 10, left: 10, right: 10, fontSize: 9, pointerEvents: "none" },
  barBox: { height: 7, marginTop: 3, background: "#120e1a", border: "2px solid #120e1a", borderRadius: 2 },
  fx: { position: "absolute", top: 26, left: 0, right: 0, textAlign: "center", fontSize: 9, color: "#5ef2ff", pointerEvents: "none" },
  hud: {
    position: "absolute", top: 8, left: 10, right: 10, display: "flex", justifyContent: "space-between",
    gap: 6, fontSize: 10, pointerEvents: "none",
  },
  overlay: {
    position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: 10, background: "rgba(18,14,26,.75)", textAlign: "center",
    padding: 12, fontSize: 10, lineHeight: 1.8,
  },
  btn: {
    font: "inherit", fontSize: 10, padding: "9px 14px", background: "#5b3f8c", color: "#fff",
    border: "2px solid #120e1a", borderRadius: 4, cursor: "pointer", textDecoration: "none",
    touchAction: "manipulation",
  },
  font: {
    fontFamily: "'Press Start 2P', ui-monospace, monospace", color: "#e8e4f5",
    userSelect: "none", WebkitUserSelect: "none", WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent",
  },
};

// Mobile shell: PSP-style handheld, landscape only. The screen is the full 240x135 desktop resolution
// (16:9, same shape as a PSP screen).
const U = "clamp(76px, 30dvh, 124px)";   // size of the D-pad / face-button clusters, scales with the phone's height
const psp = {
  body: {
    position: "relative", width: "100%", maxWidth: 940, margin: "0 auto", boxSizing: "border-box",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: "1.6vw",
    padding: "1.6dvh 2.2vw",
    background: "linear-gradient(180deg,#2d2d36 0%,#17171d 45%,#0b0b10 100%)",
    borderRadius: 28,
    boxShadow: "inset 0 2px 2px rgba(255,255,255,.2), inset 0 -3px 6px rgba(0,0,0,.6), 0 6px 18px rgba(0,0,0,.5)",
    touchAction: "manipulation",
  },
  side: {
    flex: "1 1 0", minWidth: 0, display: "flex", flexDirection: "column", alignItems: "center",
    justifyContent: "center", gap: "2.4dvh",
  },
  screenWrap: { flex: "none", width: "min(58vw, calc((100dvh - 40px) * 1.7778))" },
  bezel: { background: "#050507", padding: "1.1%", borderRadius: 10, boxShadow: "0 0 0 2px #7d7f8c, inset 0 0 6px #000" },
  title: { margin: "0.8dvh 0 0", fontSize: 7, color: "#8a8aa0", textAlign: "center", letterSpacing: 1 },
  shoulder: {
    position: "absolute", top: -5, width: "15%", height: 9,
    background: "linear-gradient(180deg,#3a3a45,#1d1d24)", borderRadius: "9px 9px 0 0",
    boxShadow: "inset 0 1px 1px rgba(255,255,255,.25)",
  },
  dpad: { position: "relative", width: U, height: U, touchAction: "none", flex: "none" },
  cluster: { position: "relative", width: U, height: U, flex: "none" },
  face: {
    position: "absolute", width: "41%", height: "41%", borderRadius: "50%",
    background: "radial-gradient(circle at 35% 30%,#4a4a58,#22222b)", border: "1px solid #62627a",
    font: "inherit", fontFamily: "system-ui, sans-serif", fontSize: "clamp(14px, 4.4dvh, 22px)",
    lineHeight: 1, padding: 0, touchAction: "none", cursor: "pointer",
  },
  pills: { display: "flex", gap: "3vw" },
  pill: {
    width: 34, height: 10, borderRadius: 6, background: "linear-gradient(180deg,#5a5a68,#33333d)",
    border: "none", transform: "rotate(-25deg)", touchAction: "manipulation", cursor: "pointer",
  },
  pillLbl: { fontSize: 6, color: "#8a8aa0", marginTop: 5, textAlign: "center" },
  rotate: {
    position: "fixed", inset: 0, zIndex: 50, background: "#0b0b10", color: "#e8e4f5", display: "flex",
    flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: 20,
    textAlign: "center", fontSize: 11, lineHeight: 1.7,
  },
};

const buzz = (n = 8) => navigator.vibrate?.(n);

// localStorage can throw (private mode, blocked storage), so everything goes through these two
function load(key, fallback) {
  try {
    const v = localStorage.getItem(key);
    return v === null ? fallback : JSON.parse(v);
  } catch {
    return fallback;
  }
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// the Chronomancer became the Necromancer: carry its saved bests / trophy over to the new key
function renameOldClass(obj) {
  if (obj && obj.chronomancer !== undefined) {
    obj.necromancer = obj.chronomancer;
    delete obj.chronomancer;
  }
  return obj;
}

function PixelArt({ rows, pal, scale = 4 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current.getContext("2d");
    c.clearRect(0, 0, rows[0].length, rows.length);
    spr(c, rows, 0, 0, false, pal);
  }, [rows, pal]);
  return (
    <canvas
      ref={ref}
      width={rows[0].length}
      height={rows.length}
      style={{ width: rows[0].length * scale, height: rows.length * scale, imageRendering: "pixelated" }}
    />
  );
}

const LOCKED_PAL = new Proxy({}, { get: (_, k) => (k === "K" ? "#120e1a" : "#3a3448") });

// little animated hero on the class select screen (idle → attack → walk, 2.4s loop)
function HeroPreview({ cls, scale = 4, locked }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current.getContext("2d");
    let raf;
    const t0 = performance.now();
    const loop = now => {
      const k = (now - t0) % 2400;
      c.clearRect(0, 0, 22, 20);
      const hero = {
        x: 3, y: 2, face: 1,
        moving: k > 1600,
        atk: k > 1100 && k < 1400 ? 0.24 - (k - 1100) / 1250 : 0,
      };
      drawHero(c, cls, hero, now, locked ? LOCKED_PAL : undefined);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [cls, locked]);
  return (
    <canvas
      ref={ref}
      width={22}
      height={20}
      style={{ width: 22 * scale, height: 20 * scale, imageRendering: "pixelated" }}
    />
  );
}

function StatBar({ label, v, c }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 7 }}>
      <span style={{ width: 40, textAlign: "left", opacity: .8 }}>{label}</span>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} style={{ width: 8, height: 6, background: i <= v ? c : "#2a2338" }} />
      ))}
    </div>
  );
}

const UPAL = { ...PAL, P: "#8a6fd1", p: "#5b3f8c" };
const RARITY_ORDER = ["epic", "rare", "common"];
const upg = id => UPGRADES.find(u => u.id === id);

// owned upgrades as a list, epics first
const byRarity = owned =>
  Object.keys(owned).map(upg).sort((a, b) => RARITY_ORDER.indexOf(a.rarity) - RARITY_ORDER.indexOf(b.rarity));

// ●●○ style stack indicator
const pips = (u, have) => "●".repeat(have) + "○".repeat(Math.max(0, u.max - have));

function UpIcon({ id, scale = 3 }) {
  return <PixelArt rows={UP_ICONS[id]} pal={UPAL} scale={scale} />;
}

function BuildStrip({ owned, scale = 2 }) {
  const list = byRarity(owned);
  if (!list.length) return <div style={{ fontSize: 7, opacity: .6 }}>No upgrades yet</div>;
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
      {list.map(u => (
        <div
          key={u.id}
          title={u.name}
          style={{
            position: "relative", border: `2px solid ${RARITY[u.rarity].color}`, borderRadius: 3,
            padding: 2, background: "#221c30",
          }}
        >
          <UpIcon id={u.id} scale={scale} />
          {owned[u.id] > 1 && (
            <b style={{ position: "absolute", right: -3, bottom: -5, fontSize: 6, color: "#ffd166" }}>x{owned[u.id]}</b>
          )}
        </div>
      ))}
    </div>
  );
}

function BuildList({ owned, cls, compact }) {
  const list = byRarity(owned);
  if (!list.length) {
    return <div style={{ fontSize: 7, opacity: .6 }}>No upgrades yet — level up by collecting soul shards</div>;
  }
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: compact ? "1fr" : "1fr 1fr",
        gap: compact ? 3 : "5px 12px",
        width: compact ? "94%" : "min(560px, 92%)",
        maxHeight: compact ? 150 : 200,
        overflowY: "auto",
      }}
    >
      {list.map(u => (
        <div
          key={u.id}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "3px 5px",
            borderLeft: `3px solid ${RARITY[u.rarity].color}`, background: "#221c30", textAlign: "left",
          }}
        >
          <UpIcon id={u.id} scale={compact ? 2 : 3} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: compact ? 7 : 8 }}>{u.name}</div>
            {!compact && <div style={{ fontSize: 6, opacity: .75, marginTop: 3 }}>{describe(u, cls)}</div>}
          </div>
          <span style={{ fontSize: 7, color: RARITY[u.rarity].color }}>{pips(u, owned[u.id])}</span>
        </div>
      ))}
    </div>
  );
}

// contained: the game sits inside a larger page (the portfolio). The "rotate your phone" screen then covers only the
// game's own panel instead of the whole screen, so visitors can still scroll past it.
export default function DungeonSurvival({ projectsHref = "#projects", gameboy = undefined, contained = false }) {
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  // ?psp=1 previews the mobile shell on desktop
  const forcePsp = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("psp");
  // "gb" = compact mobile shell (kept name; the `gameboy` prop still works)
  const gb = gameboy ?? (coarse || forcePsp);

  const [size, setSize] = useState(() => fitSize(false));
  useEffect(() => {
    document.documentElement.classList.toggle("psp", !!gb);
    return () => document.documentElement.classList.remove("psp");
  }, [gb]);

  const [cls, setCls] = useState(() => {
    const stored = load("wisp-class", "warden");
    const saved = stored === "chronomancer" ? "necromancer" : stored;
    return CLASSES[saved] ? saved : "warden";
  });

  const cv = useRef(null);
  const g = useRef(null);
  const keys = useRef(new Set());
  const touch = useRef(null);
  const pad = useRef(null);
  const dirRef = useRef("");
  const paused = useRef(false);
  const onScreen = useRef(true);
  if (!g.current) g.current = newGame(cls);

  const [state, setState] = useState("idle");       // idle | select | play | over | win
  const [isPaused, setPaused] = useState(false);
  const [dir, setDir] = useState("");
  const [land, setLand] = useState(() => typeof window !== "undefined" && window.innerWidth > window.innerHeight);
  const [hud, setHud] = useState({ time: 0 });
  const [choice, setChoice] = useState(null);
  const [sel, setSel] = useState(0);
  const [tab, setTab] = useState("resume");
  const [result, setResult] = useState(null);
  const [bests, setBests] = useState(() => renameOldClass(load("wisp-bests", {})));
  const [endBests, setEndBests] = useState(() => renameOldClass(load("wisp-endless", {})));   // best endless depth per class (loop*5 + stage)
  const [trophies, setTrophies] = useState(() => {
    const t = renameOldClass(load("wisp-trophies", {}));
    if (load("wisp-trophy", 0) === 1) t.warden = true;     // old single-trophy save
    return t;
  });
  const [newMaster, setNewMaster] = useState(false);

  const [sound, setSound] = useState(() => {
    const muted = load("wisp-muted", 0) === 1;
    audio.setMuted(muted);
    return !muted;
  });
  const toggleSound = () => {
    const on = !sound;
    audio.init();
    audio.setMuted(!on);
    setSound(on);
    if (on) sfx("click");
    save("wisp-muted", on ? 0 : 1);
  };

  const [musicSt, setMusicSt] = useState(() => {
    const on = load("wisp-music", 1) !== 0;
    music.enable(on);
    return on;
  });
  const toggleMusic = () => {
    const on = !musicSt;
    audio.init();
    music.enable(on);
    setMusicSt(on);
    sfx("click");
    save("wisp-music", on ? 1 : 0);
  };

  const allTrophies = CLASS_KEYS.every(k => trophies[k]);

  // idle scene behind the menus: a fresh game of the chosen class
  const preview = k => {
    g.current = newGame(k);
  };

  const openSelect = () => {
    audio.init();
    sfx("click");
    if (gb) {
      // only succeeds in fullscreen on Android
      try { window.screen.orientation?.lock?.("landscape")?.catch?.(() => {}); } catch {}
    }
    preview(cls);
    setState("select");
  };

  const cycle = d => {
    const i = (CLASS_KEYS.indexOf(cls) + d + CLASS_KEYS.length) % CLASS_KEYS.length;
    const k = CLASS_KEYS[i];
    sfx("click");
    setCls(k);
    preview(k);
  };

  // ?unlock=1 unlocks every class (testing)
  const devUnlock = typeof window !== "undefined" &&
    (new URLSearchParams(window.location.search).has("unlock") || !!window.DS_UNLOCK_ALL);
  const isLocked = k => !!UNLOCK[k] && !trophies[UNLOCK[k]] && !devUnlock;

  const start = (k = cls) => {
    if (isLocked(k)) {
      audio.init();
      sfx("hurt");
      return;
    }
    audio.init();
    sfx("click");
    setCls(k);
    save("wisp-class", k);
    // ?stage=N for testing
    const devStage = Math.min(5, Math.max(1, +new URLSearchParams(window.location.search).get("stage") || 1));
    g.current = newGame(k, devStage);
    touch.current = null;
    pad.current = null;
    paused.current = false;
    setPaused(false);
    setNewMaster(false);
    setHud({ time: 0 });
    setChoice(null);
    setResult(null);
    setState("play");
    cv.current?.focus();
  };

  const togglePause = (t = "resume") => {
    if (state !== "play" || choice) return;
    audio.init();
    sfx("click");
    paused.current = !paused.current;
    setPaused(paused.current);
    setTab(t);
  };

  const pick = i => {
    const c = choice?.choices[i];
    if (!c) return;
    buzz(12);
    chooseUpgrade(g.current, c.id);
  };

  const reroll = () => {
    if (!choice || choice.rerolls <= 0) return;
    buzz();
    sfx("click");
    rerollChoices(g.current);
  };

  // A / Start / Enter
  const primary = () => {
    buzz();
    if (state === "idle" || state === "over" || state === "win") openSelect();
    else if (state === "select") start();
  };

  // stop the music when the tab is hidden or the component goes away
  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) music.set(null);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      music.set(null);
    };
  }, []);

  // don't burn CPU (or play music) while the game is scrolled out of view
  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      onScreen.current = entry.isIntersecting;
    });
    observer.observe(cv.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const onResize = () => {
      setLand(window.innerWidth > window.innerHeight);
      if (state !== "play") {
        setSize(fitSize(false));
        g.current = newGame(cls);
      } else if (gb && window.innerWidth <= window.innerHeight && !paused.current) {
        // portrait mid-run: pause
        paused.current = true;
        setPaused(true);
        setTab("resume");
      }
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [state, gb, cls]);

  // the game loop
  useEffect(() => {
    const ctx = cv.current.getContext("2d");
    let raf;
    let last = performance.now();
    let lastHud = "";
    let lastChoice = "";

    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const G = g.current;

      if (onScreen.current && !document.hidden) {
        if (state === "play") {
          if (!paused.current) step(G, dt, keys.current, touch.current || pad.current);
        } else {
          orbit(G, now / 1000);
        }
        draw(ctx, G, now, state === "play" ? touch.current : null, gb ? "X" : "SPC", state === "play");
      }

      const live = state === "play" && !paused.current && !G.over && onScreen.current && !document.hidden;
      music.set(live && !G.pending ? musicTrack(G) : null);

      if (state === "play") {
        // push the pending upgrade pick into React state, only when it actually changed
        const pending = G.pending;
        const choiceKey = pending ? pending.type + pending.choices.map(c => c.id).join() + G.rerolls : "";
        if (choiceKey !== lastChoice) {
          lastChoice = choiceKey;
          setChoice(pending
            ? {
              type: pending.type, choices: pending.choices, rerolls: G.rerolls,
              stage: G.stage, lv: G.lv, owned: { ...G.owned },
            }
            : null);
          setSel(0);
        }

        // HUD clock only re-renders React once a second
        const hudKey = `${Math.floor(G.t)}`;
        if (hudKey !== lastHud) {
          lastHud = hudKey;
          setHud({ time: Math.floor(G.t) });
        }

        if (G.over) {
          const depth = G.loop * 5 + G.stage;
          if (G.endless) {
            setEndBests(b => {
              const next = { ...b, [G.cls]: Math.max(b[G.cls] || 0, depth) };
              save("wisp-endless", next);
              return next;
            });
          }
          setResult({
            endless: G.endless, loop: G.loop, depth, cls: G.cls, stage: G.stage, phase: G.phase,
            score: G.score, time: Math.floor(G.t), lv: G.lv, owned: { ...G.owned }, stageName: stageOf(G).name,
          });
          setState(G.won ? "win" : "over");
          if (G.won) {
            setTrophies(t => {
              const next = { ...t, [G.cls]: true };
              save("wisp-trophies", next);
              if (CLASS_KEYS.every(k => next[k]) && !CLASS_KEYS.every(k => t[k])) setNewMaster(true);
              return next;
            });
          }
          setBests(b => {
            const next = { ...b, [G.cls]: Math.max(b[G.cls] || 0, G.score) };
            save("wisp-bests", next);
            return next;
          });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state, size]);

  // keyboard
  useEffect(() => {
    if (state === "play") {
      const block = new Set(["arrowup", "arrowdown", "arrowleft", "arrowright", " "]);

      const onKeyDown = e => {
        const k = e.key.toLowerCase();
        if (block.has(k) || k === "tab") e.preventDefault();

        // upgrade pick open: keys choose a card instead of moving
        if (choice) {
          const n = choice.choices.length;
          if (k >= "1" && k <= "3") pick(+k - 1);
          else if (k === "arrowleft" || k === "a" || k === "arrowup" || k === "w") setSel(i => (i + n - 1) % n);
          else if (k === "arrowright" || k === "d" || k === "arrowdown" || k === "s") setSel(i => (i + 1) % n);
          else if (k === "enter" || k === " ") pick(sel);
          else if (k === "r") reroll();
          return;
        }

        if (k === "tab") {
          togglePause("build");
          return;
        }
        if (k === "escape" || k === "p") {
          togglePause();
          return;
        }
        if (k === "m") {
          toggleSound();
          return;
        }
        if (k === "n") {
          toggleMusic();
          return;
        }
        if (k === " " && !paused.current) triggerAbility(g.current);
        keys.current.add(k);
      };
      const onKeyUp = e => keys.current.delete(e.key.toLowerCase());

      window.addEventListener("keydown", onKeyDown);
      window.addEventListener("keyup", onKeyUp);
      return () => {
        window.removeEventListener("keydown", onKeyDown);
        window.removeEventListener("keyup", onKeyUp);
        keys.current.clear();
      };
    }

    if (state === "select") {
      const onKeyDown = e => {
        const k = e.key.toLowerCase();
        if (k === "arrowleft" || k === "a") {
          e.preventDefault();
          cycle(-1);
        } else if (k === "arrowright" || k === "d") {
          e.preventDefault();
          cycle(1);
        } else if (k === "enter" || k === " ") {
          e.preventDefault();
          start();
        } else if (k === "escape") {
          setState("idle");
        }
      };
      window.addEventListener("keydown", onKeyDown);
      return () => window.removeEventListener("keydown", onKeyDown);
    }
  }, [state, cls, sound, musicSt, choice, sel]);

  // touch on the canvas (desktop touchscreens): drag = virtual stick, a second finger = ability
  const pDown = e => {
    if (state !== "play" || gb) return;
    if (touch.current) {
      triggerAbility(g.current);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    touch.current = {
      id: e.pointerId, ox: e.clientX, oy: e.clientY,
      jx: (e.clientX - rect.left) * W / rect.width,
      jy: (e.clientY - rect.top) * H / rect.height,
      dx: 0, dy: 0,
    };
  };
  const pMove = e => {
    const t = touch.current;
    if (!t || t.id !== e.pointerId) return;
    t.dx = Math.max(-1, Math.min(1, (e.clientX - t.ox) / 28));
    t.dy = Math.max(-1, Math.min(1, (e.clientY - t.oy) / 28));
  };
  const pUp = e => {
    if (touch.current?.id === e.pointerId) touch.current = null;
  };

  // D-pad (mobile shell): snaps the touch position to one of 8 directions
  const padSet = e => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    let d = "";
    if (Math.hypot(x, y) < 10) {
      pad.current = null;
    } else {
      const angle = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * Math.PI / 4;
      const dx = Math.cos(angle);
      const dy = Math.sin(angle);
      pad.current = { dx, dy };
      d = (dy < -0.3 ? "u" : dy > 0.3 ? "d" : "") + (dx < -0.3 ? "l" : dx > 0.3 ? "r" : "");
    }

    if (d !== dirRef.current) {
      // on the menus the D-pad moves the selection instead of the hero
      if (state === "select" && (d === "l" || d === "r")) cycle(d === "l" ? -1 : 1);
      if (choice && (d === "u" || d === "d")) {
        const n = choice.choices.length;
        setSel(i => (i + (d === "u" ? n - 1 : 1)) % n);
        pad.current = null;
      }
      dirRef.current = d;
      setDir(d);
      if (d) buzz(5);
    }
  };
  const padDown = e => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    e.currentTarget.dataset.on = "1";
    padSet(e);
  };
  const padMove = e => {
    if (e.currentTarget.dataset.on === "1") padSet(e);
  };
  const padUp = e => {
    e.currentTarget.dataset.on = "";
    pad.current = null;
    dirRef.current = "";
    setDir("");
  };

  const C = CLASSES[cls];
  const timeLabel = secs => `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

  const btnRow = (
    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
      <button style={ui.btn} onClick={() => start()}>Play again</button>
      <button style={{ ...ui.btn, background: "#2a2338" }} onClick={openSelect}>Change class</button>
      <a style={{ ...ui.btn, background: "transparent", border: "2px solid #5b3f8c" }} href={projectsHref}>
        See my projects
      </a>
    </div>
  );

  const ctrl = gb
    ? `D-pad move, X ${C.abilityName.toLowerCase()}, O pause`
    : coarse
      ? "Drag to move, second finger to use ability"
      : `WASD/arrows move, Space ${C.abilityName.toLowerCase()}, Esc pause`;

  const trophyRow = (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-end", justifyContent: "center" }}>
      {CLASS_KEYS.map(k => (
        <div
          key={k}
          style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3, fontSize: 6,
            color: trophies[k] ? "#f5c542" : "#6b6480",
          }}
        >
          <PixelArt rows={TROPHY} pal={trophies[k] ? PAL : DIM} scale={gb ? 1.5 : 2} />
          {CLASSES[k].name}
        </div>
      ))}
    </div>
  );

  const soundBtn = st => (
    <span style={{ display: "inline-flex", gap: 6 }}>
      <button
        onClick={toggleMusic}
        aria-pressed={musicSt}
        style={{ font: "inherit", fontSize: 8, padding: "4px 8px", borderRadius: 4, cursor: "pointer", border: "none", opacity: musicSt ? 1 : 0.55, ...st }}
      >
        Music {musicSt ? "on" : "off"}
      </button>
      <button
        onClick={toggleSound}
        aria-pressed={sound}
        style={{ font: "inherit", fontSize: 8, padding: "4px 8px", borderRadius: 4, cursor: "pointer", border: "none", opacity: sound ? 1 : 0.55, ...st }}
      >
        Sound {sound ? "on" : "off"}
      </button>
    </span>
  );

  // one upgrade card on the level-up / stage-clear screen (compact row on the mobile shell, tall card on desktop)
  const upgradeCard = (u, i) => {
    const R = RARITY[u.rarity];
    const have = choice.owned[u.id] || 0;
    const on = i === sel;

    if (gb) {
      return (
        <div
          key={u.id}
          onClick={() => pick(i)}
          style={{
            display: "flex", gap: 6, alignItems: "center", background: "#221c30", border: `2px solid ${R.color}`,
            borderRadius: 4, padding: "4px 5px", boxShadow: on ? "0 0 0 2px #fff inset" : "none",
            cursor: "pointer", textAlign: "left",
          }}
        >
          <UpIcon id={u.id} scale={2} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 7 }}>
              {u.name} <span style={{ color: R.color, fontSize: 6 }}>{pips(u, have + 1)}</span>
            </div>
            <div style={{ fontSize: 6, opacity: .8, marginTop: 2 }}>{describe(u, choice.cls || cls)}</div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={u.id}
        onClick={() => pick(i)}
        onMouseEnter={() => setSel(i)}
        style={{
          width: 150, background: "#221c30", border: `2px solid ${R.color}`, borderRadius: 6, padding: "10px 8px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer",
          transform: on ? "translateY(-4px)" : "none", boxShadow: on ? "0 0 0 2px #fff inset" : "none",
        }}
      >
        <div style={{ fontSize: 6, color: R.color, letterSpacing: 1 }}>
          {R.label.toUpperCase()}{u.cls ? " · " + u.cls.toUpperCase() : ""}
        </div>
        <UpIcon id={u.id} scale={4} />
        <div style={{ fontSize: 9 }}>{u.name}</div>
        <div style={{ fontSize: 6, lineHeight: 1.7, opacity: .85, minHeight: 30 }}>{describe(u, cls)}</div>
        <div style={{ fontSize: 8, color: R.color, letterSpacing: 2 }}>{pips(u, have + 1)}</div>
      </div>
    );
  };

  const screen = (
    <div
      style={gb
        ? { position: "relative", overflow: "hidden", background: "#1b1726", borderRadius: 3, ...ui.font }
        : { position: "relative", maxWidth: 960, margin: "0 auto", borderRadius: 12, overflow: "hidden", background: "#1b1726", ...ui.font }}
    >
      <canvas
        ref={cv}
        width={size[0]}
        height={size[1]}
        tabIndex={0}
        aria-label="Game area"
        onPointerDown={pDown}
        onPointerMove={pMove}
        onPointerUp={pUp}
        onPointerCancel={pUp}
        style={{
          display: "block", width: "100%", aspectRatio: `${size[0]}/${size[1]}`, imageRendering: "pixelated",
          touchAction: state === "play" && !gb ? "none" : "auto", outline: "none",
        }}
      />

      {/* level-up / stage-clear upgrade pick */}
      {state === "play" && choice && (
        <div
          style={{
            ...ui.overlay, gap: gb ? 5 : 9, background: "rgba(18,14,26,.86)",
            justifyContent: gb ? "flex-start" : "center", paddingTop: gb ? 10 : 12,
          }}
        >
          <div style={{ fontSize: gb ? 9 : 12, color: choice.type === "stage" ? "#5ef2ff" : "#ffd166" }}>
            {choice.type === "stage" ? `STAGE ${choice.stage} CLEAR` : `LEVEL UP!  LV ${choice.lv}`}
          </div>
          {!gb && (
            <div style={{ fontSize: 7, opacity: .7 }}>
              {choice.type === "stage" ? "Pick a reward (Rare+)" : "Choose one · 1 2 3 or arrows + Enter"}
            </div>
          )}
          <div style={gb ? { display: "flex", flexDirection: "column", gap: 4, width: "94%" } : { display: "flex", gap: 10 }}>
            {choice.choices.map(upgradeCard)}
          </div>
          <div style={{ fontSize: 6, opacity: .6 }}>
            {gb ? `D-pad ↑↓ · ✕ choose · □ reroll (${choice.rerolls})` : `R: Reroll (${choice.rerolls} left)`}
          </div>
          {!gb && (
            <>
              <div style={{ fontSize: 6, opacity: .5, marginTop: 4 }}>YOUR BUILD</div>
              <BuildStrip owned={choice.owned} />
            </>
          )}
        </div>
      )}

      {/* pause menu */}
      {state === "play" && isPaused && !choice && (
        <div style={{ ...ui.overlay, background: "rgba(18,14,26,.9)", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, fontSize: 7 }}>
            {["resume", "build", "settings"].map(t => (
              <button
                key={t}
                onClick={() => { sfx("click"); setTab(t); }}
                style={{
                  ...ui.btn, fontSize: 7, padding: "4px 8px",
                  background: tab === t ? "#5b3f8c" : "transparent", border: "1px solid #4a4458",
                }}
              >
                {t[0].toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {tab === "resume" && (
            <>
              <div style={{ fontSize: 13 }}>Paused</div>
              <div style={{ fontSize: 7, opacity: .7 }}>
                Stage {g.current.stage}: {stageOf(g.current).name} · Lv {g.current.lv}
              </div>
              <button style={ui.btn} onClick={() => togglePause()}>Resume</button>
            </>
          )}

          {tab === "build" && (
            <>
              <div style={{ fontSize: 10 }}>{CLASSES[g.current.cls].name} · Lv {g.current.lv}</div>
              <div style={{ display: "flex", gap: 10, fontSize: 6, opacity: .85, flexWrap: "wrap", justifyContent: "center" }}>
                <span>DMG +{Math.round((g.current.mods.dmg - 1) * 100)}%</span>
                <span>ATK SPD +{Math.round((g.current.mods.atk - 1) * 100)}%</span>
                <span>MOVE +{Math.round((g.current.mods.move - 1) * 100)}%</span>
                <span>CD -{Math.round((1 - g.current.mods.cd) * 100)}%</span>
                <span>HEARTS {g.current.maxHp}</span>
              </div>
              <BuildList owned={g.current.owned} cls={g.current.cls} compact={gb} />
            </>
          )}

          {tab === "settings" && (
            <>
              <div style={{ fontSize: 10 }}>Settings</div>
              {soundBtn({ background: "#2a2338", color: "#e8e4f5", fontSize: 8, padding: "6px 10px" })}
            </>
          )}
        </div>
      )}

      {/* title screen */}
      {state === "idle" && (
        <div style={{ ...ui.overlay, background: "rgba(18,14,26,.88)" }}>
          <div style={{ fontSize: 14 }}>Dungeon Survival</div>
          <div>Pick a class. Beat 4 minibosses and the Hollow Lord to earn its trophy.</div>
          {trophyRow}
          {allTrophies && <div style={{ color: "#f5c542" }}>Master of Souls</div>}
          <button style={ui.btn} onClick={openSelect}>{gb ? "Press Start" : "Play"}</button>
        </div>
      )}

      {/* class select */}
      {state === "select" && (
        <div style={{ ...ui.overlay, gap: gb ? 6 : 8, lineHeight: 1.6, background: "rgba(18,14,26,.9)" }}>
          <div style={{ fontSize: 8, opacity: .7 }}>Choose your class</div>
          <div style={{ display: "flex", alignItems: "center", gap: gb ? 8 : 14 }}>
            <button aria-label="Previous class" style={{ ...ui.btn, padding: "6px 9px" }} onClick={() => cycle(-1)}>◀</button>
            <div style={{ display: "flex", alignItems: "center", gap: gb ? 8 : 12 }}>
              <HeroPreview cls={cls} scale={gb ? 3 : 4} locked={isLocked(cls)} />
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                <div style={{ fontSize: 12, color: isLocked(cls) ? "#6b6480" : C.color, textAlign: "left" }}>
                  {C.name}{trophies[cls] ? " ★" : ""}{isLocked(cls) ? " 🔒" : ""}
                </div>
                <div style={{ fontSize: 7, opacity: .75, textAlign: "left" }}>
                  {C.role} · {C.abilityName} · {C.companionName}
                </div>
                {Object.entries(C.stats).map(([label, v]) => (
                  <StatBar key={label} label={label} v={v} c={C.color} />
                ))}
              </div>
            </div>
            <button aria-label="Next class" style={{ ...ui.btn, padding: "6px 9px" }} onClick={() => cycle(1)}>▶</button>
          </div>
          <div style={{ fontSize: 8, maxWidth: 300, opacity: .9, color: isLocked(cls) ? "#ffd166" : undefined }}>
            {isLocked(cls)
              ? `Locked. Win a run with the ${CLASSES[UNLOCK[cls]].name} to unlock the ${C.name}.`
              : C.desc}
          </div>
          {!gb && <div style={{ fontSize: 7, opacity: .6 }}>{ctrl}</div>}
          <button
            disabled={isLocked(cls)}
            style={{ ...ui.btn, ...(isLocked(cls) ? { background: "#2a2338", color: "#6b6480", cursor: "not-allowed" } : {}) }}
            onClick={() => start()}
          >
            {isLocked(cls) ? "Locked" : gb ? "A: Choose" : "Choose " + C.name}
          </button>
        </div>
      )}

      {/* campaign won */}
      {state === "win" && result && (
        <div style={ui.overlay}>
          <PixelArt rows={TROPHY} pal={PAL} scale={gb ? 3 : 4} />
          <div style={{ fontSize: 11, color: "#f5c542" }}>{CLASSES[result.cls].name} trophy earned</div>
          {newMaster && <div style={{ color: "#f5c542" }}>All {CLASS_KEYS.length} trophies: Master of Souls!</div>}
          <div style={{ fontSize: 7 }}>
            Hollow Lord defeated · {result.score} pts · {timeLabel(result.time)} · Lv {result.lv}
          </div>
          <BuildStrip owned={result.owned} scale={gb ? 1.5 : 2} />
          <button
            style={{ ...ui.btn, background: "#5b3f8c" }}
            onClick={() => {
              audio.init();
              sfx("click");
              continueEndless(g.current);
              setResult(null);
              setState("play");
              cv.current?.focus();
            }}
          >
            Continue into Endless{endBests[result.cls] ? ` (best ${endBests[result.cls]})` : ""}
          </button>
          {btnRow}
        </div>
      )}

      {/* run over */}
      {state === "over" && result && (
        <div style={ui.overlay}>
          <div style={{ fontSize: 12, color: "#ffd166" }}>RUN OVER</div>
          <div style={{ fontSize: 7 }}>
            {result.endless ? `Loop ${result.loop + 1} · ` : ""}Stage {result.stage}-{result.phase + 1} {result.stageName} ·
            {result.score} pts · {timeLabel(result.time)} · Lv {result.lv}
          </div>
          <div style={{ fontSize: 7, opacity: .7 }}>
            {CLASSES[result.cls].name} best: {bests[result.cls] || 0}
            {result.endless ? ` · endless depth ${result.depth} (best ${endBests[result.cls] || 0})` : ""}
          </div>
          <BuildStrip owned={result.owned} scale={gb ? 1.5 : 2} />
          {btnRow}
        </div>
      )}

      {/* big ability button for touch devices that aren't using the mobile shell */}
      {state === "play" && !gb && coarse && (
        <button
          style={{
            position: "absolute", right: 14, bottom: 14, width: 64, height: 64, borderRadius: "50%",
            font: "inherit", fontSize: 8, background: C.color, color: "#120e1a", border: "2px solid #120e1a",
            opacity: .85, touchAction: "none",
          }}
          aria-label={C.abilityName}
          onPointerDown={() => triggerAbility(g.current)}
        >
          {C.abilityName}
        </button>
      )}
    </div>
  );

  // desktop: just the screen plus a small sound bar underneath
  if (!gb) {
    return (
      <section aria-label="Mini game: Dungeon Survival">
        {screen}
        <div
          style={{
            ...ui.font, maxWidth: 960, margin: "8px auto 0", display: "flex", justifyContent: "space-between",
            alignItems: "center", gap: 8, flexWrap: "wrap",
          }}
        >
          <span style={{ fontSize: 7, color: "#8a83a0" }}>{state === "play" ? ctrl : "M sound · N music"}</span>
          {soundBtn({ background: "#2a2338", color: "#e8e4f5" })}
        </div>
      </section>
    );
  }

  // ---- mobile shell: D-pad on the left, face buttons on the right ----
  const arm = (k, st) => (
    <div style={{ position: "absolute", ...st, background: dir.includes(k) ? "#4a4a5c" : "transparent", borderRadius: 5 }} />
  );
  const crossBar = {
    position: "absolute", background: "#1c1c24", borderRadius: 6,
    boxShadow: "inset 0 1px 1px rgba(255,255,255,.18)",
  };
  const dpad = (
    <div
      style={psp.dpad}
      role="group"
      aria-label="Direction pad"
      onPointerDown={padDown}
      onPointerMove={padMove}
      onPointerUp={padUp}
      onPointerCancel={padUp}
    >
      <div style={{ ...crossBar, left: 0, top: "33.3%", width: "100%", height: "33.4%" }} />
      <div style={{ ...crossBar, left: "33.3%", top: 0, width: "33.4%", height: "100%" }} />
      {arm("u", { left: "33.3%", top: 0, width: "33.4%", height: "33.3%" })}
      {arm("d", { left: "33.3%", top: "66.7%", width: "33.4%", height: "33.3%" })}
      {arm("l", { left: 0, top: "33.3%", width: "33.3%", height: "33.4%" })}
      {arm("r", { left: "66.7%", top: "33.3%", width: "33.3%", height: "33.4%" })}
      <div style={{ position: "absolute", left: "41%", top: "41%", width: "18%", height: "18%", borderRadius: "50%", background: "#0e0e14" }} />
    </div>
  );

  const faceButton = (label, glyph, color, pos, onDown, big) => (
    <button
      className="ww-btn"
      aria-label={label}
      style={{ ...psp.face, ...pos, color }}
      onPointerDown={e => {
        e.preventDefault();
        buzz(big ? 12 : 8);
        audio.init();
        onDown();
      }}
    >
      {glyph}
    </button>
  );

  // ✕ ability / confirm · ○ pause / back · □ reroll (level-up) · △ build tab
  const faces = (
    <div style={psp.cluster}>
      {faceButton("Triangle, build and pause menu", "△", "#4ade80", { left: "29.5%", top: 0 }, () => {
        if (state === "play" && !choice) togglePause("build");
      })}
      {faceButton("Square, reroll", "□", "#f472b6", { left: 0, top: "29.5%" }, () => {
        if (state === "play" && choice) reroll();
      })}
      {faceButton("Circle, pause or back", "○", "#f87171", { left: "59%", top: "29.5%" }, () => {
        if (state === "select") {
          sfx("click");
          setState("idle");
        } else {
          togglePause();
        }
      })}
      {faceButton("Cross, " + C.abilityName, "✕", "#60a5fa", { left: "29.5%", top: "59%" }, () => {
        if (state === "play") {
          if (choice) pick(sel);
          else if (!paused.current) triggerAbility(g.current);
        } else {
          primary();
        }
      }, true)}
    </div>
  );

  const pills = (
    <div style={psp.pills}>
      <div>
        <button
          className="ww-btn"
          aria-label="Select, go to projects"
          style={psp.pill}
          onClick={() => {
            buzz();
            window.location.href = projectsHref;
          }}
        />
        <div style={psp.pillLbl}>Projects</div>
      </div>
      <div>
        <button
          className="ww-btn"
          aria-label="Start, pause"
          style={psp.pill}
          onClick={() => (state === "play" ? (buzz(), togglePause("resume")) : primary())}
        />
        <div style={psp.pillLbl}>Start</div>
      </div>
    </div>
  );

  return (
    <section aria-label="Mini game: Dungeon Survival" style={{ ...psp.body, ...ui.font, ...(contained && !land ? { minHeight: 300 } : {}) }}>
      <style>{`.ww-btn{cursor:pointer}.ww-btn:active{filter:brightness(.75);transform:translateY(1px)}`}</style>
      <span style={{ ...psp.shoulder, left: "7%" }} />
      <span style={{ ...psp.shoulder, right: "7%" }} />
      {!land && (
        <div style={contained ? { ...psp.rotate, position: "absolute", zIndex: 5, borderRadius: 28 } : psp.rotate} role="alert">
          <div style={{ fontSize: 30 }}>⟳</div>
          <div>Rotate your phone</div>
          <div style={{ fontSize: 8, opacity: .7 }}>Dungeon Survival plays in landscape</div>
        </div>
      )}
      <div style={psp.side}>
        {dpad}
        {soundBtn({ background: "#2a2a33", color: "#c9c3dc", padding: "3px 7px", fontSize: 7 })}
      </div>
      <div style={psp.screenWrap}>
        <div style={psp.bezel}>{screen}</div>
        <div style={psp.title}>Dungeon Survival</div>
      </div>
      <div style={psp.side}>
        {faces}
        {pills}
      </div>
    </section>
  );
}
