// Pixel HUD drawn in the game canvas (crisp at any scale, always above darkness).
import { ICONS, PAL, spr } from "./sprites.js";

// 3x5 pixel font
const G = {
  "0":"###,#.#,#.#,#.#,###","1":".#.,##.,.#.,.#.,###","2":"##.,..#,.#.,#..,###","3":"##.,..#,.#.,..#,##.","4":"#.#,#.#,###,..#,..#",
  "5":"###,#..,##.,..#,##.","6":".##,#..,###,#.#,###","7":"###,..#,.#.,.#.,.#.","8":"###,#.#,###,#.#,###","9":"###,#.#,###,..#,##.",
  A:".#.,#.#,###,#.#,#.#",B:"##.,#.#,##.,#.#,##.",C:".##,#..,#..,#..,.##",D:"##.,#.#,#.#,#.#,##.",E:"###,#..,##.,#..,###",
  F:"###,#..,##.,#..,#..",G:".##,#..,#.#,#.#,.##",H:"#.#,#.#,###,#.#,#.#",I:"###,.#.,.#.,.#.,###",J:"..#,..#,..#,#.#,.#.",
  K:"#.#,#.#,##.,#.#,#.#",L:"#..,#..,#..,#..,###",M:"#.#,###,###,#.#,#.#",N:"##.,#.#,#.#,#.#,#.#",O:".#.,#.#,#.#,#.#,.#.",
  P:"##.,#.#,##.,#..,#..",Q:".#.,#.#,#.#,##.,.##",R:"##.,#.#,##.,#.#,#.#",S:".##,#..,.#.,..#,##.",T:"###,.#.,.#.,.#.,.#.",
  U:"#.#,#.#,#.#,#.#,###",V:"#.#,#.#,#.#,#.#,.#.",W:"#.#,#.#,###,###,#.#",X:"#.#,#.#,.#.,#.#,#.#",Y:"#.#,#.#,.#.,.#.,.#.",
  Z:"###,..#,.#.,#..,###",":":"...,.#.,...,.#.,...","/":"..#,..#,.#.,#..,#..","-":"...,...,###,...,...",".":"...,...,...,...,.#.",
  "!":".#.,.#.,.#.,...,.#.","+":"...,.#.,###,.#.,...","%":"#.#,..#,.#.,#..,#.#","'":".#.,.#.,...,...,...",
};
export const textW = s => s.length * 4 - 1;
export function text(ctx, s, x, y, col = "#e8e4f5", shadow = "#120e1a") {
  s = String(s).toUpperCase(); x = Math.round(x); y = Math.round(y);
  for (const pass of shadow ? [shadow, col] : [col]) {
    const o = pass === col ? 0 : 1; ctx.fillStyle = pass;
    for (let i = 0; i < s.length; i++) { const g = G[s[i]]; if (!g) continue; g.split(",").forEach((row, j) => { for (let k = 0; k < 3; k++) if (row[k] === "#") ctx.fillRect(x + i * 4 + k + o, y + j + o, 1, 1); }); }
  }
}
const bar = (ctx, x, y, w, h, frac, fill, bg = "#120e1a") => { ctx.fillStyle = bg; ctx.fillRect(x - 1, y - 1, w + 2, h + 2); ctx.fillStyle = "#2a2338"; ctx.fillRect(x, y, w, h); ctx.fillStyle = fill; ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h); };
const EMPTY = new Proxy({}, { get: (_, k) => k === "K" ? "#120e1a" : "#3a2433" });
const ABILITY = {
  Dash:  [".........","y...KKKK.",".yyKWWWWK","..yKWWWWK",".yyKWWWWK","y...KKKK.",".........",".........","........."],
  Roll:  ["..KKKK...",".KG..GK..","KG....GK.","KG....KKK","KG.....G.",".KG..GK..","..KKKK...",".........","........."],
  Blink: ["....Y....","....Y....","..Z.Y.Z..","...ZwZ...","YYYwwwYYY","...ZwZ...","..Z.Y.Z..","....Y....","....Y...."],
};
const SKULL = [".KKK.","KwwwK","wKwKw","KwwwK",".KwK."], HORNS = ["w...w","ww.ww",".www.",".wKw.",".www."];
const ROMAN = ["", "", "II", "III"];

// s = { hp, maxHp, shield, lv, xp, xpNeed, stage, stageName, phase(0..2), kills, killsNeed, score, time,
//       ability:{ name, cd, max, key }, fx:[{ k, lv, t, dur }], boss:{ name, hp, max, color, ticks:[.66,.33] } | null,
//       msg, msgT, accent }
export function drawHUD(ctx, s, W, H, now) {
  const small = W < 200, pal = PAL;
  // backing strips so the HUD reads over busy walls / bright floors
  ctx.fillStyle = "rgba(10,8,16,.6)"; ctx.fillRect(0, 0, W, 17); ctx.fillStyle = "rgba(10,8,16,.35)"; ctx.fillRect(0, 17, W, 1);
  ctx.fillStyle = "rgba(10,8,16,.45)"; ctx.fillRect(0, H - 16, small ? 30 : 34, 16); if (s.fx.length) ctx.fillRect(W - 4 - s.fx.length * 11, H - 21, 4 + s.fx.length * 11, 21);
  // top-left: hearts + shield, level + xp
  for (let i = 0; i < s.maxHp; i++) spr(ctx, ICONS.heart.slice(0, 6), 3 + i * 8, 3, false, i < s.hp ? pal : EMPTY);
  if (s.shield) spr(ctx, ICONS.shield.slice(0, 6), 3 + s.maxHp * 8 + 1, 3, false, pal);
  text(ctx, "LV" + s.lv, 3, 11, "#5ef2ff"); bar(ctx, 3 + textW("LV" + s.lv) + 3, 13, small ? 22 : 32, 1, s.xp / s.xpNeed, "#5ef2ff");
  // top-center: stage + soul progress toward next boss
  if (!s.boss) {
    const label = small ? `${s.stage}-${s.phase + 1}` : `${s.stage}-${s.phase + 1} ${s.stageName}`, bw = small ? 36 : 56, bx = Math.round(W / 2 - bw / 2);
    text(ctx, label, W / 2 - textW(label) / 2, 3, "#cfc8e0");
    bar(ctx, bx, 10, bw, 2, s.kills / s.killsNeed, s.accent || "#b06bff");
    for (let k = 0; k < 3; k++) { ctx.fillStyle = "#120e1a"; ctx.fillRect(bx - 13 + k * 4, 9, 4, 4); ctx.fillStyle = k < s.phase ? (s.accent || "#b06bff") : k === s.phase ? "#e8e4f5" : "#3a3448"; ctx.fillRect(bx - 12 + k * 4, 10, 2, 2); }   // phase pips
    spr(ctx, s.phase === 2 ? SKULL : HORNS, bx + bw + 3, 8, false, { K:"#120e1a", w: s.phase === 2 ? "#ff4a6a" : "#ffd166" });
  }
  // top-right: score + time
  const tm = `${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, "0")}`;
  if (!small) text(ctx, String(s.score), W - 3 - textW(String(s.score)), 3, "#ffd166");
  text(ctx, tm, W - 3 - textW(tm), small ? 3 : 10, "#8a83a0");
  // bottom-left: ability with cooldown fill
  const ax = 3, ay = H - 14, ready = s.ability.cd <= 0;
  ctx.fillStyle = "#120e1a"; ctx.fillRect(ax - 1, ay - 1, 13, 13); ctx.fillStyle = ready && Math.floor(now / 400) % 2 ? "#e8e4f5" : "#4a4458"; ctx.fillRect(ax, ay, 11, 11);
  ctx.fillStyle = "#1b1726"; ctx.fillRect(ax + 1, ay + 1, 9, 9); spr(ctx, ABILITY[s.ability.name], ax + 1, ay + 1, false, pal);
  if (!ready) { const f = s.ability.cd / s.ability.max; ctx.fillStyle = "rgba(18,14,26,.75)"; ctx.fillRect(ax + 1, ay + 1, 9, Math.ceil(9 * f)); }
  text(ctx, s.ability.key, ax + 14, ay + 3, "#8a83a0");
  // bottom-right: active power-ups with timer bars
  s.fx.forEach((f, i) => {
    const x = W - 3 - 9 - i * 11, y = H - 13;
    spr(ctx, ICONS[f.k], x + 1, y, false, pal);
    if (f.lv > 1) text(ctx, ROMAN[f.lv], x + 10 - textW(ROMAN[f.lv]), y - 6, "#ffd166");
    bar(ctx, x, y + 9, 9, 1, f.t / f.dur, f.t < 2 && Math.floor(now / 150) % 2 ? "#ff4a6a" : "#e8e4f5");
  });
  // bottom-center: boss bar with phase ticks
  if (s.boss) {
    const b = s.boss, bw = Math.round(W * (small ? 0.5 : 0.42)), bx = Math.round(W / 2 - bw / 2), by = H - 7;
    text(ctx, b.name, W / 2 - textW(b.name) / 2, by - 8, b.color);
    bar(ctx, bx, by, bw, 3, b.hp / b.max, b.color);
    for (const t of b.ticks || []) { ctx.fillStyle = "#120e1a"; ctx.fillRect(bx + Math.round(bw * t), by - 1, 1, 5); }
  }
  // toast
  if (s.msgT > 0) { ctx.globalAlpha = Math.min(1, s.msgT * 2); text(ctx, s.msg, W / 2 - textW(s.msg) / 2, s.boss ? 3 : 19, "#ffd166"); ctx.globalAlpha = 1; }
}
