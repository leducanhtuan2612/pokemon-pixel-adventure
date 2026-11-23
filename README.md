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

## Controls
- WASD / Arrow keys: move
- Enter / Space / Z: interact, advance dialog
- 1: Attack · 2: Capture · 3: Potion · 4: Run during battle
- Esc: current objective (battle help during battles)

## Notes
The current map is a fully playable first-area prototype built from procedural pixel shapes (no external art required). It is designed to be extended with authored tilemaps, animations, sound, quest tracking, additional regions and richer battle moves.
