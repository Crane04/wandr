import React, { useRef, useEffect, useCallback, useState } from 'react';
import { useGame } from '../context/GameContext';
import { LCD } from "./palette";

const W = 280,
  H = 560;
const PADDLE_W = 60, PADDLE_H = 10, PADDLE_Y = H - 30;
const BALL_R = 7;
const BRICK_ROWS = 12, BRICK_COLS = 7;
const BRICK_W = 34, BRICK_H = 14, BRICK_GAP = 4;
const BRICK_OFFSET_X = 10, BRICK_OFFSET_Y = 60;

const COLORS = [LCD.ink2, LCD.ink2, LCD.ink];

interface Ball { x: number; y: number; vx: number; vy: number; }
interface Brick { x: number; y: number; alive: boolean; color: string; }

const makeBricks = (): Brick[] => {
  const bricks: Brick[] = [];
  for (let r = 0; r < BRICK_ROWS; r++)
    for (let c = 0; c < BRICK_COLS; c++)
      bricks.push({
        x: BRICK_OFFSET_X + c * (BRICK_W + BRICK_GAP),
        y: BRICK_OFFSET_Y + r * (BRICK_H + BRICK_GAP),
        alive: true,
        color: COLORS[r % COLORS.length],
      });
  return bricks;
};

export const BrickBreaker: React.FC = () => {
  const { status, setStatus, updateScore, currentGame } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const paddleX = useRef(W / 2 - PADDLE_W / 2);
  const ball = useRef<Ball>({ x: W / 2, y: H / 2, vx: 3, vy: -3 });
  const bricks = useRef<Brick[]>(makeBricks());
  const scoreRef = useRef(0);
  const livesRef = useRef(3);
  const rafRef = useRef<number>(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const keysRef = useRef<Record<string, boolean>>({});

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, W, H);

    // Bricks
    bricks.current.forEach(b => {
      if (!b.alive) return;
      ctx.fillStyle = LCD.ink;
      ctx.fillRect(b.x, b.y, BRICK_W, BRICK_H);
    });

    // Paddle
    const px = paddleX.current;
    ctx.fillStyle = LCD.ink;
    ctx.fillRect(px, PADDLE_Y, PADDLE_W, PADDLE_H);

    // Ball
    ctx.fillStyle = LCD.ink;
    const size = BALL_R * 2;
    ctx.fillRect(ball.current.x - BALL_R, ball.current.y - BALL_R, size, size);
  }, []);

  const loop = useCallback(() => {
    const b = ball.current;

    // Paddle movement
    if (keysRef.current['ArrowLeft']) paddleX.current = Math.max(0, paddleX.current - 5);
    if (keysRef.current['ArrowRight']) paddleX.current = Math.min(W - PADDLE_W, paddleX.current + 5);

    b.x += b.vx;
    b.y += b.vy;

    // Wall bounce
    if (b.x - BALL_R <= 0) { b.x = BALL_R; b.vx = Math.abs(b.vx); }
    if (b.x + BALL_R >= W) { b.x = W - BALL_R; b.vx = -Math.abs(b.vx); }
    if (b.y - BALL_R <= 0) { b.y = BALL_R; b.vy = Math.abs(b.vy); }

    // Paddle collision
    if (b.y + BALL_R >= PADDLE_Y && b.y + BALL_R <= PADDLE_Y + PADDLE_H + 5 &&
        b.x >= paddleX.current - BALL_R && b.x <= paddleX.current + PADDLE_W + BALL_R) {
      b.vy = -Math.abs(b.vy);
      const offset = (b.x - (paddleX.current + PADDLE_W / 2)) / (PADDLE_W / 2);
      b.vx = offset * 5;
    }

    // Bottom — lose life
    if (b.y + BALL_R > H) {
      livesRef.current--;
      setDisplayLives(livesRef.current);
      if (livesRef.current <= 0) {
        setStatus('gameover');
        return;
      }
      b.x = W / 2; b.y = H / 2; b.vx = 3; b.vy = -3;
    }

    // Brick collision
    bricks.current.forEach(brick => {
      if (!brick.alive) return;
      if (b.x + BALL_R > brick.x && b.x - BALL_R < brick.x + BRICK_W &&
          b.y + BALL_R > brick.y && b.y - BALL_R < brick.y + BRICK_H) {
        brick.alive = false;
        b.vy *= -1;
        scoreRef.current += 10;
        setDisplayScore(scoreRef.current);
        updateScore(currentGame, scoreRef.current);
      }
    });

    // Win
    if (bricks.current.every(b => !b.alive)) {
      bricks.current = makeBricks();
      scoreRef.current += 100;
      setDisplayScore(scoreRef.current);
    }

    draw();
    rafRef.current = requestAnimationFrame(loop);
  }, [draw, setStatus, updateScore, currentGame]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    setDisplayScore(0);
    setDisplayLives(3);
    bricks.current = makeBricks();
    ball.current = { x: W / 2, y: H / 2, vx: 3, vy: -3 };
    paddleX.current = W / 2 - PADDLE_W / 2;
    setStatus('playing');
  }, [setStatus]);

  useEffect(() => {
    if (status === 'playing') {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      draw();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, loop, draw]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => { keysRef.current[e.key] = true; e.preventDefault(); };
    const up = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); };
  }, []);

  // Touch/mouse control
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current!.getBoundingClientRect();
    paddleX.current = Math.min(W - PADDLE_W, Math.max(0, e.clientX - rect.left - PADDLE_W / 2));
  };

  return (
    <div className="game-container">
      <div className="game-stats">
        <div className="stat"><span>SCORE</span><strong>{displayScore}</strong></div>
        <div className="stat"><span>LIVES</span><strong>{'❤️'.repeat(displayLives)}</strong></div>
      </div>
      <canvas ref={canvasRef} width={W} height={H} className="game-canvas" onMouseMove={handleMouseMove} />
      <div className="game-controls">
        {status === 'idle' || status === 'gameover' ? (
          <button className="btn-start" onClick={startGame}>{status === 'gameover' ? '▶ RESTART' : '▶ START'}</button>
        ) : (
          <button className="btn-pause" onClick={() => setStatus(status === 'playing' ? 'paused' : 'playing')}>
            {status === 'playing' ? '⏸ PAUSE' : '▶ RESUME'}
          </button>
        )}
      </div>
      <div className="key-hints"><span>← → Move Paddle</span><span>Mouse to control</span></div>
    </div>
  );
};
