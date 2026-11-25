import { useState } from "react";
import { session } from "../../game/core/GameSession";
import { useGameStore } from "../../state/gameStore";
import { Window } from "./common";

export function RedeemPanel() {
  const { close, notify, open } = useGameStore.getState();
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = () => {
    if (busy || !code.trim()) return;
    setBusy(true);
    const result = session.redeemCode(code);
    setBusy(false);
    notify(result.message);
    if (result.ok && session.hasFlag("unlock:move-lab")) open("moveLab");
    else if (result.ok) close();
  };
  return <div className="px-fullscreen px-redeem-screen">
    <Window title="GIFT REDEEM · MAP 1" className="px-redeem" hint="ESC: quay lại menu">
      <div className="px-redeem-art">✦ <b>GREENLEAF</b> ✦<small>QA / PLAYTEST CODES</small></div>
      <label className="px-redeem-label" htmlFor="gift-code">NHẬP MÃ QUÀ</label>
      <input id="gift-code" className="px-redeem-input" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="VD: GREENLEAF-TEST" autoComplete="off" spellCheck={false} maxLength={40}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />
      <button className="px-redeem-submit" disabled={!code.trim() || busy} onClick={submit}>ĐỔI QUÀ <span>↗</span></button>
      <div className="px-code-list">
        <b>MÃ DÙNG ĐỂ TEST</b>
        <p><code>GREENLEAF-TEST</code><br/>Đội test Map 1 Lv.30 + Poké Ball, thuốc, tiền.</p>
        <p><code>MAP1-MOVE-LAB</code><br/>Mở phòng thử chiêu, nâng đội tối thiểu Lv.30.</p>
        <small>Mỗi mã chỉ đổi một lần trên save hiện tại. Mã chỉ phục vụ bản test.</small>
      </div>
      <button className="px-row px-redeem-back" onClick={close}>← QUAY LẠI</button>
    </Window>
  </div>;
}
