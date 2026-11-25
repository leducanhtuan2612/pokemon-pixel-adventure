import { session } from "../../game/core/GameSession";
import { useGameStore, type Panel } from "../../state/gameStore";
import { Window, cursor } from "./common";
import { useMenuNav } from "./useMenuNav";

export function StartMenu() {
  const { open, close, notify } = useGameStore.getState();
  useGameStore((s) => s.version);
  const hasParty = session.party.length > 0;
  const items: { label: string; action: () => void }[] = [
    { label: "POKéDEX", action: () => open("dex") },
    ...(hasParty ? [{ label: "POKéMON", action: () => open("party") }] : []),
    { label: "TÚI ĐỒ", action: () => open("bag") },
    { label: "ĐỔI MÃ QUÀ", action: () => open("redeem") },
    ...(session.data.flags.includes("unlock:move-lab") ? [{ label: "MOVE LAB · TEST CHIÊU", action: () => open("moveLab") }] : []),
    ...(hasParty ? [{ label: "PC BOX", action: () => open("box" as Panel) }] : []),
    { label: "ĐỔI MÃ QUÀ", action: () => open("redeem") },
    ...(session.hasFlag("unlock:move-lab") ? [{ label: "MOVE LAB · TEST CHIÊU", action: () => open("moveLab") }] : []),
    { label: "LƯU GAME", action: () => { session.changed(); notify("Đã lưu tiến trình!"); close(); } },
    { label: "ĐÓNG", action: close },
  ];
  const [index, setIndex] = useMenuNav(items.length, (i) => items[i].action(), close);
  return <Window className="px-start" hint="ESC: đóng">
    {items.map((it, i) => <button key={it.label} className={`px-row ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)} onClick={it.action}>
      <span className="px-cur">{cursor(i === index)}</span>{it.label}
    </button>)}
    <div className="px-money">₽{session.data.money.toLocaleString("vi-VN")}</div>
  </Window>;
}
