import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
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
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem("wandr_sound");
      if (raw === "0") return false;
      if (raw === "1") return true;
      return true;
    } catch {
      return true;
    }
  });
  const [musicEnabled, setMusicEnabled] = useState(() => {
    try {
      const raw = localStorage.getItem("wandr_music");
      if (raw === "0") return false;
      if (raw === "1") return true;
      return true;
    } catch {
      return true;
    }
  });
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

  const audioCache = useRef<Map<string, HTMLAudioElement>>(new Map());

  const playSfx = useCallback(
    (
      name:
        | "game-over"
        | "game-start"
        | "move"
        | "power-on"
        | "select"
        | "shot",
    ) => {
      if (!soundEnabled) return;
      if (typeof window === "undefined") return;
      if (document.visibilityState === "hidden") return;
      const src = `/sounds/${name}.mp3`;
      const base = (() => {
        const cached = audioCache.current.get(src);
        if (cached) return cached;
        const a = new Audio(src);
        a.preload = "auto";
        audioCache.current.set(src, a);
        return a;
      })();

      const inst = base.cloneNode(true) as HTMLAudioElement;
      inst.volume = 0.6;
      void inst.play().catch(() => {
        // ignore autoplay blocks / interruptions
      });
    },
    [soundEnabled],
  );

  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("wandr_sound", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const toggleMusic = useCallback(() => {
    setMusicEnabled((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("wandr_music", next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
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
      if (
        e.key !== "ArrowLeft" &&
        e.key !== "ArrowRight" &&
        e.key !== "ArrowUp" &&
        e.key !== "ArrowDown"
      )
        return;
      if (!poweredOn) return;
      if (status !== "idle") return;

      const cols =
        typeof window !== "undefined" &&
        typeof window.matchMedia !== "undefined" &&
        window.matchMedia("(max-width: 520px)").matches
          ? 1
          : 3;

      const idx = GAME_ORDER.indexOf(currentGame);
      let nextIdx = idx;
      if (e.key === "ArrowRight") {
        nextIdx = (idx + 1) % GAME_ORDER.length;
      } else if (e.key === "ArrowLeft") {
        nextIdx = (idx - 1 + GAME_ORDER.length) % GAME_ORDER.length;
      } else if (e.key === "ArrowDown") {
        const candidate = idx + cols;
        nextIdx = candidate < GAME_ORDER.length ? candidate : idx;
      } else if (e.key === "ArrowUp") {
        const candidate = idx - cols;
        nextIdx = candidate >= 0 ? candidate : idx;
      }

      const next = GAME_ORDER[nextIdx];
      handleSetCurrentGame(next);
      playSfx("select");
      e.preventDefault();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [currentGame, handleSetCurrentGame, playSfx, poweredOn, status]);

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
        soundEnabled,
        musicEnabled,
        lives,
        level,
        speed,
        scores,
        highScores,
        setCurrentGame: handleSetCurrentGame,
        setStatus,
        setPoweredOn,
        togglePower,
        toggleSound,
        toggleMusic,
        playSfx,
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
