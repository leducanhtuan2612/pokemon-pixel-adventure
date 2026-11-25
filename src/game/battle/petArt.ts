import { getSpecies } from "../data/species";
import { TYPE_COLORS, type PokemonType } from "../data/types";

type SpriteView = "front" | "back";
type Point = readonly [number, number];

const INK = "#26333a";
const SUFFIXES = ["ling", "kin", "puff", "let", "wing", "mote", "bud", "fang", "shell", "bloom", "whisk", "scale", "crest", "glow", "tail", "sprout", "paw", "flit"] as const;

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
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  ctx.imageSmoothingEnabled = false;
  ctx.scale(2, 2);
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
