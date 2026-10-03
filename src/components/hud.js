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
  s = String(s).toUpperCase();
  x = Math.round(x);
  y = Math.round(y);

  // shadow pass first (offset by 1px), then the real colour on top
  const passes = shadow ? [shadow, col] : [col];
  for (const pass of passes) {
    const offset = pass === col ? 0 : 1;
    ctx.fillStyle = pass;
    for (let i = 0; i < s.length; i++) {
      const glyph = G[s[i]];
      if (!glyph) continue;
      glyph.split(",").forEach((row, j) => {
        for (let k = 0; k < 3; k++) {
          if (row[k] === "#") ctx.fillRect(x + i * 4 + k + offset, y + j + offset, 1, 1);
        }
      });
    }
  }
}

function bar(ctx, x, y, w, h, frac, fill, bg = "#120e1a") {
  ctx.fillStyle = bg;
  ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = "#2a2338";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, Math.round(w * Math.max(0, Math.min(1, frac))), h);
}

const EMPTY = new Proxy({}, { get: (_, k) => k === "K" ? "#120e1a" : "#3a2433" });
const ABILITY = {
  Dash:  [".........","y...KKKK.",".yyKWWWWK","..yKWWWWK",".yyKWWWWK","y...KKKK.",".........",".........","........."],
  Roll:  ["..KKKK...",".KG..GK..","KG....GK.","KG....KKK","KG.....G.",".KG..GK..","..KKKK...",".........","........."],
  "Raise Dead": ["..KKKKK..",".KWWWWWK.","KWWWWWWWK","KWKKWKKWK","KWKKWKKWK",".KWWWWWK.","..KWKWK..","..KWKWK..","...KKK..."],
  Step:   [".....K...","....KWK..","...KWWK..","KK.KWK...","KrKKK....",".KrK.....","..KrK....","...K.K...","....K.K.."],
  Recoil: [".........","...K....T","..KWK..T.","KKWWWKTT.","KWWWWKTTT","KKWWWKTT.","..KWK..T.","...K....T","........."],
  Blink: ["....Y....","....Y....","..Z.Y.Z..","...ZwZ...","YYYwwwYYY","...ZwZ...","..Z.Y.Z..","....Y....","....Y...."],
};
// armour plates (7x6): full / empty / recharging / danger palettes
const PLATE = [".KKKKK.","KJWWWJK","KJWWWJK","KJJJJJK",".KJJJK.","..KKK.."];
const PLATE_FULL = { K: "#120e1a", J: "#8a93a8", W: "#e4eaf6" };
const PLATE_DIM = { K: "#120e1a", J: "#2c3146", W: "#343a52" };
const PLATE_PART = { K: "#120e1a", J: "#5d6478", W: "#7a8398" };
const PLATE_RED = { K: "#ff4a6a", J: "#2c3146", W: "#343a52" };

// like spr() but can skip the first `from` rows (used for the plate recharge fill)
function spr2(ctx, rows, x, y, pal, from = 0) {
  rows.forEach((row, j) => {
    if (j < from) return;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === ".") continue;
      ctx.fillStyle = pal[row[i]];
      ctx.fillRect(x + i, y + j, 1, 1);
    }
  });
}

const SKULL = [".KKK.", "KwwwK", "wKwKw", "KwwwK", ".KwK."];
const HORNS = ["w...w", "ww.ww", ".www.", ".wKw.", ".www."];
const ROMAN = ["", "", "II", "III"];

// s = { hp, maxHp, shield, lv, xp, xpNeed, stage, stageName, phase(0..2), kills, killsNeed, score, time,
//       ability:{ name, cd, max, key }, fx:[{ k, lv, t, dur }], boss:{ name, hp, max, color, ticks:[.66,.33] } | null,
//       msg, msgT, accent }
export function drawHUD(ctx, s, W, H, now) {
  const small = W < 200;
  const pal = PAL;

  drawBackingStrips(ctx, s, W, H, small);

  // top-left: hearts + shield, armour plates, level + xp
  for (let i = 0; i < s.maxHp; i++) {
    spr(ctx, ICONS.heart.slice(0, 6), 3 + i * 8, 3, false, i < s.hp ? pal : EMPTY);
  }
  if (s.shield) spr(ctx, ICONS.shield.slice(0, 6), 3 + s.maxHp * 8 + 1, 3, false, pal);

  const armor = s.armor;
  if (armor) {
    for (let i = 0; i < armor.max; i++) {
      const x = 3 + i * 9;
      const y = 10;
      if (i < armor.n) {
        spr2(ctx, PLATE, x, y, PLATE_FULL);
        continue;
      }
      // empty slot; flashes red when every plate is gone
      const flashRed = armor.n === 0 && Math.floor(now / 250) % 2;
      spr2(ctx, PLATE, x, y, flashRed ? PLATE_RED : PLATE_DIM);
      if (i === armor.n) {
        // the plate that's recharging fills from the bottom
        const rows = Math.round(6 * Math.max(0, Math.min(1, 1 - armor.t / armor.dur)));
        spr2(ctx, PLATE, x, y, PLATE_PART, 6 - rows);
      }
    }
  }

  const lvLabel = "LV" + s.lv;
  text(ctx, lvLabel, 3, 18, "#5ef2ff");
  bar(ctx, 3 + textW(lvLabel) + 3, 20, small ? 22 : 32, 1, s.xp / s.xpNeed, "#5ef2ff");

  // top-center: stage + soul progress toward next boss
  if (!s.boss) drawStageProgress(ctx, s, W, small);

  // top-right: score + time
  const minutes = Math.floor(s.time / 60);
  const seconds = String(Math.floor(s.time % 60)).padStart(2, "0");
  const clock = `${minutes}:${seconds}`;
  if (!small) text(ctx, String(s.score), W - 3 - textW(String(s.score)), 3, "#ffd166");
  text(ctx, clock, W - 3 - textW(clock), small ? 3 : 10, "#8a83a0");

  // bottom-left: ability with cooldown fill
  const ax = 3;
  const ay = H - 14;
  const ready = s.ability.cd <= 0;
  ctx.fillStyle = "#120e1a";
  ctx.fillRect(ax - 1, ay - 1, 13, 13);
  ctx.fillStyle = ready && Math.floor(now / 400) % 2 ? "#e8e4f5" : "#4a4458";
  ctx.fillRect(ax, ay, 11, 11);
  ctx.fillStyle = "#1b1726";
  ctx.fillRect(ax + 1, ay + 1, 9, 9);
  spr(ctx, ABILITY[s.ability.name], ax + 1, ay + 1, false, pal);
  if (!ready) {
    const frac = s.ability.cd / s.ability.max;
    ctx.fillStyle = "rgba(18,14,26,.75)";
    ctx.fillRect(ax + 1, ay + 1, 9, Math.ceil(9 * frac));
  }
  text(ctx, s.ability.key, ax + 14, ay + 3, "#8a83a0");

  // Assassin: Shadow Step charges + Ambush window
  if (s.ambush) {
    const ambush = s.ambush;
    const y0 = ay - 7;
    let x0 = ax;
    if (ambush.max > 1) {
      for (let i = 0; i < ambush.max; i++) {
        ctx.fillStyle = i < ambush.charges ? "#ff4a5a" : "#3a3448";
        ctx.fillRect(x0 + i * 4, y0, 3, 5);
      }
      x0 += ambush.max * 4 + 2;
    }
    if (ambush.t > 0) {
      bar(ctx, x0, y0 + 1, 24, 3, ambush.t / ambush.dur, "#ff4a5a");
      text(ctx, "AMBUSH", x0 + 27, y0, "#ff4a5a");
    }
  }

  // Gunner: ammo pips above the ability icon, reload bar while reloading
  if (s.ammo) {
    const ammo = s.ammo;
    const y0 = ay - 7;
    if (ammo.reload > 0) {
      bar(ctx, ax, y0 + 1, 30, 2, 1 - ammo.reload / ammo.dur, "#ffd166");
      text(ctx, "RELOAD", ax + 33, y0 - 1, "#ffd166");
    } else {
      for (let i = 0; i < ammo.max; i++) {
        const loaded = i < ammo.n;
        ctx.fillStyle = ammo.inf ? "#5ef2ff" : loaded ? "#ffd166" : "#3a3448";
        ctx.fillRect(ax + i * 3, y0, 2, 5);
        ctx.fillStyle = ammo.inf ? "#e8ffff" : loaded ? "#fff2b0" : "#3a3448";
        ctx.fillRect(ax + i * 3, y0, 2, 1);
      }
    }
  }

  // bottom-right: active power-ups with timer bars
  s.fx.forEach((f, i) => {
    const x = W - 3 - 9 - i * 11;
    const y = H - 13;
    spr(ctx, ICONS[f.k], x + 1, y, false, pal);
    if (f.lv > 1) text(ctx, ROMAN[f.lv], x + 10 - textW(ROMAN[f.lv]), y - 6, "#ffd166");
    const blink = f.t < 2 && Math.floor(now / 150) % 2;
    bar(ctx, x, y + 9, 9, 1, f.t / f.dur, blink ? "#ff4a6a" : "#e8e4f5");
  });

  // bottom-center: boss bar with phase ticks
  if (s.boss) {
    const boss = s.boss;
    const bw = Math.round(W * (small ? 0.5 : 0.42));
    const bx = Math.round(W / 2 - bw / 2);
    const by = H - 7;
    text(ctx, boss.name, W / 2 - textW(boss.name) / 2, by - 8, boss.color);
    bar(ctx, bx, by, bw, 3, boss.hp / boss.max, boss.color);
    for (const t of boss.ticks || []) {
      ctx.fillStyle = "#120e1a";
      ctx.fillRect(bx + Math.round(bw * t), by - 1, 1, 5);
    }
  }

  // toast
  if (s.msgT > 0) {
    ctx.globalAlpha = Math.min(1, s.msgT * 2);
    text(ctx, s.msg, W / 2 - textW(s.msg) / 2, s.boss ? 3 : 19, "#ffd166");
    ctx.globalAlpha = 1;
  }
}

// dark strips behind the HUD so it reads over busy walls / bright floors
function drawBackingStrips(ctx, s, W, H, small) {
  const leftW = small ? 54 : 60;
  ctx.fillStyle = "rgba(10,8,16,.6)";
  ctx.fillRect(0, 0, W, 17);
  ctx.fillRect(0, 17, leftW, 9);
  ctx.fillStyle = "rgba(10,8,16,.35)";
  ctx.fillRect(leftW, 17, W - leftW, 1);
  ctx.fillRect(0, 26, leftW, 1);

  // bottom-left strip grows taller when there's an ammo / ambush row above the ability icon
  ctx.fillStyle = "rgba(10,8,16,.45)";
  const tall = s.ammo || s.ambush;
  let stripW;
  if (s.ammo) stripW = 44;
  else if (s.ambush) stripW = s.ambush.t > 0 ? 80 : 44;
  else stripW = small ? 30 : 34;
  ctx.fillRect(0, H - (tall ? 24 : 16), stripW, tall ? 24 : 16);

  if (s.fx.length) ctx.fillRect(W - 4 - s.fx.length * 11, H - 21, 4 + s.fx.length * 11, 21);
}

function drawStageProgress(ctx, s, W, small) {
  const accent = s.accent || "#b06bff";
  const lap = s.loop ? `L${s.loop + 1} ` : "";
  const stageLabel = small ? `${s.stage}-${s.phase + 1}` : `${s.stage}-${s.phase + 1} ${s.stageName}`;
  const label = lap + stageLabel;
  const bw = small ? 36 : 56;
  const bx = Math.round(W / 2 - bw / 2);

  text(ctx, label, W / 2 - textW(label) / 2, 3, "#cfc8e0");
  bar(ctx, bx, 10, bw, 2, s.kills / s.killsNeed, accent);

  // phase pips: done = accent, current = white, upcoming = dim
  for (let k = 0; k < 3; k++) {
    ctx.fillStyle = "#120e1a";
    ctx.fillRect(bx - 13 + k * 4, 9, 4, 4);
    ctx.fillStyle = k < s.phase ? accent : k === s.phase ? "#e8e4f5" : "#3a3448";
    ctx.fillRect(bx - 12 + k * 4, 10, 2, 2);
  }

  // last phase of a stage shows a skull instead of the horns
  const lastPhase = s.phase === 2;
  spr(ctx, lastPhase ? SKULL : HORNS, bx + bw + 3, 8, false, { K: "#120e1a", w: lastPhase ? "#ff4a6a" : "#ffd166" });
}
