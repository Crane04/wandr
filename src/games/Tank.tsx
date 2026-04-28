import React, { useRef, useEffect, useCallback, useState } from "react";
import { useGame } from "../context/GameContext";
import { LCD } from "./palette";

const W = 280,
  H = 520;
const TANK_W = 30,
  TANK_H = 30;
const BULLET_W = 4,
  BULLET_H = 12;
const ENEMY_W = 28,
  ENEMY_H = 28;

interface Bullet {
  x: number;
  y: number;
  fromPlayer: boolean;
}
interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  shootTimer: number;
  color: string;
  level: number;
}
interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
}
interface Impact {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  life: number;
  color: string;
}

const ENEMY_COLORS = [LCD.ink2, LCD.ink2, LCD.ink];

const drawTank = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  color: string,
  w: number,
  h: number,
  angle = 0,
) => {
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.fillRect(-w / 2, -h / 2, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.fillRect(-w / 2 + 2, -h / 2 + 2, w - 4, h - 4);
  ctx.fillStyle = color;
  ctx.fillRect(-4, -h / 2 - 8, 8, 12);
  ctx.restore();
};

export const Tank: React.FC = () => {
  const {
    status,
    setStatus,
    updateScore,
    currentGame,
    setLives,
    setLevel,
    setSpeed,
  } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerPos = useRef({ x: W / 2 - TANK_W / 2, y: H - TANK_H - 20 });
  const bullets = useRef<Bullet[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const impacts = useRef<Impact[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(5);
  const rafRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const frameRef = useRef(0);
  const shootCooldown = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(3);
  const wave = useRef(1);

  const spawnWave = useCallback((level: number) => {
    const clampedLevel = Math.max(1, Math.min(30, level));
    // Start with 2 enemies at level 1, increase by 1 per level, cap at 12
    const count = Math.min(12, 1 + Math.floor(clampedLevel / 2));
    for (let i = 0; i < count; i++) {
      const col = Math.floor(Math.random() * 6);
      const baseVy = 0.6 + clampedLevel * 0.12;
      const baseShoot = Math.max(35, 140 - clampedLevel * 6);
      enemies.current.push({
        x: col * 42 + 10,
        y: -50 - i * 60,
        vx: (Math.random() - 0.5) * 1.5,
        vy: baseVy,
        hp: 1 + Math.floor(clampedLevel / 3),
        shootTimer: baseShoot + Math.floor(Math.random() * 80),
        color: ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)],
        level: clampedLevel,
      });
    }
  }, []);

  const drawIdle = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, W, H);

    const p = playerPos.current;
    drawTank(ctx, p.x, p.y, LCD.ink, TANK_W, TANK_H);
  }, []);

  const explode = (x: number, y: number, color: string) => {
    for (let i = 0; i < 15; i++) {
      particles.current.push({
        x,
        y,
        vx: (Math.random() - 0.5) * 7,
        vy: (Math.random() - 0.5) * 7,
        life: 30,
        color,
      });
    }
  };

  const smash = (x: number, y: number, color: string) => {
    // Create radial impact rings
    impacts.current.push({
      x,
      y,
      radius: 0,
      maxRadius: 24,
      life: 15,
      color,
    });
  };

  const loop = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    frameRef.current++;

    ctx.clearRect(0, 0, W, H);

    // Player movement
    const p = playerPos.current;
    const speed = 4;
    if (keysRef.current["ArrowLeft"]) p.x = Math.max(0, p.x - speed);
    if (keysRef.current["ArrowRight"]) p.x = Math.min(W - TANK_W, p.x + speed);
    if (keysRef.current["ArrowUp"]) p.y = Math.max(0, p.y - speed);
    if (keysRef.current["ArrowDown"]) p.y = Math.min(H - TANK_H, p.y + speed);

    // Shoot
    if (shootCooldown.current > 0) shootCooldown.current--;
    if (keysRef.current[" "] && shootCooldown.current === 0) {
      bullets.current.push({
        x: p.x + TANK_W / 2 - BULLET_W / 2,
        y: p.y - BULLET_H,
        fromPlayer: true,
      });
      shootCooldown.current = 15;
    }

    // Enemy spawn
    if (enemies.current.length === 0) {
      spawnWave(wave.current);
      setLevel(wave.current);
      setSpeed(wave.current);
      wave.current++;
    }

    // Update enemies
    enemies.current = enemies.current.filter((e) => {
      e.x += e.vx;
      e.y += e.vy;
      if (e.x < 0 || e.x > W - ENEMY_W) e.vx *= -1;

      // Enemy shoot
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        bullets.current.push({
          x: e.x + ENEMY_W / 2 - BULLET_W / 2,
          y: e.y + ENEMY_H,
          fromPlayer: false,
        });
        const baseShoot = Math.max(28, 120 - e.level * 4);
        e.shootTimer = baseShoot + Math.floor(Math.random() * 70);
      }

      // Reached bottom
      if (e.y > H + ENEMY_H) {
        livesRef.current--;
        setDisplayLives(livesRef.current);
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          setStatus("gameover");
        }
        return false;
      }

      // Player collision
      if (
        e.y + ENEMY_H > p.y &&
        e.y < p.y + TANK_H &&
        e.x + ENEMY_W > p.x &&
        e.x < p.x + TANK_W
      ) {
        explode(p.x + TANK_W / 2, p.y + TANK_H / 2, LCD.ink);
        livesRef.current--;
        setDisplayLives(livesRef.current);
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          setStatus("gameover");
          return false;
        }
        p.x = W / 2 - TANK_W / 2;
        p.y = H - TANK_H - 20;
        return false;
      }

      drawTank(ctx, e.x, e.y, e.color, ENEMY_W, ENEMY_H, Math.PI);
      return true;
    });

    // Bullets
    bullets.current = bullets.current.filter((b) => {
      b.y += b.fromPlayer ? -8 : 5;
      if (b.y < -20 || b.y > H + 20) return false;

      ctx.fillStyle = b.fromPlayer ? LCD.ink : LCD.ink2;
      ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);

      if (b.fromPlayer) {
        let hit = false;

        // Check collision with enemy bullets (defense mechanism)
        bullets.current = bullets.current.filter((b2) => {
          if (
            !b2.fromPlayer &&
            b.x + BULLET_W > b2.x &&
            b.x < b2.x + BULLET_W &&
            b.y < b2.y + BULLET_H &&
            b.y + BULLET_H > b2.y
          ) {
            // Bullets cancel each other out
            explode((b.x + b2.x) / 2, (b.y + b2.y) / 2, LCD.ink2);
            smash((b.x + b2.x) / 2, (b.y + b2.y) / 2, LCD.ink);
            hit = true;
            return false; // Remove enemy bullet
          }
          return true;
        });
        if (hit) return false; // Remove player bullet

        enemies.current = enemies.current.filter((e) => {
          if (
            !hit &&
            b.x + BULLET_W > e.x &&
            b.x < e.x + ENEMY_W &&
            b.y < e.y + ENEMY_H &&
            b.y + BULLET_H > e.y
          ) {
            e.hp--;
            if (e.hp <= 0) {
              explode(e.x + ENEMY_W / 2, e.y + ENEMY_H / 2, e.color);
              scoreRef.current += 100;
              setDisplayScore(scoreRef.current);
              updateScore(currentGame, scoreRef.current);
            }
            hit = true;
            return e.hp > 0;
          }
          return true;
        });
        if (hit) return false;
      } else {
        if (
          b.x + BULLET_W > p.x &&
          b.x < p.x + TANK_W &&
          b.y + BULLET_H > p.y &&
          b.y < p.y + TANK_H
        ) {
          explode(p.x + TANK_W / 2, p.y + TANK_H / 2, LCD.ink);
          livesRef.current--;
          setDisplayLives(livesRef.current);
          setLives(livesRef.current);
          if (livesRef.current <= 0) setStatus("gameover");
          p.x = W / 2 - TANK_W / 2;
          p.y = H - TANK_H - 20;
          return false;
        }
      }
      return true;
    });

    // Particles
    particles.current = particles.current.filter((pt) => {
      pt.x += pt.vx;
      pt.y += pt.vy;
      pt.life--;
      ctx.globalAlpha = pt.life / 30;
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, 4, 4);
      ctx.globalAlpha = 1;
      return pt.life > 0;
    });

    // Impact smashing effects
    impacts.current = impacts.current.filter((imp) => {
      imp.radius = (imp.maxRadius * (15 - imp.life)) / 15;
      imp.life--;
      ctx.strokeStyle = imp.color;
      ctx.globalAlpha = (imp.life / 15) * 0.8;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(imp.x, imp.y, imp.radius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      return imp.life > 0;
    });

    // Draw player
    drawTank(ctx, p.x, p.y, LCD.ink, TANK_W, TANK_H);

    rafRef.current = requestAnimationFrame(loop);
  }, [
    spawnWave,
    setLevel,
    setLives,
    setSpeed,
    setStatus,
    updateScore,
    currentGame,
  ]);

  const startGame = useCallback(() => {
    scoreRef.current = 0;
    livesRef.current = 3;
    frameRef.current = 0;
    wave.current = 1;
    bullets.current = [];
    enemies.current = [];
    particles.current = [];
    playerPos.current = { x: W / 2 - TANK_W / 2, y: H - TANK_H - 20 };
    setDisplayScore(0);
    setDisplayLives(3);
    setLives(3);
    setLevel(1);
    setSpeed(1);
    setStatus("playing");
  }, [setLives, setLevel, setSpeed, setStatus]);

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
      e.preventDefault();
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
          <span>LIVES</span>
          <strong>{"🛡️".repeat(Math.max(0, displayLives))}</strong>
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
        <span>Space Shoot</span>
      </div>
    </div>
  );
};
