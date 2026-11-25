import { useState } from "react";
import { session } from "../../game/core/GameSession";
import { ITEMS, MART_STOCK } from "../../game/data/items";
import { useGameStore } from "../../state/gameStore";
import { Window, cursor } from "./common";
import { useMenuNav } from "./useMenuNav";

export function MartPanel() {
  useGameStore((s) => s.version);
  const { close, notify } = useGameStore.getState();
  const [buying, setBuying] = useState<string | null>(null);
  const [index, setIndex] = useMenuNav(MART_STOCK.length + 1, (i) => (i === MART_STOCK.length ? close() : setBuying(MART_STOCK[i])), close, 1, buying === null);
  const sel = ITEMS[MART_STOCK[index]];
  return <div className="px-fullscreen px-mart">
    <Window className="px-mart-list" title="POKé MART" hint="Enter: mua · ESC: rời cửa hàng">
      {MART_STOCK.map((id, i) => <button key={id} className={`px-row ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={() => setBuying(id)}>
        <span className="px-cur">{cursor(i === index)}</span>{ITEMS[id].name}<span className="px-qty">₽{ITEMS[id].price}</span>
      </button>)}
      <button className={`px-row ${index === MART_STOCK.length ? "on" : ""}`} onMouseEnter={() => setIndex(MART_STOCK.length)} onClick={close}>
        <span className="px-cur">{cursor(index === MART_STOCK.length)}</span>THOÁT</button>
    </Window>
    <div className="px-mart-side">
      <div className="px-money big">₽{session.data.money.toLocaleString("vi-VN")}</div>
      <div className="px-bag-desc">{sel ? `${sel.desc}\nĐang có: ${session.count(sel.id)}` : "Cảm ơn quý khách!"}</div>
    </div>
    {buying && <Quantity itemId={buying} onDone={(msg) => { if (msg) notify(msg); setBuying(null); }} />}
  </div>;
}

function Quantity({ itemId, onDone }: { itemId: string; onDone: (msg?: string) => void }) {
  const item = ITEMS[itemId];
  const max = Math.max(1, Math.min(99, Math.floor(session.data.money / item.price)));
  const [qty, setQty] = useState(1);
  useMenuNav(1, () => onDone(session.buy(itemId, qty)), () => onDone());
  return <Window className="px-popup px-qtybox" title={item.name} hint="↑↓ số lượng · Enter mua · ESC hủy">
    <div className="px-qtyrow" onWheel={(e) => setQty((q) => Math.max(1, Math.min(max, q + (e.deltaY < 0 ? 1 : -1))))}
      tabIndex={-1} ref={(el) => el?.focus()}
      onKeyDown={(e) => {
        if (e.key === "ArrowUp") setQty((q) => Math.min(max, q + 1));
        if (e.key === "ArrowDown") setQty((q) => Math.max(1, q - 1));
        if (e.key === "ArrowRight") setQty((q) => Math.min(max, q + 10));
        if (e.key === "ArrowLeft") setQty((q) => Math.max(1, q - 10));
      }}>
      <button onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button><b>×{String(qty).padStart(2, "0")}</b><button onClick={() => setQty((q) => Math.min(max, q + 1))}>+</button>
      <span>₽{(item.price * qty).toLocaleString("vi-VN")}</span>
    </div>
    <button className="px-row on" onClick={() => onDone(session.buy(itemId, qty))}><span className="px-cur">▶</span>MUA</button>
  </Window>;
}
