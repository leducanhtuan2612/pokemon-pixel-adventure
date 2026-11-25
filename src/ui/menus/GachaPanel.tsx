import { useState } from "react";
import { SPECIES_LIST, getSpecies } from "../../game/data/species";
import { createPokemon } from "../../game/core/pokemon";
import { session } from "../../game/core/GameSession";
import { Sprite, Window } from "./common";
import { useGameStore } from "../../state/gameStore";

const KEY = "ppa-gacha-v1";
type Save = { crystals: number; pity: number; history: string[] };
const RARITY_LABEL: Record<string, string> = {
  common: "Phổ thông", uncommon: "Tinh anh", rare: "Hiếm", legendary: "Huyền thoại",
};
function load(): Save {
  try {
    return { crystals: 600, pity: 0, history: [], ...JSON.parse(localStorage.getItem(KEY) || "{}") };
  } catch {
    return { crystals: 600, pity: 0, history: [] };
  }
}

export function GachaPanel() {
  const [save, setSave] = useState(load);
  const [results, setResults] = useState<string[]>([]);
  const close = useGameStore((s) => s.close);
  const notify = useGameStore((s) => s.notify);

  const summon = (count: number) => {
    if (save.crystals < count * 100) {
      notify("Không đủ Tinh Thạch — hãy vượt ải để kiếm thêm.");
      return;
    }
    let pity = save.pity;
    let crystals = save.crystals - count * 100;
    let hasRareOrBetter = false;
    const ids: string[] = [];

    for (let i = 0; i < count; i++) {
      const roll = Math.random();
      let rarity: string;
      if (pity >= 9 || roll < 0.01) {
        rarity = "legendary";
        pity = 0;
        hasRareOrBetter = true;
      } else {
        rarity = roll < 0.10 ? "rare" : roll < 0.35 ? "uncommon" : "common";
        pity++;
        if (rarity === "rare") hasRareOrBetter = true;
      }
      if (count === 10 && i === 9 && !hasRareOrBetter) { rarity = "rare"; hasRareOrBetter = true; }
      const pool = SPECIES_LIST.filter((pet) => pet.rarity === rarity);
      const pet = pool[Math.floor(Math.random() * pool.length)] || SPECIES_LIST[0];
      ids.push(pet.id);

      if (session.data.dex.caught.includes(pet.dex)) {
        crystals += rarity === "legendary" ? 300 : rarity === "rare" ? 120 : 40;
      } else {
        session.addPokemon(createPokemon(pet.id, Math.min(35, 8 + session.data.badges.length * 3)));
      }
    }

    const next = { crystals, pity, history: [...ids, ...save.history].slice(0, 15) };
    localStorage.setItem(KEY, JSON.stringify(next));
    setSave(next);
    setResults(ids);
    session.changed();
    notify(count === 10 ? "Triệu hồi ×10 xong: bảo đảm ít nhất 1 linh thú Hiếm hoặc Huyền thoại." : "Triệu hồi hoàn tất! Linh thú trùng đã đổi thành Tinh Thạch.");
  };

  return <Window title="✧ ĐIỆN THỜ TRIỆU HỒI · WILDLANDS" className="px-gacha" hint="ESC: quay lại">
    <div className="ppa-gacha-head">
      <b>✦ {save.crystals.toLocaleString("vi-VN")} TINH THẠCH</b>
      <p>{SPECIES_LIST.length} linh thú nguyên tố · 100 tinh thạch/lượt</p>
    </div>
    <div className="ppa-gacha-rates">
      <span>Huyền thoại <b>1%</b></span>
      <span>Hiếm <b>9%</b></span>
      <span>Tinh anh <b>25%</b></span>
      <span>Phổ thông <b>65%</b></span>
    </div>
    <p className="ppa-gacha-note">Bảo hiểm Huyền thoại: sau 9 lượt trượt, lượt kế tiếp chắc chắn trúng. Gacha ×10 bảo đảm ít nhất 1 linh thú Hiếm hoặc Huyền thoại. Linh thú trùng đổi Tinh Thạch. Bạn đồng hành mới sẽ vào đội hoặc kho linh thú.</p>
    <div className="ppa-gacha-actions">
      <button onClick={() => summon(1)}>TRIỆU HỒI ×1 <b>100 ✦</b></button>
      <button onClick={() => summon(10)}>TRIỆU HỒI ×10 <b>1.000 ✦</b></button>
    </div>
    {results.length > 0 && <div className="ppa-gacha-results">
      {results.map((id, i) => {
        const pet = getSpecies(id);
        return <article key={id + i} className={"rarity-" + pet.rarity}>
          <Sprite speciesId={id} size={72} />
          <b>{pet.name}</b>
          <small>{RARITY_LABEL[pet.rarity] ?? pet.rarity}</small>
        </article>;
      })}
    </div>}
    <div className="ppa-gacha-history">
      <b>LỊCH SỬ TRIỆU HỒI</b>
      <p>{save.history.slice(0, 8).map((id) => getSpecies(id).name).join(" · ") || "Chưa có lần triệu hồi nào"}</p>
    </div>
    <button className="ppa-gacha-close" onClick={close}>ĐÓNG</button>
  </Window>;
}
