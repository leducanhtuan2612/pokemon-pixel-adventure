import { useState } from "react";
import { session } from "../../game/core/GameSession";
import { calcStats, displayName, expForLevel, type PokemonInstance } from "../../game/core/linh thú";
import { getMove } from "../../game/data/moves";
import { getSpecies } from "../../game/data/species";
import { categoryOf } from "../../game/data/types";
import { useGameStore } from "../../state/gameStore";
import { HpBar, Sprite, StatusTag, TypeChip, Window, cursor } from "./common";
import { useMenuNav } from "./useMenuNav";

type Mode = { kind: "list" } | { kind: "actions"; i: number } | { kind: "summary"; i: number } | { kind: "swap"; from: number };

export function PartyPanel() {
  useGameStore((s) => s.version);
  const { open, notify } = useGameStore.getState();
  const party = session.party;
  const [mode, setMode] = useState<Mode>({ kind: "list" });

  const [index, setIndex] = useMenuNav(party.length, (i) => {
    if (mode.kind === "swap") { session.swapParty(mode.from, i); setMode({ kind: "list" }); return; }
    setMode({ kind: "actions", i });
  }, () => (mode.kind === "swap" ? setMode({ kind: "list" }) : open("menu")), 2, mode.kind === "list" || mode.kind === "swap");

  return <div className="px-fullscreen px-party">
    <div className="px-party-grid">
      {party.map((mon, i) => <button key={mon.uid}
        className={`px-card ${i === index ? "on" : ""} ${mon.hp <= 0 ? "fainted" : ""} ${mode.kind === "swap" && mode.from === i ? "swap" : ""}`}
        onMouseEnter={() => setIndex(i)} onClick={() => (mode.kind === "swap" ? (session.swapParty(mode.from, i), setMode({ kind: "list" })) : setMode({ kind: "actions", i }))}>
        <Sprite speciesId={mon.speciesId} size={48} />
        <div className="px-card-info">
          <div className="px-card-top"><b>{displayName(mon)}</b><span>Lv{mon.level}</span></div>
          <HpBar mon={mon} />
          <StatusTag mon={mon} />
        </div>
      </button>)}
    </div>
    <div className="px-party-hint">
      {mode.kind === "swap" ? `Chọn vị trí để đổi với ${displayName(party[mode.from])}.` : "Chọn một linh thú. linh thú đầu tiên sẽ ra trận trước. (ESC: quay lại)"}
    </div>
    {mode.kind === "actions" && <PartyActions mon={party[mode.i]} onPick={(a) => {
      const i = mode.i;
      if (a === "summary") setMode({ kind: "summary", i });
      else if (a === "swap") setMode({ kind: "swap", from: i });
      else if (a === "deposit") { notify(session.deposit(i) ? "Đã gửi vào Kho linh thú." : "Phải giữ lại ít nhất 1 linh thú!"); setMode({ kind: "list" }); }
      else setMode({ kind: "list" });
    }} />}
    {mode.kind === "summary" && <Summary start={mode.i} onBack={() => setMode({ kind: "list" })} />}
  </div>;
}

function PartyActions({ mon, onPick }: { mon: PokemonInstance; onPick: (a: "summary" | "swap" | "deposit" | "cancel") => void }) {
  const actions = [["summary", "THÔNG TIN"], ["swap", "ĐỔI VỊ TRÍ"], ["deposit", "GỬI VÀO PC"], ["cancel", "HỦY"]] as const;
  const [index, setIndex] = useMenuNav(actions.length, (i) => onPick(actions[i][0]), () => onPick("cancel"));
  return <Window className="px-popup" title={displayName(mon)}>
    {actions.map(([id, label], i) => <button key={id} className={`px-row ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => onPick(id)}>
      <span className="px-cur">{cursor(i === index)}</span>{label}</button>)}
  </Window>;
}

export function Summary({ start, onBack, list }: { start: number; onBack: () => void; list?: PokemonInstance[] }) {
  const mons = list ?? session.party;
  const [i] = useMenuNav(mons.length, () => {}, onBack, 1, true, start);
  const mon = mons[Math.min(i, mons.length - 1)] ?? mons[start];
  if (!mon) return null;
  const sp = getSpecies(mon.speciesId), st = calcStats(mon);
  const next = expForLevel(sp.growth, mon.level + 1) - mon.exp;
  const stats: [string, number][] = [["HP", st.hp], ["Tấn công", st.atk], ["Phòng thủ", st.def], ["T.công Đ.biệt", st.spa], ["P.thủ Đ.biệt", st.spd], ["Tốc độ", st.spe]];
  return <div className="px-fullscreen px-summary">
    <div className="px-summary-left">
      <div className="px-summary-head"><b>No.{String(sp.dex).padStart(3, "0")} {displayName(mon)}</b><span>Lv{mon.level}</span></div>
      <Sprite speciesId={mon.speciesId} size={128} />
      <div className="px-types">{sp.types.map((t) => <TypeChip key={t} type={t} />)}</div>
      <HpBar mon={mon} />
      <div className="px-small">EXP: {mon.exp.toLocaleString()} · Còn {Math.max(0, next).toLocaleString()} để lên cấp</div>
      <div className="px-small px-entry">{sp.dexEntry}</div>
    </div>
    <div className="px-summary-right">
      <div className="px-section">CHỈ SỐ</div>
      <table className="px-stats"><tbody>{stats.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
      <div className="px-section">CHIÊU THỨC</div>
      {mon.moves.map((m) => {
        const d = getMove(m.id);
        return <div key={m.id} className="px-move">
          <TypeChip type={d.type} />
          <b>{d.name}</b>
          <span className="px-small">{d.power ? `${categoryOf(d.type) === "physical" ? "Vật lý" : "Đặc biệt"} · ${d.power} · ${d.accuracy ?? "—"}%` : "Trạng thái"}</span>
          <span className="px-pp">PP {m.pp}/{m.maxPp}</span>
          <div className="px-small px-move-desc">{d.desc}</div>
        </div>;
      })}
    </div>
    <div className="px-party-hint">↑↓ đổi linh thú · ESC quay lại</div>
  </div>;
}

export function BoxPanel() {
  useGameStore((s) => s.version);
  const { open, notify } = useGameStore.getState();
  const box = session.data.box;
  const [summary, setSummary] = useState<number | null>(null);
  const [index, setIndex] = useMenuNav(box.length, (i) => {
    if (session.withdraw(i)) notify(`Đã rút ${displayName(box[i] ?? session.party[session.party.length - 1])} vào đội.`);
    else notify("Đội đã đủ 6 linh thú!");
  }, () => open("menu"), 4, summary === null);
  return <div className="px-fullscreen px-box">
    <div className="px-box-head">KHO LINH THÚ — {box.length} linh thú <span>Enter: rút về đội · ESC: quay lại</span></div>
    {!box.length && <div className="px-empty">PC Box trống. linh thú bắt được khi đội đầy sẽ được gửi vào đây.</div>}
    <div className="px-box-grid">
      {box.map((mon, i) => <button key={mon.uid} className={`px-box-cell ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)}
        onClick={() => setSummary(i)}>
        <Sprite speciesId={mon.speciesId} size={40} /><span>{displayName(mon)}</span><small>Lv{mon.level}</small>
      </button>)}
    </div>
    {summary !== null && <Summary start={summary} list={box} onBack={() => setSummary(null)} />}
  </div>;
}
