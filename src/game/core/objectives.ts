import type { SaveData } from "./GameSession";

export const ROUTE_TRAINERS = ["joey", "lass", "bug", "hiker"];

/** Guided, milestone-based first-route quest; each step is tied to persisted progress. */
export function objectiveFor(d: SaveData): string {
  if (!d.starterChosen) return "BƯỚC 1 · Gặp Giáo sư Birch tại phòng LAB và chọn Pokémon khởi đầu.";
  if (d.dex.caught.length === 0) return "BƯỚC 2 · Đi qua cầu đến Route 101, bước vào cỏ cao và bắt Pokémon đầu tiên.";
  if (!d.defeated.includes("joey")) return "BƯỚC 3 · Thử sức với Youngster Joey ở phía đông Route 101. Xem hệ và sức mạnh chiêu trước khi chọn!";
  const beaten = ROUTE_TRAINERS.filter((id) => d.defeated.includes(id)).length;
  if (beaten < ROUTE_TRAINERS.length) return "BƯỚC 4 · Chinh phục Trainer còn lại trên Route 101 (" + beaten + "/" + ROUTE_TRAINERS.length + ").";
  if (d.dex.caught.length < 5) return "BƯỚC 5 · Khám phá cỏ cao, ghi nhận " + Math.min(5, d.dex.caught.length) + "/5 loài Pokémon vào Pokédex.";
  if (!d.flags.includes("gift:birch-dex5")) return "BƯỚC 6 · Quay lại phòng LAB báo Giáo sư Birch để nhận phần thưởng Pokédex.";
  return "HOÀN THÀNH · Greenleaf Route đã được chinh phục! Hoàn thiện Pokédex và luyện đội hình.";
}