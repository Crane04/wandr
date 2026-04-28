import React from "react";
import type { GameName } from "../types";

const GAME_LABEL: Record<GameName, string> = {
  tetris: "Tetris",
  brickbreaker: "Brick Breaker",
  snake: "Snake",
  racing: "Racing",
  tank: "Tank",
};

export const RetroShell: React.FC<{
  currentGame: GameName;
  score: number;
  highScore: number;
  poweredOn: boolean;
  lives: number | null;
  onSelectGame: (g: GameName) => void;
  controls?: React.ReactNode;
  children: React.ReactNode;
}> = ({
  currentGame,
  score,
  highScore,
  poweredOn,
  lives,
  onSelectGame,
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
            <div className="retro-screen-title">HI-SCORE/SCORE</div>
            <div className="retro-scoreline">
              <span className="retro-score">{highScore.toString().padStart(5, "0")}</span>
              <span className="retro-score">{score.toString().padStart(5, "0")}</span>
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
                  <span className="v">{highScore.toString().padStart(5, "0")}</span>
                </div>
                {typeof lives === "number" ? (
                  <div className="retro-side-row">
                    <span className="k">LIVES</span>
                    <span className="v retro-lives">{Array.from({ length: lives }, () => "♥").join(" ")}</span>
                  </div>
                ) : null}
                <div className="retro-side-row">
                  <span className="k">LEVEL</span>
                  <span className="v">01</span>
                </div>
                <div className="retro-side-row">
                  <span className="k">SPEED</span>
                  <span className="v">01</span>
                </div>
              </aside>
              {!poweredOn ? (
                <div className="retro-power-off" aria-hidden="true" />
              ) : null}
            </div>
          </div>
        </div>

        <div className="retro-bottom">{controls}</div>
      </div>
    </div>
  );
};
