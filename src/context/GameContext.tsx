import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { GameName, GameStatus, GameScore, GameState } from "../types";

const defaultScores: GameScore = {
  tetris: 0,
  brickbreaker: 0,
  snake: 0,
  racing: 0,
  tank: 0,
};

const GameContext = createContext<GameState | null>(null);

const GAME_ORDER: GameName[] = [
  "tetris",
  "brickbreaker",
  "snake",
  "racing",
  "tank",
];

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [poweredOn, setPoweredOn] = useState(true);
  const [currentGame, setCurrentGame] = useState<GameName>(() => {
    try {
      const saved = localStorage.getItem("brickgame-lastgame") as GameName | null;
      return saved && GAME_ORDER.includes(saved) ? saved : "tetris";
    } catch {
      return "tetris";
    }
  });
  const [status, setStatus] = useState<GameStatus>("idle");
  const [scores, setScores] = useState<GameScore>(defaultScores);
  const [highScores, setHighScores] = useState<GameScore>(() => {
    try {
      const saved = localStorage.getItem("brickgame-highscores");
      return saved ? JSON.parse(saved) : { ...defaultScores };
    } catch {
      return { ...defaultScores };
    }
  });

  const handleSetCurrentGame = useCallback((game: GameName) => {
    setCurrentGame(game);
    setStatus("idle");
    setScores((prev) => ({ ...prev, [game]: 0 }));
  }, []);

  useEffect(() => {
    if (!poweredOn) setStatus("idle");
  }, [poweredOn]);

  useEffect(() => {
    try {
      localStorage.setItem("brickgame-lastgame", currentGame);
    } catch {
      // ignore
    }
  }, [currentGame]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (!poweredOn) return;
      if (status !== "idle") return;

      const idx = GAME_ORDER.indexOf(currentGame);
      const dir = e.key === "ArrowRight" ? 1 : -1;
      const next = GAME_ORDER[(idx + dir + GAME_ORDER.length) % GAME_ORDER.length];
      handleSetCurrentGame(next);
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentGame, handleSetCurrentGame, poweredOn, status]);

  const updateScore = useCallback((game: GameName, score: number) => {
    setScores((prev) => ({ ...prev, [game]: score }));
    setHighScores((prev) => {
      if (score > prev[game]) {
        const next = { ...prev, [game]: score };
        localStorage.setItem("brickgame-highscores", JSON.stringify(next));
        return next;
      }
      return prev;
    });
  }, []);

  const togglePower = useCallback(() => {
    setPoweredOn((prev) => !prev);
  }, []);

  return (
    <GameContext.Provider
      value={{
        currentGame,
        status,
        poweredOn,
        scores,
        highScores,
        setCurrentGame: handleSetCurrentGame,
        setStatus,
        setPoweredOn,
        togglePower,
        updateScore,
      }}
    >
      {children}
    </GameContext.Provider>
  );
};

export const useGame = (): GameState => {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error("useGame must be used within GameProvider");
  return ctx;
};
