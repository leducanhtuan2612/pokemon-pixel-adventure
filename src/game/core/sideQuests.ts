import type { SaveData } from "./GameSession";
import type { Point } from "../world/types";
import { GREENLEAF } from "../data/maps/greenleaf";

export interface SideQuest {
  id: string;
  title: string;
  description: string;
  giver: string;
  target: { npcId?: string; tile?: Point; label: string; arrival: string };
  progress: number;
  goal: number;
  completed: boolean;
  claimed: boolean;
  reward: { item: string; qty: number; money: number };
}

const picked = (d: SaveData, id: string) => d.flags.includes(`item:greenleaf:${id}`);
const beaten = (d: SaveData, id: string) => d.defeated.includes(id);

export function sideQuestsFor(d: SaveData): SideQuest[] {
  const items = GREENLEAF.items ?? [];
  const foundItems = items.filter((it) => picked(d, it.id)).length;
  const hiddenItems = items.filter((it) => it.hidden && picked(d, it.id)).length;
  const berryItems = items.filter((it) => it.id.startsWith("berry-") && picked(d, it.id)).length;
  const moonShards = items.filter((it) => it.id.startsWith("moon-shard-") && picked(d, it.id)).length;
  const enteredGrove = d.flags.includes("area:greenleaf:moon-grove");
  const trainerIds = ["joey", "lass", "bug", "hiker"];
  const trainerWins = trainerIds.filter((id) => beaten(d, id)).length;
  const claimed = (id: string) => d.flags.includes(`quest:claimed:${id}`);
  const make = (id: string, title: string, description: string, giver: string, label: string, arrival: string,
    progress: number, goal: number, item: string, qty: number, money: number): SideQuest => ({
      id, title, description, giver,
      target: { npcId: giver, label, arrival },
      progress: Math.min(progress, goal), goal, completed: progress >= goal, claimed: claimed(id),
      reward: { item, qty, money },
    });
  return [
    make("orchard-care", "Thu thập vật phẩm", "Khám phá Greenleaf và nhặt 4 vật phẩm trên đường đi.", "farmer", "Bác Tư · vườn rau",
      "Bác Tư đang chờ bạn mang những món đồ tìm được về.", foundItems, 4, "great-ball", 3, 350),
    make("dex-research", "Nghiên cứu Pokédex", "Bắt và ghi nhận 8 loài Pokémon khác nhau ở Route 101.", "girl", "Chị Lan · vườn hoa",
      "Chị Lan muốn xem dữ liệu của 8 loài Pokémon mới.", d.dex.caught.length, 8, "super-potion", 3, 600),
    make("route-challenge", "Thử thách Trainer", "Đánh bại cả 4 Trainer đang luyện tập quanh Route 101.", "route-scout", "Trinh sát Route 101",
      "Trinh sát sẽ trao huy hiệu danh dự khi bạn thắng đủ 4 Trainer.", trainerWins, 4, "ultra-ball", 3, 1000),
    make("hidden-grove", "Bí mật vườn cây", "Tìm đủ 6 vật phẩm ẩn trong bụi cây và khu vườn phía đông nam.", "oldman", "Cụ Ba · vườn bí mật",
      "Cụ Ba biết vị trí những món đồ cũ trong vườn.", hiddenItems, 6, "full-heal", 3, 500),
    make("greenleaf-explorer", "Nhà thám hiểm", "Đi bộ khám phá ít nhất 240 bước trong Greenleaf.", "kid", "Bé Bin · đầu cầu",
      "Bé Bin muốn bạn khám phá mọi ngóc ngách của ngôi làng.", d.steps, 240, "potion", 5, 450),
    make("route-survey", "Khảo sát Route 101", "Gặp và ghi nhận ít nhất 12 loài Pokémon trong Pokédex.", "route-scout", "Trinh sát Route 101",
      "Trinh sát đang chờ báo cáo dữ liệu Pokémon của bạn.", d.dex.seen.length, 12, "great-ball", 4, 800),
    make("berry-basket", "Giỏ quả của bác Tư", "Thu thập 4 quả Oran Berry trong vườn và lối mòn.", "farmer", "Bác Tư · vườn rau",
      "Bác Tư cần quả mọng để chăm Pokémon trong làng.", berryItems, 4, "super-potion", 2, 650),
    make("moon-shards", "Mảnh trăng thất lạc", "Tìm đủ 3 Mảnh Trăng ẩn trong Moonlit Grove.", "mira", "Mira · Moonlit Grove",
      "Mira đang nghiên cứu các tinh thể phát sáng trong khu rừng.", moonShards, 3, "full-heal", 2, 900),
    make("moon-grove-discovery", "Lối mòn ánh trăng", "Tìm đường xuống khu rừng bí mật phía nam Greenleaf.", "mira", "Mira · lối vào rừng",
      "Bạn đã đến Moonlit Grove. Mira sẽ kể về khu rừng này.", enteredGrove ? 1 : 0, 1, "ultra-ball", 2, 500),
    make("greenleaf-dex-master", "Nhà nghiên cứu Pokémon", "Bắt ít nhất 12 loài Pokémon khác nhau ở Greenleaf.", "girl", "Chị Lan · vườn hoa",
      "Chị Lan muốn xem bộ sưu tập Pokémon đa dạng của bạn.", d.dex.caught.length, 12, "hyper-potion", 2, 1200),
  ];
}

export function sideQuestFor(d: SaveData, id: string) {
  return sideQuestsFor(d).find((q) => q.id === id);
}
