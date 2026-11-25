# Release readiness — Pokémon Pixel Adventure

> Status: **prototype / pre-release**. This document records repository evidence and the gate to a release candidate. A passing build alone is not a release approval.

## Current repository snapshot (verified from source)

- Stack: Phaser 3 + React + TypeScript + Vite; one registered map, Greenleaf, with Route 101 and a hidden Moonlit Grove section.
- Current player systems include movement/path navigation, NPC/trainer encounters, a turn-based battle engine, catch/party/PC, generated species/move data, quests, items/economy and a versioned local save.
- Save format is currently version 4 under `pixel-adventure-save-v1`; migration handles older formats. **Do not delete or rename this key casually.**
- The repository contains 151 numbered front-sprite PNGs. README credits a sprite-sheet-derived fan-art source, but no repository-level LICENSE file or per-file permission ledger was found in the inspected tree.
- Generated species/move JSON is built from `@pkmn/dex`; the generator and content include Pokémon-specific names/data. This is a material IP clearance concern for a commercial release.
- Existing workflow only installs dependencies and runs the production build. It did not run a dedicated game-data check or automated gameplay tests before this change.
- Save persistence uses browser localStorage and currently silently falls back to a fresh game if parsing/loading fails. Add a recoverable backup/export path before release.

## Release decision — choose the product/legal route first

### Route A: original commercial game (recommended if selling/publishing broadly)
Create original creature designs, names, lore, type names, battle terminology, sprites, icons, music and UI branding. Replace the franchise-derived dataset with a rights-cleared original roster. Rename the project/product and remove Pokémon/Pokédex/Professor Birch/Route 101/Gen references and franchise marks from shipped content, metadata, screenshots and store pages. Obtain legal review for any borderline inspiration.

### Route B: non-commercial fan project
Do not assume non-commercial use is automatically authorized. Verify applicable platform and rights-holder rules, avoid monetization/donations tied to infringing content, do not imply official affiliation, and obtain qualified legal advice before public distribution. This checklist is risk management, not legal advice.

## P0 — blockers before public release

- [ ] Written product/IP decision; no unlicensed franchise assets or data in the release package.
- [ ] Complete asset manifest: path, creator, source URL, license/permission, attribution wording, commercial use, modification, redistribution and proof/receipt.
- [ ] Replace or clear every one of the 151 sprite files; confirm source art, derivative/sheet terms and redistribution rights.
- [ ] Clear fonts, music, sound effects, backgrounds, icons, UI, code/data packages and promotional screenshots.
- [ ] Test new game and existing save migration on real browser builds; corrupted save must offer recovery/export instead of silently losing progress.
- [ ] Gameplay QA: starter, encounter, catch success/failure, ball inventory, faint/blackout, trainer rewards, evolution, move learning, party full → PC, quest claim once, exits/unlocks, reload/resume.
- [ ] Browser QA: desktop keyboard/mouse, touch/mobile, resize, background/foreground, audio first-gesture, hosting path and refresh.
- [ ] No critical/high crash, soft-lock, save loss, broken route or infinite battle loop in release candidate.
- [ ] Public privacy notice (especially if analytics/crash reports are added), contact/support, version, known issues and release notes.

## P1 — release quality

- [ ] A coherent original sprite sheet style: consistent palette, outlines, proportions, shadows, tile scale and animation cadence.
- [ ] All playable character directions have idle/walk frames; NPC and creature idle/turn/walk transitions do not pop or mirror incorrectly.
- [ ] Gameplay pacing playtest: first meaningful reward within 5–10 minutes; each 10–15 minute session offers a goal, discovery, tactical battle or collection milestone.
- [ ] Add a clear early tutorial, optional objective tracker, map landmark/signposting, safe healing loop and fair boss/trainer telegraphs.
- [ ] Tune capture/encounter rates using telemetry-free playtest sheets first; prevent forced encounters from being farmed or feeling punitive.
- [ ] Battle readability: damage, type effectiveness, status, turn order and capture feedback are understandable without wiki knowledge.
- [ ] Keyboard focus/escape behavior, readable text scaling, color contrast, reduced motion option, mute controls and sufficiently large touch controls.
- [ ] Optimize first-load bundle, sprite memory, camera/frame stability and low-end mobile battery use.
- [ ] Add in-game save export/import with schema validation and backup slots.

## P2 — after a stable first release

- [ ] Additional region/map content with distinct encounter pools and story payoff.
- [ ] Optional challenges, collection rewards, post-game and replayable trainer rematches.
- [ ] Cloud save/account only if there is a clear product need; design server-side auth and privacy first.
- [ ] Localization, controller/gamepad support, achievements and storefront packaging after web release has stable metrics.

## Release candidate acceptance

A release candidate is acceptable only when all are true:
1. CI is green for install, typecheck, automated data tests and production build.
2. A tagged candidate can be deployed and smoke-tested at its actual public URL.
3. 100% of shipped assets have documented rights compatible with the distribution model.
4. Save backup/export/import and migration tests pass without destructive reset.
5. A tester completes the first-area main path and side quest loop on desktop and mobile with no P0 defect.
6. Known issues, version/changelog, support contact and privacy statement are published.

## Suggested milestones

- **M0 — Rights & product identity (1–3 days plus external clearance):** choose route A/B, inventory/replace assets, define target platforms and release license.
- **M1 — Reliability (3–5 days):** save recovery/export, deterministic unit tests for battle/capture/rewards, map/data checks, CI artifact.
- **M2 — Vertical slice polish (1–2 weeks):** original hero/NPC/creature art, tutorial, quest feedback, encounter/capture balance and mobile controls.
- **M3 — QA & content lock (1 week):** playtest feedback, browser matrix, performance, accessibility, bug triage, release candidate.
- **M4 — Publish & maintain:** signed/tagged version, hosting, changelog, feedback channel, rollback and hotfix process.

Estimates are planning ranges for one developer, not commitments. Art licensing/commission turnaround and legal review can extend them substantially.
