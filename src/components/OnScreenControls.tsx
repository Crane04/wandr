import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { GameName } from "../types";

type ControlKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | " ";

const dispatchKey = (key: ControlKey, type: "keydown" | "keyup") => {
  const evt = new KeyboardEvent(type, { key, bubbles: true });
  window.dispatchEvent(evt);
};

const REPEAT_MS: Partial<Record<ControlKey, number>> = {
  ArrowLeft: 120,
  ArrowRight: 120,
  ArrowDown: 70,
};

const clickGameStartPause = () => {
  const btn = document.querySelector<HTMLButtonElement>(
    ".game-controls button",
  );
  btn?.click();
};

export const OnScreenControls: React.FC<{ currentGame: GameName }> = ({
  currentGame,
}) => {
  const [pressed, setPressed] = useState<Set<ControlKey>>(() => new Set());
  const repeatTimers = useRef<Map<ControlKey, number>>(new Map());

  const stopRepeating = useCallback((key: ControlKey) => {
    const t = repeatTimers.current.get(key);
    if (t) window.clearInterval(t);
    repeatTimers.current.delete(key);
  }, []);

  const press = useCallback(
    (key: ControlKey) => {
      setPressed((prev) => new Set(prev).add(key));
      dispatchKey(key, "keydown");
      stopRepeating(key);
      const ms = REPEAT_MS[key];
      if (ms) {
        const interval = window.setInterval(
          () => dispatchKey(key, "keydown"),
          ms,
        );
        repeatTimers.current.set(key, interval);
      }
    },
    [stopRepeating],
  );

  const release = useCallback(
    (key: ControlKey) => {
      setPressed((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
      stopRepeating(key);
      dispatchKey(key, "keyup");
    },
    [stopRepeating],
  );

  useEffect(() => {
    const handleUp = () => {
      for (const k of repeatTimers.current.keys()) release(k);
    };
    window.addEventListener("blur", handleUp);
    return () => window.removeEventListener("blur", handleUp);
  }, [release]);

  const bind = useCallback(
    (key: ControlKey) => {
      const isDown = pressed.has(key);
      return {
        onPointerDown: (e: React.PointerEvent) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          e.preventDefault();
          if (!pressed.has(key)) press(key);
        },
        onPointerUp: (e: React.PointerEvent) => {
          e.preventDefault();
          release(key);
        },
        onPointerCancel: (e: React.PointerEvent) => {
          e.preventDefault();
          release(key);
        },
        onPointerLeave: (e: React.PointerEvent) => {
          if (e.buttons === 0) release(key);
        },
        "aria-pressed": isDown,
      } as const;
    },
    [press, pressed, release],
  );

  const action = useMemo(() => {
    if (currentGame === "tetris")
      return { key: "ArrowUp" as const, label: "ROTATE" };
    if (currentGame === "tank") return { key: " " as const, label: "SHOOT" };
    if (currentGame === "brickbreaker")
      return { key: " " as const, label: "ACTION" };
    return { key: " " as const, label: "ACTION" };
  }, [currentGame]);

  return (
    <div className="retro-controls" aria-label="On-screen controls">
      <div className="retro-dpad" role="group" aria-label="D-pad">
        <button
          className="dpad up"
          type="button"
          data-label="UP"
          {...bind("ArrowUp")}
        >
          ▲
        </button>
        <button
          className="dpad left"
          type="button"
          data-label="LEFT"
          {...bind("ArrowLeft")}
        >
          ◀
        </button>

        <button
          className="dpad right"
          type="button"
          data-label="RIGHT"
          {...bind("ArrowRight")}
        >
          ▶
        </button>
        <button
          className="dpad down"
          type="button"
          data-label="DOWN"
          {...bind("ArrowDown")}
        >
          ▼
        </button>
      </div>

      <div className="retro-mid">
        <button
          className="retro-small-btn"
          type="button"
          onClick={() => clickGameStartPause()}
        >
          START/PAUSE
        </button>
        <div className="retro-toggles" role="group" aria-label="Toggles">
          <div className="retro-toggle">
            <span className="retro-dot" aria-hidden="true" />
            <span className="retro-toggle-label">ON/OFF</span>
          </div>
          <div className="retro-toggle">
            <span className="retro-dot" aria-hidden="true" />
            <span className="retro-toggle-label">SOUND</span>
          </div>
          <div className="retro-toggle">
            <span className="retro-dot" aria-hidden="true" />
            <span className="retro-toggle-label">MUSIC</span>
          </div>
        </div>
      </div>

      <div className="retro-action" role="group" aria-label="Action button">
        <button className="action-btn" type="button" {...bind(action.key)}>
          ●
        </button>
        <div className="action-label">{action.label}</div>
      </div>
    </div>
  );
};
