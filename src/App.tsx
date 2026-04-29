import React, { useEffect, useMemo, useState } from "react";
import { useGame } from "./context/GameContext";
import { Tetris } from "./games/Tetris";
import { BrickBreaker } from "./games/BrickBreaker";
import { Snake } from "./games/Snake";
import { Racing } from "./games/Racing";
import { Tank } from "./games/Tank";
import { RetroShell } from "./components/RetroShell";
import { OnScreenControls } from "./components/OnScreenControls";
import type { GameName, GameStatus } from "./types";

const GAME_ORDER: GameName[] = [
  "fighter",
  "tetris",
  "brickbreaker",
  "snake",
  "racing",
];

const GAME_LABEL: Record<GameName, string> = {
  fighter: "FIGHT",
  tetris: "TETRIS",
  brickbreaker: "BRICK",
  snake: "SNAKE",
  racing: "RACE",
};

export const App: React.FC = () => {
  const {
    currentGame,
    setCurrentGame,
    scores,
    highScores,
    status,
    poweredOn,
    lives,
    level,
    speed,
  } = useGame();

  const [prevStatus, setPrevStatus] = useState<GameStatus>(status);
  useEffect(() => {
    if (status === prevStatus) return;
    setPrevStatus(status);
  }, [prevStatus, status]);

  const GameView = useMemo(() => {
    switch (currentGame) {
      case "fighter":
        return <Tank />;
      case "tetris":
        return <Tetris />;
      case "brickbreaker":
        return <BrickBreaker />;
      case "snake":
        return <Snake />;
      case "racing":
        return <Racing />;
      default:
        return null;
    }
  }, [currentGame]);

  return (
    <RetroShell
      currentGame={currentGame}
      score={scores[currentGame]}
      highScore={highScores[currentGame]}
      poweredOn={poweredOn}
      lives={lives}
      level={level}
      speed={speed}
      onSelectGame={(g) => {
        setCurrentGame(g);
      }}
      controls={<OnScreenControls currentGame={currentGame} />}
    >
      <div className="retro-game-wrap" data-status={status}>
        {poweredOn && status === "idle" ? (
          <div className="retro-picker" role="group" aria-label="Select game">
            <div className="retro-picker-title">SELECT GAME</div>
            <div className="retro-picker-row" aria-hidden="false">
              {GAME_ORDER.map((g) => (
                <button
                  key={g}
                  type="button"
                  className={
                    g === currentGame
                      ? "retro-picker-brick retro-picker-brick-active"
                      : "retro-picker-brick"
                  }
                  onClick={() => {
                    setCurrentGame(g);
                  }}
                >
                  {GAME_LABEL[g]}
                </button>
              ))}
            </div>
            <div className="retro-picker-hint">
              ◀ ▶ to choose · START/PAUSE to play
            </div>
          </div>
        ) : null}
        {poweredOn && status === "gameover" ? (
          <div className="retro-gameover" role="status" aria-live="polite">
            <div className="retro-gameover-title">GAME OVER</div>
            <div className="retro-gameover-hint">START/PAUSE to restart</div>
          </div>
        ) : null}
        {poweredOn ? GameView : null}
      </div>
    </RetroShell>
  );
};
