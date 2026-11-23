# Pokémon Pixel Adventure

Top-down 2D pixel RPG built with Phaser 3, React, TypeScript and Vite.

## Run locally
```bash
npm install
npm run dev
```
Open the local URL Vite prints (normally http://localhost:5173). Stop the server with Ctrl+C.

## Greenleaf Village — playable map
- Large explorable village/forest map with paths, lake, grass patches, houses, clinic, landmarks and Forest Trial gate.
- Grid-step four-direction movement, map camera and collision with map boundaries, scenery and NPCs.
- NPC interaction using Enter/Space: guide, Pokémon Center nurse, three trainers and the trial guardian.
- Random wild encounters in tall grass with a roster of original game-data entries inspired by classic creature RPGs.
- Turn-based battle: Attack, Capture, Potion and Run (wild battles only); trainer battles and guardian trial.
- Capture system, party of up to six, PC box overflow, XP/level-up, potions and Poké Balls.
- Win conditions: defeat three named trainers, challenge Forest Guardian and earn Forest Badge.
- Local save via browser localStorage: team, PC box, supplies, defeated trainers, badge and map position.

## Controls
- WASD / Arrow keys: move
- Enter / Space: interact
- 1: Attack · 2: Capture · 3: Potion · 4: Run during battle
- Esc: battle help / exploration hint

## Notes
The current map is a fully playable first-area prototype built from procedural pixel shapes (no external art required). It is designed to be extended with authored tilemaps, animations, sound, quest tracking, additional regions and richer battle moves.
