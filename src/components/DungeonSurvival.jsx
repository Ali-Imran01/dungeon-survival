import { useEffect, useRef, useState } from "react";
import { audio, sfx, music } from "./audio.js";
import { PAL, DIM, TROPHY, HERO, spr, drawHero } from "./sprites.js";
import { fxLabel } from "./powerups.js";
import { CLASSES, CLASS_KEYS } from "./classes.js";
import { W, H, fitSize, newGame, step, draw, orbit, useAbility, BOSSES } from "./engine.js";

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
  const [hud, setHud] = useState({ hp: 3, kills: 0, time: 0 });
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
    g.current = newGame(k); touch.current = null; pad.current = null; paused.current = false; setPaused(false); setNewMaster(false);
    setHud({ hp: CLASSES[k].hp, kills: 0, time: 0 }); setState("play"); cv.current?.focus();
  };
  const togglePause = () => { if (state !== "play") return; audio.init(); sfx("click"); paused.current = !paused.current; setPaused(paused.current); };
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
    let raf, last = performance.now(), lastHud = "";
    const frame = now => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const G = g.current;
      if (onScreen.current && !document.hidden) {
        if (state === "play") { if (!paused.current) step(G, dt, keys.current, touch.current || pad.current); } else orbit(G, now / 1000);
        draw(ctx, G, now, state === "play" ? touch.current : null);
      }
      const live = state === "play" && !paused.current && !G.over && onScreen.current && !document.hidden;
      music.set(live ? (G.boss ? (BOSSES[G.boss.i].final ? "final" : "boss") : "normal") : null);
      if (state === "play") {
        const fx = [fxLabel(G), G.p.shield && "Shield"].filter(Boolean).join("  ");
        const msg = G.msgT > 0 ? G.msg : "";
        const B = G.boss, boss = B ? { name: BOSSES[B.i].name, pct: Math.max(0, Math.ceil(B.hp / B.max * 100)), c: BOSSES[B.i].bc } : null;
        const cd = G.p.cd > 0 ? Math.ceil(G.p.cd * 10) : 0;
        const h = `${G.p.hp}|${G.kills}|${Math.floor(G.t)}|${fx}|${msg}|${boss ? boss.pct : "-"}|${G.bossDone}|${cd}`;
        if (h !== lastHud) { lastHud = h; setHud({ hp: Math.max(0, G.p.hp), kills: G.kills, time: Math.floor(G.t), fx, msg, boss, stage: Math.min(5, G.bossDone + 1), cd }); }
        if (G.over) {
          setState(G.won ? "win" : "over");
          if (G.won) setTrophies(t => { const n = { ...t, [G.cls]: true }; save("wisp-trophies", n); if (CLASS_KEYS.every(k => n[k]) && !CLASS_KEYS.every(k => t[k])) setNewMaster(true); return n; });
          setBests(b => { const n = { ...b, [G.cls]: Math.max(b[G.cls] || 0, G.kills) }; save("wisp-bests", n); return n; });
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
      const dn = e => { const k = e.key.toLowerCase(); if (block.has(k)) e.preventDefault(); if (k === "escape" || k === "p") { togglePause(); return; } if (k === "m") { toggleSound(); return; } if (k === "n") { toggleMusic(); return; } if (k === " " && !paused.current) useAbility(g.current); keys.current.add(k); };
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
  }, [state, cls, sound, musicSt]);

  const pDown = e => {
    if (state !== "play" || gb) return;
    if (touch.current) { useAbility(g.current); return; }
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

  const screen = (
    <div style={gb ? { position:"relative", overflow:"hidden", background:"#1b1726", borderRadius:3, ...ui.font } : { position:"relative", maxWidth:720, margin:"0 auto", borderRadius:12, overflow:"hidden", background:"#1b1726", ...ui.font }}>
      <canvas ref={cv} width={size[0]} height={size[1]} tabIndex={0} aria-label="Game area"
        onPointerDown={pDown} onPointerMove={pMove} onPointerUp={pUp} onPointerCancel={pUp}
        style={{ display:"block", width:"100%", aspectRatio:`${size[0]}/${size[1]}`, imageRendering:"pixelated", touchAction: state === "play" && !gb ? "none" : "auto", outline:"none" }} />
      {state === "play" && <div style={ui.hud}><span>{"♥".repeat(hud.hp)}</span><span>{hud.kills} pts</span><span>Boss {hud.stage || 1}/5</span><span>{hud.time}s</span></div>}
      {state === "play" && hud.boss && (
        <div style={ui.bar}>
          <div style={{ color: hud.boss.c }}>{hud.boss.name}</div>
          <div style={ui.barBox}><div style={{ width: hud.boss.pct + "%", height:"100%", background: hud.boss.c, transition:"width .15s" }} /></div>
        </div>
      )}
      {state === "play" && !hud.boss && <div style={{ ...ui.bar, right:"auto", color: hud.cd ? "#6b6480" : C.color }}>{C.abilityName} {hud.cd ? (hud.cd / 10).toFixed(1) + "s" : "ready"}</div>}
      {state === "play" && (hud.msg || hud.fx) && <div style={ui.fx}>{hud.msg || hud.fx}</div>}
      {state === "play" && isPaused && (
        <div style={ui.overlay}><div style={{ fontSize:13 }}>Paused</div><button style={ui.btn} onClick={togglePause}>Resume</button></div>
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
      {state === "win" && (
        <div style={ui.overlay}>
          <PixelArt rows={TROPHY} pal={PAL} scale={gb ? 3 : 4} />
          <div style={{ fontSize:11, color:"#f5c542" }}>{CLASSES[g.current.cls].name} trophy earned</div>
          {newMaster && <div style={{ color:"#f5c542" }}>All 3 trophies: Master of Souls!</div>}
          <div>Hollow Lord defeated in {hud.time}s with {hud.kills} points</div>
          {btnRow}
        </div>
      )}
      {state === "over" && (
        <div style={ui.overlay}>
          <div style={{ fontSize:12 }}>You scored {hud.kills} points in {hud.time}s</div>
          <div>{CLASSES[g.current.cls].name} best: {bests[g.current.cls] || 0}</div>
          {btnRow}
        </div>
      )}
      {state === "play" && !gb && coarse && (
        <button style={{ position:"absolute", right:14, bottom:14, width:64, height:64, borderRadius:"50%", font:"inherit", fontSize:8, background:C.color, color:"#120e1a", border:"2px solid #120e1a", opacity:.85, touchAction:"none" }} aria-label={C.abilityName} onPointerDown={() => useAbility(g.current)}>{C.abilityName}</button>
      )}
    </div>
  );

  const soundBtn = st => (
    <span style={{ display:"inline-flex", gap:6 }}>
      <button onClick={toggleMusic} aria-pressed={musicSt} style={{ font:"inherit", fontSize:8, padding:"4px 8px", borderRadius:4, cursor:"pointer", border:"none", opacity: musicSt ? 1 : 0.55, ...st }}>Music {musicSt ? "on" : "off"}</button>
      <button onClick={toggleSound} aria-pressed={sound} style={{ font:"inherit", fontSize:8, padding:"4px 8px", borderRadius:4, cursor:"pointer", border:"none", opacity: sound ? 1 : 0.55, ...st }}>Sound {sound ? "on" : "off"}</button>
    </span>
  );
  if (!gb) return (
    <section aria-label="Mini game: Dungeon Survival">
      {screen}
      <div style={{ ...ui.font, maxWidth:720, margin:"8px auto 0", display:"flex", justifyContent:"space-between", alignItems:"center", gap:8, flexWrap:"wrap" }}>
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
      <button className="ww-btn" aria-label="B, pause or back" style={{ ...gbs.round, left:0, top:38 }} onPointerDown={e => { e.preventDefault(); buzz(); if (state === "select") { sfx("click"); setState("idle"); } else togglePause(); }}>B</button>
      <button className="ww-btn" aria-label={"A, " + C.abilityName} style={{ ...gbs.round, left:70, top:8 }} onPointerDown={e => { e.preventDefault(); buzz(12); audio.init(); if (state === "play") { if (!paused.current) useAbility(g.current); } else primary(); }}>A</button>
    </div>
  );
  const sel = (
    <div style={gbs.sel}>
      <div><button className="ww-btn" aria-label="Select, go to projects" style={gbs.pill} onClick={() => { buzz(); window.location.href = projectsHref; }} /><div style={gbs.pillLbl}>Projects</div></div>
      <div><button className="ww-btn" aria-label="Start" style={gbs.pill} onClick={() => state === "play" ? (buzz(), togglePause()) : primary()} /><div style={gbs.pillLbl}>Start</div></div>
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
        {land && sel}
      </div>
      {!land && <div style={gbs.controls}>{dpad}{ab}</div>}
      {!land && sel}
      {land && ab}
    </section>
  );
}