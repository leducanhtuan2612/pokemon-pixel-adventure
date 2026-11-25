import type { SaveData } from "./GameSession";
import type { Point } from "../world/types";

export const ROUTE_TRAINERS = ["joey", "lass", "bug", "hiker"] as const;
const ROUTE_SIDE_TRAINERS = ["lass", "bug", "hiker"] as const;

export interface QuestTarget {
  npcId?: string;
  tile?: Point;
  label: string;
  arrival: string;
}
export interface QuestInfo {
  title: string;
  description: string;
  stage: number;
  stages: number;
  percent: number;
  target: QuestTarget;
}

/** First-route story quest with saved-progress milestones and a navigable target. */
export function questFor(d: SaveData): QuestInfo {
  const defeatedSide = ROUTE_SIDE_TRAINERS.filter((id) => d.defeated.includes(id)).length;
  if (!d.starterChosen) return {
    title: "Nhận Pokémon khởi đầu",
    description: "BƯỚC 1 · Gặp Giáo sư Birch tại phòng LAB và chọn Pokémon khởi đầu.",
    stage: 1, stages: 7, percent: 0,
    target: { npcId: "birch", label: "Giáo sư Birch · LAB", arrival: "Hãy nói chuyện với Giáo sư Birch để chọn Pokémon." },
  };
  if (d.dex.caught.length === 0) return {
    title: "Bắt Pokémon đầu tiên",
    description: "BƯỚC 2 · Đi qua cầu đến Route 101, bước vào cỏ cao và bắt Pokémon đầu tiên.",
    stage: 2, stages: 7, percent: 14,
    target: { tile: { x: 29, y: 7 }, label: "Cỏ cao · Route 101", arrival: "Bạn đã đến bãi cỏ Route 101. Đi vài bước trong cỏ cao để gặp Pokémon hoang!" },
  };
  if (!d.defeated.includes("joey")) return {
    title: "Trận đấu Trainer đầu tiên",
    description: "BƯỚC 3 · Thử sức với Youngster Joey ở phía đông Route 101. Xem hệ và sức mạnh chiêu trước khi chọn!",
    stage: 3, stages: 7, percent: 28,
    target: { npcId: "joey", label: "Youngster Joey", arrival: "Bạn đã đến gần Youngster Joey. Chuẩn bị đội hình trước trận đấu!" },
  };
  if (defeatedSide < ROUTE_SIDE_TRAINERS.length) {
    const next = ROUTE_SIDE_TRAINERS.find((id) => !d.defeated.includes(id))!;
    const labels: Record<string, string> = { lass: "Lass Mai", bug: "Bug Catcher Tèo", hiker: "Hiker Đá" };
    return {
      title: "Chinh phục Trainer Route 101",
      description: "BƯỚC 4 · Đánh bại các Trainer còn lại trên Route 101 (" + defeatedSide + "/" + ROUTE_SIDE_TRAINERS.length + ").",
      stage: 4, stages: 7, percent: 42 + Math.round(defeatedSide / ROUTE_SIDE_TRAINERS.length * 14),
      target: { npcId: next, label: labels[next], arrival: "Đã đến Trainer. Tương tác để bắt đầu trận đấu!" },
    };
  }
  if (d.dex.caught.length < 5) return {
    title: "Hoàn thiện Pokédex",
    description: "BƯỚC 5 · Khám phá cỏ cao, KẾT NỐI với " + Math.min(5, d.dex.caught.length) + "/5 loài Pokémon.",
    stage: 5, stages: 7, percent: 58 + Math.min(12, d.dex.caught.length * 3),
    target: { tile: { x: 29, y: 7 }, label: "Khu vực Pokémon hoang", arrival: "Hãy tiếp tục khám phá và bắt thêm loài mới để hoàn thành Pokédex." },
  };
  if (!d.flags.includes("gift:birch-dex5")) return {
    title: "Nhận thưởng Pokédex",
    description: "BƯỚC 6 · Quay lại phòng LAB báo Giáo sư Birch để nhận phần thưởng Pokédex.",
    stage: 6, stages: 7, percent: 74,
    target: { npcId: "birch", label: "Giáo sư Birch · LAB", arrival: "Birch có phần thưởng dành cho bạn. Hãy nói chuyện với giáo sư!" },
  };
  if (!d.defeated.includes("guardian")) return {
    title: "Thử thách Hộ Vệ Rừng Thẳm",
    description: "BƯỚC 7 · Xuống Moonlit Grove phía nam và vượt qua Hộ Vệ Rừng Thẳm. Chuẩn bị THỦ khi nó tung Tuyệt kỹ!",
    stage: 7, stages: 7, percent: 88,
    target: { npcId: "guardian", label: "Hộ Vệ · Moonlit Grove", arrival: "Hộ Vệ Rừng Thẳm đang chờ. Hồi phục đội hình trước khi thách đấu!" },
  };
  return {
    title: "Greenleaf Route hoàn thành",
    description: "HOÀN THÀNH · Bạn đã nhận Huy hiệu Rừng Thẳm! Hoàn thiện Pokédex và luyện đội hình chờ Lumina City.",
    stage: 7, stages: 7, percent: 100,
    target: { tile: { x: 8, y: 14 }, label: "Phòng LAB · Greenleaf", arrival: "Bạn đã hoàn thành nhiệm vụ chính đầu tiên!" },
  };
}

export function objectiveFor(d: SaveData): string {
  return questFor(d).description;
}
