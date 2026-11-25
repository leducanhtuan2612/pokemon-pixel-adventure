import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { createGameConfig } from "../game/config";
import { session } from "../game/core/GameSession";
import { useGameStore } from "../state/gameStore";
import { MenuLayer } from "./menus/MenuLayer";
import { SidePanel } from "./SidePanel";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  const [started, setStarted] = useState(false);
  const setReady = useGameStore((s) => s.setReady);
  const hasSave = session.data.starterChosen;

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game(createGameConfig(host.current));
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __session: session });
    game.events.once("ready", () => setReady(true));
    return () => { game.destroy(true); setReady(false); };
  }, [setReady]);

  const start = (fresh: boolean) => {
    if (fresh && hasSave && !confirm("Bắt đầu game mới sẽ xóa tiến trình hiện tại. Tiếp tục?")) return;
    if (fresh) { session.reset(); sessionStorage.setItem("ppa-autostart", "1"); window.location.reload(); return; }
    setStarted(true);
    (window as unknown as { __ppaStarted?: boolean }).__ppaStarted = true;
    window.dispatchEvent(new Event("game:start"));
  };

  useEffect(() => {
    if (sessionStorage.getItem("ppa-autostart")) { sessionStorage.removeItem("ppa-autostart"); start(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">✦</div><div><strong>POKÉMON</strong><span>PIXEL ADVENTURE</span></div><div className="status-pill"><i /> PIXEL WORLD</div></header>
    <section className="game-layout">
      <div className="game-frame">
        <div className="frame-label"><span>MAP 01</span><span>LÀNG LÁ XANH · ROUTE 101</span></div>
        <div className="game-stage">
          <div ref={host} className="game-host" />
          <MenuLayer />
          {!started && <div className="start-overlay">
            <div className="eyebrow">A NEW JOURNEY</div>
            <h1>YOUR STORY<br /><em>STARTS HERE.</em></h1>
            <p>Khám phá thế giới pixel, gặp gỡ Pokémon<br />và chinh phục những thử thách đầu tiên.</p>
            <div className="start-buttons">
              {hasSave && <button onClick={() => start(false)}>TIẾP TỤC <span>→</span></button>}
              <button className={hasSave ? "secondary" : ""} onClick={() => (hasSave ? start(true) : start(false))}>{hasSave ? "GAME MỚI" : "BẮT ĐẦU PHIÊU LƯU"} <span>→</span></button>
            </div>
            <small>WASD / ← ↑ → ↓ để di chuyển · Z/Enter tương tác · ESC menu</small>
          </div>}
        </div>
        <div className="frame-bottom"><span>▲ KANTO-LIKE REGION</span><span>BUILD 0.3.0</span></div>
      </div>
      <SidePanel />
    </section>
    <footer><span>© 2026 PIXEL ADVENTURE STUDIO · Pokémon sprites: @balavicknesh</span><span>MADE FOR EXPLORERS <b>✦</b></span></footer>
  </main>;
}
