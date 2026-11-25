import { useMemo, useState } from "react";
import { session } from "../../game/core/GameSession";
import { displayName } from "../../game/core/pokemon";
import { MOVES, getMove } from "../../game/data/moves";
import { getSpecies } from "../../game/data/species";
import { TYPE_COLORS, TYPE_VI } from "../../game/data/types";
import { useGameStore } from "../../state/gameStore";
import { Sprite, Window } from "./common";

export function MoveLabPanel() {
  useGameStore((s) => s.version);
  const { close, notify, open } = useGameStore.getState();
  const party = session.data.party;
  const [monIndex, setMonIndex] = useState(0);
  const [slotIndex, setSlotIndex] = useState(0);
  const [filter, setFilter] = useState("");
  const [moveId, setMoveId] = useState("thunderbolt");
  const mon = party[monIndex];
  const moves = useMemo(() => Object.values(MOVES).filter((m) => {
    const q = filter.trim().toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.id.includes(q) || TYPE_VI[m.type].toLowerCase().includes(q);
  }).sort((a,b) => a.name.localeCompare(b.name, "vi")), [filter]);
  const chosen = MOVES[moveId] ?? MOVES.tackle;
  const assign = () => {
    const result = session.assignTestMove(monIndex, moveId, slotIndex);
    notify(result.message);
  };
  return <div className="px-fullscreen px-movelab-screen">
    <Window title="WILD BARN · SKILL FORGE" className="px-movelab" hint="ESC: quay lại menu">
      <div className="px-lab-head"><span>MOVE LAB</span><b>{Object.keys(MOVES).length} MOVES · GEN III</b></div>
      {!party.length ? <div className="px-empty">Đội chưa có linh thú. Đổi mã WILDLANDS-TEST trước.</div> : <>
        <label className="px-lab-label">LINH THÚ ĐANG TEST</label>
        <select className="px-lab-select" value={monIndex} onChange={(e) => setMonIndex(Number(e.target.value))}>
          {party.map((p,i) => <option value={i} key={p.uid}>{displayName(p)} · Lv{p.level}</option>)}
        </select>
        {mon && <div className="px-lab-mon"><Sprite speciesId={mon.speciesId} size={72}/><div><b>{displayName(mon)}</b><small>{getSpecies(mon.speciesId).types.map(t=>TYPE_VI[t]).join(" / ")} · Lv{mon.level}</small></div></div>}
        <div className="px-lab-slots">
          <label className="px-lab-label">Ô CHIÊU CẦN THAY</label>
          <select className="px-lab-select" value={slotIndex} onChange={(e) => setSlotIndex(Number(e.target.value))}>
            {[0,1,2,3].map(i=><option key={i} value={i}>Ô {i+1}: {mon?.moves[i] ? getMove(mon.moves[i].id).name : "(trống)"}</option>)}
          </select>
        </div>
        <label className="px-lab-label" htmlFor="move-search">TÌM CHIÊU · TÊN / ID / HỆ</label>
        <input id="move-search" className="px-lab-input" value={filter} onChange={(e)=>setFilter(e.target.value)} placeholder="Tìm Thunderbolt, thunderbolt, Điện..." />
        <div className="px-lab-list">
          {moves.map(m=><button key={m.id} className={moveId===m.id?"selected":""} onClick={()=>setMoveId(m.id)}>
            <span className="px-lab-type" style={{background:TYPE_COLORS[m.type]}}>{TYPE_VI[m.type]}</span>
            <b>{m.name}</b><small>{m.power ? `Sức mạnh ${m.power} · Chính xác ${m.accuracy ?? "—"}%` : "Chiêu trạng thái"} · PP {m.pp}</small>
          </button>)}
          {!moves.length && <div className="px-empty">Không tìm thấy chiêu.</div>}
        </div>
        <div className="px-lab-selected"><b>{chosen.name}</b><span>{TYPE_VI[chosen.type]} · {chosen.desc}</span></div>
        <button className="px-redeem-submit" onClick={assign}>GẮN CHIÊU VÀO Ô {slotIndex+1} <span>✓</span></button>
      </>}
      <button className="px-row px-redeem-back" onClick={()=>open("party")}>ĐỘI HÌNH / PC BOX</button>
      <button className="px-row px-redeem-back" onClick={close}>← QUAY LẠI</button>
    </Window>
  </div>;
}
