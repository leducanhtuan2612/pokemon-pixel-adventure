# Pokémon Pixel Adventure

Top-down 2D pixel RPG built with **Phaser 3 + React + TypeScript + Vite**. The game runtime belongs to Phaser; React hosts the HUD and surrounding menus.

## Run locally

```bash
npm install
npm run dev
```

Production build:

```bash
npm run build
npm run preview
```

## Current foundation

- Vite + React + TypeScript setup
- Phaser scene bootstrapping and pixel-art rendering
- First top-down forest map prototype, camera follow, keyboard movement and interaction toast
- Responsive game shell / adventure HUD
- Zustand store scaffold

## Roadmap

1. Replace prototype geometry with authored tilemaps and collision layers.
2. Add modular player movement, NPC/dialogue, map transitions and event system.
3. Add data-driven Pokémon, random encounters, turn-based battle and capture.
4. Add party (6 slots), Pokédex, inventory, EXP/levels, quests and boss progression.
5. Add IndexedDB save/load and audio settings.

This is an incremental playable foundation, not yet the complete game. Gameplay data and systems will be added in separate modules as development continues.
