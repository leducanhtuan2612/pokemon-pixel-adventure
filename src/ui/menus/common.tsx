import type { ReactNode } from "react";
import { spriteUrl } from "../../game/battle/sprites";
import { getSpecies } from "../../game/data/species";
import { TYPE_COLORS, TYPE_VI, type PokemonType } from "../../game/data/types";
import { STATUS_COLOR, STATUS_LABEL, maxHp, type PokemonInstance } from "../../game/core/pokemon";

export function Window({ title, children, className = "", hint }: { title?: string; children: ReactNode; className?: string; hint?: string }) {
  return <div className={`px-window ${className}`}>
    {title && <div className="px-title">{title}</div>}
    <div className="px-body">{children}</div>
    {hint && <div className="px-hint">{hint}</div>}
  </div>;
}

export function Sprite({ speciesId, size = 48, silhouette = false }: { speciesId: string; size?: number; silhouette?: boolean }) {
  const url = spriteUrl(speciesId);
  if (!url) return <div className="px-sprite px-sprite-missing" style={{ width: size, height: size }}>?</div>;
  return <img className={`px-sprite ${silhouette ? "px-silhouette" : ""}`} src={url} width={size} height={size} alt={getSpecies(speciesId).name} />;
}

export function TypeChip({ type }: { type: PokemonType }) {
  return <span className="px-type" style={{ background: TYPE_COLORS[type] }}>{TYPE_VI[type]}</span>;
}

export function HpBar({ mon }: { mon: PokemonInstance }) {
  const max = maxHp(mon), f = Math.min(1, Math.max(0, mon.hp / max));
  const color = f > 0.5 ? "#58d080" : f > 0.2 ? "#f8c030" : "#f05858";
  return <div className="px-hp"><b>HP</b><div className="px-hp-track"><div style={{ width: `${f * 100}%`, background: color }} /></div><span>{mon.hp}/{max}</span></div>;
}

export function StatusTag({ mon }: { mon: PokemonInstance }) {
  if (!mon.status) return null;
  return <span className="px-status" style={{ background: STATUS_COLOR[mon.status] }}>{STATUS_LABEL[mon.status]}</span>;
}

export const cursor = (on: boolean) => (on ? "▶" : " ");
