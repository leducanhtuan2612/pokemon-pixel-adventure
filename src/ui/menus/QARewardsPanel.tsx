import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { session } from "../../game/core/GameSession";
import { displayName } from "../../game/core/pokemon";
import { MOVES, getMove } from "../../game/data/moves";
import { getSpecies } from "../../game/data/species";
import { categoryOf, TYPE_VI } from "../../game/data/types";
import { useGameStore } from "../../state/gameStore";
import { Sprite, TypeChip } from "./common";

function QaWindow({ title, children }: { title: string; children: ReactNode }) {
  const close = useGameStore((s) => s.close);
  return <section className="px-qa">
    <header className="px-qa-head"><span>{title}</span><button onClick={close}>ĐÓNG ✕</button></header>
    <div className="px-qa-body">{children}</div>
  </section>;
}

export function RedeemPanel() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);
  const redeem = (value = code) => {
    const r = session.redeemCode(value);
    setResult(r);
    if (r.ok) setCode(value.trim().toUpperCase());
  };
  return <QaWindow title="GREENLEAF · GIFT REDEMPTION">
    <p className="qa-note">Mã quà thử nghiệm dành riêng cho Map 1. Mỗi mã chỉ đổi một lần trên save hiện tại. Pokémon sẽ vào đội hoặc PC Box nếu đội đã đủ 6.</p>
    <div className="qa-row">
      <input aria-label="Mã đổi quà" placeholder="NHẬP MÃ ĐỔI QUÀ…" value={code} onChange={(e) => setCode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && redeem()} />
      <button className="primary" onClick={() => redeem()}>ĐỔI MÃ</button>
    </div>
    <div className="qa-row">
      <button onClick={() => {setCode("MAP1-ALL-POKEMON");redeem("MAP1-ALL-POKEMON");}}>MAP1-ALL-POKEMON</button>
      <button onClick={() => {setCode("MAP1-MOVE-LAB");redeem("MAP1-MOVE-LAB");}}>MAP1-MOVE-LAB</button>
    </div>
    {result && <div className={`qa-result ${result.ok ? "" : "error"}`}>{result.message}</div>}
    <p className="qa-note"><b>MAP1-ALL-POKEMON:</b> bộ Pokémon thử nghiệm cấp 30, Poké Ball/Great Ball/Ultra Ball, thuốc và tiền. <br/><b>MAP1-MOVE-LAB:</b> mở phòng gắn chiêu thử nghiệm, nâng Pokémon đội hiện tại lên tối thiểu cấp 30.</p>
  </QaWindow>;
}

export function MoveLabPanel() {
  useGameStore((s) => s.version);
  const [partyIndex, setPartyIndex] = useState(0);
  const [slotIndex, setSlotIndex] = useState(0);
  const [query, setQuery] = useState("");
  const [selectedMove, setSelectedMove] = useState("thunderbolt");
  const [message, setMessage] = useState("");
  const party = session.data.party;
  const mon = party[partyIndex];
  const filtered = useMemo(() => Object.values(MOVES).filter((m) => {
    const q = query.trim().toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.id.includes(q) || TYPE_VI[m.type].toLowerCase().includes(q);
  }).slice(0, 60), [query]);
  const move = getMove(selectedMove);
  const apply = () => {
    const r = session.assignTestMove(partyIndex, selectedMove, slotIndex);
    setMessage(r.message);
  };
  return <QaWindow title="MAP 1 · MOVE LAB / QA">
    {!session.data.flags.includes("unlock:move-lab") ? <div className="qa-result error">Chưa mở phòng thử chiêu. Đổi mã MAP1-MOVE-LAB trước.</div> : <>
      <p className="qa-note">Phòng thử nghiệm cho phép gắn bất kỳ chiêu nào trong registry hiện tại (Gen 3, 274 chiêu) vào 1 trong 4 ô của Pokémon. Đây là công cụ QA, không tuân theo learnset.</p>
      {!party.length ? <div className="qa-result error">Chưa có Pokémon trong đội. Đổi mã MAP1-ALL-POKEMON để nhận bộ test.</div> : <>
        <div className="qa-row">
          <select aria-label="Chọn Pokémon" value={partyIndex} onChange={(e) => setPartyIndex(Number(e.target.value))}>
            {party.map((p, i) => <option key={p.uid} value={i}>{i + 1}. {displayName(p)} · Lv{p.level}</option>)}
          </select>
          <select aria-label="Chọn ô chiêu" value={slotIndex} onChange={(e) => setSlotIndex(Number(e.target.value))}>
            {[0,1,2,3].map((i) => <option key={i} value={i}>Ô chiêu {i + 1}</option>)}
          </select>
        </div>
        {mon && <div className="qa-row" style={{alignItems:"center"}}>
          <Sprite speciesId={mon.speciesId} size={64}/>
          <div><b>{getSpecies(mon.speciesId).name}</b><div className="qa-note">Chiêu đang chọn: {mon.moves[slotIndex] ? getMove(mon.moves[slotIndex].id).name : "Trống"}</div></div>
        </div>}
        <input aria-label="Tìm chiêu thức" placeholder="Tìm theo tên, ID hoặc hệ…" value={query} onChange={(e) => setQuery(e.target.value)}/>
        <div className="qa-moves">
          {filtered.map((m) => <button key={m.id} className={selectedMove === m.id ? "qa-move qa-selected" : "qa-move"} onClick={() => setSelectedMove(m.id)}>
            <span><b>{m.name}</b><small><br/>{TYPE_VI[m.type]} · {m.power ? (categoryOf(m.type) === "physical" ? "Vật lý" : "Đặc biệt") + " " + m.power : "Trạng thái"}</small></span><span>PP {m.pp}</span>
          </button>)}
        </div>
        <div className="qa-result"><TypeChip type={move.type}/><b> {move.name}</b> · {move.accuracy ?? "—"}% chính xác<br/>{move.desc}</div>
        <button className="primary" onClick={apply}>GẮN CHIÊU VÀO Ô {slotIndex + 1}</button>
        {message && <div className="qa-result">{message}</div>}
      </>}
    </>}
  </QaWindow>;
}
