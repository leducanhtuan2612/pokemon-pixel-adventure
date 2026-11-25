import { useEffect, useRef, useState } from "react";

/**
 * Keyboard navigation for pixel menus: arrows/WASD move, Enter/Z/Space confirm,
 * Esc/X/Backspace go back. Mouse hover/click also work via `setIndex`.
 */
export function useMenuNav(count: number, onSelect: (i: number) => void, onBack: () => void, cols = 1, enabled = true, initial = 0) {
  const [index, setIndex] = useState(initial);
  const ref = useRef({ index, count, onSelect, onBack, cols });
  ref.current = { index, count, onSelect, onBack, cols };

  useEffect(() => { if (index >= count && count > 0) setIndex(count - 1); }, [count, index]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      const { index: i, count: n, cols: c } = ref.current;
      const k = e.key.toLowerCase();
      let handled = true;
      if (k === "arrowdown" || k === "s") setIndex(Math.min(n - 1, i + c));
      else if (k === "arrowup" || k === "w") setIndex(Math.max(0, i - c));
      else if ((k === "arrowright" || k === "d") && c > 1) setIndex(Math.min(n - 1, i + 1));
      else if ((k === "arrowleft" || k === "a") && c > 1) setIndex(Math.max(0, i - 1));
      else if (k === "enter" || k === "z" || k === " ") { if (n > 0) ref.current.onSelect(i); }
      else if (k === "escape" || k === "x" || k === "backspace") ref.current.onBack();
      else handled = false;
      if (handled) { e.preventDefault(); e.stopPropagation(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  return [index, setIndex] as const;
}
