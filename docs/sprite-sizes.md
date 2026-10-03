# Sprite sizes (pixels, W×H)

Measured from the sprite arrays in `src/components/`. Logical screen is 240×135 (desktop) / 160×144 (Game Boy).

## Heroes
All six share one footprint: **body 16×13 + legs 16×3 = 16×16** (legs are a separate 3-row strip on Warden, Assassin, Gunner, Necromancer; Ranger and Mage have none). Hero preview canvas is 22×20 (room for weapon/cape).

| Hero | Body | Legs | Idle / run / attack frames |
|---|---|---|---|
| Warden | 16×13 | 16×3 | 19 / 10 / 3 (+4 glint) |
| Ranger | 16×13 | – | 10 / 10 / 2 |
| Mage | 16×13 | – | 14 / 14 / 2 |
| Assassin | 16×13 | 16×3 | 6 / 6 / 3 |
| Gunner | 16×13 | 16×3 | 9 / 7 / 3 |
| Necromancer | 16×13 | 16×3 | 20 / 20 / 3 |

## Regular enemies (sprite = hitbox)
| Enemy | Stage | Size |
|---|---|---|
| Slime | 1-2 | 8×5 |
| Frost Bat | 2 | 9×6 (2 frames) |
| Magma Slime | 3 | 8×5 |
| Fire Imp | 3 | 10×11 (2 frames) |
| Cinder (summon) | 3 | 5×4 |
| Skeleton | 4 | 10×12 |
| Bone Pile (summon) | 4 | 8×3 |
| Drowned | 4 | 10×13 |
| Shade | 5 | 10×12 |
| Void Eye | 5 | 9×9 |
| Rat (summon) | 1 | 9×5 |
| Rift (summon) | 5 | 7×9 |

## Bosses
| Stage | Miniboss 1 | Miniboss 2 | Stage boss |
|---|---|---|---|
| 1 | Slime King 12×11 | Rat King 16×12 | The Jailer 18×18 |
| 2 | Frost Golem 14×14 | Ice Wraith 12×14 | Glacier Queen 20×20 |
| 3 | Molten Smith 16×16 | Salamander 16×9 | Forgemaster 22×22 |
| 4 | Gravekeeper 14×15 | Drowned Knight 14×16 | Crypt Lich 20×22 |
| 5 | Mirror Self 16×16 (copies your hero) | Rift Weaver 18×12 | Hollow Lord 26×24 |
