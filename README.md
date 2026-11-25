# Pokémon Pixel Adventure

Top-down 2D pixel RPG built with Phaser 3, React, TypeScript and Vite.

**Build 0.4.0 — World & Controls Refresh:** Map 1 now uses an orthogonal 32×32 tile grid (the classic FireRed/Emerald-style camera), not the earlier diamond/isometric projection. Arrow keys and WASD move in the direction shown on screen. A direction tap moves immediately, brief direction changes are buffered during a step, Shift runs, mouse/touch destination selection remains available, and a compact touch D-pad appears on smaller screens.

## Run locally
```bash
npm install
npm run dev
```
Open the local URL Vite prints (normally http://localhost:5173). Stop the server with Ctrl+C.

## Làng Lá Xanh (Greenleaf Village) — map 1
Ruby/Sapphire-inspired countryside: homes, Birch Lab, spinning windmill, farms, well, orchard, stream with bridge and pond, then Route 101. Villagers and wild Pokémon wander, trainers spot you ("!") and walk over, items (visible + hidden) can be picked up, Birch rewards 5 Pokédex entries, and wild Pokémon have a 1/128 shiny chance.

Move effects (`src/game/battle/fx/MoveFx.ts`) are anime-style additive glows — fireballs, water jets, layered lightning, vine whips, razor leaves, poison needles, tornadoes, psychic rings, claws, jaws, shields and magic circles — with the stage dimmed during each move. Every move learned by map-1 Pokémon has a signature effect; other moves fall back to their type.

Overworld art is painted procedurally: FireRed-style autotiled paths/sand/water (animated), 2-tile trees that hide the player, tall grass that covers the player's legs, shingled houses with pixel-font plaques, shadows and a VT323 pixel font with Vietnamese support.

The map is fully data-driven:

- `src/game/data/maps/greenleaf.ts` — ASCII layout (42×30), buildings, NPCs, signs, exits and the encounter table.
- `src/game/world/tiles.ts` — tile legend (`T` tree, `:` tall grass, `~` water, `=` path…) with collision/encounter flags.
- `src/game/world/TilesetFactory.ts` + `pixelArt.ts` — procedurally painted 32×32 square pixel-art tileset with path/water autotiling and character sprite sheets.
- `src/game/world/WorldMap.ts` — renders the layout with a Phaser Tilemap and answers collision / interaction queries.
- `src/game/entities/PlayerController.ts` — orthogonal 4-direction movement, immediate taps, buffered input and 4-direction walk animation.
- `src/game/systems/EncounterSystem.ts` + `services/RandomService.ts` — weighted, rarity-aware wild encounters.
- `src/game/ui/DialogBox.ts` — bottom text box for NPCs, signs and doors.

To add a map: copy `greenleaf.ts`, edit the layout/data and register it in `src/game/data/maps/index.ts`.

Gameplay loop on this map: talk to NPCs and signs, catch Pokémon in tall grass, beat Finn, Willow and Moss, then the Forest Guardian; the Guardian steps aside and the east exit unlocks Crystal Cave.

## Gameplay (v0.2)
- **Starter:** talk to Ranger Oak and pick Bulbasaur, Charmander or Squirtle.
- **All 151 Kanto Pokémon** with Gen 3 base stats, types, level-up learnsets and evolutions generated from [`@pkmn/dex`](https://github.com/pkmn/ps) (MIT) via `npm run gen:data` → `src/game/data/generated/`.
- **274 Gen 3 moves** with type, power, accuracy, PP, priority, crits, STAB, drain/recoil, flinch, multi-hit, fixed damage, OHKO, confusion, Leech Seed, Reflect/Light Screen, Protect, healing, stat stages and status (burn, poison, paralysis, sleep, freeze). A few niche moves (weather, Transform, Metronome…) have no effect yet. Full Gen 3 type chart (17 types).
- **FireRed-style battles** (`scenes/BattleScene.ts`): FIGHT / BAG / POKéMON / RUN, animated HP & EXP bars, type-coloured attack effects, Poké Ball shakes, forced switching, multi-Pokémon trainers, smart trainer AI.
- **Level-up:** learn moves (with "forget a move" prompt) and evolve at level or with Fire/Thunder/Leaf Stone.
- **Menus** (React): Pokédex (seen/caught), Party (summary, stats, moves, reorder), PC Box, Bag, Poké Mart, Save.
- **Economy:** prize money from trainers, lose half on blackout.

Battle rules live in `src/game/battle/BattleEngine.ts` (pure TypeScript, no Phaser); data lives in `src/game/data/{species,moves,types,items}.ts`.

### Pokémon sprites
Front sprites are in `src/assets/sprites/pokemon/front/` named by National Dex number (`001.png` … `151.png`), sliced from the pixel sheet by **@balavicknesh** (fan art — credit the artist if you publish). Optional back sprites go in `.../back/`; without them the front sprite is mirrored. Missing art falls back to a generated placeholder.

## Controls
- WASD / Arrow keys: move
- Enter / Space / Z: interact, advance dialog
- Arrows + Z/Enter in battle menus, X/Esc to go back
- Tab: party
- Esc: start menu (Pokédex, Pokémon, Bag, PC Box, Save)

## Notes
The current map is a fully playable first-area prototype built from procedural pixel shapes (no external art required). It is designed to be extended with authored tilemaps, animations, sound, quest tracking, additional regions and richer battle moves.
