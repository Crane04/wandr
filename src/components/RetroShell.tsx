import React from "react";
import type { GameName } from "../types";

export const RetroShell: React.FC<{
  currentGame: GameName;
  score: number;
  highScore: number;
  poweredOn: boolean;
  lives: number | null;
  level: number | null;
  speed: number | null;
  onSelectGame: (g: GameName) => void;
  topControls?: React.ReactNode;
  settingsPanel?: React.ReactNode;
  controls?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  currentGame,
  score,
  highScore,
  poweredOn,
  lives,
  level,
  speed,
  onSelectGame,
  topControls,
  settingsPanel,
  controls,
  children,
}) => {
  return (
    <div className="retro">
      <div className="retro-device" data-power={poweredOn ? "on" : "off"}>
        <div className="retro-holes retro-holes-left" aria-hidden="true" />
        <div className="retro-holes retro-holes-right" aria-hidden="true" />

        <div className="retro-screen-frame">
          <div className="retro-screen-top">
            <div className="retro-screen-title">
              wandr by{" "}
              <a
                href="https://crane04.dev"
                target="_blank"
                rel="noopener noreferrer"
              >
                crane04
              </a>
            </div>
            {topControls ? (
              <div className="retro-screen-controls">{topControls}</div>
            ) : null}
            <div className="retro-scoreline">
              <span className="retro-score">
                {highScore.toString().padStart(5, "0")}
              </span>
              <span className="retro-score">
                {score.toString().padStart(5, "0")}
              </span>
            </div>
          </div>

          <div className="retro-screen">
            <div className="retro-lcd">
              <div className="retro-game">
                <div className="retro-playfield">{children}</div>
              </div>
              <aside className="retro-side">
                <div className="retro-side-row">
                  <span className="k">SCORE</span>
                  <span className="v">{score.toString().padStart(5, "0")}</span>
                </div>
                <div className="retro-side-row">
                  <span className="k">HI-SCORE</span>
                  <span className="v">
                    {highScore.toString().padStart(5, "0")}
                  </span>
                </div>
                {typeof lives === "number" ? (
                  <div className="retro-side-row">
                    <span className="k">LIVES</span>
                    <span className="v retro-lives">
                      {Array.from({ length: lives }, () => "♥").join(" ")}
                    </span>
                  </div>
                ) : null}
                <div className="retro-side-row">
                  <span className="k">LEVEL</span>
                  <span className="v">
                    {(level ?? 1).toString().padStart(2, "0")}
                  </span>
                </div>
                <div className="retro-side-row">
                  <span className="k">SPEED</span>
                  <span className="v">
                    {(speed ?? 1).toString().padStart(2, "0")}
                  </span>
                </div>
              </aside>
              {!poweredOn ? (
                <div className="retro-power-off" aria-hidden="true" />
              ) : null}
            </div>
          </div>

          {settingsPanel ? (
            <div className="retro-settings-host">{settingsPanel}</div>
          ) : null}
        </div>

        <div className="retro-bottom">{controls}</div>
      </div>
    </div>
  );
};
