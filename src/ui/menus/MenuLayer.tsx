import { useEffect } from "react";
import { useGameStore } from "../../state/gameStore";
import { BagPanel } from "./BagPanel";
import { MartPanel } from "./MartPanel";
import { BoxPanel, PartyPanel } from "./PartyPanel";
import { PokedexPanel } from "./PokedexPanel";
import { StartMenu } from "./StartMenu";
import { StarterPicker } from "./StarterPicker";
import { RedeemPanel, MoveLabPanel } from "./QARewardsPanel";
import { GachaPanel } from "./GachaPanel";

/** React overlay on top of the Phaser canvas for all management screens. */
export function MenuLayer() {
  const panel = useGameStore((s) => s.panel);
  const notice = useGameStore((s) => s.notice);
  const notify = useGameStore((s) => s.notify);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => notify(null), 2200);
    return () => clearTimeout(t);
  }, [notice, notify]);
  return <div className="px-layer">
    {panel === "menu" && <StartMenu />}
    {panel === "party" && <PartyPanel />}
    {panel === "box" && <BoxPanel />}
    {panel === "bag" && <BagPanel />}
    {panel === "dex" && <PokedexPanel />}
    {panel === "mart" && <MartPanel />}
    {panel === "starter" && <StarterPicker />}
    {panel === "redeem" && <RedeemPanel />}
    {panel === "moveLab" && <MoveLabPanel />}
    {panel === "gacha" && <GachaPanel />}
    {notice && <div className="px-notice">{notice}</div>}
  </div>;
}
