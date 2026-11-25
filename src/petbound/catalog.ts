import type { Element, PetSpecies, PetInstance, Rarity, SkillDef } from "./types";

export const ELEMENT_COLORS: Record<Element, string> = {
  Nature: "#84c96a", Flame: "#ff8758", Tide: "#64c7ed", Storm: "#f4d65d", Stone: "#b49c83",
  Gale: "#9bdac9", Frost: "#b6e6f4", Light: "#f3da8a", Shadow: "#a18bd5",
};
export const ELEMENT_LABELS: Record<Element, string> = {
  Nature: "Mộc", Flame: "Hỏa", Tide: "Thủy", Storm: "Lôi", Stone: "Thạch",
  Gale: "Phong", Frost: "Băng", Light: "Quang", Shadow: "Ảnh",
};
export const RARITY_LABELS: Record<Rarity, string> = {
  common: "Phổ thông", uncommon: "Tinh anh", rare: "Hiếm", mythic: "Thần thoại",
};
export const RARITY_STARS: Record<Rarity, string> = {
  common: "◆", uncommon: "◆◆", rare: "◆◆◆", mythic: "✦✦✦✦",
};

export const SKILLS: Record<string, SkillDef> = {
  "vine-snap": { id: "vine-snap", name: "Roi Dây Leo", element: "Nature", kind: "attack", power: 28, accuracy: 96, cooldown: 0, description: "Dây leo quất nhanh, gây sát thương Mộc." },
  "bloom-guard": { id: "bloom-guard", name: "Kén Hoa", element: "Nature", kind: "shield", power: 26, accuracy: 100, cooldown: 2, description: "Nở một lớp giáp hoa hấp thụ sát thương." },
  "pollen-mend": { id: "pollen-mend", name: "Phấn Hồi Sinh", element: "Nature", kind: "heal", power: 25, accuracy: 100, cooldown: 3, description: "Phấn hoa chữa lành vết thương." },
  "wild-overgrowth": { id: "wild-overgrowth", name: "Rừng Trỗi Dậy", element: "Nature", kind: "attack", power: 56, accuracy: 88, cooldown: 3, description: "Rễ cây bùng lên từ mặt đất." },
  "ember-pounce": { id: "ember-pounce", name: "Vồ Lửa", element: "Flame", kind: "attack", power: 34, accuracy: 95, cooldown: 0, description: "Lao tới với móng vuốt bọc lửa." },
  "solar-flare": { id: "solar-flare", name: "Bộc Nhật", element: "Flame", kind: "attack", power: 60, accuracy: 86, cooldown: 3, description: "Nén nhiệt thành một vụ nổ mặt trời." },
  "cinder-aegis": { id: "cinder-aegis", name: "Khiên Tàn Hỏa", element: "Flame", kind: "shield", power: 34, accuracy: 100, cooldown: 2, description: "Tàn lửa xoắn thành khiên bảo vệ." },
  "flare-rush": { id: "flare-rush", name: "Xung Kích Hỏa Tâm", element: "Flame", kind: "boost", power: 28, accuracy: 100, cooldown: 3, description: "Tăng sức tấn công cho lượt tiếp theo." },
  "tidal-orb": { id: "tidal-orb", name: "Thủy Châu", element: "Tide", kind: "attack", power: 31, accuracy: 96, cooldown: 0, description: "Quả cầu nước nén bắn thẳng vào mục tiêu." },
  "healing-rain": { id: "healing-rain", name: "Mưa Dịu Êm", element: "Tide", kind: "heal", power: 36, accuracy: 100, cooldown: 3, description: "Mưa linh thủy hồi phục đáng kể." },
  "undertow": { id: "undertow", name: "Dòng Xoáy", element: "Tide", kind: "attack", power: 54, accuracy: 88, cooldown: 3, description: "Vòng xoáy kéo đối thủ vào tâm nước." },
  "bubble-ward": { id: "bubble-ward", name: "Màng Bong Bóng", element: "Tide", kind: "shield", power: 27, accuracy: 100, cooldown: 2, description: "Màng nước bảo vệ linh thú." },
  "thunder-dash": { id: "thunder-dash", name: "Lôi Bộ", element: "Storm", kind: "attack", power: 35, accuracy: 94, cooldown: 0, description: "Lướt nhanh để lại vệt điện." },
  "storm-coil": { id: "storm-coil", name: "Lôi Xà", element: "Storm", kind: "attack", power: 63, accuracy: 84, cooldown: 3, description: "Rắn sét xoắn quanh mục tiêu." },
  "static-field": { id: "static-field", name: "Trường Tĩnh Điện", element: "Storm", kind: "shield", power: 31, accuracy: 100, cooldown: 2, description: "Tạo lớp trường điện phân tán đòn đánh." },
  "overcharge": { id: "overcharge", name: "Quá Tải", element: "Storm", kind: "boost", power: 32, accuracy: 100, cooldown: 3, description: "Nạp điện tăng sát thương kế tiếp." },
  "granite-fist": { id: "granite-fist", name: "Thiết Thạch Quyền", element: "Stone", kind: "attack", power: 37, accuracy: 94, cooldown: 0, description: "Nắm đấm đá nện xuống đấu trường." },
  "crystal-shell": { id: "crystal-shell", name: "Giáp Pha Lê", element: "Stone", kind: "shield", power: 42, accuracy: 100, cooldown: 3, description: "Dựng giáp tinh thể rất bền." },
  "fault-line": { id: "fault-line", name: "Địa Chấn", element: "Stone", kind: "attack", power: 64, accuracy: 82, cooldown: 3, description: "Xé mặt đất thành một đường nứt." },
  "stone-heart": { id: "stone-heart", name: "Tâm Thạch", element: "Stone", kind: "heal", power: 25, accuracy: 100, cooldown: 3, description: "Hấp thu khoáng chất để hồi phục." },
  "wind-cutter": { id: "wind-cutter", name: "Phong Nhận", element: "Gale", kind: "attack", power: 31, accuracy: 97, cooldown: 0, description: "Lưỡi gió mỏng cắt ngang chiến trường." },
  "sky-dance": { id: "sky-dance", name: "Vũ Điệu Tầng Không", element: "Gale", kind: "boost", power: 29, accuracy: 100, cooldown: 2, description: "Tăng tốc và lực tấn công." },
  "feather-mend": { id: "feather-mend", name: "Lông Vũ Chữa Lành", element: "Gale", kind: "heal", power: 30, accuracy: 100, cooldown: 3, description: "Lông vũ phát sáng phục hồi thể lực." },
  "frost-shard": { id: "frost-shard", name: "Băng Tinh", element: "Frost", kind: "attack", power: 36, accuracy: 95, cooldown: 0, description: "Phóng tinh thể băng sắc bén." },
  "glacier-break": { id: "glacier-break", name: "Phá Băng", element: "Frost", kind: "attack", power: 62, accuracy: 84, cooldown: 3, description: "Khối băng lớn nổ tung thành mảnh." },
  "snow-veil": { id: "snow-veil", name: "Màn Tuyết", element: "Frost", kind: "shield", power: 34, accuracy: 100, cooldown: 2, description: "Tuyết kết tinh thành lớp màn chắn." },
  "lumen-ray": { id: "lumen-ray", name: "Quang Tiễn", element: "Light", kind: "attack", power: 39, accuracy: 96, cooldown: 0, description: "Tia sáng hội tụ xuyên qua bóng tối." },
  "radiant-aegis": { id: "radiant-aegis", name: "Hào Quang Hộ Thể", element: "Light", kind: "heal", power: 42, accuracy: 100, cooldown: 3, description: "Ánh quang chữa lành và tiếp thêm sức mạnh." },
  "starlight-pulse": { id: "starlight-pulse", name: "Tinh Tú Chấn", element: "Light", kind: "attack", power: 68, accuracy: 82, cooldown: 3, description: "Sóng sao bùng nổ trên toàn đấu trường." },
  "shade-bite": { id: "shade-bite", name: "Ảnh Nha", element: "Shadow", kind: "attack", power: 36, accuracy: 94, cooldown: 0, description: "Hàm bóng tối cắn xé đối thủ." },
  "soul-drain": { id: "soul-drain", name: "Hút Linh", element: "Shadow", kind: "heal", power: 30, accuracy: 100, cooldown: 3, description: "Hút sinh lực đối phương để hồi phục." },
  "night-veil": { id: "night-veil", name: "Màn Đêm", element: "Shadow", kind: "shield", power: 38, accuracy: 100, cooldown: 2, description: "Bóng tối kết thành lớp giáp." },
  "eclipse": { id: "eclipse", name: "Thực Nhật", element: "Shadow", kind: "attack", power: 70, accuracy: 80, cooldown: 4, description: "Bóng đêm phủ xuống rồi nổ tung." },
};

const P: PetSpecies[] = [
  { id:"mossbell", name:"Mossbell", title:"Mầm chuông rừng", element:"Nature", rarity:"common", role:"support", base:{hp:118,attack:26,defense:27,speed:20}, skills:["vine-snap","pollen-mend","bloom-guard","wild-overgrowth"], silhouette:"round", palette:["#79b85e","#d2e6a3","#45714a"], lore:"Một mầm linh thú sinh ra nơi rêu cổ. Tiếng chuông trên đầu có thể đánh thức cây cỏ." },
  { id:"bramblet", name:"Bramblet", title:"Nhím gai non", element:"Nature", rarity:"common", role:"guardian", base:{hp:142,attack:23,defense:35,speed:14}, skills:["vine-snap","bloom-guard","stone-heart","wild-overgrowth"], silhouette:"quadruped", palette:["#679c50","#b7d58b","#425b37"], lore:"Bộ gai của nó là nơi những hạt giống rừng trú ngụ." },
  { id:"bloomora", name:"Bloomora", title:"Tiên hoa nắng", element:"Nature", rarity:"rare", role:"support", base:{hp:112,attack:31,defense:22,speed:28}, skills:["wild-overgrowth","pollen-mend","bloom-guard","lumen-ray"], silhouette:"spirit", palette:["#91c96d","#ffd5a9","#df7eb0"], lore:"Bông hoa biết bay chỉ nở khi tìm thấy người bạn thật lòng." },
  { id:"cindercub", name:"Cindercub", title:"Hổ con than hồng", element:"Flame", rarity:"common", role:"striker", base:{hp:104,attack:37,defense:20,speed:27}, skills:["ember-pounce","solar-flare","cinder-aegis","flare-rush"], silhouette:"quadruped", palette:["#e87543","#ffd08a","#763c35"], lore:"Chú hổ nhỏ tích nhiệt trong chiếc bờm lửa." },
  { id:"emberlynx", name:"Emberlynx", title:"Miêu ảnh hỏa", element:"Flame", rarity:"rare", role:"striker", base:{hp:112,attack:43,defense:23,speed:32}, skills:["ember-pounce","solar-flare","flare-rush","eclipse"], silhouette:"quadruped", palette:["#ef6b38","#ffe4a0","#7b3440"], lore:"Linh miêu chạy nhanh đến mức chỉ còn một vệt lửa phía sau." },
  { id:"solflare", name:"Solflare", title:"Phượng nhật", element:"Flame", rarity:"mythic", role:"striker", base:{hp:132,attack:55,defense:30,speed:38}, skills:["solar-flare","flare-rush","radiant-aegis","starlight-pulse"], silhouette:"winged", palette:["#ed8b36","#fff0b1","#b63f38"], lore:"Một cánh chim từ lõi mặt trời, chỉ xuất hiện khi bình minh thứ bảy ló rạng." },
  { id:"tidewhisk", name:"Tidewhisk", title:"Rái cá thủy triều", element:"Tide", rarity:"common", role:"support", base:{hp:125,attack:27,defense:28,speed:21}, skills:["tidal-orb","healing-rain","bubble-ward","undertow"], silhouette:"long", palette:["#55afd0","#d4f3ef","#397391"], lore:"Nó giữ một giọt nước biển cổ đại trong chiếc túi má." },
  { id:"rivermint", name:"Rivermint", title:"Hươu suối xanh", element:"Tide", rarity:"uncommon", role:"guardian", base:{hp:145,attack:28,defense:34,speed:20}, skills:["tidal-orb","undertow","healing-rain","bubble-ward"], silhouette:"quadruped", palette:["#57aebd","#c5f3e8","#35716f"], lore:"Gạc của Rivermint lọc nước độc thành dòng suối trong." },
  { id:"shellora", name:"Shellora", title:"Rùa san hô", element:"Tide", rarity:"rare", role:"guardian", base:{hp:166,attack:33,defense:44,speed:12}, skills:["tidal-orb","bubble-ward","healing-rain","fault-line"], silhouette:"crystal", palette:["#4e9fb4","#f6caa1","#365a75"], lore:"Chiếc mai san hô chứa ký ức của đại dương." },
  { id:"voltwing", name:"Voltwing", title:"Bướm điện quang", element:"Storm", rarity:"uncommon", role:"striker", base:{hp:98,attack:39,defense:19,speed:38}, skills:["thunder-dash","storm-coil","overcharge","static-field"], silhouette:"winged", palette:["#e4bd42","#fff5a6","#80622f"], lore:"Cánh nó phát sáng mỗi khi có cơn giông đến gần." },
  { id:"stormhare", name:"Stormhare", title:"Thỏ sấm", element:"Storm", rarity:"rare", role:"striker", base:{hp:110,attack:44,defense:22,speed:43}, skills:["thunder-dash","storm-coil","overcharge","sky-dance"], silhouette:"quadruped", palette:["#cdbb65","#fff4ad","#6b633f"], lore:"Có thể chạy quanh một ngọn đồi trước khi tiếng sấm đầu tiên vang lên." },
  { id:"pebblit", name:"Pebblit", title:"Cục đá biết cười", element:"Stone", rarity:"common", role:"guardian", base:{hp:158,attack:25,defense:42,speed:10}, skills:["granite-fist","crystal-shell","stone-heart","fault-line"], silhouette:"crystal", palette:["#9b907f","#e4d0ae","#514a46"], lore:"Nó lớn lên bằng cách nhặt những viên đá có hình dáng thú vị." },
  { id:"crysthorn", name:"Crysthorn", title:"Kỳ lân tinh thể", element:"Stone", rarity:"mythic", role:"guardian", base:{hp:170,attack:47,defense:49,speed:23}, skills:["granite-fist","crystal-shell","fault-line","radiant-aegis"], silhouette:"quadruped", palette:["#8c9dba","#f1f4ff","#58617f"], lore:"Sừng pha lê phản chiếu cả những vùng đất chưa từng được khám phá." },
  { id:"zephyrin", name:"Zephyrin", title:"Cáo gió", element:"Gale", rarity:"uncommon", role:"striker", base:{hp:105,attack:34,defense:20,speed:42}, skills:["wind-cutter","sky-dance","feather-mend","thunder-dash"], silhouette:"quadruped", palette:["#8acdbd","#e8fff1","#4d827d"], lore:"Bước chân của nó nhẹ như gió luồn qua cánh đồng." },
  { id:"cloudhare", name:"Cloudhare", title:"Thỏ mây", element:"Gale", rarity:"common", role:"support", base:{hp:118,attack:25,defense:24,speed:34}, skills:["wind-cutter","feather-mend","sky-dance","healing-rain"], silhouette:"winged", palette:["#9dd8cc","#f7fff1","#678e96"], lore:"Nó ngủ trong những đám mây thấp vào buổi trưa." },
  { id:"frostlet", name:"Frostlet", title:"Cú tuyết tí hon", element:"Frost", rarity:"uncommon", role:"striker", base:{hp:108,attack:37,defense:26,speed:22}, skills:["frost-shard","glacier-break","snow-veil","lumen-ray"], silhouette:"winged", palette:["#9dd6e8","#f4ffff","#527f9d"], lore:"Lông tơ của nó kết tinh thành những bông tuyết nhỏ." },
  { id:"lumenkit", name:"Lumenkit", title:"Mèo đom đóm", element:"Light", rarity:"rare", role:"support", base:{hp:122,attack:36,defense:25,speed:31}, skills:["lumen-ray","radiant-aegis","starlight-pulse","pollen-mend"], silhouette:"quadruped", palette:["#e6ce78","#fff6ca","#927643"], lore:"Cái đuôi sáng lên khi có ai đó đang lạc đường." },
  { id:"starfin", name:"Starfin", title:"Cá sao ngân hà", element:"Light", rarity:"mythic", role:"support", base:{hp:142,attack:48,defense:33,speed:34}, skills:["lumen-ray","radiant-aegis","starlight-pulse","healing-rain"], silhouette:"long", palette:["#d6c5f0","#fff7ca","#8570bd"], lore:"Nó bơi giữa những quầng sáng như đang trôi trong bầu trời đêm." },
  { id:"duskmote", name:"Duskmote", title:"Linh hồn hoàng hôn", element:"Shadow", rarity:"uncommon", role:"striker", base:{hp:112,attack:40,defense:23,speed:29}, skills:["shade-bite","soul-drain","night-veil","eclipse"], silhouette:"spirit", palette:["#7f70a8","#d2c8ed","#3e365a"], lore:"Một chiếc bóng tinh nghịch có thể biến mất trong ánh đèn." },
  { id:"nightling", name:"Nightling", title:"Chồn đêm", element:"Shadow", rarity:"rare", role:"striker", base:{hp:116,attack:47,defense:25,speed:37}, skills:["shade-bite","soul-drain","night-veil","eclipse"], silhouette:"quadruped", palette:["#5d526f","#c5b2de","#292538"], lore:"Đôi mắt của nó nhìn thấy những con đường bị che khuất." },
  { id:"glaciera", name:"Glaciera", title:"Thiên nga băng", element:"Frost", rarity:"mythic", role:"guardian", base:{hp:166,attack:48,defense:43,speed:30}, skills:["frost-shard","glacier-break","snow-veil","radiant-aegis"], silhouette:"winged", palette:["#9bd7e8","#f5ffff","#557c9c"], lore:"Đôi cánh kết tinh thành vòm băng trong suốt giữa không trung." },
  { id:"thornox", name:"Thornox", title:"Bò rừng gai", element:"Nature", rarity:"rare", role:"guardian", base:{hp:178,attack:41,defense:46,speed:16}, skills:["vine-snap","wild-overgrowth","bloom-guard","stone-heart"], silhouette:"quadruped", palette:["#638d4d","#d4bd85","#394d35"], lore:"Mỗi chiếc sừng là một nhánh cây hóa thạch." },
  { id:"umbrafang", name:"Umbrafang", title:"Sói bóng nguyệt", element:"Shadow", rarity:"mythic", role:"striker", base:{hp:138,attack:58,defense:31,speed:40}, skills:["shade-bite","eclipse","soul-drain","sky-dance"], silhouette:"quadruped", palette:["#5c527b","#e1d7ff","#29253f"], lore:"Lời tru của nó làm ánh trăng tối đi trong một nhịp thở." },
];

export const PETS = Object.fromEntries(P.map(p => [p.id, p])) as Record<string, PetSpecies>;
export const PET_LIST = P;
export const STARTER_IDS = ["mossbell", "cindercub", "tidewhisk"] as const;
export function getPet(id: string): PetSpecies {
  return PETS[id] ?? PETS.mossbell;
}
export function petMaxHp(pet: PetSpecies, level: number) {
  return pet.base.hp + level * 9 + Math.floor(level * level * 0.22);
}
export function xpToLevel(level: number) { return Math.floor(45 + level * 28 + level * level * 2.5); }
let uidCounter = 0;
export function createPet(speciesId: string, level = 1, shiny = false): PetInstance {
  const species = getPet(speciesId);
  return {
    uid: "pet-" + Date.now().toString(36) + "-" + (++uidCounter).toString(36) + "-" + Math.random().toString(36).slice(2, 6),
    speciesId: species.id, level, xp: 0, hp: petMaxHp(species, level), bond: 20,
    skills: [...species.skills], shiny,
  };
}
export function xpGain(pet: PetInstance, amount: number) {
  let left = amount;
  let levels = 0;
  while (left > 0 && pet.level < 60) {
    const needed = xpToLevel(pet.level) - pet.xp;
    if (left >= needed) {
      left -= needed; pet.level++; pet.xp = 0; levels++;
      pet.hp = petMaxHp(getPet(pet.speciesId), pet.level);
    } else {
      pet.xp += left; left = 0;
    }
  }
  return levels;
}
