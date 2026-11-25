import { useState } from "react";
import { session } from "../../game/core/GameSession";
import { displayName, itemEvolution } from "../../game/core/pokemon";
import { ITEMS, type ItemCategory } from "../../game/data/items";
import { useGameStore } from "../../state/gameStore";
import { HpBar, Sprite, Window, cursor } from "./common";
import { useMenuNav } from "./useMenuNav";

const POCKETS: { id: ItemCategory[]; label: string }[] = [
  { id: ["medicine", "status"], label: "THUỐC" },
  { id: ["ball"], label: "PHA LÊ" },
  { id: ["evolution"], label: "ĐÁ TIẾN HÓA" },
];

export function BagPanel() {
  useGameStore((s) => s.version);
  const { open, notify } = useGameStore.getState();
  const [pocket, setPocket] = useState(0);
  const [target, setTarget] = useState<string | null>(null);
  const items = Object.keys(ITEMS).filter((id) => POCKETS[pocket].id.includes(ITEMS[id].category) && session.count(id) > 0);

  const [index, setIndex] = useMenuNav(items.length, (i) => {
    const item = ITEMS[items[i]];
    if (item.category === "ball") { notify("Dùng pha lê bằng lệnh KẾT NỐI trong trận đấu với Pokémon hoang dã."); return; }
    if (!session.party.length) { notify("Bạn chưa có Pokémon."); return; }
    setTarget(items[i]);
  }, () => open("menu"), 1, target === null);

  // ←/→ switch pockets
  const onKey = (e: React.KeyboardEvent) => {
    if (target) return;
    if (e.key === "ArrowLeft") setPocket((p) => (p + POCKETS.length - 1) % POCKETS.length);
    if (e.key === "ArrowRight") setPocket((p) => (p + 1) % POCKETS.length);
  };

  const sel = items[index] ? ITEMS[items[index]] : null;
  return <div className="px-fullscreen px-bag" tabIndex={-1} onKeyDown={onKey} ref={(el) => el?.focus()}>
    <div className="px-bag-side">
      <div className="px-pockets">
        <button onClick={() => setPocket((p) => (p + POCKETS.length - 1) % POCKETS.length)}>◀</button>
        <b>{POCKETS[pocket].label}</b>
        <button onClick={() => setPocket((p) => (p + 1) % POCKETS.length)}>▶</button>
      </div>
      <div className="px-bag-desc">{sel ? sel.desc : "Ngăn này trống."}</div>
      <div className="px-money">₽{session.data.money.toLocaleString("vi-VN")}</div>
    </div>
    <Window className="px-bag-list" hint="←→ đổi ngăn · Enter dùng · ESC quay lại">
      {items.map((id, i) => <button key={id} className={`px-row ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => setTarget(id)}>
        <span className="px-cur">{cursor(i === index)}</span>{ITEMS[id].name}<span className="px-qty">×{session.count(id)}</span>
      </button>)}
      {!items.length && <div className="px-empty">Không có vật phẩm.</div>}
    </Window>
    {target && <TargetPicker itemId={target} onDone={(msg) => { if (msg) notify(msg); setTarget(null); }} />}
  </div>;
}

function TargetPicker({ itemId, onDone }: { itemId: string; onDone: (msg?: string) => void }) {
  const party = session.party, item = ITEMS[itemId];
  const [index, setIndex] = useMenuNav(party.length, (i) => onDone(session.useItemOn(itemId, i).message), () => onDone());
  return <Window className="px-popup px-target" title={`Dùng ${item.name} cho…`} hint="ESC: hủy">
    {party.map((mon, i) => {
      const able = item.category === "evolution" ? !!itemEvolution(mon, itemId) : true;
      return <button key={mon.uid} className={`px-row ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => onDone(session.useItemOn(itemId, i).message)}>
        <span className="px-cur">{cursor(i === index)}</span><Sprite speciesId={mon.speciesId} size={28} />
        <span className="px-grow">{displayName(mon)} Lv{mon.level}</span>
        {item.category === "evolution" ? <span className="px-small">{able ? "CÓ THỂ" : "KHÔNG"}</span> : <HpBar mon={mon} />}
      </button>;
    })}
  </Window>;
}
