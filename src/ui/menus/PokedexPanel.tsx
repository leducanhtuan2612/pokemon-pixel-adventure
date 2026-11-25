import { session } from "../../game/core/GameSession";
import { SPECIES_LIST } from "../../game/data/species";
import { useGameStore } from "../../state/gameStore";
import { Sprite, TypeChip, cursor } from "./common";
import { useMenuNav } from "./useMenuNav";

export function PokedexPanel() {
  useGameStore((s) => s.version);
  const { open } = useGameStore.getState();
  const list = [...SPECIES_LIST].sort((a, b) => a.dex - b.dex);
  const { seen, caught } = session.data.dex;
  const [index, setIndex] = useMenuNav(list.length, () => {}, () => open("menu"));
  const sel = list[index];
  const isSeen = seen.includes(sel.dex), isCaught = caught.includes(sel.dex);
  return <div className="px-fullscreen px-dex">
    <div className="px-dex-left">
      <div className="px-dex-count">ĐÃ THẤY {seen.length} · ĐÃ BẮT {caught.length} / {list.length}</div>
      <div className="px-dex-art">{isSeen ? <Sprite speciesId={sel.id} size={128} silhouette={!isCaught} /> : <div className="px-unknown">?</div>}</div>
      <div className="px-dex-name">No.{String(sel.dex).padStart(3, "0")} {isSeen ? sel.name : "?????"}</div>
      {isCaught ? <>
        <div className="px-types">{sel.types.map((t) => <TypeChip key={t} type={t} />)}</div>
        <p className="px-entry">{sel.dexEntry}</p>
      </> : <p className="px-entry">{isSeen ? "Hãy bắt Pokémon này để xem thêm thông tin." : "Chưa gặp Pokémon này."}</p>}
    </div>
    <div className="px-dex-list" ref={(el) => el?.querySelector(".on")?.scrollIntoView({ block: "nearest" })}>
      {list.map((sp, i) => <button key={sp.id} className={`px-row ${i === index ? "on" : ""}`} onMouseEnter={() => setIndex(i)}>
        <span className="px-cur">{cursor(i === index)}</span>
        <span className="px-dexno">{String(sp.dex).padStart(3, "0")}</span>
        <span className="px-grow">{seen.includes(sp.dex) ? sp.name : "----------"}</span>
        {caught.includes(sp.dex) && <span className="px-caught">●</span>}
      </button>)}
    </div>
  </div>;
}
