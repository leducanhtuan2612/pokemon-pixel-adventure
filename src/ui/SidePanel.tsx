import { session } from "../game/core/GameSession";
import { displayName } from "../game/core/pokemon";
import { useGameStore } from "../state/gameStore";
import { objectiveFor } from "../game/core/objectives";
import { HpBar, Sprite } from "./menus/common";

export function SidePanel() {
  useGameStore((s) => s.version);
  const d = session.data;
  const objective = objectiveFor(d);
  return <aside className="side-panel">
    <div className="panel-heading"><span>YOUR ADVENTURE</span><b>01</b></div>
    <div className="trainer-card">
      <div className="trainer-avatar">🧢</div>
      <div><strong>TRAINER {d.playerName}</strong><small>₽{d.money.toLocaleString("vi-VN")} · Huy hiệu {d.badges.length}</small></div>
      <span className="level">DEX {d.dex.caught.length}</span>
    </div>
    <div className="section-title">ĐỘI HÌNH</div>
    <div className="side-party">
      {d.party.length ? d.party.map((m) => <div key={m.uid} className="side-mon">
        <Sprite speciesId={m.speciesId} size={32} />
        <div><b>{displayName(m)}</b> <small>Lv{m.level}</small><HpBar mon={m} /></div>
      </div>) : <small className="muted">Chưa có Pokémon.</small>}
    </div>
    <div className="section-title">NHIỆM VỤ</div>
    <div className="quest"><div className="quest-icon">✦</div><div><strong>Làng Lá Xanh</strong><p>{objective}</p></div></div>
    <div className="section-title">ĐIỀU KHIỂN</div>
    <div className="controls">
      <span><kbd>WASD</kbd><kbd>←↑→↓</kbd></span><small>Di chuyển</small>
      <span><kbd>Z</kbd><kbd>ENTER</kbd></span><small>Tương tác / chọn</small>
      <span><kbd>X</kbd><kbd>ESC</kbd></span><small>Menu / quay lại</small>
      <span><kbd>TAB</kbd></span><small>Đội hình nhanh</small>
    </div>
  </aside>;
}
