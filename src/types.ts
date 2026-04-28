export type GameName = "tetris" | "brickbreaker" | "snake" | "racing" | "tank";
export type GameStatus = "idle" | "playing" | "paused" | "gameover";

export interface GameScore {
  tetris: number;
  brickbreaker: number;
  snake: number;
  racing: number;
  tank: number;
}

export interface GameState {
  currentGame: GameName;
  status: GameStatus;
  scores: GameScore;
  highScores: GameScore;
  setCurrentGame: (game: GameName) => void;
  setStatus: (status: GameStatus) => void;
  updateScore: (game: GameName, score: number) => void;
}

