import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
} from "react";
import { GameName, GameStatus, GameScore, GameState } from "../types";

const defaultScores: GameScore = {
  fighter: 0,
  tetris: 0,
  brickbreaker: 0,
  snake: 0,
  racing: 0,
};

const GameContext = createContext<GameState | null>(null);

const GAME_ORDER: GameName[] = [
  "fighter",
  "tetris",
  "brickbreaker",
  "snake",
  "racing",
];

export const GameProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [poweredOn, setPoweredOn] = useState(true);
  const [lives, setLives] = useState<number | null>(null);
  const [level, setLevel] = useState<number | null>(null);
  const [speed, setSpeed] = useState<number | null>(null);
  const [currentGame, setCurrentGame] = useState<GameName>(() => {
    try {
      const raw = localStorage.getItem("brickgame-lastgame");
      const saved = raw === "tank" ? "fighter" : raw;
      return saved && GAME_ORDER.includes(saved as GameName)
        ? (saved as GameName)
        : "fighter";
    } catch {
      return "fighter";
    }
  });
  const [status, setStatus] = useState<GameStatus>("idle");
  const [scores, setScores] = useState<GameScore>(defaultScores);
  const [highScores, setHighScores] = useState<GameScore>(() => {
    try {
      const saved = localStorage.getItem("brickgame-highscores");
      const parsed: Partial<Record<string, unknown>> | null = saved
        ? JSON.parse(saved)
        : null;
      const tankScore =
        parsed && typeof parsed["tank"] === "number" ? (parsed["tank"] as number) : 0;
      const fighterScore =
        parsed && typeof parsed["fighter"] === "number"
          ? (parsed["fighter"] as number)
          : tankScore;
      return {
        ...defaultScores,
        ...(parsed ?? {}),
        fighter: fighterScore,
      } as GameScore;
    } catch {
      return { ...defaultScores };
    }
  });

  const handleSetCurrentGame = useCallback((game: GameName) => {
    setCurrentGame(game);
    setStatus("idle");
    setScores((prev) => ({ ...prev, [game]: 0 }));
    setLives(null);
    setLevel(null);
    setSpeed(null);
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
    setLives(null);
    setLevel(null);
    setSpeed(null);
  }, []);

  return (
    <GameContext.Provider
      value={{
        currentGame,
        status,
        poweredOn,
        lives,
        level,
        speed,
        scores,
        highScores,
        setCurrentGame: handleSetCurrentGame,
        setStatus,
        setPoweredOn,
        togglePower,
        setLives,
        setLevel,
        setSpeed,
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
