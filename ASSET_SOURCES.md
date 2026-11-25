# Art direction and asset sourcing

The game's visual direction is a coherent, readable isometric pixel-art village/route. Do not mix packs with incompatible tile dimensions, perspective, outline weight, or palette.

## Candidate packs reviewed on itch.io

- [Isometric Tiles - Town Pack — Screaming Brain Studios](https://screamingbrainstudios.itch.io/iso-town-pack): CC0; modular town/building tiles that fit an isometric village.
- [Town Environments: 196 Pixel Art Tiles — PtDesigns](https://itch.io/game-assets/tag-2d): CC0 pack listed on itch.io; use the creator's specific product page and included README/license before importing.
- [Free Isometric Tileset - 32x32 — Shafe](https://shafe.itch.io/free-isometric-tileset-3): CC BY 4.0; requires attribution in the shipped credits if used.
- [itch.io CC0 + Isometric + Pixel Art catalogue](https://itch.io/game-assets/free/tag-cc0/tag-isometric/tag-pixel-art): source catalogue for additional compatible packs.

## Integration rules

1. Download the chosen pack from its creator page; keep its original license/README in `public/assets/third-party/<pack-name>/`.
2. Add an attribution entry here for every non-CC0 asset used.
3. Normalize the art to the game's 64×32 diamond ground grid and nearest-neighbor scaling; do not stretch object sprites to match tile shapes.
4. Replace assets by category in a controlled pass (ground → path/shore transitions → props → buildings), preserving the map's logical collision and quest coordinates.
5. Keep the existing procedural fallback art until every imported texture has been checked in-game.

This document records vetted sourcing options, not a claim that downloaded third-party art has already been bundled.
