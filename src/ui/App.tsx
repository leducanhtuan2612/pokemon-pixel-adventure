import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { createGameConfig } from "../game/config";
import { useGameStore } from "../state/gameStore";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const setReady = useGameStore((s) => s.setReady);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game(createGameConfig(host.current));
    game.events.once("ready", () => setReady(true));
    return () => { game.destroy(true); setReady(false); };
  }, [setReady]);

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">✦</div><div><strong>POKÉMON</strong><span>PIXEL ADVENTURE</span></div><div className="status-pill"><i /> PIXEL WORLD</div></header>
    <section className="game-layout"><div className="game-frame"><div className="frame-label"><span>ROUTE 01</span><span>FOREST OUTSKIRTS</span></div><div ref={host} className="game-host" />
      {!started && <div className="start-overlay"><div className="eyebrow">A NEW JOURNEY</div><h1>YOUR STORY<br/><em>STARTS HERE.</em></h1><p>Khám phá thế giới pixel, gặp gỡ Pokémon<br/>và chinh phục những thử thách đầu tiên.</p><button onClick={() => {setStarted(true); window.dispatchEvent(new Event("game:start"));}}>BẮT ĐẦU PHIÊU LƯU <span>→</span></button><small>WASD / ← ↑ → ↓ để di chuyển</small></div>}
      <div className="frame-bottom"><span>▲ KANTO-LIKE REGION</span><span>BUILD 0.1.0</span></div></div>
      <aside className="side-panel"><div className="panel-heading"><span>YOUR ADVENTURE</span><b>01</b></div><div className="trainer-card"><div className="trainer-avatar">🧢</div><div><strong>PIXEL TRAINER</strong><small>New explorer</small></div><span className="level">LV. 01</span></div><div className="section-title">JOURNEY LOG</div><div className="quest"><div className="quest-icon">✦</div><div><strong>Welcome to the world!</strong><p>Di chuyển và khám phá khu rừng đầu tiên.</p><span className="quest-progress">MAIN QUEST · 0/1</span></div></div><div className="section-title">CONTROLS</div><div className="controls"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd></span><small>Move</small><span><kbd>ENTER</kbd></span><small>Interact</small><span><kbd>ESC</kbd></span><small>Menu</small></div><div className="tip">💡 <span>Hãy thử đi lại gần những nhân vật và vật thể trong khu vực.</span></div></aside></section>
    <footer><span>© 2026 PIXEL ADVENTURE STUDIO</span><span>MADE FOR EXPLORERS <b>✦</b></span></footer>
  </main>;
}
