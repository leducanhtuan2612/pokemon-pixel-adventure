# Pokémon Pixel Adventure

Top-down 2D pixel RPG built with Phaser 3, React, TypeScript and Vite.

## Run locally
```bash
npm install
npm run dev
```
Open the local URL Vite prints (normally http://localhost:5173). Stop the server with Ctrl+C.

## Greenleaf Village — map 1
The map is fully data-driven:

- `src/game/data/maps/greenleaf.ts` — ASCII layout (42×30), buildings, NPCs, signs, exits and the encounter table.
- `src/game/world/tiles.ts` — tile legend (`T` tree, `:` tall grass, `~` water, `=` path…) with collision/encounter flags.
- `src/game/world/TilesetFactory.ts` + `pixelArt.ts` — procedurally painted 16×16 pixel-art tileset (2× scale) with path/water autotiling and character sprite sheets.
- `src/game/world/WorldMap.ts` — renders the layout with a Phaser Tilemap and answers collision / interaction queries.
- `src/game/entities/PlayerController.ts` — grid movement, tap-to-turn, 4-direction walk animation.
- `src/game/systems/EncounterSystem.ts` + `services/RandomService.ts` — weighted, rarity-aware wild encounters.
- `src/game/ui/DialogBox.ts` — bottom text box for NPCs, signs and doors.

To add a map: copy `greenleaf.ts`, edit the layout/data and register it in `src/game/data/maps/index.ts`.

Gameplay loop on this map: talk to NPCs and signs, catch Pokémon in tall grass, beat Finn, Willow and Moss, then the Forest Guardian; the Guardian steps aside and the east exit unlocks Crystal Cave.

## Gameplay (v0.2)
- **Starter:** talk to Ranger Oak and pick Bulbasaur, Charmander or Squirtle.
- **31 Pokémon** (Gen 1 lines incl. evolutions) with Gen 3 base stats, IVs, growth rates, catch rates and EXP yields.
- **~75 moves** with type, power, accuracy, PP, priority, crits, STAB, drain/recoil, flinch, stat stages and status (burn, poison, paralysis, sleep). Full Gen 3 type chart (17 types).
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
