# Asset and data rights ledger

**Release gate:** every asset shipped in the game must have a traceable right to use, modify, and redistribute it for the intended platform and commercial model. A credit line alone does not grant a license.

## Known items requiring clearance

| Asset/data | Repository evidence | Required action |
|---|---|---|
| 151 front sprites | `src/assets/sprites/pokemon/front/001.png` … `151.png`; README says sheet-derived fan art and credits @balavicknesh | Locate original sheet/source and exact license; verify derivative + redistribution permission. If unknown, replace with original/commissioned art. |
| Species/moves JSON | `src/game/data/generated/{species,moves}.json`, generated from `@pkmn/dex` | Audit dataset license, source terms, trademarked names and derivative content; do not treat package's code license as automatic clearance of franchise data. |
| Maps/dialog/UI | Greenleaf, Birch, Pokédex, Poké Ball and Pokémon-specific story terms in source | Rewrite for original IP or get qualified review for fan distribution. |
| Music/SFX | `src/game/audio/GameAudio.ts` procedural synth | Verify code is original and ensure no recognizable copied melody; record author/date and version. |
| Fonts and dependencies | package.json + lockfile | Preserve each package's license notices; run license inventory on release build. |
| Promotional art/store screenshots | Must be inventoried separately | Use only cleared artwork and avoid implying official affiliation. |

## Required manifest row template

Copy one row for **each** shipped file or asset pack:

| Path / pack | Creator | Source / receipt | License | Commercial use | Modify | Redistribute | Attribution required | Evidence checked by / date |
|---|---|---|---|---|---|---|---|
| `assets/example.png` | TBD | TBD | TBD | Unknown until verified | TBD | TBD | TBD | Not cleared |

## Rules
- Keep license text and proof of purchase/commission in `docs/licenses/` where redistribution is permitted; otherwise keep a private release archive and link its record.
- Record version/commit of asset pack and any restrictions (platform, duration, territory, credit placement).
- Never commit API keys, private receipts, or personal billing details.
- Mark an item **CLEARED** only after the exact license/permission has been reviewed for this build and release model.
