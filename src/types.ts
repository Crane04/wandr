export type GameName =
  | "fighter"
  | "tetris"
  | "brickbreaker"
  | "snake"
  | "racing";
export type GameStatus = "idle" | "playing" | "paused" | "gameover";

export interface GameScore {
  fighter: number;
  tetris: number;
  brickbreaker: number;
  snake: number;
  racing: number;
}

export interface GameState {
  currentGame: GameName;
  status: GameStatus;
  poweredOn: boolean;
  soundEnabled: boolean;
  musicEnabled: boolean;
  lives: number | null;
  level: number | null;
  speed: number | null;
  scores: GameScore;
  highScores: GameScore;
  setCurrentGame: (game: GameName) => void;
  setStatus: (status: GameStatus) => void;
  setPoweredOn: (on: boolean) => void;
  togglePower: () => void;
  toggleSound: () => void;
  toggleMusic: () => void;
  playSfx: (
    name:
      | "game-over"
      | "game-start"
      | "move"
      | "power-on"
      | "select"
      | "shot"
  ) => void;
  setLives: (lives: number | null) => void;
  setLevel: (level: number | null) => void;
  setSpeed: (speed: number | null) => void;
  updateScore: (game: GameName, score: number) => void;
}
