import React, { useEffect, useRef, useCallback, useState } from "react";
import { useGame } from "../context/GameContext";
import { LCD } from "./palette";

const COLS = 10;
const ROWS = 20;
const CELL = 28;

const TETROMINOES = [
  { shape: [[1, 1, 1, 1]], color: LCD.ink },
  {
    shape: [
      [1, 1],
      [1, 1],
    ],
    color: LCD.ink2,
  },
  {
    shape: [
      [1, 1, 1],
      [0, 1, 0],
    ],
    color: LCD.ink,
  },
  {
    shape: [
      [1, 1, 1],
      [1, 0, 0],
    ],
    color: LCD.ink2,
  },
  {
    shape: [
      [1, 1, 1],
      [0, 0, 1],
    ],
    color: LCD.ink,
  },
  {
    shape: [
      [1, 1, 0],
      [0, 1, 1],
    ],
    color: LCD.ink2,
  },
  {
    shape: [
      [0, 1, 1],
      [1, 1, 0],
    ],
    color: LCD.ink,
  },
];

type Board = (string | 0)[][];

const emptyBoard = (): Board =>
  Array.from({ length: ROWS }, () => Array(COLS).fill(0));

const rotate = (matrix: number[][]): number[][] => {
  return matrix[0].map((_, i) => matrix.map((row) => row[i]).reverse());
};

export const Tetris: React.FC = () => {
  const { status, setStatus, updateScore, currentGame, setLives } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boardRef = useRef<Board>(emptyBoard());
  const pieceRef = useRef<{
    shape: number[][];
    color: string;
    x: number;
    y: number;
  } | null>(null);
  const scoreRef = useRef(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLines, setDisplayLines] = useState(0);
  const linesRef = useRef(0);

  const randomPiece = useCallback(() => {
    const t = TETROMINOES[Math.floor(Math.random() * TETROMINOES.length)];
    return {
      shape: t.shape,
      color: t.color,
      x: Math.floor(COLS / 2) - 1,
      y: 0,
    };
  }, []);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const drawBlock = (col: number, row: number, color: string) => {
      const x = col * CELL;
      const y = row * CELL;
      const pad = Math.max(1, Math.floor(CELL * 0.08));
      const size = CELL - pad * 2;

      ctx.save();
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.85;
      ctx.fillRect(x + pad, y + pad, size, size);
      ctx.globalAlpha = 0.35;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, Math.floor(CELL * 0.05));
      ctx.strokeRect(x + pad + 0.5, y + pad + 0.5, size - 1, size - 1);
      ctx.restore();
    };

    // Board
    boardRef.current.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) {
          drawBlock(c, r, typeof cell === "string" ? cell : LCD.ink);
        }
      });
    });

    // Active piece
    const p = pieceRef.current;
    if (p) {
      p.shape.forEach((row, r) => {
        row.forEach((cell, c) => {
          if (cell) {
            drawBlock(p.x + c, p.y + r, p.color);
          }
        });
      });
    }
  }, []);

  const isValid = useCallback((shape: number[][], x: number, y: number) => {
    return shape.every((row, r) =>
      row.every((cell, c) => {
        if (!cell) return true;
        const nx = x + c;
        const ny = y + r;
        return (
          nx >= 0 &&
          nx < COLS &&
          ny < ROWS &&
          (ny < 0 || !boardRef.current[ny][nx])
        );
      }),
    );
  }, []);

  const mergePiece = useCallback(() => {
    const p = pieceRef.current;
    if (!p) return;
    p.shape.forEach((row, r) => {
      row.forEach((cell, c) => {
        if (cell) boardRef.current[p.y + r][p.x + c] = p.color;
      });
    });
  }, []);

  const clearLines = useCallback(() => {
    let cleared = 0;
    boardRef.current = boardRef.current.filter((row) => {
      if (row.every((cell) => cell !== 0)) {
        cleared++;
        return false;
      }
      return true;
    });
    while (boardRef.current.length < ROWS)
      boardRef.current.unshift(Array(COLS).fill(0));
    if (cleared > 0) {
      const pts = [0, 100, 300, 500, 800][cleared] || 800;
      scoreRef.current += pts;
      linesRef.current += cleared;
      setDisplayScore(scoreRef.current);
      setDisplayLines(linesRef.current);
      updateScore(currentGame, scoreRef.current);
    }
  }, [updateScore, currentGame]);

  const dropPiece = useCallback(() => {
    const p = pieceRef.current;
    if (!p) return;
    if (isValid(p.shape, p.x, p.y + 1)) {
      p.y++;
    } else {
      mergePiece();
      clearLines();
      const next = randomPiece();
      if (!isValid(next.shape, next.x, next.y)) {
        setStatus("gameover");
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }
      pieceRef.current = next;
    }
    draw();
  }, [isValid, mergePiece, clearLines, randomPiece, draw, setStatus]);

  const startGame = useCallback(() => {
    boardRef.current = emptyBoard();
    scoreRef.current = 0;
    linesRef.current = 0;
    setDisplayScore(0);
    setDisplayLines(0);
    setLives(null);
    pieceRef.current = randomPiece();
    setStatus("playing");
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(dropPiece, 500);
    draw();
  }, [randomPiece, setLives, setStatus, dropPiece, draw]);

  useEffect(() => {
    if (status === "playing") {
      if (intervalRef.current) clearInterval(intervalRef.current);
      intervalRef.current = setInterval(
        dropPiece,
        Math.max(100, 500 - linesRef.current * 5),
      );
    }
    if (status === "paused" && intervalRef.current)
      clearInterval(intervalRef.current);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [status, dropPiece]);

  useEffect(() => {
    draw();
  }, [status, draw]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (status !== "playing") return;
      const p = pieceRef.current;
      if (!p) return;
      if (e.key === "ArrowLeft" && isValid(p.shape, p.x - 1, p.y)) {
        p.x--;
        draw();
      }
      if (e.key === "ArrowRight" && isValid(p.shape, p.x + 1, p.y)) {
        p.x++;
        draw();
      }
      if (e.key === "ArrowDown") {
        dropPiece();
      }
      if (e.key === "ArrowUp") {
        const rotated = rotate(p.shape);
        if (isValid(rotated, p.x, p.y)) {
          p.shape = rotated;
          draw();
        }
      }
      if (e.key === " ") {
        while (isValid(p.shape, p.x, p.y + 1)) p.y++;
        dropPiece();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [status, isValid, dropPiece, draw]);

  return (
    <div className="game-container">
      <div className="game-stats">
        <div className="stat">
          <span>SCORE</span>
          <strong>{displayScore}</strong>
        </div>
        <div className="stat">
          <span>LINES</span>
          <strong>{displayLines}</strong>
        </div>
      </div>
      <canvas
        ref={canvasRef}
        width={COLS * CELL}
        height={ROWS * CELL}
        className="game-canvas"
      />
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
        <span>← → Move</span>
        <span>↑ Rotate</span>
        <span>↓ Soft Drop</span>
        <span>Space Hard Drop</span>
      </div>
    </div>
  );
};
