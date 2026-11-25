# Petbound: Wildlands

A 2.5D pixel-art fantasy pet RPG built with Phaser 3, React, TypeScript and Vite.

The world is rendered as layered 2D pixel art with faux-3D lighting, contact shadows, raised roofs and cinematic camera effects. Pet identities and companion sprites are generated in-game from elemental palettes and deterministic creature seeds; no Pokémon sprite downloads are required.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints (normally http://localhost:5173). Stop the server with Ctrl+C.

## Current visual direction

- Original elemental companion sprites with distinct silhouettes, wings, tails, crests, markings and shiny variants.
- Greenleaf Valley is rethemed as a fantasy pet ranch, with a timber Wild Barn, glass greenhouse, windmill, orchard, fields, stream and forest paths.
- Procedural barn, greenhouse and shop styles use layered roofs, timber framing, glass panes, doors, awnings and foreground props.
- Crates, barrels, hay bales and planters add visual scale around buildings, with animated floating fireflies in flower and moss patches.
- Pet skills use elemental charge motes, rotating rune circles, orbiting particles, perspective rings, beams and impact bursts.
- The summoning shrine displays generated pet art with rarity treatments and a tenth-pull legendary guarantee.

## Gameplay systems

- Top-down movement, interaction, exploration, NPCs, encounters and turn-based battles.
- Elemental skill and reaction mechanics, experience, progression and companion collection.
- A 30-stage challenge tower with persistent progress and rewards. Its current stage resolver is a party-power prototype; it is not yet wired to the full battle scene.

## Compatibility note

Some internal TypeScript identifiers, save fields and imported base stats retain their original Pokémon-era names so the existing battle/session systems and local saves continue to work during the visual rebrand. Visible creature names, art and player-facing language are now fantasy-pet themed.

## Release checks

Run `npm run typecheck`, `npm run test` and `npm run build` before release. The changes in this session have not yet been executed through a local build, so please run these checks after pulling.
