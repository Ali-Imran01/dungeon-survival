import { useEffect, useRef, useState } from "react";
import { audio, sfx, music } from "./audio.js";
import { PAL, DIM, TROPHY, spr, drawHero } from "./sprites.js";
import { UPGRADES, UP_ICONS, RARITY, describe } from "./upgrades.js";
import { CLASSES, CLASS_KEYS } from "./classes.js";
import { W, H, fitSize, newGame, step, draw, orbit, triggerAbility, chooseUpgrade, rerollChoices, musicTrack, stageOf } from "./engine.js";

const ui = {
  bar: { position:"absolute", bottom:10, left:10, right:10, fontSize:9, pointerEvents:"none" },
  barBox: { height:7, marginTop:3, background:"#120e1a", border:"2px solid #120e1a", borderRadius:2 },
  fx: { position:"absolute", top:26, left:0, right:0, textAlign:"center", fontSize:9, color:"#5ef2ff", pointerEvents:"none" },
  hud: { position:"absolute", top:8, left:10, right:10, display:"flex", justifyContent:"space-between", gap:6, fontSize:10, pointerEvents:"none" },
  overlay: { position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", gap:10, background:"rgba(18,14,26,.75)", textAlign:"center", padding:12, fontSize:10, lineHeight:1.8 },
  btn: { font:"inherit", fontSize:10, padding:"9px 14px", background:"#5b3f8c", color:"#fff", border:"2px solid #120e1a", borderRadius:4, cursor:"pointer", textDecoration:"none", touchAction:"manipulation" },
  font: { fontFamily:"'Press Start 2P', ui-monospace, monospace", color:"#e8e4f5", userSelect:"none", WebkitUserSelect:"none", WebkitTouchCallout:"none", WebkitTapHighlightColor:"transparent" },
};
const gbs = {
  shell: { maxWidth:400, margin:"0 auto", padding:"18px 18px 26px", background:"#d9d4ce", borderRadius:"14px 14px 56px 14px", color:"#3b2a5c", touchAction:"manipulation" },
  land: { maxWidth:860, display:"flex", alignItems:"center", justifyContent:"space-between", gap:14, padding:"12px 18px", borderRadius:"14px 14px 40px 14px" },
  bezel: { background:"#4a4658", padding:"8px 12px 12px", borderRadius:"8px 8px 26px 8px" },
  bezelTop: { display:"flex", alignItems:"center", gap:6, fontSize:7, color:"#a9a3bd", marginBottom:6 },
  brand: { margin:"10px 4px 12px", fontSize:11, color:"#3b2a5c", fontStyle:"italic" },
  controls: { display:"flex", justifyContent:"space-between", alignItems:"center", padding:"4px 4px 0" },
  dpad: { position:"relative", width:120, height:120, touchAction:"none", flex:"none" },
  armH: { position:"absolute", left:0, top:40, width:120, height:40, background:"#23202b", borderRadius:5 },
  armV: { position:"absolute", left:40, top:0, width:40, height:120, background:"#23202b", borderRadius:5 },
  ab: { position:"relative", width:128, height:100, transform:"rotate(-25deg)", flex:"none" },
  round: { position:"absolute", width:52, height:52, borderRadius:"50%", background:"#a3285c", color:"#fff", border:"none", font:"inherit", fontSize:13, touchAction:"none" },
  sel: { display:"flex", justifyContent:"center", gap:20, marginTop:18 },
  pill: { width:54, height:14, borderRadius:8, background:"#8c8699", border:"none", transform:"rotate(-25deg)", touchAction:"manipulation" },
  pillLbl: { fontSize:7, color:"#5a5470", marginTop:6, textAlign:"center" },
};
const buzz = (n = 8) => navigator.vibrate?.(n);

const load = (k, d) => { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

function PixelArt({ rows, pal, scale = 4 }) {
  const ref = useRef(null);
  useEffect(() => { const c = ref.current.getContext("2d"); c.clearRect(0, 0, rows[0].length, rows.length); spr(c, rows, 0, 0, false, pal); }, [rows, pal]);
  return <canvas ref={ref} width={rows[0].length} height={rows.length} style={{ width: rows[0].length * scale, height: rows.length * scale, imageRendering: "pixelated" }} />;
}
function HeroPreview({ cls, scale = 4 }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current.getContext("2d"); let raf, t0 = performance.now();
    const loop = now => { const k = (now - t0) % 2400; c.clearRect(0, 0, 22, 20); drawHero(c, cls, { x: 3, y: 2, face: 1, moving: k > 1600, atk: k > 1100 && k < 1400 ? 0.24 - (k - 1100) / 1250 : 0 }, now); raf = requestAnimationFrame(loop); };
    raf = requestAnimationFrame(loop); return () => cancelAnimationFrame(raf);
  }, [cls]);
  return <canvas ref={ref} width={22} height={20} style={{ width: 22 * scale, height: 20 * scale, imageRendering: "pixelated" }} />;
}
function StatBar({ label, v, c }) {
  return <div style={{ display:"flex", alignItems:"center", gap:6, fontSize:7 }}><span style={{ width:40, textAlign:"left", opacity:.8 }}>{label}</span>
    {[1,2,3,4,5].map(i => <span key={i} style={{ width:8, height:6, background: i <= v ? c : "#2a2338" }} />)}</div>;
}

const UPAL = { ...PAL, P: "#8a6fd1", p: "#5b3f8c" };
const upg = id => UPGRADES.find(u => u.id === id);
const byRarity = owned => Object.keys(owned).map(upg).sort((a, b) => ["epic", "rare", "common"].indexOf(a.rarity) - ["epic", "rare", "common"].indexOf(b.rarity));
const pips = (u, have) => "●".repeat(have) + "○".repeat(Math.max(0, u.max - have));
function UpIcon({ id, scale = 3 }) { return <PixelArt rows={UP_ICONS[id]} pal={UPAL} scale={scale} />; }
function BuildStrip({ owned, scale = 2 }) {
  const list = byRarity(owned); if (!list.length) return <div style={{ fontSize: 7, opacity: .6 }}>No upgrades yet</div>;
  return <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "center", maxWidth: 560 }}>
    {list.map(u => <div key={u.id} title={u.name} style={{ position: "relative", border: `2px solid ${RARITY[u.rarity].color}`, borderRadius: 3, padding: 2, background: "#221c30" }}><UpIcon id={u.id} scale={scale} />{owned[u.id] > 1 && <b style={{ position: "absolute", right: -3, bottom: -5, fontSize: 6, color: "#ffd166" }}>x{owned[u.id]}</b>}</div>)}
  </div>;
}
function BuildList({ owned, cls, compact }) {
  const list = byRarity(owned); if (!list.length) return <div style={{ fontSize: 7, opacity: .6 }}>No upgrades yet — level up by collecting soul shards</div>;
  return <div style={{ display: "grid", gridTemplateColumns: compact ? "1fr" : "1fr 1fr", gap: compact ? 3 : "5px 12px", width: compact ? "94%" : "min(560px, 92%)", maxHeight: compact ? 150 : 200, overflowY: "auto" }}>
    {list.map(u => <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "3px 5px", borderLeft: `3px solid ${RARITY[u.rarity].color}`, background: "#221c30", textAlign: "left" }}>
      <UpIcon id={u.id} scale={compact ? 2 : 3} /><div style={{ flex: 1 }}><div style={{ fontSize: compact ? 7 : 8 }}>{u.name}</div>{!compact && <div style={{ fontSize: 6, opacity: .75, marginTop: 3 }}>{describe(u, cls)}</div>}</div>
      <span style={{ fontSize: 7, color: RARITY[u.rarity].color }}>{pips(u, owned[u.id])}</span></div>)}
  </div>;
}

export default function DungeonSurvival({ projectsHref = "#projects", gameboy = undefined }) {
  const coarse = typeof window !== "undefined" && window.matchMedia("(pointer: coarse)").matches;
  const gb = gameboy ?? coarse;
  const [size, setSize] = useState(() => fitSize(gb));
  const [cls, setCls] = useState(() => { const c = load("wisp-class", "warden"); return CLASSES[c] ? c : "warden"; });
  const cv = useRef(null), g = useRef(null), keys = useRef(new Set()), touch = useRef(null), pad = useRef(null), dirRef = useRef(""), paused = useRef(false), onScreen = useRef(true);
  if (!g.current) g.current = newGame(cls);
  const [state, setState] = useState("idle");       // idle | select | play | over | win
  const [isPaused, setPaused] = useState(false);
  const [dir, setDir] = useState("");
  const [land, setLand] = useState(() => typeof window !== "undefined" && window.innerWidth > window.innerHeight);
  const [hud, setHud] = useState({ time: 0 });
  const [choice, setChoice] = useState(null), [sel, setSel] = useState(0), [tab, setTab] = useState("resume"), [result, setResult] = useState(null);
  const [bests, setBests] = useState(() => load("wisp-bests", {}));
  const [trophies, setTrophies] = useState(() => { const t = load("wisp-trophies", {}); if (load("wisp-trophy", 0) === 1) t.warden = true; return t; });
  const [newMaster, setNewMaster] = useState(false);
  const [sound, setSound] = useState(() => { const m = load("wisp-muted", 0) === 1; audio.setMuted(m); return !m; });
  const toggleSound = () => { const on = !sound; audio.init(); audio.setMuted(!on); setSound(on); if (on) sfx("click"); save("wisp-muted", on ? 0 : 1); };
  const [musicSt, setMusicSt] = useState(() => { const on = load("wisp-music", 1) !== 0; music.enable(on); return on; });
  const toggleMusic = () => { const on = !musicSt; audio.init(); music.enable(on); setMusicSt(on); sfx("click"); save("wisp-music", on ? 1 : 0); };
  const allTrophies = CLASS_KEYS.every(k => trophies[k]);

  const preview = k => { g.current = newGame(k); };
  const openSelect = () => { audio.init(); sfx("click"); preview(cls); setState("select"); };
  const cycle = d => { const i = (CLASS_KEYS.indexOf(cls) + d + CLASS_KEYS.length) % CLASS_KEYS.length, k = CLASS_KEYS[i]; sfx("click"); setCls(k); preview(k); };
  const start = (k = cls) => {
    audio.init(); sfx("click"); setCls(k); save("wisp-class", k);
    const devStage = Math.min(5, Math.max(1, +new URLSearchParams(window.location.search).get("stage") || 1));   // ?stage=N for testing
    g.current = newGame(k, devStage); touch.current = null; pad.current = null; paused.current = false; setPaused(false); setNewMaster(false);
    setHud({ time: 0 }); setChoice(null); setResult(null); setState("play"); cv.current?.focus();
  };
  const togglePause = (t = "resume") => { if (state !== "play" || choice) return; audio.init(); sfx("click"); paused.current = !paused.current; setPaused(paused.current); setTab(t); };
  const pick = i => { const c = choice?.choices[i]; if (!c) return; buzz(12); chooseUpgrade(g.current, c.id); };
  const reroll = () => { if (!choice || choice.rerolls <= 0) return; buzz(); sfx("click"); rerollChoices(g.current); };
  const primary = () => { // A / Start / Enter
    buzz();
    if (state === "idle" || state === "over" || state === "win") openSelect();
    else if (state === "select") start();
  };

  useEffect(() => {
    const vis = () => { if (document.hidden) music.set(null); };
    document.addEventListener("visibilitychange", vis);
    return () => { document.removeEventListener("visibilitychange", vis); music.set(null); };
  }, []);

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { onScreen.current = e.isIntersecting; });
    io.observe(cv.current);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    const on = () => { setLand(window.innerWidth > window.innerHeight); if (state !== "play") { setSize(fitSize(gb)); g.current = newGame(cls); } };
    window.addEventListener("resize", on);
    return () => window.removeEventListener("resize", on);
  }, [state, gb, cls]);

  useEffect(() => {
    const ctx = cv.current.getContext("2d");
    let raf, last = performance.now(), lastHud = "", lastChoice = "";
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const G = g.current;
      if (onScreen.current && !document.hidden) {
        if (state === "play") { if (!paused.current) step(G, dt, keys.current, touch.current || pad.current); } else orbit(G, now / 1000);
        draw(ctx, G, now, state === "play" ? touch.current : null, gb ? "A" : "SPC");
      }
      const live = state === "play" && !paused.current && !G.over && onScreen.current && !document.hidden;
      music.set(live && !G.pending ? musicTrack(G) : null);
      if (state === "play") {
        const pd = G.pending, ck = pd ? pd.type + pd.choices.map(c => c.id).join() + G.rerolls : "";
        if (ck !== lastChoice) { lastChoice = ck; setChoice(pd ? { type: pd.type, choices: pd.choices, rerolls: G.rerolls, stage: G.stage, lv: G.lv, owned: { ...G.owned } } : null); setSel(0); }
        const h = `${Math.floor(G.t)}`; if (h !== lastHud) { lastHud = h; setHud({ time: Math.floor(G.t) }); }
        if (G.over) {
          setResult({ cls: G.cls, stage: G.stage, phase: G.phase, score: G.score, time: Math.floor(G.t), lv: G.lv, owned: { ...G.owned }, stageName: stageOf(G).name });
          setState(G.won ? "win" : "over");
          if (G.won) setTrophies(t => { const n = { ...t, [G.cls]: true }; save("wisp-trophies", n); if (CLASS_KEYS.every(k => n[k]) && !CLASS_KEYS.every(k => t[k])) setNewMaster(true); return n; });
          setBests(b => { const n = { ...b, [G.cls]: Math.max(b[G.cls] || 0, G.score) }; save("wisp-bests", n); return n; });
        }
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [state, size]);

  useEffect(() => {
    if (state === "play") {
      const block = new Set(["arrowup","arrowdown","arrowleft","arrowright"," "]);
      const dn = e => {
        const k = e.key.toLowerCase(); if (block.has(k) || k === "tab") e.preventDefault();
        if (choice) {
          const n = choice.choices.length;
          if (k >= "1" && k <= "3") pick(+k - 1); else if (k === "arrowleft" || k === "a" || k === "arrowup" || k === "w") setSel(i => (i + n - 1) % n);
          else if (k === "arrowright" || k === "d" || k === "arrowdown" || k === "s") setSel(i => (i + 1) % n); else if (k === "enter" || k === " ") pick(sel); else if (k === "r") reroll();
          return;
        }
        if (k === "tab") { togglePause("build"); return; }
        if (k === "escape" || k === "p") { togglePause(); return; } if (k === "m") { toggleSound(); return; } if (k === "n") { toggleMusic(); return; } if (k === " " && !paused.current) triggerAbility(g.current); keys.current.add(k); };
      const up = e => keys.current.delete(e.key.toLowerCase());
      window.addEventListener("keydown", dn); window.addEventListener("keyup", up);
      return () => { window.removeEventListener("keydown", dn); window.removeEventListener("keyup", up); keys.current.clear(); };
    }
    if (state === "select") {
      const dn = e => {
        const k = e.key.toLowerCase();
        if (k === "arrowleft" || k === "a") { e.preventDefault(); cycle(-1); }
        else if (k === "arrowright" || k === "d") { e.preventDefault(); cycle(1); }
        else if (k === "enter" || k === " ") { e.preventDefault(); start(); }
        else if (k === "escape") setState("idle");
      };
      window.addEventListener("keydown", dn); return () => window.removeEventListener("keydown", dn);
    }
  }, [state, cls, sound, musicSt, choice, sel]);

  const pDown = e => {
    if (state !== "play" || gb) return;
    if (touch.current) { triggerAbility(g.current); return; }
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.setPointerCapture(e.pointerId);
    touch.current = { id: e.pointerId, ox: e.clientX, oy: e.clientY, jx: (e.clientX - r.left) * W / r.width, jy: (e.clientY - r.top) * H / r.height, dx: 0, dy: 0 };
  };
  const pMove = e => { const t = touch.current; if (!t || t.id !== e.pointerId) return; t.dx = Math.max(-1, Math.min(1, (e.clientX - t.ox) / 28)); t.dy = Math.max(-1, Math.min(1, (e.clientY - t.oy) / 28)); };
  const pUp = e => { if (touch.current?.id === e.pointerId) touch.current = null; };

  const padSet = e => {
    const r = e.currentTarget.getBoundingClientRect(), x = e.clientX - r.left - r.width / 2, y = e.clientY - r.top - r.height / 2;
    let d = "";
    if (Math.hypot(x, y) < 10) pad.current = null;
    else {
      const a = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * Math.PI / 4, dx = Math.cos(a), dy = Math.sin(a);
      pad.current = { dx, dy };
      d = (dy < -0.3 ? "u" : dy > 0.3 ? "d" : "") + (dx < -0.3 ? "l" : dx > 0.3 ? "r" : "");
    }
    if (d !== dirRef.current) {
      if (state === "select" && (d === "l" || d === "r")) cycle(d === "l" ? -1 : 1);
      if (choice && (d === "u" || d === "d")) { const n = choice.choices.length; setSel(i => (i + (d === "u" ? n - 1 : 1)) % n); pad.current = null; }
      dirRef.current = d; setDir(d); if (d) buzz(5);
    }
  };
  const padDown = e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); e.currentTarget.dataset.on = "1"; padSet(e); };
  const padMove = e => { if (e.currentTarget.dataset.on === "1") padSet(e); };
  const padUp = e => { e.currentTarget.dataset.on = ""; pad.current = null; dirRef.current = ""; setDir(""); };

  const C = CLASSES[cls];
  const btnRow = (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
      <button style={ui.btn} onClick={() => start()}>Play again</button>
      <button style={{ ...ui.btn, background:"#2a2338" }} onClick={openSelect}>Change class</button>
      <a style={{ ...ui.btn, background:"transparent", border:"2px solid #5b3f8c" }} href={projectsHref}>See my projects</a>
    </div>
  );
  const ctrl = gb ? `D-pad move, A ${C.abilityName.toLowerCase()}, B pause` : coarse ? "Drag to move, second finger to use ability" : `WASD/arrows move, Space ${C.abilityName.toLowerCase()}, Esc pause`;
  const trophyRow = (
    <div style={{ display:"flex", gap:12, alignItems:"flex-end", justifyContent:"center" }}>
      {CLASS_KEYS.map(k => <div key={k} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3, fontSize:6, color: trophies[k] ? "#f5c542" : "#6b6480" }}><PixelArt rows={TROPHY} pal={trophies[k] ? PAL : DIM} scale={gb ? 1.5 : 2} />{CLASSES[k].name}</div>)}
    </div>
  );

  const soundBtn = st => (
    <span style={{ display:"inline-flex", gap:6 }}>
      <button onClick={toggleMusic} aria-pressed={musicSt} style={{ font:"inherit", fontSize:8, padding:"4px 8px", borderRadius:4, cursor:"pointer", border:"none", opacity: musicSt ? 1 : 0.55, ...st }}>Music {musicSt ? "on" : "off"}</button>
      <button onClick={toggleSound} aria-pressed={sound} style={{ font:"inherit", fontSize:8, padding:"4px 8px", borderRadius:4, cursor:"pointer", border:"none", opacity: sound ? 1 : 0.55, ...st }}>Sound {sound ? "on" : "off"}</button>
    </span>
  );
  const screen = (
    <div style={gb ? { position:"relative", overflow:"hidden", background:"#1b1726", borderRadius:3, ...ui.font } : { position:"relative", maxWidth:960, margin:"0 auto", borderRadius:12, overflow:"hidden", background:"#1b1726", ...ui.font }}>
      <canvas ref={cv} width={size[0]} height={size[1]} tabIndex={0} aria-label="Game area"
        onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp}
        style={{ display:"block", width:"100%", aspectRatio:`${size[0]}/${size[1]}`, imageRendering:"pixelated", touchAction: state === "play" && !gb ? "none" : "auto", outline:"none" }} />
      {state === "play" && choice && (
        <div style={{ ...ui.overlay, gap: gb ? 5 : 9, background: "rgba(18,14,26,.86)", justifyContent: gb ? "flex-start" : "center", paddingTop: gb ? 10 : 12 }}>
          <div style={{ fontSize: gb ? 9 : 12, color: choice.type === "stage" ? "#5ef2ff" : "#ffd166" }}>{choice.type === "stage" ? `STAGE ${choice.stage} CLEAR` : `LEVEL UP!  LV ${choice.lv}`}</div>
          {!gb && <div style={{ fontSize: 7, opacity: .7 }}>{choice.type === "stage" ? "Pick a reward (Rare+)" : "Choose one · 1 2 3 or arrows + Enter"}</div>}
          <div style={gb ? { display: "flex", flexDirection: "column", gap: 4, width: "94%" } : { display: "flex", gap: 10 }}>
            {choice.choices.map((u, i) => { const R = RARITY[u.rarity], have = choice.owned[u.id] || 0, on = i === sel;
              return gb
                ? <div key={u.id} onClick={() => pick(i)} style={{ display: "flex", gap: 6, alignItems: "center", background: "#221c30", border: `2px solid ${R.color}`, borderRadius: 4, padding: "4px 5px", boxShadow: on ? "0 0 0 2px #fff inset" : "none", cursor: "pointer", textAlign: "left" }}>
                    <UpIcon id={u.id} scale={2} /><div style={{ flex: 1 }}><div style={{ fontSize: 7 }}>{u.name} <span style={{ color: R.color, fontSize: 6 }}>{pips(u, have + 1)}</span></div><div style={{ fontSize: 6, opacity: .8, marginTop: 2 }}>{describe(u, choice.cls || cls)}</div></div></div>
                : <div key={u.id} onClick={() => pick(i)} onMouseEnter={() => setSel(i)} style={{ width: 150, background: "#221c30", border: `2px solid ${R.color}`, borderRadius: 6, padding: "10px 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 7, cursor: "pointer", transform: on ? "translateY(-4px)" : "none", boxShadow: on ? "0 0 0 2px #fff inset" : "none" }}>
                    <div style={{ fontSize: 6, color: R.color, letterSpacing: 1 }}>{R.label.toUpperCase()}{u.cls ? " · " + u.cls.toUpperCase() : ""}</div><UpIcon id={u.id} scale={4} />
                    <div style={{ fontSize: 9 }}>{u.name}</div><div style={{ fontSize: 6, lineHeight: 1.7, opacity: .85, minHeight: 30 }}>{describe(u, cls)}</div>
                    <div style={{ fontSize: 8, color: R.color, letterSpacing: 2 }}>{pips(u, have + 1)}</div></div>; })}
          </div>
          <div style={{ fontSize: 6, opacity: .6 }}>{gb ? `D-pad ↑↓ · A choose · B reroll (${choice.rerolls})` : `R: Reroll (${choice.rerolls} left)`}</div>
          {!gb && <><div style={{ fontSize: 6, opacity: .5, marginTop: 4 }}>YOUR BUILD</div><BuildStrip owned={choice.owned} /></>}
        </div>
      )}
      {state === "play" && isPaused && !choice && (
        <div style={{ ...ui.overlay, background: "rgba(18,14,26,.9)", gap: 8 }}>
          <div style={{ display: "flex", gap: 6, fontSize: 7 }}>{["resume", "build", "settings"].map(t => <button key={t} onClick={() => { sfx("click"); setTab(t); }} style={{ ...ui.btn, fontSize: 7, padding: "4px 8px", background: tab === t ? "#5b3f8c" : "transparent", border: "1px solid #4a4458" }}>{t[0].toUpperCase() + t.slice(1)}</button>)}</div>
          {tab === "resume" && <><div style={{ fontSize: 13 }}>Paused</div><div style={{ fontSize: 7, opacity: .7 }}>Stage {g.current.stage}: {stageOf(g.current).name} · Lv {g.current.lv}</div><button style={ui.btn} onClick={() => togglePause()}>Resume</button></>}
          {tab === "build" && <><div style={{ fontSize: 10 }}>{CLASSES[g.current.cls].name} · Lv {g.current.lv}</div>
            <div style={{ display: "flex", gap: 10, fontSize: 6, opacity: .85, flexWrap: "wrap", justifyContent: "center" }}><span>DMG +{Math.round((g.current.mods.dmg - 1) * 100)}%</span><span>ATK SPD +{Math.round((g.current.mods.atk - 1) * 100)}%</span><span>MOVE +{Math.round((g.current.mods.move - 1) * 100)}%</span><span>CD -{Math.round((1 - g.current.mods.cd) * 100)}%</span><span>HEARTS {g.current.maxHp}</span></div>
            <BuildList owned={g.current.owned} cls={g.current.cls} compact={gb} /></>}
          {tab === "settings" && <><div style={{ fontSize: 10 }}>Settings</div>{soundBtn({ background: "#2a2338", color: "#e8e4f5", fontSize: 8, padding: "6px 10px" })}</>}
        </div>
      )}
      {state === "idle" && (
        <div style={{ ...ui.overlay, background:"rgba(18,14,26,.88)" }}>
          <div style={{ fontSize:14 }}>Dungeon Survival</div>
          <div>Pick a class. Beat 4 minibosses and the Hollow Lord to earn its trophy.</div>
          {trophyRow}
          {allTrophies && <div style={{ color:"#f5c542" }}>Master of Souls</div>}
          <button style={ui.btn} onClick={openSelect}>{gb ? "Press Start" : "Play"}</button>
        </div>
      )}
      {state === "select" && (
        <div style={{ ...ui.overlay, gap: gb ? 6 : 8, lineHeight:1.6, background:"rgba(18,14,26,.9)" }}>
          <div style={{ fontSize:8, opacity:.7 }}>Choose your class</div>
          <div style={{ display:"flex", alignItems:"center", gap: gb ? 8 : 14 }}>
            <button aria-label="Previous class" style={{ ...ui.btn, padding:"6px 9px" }} onClick={() => cycle(-1)}>◀</button>
            <div style={{ display:"flex", alignItems:"center", gap: gb ? 8 : 12 }}>
              <HeroPreview cls={cls} scale={gb ? 3 : 4} />
              <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                <div style={{ fontSize:12, color:C.color, textAlign:"left" }}>{C.name}{trophies[cls] ? " ★" : ""}</div>
                <div style={{ fontSize:7, opacity:.75, textAlign:"left" }}>{C.role} · {C.abilityName} · {C.companionName}</div>
                {Object.entries(C.stats).map(([l, v]) => <StatBar key={l} label={l} v={v} c={C.color} />)}
              </div>
            </div>
            <button aria-label="Next class" style={{ ...ui.btn, padding:"6px 9px" }} onClick={() => cycle(1)}>▶</button>
          </div>
          <div style={{ fontSize:8, maxWidth:300, opacity:.9 }}>{C.desc}</div>
          {!gb && <div style={{ fontSize:7, opacity:.6 }}>{ctrl}</div>}
          <button style={ui.btn} onClick={() => start()}>{gb ? "A: Choose" : "Choose " + C.name}</button>
        </div>
      )}
      {state === "win" && result && (
        <div style={ui.overlay}>
          <PixelArt rows={TROPHY} pal={PAL} scale={gb ? 3 : 4} />
          <div style={{ fontSize:11, color:"#f5c542" }}>{CLASSES[result.cls].name} trophy earned</div>
          {newMaster && <div style={{ color:"#f5c542" }}>All 3 trophies: Master of Souls!</div>}
          <div style={{ fontSize: 7 }}>Hollow Lord defeated · {result.score} pts · {Math.floor(result.time / 60)}:{String(result.time % 60).padStart(2, "0")} · Lv {result.lv}</div>
          <BuildStrip owned={result.owned} scale={gb ? 1.5 : 2} />
          {btnRow}
        </div>
      )}
      {state === "over" && result && (
        <div style={ui.overlay}>
          <div style={{ fontSize:12, color: "#ffd166" }}>RUN OVER</div>
          <div style={{ fontSize: 7 }}>Stage {result.stage}-{result.phase + 1} {result.stageName} · {result.score} pts · {Math.floor(result.time / 60)}:{String(result.time % 60).padStart(2, "0")} · Lv {result.lv}</div>
          <div style={{ fontSize: 7, opacity: .7 }}>{CLASSES[result.cls].name} best: {bests[result.cls] || 0}</div>
          <BuildStrip owned={result.owned} scale={gb ? 1.5 : 2} />
          {btnRow}
        </div>
      )}
      {state === "play" && !gb && coarse && (
        <button style={{ position:"absolute", right:14, bottom:14, width:64, height:64, borderRadius:"50%", font:"inherit", fontSize:8, background:C.color, color:"#120e1a", border:"2px solid #120e1a", opacity:.85, touchAction:"none" }} aria-label={C.abilityName} onPointerDown={() => triggerAbility(g.current)}>{C.abilityName}</button>
      )}
    </div>
  );

  if (!gb) return (
    <section aria-label="Mini game: Dungeon Survival">
      {screen}
      <div style={{ ...ui.font, maxWidth:960, margin:"8px auto 0", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
        <span style={{ fontSize:7, color:"#8a83a0" }}>{state === "play" ? ctrl : "M sound · N music"}</span>
        {soundBtn({ background:"#2a2338", color:"#e8e4f5" })}
      </div>
    </section>
  );

  const arm = (k, st) => <div style={{ position:"absolute", ...st, background: dir.includes(k) ? "#4a4458" : "transparent", borderRadius:5 }} />;
  const dpad = (
    <div style={gbs.dpad} role="group" aria-label="Direction pad" onPointerDown={padDown} onPointerMove={padMove} onPointerUp={padUp} onPointerCancel={padUp}>
      <div style={gbs.armH} /><div style={gbs.armV} />
      {arm("u", { left:40, top:0, width:40, height:40 })}{arm("d", { left:40, top:80, width:40, height:40 })}
      {arm("l", { left:0, top:40, width:40, height:40 })}{arm("r", { left:80, top:40, width:40, height:40 })}
      <div style={{ position:"absolute", left:52, top:52, width:16, height:16, borderRadius:"50%", background:"#1a1720" }} />
    </div>
  );
  const ab = (
    <div style={gbs.ab}>
      <button className="ww-btn" aria-label="B, pause or back" style={{ ...gbs.round, left:0, top:38 }} onPointerDown={e => { e.preventDefault(); buzz(); if (state === "select") { sfx("click"); setState("idle"); } else if (choice) reroll(); else togglePause(); }}>B</button>
      <button className="ww-btn" aria-label={"A, " + C.abilityName} style={{ ...gbs.round, left:70, top:8 }} onPointerDown={e => { e.preventDefault(); buzz(12); audio.init(); if (state === "play") { if (choice) pick(sel); else if (!paused.current) triggerAbility(g.current); } else primary(); }}>A</button>
    </div>
  );
  const pills = (
    <div style={gbs.sel}>
      <div><button className="ww-btn" aria-label="Select, go to projects" style={gbs.pill} onClick={() => { buzz(); window.location.href = projectsHref; }} /><div style={gbs.pillLbl}>Projects</div></div>
      <div><button className="ww-btn" aria-label="Start" style={gbs.pill} onClick={() => state === "play" ? (buzz(), togglePause(isPaused ? "resume" : "build")) : primary()} /><div style={gbs.pillLbl}>Start</div></div>
    </div>
  );

  return (
    <section aria-label="Mini game: Dungeon Survival" style={{ ...gbs.shell, ...(land ? gbs.land : {}), ...ui.font, color:"#3b2a5c" }}>
      <style>{`.ww-btn{cursor:pointer}.ww-btn:active{filter:brightness(.8);transform:translateY(1px)}`}</style>
      {land && dpad}
      <div style={land ? { width:"min(56vw, calc((100dvh - 120px) * 1.11))", flex:"none" } : undefined}>
        <div style={gbs.bezel}>
          <div style={gbs.bezelTop}><span style={{ width:6, height:6, borderRadius:"50%", background: state === "play" && !isPaused ? "#ff3355" : "#5a2a34" }} />Soul power<span style={{ flex:1 }} />{soundBtn({ background:"#3a3648", color:"#c9c3dc", padding:"2px 6px", fontSize:7 })}</div>
          {screen}
        </div>
        <div style={gbs.brand}>Dungeon Survival</div>
        {land && pills}
      </div>
      {!land && <div style={gbs.controls}>{dpad}{ab}</div>}
      {!land && pills}
      {land && ab}
    </section>
  );
}