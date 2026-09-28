// Pixel data, palettes and sprite drawing
export const PAL = { K:"#120e1a",S:"#f2c9a0",B:"#3a2a1e",L:"#d4a82a",W:"#cfd6e6",h:"#5b3f8c",H:"#3b2a5c",C:"#2e2447",c:"#463a6b",E:"#5ef2ff",o:"#2bb6d9",y:"#5ef2ff",w:"#e8ffff",g:"#6fcf6a",G:"#c9f59a",X:"#5ef2ff",x:"#2bb6d9",Y:"#e8ffff",R:"#e0414f",r:"#ff9aa5",b:"#5b7fd0",Z:"#b9d0ff",T:"#f5c542",t:"#fff1a8",D:"#a8741a",d:"#7a5320" };
export const WHITE = new Proxy({}, { get: () => "#ffffff" });
export const DIM = new Proxy({}, { get: () => "#3a3448" });
export const HIT = { K:"#fff", g:"#fff", G:"#fff" };

export const LEGS = { i:["...KKBKKKBKK....","....KBK.KBK.....","....KKK.KKK....."], r1:["...KKKKKKKKK....","..KBBK...KBK....","..KKK....KKK...."], r2:["...KKKBBKKKK....",".....KBBK.......",".....KKKK......."], r3:["...KKKKKKKKK....","....KBK...KBBK..","....KKK....KKK.."] };

const DAG = [[12,9,"L"],[13,8,"W"],[14,7,"W"],[15,6,"W"]], RDAG = [[12,10,"L"],[13,11,"W"],[14,12,"W"]];
const BOW = [[12,6,"d"],[13,7,"d"],[13,8,"d"],[13,9,"d"],[13,10,"d"],[12,11,"d"],[12,7,"W"],[12,8,"W"],[12,10,"W"],[12,9,"S"]];
const STAFF = [[13,1,"X"],[12,2,"X"],[13,2,"Y"],[14,2,"X"],[13,3,"X"],[13,4,"d"],[13,5,"d"],[13,6,"d"],[13,7,"d"],[13,8,"d"],[13,9,"S"],[13,10,"d"],[13,11,"d"],[13,12,"d"]];

export const HERO = {
  warden: {
    body: ["......KK........",".....KhhK.......","....KhhhhKK.....","...KhhhhhhhK....","..KhhHHHHHhhK...","..KhHKKKKKHhK...","..KhKEKKKEKhK...","..KhKKKKKKKhK...","...KhHHHHHhK....","..KScCCCCCcSK...","...KcCCLCCcK....","...KcCCCCCcK....","..KcCCCCCCCcK..."],
    pal: {}, idle: DAG, run: RDAG,
    atk: [
      [[12,8,"S"],[13,7,"L"],[13,6,"W"],[13,5,"W"],[13,4,"W"]],
      [[12,9,"S"],[13,9,"L"],[14,9,"W"],[15,9,"W"],[16,9,"W"],[15,4,"x"],[16,5,"X"],[17,6,"X"],[18,7,"Y"],[18,8,"Y"],[18,9,"X"],[17,11,"X"],[16,12,"x"]],
      [[12,10,"S"],[13,11,"L"],[14,12,"W"],[15,13,"W"],[17,10,"x"],[16,12,"x"]]],
    phase: a => a > 0.18 ? 0 : a > 0.1 ? 1 : 2, lunge: 1,
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
};
for (const k in HERO) HERO[k].palFull = { ...PAL, ...HERO[k].pal };

export const WISP = ["..o..",".oyo.","oywyo",".oyo.","..o.."];
export const HAWK = [["D.....D","dD...Dd",".dDKDd.","...d...","......."], [".......","...K...","DddKddD",".D.d.D.","......."]];
export const FAMILIAR = [["b...b","bZ.Zb",".ZYZ.","bZ.Zb","b...b"], [".....","bZ.Zb","bZYZb","bZ.Zb","....."]];
export const SLIME = ["..KKKK..",".KgGggK.","KgKggKgK","KggggggK",".KKKKKK."];
export const SLIME_BOSS = ["...L..L..L..","...LLLLLLL..","..KKKKKKKK..",".KgGggggggK.","KgGggggggggK","KggKKggKKggK","KggKEggKEggK","KggggggggggK","KgggKKKKgggK",".KggggggggK.","..KKKKKKKK.."];
export const LORD = [".....L...LL...L.....",".....LL.LLLL.LL.....","......LLLLLLLL......",".....KKKKKKKKKK.....","....KhhhhhhhhhhK....","...KhhHHHHHHHHhhK...","...KhHKKKKKKKKHhK...","...KhKKEEKKEEKKhK...","...KhKKKKKKKKKKhK...","..KhhKKKKKKKKKKhhK..",".KhhhhHHHHHHHHhhhhK.","KhhKhhhhhhhhhhhhKhhK","KhK.KhhhhhhhhhhK.KhK","KXK.KhhhhhhhhhhK.KXK",".K..KhhhhhhhhhhK..K.","....KhhHhhhhHhhK....","...KhhKhhKKhhKhhK...","...KK..KK..KK..KK..."];
export const TROPHY = ["..KKKKKKKKKK..","KKKtTTTTTTDKKK","KTKtTTTTTTDKTK","KTKtTTTTTTDKTK",".KKKtTTTTDKKK.","...KKtTTDKK...",".....KTDK.....",".....KTDK.....","....KKTDKK....","...KtTTTTDK...","..KKKKKKKKKK..","..KDDDDDDDDK..","..KKKKKKKKKK.."];

export const ICONS = {
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
  const ov = ph >= 0 ? Hh.atk[ph] : h.moving ? Hh.run : Hh.idle;
  spr(ctx, Hh.body, px, h.y + dy, fl, pal); spr(ctx, LEGS[legs], px, h.y + 13, fl, pal);
  for (const [x, y, c] of ov) { ctx.fillStyle = pal[c]; ctx.fillRect(Math.round(px + (fl ? 15 - x : x)), Math.round(h.y + y + (y < 13 ? dy : 0)), 1, 1); }
}
