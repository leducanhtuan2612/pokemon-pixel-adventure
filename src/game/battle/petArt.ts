import { getSpecies } from "../data/species";
import { TYPE_COLORS, type PokemonType } from "../data/types";

type SpriteView = "front" | "back";
type Point = readonly [number, number];

const INK = "#26333a";

function tint(hex: string, amount: number) {
  const n = Number.parseInt(hex.slice(1), 16);
  const channels = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) =>
    Math.max(0, Math.min(255, Math.round(v + (amount >= 0 ? (255 - v) * amount : v * amount)))),
  );
  return "#" + channels.map((v) => v.toString(16).padStart(2, "0")).join("");
}

function seedOf(id: string) {
  let seed = 2166136261;
  for (let i = 0; i < id.length; i++) seed = Math.imul(seed ^ id.charCodeAt(i), 16777619);
  return seed >>> 0;
}

function polygon(ctx: CanvasRenderingContext2D, pts: Point[], fill: string, stroke = INK, lineWidth = 1) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, stroke = INK, lineWidth = 1) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

function drawElementCrest(ctx: CanvasRenderingContext2D, type: PokemonType, accent: string, light: string, seed: number) {
  switch (type) {
    case "Fire":
      polygon(ctx, [[4, 8], [2, 5], [4, 4], [4, 1], [7, 4], [8, 7]], accent, INK, 0.6);
      ctx.fillStyle = "#fff0a4"; ctx.fillRect(4, 4, 1, 2);
      break;
    case "Water":
      polygon(ctx, [[12, 8], [14, 5], [13, 3], [15, 5], [15, 8]], light, INK, 0.6);
      ctx.fillStyle = "#e9fbff"; ctx.fillRect(13, 5, 1, 2);
      break;
    case "Grass":
      polygon(ctx, [[5, 7], [3, 3], [6, 4], [8, 1], [9, 6]], accent, INK, 0.6);
      ctx.fillStyle = light; ctx.fillRect(6, 3, 1, 3);
      break;
    case "Electric":
      polygon(ctx, [[4, 7], [6, 4], [5, 2], [9, 5], [7, 7]], "#ffe77d", INK, 0.6);
      break;
    case "Ice":
      polygon(ctx, [[5, 7], [4, 3], [6, 1], [8, 4], [7, 7]], "#e8fcff", "#6099ba", 0.6);
      break;
    case "Rock":
    case "Steel":
      polygon(ctx, [[4, 7], [5, 2], [8, 4], [10, 2], [11, 7]], accent, INK, 0.7);
      ctx.fillStyle = light; ctx.fillRect(6, 3, 1, 2);
      break;
    case "Flying":
    case "Bug":
      polygon(ctx, [[3, 8], [1, 5], [3, 3], [7, 6]], light, INK, 0.6);
      polygon(ctx, [[11, 6], [14, 3], [15, 6], [12, 8]], accent, INK, 0.6);
      break;
    case "Ghost":
    case "Psychic":
      ellipse(ctx, 8, 4, 3.2, 3.2, accent, INK, 0.6);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(7, 2, 2, 1);
      break;
    case "Dragon":
      polygon(ctx, [[4, 7], [3, 2], [7, 5], [8, 7]], accent, INK, 0.7);
      polygon(ctx, [[10, 7], [13, 2], [13, 6], [12, 8]], light, INK, 0.7);
      break;
    default:
      if (seed % 3 === 0) {
        polygon(ctx, [[4, 7], [3, 3], [6, 5], [8, 2], [9, 7]], accent, INK, 0.6);
      } else {
        ellipse(ctx, 5, 5, 2.1, 2.8, accent, INK, 0.6);
        ellipse(ctx, 11, 5, 2.1, 2.8, light, INK, 0.6);
      }
  }
}

/**
 * Original companion-creature sprite generator. The silhouettes, markings and
 * elemental ornaments are assembled from a deterministic seed, so every
 * species keeps its own recognizable look without external character art.
 */
export function createPetSpriteCanvas(speciesId: string, view: SpriteView = "front") {
  const species = getSpecies(speciesId);
  const seed = seedOf(species.id);
  const primary = species.types[0] as PokemonType;
  const secondary = (species.types[1] ?? species.types[0]) as PokemonType;
  const main = TYPE_COLORS[primary];
  const accent = TYPE_COLORS[secondary];
  const dark = tint(main, -0.42);
  const light = tint(main, 0.42);
  const pale = tint(main, 0.68);
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.save();
  ctx.scale(4, 4);
  ctx.lineJoin = "miter";
  ctx.lineCap = "square";

  // A soft contact shadow anchors the pet to the ground.
  ellipse(ctx, 8, 14.2, 5.4, 1.15, "rgba(19,31,35,0.30)", "", 0);

  const form = seed % 6;
  const tailEndX = form === 1 ? 2.5 : form === 4 ? 14.5 : 3.5;
  const tailEndY = form === 2 ? 4 : form === 5 ? 8 : 10;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 2.8;
  ctx.beginPath();
  ctx.moveTo(10, 11);
  ctx.quadraticCurveTo(14, tailEndY + 1, tailEndX, tailEndY);
  ctx.stroke();
  ctx.strokeStyle = accent;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(10, 11);
  ctx.quadraticCurveTo(14, tailEndY + 1, tailEndX, tailEndY);
  ctx.stroke();

  // Wings and side fins sit behind the body to give a layered silhouette.
  if (form === 2 || primary === "Flying" || primary === "Bug" || primary === "Dragon") {
    polygon(ctx, [[5, 9], [1, 6], [2, 11], [4, 13], [7, 12]], dark, INK, 0.8);
    polygon(ctx, [[11, 9], [15, 6], [14, 11], [12, 13], [9, 12]], accent, INK, 0.8);
    ctx.fillStyle = light; ctx.fillRect(2, 8, 2, 1); ctx.fillRect(12, 8, 2, 1);
  }

  // Four little feet make even the rounder forms feel grounded.
  for (const x of [5, 10]) {
    ellipse(ctx, x, 13.1, 1.45, 1.6, dark, INK, 0.55);
    ctx.fillStyle = light; ctx.fillRect(x - 0.3, 13, 1, 1);
  }

  // Main body shape varies by creature seed: round, tall, shell-backed or sleek.
  const body = form === 0 ? [8, 10.4, 5.0, 4.3] : form === 3 ? [8, 10.5, 4.4, 5.0] :
    form === 4 ? [8, 10.5, 5.4, 4.3] : form === 5 ? [8, 10.5, 5.1, 3.8] : [8, 10.6, 4.9, 4.1];
  ellipse(ctx, body[0], body[1], body[2] + 0.45, body[3] + 0.45, INK, INK, 0.5);
  ellipse(ctx, body[0], body[1] - 0.15, body[2], body[3], main, INK, 0.55);

  // A raised head gives the sprite a readable chibi / collectible-toy profile.
  const headX = form === 1 ? 9.5 : form === 5 ? 8.8 : 9;
  ellipse(ctx, headX, 6.2, form === 3 ? 3.5 : 3.15, 3.0, INK, INK, 0.5);
  ellipse(ctx, headX, 6.05, form === 3 ? 3.1 : 2.8, 2.6, light, INK, 0.6);
  polygon(ctx, [[headX - 2.1, 6.8], [headX, 8.2], [headX + 2.0, 6.8]], pale, "", 0);

  // Ear, horn or leaf crests are unique to each elemental family.
  drawElementCrest(ctx, primary, accent, pale, seed);

  // Back shell / markings are a small signature detail for the species.
  if (form === 4 || primary === "Rock" || primary === "Steel") {
    ellipse(ctx, 8, 9.8, 3.35, 2.75, dark, INK, 0.7);
    polygon(ctx, [[8, 7.2], [10.6, 9.1], [8.1, 12.2], [5.5, 9.1]], accent, INK, 0.5);
    ctx.fillStyle = light; ctx.fillRect(7, 8, 1, 2);
  } else {
    ellipse(ctx, 8, 10.6, 2.9, 2.45, tint(main, 0.18), "", 0);
    ctx.fillStyle = accent; ctx.fillRect(6, 9, 1, 1); ctx.fillRect(9, 11, 1, 1);
    ctx.fillStyle = pale; ctx.fillRect(6, 10, 1, 1);
  }

  // Elemental particles and signature ornaments.
  if (primary === "Fire") {
    polygon(ctx, [[2, 11], [1, 9], [2.5, 8], [3, 10]], "#fff0a4", "#c75c35", 0.5);
  } else if (primary === "Water") {
    ellipse(ctx, 14, 11, 1.1, 1.5, "#d8f8ff", "#4b83c3", 0.45);
  } else if (primary === "Electric") {
    polygon(ctx, [[12, 10], [14, 8], [13, 11], [15, 12], [12, 12]], "#fff2a0", "#b08b30", 0.4);
  } else if (primary === "Grass" || primary === "Bug") {
    polygon(ctx, [[2, 12], [3, 9], [5, 11], [4, 13]], "#c8f28b", "#477d4b", 0.45);
  } else if (primary === "Ice") {
    polygon(ctx, [[13, 10], [15, 8], [15, 12]], "#ffffff", "#73b6d0", 0.45);
  } else if (primary === "Ghost" || primary === "Psychic") {
    ellipse(ctx, 13.5, 12, 1, 1, "#ffffff", accent, 0.4);
  }


  // Species-specific silhouette ornaments: layered horns, segmented armor,
  // wing ribs and elemental tail accents. All shapes are original pixel art.
  const crest = seed % 5;
  if (primary === "Dragon" || primary === "Dark" || primary === "Steel") {
    polygon(ctx, [[4,6],[3,2],[6,4],[7,7]], accent, INK, 0.65);
    polygon(ctx, [[10,6],[12,2],[12,5],[11,7]], light, INK, 0.65);
    if (crest % 2 === 0) polygon(ctx, [[7,5],[8,1],[9,5]], pale, INK, 0.55);
  } else if (primary === "Flying" || primary === "Bug") {
    polygon(ctx, [[4,9],[0,4],[1,9],[4,12]], light, INK, 0.65);
    polygon(ctx, [[12,9],[16,4],[15,9],[12,12]], accent, INK, 0.65);
    for (let k=0;k<3;k++){ctx.strokeStyle=dark;ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(2+k,6+k*.6);ctx.lineTo(4,10);ctx.moveTo(14-k,6+k*.6);ctx.lineTo(12,10);ctx.stroke();}
  } else if (primary === "Rock" || primary === "Ground") {
    polygon(ctx, [[4,8],[3,4],[5,5],[6,8]], dark, INK, .6);
    polygon(ctx, [[8,8],[9,3],[11,6],[10,9]], accent, INK, .6);
    polygon(ctx, [[5,10],[7,8],[9,10],[8,12],[6,12]], light, INK, .45);
  } else if (primary === "Grass" || primary === "Poison") {
    polygon(ctx, [[4,7],[2,2],[6,5],[7,8]], accent, INK, .55);
    polygon(ctx, [[9,7],[13,2],[12,7],[10,9]], light, INK, .55);
    ctx.strokeStyle=dark;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(5,5);ctx.lineTo(6,7);ctx.moveTo(11,5);ctx.lineTo(10,7);ctx.stroke();
  }
  // Pixel contour highlights create a hand-shaded, collectible sprite finish.
  ctx.fillStyle = pale;
  ctx.fillRect(5,9,.7,.7);ctx.fillRect(7,8,.7,.7);ctx.fillRect(9,9,.7,.7);
  if (species.rarity === "legendary") {
    polygon(ctx, [[1,13],[2,11],[3,13]], "#fff0a6", "#a87935", .35);
    polygon(ctx, [[13,13],[14,11],[15,13]], "#fff0a6", "#a87935", .35);
    ctx.fillStyle="#fff6c8";ctx.fillRect(7,3,1,1);ctx.fillRect(9,4,1,1);
  } else if (species.rarity === "rare") {
    ctx.fillStyle="#e7f4ff";ctx.fillRect(2,12,1,1);ctx.fillRect(14,10,1,1);
  }

  if (view === "front") {
    // Two large dark eyes, tiny glints and a cheerful muzzle.
    ctx.fillStyle = INK;
    ctx.fillRect(headX - 1.55, 5.7, 1, 1.45);
    ctx.fillRect(headX + 0.65, 5.7, 1, 1.45);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(headX - 1.3, 5.8, 0.45, 0.45);
    ctx.fillRect(headX + 0.9, 5.8, 0.45, 0.45);
    ctx.fillStyle = dark;
    ctx.fillRect(headX - 0.35, 7.1, 0.7, 0.45);
    if (seed % 2 === 0) {
      ctx.fillStyle = "#f7b1a6";
      ctx.fillRect(headX - 2.2, 7, 0.65, 0.55);
      ctx.fillRect(headX + 1.7, 7, 0.65, 0.55);
    }
  } else {
    ellipse(ctx, 8, 7, 2.2, 1.5, dark, "", 0);
    polygon(ctx, [[6, 8], [8, 9], [10, 8]], accent, "", 0);
  }

  // Species silhouette pass: deterministic morphology rather than recolouring
  // one template. Each dex entry receives its own crest/appendage combination.
  const morph = (seed >>> 5) % 8;
  const bodyWide = species.base.def + species.base.hp > species.base.spe + species.base.spa;
  if (morph === 0) {
    // Broad aquatic fins and a layered dorsal sail.
    polygon(ctx, [[3,8],[0,5],[1,10],[4,12]], accent, INK, .65);
    polygon(ctx, [[11,8],[15,4],[14,10],[12,12]], light, INK, .65);
    polygon(ctx, [[6,7],[8,3],[10,7],[9,9]], accent, INK, .6);
    ctx.strokeStyle=dark;ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(2,7);ctx.lineTo(4,10);ctx.moveTo(13,7);ctx.lineTo(11,10);ctx.stroke();
  } else if (morph === 1) {
    // Long-eared agile form with a forked, expressive tail.
    polygon(ctx, [[5,6],[3,0],[7,4],[8,7]], accent, INK, .6);
    polygon(ctx, [[10,6],[13,0],[12,5],[11,7]], light, INK, .6);
    polygon(ctx, [[11,11],[15,8],[14,12],[16,13],[12,13]], accent, INK, .55);
    ctx.fillStyle=pale;ctx.fillRect(4,2,1,2);ctx.fillRect(12,2,1,2);
  } else if (morph === 2) {
    // Armoured quadruped: segmented shell plates and shoulder guards.
    polygon(ctx, [[3,8],[5,6],[8,6],[11,7],[13,10],[11,13],[5,13]], dark, INK, .7);
    polygon(ctx, [[5,7],[8,6],[10,8],[8,10],[5,9]], light, INK, .45);
    polygon(ctx, [[10,8],[12,7],[14,9],[12,11]], accent, INK, .45);
    polygon(ctx, [[4,9],[2,7],[3,11],[5,12]], accent, INK, .55);
  } else if (morph === 3) {
    // Four-point wing silhouette with feather / membrane struts.
    polygon(ctx, [[5,9],[0,3],[2,10],[5,13]], dark, INK, .7);
    polygon(ctx, [[5,9],[2,5],[4,11]], light, INK, .4);
    polygon(ctx, [[11,9],[16,3],[14,10],[11,13]], accent, INK, .7);
    polygon(ctx, [[11,9],[14,5],[12,11]], pale, INK, .4);
    ctx.strokeStyle=dark;ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(3,5);ctx.lineTo(5,11);ctx.moveTo(13,5);ctx.lineTo(11,11);ctx.stroke();
  } else if (morph === 4) {
    // Heavy horned guardian with layered brow and dorsal spikes.
    polygon(ctx, [[4,7],[2,2],[6,5],[7,8]], pale, INK, .65);
    polygon(ctx, [[10,7],[14,2],[12,7]], accent, INK, .65);
    for(let k=0;k<3;k++) polygon(ctx, [[5+k*2,8],[6+k*2,5],[7+k*2,8]], light, INK, .45);
    if(bodyWide) polygon(ctx, [[3,10],[1,8],[2,12],[5,13]], accent, INK, .5);
  } else if (morph === 5) {
    // Botanical / insect forms with leaf mantle and fine antennae.
    polygon(ctx, [[4,9],[1,5],[5,6],[7,9]], accent, INK, .55);
    polygon(ctx, [[9,9],[14,5],[12,9],[10,11]], light, INK, .55);
    ctx.strokeStyle=dark;ctx.lineWidth=.5;ctx.beginPath();ctx.moveTo(6,6);ctx.lineTo(5,2);ctx.moveTo(10,6);ctx.lineTo(12,2);ctx.stroke();
    ellipse(ctx,5,11,1.5,1.1,pale,INK,.35);ellipse(ctx,11,11,1.5,1.1,light,INK,.35);
  } else if (morph === 6) {
    // Mystic / spectral body: floating wisps and a rune halo.
    ellipse(ctx,3,8,1.5,2.2,accent,"",0);ellipse(ctx,13,6,1.4,2.4,light,"",0);
    polygon(ctx, [[5,4],[8,1],[11,4],[10,6],[6,6]], pale, INK, .5);
    ctx.strokeStyle=accent;ctx.lineWidth=.55;ctx.beginPath();ctx.arc(8,9,6.5,Math.PI*.15,Math.PI*.85);ctx.stroke();
    ctx.fillStyle="#ffffff";ctx.fillRect(3,6,1,1);ctx.fillRect(13,9,1,1);
  } else {
    // Serpentine / draconic form with curled tail, segmented scales and twin horns.
    ctx.strokeStyle=INK;ctx.lineWidth=2.1;ctx.beginPath();ctx.moveTo(9,11);ctx.bezierCurveTo(15,13,15,7,12,8);ctx.stroke();
    ctx.strokeStyle=accent;ctx.lineWidth=1.1;ctx.beginPath();ctx.moveTo(9,11);ctx.bezierCurveTo(15,13,15,7,12,8);ctx.stroke();
    polygon(ctx, [[5,6],[4,2],[7,4],[8,7]], light, INK, .55);
    polygon(ctx, [[10,6],[12,2],[12,6]], accent, INK, .55);
    for(let k=0;k<4;k++){ctx.fillStyle=pale;ctx.fillRect(5+k*2,10+(k%2),.7,.7);}
  }

  // Small material highlights: polished shell facets, wet glints and eye shine.
  if (primary === "Water" || secondary === "Water") {
    ctx.fillStyle="#f4ffff";ctx.fillRect(4,8,.8,.8);ctx.fillRect(12,10,.8,.8);
  } else if (primary === "Steel" || primary === "Rock") {
    ctx.fillStyle="#f5f5e8";ctx.fillRect(5,8,1,1);ctx.fillRect(10,10,1,1);
    ctx.strokeStyle=pale;ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(5,9);ctx.lineTo(8,7);ctx.lineTo(11,9);ctx.stroke();
  } else if (primary === "Fire" || primary === "Electric") {
    ctx.fillStyle="#fff5b8";ctx.fillRect(4,9,1,1);ctx.fillRect(11,8,1,1);
  }

  // A tiny collar crystal distinguishes a bonded companion from a wild one.
  polygon(ctx, [[8, 12.5], [9, 13.2], [8, 14], [7, 13.2]], pale, "#52606a", 0.35);
  ctx.restore();
  return canvas;
}

const dataUrls = new Map<string, string>();

export function petSpriteDataUrl(speciesId: string) {
  const id = getSpecies(speciesId).id;
  const cached = dataUrls.get(id);
  if (cached) return cached;
  const url = createPetSpriteCanvas(id, "front").toDataURL("image/png");
  dataUrls.set(id, url);
  return url;
}
