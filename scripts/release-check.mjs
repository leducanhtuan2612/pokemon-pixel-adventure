import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const read = (p) => readFile(join(root, p), "utf8");
const pass = (label, detail) => console.log(`✓ ${label}: ${detail}`);
const fail = (message) => { console.error(`✗ RELEASE CHECK: ${message}`); process.exitCode = 1; };

try {
  const species = JSON.parse(await read("src/game/data/generated/species.json"));
  const moves = JSON.parse(await read("src/game/data/generated/moves.json"));
  const layoutSource = await read("src/game/data/maps/greenleaf.ts");
  const tileSource = await read("src/game/world/tiles.ts");

  if (!Array.isArray(species) || species.length !== 151) fail(`expected 151 species data records; found ${species?.length}`);
  else pass("species data", "151 records");

  const speciesIds = new Set(species.map((s) => s.id));
  const dexNumbers = new Set(species.map((s) => s.dex));
  if (speciesIds.size !== species.length) fail("duplicate species ids");
  if (dexNumbers.size !== species.length) fail("duplicate Pokédex numbers");
  if (species.some((s) => !s.id || !Number.isInteger(s.dex) || s.dex < 1 || !Array.isArray(s.types) || !Array.isArray(s.learnset))) fail("species schema contains malformed records");
  else pass("species schema", "ids, dex numbers, types and learnsets valid");

  const moveIds = Object.keys(moves);
  if (moveIds.length < 250) fail(`move registry unexpectedly small (${moveIds.length})`);
  else pass("move registry", `${moveIds.length} entries`);
  for (const [id, move] of Object.entries(moves)) {
    if (move.id !== id || !move.type || !Number.isFinite(move.pp) || move.pp < 1) fail(`invalid move record: ${id}`);
  }
  for (const s of species) {
    for (const [, moveId] of s.learnset) if (!moves[moveId]) fail(`${s.id} references missing move ${moveId}`);
    for (const evo of s.evolutions ?? []) if (!speciesIds.has(evo.into)) fail(`${s.id} evolves into missing species ${evo.into}`);
  }
  pass("cross references", "learnset moves and evolution targets resolve");

  const layoutMatch = layoutSource.match(/layout:\s*\[([\s\S]*?)\n\s*\],/);
  if (!layoutMatch) fail("could not parse Greenleaf map layout");
  else {
    const rows = [...layoutMatch[1].matchAll(/"([A-Za-z.*:=~sFWRBDYhvfnmlQCE]+)"/g)].map((m) => m[1]);
    if (!rows.length) fail("Greenleaf layout has no rows");
    const width = rows[0].length;
    if (rows.some((row) => row.length !== width)) fail("Greenleaf layout rows have inconsistent widths");
    const allowed = new Set([...tileSource.matchAll(/^\s*"(.+?)":\s*\{/gm)].map((m) => m[1]));
    const used = new Set(rows.join(""));
    const unknown = [...used].filter((ch) => !allowed.has(ch));
    if (unknown.length) fail(`map uses undefined tile symbols: ${unknown.join(", ")}`);
    else pass("map integrity", `Greenleaf ${width}×${rows.length}; all ${used.size} tile symbols registered`);
  }

  const sprites = await readdir(join(root, "src/assets/sprites/pokemon/front"));
  const spriteIds = new Set(sprites.filter((f) => /^\d{3}\.png$/.test(f)));
  if (spriteIds.size !== 151) fail(`expected 151 numbered front sprite files; found ${spriteIds.size}`);
  else pass("sprite completeness", "numbered front sprite set 001–151 present");

  const pkg = JSON.parse(await read("package.json"));
  if (!pkg.scripts.typecheck || !pkg.scripts.build) fail("typecheck/build scripts missing");
  else pass("release scripts", "typecheck and production build declared");

  if (process.exitCode) console.error("Release checks failed. Fix these before preparing a candidate.");
  else console.log("Static release checks passed. This is not a substitute for browser/gameplay QA or asset clearance.");
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}
