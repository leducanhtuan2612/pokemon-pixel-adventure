import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import Phaser from "phaser";
import { createGameConfig } from "../game/config";
import { session } from "../game/core/GameSession";
import { useGameStore } from "../state/gameStore";
import { MenuLayer } from "./menus/MenuLayer";
import { SidePanel } from "./SidePanel";
import { gameAudio } from "../game/audio/GameAudio";

export default function App() {
  const host = useRef<HTMLDivElement>(null);
  // Dev-only ?fxdemo= skips the title overlay so the battle demo is visible.
  const [started, setStarted] = useState(() => import.meta.env.DEV && new URLSearchParams(location.search).has("fxdemo"));
  const [audioEnabled, setAudioEnabled] = useState(gameAudio.isEnabled);
  const setReady = useGameStore((s) => s.setReady);
  const hasSave = session.data.starterChosen;
  type MoveDirection = "up" | "down" | "left" | "right";
  const sendVirtualMove = (dir: MoveDirection, pressed: boolean) => {
    window.dispatchEvent(new CustomEvent("game:virtual-move", { detail: { dir, pressed } }));
  };
  const pressMove = (event: ReactPointerEvent<HTMLButtonElement>, dir: MoveDirection) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    sendVirtualMove(dir, true);
  };
  const releaseMove = (event: ReactPointerEvent<HTMLButtonElement>, dir: MoveDirection) => {
    event.preventDefault();
    sendVirtualMove(dir, false);
  };

  useEffect(() => {
    const unlockAudio = () => gameAudio.unlock();
    window.addEventListener("pointerdown", unlockAudio, { once: true });
    return () => window.removeEventListener("pointerdown", unlockAudio);
  }, []);

  useEffect(() => {
    if (!host.current) return;
    const game = new Phaser.Game(createGameConfig(host.current));
    if (import.meta.env.DEV) Object.assign(window, { __game: game, __session: session });
    game.events.once("ready", () => setReady(true));
    return () => { game.destroy(true); setReady(false); };
  }, [setReady]);

  const start = (fresh: boolean) => {
    if (fresh && hasSave && !confirm("Bắt đầu game mới sẽ xóa tiến trình hiện tại. Tiếp tục?")) return;
    gameAudio.unlock();
    gameAudio.setTrack("village");
    if (fresh) { session.reset(); sessionStorage.setItem("ppa-autostart", "1"); window.location.reload(); return; }
    setStarted(true);
    (window as unknown as { __ppaStarted?: boolean }).__ppaStarted = true;
    window.dispatchEvent(new Event("game:start"));
  };

  useEffect(() => {
    const persist = () => session.save();
    const onVisibility = () => { if (document.visibilityState === "hidden") persist(); };
    window.addEventListener("pagehide", persist);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", persist);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  useEffect(() => {
    if (sessionStorage.getItem("ppa-autostart")) { sessionStorage.removeItem("ppa-autostart"); start(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <main className="app-shell">
    <header className="topbar"><div className="brand-mark">✦</div><div><strong>POKÉMON</strong><span>PIXEL ADVENTURE</span></div><button className="audio-toggle" aria-pressed={audioEnabled} onClick={() => { const next = !audioEnabled; if (next) gameAudio.unlock(); gameAudio.setEnabled(next); setAudioEnabled(next); }}>{audioEnabled ? "♫ ÂM THANH BẬT" : "♪ ÂM THANH TẮT"}</button><div className="status-pill"><i /> PIXEL WORLD</div></header>
    <section className="game-layout">
      <div className="game-frame">
        <div className="frame-label"><span>MAP 01</span><span>LÀNG LÁ XANH · ROUTE 101</span></div>
        <div className="game-stage">
          <div ref={host} className="game-host" />
          <MenuLayer />
          <div className="touch-pad" aria-label="Điều khiển di chuyển">
            <button className="touch-up" aria-label="Đi lên" onPointerDown={(event) => pressMove(event, "up")} onPointerUp={(event) => releaseMove(event, "up")} onPointerCancel={(event) => releaseMove(event, "up")}>▲</button>
            <button className="touch-left" aria-label="Đi sang trái" onPointerDown={(event) => pressMove(event, "left")} onPointerUp={(event) => releaseMove(event, "left")} onPointerCancel={(event) => releaseMove(event, "left")}>◀</button>
            <button className="touch-down" aria-label="Đi xuống" onPointerDown={(event) => pressMove(event, "down")} onPointerUp={(event) => releaseMove(event, "down")} onPointerCancel={(event) => releaseMove(event, "down")}>▼</button>
            <button className="touch-right" aria-label="Đi sang phải" onPointerDown={(event) => pressMove(event, "right")} onPointerUp={(event) => releaseMove(event, "right")} onPointerCancel={(event) => releaseMove(event, "right")}>▶</button>
          </div>
          {!started && <div className="start-overlay">
            <div className="eyebrow">A NEW JOURNEY</div>
            <h1>YOUR STORY<br /><em>STARTS HERE.</em></h1>
            <p>Khám phá thế giới pixel, gặp gỡ Pokémon<br />và chinh phục những thử thách đầu tiên.</p>
            <div className="start-buttons">
              {hasSave && <button onClick={() => start(false)}>TIẾP TỤC <span>→</span></button>}
              <button className={hasSave ? "secondary" : ""} onClick={() => (hasSave ? start(true) : start(false))}>{hasSave ? "GAME MỚI" : "BẮT ĐẦU PHIÊU LƯU"} <span>→</span></button>
            </div>
            <small>WASD / ← ↑ → ↓ di chuyển · Shift chạy · Click đi tới · Z tương tác · ESC menu</small>
          </div>}
        </div>
        <div className="frame-bottom"><span>▲ KANTO-LIKE REGION</span><span>BUILD 0.5.0</span></div>
      </div>
      <SidePanel />
    </section>
    <footer><span>© 2026 PIXEL ADVENTURE STUDIO · Pokémon sprites: @balavicknesh</span><span>MADE FOR EXPLORERS <b>✦</b></span></footer>
  </main>;
}
