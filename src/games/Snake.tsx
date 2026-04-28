import React, { useEffect, useRef, useCallback, useState } from "react";
import { useGame } from "../context/GameContext";
import { LCD } from "./palette";

// Match the other games' playfield aspect (280x560) so it uses the full
// available height in the retro screen.
const COLS = 14,
  ROWS = 28,
  CELL = 20;
const W = COLS * CELL,
  H = ROWS * CELL;

interface Point {
  x: number;
  y: number;
}

const randFood = (snake: Point[]): Point => {
  let p: Point;
  do {
    p = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === p.x && s.y === p.y));
  return p;
};

export const Snake: React.FC = () => {
  const { status, setStatus, updateScore, currentGame, setLives } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const startPos = useCallback(
    (): Point => ({ x: Math.floor(COLS / 2), y: Math.floor(ROWS / 2) }),
    [],
  );
  const snake = useRef<Point[]>([startPos()]);
  const dir = useRef<Point>({ x: 1, y: 0 });
  const nextDir = useRef<Point>({ x: 1, y: 0 });
  const food = useRef<Point>({ x: 5, y: 5 });
  const scoreRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayScore, setDisplayScore] = useState(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Visible playfield boundary so it's always clear where the "walls" are,
    // even when CSS borders are disabled (retro mode).
    ctx.save();
    ctx.strokeStyle = "rgba(45, 59, 42, 0.35)";
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, W - 2, H - 2);
    ctx.restore();

    const { x: fx, y: fy } = food.current;
    ctx.fillStyle = LCD.ink;
    ctx.beginPath();
    ctx.arc(
      fx * CELL + CELL / 2,
      fy * CELL + CELL / 2,
      CELL / 2 - 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();

    // Snake
    snake.current.forEach((seg, i) => {
      ctx.fillStyle = LCD.ink;
      ctx.fillRect(seg.x * CELL, seg.y * CELL, CELL, CELL);
    });
  }, []);

  const tick = useCallback(() => {
    dir.current = nextDir.current;
    const head = snake.current[0];
    const newHead = { x: head.x + dir.current.x, y: head.y + dir.current.y };

    // Wall collision
    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      setStatus("gameover");
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    // Self collision
    if (snake.current.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      setStatus("gameover");
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    snake.current = [newHead, ...snake.current];
    if (newHead.x === food.current.x && newHead.y === food.current.y) {
      scoreRef.current += 10;
      setDisplayScore(scoreRef.current);
      updateScore(currentGame, scoreRef.current);
      food.current = randFood(snake.current);
    } else {
      snake.current.pop();
    }
    draw();
  }, [draw, setStatus, updateScore, currentGame]);

  const startGame = useCallback(() => {
    snake.current = [startPos()];
    dir.current = { x: 1, y: 0 };
    nextDir.current = { x: 1, y: 0 };
    food.current = randFood(snake.current);
    scoreRef.current = 0;
    setDisplayScore(0);
    setLives(null);
    setStatus("playing");
  }, [setLives, setStatus, startPos]);

  useEffect(() => {
    if (status === "playing") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(
        tick,
        Math.max(80, 150 - scoreRef.current),
      );
    }
    if (status === "paused" && intervalRef.current)
      clearInterval(intervalRef.current);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, tick]);

  useEffect(() => {
    draw();
  }, [status, draw]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const d = dir.current;
      if (e.key === "ArrowUp" && d.y !== 1) nextDir.current = { x: 0, y: -1 };
      if (e.key === "ArrowDown" && d.y !== -1) nextDir.current = { x: 0, y: 1 };
      if (e.key === "ArrowLeft" && d.x !== 1) nextDir.current = { x: -1, y: 0 };
      if (e.key === "ArrowRight" && d.x !== -1)
        nextDir.current = { x: 1, y: 0 };
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, []);

  return (
    <div className="game-container">
      <div className="game-stats">
        <div className="stat">
          <span>SCORE</span>
          <strong>{displayScore}</strong>
        </div>
        <div className="stat">
          <span>LENGTH</span>
          <strong>{snake.current.length}</strong>
        </div>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="game-canvas" />
      <div className="game-controls">
        {status === "idle" || status === "gameover" ? (
          <button className="btn-start" onClick={startGame}>
            {status === "gameover" ? "▶ RESTART" : "▶ START"}
          </button>
        ) : (
          <button
            className="btn-pause"
            onClick={() =>
              setStatus(status === "playing" ? "paused" : "playing")
            }
          >
            {status === "playing" ? "⏸ PAUSE" : "▶ RESUME"}
          </button>
        )}
      </div>
      <div className="key-hints">
        <span>← ↑ → ↓ Move</span>
      </div>
    </div>
  );
};
