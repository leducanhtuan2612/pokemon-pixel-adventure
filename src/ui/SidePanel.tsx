import { session } from "../game/core/GameSession";
import { displayName } from "../game/core/pokemon";
import { useGameStore } from "../state/gameStore";
import { questFor } from "../game/core/objectives";
import { sideQuestsFor } from "../game/core/sideQuests";
import { HpBar, Sprite } from "./menus/common";

export function SidePanel() {
  useGameStore((s) => s.version);
  const open = useGameStore((s) => s.open);
  const d = session.data;
  const quest = questFor(d);
  const objective = quest.description;
  const mainStep = `${String(quest.stage).padStart(2, "0")} / ${quest.stages}`;
  const sideQuests = sideQuestsFor(d);
  return <aside className="side-panel">
    <div className="panel-heading"><span>YOUR ADVENTURE</span><b>01</b></div>
    <div className="trainer-card">
      <div className="trainer-avatar">🧢</div>
      <div><strong>TRAINER {d.playerName}</strong><small>₽{d.money.toLocaleString("vi-VN")} · Huy hiệu {d.badges.length}</small></div>
      <span className="level">DEX {d.dex.caught.length}</span>
    </div>
    <div className="quick-actions">
      <button onClick={() => open("party")}>ĐỘI HÌNH</button>
      <button onClick={() => open("bag")}>TÚI ĐỒ</button>
      <button onClick={() => open("dex")}>POKÉDEX</button>
      <button onClick={() => open("menu")}>MENU</button>
    </div>
    <div className="section-title">ĐỘI HÌNH</div>
    <div className="side-party">
      {d.party.length ? d.party.map((m) => <div key={m.uid} className="side-mon">
        <Sprite speciesId={m.speciesId} size={32} />
        <div><b>{displayName(m)}</b> <small>Lv{m.level}</small><HpBar mon={m} /></div>
      </div>) : <small className="muted">Chưa có Pokémon.</small>}
    </div>
    <div className="section-title">NHIỆM VỤ CHÍNH <b className="quest-step">{mainStep}</b></div>
    <div className="quest quest-active">
      <div className="quest-icon">✦</div>
      <div className="quest-copy">
        <strong>{quest.title}</strong><p>{objective}</p>
        <div className="quest-meter" role="progressbar" aria-label="Tiến độ nhiệm vụ" aria-valuenow={quest.percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${quest.percent}%` }} />
        </div>
        <div className="quest-meter-label"><span>TIẾN ĐỘ</span><b>{quest.percent}%</b></div>
        <small>Điểm đến: {quest.target.label}</small>
        <button className="quest-navigate" onClick={() => window.dispatchEvent(new Event("game:quest-navigate"))}>⌖ ĐI ĐẾN NHIỆM VỤ <span>↗</span></button>
      </div>
    </div>
    <div className="section-title side-quest-heading">NHIỆM VỤ PHỤ <b>{sideQuests.filter((q) => q.completed).length}/{sideQuests.length}</b></div>
    <div className="side-quest-list">
      {sideQuests.map((q) => <article className={`side-quest ${q.completed ? "is-complete" : ""} ${q.claimed ? "is-claimed" : ""}`} key={q.id}>
        <div className="side-quest-top"><strong>{q.title}</strong><span>{q.claimed ? "ĐÃ NHẬN" : q.completed ? "HOÀN THÀNH" : `${q.progress}/${q.goal}`}</span></div>
        <p>{q.description}</p>
        <div className="side-quest-bar"><span style={{width: `${Math.min(100, Math.round(q.progress / q.goal * 100))}%`}} /></div>
        <small>NPC: {q.target.label} · Thưởng ₽{q.reward.money.toLocaleString("vi-VN")}</small>
        <div className="side-quest-actions">
          <button onClick={() => window.dispatchEvent(new CustomEvent("game:sidequest-navigate", { detail: { id: q.id } }))}>⌖ ĐI TỚI</button>
          <button disabled={!q.completed || q.claimed} onClick={() => { const r = session.claimSideQuest(q.id); useGameStore.getState().notify(r.message); }}> {q.claimed ? "ĐÃ NHẬN" : "NHẬN THƯỞNG"} </button>
        </div>
      </article>)}
    </div>
    <div className="section-title">ĐIỀU KHIỂN</div>
    <div className="controls">
      <span><kbd>WASD</kbd><kbd>←↑→↓</kbd></span><small>Di chuyển</small>
      <span><kbd>Z</kbd><kbd>ENTER</kbd></span><small>Tương tác / chọn</small>
      <span><kbd>X</kbd><kbd>ESC</kbd></span><small>Menu / quay lại</small>
      <span><kbd>TAB</kbd></span><small>Đội hình nhanh</small>
    </div>
  </aside>;
}
