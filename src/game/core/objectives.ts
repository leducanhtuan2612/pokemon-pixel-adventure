import type { SaveData } from "./GameSession";

export const ROUTE_TRAINERS = ["joey", "lass", "bug", "hiker"];

/** Current map-1 goal shown in dialogs and the side panel. */
export function objectiveFor(d: SaveData): string {
  if (!d.starterChosen) return "Gặp Giáo sư Birch trước phòng LAB để nhận Pokémon đầu tiên.";
  const beaten = ROUTE_TRAINERS.filter((id) => d.defeated.includes(id)).length;
  if (beaten < ROUTE_TRAINERS.length) return `Đánh bại các trainer ở Route 101 (${beaten}/${ROUTE_TRAINERS.length}).`;
  if (!d.flags.includes("gift:birch-dex5")) return `Ghi 5 loài vào Pokédex (${Math.min(5, d.dex.caught.length)}/5) rồi gặp Giáo sư Birch.`;
  return "Hoàn thành Làng Lá Xanh! Lumina City sẽ mở trong bản cập nhật tới.";
}
