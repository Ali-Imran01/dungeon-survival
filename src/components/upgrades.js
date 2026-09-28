// In-run upgrades: earned by XP (soul shards) and on stage clear. Reset on death.
// Temporary power-ups = short big spikes. Upgrades = small permanent steps + a few build-changers (epic).

// ---------- XP ----------
export const XP = {
  shard: { slime: 1, bat: 1, cinder: 0, imp: 2, skeleton: 1, drowned: 2, shade: 2, eye: 2, miniboss: 15, stageBoss: 30 },
  need: lv => 25 + 6 * (lv - 1),                 // xp to go from lv → lv+1 : 25, 31, 37, … (~2–3 level-ups per stage)
  magnet: 24,                                     // px; shards fly to the player inside this radius
};
export const SHARD = [".X.","XYX",".X."];         // soul shard pickup (3x3, bobs)

// ---------- Rarity ----------
export const RARITY = {
  common: { color: "#8a83a0", weight: 70, label: "Common" },
  rare:   { color: "#5b7fd0", weight: 25, label: "Rare" },
  epic:   { color: "#b06bff", weight: 5,  label: "Epic", fromStage: 2 },   // no epics in stage 1
};
export const CAPS = { attackInterval: 0.5, cooldown: 0.5, moveSpeed: 1.4, damage: 1.6 }; // min ×interval, min ×cooldown, max ×speed, max ×dmg
export const REROLLS_PER_STAGE = 1;

// ---------- Upgrades ----------
// cls: undefined = shared. max = stack cap. fx = what the engine reads (per stack unless noted).
export const UPGRADES = [
  // shared — common
  { id:"vitality",  name:"Vitality",       rarity:"common", max:3, desc:"+1 max heart, heal 1",           fx:{ maxHp:1, heal:1 } },
  { id:"swift",     name:"Swift Feet",     rarity:"common", max:3, desc:"+10% move speed",                fx:{ moveSpeed:0.10 } },
  { id:"recovery",  name:"Quick Recovery", rarity:"common", max:3, desc:"-15% ability cooldown",          fx:{ cooldown:-0.15 } },
  { id:"magnet",    name:"Soul Magnet",    rarity:"common", max:3, desc:"+50% pickup range",              fx:{ magnet:0.5 } },
  { id:"sharpen",   name:"Sharpened",      rarity:"common", max:3, desc:"+15% damage",                    fx:{ damage:0.15 } },
  { id:"haste",     name:"Haste",          rarity:"common", max:3, desc:"+12% attack speed",              fx:{ attackSpeed:0.12 } },
  // shared — rare
  { id:"guardian",  name:"Guardian Spark", rarity:"rare",   max:2, desc:"Gain a shield every 30s (20s at II)", fx:{ shieldEvery:[30, 20] } },
  { id:"secondWind",name:"Second Wind",    rarity:"rare",   max:1, desc:"Once per stage, survive a lethal hit", fx:{ cheatDeath:1 } },
  { id:"harvest",   name:"Soul Harvest",   rarity:"rare",   max:2, desc:"Heal 1 heart every 40 kills (30 at II)", fx:{ healEvery:[40, 30] } },
  { id:"bond",      name:"Companion Bond", rarity:"rare",   max:2, desc:{ warden:"Wisp fires 2 shots", ranger:"Hawk swoops twice", mage:"Familiar +1 charge" }, fx:{ companion:1 } },
  // Warden
  { id:"wideArc",   cls:"warden", name:"Wide Arc",      rarity:"common", max:3, desc:"+20° swing arc, +3 reach",          fx:{ arc:20, reach:3 } },
  { id:"guardDash", cls:"warden", name:"Guarded Dash",  rarity:"rare",   max:1, desc:"Dashing gives a shield for 1.5s",  fx:{ dashShield:1.5 } },
  { id:"whirlwind", cls:"warden", name:"Whirlwind",     rarity:"epic",   max:1, desc:"Every 4th swing hits all around you", fx:{ spinEvery:4 } },
  { id:"shockDash", cls:"warden", name:"Shock Dash",    rarity:"epic",   max:1, desc:"Dash deals 2 dmg to enemies you pass", fx:{ dashDamage:2 } },
  // Ranger
  { id:"longbow",   cls:"ranger", name:"Longbow",       rarity:"common", max:3, desc:"+15% range and arrow speed",       fx:{ range:0.15, projSpeed:0.15 } },
  { id:"extraArrow",cls:"ranger", name:"Extra Arrow",   rarity:"rare",   max:2, desc:"+1 arrow per shot (60% dmg)",      fx:{ arrows:1, sideDmg:0.6 } },
  { id:"ricochet",  cls:"ranger", name:"Ricochet",      rarity:"epic",   max:1, desc:"Arrows bounce to a 2nd enemy",     fx:{ bounce:1 } },
  { id:"trapRoll",  cls:"ranger", name:"Trap Roll",     rarity:"epic",   max:1, desc:"Roll leaves a spike trap (3 dmg, 5s)", fx:{ rollTrap:3 } },
  // Mage
  { id:"bigSplash", cls:"mage",   name:"Big Splash",    rarity:"common", max:3, desc:"+15% splash radius",               fx:{ splash:0.15 } },
  { id:"deepFreeze",cls:"mage",   name:"Deep Freeze",   rarity:"rare",   max:1, desc:"Chill lasts 2s and slows more",    fx:{ chillTime:2, chillMul:0.4 } },
  { id:"splitOrb",  cls:"mage",   name:"Split Orb",     rarity:"epic",   max:1, desc:"Orbs split into 2 on hit",         fx:{ split:2 } },
  { id:"frostBlink",cls:"mage",   name:"Frost Blink",   rarity:"epic",   max:1, desc:"Blink leaves a frost field (3s)",  fx:{ blinkField:3 } },
];

// desc can be a string or { [cls]: string }
export const describe = (u, cls) => typeof u.desc === "string" ? u.desc : u.desc[cls];

// ---------- Rolling 3 choices ----------
// owned = { id: stacks }. minRarity: "rare" on stage clear. Never offers maxed or duplicate cards.
export function rollChoices(cls, owned, stage, minRarity = "common", n = 3, rnd = Math.random) {
  const order = ["common", "rare", "epic"], minI = order.indexOf(minRarity);
  const pool = UPGRADES.filter(u => (!u.cls || u.cls === cls) && (owned[u.id] || 0) < u.max
    && order.indexOf(u.rarity) >= minI && !(u.rarity === "epic" && stage < RARITY.epic.fromStage));
  const out = [];
  while (out.length < n && pool.length) {
    let sum = 0; for (const u of pool) sum += RARITY[u.rarity].weight * (u.cls ? 1.3 : 1);   // class cards slightly favoured
    let r = rnd() * sum, i = 0;
    for (; i < pool.length; i++) if ((r -= RARITY[pool[i].rarity].weight * (pool[i].cls ? 1.3 : 1)) < 0) break;
    out.push(pool.splice(Math.min(i, pool.length - 1), 1)[0]);
  }
  return out;
}

// ---------- Icons (9x9, PAL keys) ----------
export const UP_ICONS = {
  vitality:  [".KK.KK...","KRrKRRK..","KrRRRRK..","KRRRRRK..",".KRRRK...","..KRK..G.","...K..GGG",".......G.","........."],
  swift:     ["...KKK...","...KBKZ..","...KBK.Z.","..KBBK...",".KBBBBK..","KBBBBBBK.","KKKKKKKK.","..Z.Z....","........."],
  recovery:  [".KKKKKKK.",".KyyyyyK.","..KyyyK..","...KyK...","...KZK...","..KZ.ZK..",".KZZZZZK.",".KKKKKKK.","........."],
  magnet:    ["KKK...KKK","KRK...KWK","KRK...KWK","KRK...KWK","KRRK.KWWK",".KRRKWWK.","..KKKKK..",".........","........."],
  sharpen:   ["......KWK",".....KWK.","....KWK..","K..KWK...","KK.WK....",".KLK.....","KLKK.....",".K.......","........."],
  haste:     ["....KKK..","...KyyK..","..KyyK...",".KyyyyyK.","...KyyK..","..KyyK...","..KyK....","..KK.....","........."],
  guardian:  ["..KKKKK..",".KbbbbbK.",".KbZbbbK.",".KbZbbbK.","..KbbbK..","...KbK...","....K....","y.......y",".y.....y."],
  secondWind:["......KK.",".....KwK.","....KwwK.","...KwwZK.","..KwwZK..",".KwZZK...","KwZKK....","KKK......","........."],
  harvest:   ["..KKKKK..",".KpPPPpK.","KpPrrPPpK","KPrRRrPPK","KPPrRPPPK","KpPPrPPpK",".KpPPPpK.","..KKKKK..","........."],
  bond:      ["..KKK....",".KXXXK...","KXYYXK...","KXYXXK.G.",".KXXK.GGG","..KK...G.",".........",".........","........."],
  wideArc:   ["....KKK..","..KKXXXK.",".KXXK..K.","KXK......","KX.......","KX.......","KXK......",".KXK.....","..K......"],
  guardDash: ["...KKKKK.","..KbbbbbK","..KbZbbbK","y.KbZbbbK","yy.KbbbK.","y...KbK..",".....K...",".........","........."],
  whirlwind: ["..KKKK...",".KX..XK..","KX.KK.XK.","KX.KX.XK.","KX..KXK..",".KX.....K","..KXXXXK.","...KKKK..","........."],
  shockDash: ["y........","yy..KKKK.","...KWWWWK","yy.KWyyWK","...KWWWWK","y...KKKK.",".........",".........","........."],
  longbow:   ["..KK.....","..KdK..W.","...KdKW..","...KdWK..","...KdWK..","...KdKW..","..KdK..W.","..KK.....","........."],
  extraArrow:["W...W...W",".W..W..W.","..W.W.W..","...WWW...","....d....","....d....","...KdK...","...K.K...","........."],
  ricochet:  ["W.......K","WW....KRK","d.W..KRrK","..dW.KRRK","....W.KK.","...W.....","..W......","dW.......","........."],
  trapRoll:  [".........","..W...W..","..W.W.W..",".KWKWKWK.","KBBBBBBBK","KBKBBBKBK",".KKKKKKK.",".........","........."],
  bigSplash: ["X...X...X",".X..X..X.","..XKKKX..","XXKYYYKXX","..KYwYK..","XXKYYYKXX","..XKKKX..",".X..X..X.","X...X...X"],
  deepFreeze:["....Z....",".Z..Z..Z.","..Z.Z.Z..","...ZwZ...","ZZZwwwZZZ","...ZwZ...","..Z.Z.Z..",".Z..Z..Z.","....Z...."],
  splitOrb:  [".KKK.....","KXYXK....","KXXXK....",".KKK.X...","....X.KKK","...X.KXYK","..KKKKXXK","..KXYK.K.","..KKK...."],
  frostBlink:["..ZZZ....",".Z...Z...","Z..P..Z..","Z.PwP.Z..","Z..P..Z.Z",".Z...Z.ZZ","..ZZZ..Z.",".....Z.Z.","......Z.."],
};

// ---------- Effective modifiers from owned upgrades (engine + classes read g.mods) ----------
export function computeMods(owned, cls) {
  const n = id => owned[id] || 0, pick = (id, arr) => n(id) ? arr[Math.min(n(id), arr.length) - 1] : 0;
  return {
    dmg: Math.min(CAPS.damage, 1 + 0.15 * n("sharpen")),
    atk: 1 + 0.12 * n("haste"),                              // attack-rate multiplier (intervals are divided by this; see atkInterval)
    move: Math.min(CAPS.moveSpeed, 1 + 0.10 * n("swift")),
    cd: Math.max(CAPS.cooldown, 1 - 0.15 * n("recovery")),
    magnet: 1 + 0.5 * n("magnet"),
    shieldEvery: pick("guardian", [30, 20]), secondWind: n("secondWind") > 0, healEvery: pick("harvest", [40, 30]), companion: n("bond"),
    arc: 20 * n("wideArc"), reach: 3 * n("wideArc"), dashShield: n("guardDash") ? 1.5 : 0, spinEvery: n("whirlwind") ? 4 : 0, dashDamage: n("shockDash") ? 2 : 0,
    range: 1 + 0.15 * n("longbow"), projSpeed: 1 + 0.15 * n("longbow"), arrows: n("extraArrow"), bounce: n("ricochet"), rollTrap: n("trapRoll") ? 3 : 0,
    splash: 1 + 0.15 * n("bigSplash"), chillTime: n("deepFreeze") ? 2 : 1, chillMul: n("deepFreeze") ? 0.4 : 0.5, split: n("splitOrb") > 0, blinkField: n("frostBlink") ? 3 : 0,
  };
}
// attack interval with temporary rate (power-ups) and permanent rate (Haste), never below 50% of base
export const atkInterval = (base, tempRate, mods) => Math.max(base * CAPS.attackInterval, base / (tempRate * mods.atk));
