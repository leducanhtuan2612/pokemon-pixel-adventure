export type ItemCategory = "ball" | "medicine" | "status" | "evolution";

export interface ItemData {
  id: string;
  name: string;
  category: ItemCategory;
  price: number;
  desc: string;
  /** Bond crystal strength multiplier (category "ball" kept for save compatibility). */
  ball?: number;
  heal?: number;
  /** Status cured; "all" cures any. */
  cures?: "psn" | "par" | "slp" | "brn" | "all";
}

const i = (d: ItemData) => d;

export const ITEMS: Record<string, ItemData> = Object.fromEntries([
  i({ id: "oran-berry", name: "Oran Berry", category: "medicine", price: 0, heal: 10, desc: "Quả mọng hồi 10 HP cho Pokémon." }),
  i({ id: "sitrus-berry", name: "Sitrus Berry", category: "medicine", price: 0, heal: 30, desc: "Quả mọng quý hồi 30 HP cho Pokémon." }),
  i({ id: "poke-ball", name: "Pha Lê Kết Nối", category: "ball", price: 200, ball: 1, desc: "Pha lê dùng lệnh KẾT NỐI để kết bạn với Pokémon hoang dã đã suy yếu." }),
  i({ id: "great-ball", name: "Pha Lê Lam", category: "ball", price: 600, ball: 1.5, desc: "Sức kết nối ×1.5 so với Pha Lê Kết Nối." }),
  i({ id: "ultra-ball", name: "Pha Lê Hoàng Kim", category: "ball", price: 1200, ball: 2, desc: "Sức kết nối ×2. Hiếm và rực sáng." }),
  i({ id: "potion", name: "Potion", category: "medicine", price: 300, heal: 20, desc: "Hồi 20 HP." }),
  i({ id: "super-potion", name: "Super Potion", category: "medicine", price: 700, heal: 50, desc: "Hồi 50 HP." }),
  i({ id: "hyper-potion", name: "Hyper Potion", category: "medicine", price: 1200, heal: 200, desc: "Hồi 200 HP." }),
  i({ id: "antidote", name: "Antidote", category: "status", price: 100, cures: "psn", desc: "Giải độc." }),
  i({ id: "paralyze-heal", name: "Paralyze Heal", category: "status", price: 200, cures: "par", desc: "Chữa tê liệt." }),
  i({ id: "awakening", name: "Awakening", category: "status", price: 250, cures: "slp", desc: "Đánh thức Pokémon." }),
  i({ id: "burn-heal", name: "Burn Heal", category: "status", price: 250, cures: "brn", desc: "Chữa bỏng." }),
  i({ id: "full-heal", name: "Full Heal", category: "status", price: 600, cures: "all", desc: "Chữa mọi trạng thái." }),
  i({ id: "fire-stone", name: "Fire Stone", category: "evolution", price: 2100, desc: "Đá tiến hóa cho một số Pokémon hệ Lửa." }),
  i({ id: "thunder-stone", name: "Thunder Stone", category: "evolution", price: 2100, desc: "Đá tiến hóa cho một số Pokémon hệ Điện." }),
  i({ id: "leaf-stone", name: "Leaf Stone", category: "evolution", price: 2100, desc: "Đá tiến hóa cho một số Pokémon hệ Cỏ." }),
].map((d) => [d.id, d]));

export const getItem = (id: string): ItemData | undefined => ITEMS[id];
export const MART_STOCK = ["poke-ball", "great-ball", "potion", "super-potion", "antidote", "paralyze-heal", "awakening", "burn-heal", "full-heal", "fire-stone", "thunder-stone", "leaf-stone"];
