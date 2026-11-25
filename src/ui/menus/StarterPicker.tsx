import { useState } from "react";
import { session } from "../../game/core/GameSession";
import { getSpecies } from "../../game/data/species";
import { useGameStore } from "../../state/gameStore";
import { Sprite, TypeChip, Window, cursor } from "./common";
import { useMenuNav } from "./useMenuNav";

const STARTERS = ["bulbasaur", "charmander", "squirtle"];
const BLURB: Record<string, string> = {
  bulbasaur: "Hệ Cỏ/Độc. Bền bỉ, giỏi khống chế và làm suy yếu đối thủ.",
  charmander: "Hệ Lửa. Tốc độ cao, dồn sát thương mạnh nhưng cần cẩn trọng trước hệ Đá.",
  squirtle: "Hệ Nước. Bền bỉ, phòng thủ tốt và khắc chế các đối thủ hệ Đá, Lửa.",
};

export function StarterPicker() {
  const { close } = useGameStore.getState();
  const [confirm, setConfirm] = useState<string | null>(null);
  const [index, setIndex] = useMenuNav(3, (i) => setConfirm(STARTERS[i]), () => {}, 3, confirm === null);
  return <div className="px-fullscreen px-starter">
    <div className="px-starter-title">Chọn người bạn đồng hành đầu tiên!</div>
    <div className="px-starter-row">
      {STARTERS.map((id, i) => {
        const sp = getSpecies(id);
        return <button key={id} className={`px-starter-card ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => setConfirm(id)}>
          <Sprite speciesId={id} size={112} />
          <b>{sp.name}</b>
          <div className="px-types">{sp.types.map((t) => <TypeChip key={t} type={t} />)}</div>
          <p>{BLURB[id]}</p>
        </button>;
      })}
    </div>
    {confirm && <Confirm id={confirm} onYes={() => { session.giveStarter(confirm); close(); }} onNo={() => setConfirm(null)} />}
  </div>;
}

function Confirm({ id, onYes, onNo }: { id: string; onYes: () => void; onNo: () => void }) {
  const [index, setIndex] = useMenuNav(2, (i) => (i === 0 ? onYes() : onNo()), onNo);
  return <Window className="px-popup" title={`Chọn ${getSpecies(id).name}?`}>
    {["CÓ", "KHÔNG"].map((l, i) => <button key={l} className={`px-row ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => (i === 0 ? onYes() : onNo())}>
      <span className="px-cur">{cursor(i === index)}</span>{l}</button>)}
  </Window>;
}
