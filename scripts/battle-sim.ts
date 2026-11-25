/**
 * Headless battle fuzzer: plays hundreds of random battles through the pure
 * BattleEngine and fails on crashes, endless battles or broken invariants.
 * Run with `npm run test:battle` (bundled by esbuild, no browser needed).
 */
import { BattleEngine, type PlayerAction } from "../src/game/battle/BattleEngine";
import { ENERGY_MAX, SURGE_MAX, energyCost } from "../src/game/battle/elements";
import { createPokemon } from "../src/game/core/pokemon";
import { getMove } from "../src/game/data/moves";
import { SPECIES } from "../src/game/data/species";

const ids = Object.keys(SPECIES);
const pick = <T>(a: T[]) => a[Math.floor(Math.random() * a.length)];
let failures = 0, reactions = 0, ultimates = 0, bonds = 0, guards = 0, totalTurns = 0;
const N = Number(process.argv[2] ?? 300);

for (let b = 0; b < N; b++) {
  const trainer = Math.random() < 0.5;
  const party = Array.from({ length: 1 + Math.floor(Math.random() * 3) }, () => createPokemon(pick(ids), 5 + Math.floor(Math.random() * 30)));
  const foes = Array.from({ length: trainer ? 1 + Math.floor(Math.random() * 3) : 1 }, () => createPokemon(pick(ids), 5 + Math.floor(Math.random() * 30)));
  const bag: Record<string, number> = { "poke-ball": 20, "great-ball": 5, potion: 5 };
  const engine = new BattleEngine({
    kind: trainer ? "trainer" : "wild", playerParty: party, foeParty: foes, trainerName: "Sim", prize: 10, boss: trainer && Math.random() < 0.3,
    bag: { count: (id) => bag[id] ?? 0, take: (id) => { if (!bag[id]) return false; bag[id]--; return true; } },
    onCaught: () => "party", onSeen: () => {}, hasCaught: () => false,
  });
  try {
    engine.intro();
    let turns = 0;
    while (engine.phase !== "over") {
      if (++turns > 300) throw new Error("battle did not end within 300 turns");
      if (engine.phase === "forceSwitch") {
        const idx = party.findIndex((m) => m.hp > 0 && m !== engine.playerMon);
        if (idx < 0) throw new Error("forceSwitch with no valid replacement");
        engine.forceSwitch(idx);
        continue;
      }
      const me = engine.playerMon, energy = engine.energy("player");
      const affordable = me.moves.map((m, i) => ({ i, c: energyCost(getMove(m.id)) })).filter((x) => x.c <= energy);
      let action: PlayerAction;
      const r = Math.random();
      if (engine.surgeReady("player") && r < 0.6) { action = { type: "ultimate", timing: pick([1, 1.15, 1.3]) }; ultimates++; }
      else if (!trainer && r < 0.08) { action = { type: "bond", itemId: pick(["poke-ball", "great-ball"]), bonus: 1 + Math.random() * 0.75 }; bonds++; }
      else if (r < 0.15 || !affordable.length) { action = { type: "guard" }; guards++; }
      else if (r < 0.18 && party.length > 1) action = { type: "switch", index: Math.floor(Math.random() * party.length) };
      else action = { type: "move", index: pick(affordable).i, timing: pick([1, 1.15, 1.3]) };
      const ev = engine.act(action);
      for (const e of ev) {
        if (e.kind === "reaction") reactions++;
        if (e.kind === "energy" && (e.energy < 0 || e.energy > ENERGY_MAX || e.surge < 0 || e.surge > SURGE_MAX)) throw new Error(`energy out of range: ${JSON.stringify(e)}`);
        if (e.kind === "hp" && (e.hp < 0 || e.hp > e.maxHp || Number.isNaN(e.hp))) throw new Error(`hp out of range: ${JSON.stringify(e)}`);
        if (e.kind === "hit" && Number.isNaN(e.damage)) throw new Error("NaN damage");
      }
      // Wild run attempts on a trainer return only a text event; avoid spinning forever on that.
      if (ev.length === 0 && action.type !== "switch") throw new Error(`no events for ${JSON.stringify(action)}`);
    }
    totalTurns += turns;
  } catch (err) {
    failures++;
    const desc = (m: { speciesId: string; level: number; hp: number; moves: { id: string }[] }) => `${m.speciesId} L${m.level} hp${m.hp} [${m.moves.map((x) => x.id).join(",")}]`;
    console.error(`✗ battle ${b} (${trainer ? "trainer" : "wild"}):`, err instanceof Error ? err.message : err);
    console.error("   player:", party.map(desc).join(" | "));
    console.error("   foe:   ", foes.map(desc).join(" | "));
    if (failures > 5) break;
  }
}

console.log(`${N} battles · avg ${(totalTurns / N).toFixed(1)} turns · reactions ${reactions} · ultimates ${ultimates} · guards ${guards} · bond attempts ${bonds}`);
if (failures) { console.error(`✗ ${failures} battle(s) failed`); process.exit(1); }
console.log("✓ battle simulation passed");
