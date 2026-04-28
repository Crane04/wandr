import React, { useRef, useEffect, useCallback, useState } from "react";
import { useGame } from "../context/GameContext";
import { LCD } from "./palette";

const W = 280,
  H = 400;
const LANE_W = 56,
  LANES = 4;
const ROAD_X = (W - LANE_W * LANES) / 2;
const CAR_W = 36,
  CAR_H = 60;
const ENEMY_W = 34,
  ENEMY_H = 58;

interface Enemy {
  x: number;
  y: number;
  speed: number;
  color: string;
  lane: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}

const CAR_COLORS = [LCD.ink2, LCD.ink2, LCD.ink];
const PLAYER_COLOR = LCD.ink;

const drawCar = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  w: number,
  h: number,
  isPlayer = false,
) => {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(x + 5, y + 10, w - 10, 14);
  ctx.fillRect(x + 5, y + h - 24, w - 10, 14);
  ctx.fillStyle = isPlayer ? LCD.bg2 : "rgba(0,0,0,0.35)";
  ctx.fillRect(x + 3, y + h - 14, 10, 8);
  ctx.fillRect(x + w - 13, y + h - 14, 10, 8);
  if (isPlayer) {
    ctx.fillStyle = LCD.bg2;
    ctx.fillRect(x + 3, y + 6, 10, 8);
    ctx.fillRect(x + w - 13, y + 6, 10, 8);
  }
};

export const Racing: React.FC = () => {
  const { status, setStatus, updateScore, currentGame } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerLane = useRef(1);
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const scoreRef = useRef(0);
  const speedRef = useRef(3);
  const roadOffset = useRef(0);
  const rafRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const lastEnemy = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const frameRef = useRef(0);

  const getPlayerX = () =>
    ROAD_X + playerLane.current * LANE_W + (LANE_W - CAR_W) / 2;
  const PLAYER_Y = H - CAR_H - 20;

  const spawnEnemy = useCallback(() => {
    const lane = Math.floor(Math.random() * LANES);
    enemies.current.push({
      x: ROAD_X + lane * LANE_W + (LANE_W - ENEMY_W) / 2,
      y: -ENEMY_H,
      speed: speedRef.current * (0.6 + Math.random() * 0.8),
      color: CAR_COLORS[Math.floor(Math.random() * CAR_COLORS.length)],
      lane,
    });
  }, []);

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = LCD.ink;
    ctx.fillRect(ROAD_X, 0, 2, H);
    ctx.fillRect(ROAD_X + LANE_W * LANES - 2, 0, 2, H);

    drawCar(ctx, getPlayerX(), H - CAR_H - 20, PLAYER_COLOR, CAR_W, CAR_H, true);
  }, []);

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    frameRef.current++;

    // Move player
    const targetLane = playerLane.current;
    if (
      keysRef.current["ArrowLeft"] &&
      frameRef.current % 8 === 0 &&
      targetLane > 0
    )
      playerLane.current--;
    if (
      keysRef.current["ArrowRight"] &&
      frameRef.current % 8 === 0 &&
      targetLane < LANES - 1
    )
      playerLane.current++;

    // Road
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = LCD.ink;
    ctx.fillRect(ROAD_X, 0, 2, H);
    ctx.fillRect(ROAD_X + LANE_W * LANES - 2, 0, 2, H);

    // Score
    scoreRef.current++;
    if (frameRef.current % 60 === 0) {
      setDisplayScore(Math.floor(scoreRef.current / 10));
      updateScore(currentGame, Math.floor(scoreRef.current / 10));
      speedRef.current = Math.min(10, 3 + scoreRef.current / 600);
    }

    // Spawn enemies
    if (
      frameRef.current - lastEnemy.current >
      Math.max(40, 90 - scoreRef.current / 100)
    ) {
      spawnEnemy();
      lastEnemy.current = frameRef.current;
    }

    const px = getPlayerX();

    // Update/draw enemies
    enemies.current = enemies.current.filter((e) => {
      e.y += e.speed;
      if (e.y > H + ENEMY_H) return false;

      // Collision
      if (
        e.y + ENEMY_H > PLAYER_Y &&
        e.y < PLAYER_Y + CAR_H &&
        e.x + ENEMY_W > px + 4 &&
        e.x < px + CAR_W - 4
      ) {
        for (let i = 0; i < 20; i++) {
          particles.current.push({
            x: px + CAR_W / 2,
            y: PLAYER_Y + CAR_H / 2,
            vx: (Math.random() - 0.5) * 8,
            vy: (Math.random() - 0.5) * 8,
            life: 40,
            color: [LCD.ink, LCD.ink2, LCD.ink2][Math.floor(Math.random() * 3)],
          });
        }
        setStatus("gameover");
        return false;
      }
      drawCar(ctx, e.x, e.y, e.color, ENEMY_W, ENEMY_H);
      return true;
    });

    // Particles
    particles.current = particles.current.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.life--;
      ctx.globalAlpha = p.life / 40;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x, p.y, 4, 4);
      ctx.globalAlpha = 1;
      return p.life > 0;
    });

    // Player
    drawCar(ctx, px, PLAYER_Y, PLAYER_COLOR, CAR_W, CAR_H, true);

    rafRef.current = requestAnimationFrame(loop);
  }, [spawnEnemy, setStatus, updateScore, currentGame]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    speedRef.current = 3;
    frameRef.current = 0;
    lastEnemy.current = 0;
    enemies.current = [];
    particles.current = [];
    playerLane.current = 1;
    roadOffset.current = 0;
    setDisplayScore(0);
    setStatus("playing");
  }, [setStatus]);

  useEffect(() => {
    if (status === "playing") {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(loop);
    } else {
      cancelAnimationFrame(rafRef.current);
      drawIdle();
    }
    return () => cancelAnimationFrame(rafRef.current);
  }, [status, loop, drawIdle]);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      keysRef.current[e.key] = true;
    };
    const up = (e: KeyboardEvent) => {
      keysRef.current[e.key] = false;
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, []);

  return (
    <div className="game-container">
      <div className="game-stats">
        <div className="stat">
          <span>SCORE</span>
          <strong>{displayScore}</strong>
        </div>
        <div className="stat">
          <span>SPEED</span>
          <strong>{speedRef.current.toFixed(1)}x</strong>
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
        <span>← → Switch Lanes</span>
      </div>
    </div>
  );
};
