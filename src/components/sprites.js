// Pixel data, palettes and sprite drawing
export const PAL = { K:"#120e1a",S:"#f2c9a0",B:"#3a2a1e",L:"#d4a82a",W:"#cfd6e6",h:"#5b3f8c",H:"#3b2a5c",C:"#2e2447",c:"#463a6b",E:"#5ef2ff",o:"#2bb6d9",y:"#5ef2ff",w:"#e8ffff",g:"#6fcf6a",G:"#c9f59a",X:"#5ef2ff",x:"#2bb6d9",Y:"#e8ffff",R:"#e0414f",r:"#ff9aa5",b:"#5b7fd0",Z:"#b9d0ff",T:"#f5c542",t:"#fff1a8",D:"#a8741a",d:"#7a5320" };
export const WHITE = new Proxy({}, { get: () => "#ffffff" });
export const DIM = new Proxy({}, { get: () => "#3a3448" });
export const HIT = { K:"#fff", g:"#fff", G:"#fff" };

export const LEGS = { i:["...KKBKKKBKK....","....KBK.KBK.....","....KKK.KKK....."], r1:["...KKKKKKKKK....","..KBBK...KBK....","..KKK....KKK...."], r2:["...KKKBBKKKK....",".....KBBK.......",".....KKKK......."], r3:["...KKKKKKKKK....","....KBK...KBBK..","....KKK....KKK.."] };

const DAG = [[12,9,"L"],[13,8,"W"],[14,7,"W"],[15,6,"W"]], RDAG = [[12,10,"L"],[13,11,"W"],[14,12,"W"]];
const BOW = [[12,6,"d"],[13,7,"d"],[13,8,"d"],[13,9,"d"],[13,10,"d"],[12,11,"d"],[12,7,"W"],[12,8,"W"],[12,10,"W"],[12,9,"S"]];
const STAFF = [[13,1,"X"],[12,2,"X"],[13,2,"Y"],[14,2,"X"],[13,3,"X"],[13,4,"d"],[13,5,"d"],[13,6,"d"],[13,7,"d"],[13,8,"d"],[13,9,"S"],[13,10,"d"],[13,11,"d"],[13,12,"d"]];

const stamp = (rows, art, x0, y0) => { const out = rows.map(r => r.split("")); art.forEach((r, j) => [...r].forEach((c, i) => { if (c !== ".") out[y0 + j][x0 + i] = c; })); return out.map(r => r.join("")); };
// light from the upper left: darken the right half (steel W→J→j→q, purple h→H, gold L→l)
const SHADE = { W: "J", J: "j", j: "q", h: "H", L: "l" };
const shadeRight = rows => rows.map(r => [...r].map((c, i) => (i >= 8 && SHADE[c]) || c).join(""));
const mirror8 = half => half.map(r => r + [...r].reverse().join(""));
export const HERO = {
  warden: {
    // Knight in shining armour: polished steel (light from the upper left, right half shaded), great-helm with nose guard and
    // purple plume, purple tabard + cape, gold trim, soul-gem belt. No shield. Great sword (engine draws it while swinging).
    body: shadeRight(mirror8(["......KH",".....KHh","....KJWW","....KJWJ","....KJKK","....KJEK","....KJKJ",".....KJJ",".KKKKJWW","KJWJKJhh","KjJjKJhL",".KKKKJhE","KHHKJhhh"])),
    legs: {
      i:  shadeRight(mirror8(["...KJWjK","...KJjK.","...KKKK."])),
      r1: ["..KJWjKKKKK.....",".KJWjK...KjqqK..",".KKKK....KqqjK.."],
      r2: ["...KJWjKKjqqK...","....KJKKKKqK....","....KKK..KKK...."],
      r3: [".....KKKKKjqqK..","..KJWjK..KjqqK..","..KKKKK...KKKK.."],
    },
    pal: { J:"#c8d3ea", j:"#7d8bab", q:"#4a5578", W:"#ffffff", h:"#7a52c0", H:"#4b3580", L:"#e0b93a", l:"#a8841e", E:"#5ef2ff", K:"#120e1a" },
    // rest pose: great sword held point-up beside the shoulder (2 px wide, 8 px long)
    idle: [[16,12,"L"],[16,11,"B"],[16,10,"B"],[15,9,"L"],[16,9,"L"],[17,9,"l"],[16,8,"W"],[17,8,"J"],[16,7,"W"],[17,7,"J"],[16,6,"W"],[17,6,"J"],[16,5,"W"],[17,5,"J"],[16,4,"W"],[17,4,"J"],[16,3,"W"],[17,3,"J"],[16,2,"J"]],
    run:  [[16,11,"B"],[16,10,"B"],[15,10,"L"],[17,10,"l"],[17,12,"W"],[18,13,"W"],[18,12,"J"],[19,14,"W"],[19,13,"J"],[20,15,"J"]],
    // static fallbacks (class-select preview, Mirror Self). In the game the engine draws a rotating blade + slash arc instead.
    atk: [
      [[16,10,"B"],[15,9,"L"],[16,9,"L"],[17,9,"l"],[16,8,"W"],[17,8,"J"],[16,7,"W"],[17,7,"J"],[16,6,"W"],[17,6,"J"],[16,5,"W"],[17,5,"J"],[16,4,"W"],[17,4,"J"],[16,3,"J"]],
      [[15,10,"B"],[16,8,"L"],[16,9,"L"],[16,10,"L"],[16,11,"l"],[17,9,"W"],[18,9,"W"],[19,9,"W"],[20,9,"W"],[21,9,"W"],[17,10,"J"],[18,10,"J"],[19,10,"J"],[20,10,"J"],[21,10,"J"],[22,9,"J"],[19,5,"x"],[20,6,"X"],[21,7,"X"],[22,8,"Y"],[22,11,"X"],[21,12,"X"],[20,13,"x"]],
      [[16,11,"B"],[16,10,"B"],[15,10,"L"],[17,10,"l"],[17,12,"W"],[18,13,"W"],[18,12,"J"],[19,14,"W"],[19,13,"J"],[20,15,"J"]]],
    phase: a => a > 0.16 ? 0 : a > 0.06 ? 1 : 2, lunge: 1,
    hand: [13.5, 9.5],
    glint: [[6, 2], [2, 9], [6, 8], [16, 4]],         // sparkle spots (sprite coords), one at a time
  },
  ranger: {
    body: ["................","......KKKK......",".....KhhhhK.....","....KhhhhhhK....","...KhhHHHHhhK...","...KhHSSSSHhK...","...KhSKSSKShK...","...KhSSSSSShK...","....KhHHHHhK....","..KScCCLCCcSK...","...KcCCCCCcK....","...KcCCCCCcK....","...KKcCCCcKK...."],
    pal: { h:"#3f7a4a", H:"#2a5234", C:"#5a4a2e", c:"#7a6440" }, idle: BOW, run: BOW,
    atk: [
      [...BOW.filter(([x, y]) => !(x === 12 && y > 6 && y < 11)), [11,8,"W"],[11,10,"W"],[10,9,"W"],[11,9,"S"],[12,9,"d"],[14,9,"W"],[15,9,"W"],[16,9,"Z"]],
      [...BOW, [15,9,"Y"],[16,8,"y"],[16,10,"y"]]],
    phase: a => a > 0.08 ? 0 : 1, lunge: -1,
  },
  mage: {
    body: [".......KK.......","......KhhK......","......KhHK......",".....KhhHhK.....","....KhhhhHhK....","..KKhhhhhhhhKK..",".KhhhhhhhhhhhhK.","..KKKSSSSSSKKK..","....KSESSESK....","..KSKcCCCCcKSK..","...KcCCLLCCcK...","...KcCCCCCCcK...","..KcCCCCCCCCcK.."],
    pal: { h:"#2f4a9c", H:"#5577d9", C:"#3b2e6e", c:"#5a47a0", E:"#ffd166" }, idle: STAFF, run: STAFF,
    atk: [
      STAFF.map(([x, y, c]) => [x, y - 1, c]),
      [...STAFF.map(([x, y, c]) => [x, y - 1, c === "X" ? "Y" : c]), [11,0,"Y"],[15,0,"Y"],[13,-1,"w"],[11,2,"y"],[15,2,"y"]]],
    phase: a => a > 0.1 ? 0 : 1, lunge: -1,
  },

  // Assassin: slim hooded blade-dancer, white eyes over a red mask/scarf, twin reverse-grip daggers (engine will draw the stabs).
  assassin: {
    body: stamp(mirror8([".......K","......KH",".....KHh","....KHhh","....KhKK","....KhEK","....KhRr",".....KrR","..KKKhcc",".KcKKccC",".KcKKcCB","..KKKcCC","...KCCcC"]),
                ["r","R","r"], 11, 7),                                    // scarf tail
    legs: { i: mirror8(["....KCCK","....KCK.","....KKK."]), r1: ["...KCCKKKKK.....","..KCCK...KCCK...","..KKK....KKKK..."], r2: ["....KCCKKCCK....",".....KCKKCK.....",".....KKKKKK....."], r3: [".....KKKKKCCK...","...KCCK..KCCK...","...KKKK...KKK..."] },
    pal: { h:"#3a3f52", H:"#262a3a", c:"#4a5068", C:"#1d2030", r:"#d9433a", R:"#8c2a30", E:"#ffffff", B:"#5a3a22", J:"#b9c2d6", W:"#eef2fa", K:"#120e1a" },
    idle: [[2,11,"W"],[2,12,"W"],[2,13,"J"],[13,11,"W"],[13,12,"W"],[13,13,"J"]],
    run:  [[1,11,"W"],[0,12,"W"],[0,13,"J"],[14,11,"W"],[15,12,"W"],[15,13,"J"]],
    atk: [[[1,9,"W"],[1,8,"W"],[1,7,"W"],[1,6,"J"],[14,9,"W"],[14,8,"W"],[14,7,"W"],[14,6,"J"]],
          [[14,10,"W"],[15,10,"W"],[16,10,"W"],[17,10,"J"],[14,8,"W"],[15,7,"W"],[16,6,"J"],[17,8,"Y"],[18,9,"x"]],
          [[13,11,"W"],[14,12,"W"],[15,13,"J"],[2,11,"W"],[2,12,"W"],[2,13,"J"]]],
    phase: a => a > 0.12 ? 0 : a > 0.05 ? 1 : 2, lunge: 1,
    hand: [13.5, 9.5],
  },
  // Gunner: wide-brim hat, brass goggles, brown trench coat, chunky hand cannon (engine will rotate the gun toward the target).
  gunner: {
    body: stamp(mirror8(["....KKKK","....KHHH","...KDDDD","..KHHHHH","....KJEJ","....KSSS",".....KCC","..KKKccC",".KccKccC",".KcSKcBB",".KcKKcBL","..KKKccC","...KCCcc"]),
                [], 0, 0),
    legs: { i: mirror8(["....KCCK","....KCK.","....KKK."]), r1: ["...KCCKKKKK.....","..KCCK...KCCK...","..KKK....KKKK..."], r2: ["....KCCKKCCK....",".....KCKKCK.....",".....KKKKKK....."], r3: [".....KKKKKCCK...","...KCCK..KCCK...","...KKKK...KKK..."] },
    pal: { H:"#c9a27a", D:"#5a3a22", J:"#d4a82a", E:"#ffb347", S:"#f2c9a0", C:"#5a3a22", c:"#8a5a32", B:"#3a2a1e", L:"#d4a82a", K:"#120e1a", j:"#5d6478", W:"#cfd6e6", y:"#ffd166", Y:"#fff2b0" },
    idle: [[12,10,"B"],[13,10,"B"],[13,11,"B"],[14,9,"j"],[14,10,"j"],[15,9,"W"],[15,10,"j"],[16,9,"W"],[17,9,"W"]],
    run:  [[13,10,"B"],[13,11,"B"],[14,11,"j"],[14,12,"j"],[15,12,"W"],[16,12,"W"],[17,13,"W"]],
    atk: [[[12,10,"B"],[13,10,"B"],[13,11,"B"],[14,9,"j"],[14,10,"j"],[15,9,"W"],[15,10,"j"],[16,9,"W"],[17,9,"W"]],
          [[12,10,"B"],[13,10,"B"],[13,11,"B"],[14,9,"j"],[14,10,"j"],[15,9,"W"],[15,10,"j"],[16,9,"W"],[17,9,"W"],[18,9,"Y"],[19,9,"y"],[18,8,"y"],[18,10,"y"],[20,9,"y"]],
          [[12,9,"B"],[13,9,"B"],[13,10,"B"],[14,8,"j"],[14,9,"j"],[15,7,"W"],[15,8,"j"],[16,6,"W"],[17,5,"W"],[17,3,"j"],[18,4,"j"]]],
    phase: a => a > 0.1 ? 0 : a > 0.04 ? 1 : 2, lunge: -1,
    hand: [13.5, 9.5],
  },
  // Chronomancer: teal hood with gold clock accents, glowing gold eyes, hourglass staff (engine draws bolts / Rewind ghost).
  chronomancer: {
    body: mirror8([".......K","......KH",".....KHh","....KHhh","....KhKK","....KhEK","....KhKK",".....KLl","..KKKhhc",".KhcKhhc",".KhhKhLL",".KHhKhhc","...KHhhc"]),
    legs: { i: mirror8(["....KHhK","....KHK.","....KKK."]), r1: ["...KHhKKKKK.....","..KHhK...KHhK...","..KKK....KKKK..."], r2: ["....KHhKKHhK....",".....KHKKHK.....",".....KKKKKK....."], r3: [".....KKKKKHhK...","...KHhK..KHhK...","...KKKK...KKK..."] },
    pal: { h: "#2f7f86", H: "#1d4f57", c: "#4ab3ba", L: "#e0b93a", l: "#a8841e", E: "#ffe08a", B: "#5a3a22", y: "#ffd166", w: "#cfe8ff", K: "#120e1a" },
    idle: [[13,1,"L"],[14,1,"L"],[15,1,"L"],[13,2,"w"],[14,2,"y"],[15,2,"w"],[14,3,"y"],[13,4,"w"],[14,4,"y"],[15,4,"w"],[13,5,"L"],[14,5,"L"],[15,5,"L"],[14,6,"B"],[14,7,"B"],[14,8,"B"],[14,9,"B"],[14,10,"B"],[14,11,"B"],[14,12,"B"]],
    run:  [[13,1,"L"],[14,1,"L"],[15,1,"L"],[13,2,"w"],[14,2,"y"],[15,2,"w"],[14,3,"y"],[13,4,"w"],[14,4,"y"],[15,4,"w"],[13,5,"L"],[14,5,"L"],[15,5,"L"],[14,6,"B"],[14,7,"B"],[14,8,"B"],[14,9,"B"],[14,10,"B"],[14,11,"B"],[14,12,"B"]],
    atk: [
      [[13,1,"L"],[14,1,"L"],[15,1,"L"],[13,2,"w"],[14,2,"y"],[15,2,"w"],[14,3,"y"],[13,4,"w"],[14,4,"y"],[15,4,"w"],[13,5,"L"],[14,5,"L"],[15,5,"L"],[14,6,"B"],[14,7,"B"],[14,8,"B"],[14,9,"B"],[14,10,"B"],[14,11,"B"],[14,12,"B"]],
      [[13,1,"L"],[14,1,"L"],[15,1,"L"],[13,2,"w"],[14,2,"y"],[15,2,"w"],[14,3,"y"],[13,4,"w"],[14,4,"y"],[15,4,"w"],[13,5,"L"],[14,5,"L"],[15,5,"L"],[14,6,"B"],[14,7,"B"],[14,8,"B"],[14,9,"B"],[14,10,"B"],[14,11,"B"],[14,12,"B"],[16,3,"y"],[17,3,"y"],[18,3,"w"]],
      [[13,1,"L"],[14,1,"L"],[15,1,"L"],[13,2,"w"],[14,2,"y"],[15,2,"w"],[14,3,"y"],[13,4,"w"],[14,4,"y"],[15,4,"w"],[13,5,"L"],[14,5,"L"],[15,5,"L"],[14,6,"B"],[14,7,"B"],[14,8,"B"],[14,9,"B"],[14,10,"B"],[14,11,"B"],[14,12,"B"]]],
    phase: a => a > 0.12 ? 0 : a > 0.05 ? 1 : 2, lunge: -1,
    hand: [13.5, 9.5],
  },
};
for (const k in HERO) HERO[k].palFull = { ...PAL, ...HERO[k].pal };

export const WISP = ["..o..",".oyo.","oywyo",".oyo.","..o.."];
export const HAWK = [["D.....D","dD...Dd",".dDKDd.","...d...","......."], [".......","...K...","DddKddD",".D.d.D.","......."]];
export const FAMILIAR = [["b...b","bZ.Zb",".ZYZ.","bZ.Zb","b...b"], [".....","bZ.Zb","bZYZb","bZ.Zb","....."]];

// New companions (art only until the classes are wired in): Shade Cat (Assassin), Bomb Buddy (Gunner), Sandling (Chronomancer)
export const CAT = [[".K.K....",".KcKcK..",".KEcEcK.",".KccccKK","..KccccK","..K.K.K."],[".K.K...K",".KcKcK.K",".KEcEcKc",".KccccKK","..KccccK","..K.K.K."]];
export const CAT_PAL = { K: "#120e1a", c: "#5a6078", E: "#ffe066" };
export const BOMB = [["..yY..","..KK..",".KrrK.","KrErEK","KrRRrK",".KKKK."],["..Yy..","..KK..",".KrrK.","KrErEK","KrRRrK","K.KK.K"]];
export const SAND = [["LLLLL",".wyw.","..y..",".wyw.","LLLLL"],["LLLLL",".wyw.","..y..",".wwy.","LLLLL"]];
export const SAND_PAL = { L: "#e0b93a", w: "#cfe8ff", y: "#ffd166", K: "#120e1a" };
export const BOMB_PAL = { K: "#120e1a", r: "#d9433a", R: "#8c2a30", y: "#ffd166", Y: "#fff2b0", E: "#ffe066" };
export const SLIME = ["..KKKK..",".KgGggK.","KgKggKgK","KggggggK",".KKKKKK."];
export const SLIME_BOSS = ["...L..L..L..","...LLLLLLL..","..KKKKKKKK..",".KgGggggggK.","KgGggggggggK","KggKKggKKggK","KggKEggKEggK","KggggggggggK","KgggKKKKgggK",".KggggggggK.","..KKKKKKKK.."];
export const LORD = [".....L...LL...L.....",".....LL.LLLL.LL.....","......LLLLLLLL......",".....KKKKKKKKKK.....","....KhhhhhhhhhhK....","...KhhHHHHHHHHhhK...","...KhHKKKKKKKKHhK...","...KhKKEEKKEEKKhK...","...KhKKKKKKKKKKhK...","..KhhKKKKKKKKKKhhK..",".KhhhhHHHHHHHHhhhhK.","KhhKhhhhhhhhhhhhKhhK","KhK.KhhhhhhhhhhK.KhK","KXK.KhhhhhhhhhhK.KXK",".K..KhhhhhhhhhhK..K.","....KhhHhhhhHhhK....","...KhhKhhKKhhKhhK...","...KK..KK..KK..KK..."];
export const TROPHY = ["..KKKKKKKKKK..","KKKtTTTTTTDKKK","KTKtTTTTTTDKTK","KTKtTTTTTTDKTK",".KKKtTTTTDKKK.","...KKtTTDKK...",".....KTDK.....",".....KTDK.....","....KKTDKK....","...KtTTTTDK...","..KKKKKKKKKK..","..KDDDDDDDDK..","..KKKKKKKKKK.."];

export const ICONS = {
  phantom:    ["..KKK..",".KwwwK.","KwKwKwK","KwwwwwK","KwwwwwK","KwKwKwK",".K.K.K."],
  bloodrush:  ["...K...","..KRK..",".KRrRK.",".KRrRK.",".KRRRK.","..KRK..","...K..."],
  bottomless: [".K.K.K.","KyKyKyK","KyKyKyK","KyKyKyK","KLKLKLK","KLKLKLK",".K.K.K."],
  buckshot:   [".y...y.","...y...","y..y..y","..yKy..","..KLK..","..KLK..","..KKK.."],
  slowmo:     ["KKKKKKK",".KZZZK.","..KZK..","...K...","..KZK..",".KZZZK.","KKKKKKK"],
  overclock:  ["...KK..","..KTK..",".KTTK..","KTTTTTK","..KTTK.","..KTK..","..KK..."],
  heart:     [".KK.KK.","KRrKRRK","KrRRRRK","KRRRRRK",".KRRRK.","..KRK..","...K..."],
  shield:    [".KKKKK.","KbbbbbK","KbZbbbK","KbZbbbK",".KbbbK.","..KbK..","...K..."],
  boots:     ["..KKK..","..KBKZZ","..KBK.Z",".KBBK..","KBBBBK.","KBBBBBK","KKKKKKK"],
  frenzy:    [".....KK","....KWK","...KWK.","K.KWK..","KLKK...",".KLK...","K..K..."],
  surge:     ["..KKK..",".KXXXK.","KXYYXXK","KXYXXxK","KXXXxxK",".KxxxK.","..KKK.."],
  multishot: ["W..W..W",".W.W.W.","..WWW..","...d...","...d...","...d...","..KdK.."],
  pierce:    [".......","..KRK..",".KRrRK.","WWWWWWW",".KRRRK.","..KRK..","......."],
  overload:  ["Y..X..Y",".KXXXK.","KXYYXXK","XXYwXXX","KXXXXxK",".KxxxK.","Y..x..Y"],
  nova:      ["..ZZZ..",".Z...Z.","Z..Y..Z","Z.YwY.Z","Z..Y..Z",".Z...Z.","..ZZZ.."],
};

export function spr(ctx, rows, x, y, flip, pal) {
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) { const c = r[i]; if (c === ".") continue; ctx.fillStyle = pal[c]; ctx.fillRect(Math.round(x + (flip ? r.length - 1 - i : i)), Math.round(y + j), 1, 1); } });
}

// h = { x, y, face, moving, atk }
export function drawHero(ctx, key, h, now, palOverride) {
  const Hh = HERO[key], pal = palOverride || Hh.palFull, f = Math.floor(now / (h.moving ? 90 : 400)), fl = h.face < 0;
  const legs = h.moving ? ["r1","r2","r3","r2"][f % 4] : "i", dy = f % 2;
  const ph = h.atk > 0 ? Hh.phase(h.atk) : -1, px = h.x + (ph === Hh.lunge ? h.face : 0);
  const ov = h.noWeapon ? [] : ph >= 0 ? Hh.atk[ph] : h.moving ? Hh.run : Hh.idle;       // noWeapon: engine draws the blade itself
  spr(ctx, Hh.body, px, h.y + dy, fl, pal); spr(ctx, (Hh.legs || LEGS)[legs], px, h.y + 13, fl, pal);
  for (const [x, y, c] of ov) { ctx.fillStyle = pal[c]; ctx.fillRect(Math.round(px + (fl ? 15 - x : x)), Math.round(h.y + y + (y < 13 ? dy : 0)), 1, 1); }
  if (Hh.glint && !palOverride) {                                   // "shining" armour: a sparkle every ~2.6 s
    const cyc = 2600, t = now % cyc;
    if (t < 200) {
      const [gx, gy] = Hh.glint[Math.floor(now / cyc) % Hh.glint.length];
      if (!(h.noWeapon && gx > 15)) {
        const x = Math.round(px + (fl ? 15 - gx : gx)), y = Math.round(h.y + gy + dy);
        ctx.fillStyle = "#ffffff"; ctx.fillRect(x, y, 1, 1);
        if (t < 130) { ctx.fillStyle = "#dfe9ff"; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
      }
    }
  }
}
