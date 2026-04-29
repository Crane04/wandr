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
const BOSS_W = 52,
  BOSS_H = 52;
const BONUS_W = 18,
  BONUS_H = 18;
const MAX_LIVES = 8;

const clampLives = (n: number) => Math.max(0, Math.min(MAX_LIVES, n));

interface Bullet {
  x: number;
  y: number;
  owner: "player" | "ally" | "enemy";
  vx?: number;
  vy?: number;
}
interface Enemy {
  x: number;
  y: number;
  vx: number;
  vy: number;
  hp: number;
  maxHp: number;
  hitCooldown: number;
  shootTimer: number;
  color: string;
  level: number;
  kind: "enemy" | "boss";
  guns: 1 | 2 | 3;
  combo: boolean;
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
interface Bonus {
  x: number;
  y: number;
  type:
    | "multishot"
    | "comboshot"
    | "gunheads"
    | "lives"
    | "refill"
    | "shield"
    | "bomb";
}
interface Bomb {
  x: number;
  y: number;
  vy: number;
  hp: number;
}

const ENEMY_COLORS = [LCD.ink2, LCD.ink2, LCD.ink];

const enemySize = (e: Enemy) => {
  return e.kind === "boss"
    ? { w: BOSS_W, h: BOSS_H }
    : { w: ENEMY_W, h: ENEMY_H };
};

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

const drawBoss = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  // Transparent body with a black border + 2 guns.
  ctx.save();
  // Rotate 180deg so the boss "faces" downward like other enemies.
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-w / 2, -h / 2);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(0, 0, w, h);

  // Inner border for a more "boss" look.
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(3, 3, w - 6, h - 6);
  ctx.globalAlpha = 1;

  // Two gun barrels (solid black).
  // In the un-rotated coordinate system guns sit "above" the body;
  // the rotation flips them to point downward on screen.
  ctx.fillStyle = "#000";
  ctx.fillRect(w * 0.22 - 4, -10, 8, 12);
  ctx.fillRect(w * 0.78 - 4, -10, 8, 12);
  ctx.restore();
};

const drawMultiGunEnemy = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  guns: 2 | 3,
) => {
  // Transparent body with black border (boss-like), with multiple gun barrels.
  ctx.save();
  // Rotate 180deg so the barrels point downward on screen.
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate(Math.PI);
  ctx.translate(-w / 2, -h / 2);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(0, 0, w, h);
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(2, 2, w - 4, h - 4);
  ctx.globalAlpha = 1;

  ctx.fillStyle = "#000";
  const barrelXs = guns === 3 ? [0.2, 0.5, 0.8] : [0.32, 0.68];
  for (const fx of barrelXs) {
    ctx.fillRect(w * fx - 3, -9, 6, 11);
  }
  ctx.restore();
};

const drawAlly = (
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
) => {
  // Transparent body with black borders.
  ctx.save();
  ctx.lineWidth = 2;
  ctx.strokeStyle = "#000";
  ctx.strokeRect(x, y, w, h);
  ctx.globalAlpha = 0.6;
  ctx.strokeRect(x + 2, y + 2, w - 4, h - 4);
  ctx.globalAlpha = 1;
  // Small cannon
  ctx.fillStyle = "#000";
  ctx.fillRect(x + w / 2 - 3, y - 8, 6, 10);
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
    playSfx,
  } = useGame();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const playerPos = useRef({ x: W / 2 - TANK_W / 2, y: H - TANK_H - 20 });
  const allyPos = useRef({ x: W / 2 - TANK_W / 2, y: H - TANK_H - 70 });
  const allyAliveRef = useRef(false);
  const allyVelRef = useRef({ vx: 0, vy: 0 });
  const bullets = useRef<Bullet[]>([]);
  const enemies = useRef<Enemy[]>([]);
  const particles = useRef<Particle[]>([]);
  const impacts = useRef<Impact[]>([]);
  const bonuses = useRef<Bonus[]>([]);
  const bombs = useRef<Bomb[]>([]);
  const scoreRef = useRef(0);
  const livesRef = useRef(5);
  const shieldHpRef = useRef(0); // when >0, absorbs enemy bullets (3 hits total)
  const multishotCountRef = useRef(0); // 0-3, determines bullet count: 1 + count
  const gunHeadsRef = useRef(1); // 1-4, number of heads shooting
  const bonusBombFramesRef = useRef(0); // when >0, bomb blast is active on shoot
  const comboShotUntilMsRef = useRef(0); // when > now, 8-direction shot is active
  const allyMultishotCountRef = useRef(0);
  const allyGunHeadsRef = useRef(1);
  const allyComboShotUntilMsRef = useRef(0);
  const allyShieldHpRef = useRef(0);
  const rafRef = useRef<number>(0);
  const keysRef = useRef<Record<string, boolean>>({});
  const frameRef = useRef(0);
  const shootCooldown = useRef(0);
  const allyShootCooldown = useRef(0);
  const [displayScore, setDisplayScore] = useState(0);
  const [displayLives, setDisplayLives] = useState(5);
  const [displayShield, setDisplayShield] = useState(0);
  const waveCooldownFrames = useRef(0);
  const levelRef = useRef(1);
  const wavesSpawnedInLevelRef = useRef(0);
  const bossesSpawnedInLevelRef = useRef(0);
  const lastSpawnedRef = useRef<"wave" | "boss" | null>(null);

  // Slow down wave-to-wave progression so early levels don’t fly by.
  // (~1s of breathing room between cleared waves at 60fps)
  const WAVE_COOLDOWN_FRAMES = 60;
  // Increase later by changing this constant.
  const BOSSES_PER_LEVEL = 1;
  const BOSS_HIT_COOLDOWN_FRAMES = 2;
  const ALLY_START_LEVEL = 6;
  const BONUS_BOMB_DURATION_FRAMES = 7 * 60;
  const BONUS_BOMB_RADIUS = 96;
  const BONUS_BOMB_BOSS_DAMAGE = 7;
  const COMBO_SHOT_DURATION_MS = 5_000;
  const ALLY_COMBO_SHOT_DURATION_MS = 3_250;
  const BOSS_MIN_Y = 8;
  const BOSS_MAX_Y = Math.floor(H * 0.42);

  const spawnWave = useCallback((level: number) => {
    const clampedLevel = Math.max(1, Math.min(30, level));
    // Start with 2 enemies at level 1, increase gradually, cap at 12.
    // (The previous formula could spawn only 1 enemy at level 1, making waves clear too fast.)
    const count = Math.min(12, 2 + Math.floor(clampedLevel / 2));
    for (let i = 0; i < count; i++) {
      const col = Math.floor(Math.random() * 6);
      // Slightly faster enemy descent to keep pacing snappy.
      const baseVy = 0.9 + clampedLevel * 0.13;
      // Enemies shoot a bit more often as difficulty ramps.
      const baseShoot = Math.max(0, 120 - clampedLevel * 6);
      // Some enemies spawn with 2 or 3 guns (rarer) for variety.
      const gunRoll = Math.random();
      const guns: 1 | 2 | 3 = gunRoll < 0.08 ? 3 : gunRoll < 0.28 ? 2 : 1;
      // Rare: some enemies get a small "combo" shot (3-way spread).
      const combo = Math.random() < 0.05;
      const baseHp = 1 + Math.floor(clampedLevel / 3);
      const gunHpBonus = guns === 3 ? 2 : guns === 2 ? 1 : 0;
      const hp = baseHp + gunHpBonus;
      enemies.current.push({
        x: col * 42 + 10,
        y: -50 - i * 60,
        vx: (Math.random() - 0.5) * 1.5,
        vy: baseVy,
        hp,
        maxHp: hp,
        hitCooldown: 0,
        shootTimer: baseShoot + Math.floor(Math.random() * 60),
        color: ENEMY_COLORS[Math.floor(Math.random() * ENEMY_COLORS.length)],
        level: clampedLevel,
        kind: "enemy",
        guns,
        combo,
      });
    }
  }, []);

  const spawnBoss = useCallback((level: number) => {
    const clampedLevel = Math.max(1, Math.min(30, level));
    // Keep boss tied to enemy speed curve, but a bit slower vertically.
    const baseVy = 0.6 + clampedLevel * 0.1;
    // Slower vertical descent than regular enemies, but faster zig-zag (horizontal) movement.
    const bossVy = baseVy * 0.65;
    const baseShoot = Math.max(22, 105 - clampedLevel * 3);
    const bossHp = Math.min(45, 8 + Math.floor(clampedLevel * 1.4));
    enemies.current.push({
      x: W / 2 - BOSS_W / 2,
      y: -BOSS_H - 10,
      vx: (Math.random() - 0.5) * 1.5 * 0.9,
      vy: bossVy,
      hp: bossHp,
      maxHp: bossHp,
      hitCooldown: 0,
      shootTimer: baseShoot + Math.floor(Math.random() * 60),
      color: "#000",
      level: clampedLevel,
      kind: "boss",
      guns: 2,
      combo: false,
    });
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

  const spawnBonus = (x: number, y: number, force = false) => {
    // 30% chance to spawn a bonus (unless forced)
    if (!force && Math.random() > 0.3) return;

    // Bonus selection (shield is rarer, and only if not already active).
    // Bonus bomb is extremely rare.
    if (Math.random() < 0.02) {
      bonuses.current.push({
        x: x - BONUS_W / 2,
        y,
        type: "bomb",
      });
      return;
    }

    const rand = Math.random();
    let type: Bonus["type"];
    if (shieldHpRef.current === 0 && rand < 0.12) {
      type = "shield";
    } else if (rand < 0.16) {
      type = "comboshot";
    } else if (rand < 0.18) {
      type = "refill";
    } else if (rand < 0.46) {
      type = "multishot";
    } else if (rand < 0.78) {
      type = "gunheads";
    } else {
      type = "lives";
    }
    bonuses.current.push({
      x: x - BONUS_W / 2,
      y,
      type,
    });
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
    const allyActive = levelRef.current >= ALLY_START_LEVEL;
    if (allyActive && !allyAliveRef.current) {
      allyAliveRef.current = true;
      allyPos.current = { x: W / 2 - TANK_W / 2, y: H - TANK_H - 70 };
      allyShootCooldown.current = 0;
      allyVelRef.current = { vx: (Math.random() - 0.5) * 2, vy: 0 };
    }
    const speed = 4;
    if (keysRef.current["ArrowLeft"]) p.x = Math.max(0, p.x - speed);
    if (keysRef.current["ArrowRight"]) p.x = Math.min(W - TANK_W, p.x + speed);
    if (keysRef.current["ArrowUp"]) p.y = Math.max(0, p.y - speed);
    if (keysRef.current["ArrowDown"]) p.y = Math.min(H - TANK_H, p.y + speed);

    if (bonusBombFramesRef.current > 0) bonusBombFramesRef.current--;
    const comboActive = performance.now() < comboShotUntilMsRef.current;
    const allyComboActive = performance.now() < allyComboShotUntilMsRef.current;

    // Ally AI movement (free will): chases enemies with some randomness.
    if (allyActive && allyAliveRef.current) {
      const a = allyPos.current;
      const allySpeed = 2.6;
      const ALLY_MIN_Y = Math.floor(H * 0.62); // keep ally safely in the lower band
      const ALLY_MAX_Y = H - TANK_H - 10;

      // Dampen velocity so it doesn't "run away" and drift upward forever.
      allyVelRef.current.vx *= 0.92;
      allyVelRef.current.vy *= 0.88;

      const ax = a.x + TANK_W / 2;
      const ay = a.y + TANK_H / 2;

      // Pick a target: enemies and bonuses are both priorities.
      // - Enemies: prioritize ones nearer the ally's "safe band" horizontally.
      // - Bonuses: prioritize ones that are reachable soon (not too far above).
      let enemyTarget: Enemy | null = null;
      let bestEnemyScore = Number.POSITIVE_INFINITY;
      for (const e of enemies.current) {
        const { w: ew, h: eh } = enemySize(e);
        const ex = e.x + ew / 2;
        const ey = e.y + eh / 2;
        if (ey < -80 || ey > H + 80) continue;
        const dx = ex - ax;
        const dyToBand = Math.max(0, ALLY_MIN_Y - ey);
        const score = dx * dx + dyToBand * dyToBand * 6;
        if (score < bestEnemyScore) {
          bestEnemyScore = score;
          enemyTarget = e;
        }
      }

      let bonusTarget: Bonus | null = null;
      let bestBonusScore = Number.POSITIVE_INFINITY;
      for (const b of bonuses.current) {
        const bx = b.x + BONUS_W / 2;
        const by = b.y + BONUS_H / 2;
        if (by < ALLY_MIN_Y - 120) continue;
        const dx = bx - ax;
        const dy = by - ay;
        // Slight bias toward collecting bonuses when distances are similar.
        const score = (dx * dx + dy * dy) * 0.9;
        if (score < bestBonusScore) {
          bestBonusScore = score;
          bonusTarget = b;
        }
      }

      const targetKind =
        bonusTarget && bestBonusScore <= bestEnemyScore ? "bonus" : "enemy";

      // Every so often, add a small random "wiggle" so it feels alive.
      if (frameRef.current % 45 === 0) {
        allyVelRef.current.vx += (Math.random() - 0.5) * 1.6;
        // Keep vertical wiggle tiny; upward drift is dangerous for the ally.
        allyVelRef.current.vy += (Math.random() - 0.5) * 0.12;
      }

      if (targetKind === "bonus" && bonusTarget) {
        const tx = bonusTarget.x + BONUS_W / 2 - TANK_W / 2;
        // For bonuses, allow following the falling y (within the safe band).
        const ty = Math.max(
          ALLY_MIN_Y,
          Math.min(ALLY_MAX_Y, bonusTarget.y + BONUS_H / 2 - TANK_H / 2),
        );

        const toX = tx - a.x;
        const toY = ty - a.y;
        allyVelRef.current.vx += Math.sign(toX) * 0.22;
        allyVelRef.current.vy += Math.sign(toY) * 0.28;
      } else if (enemyTarget) {
        const { w: tw, h: th } = enemySize(enemyTarget);
        const tx = enemyTarget.x + tw / 2 - TANK_W / 2;
        // Don't chase vertically toward enemies; stay near the player in a safe band.
        const preferredY = p.y - 70;
        const ty = Math.max(ALLY_MIN_Y, Math.min(ALLY_MAX_Y - 40, preferredY));

        const toX = tx - a.x;
        const toY = ty - a.y;
        allyVelRef.current.vx += Math.sign(toX) * 0.18;
        allyVelRef.current.vy += Math.sign(toY) * 0.22;
      }

      // Keep ally away from the main player (so they don't overlap).
      const dxp = a.x + TANK_W / 2 - (p.x + TANK_W / 2);
      const dyp = a.y + TANK_H / 2 - (p.y + TANK_H / 2);
      const dist2 = dxp * dxp + dyp * dyp;
      if (dist2 < 52 * 52) {
        allyVelRef.current.vx += Math.sign(dxp || Math.random() - 0.5) * 0.8;
        allyVelRef.current.vy += Math.sign(dyp || Math.random() - 0.5) * 0.6;
      }

      // Dodge incoming enemy bullets (instinct).
      // Look for enemy bullets above/near the ally and sidestep out of their x-lane.
      let closestThreat: Bullet | null = null;
      let closestAbove = Number.POSITIVE_INFINITY;
      for (const b of bullets.current) {
        if (b.owner !== "enemy") continue;
        const above = a.y - b.y; // >0 means bullet is above the ally
        if (above < -10 || above > 220) continue; // include a larger look-ahead window
        const ax = a.x + TANK_W / 2;
        const bx = b.x + BULLET_W / 2;
        const dx = bx - ax;
        if (Math.abs(dx) > 36) continue; // be less strict so dodging triggers reliably
        if (above < closestAbove) {
          closestAbove = above;
          closestThreat = b;
        }
      }
      if (closestThreat) {
        const ax = a.x + TANK_W / 2;
        const bx = closestThreat.x + BULLET_W / 2;
        const dir = ax <= bx ? -1 : 1; // move away from bullet x
        // Strong lateral impulse; if it's very close, force a full-speed sidestep.
        if (closestAbove < 50) {
          allyVelRef.current.vx = dir * allySpeed;
        } else {
          allyVelRef.current.vx += dir * 2.0;
        }
        // Bias slightly downward when dodging so it doesn't drift upward into danger.
        allyVelRef.current.vy += 0.25;
      }

      // Safety rails: if the ally gets too high, push it back down quickly.
      if (a.y < ALLY_MIN_Y) allyVelRef.current.vy += 0.9;
      if (a.y > ALLY_MAX_Y) allyVelRef.current.vy -= 0.9;

      // Clamp velocity and apply.
      allyVelRef.current.vx = Math.max(
        -allySpeed,
        Math.min(allySpeed, allyVelRef.current.vx),
      );
      allyVelRef.current.vy = Math.max(
        -allySpeed,
        Math.min(allySpeed, allyVelRef.current.vy),
      );
      a.x = Math.max(0, Math.min(W - TANK_W, a.x + allyVelRef.current.vx));
      a.y = Math.max(
        ALLY_MIN_Y,
        Math.min(ALLY_MAX_Y, a.y + allyVelRef.current.vy),
      );
    }

    // Shoot
    if (shootCooldown.current > 0) shootCooldown.current--;
    if (keysRef.current[" "] && shootCooldown.current === 0) {
      playSfx("shot");
      // Fire bullets from each gun head
      for (let head = 0; head < gunHeadsRef.current; head++) {
        const offsetX = (head - (gunHeadsRef.current - 1) / 2) * 10;
        const bulletX = p.x + TANK_W / 2 - BULLET_W / 2 + offsetX;

        if (comboActive) {
          // 8-direction combo shot (wide spread) for 5s.
          const speed = 8;
          const base = -Math.PI / 2;
          const offsets = [-0.66, -0.46, -0.28, -0.12, 0, 0.12, 0.28, 0.46];
          // If multishot is active too, slightly "double" each direction (keeps perf sane).
          const multiFactor = multishotCountRef.current > 0 ? 2 : 1;
          const micro = 0.06;
          for (const off of offsets) {
            for (let i = 0; i < multiFactor; i++) {
              const tweak = i === 0 ? 0 : off === 0 ? micro : Math.sign(off) * micro;
              const ang = base + off + tweak;
              bullets.current.push({
                x: bulletX,
                y: p.y - BULLET_H,
                owner: "player",
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
              });
            }
          }
        } else {
          // Fire multishot bullets if bonus is active
          for (let shot = 0; shot < 1 + multishotCountRef.current; shot++) {
            bullets.current.push({
              x: bulletX,
              y: p.y - BULLET_H,
              owner: "player",
            });
          }
        }
      }

      // Bonus bomb: on shoot, blast any nearby enemies (strong vs boss).
      if (bonusBombFramesRef.current > 0) {
        const cx = p.x + TANK_W / 2;
        const cy = p.y;
        impacts.current.push({
          x: cx,
          y: cy,
          radius: 0,
          maxRadius: BONUS_BOMB_RADIUS + 18,
          life: 15,
          color: "#000",
        });
        explode(cx, cy, LCD.ink);

        enemies.current = enemies.current.filter((e) => {
          const { w: ew, h: eh } = enemySize(e);
          const ex = e.x + ew / 2;
          const ey = e.y + eh / 2;
          const dx = ex - cx;
          const dy = ey - cy;
          if (dx * dx + dy * dy > BONUS_BOMB_RADIUS * BONUS_BOMB_RADIUS) {
            return true;
          }

          if (e.kind === "boss") {
            e.hitCooldown = 0;
            e.hp -= BONUS_BOMB_BOSS_DAMAGE;
            smash(ex, ey, LCD.ink);
            explode(ex, ey, LCD.ink2);
            if (e.hp > 0) return true;
          } else {
            e.hp = 0;
            smash(ex, ey, LCD.ink);
            explode(ex, ey, e.color);
          }

          spawnBonus(ex, ey, e.kind === "boss");
          scoreRef.current += e.kind === "boss" ? 500 : 100;
          setDisplayScore(scoreRef.current);
          updateScore(currentGame, scoreRef.current);
          explode(ex, ey, e.color);
          return false;
        });
      }
      shootCooldown.current = 15;
    }

    // Ally auto-shoot (cannot hurt the player)
    if (allyActive && allyAliveRef.current) {
      if (allyShootCooldown.current > 0) allyShootCooldown.current--;
      if (allyShootCooldown.current === 0 && enemies.current.length > 0) {
        const a = allyPos.current;
        // Ally has its own bonus state (doesn't mirror the player).
        for (let head = 0; head < allyGunHeadsRef.current; head++) {
          const offsetX = (head - (allyGunHeadsRef.current - 1) / 2) * 10;
          const bulletX = a.x + TANK_W / 2 - BULLET_W / 2 + offsetX;
          if (allyComboActive) {
            const speed = 8;
            const base = -Math.PI / 2;
            const offsets = [-0.66, -0.46, -0.28, -0.12, 0, 0.12, 0.28, 0.46];
            const multiFactor = allyMultishotCountRef.current > 0 ? 2 : 1;
            const micro = 0.06;
            for (const off of offsets) {
              for (let i = 0; i < multiFactor; i++) {
                const tweak = i === 0 ? 0 : off === 0 ? micro : Math.sign(off) * micro;
                const ang = base + off + tweak;
                bullets.current.push({
                  x: bulletX,
                  y: a.y - BULLET_H,
                  owner: "ally",
                  vx: Math.cos(ang) * speed,
                  vy: Math.sin(ang) * speed,
                });
              }
            }
          } else {
            for (let shot = 0; shot < 1 + allyMultishotCountRef.current; shot++) {
              bullets.current.push({
                x: bulletX,
                y: a.y - BULLET_H,
                owner: "ally",
              });
            }
          }
        }
        allyShootCooldown.current = 24;
      }
    }

    // Wave/Boss spawning:
    // - 2 waves per level
    // - then a boss
    // - next level begins after boss dies
    if (enemies.current.length === 0) {
      // If we just cleared a boss, advance the level now.
      if (lastSpawnedRef.current === "boss") {
        if (bossesSpawnedInLevelRef.current >= BOSSES_PER_LEVEL) {
          levelRef.current = Math.min(30, levelRef.current + 1);
          wavesSpawnedInLevelRef.current = 0;
          bossesSpawnedInLevelRef.current = 0;
        }
        lastSpawnedRef.current = null;
      }

      const level = levelRef.current;

      // First spawn happens immediately; everything else gets a short cooldown.
      const isFirstSpawn =
        level === 1 &&
        wavesSpawnedInLevelRef.current === 0 &&
        lastSpawnedRef.current === null;

      if (!isFirstSpawn) {
        if (waveCooldownFrames.current === 0) {
          waveCooldownFrames.current = WAVE_COOLDOWN_FRAMES;
        }
        waveCooldownFrames.current--;
      }

      if (waveCooldownFrames.current <= 0) {
        waveCooldownFrames.current = 0;

        if (wavesSpawnedInLevelRef.current < 2) {
          spawnWave(level);
          wavesSpawnedInLevelRef.current++;
          lastSpawnedRef.current = "wave";
        } else {
          if (bossesSpawnedInLevelRef.current < BOSSES_PER_LEVEL) {
            spawnBoss(level);
            bossesSpawnedInLevelRef.current++;
            lastSpawnedRef.current = "boss";
          } else {
            // Safety: if boss quota was already met, force level advance next frame.
            lastSpawnedRef.current = "boss";
          }
        }

        setLevel(level);
        setSpeed(level);
      }
    }

    // Track if player was hit this frame to prevent multiple hits
    let playerHitThisFrame = false;

    // Bomb drop (occasional hazard). Costs 3 lives on hit.
    const bossAlive = enemies.current.some((e) => e.kind === "boss");
    if (frameRef.current % (bossAlive ? 180 : 360) === 0) {
      if (Math.random() < (bossAlive ? 0.35 : 0.18)) {
        bombs.current.push({
          x: Math.random() * (W - 14) + 7,
          y: -20,
          vy: 2.2 + levelRef.current * 0.03,
          hp: 2,
        });
      }
    }

    // Update enemies
    enemies.current = enemies.current.filter((e) => {
      const { w: ew, h: eh } = enemySize(e);
      if (e.hitCooldown > 0) e.hitCooldown--;
      e.x += e.vx;
      e.y += e.vy;
      if (e.x < 0 || e.x > W - ew) e.vx *= -1;
      if (e.kind === "boss") {
        // Boss should never descend into the lower playfield: keep it hovering
        // in the upper band while moving left/right and up/down.
        if (e.y < BOSS_MIN_Y) {
          e.y = BOSS_MIN_Y;
          e.vy = Math.abs(e.vy);
        } else if (e.y > BOSS_MAX_Y) {
          e.y = BOSS_MAX_Y;
          e.vy = -Math.abs(e.vy);
        }
      }

      // Enemy shoot
      e.shootTimer--;
      if (e.shootTimer <= 0) {
        if (e.kind === "boss") {
          // 2 guns
          bullets.current.push({
            x: e.x + ew * 0.22 - BULLET_W / 2,
            y: e.y + eh,
            owner: "enemy",
          });
          bullets.current.push({
            x: e.x + ew * 0.78 - BULLET_W / 2,
            y: e.y + eh,
            owner: "enemy",
          });
          // Boss fires more often than regular enemies.
          const baseShoot = Math.max(14, 70 - e.level * 2);
          e.shootTimer = baseShoot + Math.floor(Math.random() * 30);
        } else {
          if (e.combo) {
            // 3-way "combo" spread (rare enemy trait).
            const speed = 5;
            const base = Math.PI / 2; // downward
            const spread = 0.28;
            const angles = [base - spread, base, base + spread];
            const bx = e.x + ew / 2 - BULLET_W / 2;
            const by = e.y + eh;
            for (const ang of angles) {
              bullets.current.push({
                x: bx,
                y: by,
                owner: "enemy",
                vx: Math.cos(ang) * speed,
                vy: Math.sin(ang) * speed,
              });
            }
          } else {
            const offsets =
              e.guns === 3 ? [-8, 0, 8] : e.guns === 2 ? [-6, 6] : [0];
            for (const dx of offsets) {
              bullets.current.push({
                x: e.x + ew / 2 - BULLET_W / 2 + dx,
                y: e.y + eh,
                owner: "enemy",
              });
            }
          }
          const baseShoot = Math.max(22, 95 - e.level * 4);
          e.shootTimer = baseShoot + Math.floor(Math.random() * 50);
        }
      }

      // Reached bottom
      if (e.y > H + eh) {
        livesRef.current = clampLives(livesRef.current - 1);
        setDisplayLives(livesRef.current);
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          setStatus("gameover");
        }
        return false;
      }

      // Player collision
      if (
        !playerHitThisFrame &&
        e.y + eh > p.y &&
        e.y < p.y + TANK_H &&
        e.x + ew > p.x &&
        e.x < p.x + TANK_W
      ) {
        playerHitThisFrame = true;
        explode(p.x + TANK_W / 2, p.y + TANK_H / 2, LCD.ink);
        livesRef.current = clampLives(livesRef.current - 1);
        setDisplayLives(livesRef.current);
        setLives(livesRef.current);
        if (livesRef.current <= 0) {
          setStatus("gameover");
        }
        p.x = W / 2 - TANK_W / 2;
        p.y = H - TANK_H - 20;
        return false; // Remove this enemy
      }

      // Ally collision (instant game over)
      const allyActive = levelRef.current >= ALLY_START_LEVEL;
      if (allyActive && allyAliveRef.current) {
        const a = allyPos.current;
        if (
          !playerHitThisFrame &&
          e.y + eh > a.y &&
          e.y < a.y + TANK_H &&
          e.x + ew > a.x &&
          e.x < a.x + TANK_W
        ) {
          playerHitThisFrame = true;
          explode(a.x + TANK_W / 2, a.y + TANK_H / 2, LCD.ink);
          allyAliveRef.current = false;
          setStatus("gameover");
          return false;
        }
      }

      if (e.kind === "boss") {
        drawBoss(ctx, e.x, e.y, ew, eh);
        // Boss life indicator (percentage) above the boss.
        const pct = Math.max(
          0,
          Math.min(100, Math.ceil((e.hp / Math.max(1, e.maxHp)) * 100)),
        );
        const label = `${pct}%`;
        const barW = 44;
        const barH = 16;
        const barX = e.x + ew / 2 - barW / 2;
        const barY = Math.max(6, e.y - barH - 6);
        ctx.save();
        ctx.fillStyle = LCD.bg;
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.fillRect(barX, barY, barW, barH);
        ctx.strokeRect(barX, barY, barW, barH);
        ctx.fillStyle = "#000";
        ctx.font = "bold 10px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(label, barX + barW / 2, barY + barH / 2 + 0.5);
        ctx.restore();
      } else {
        if (e.guns > 1) {
          drawMultiGunEnemy(ctx, e.x, e.y, ew, eh, e.guns as 2 | 3);
        } else {
          drawTank(ctx, e.x, e.y, e.color, ew, eh, Math.PI);
        }
      }
      return true;
    });

    // Bullets
    const bulletsToRemove = new Set<Bullet>();

    bullets.current = bullets.current.filter((b) => {
      const friendly = b.owner === "player" || b.owner === "ally";
      if (friendly) {
        b.x += b.vx ?? 0;
        b.y += b.vy ?? -8;
      } else {
        b.y += b.vy ?? 5;
      }
      if (b.y < -20 || b.y > H + 20) return false;
      if (b.x < -20 || b.x > W + 20) return false;

      ctx.fillStyle = friendly ? LCD.ink : LCD.ink2;
      ctx.fillRect(b.x, b.y, BULLET_W, BULLET_H);

      if (friendly) {
        let hit = false;

        // Shoot bombs down (2 hits).
        for (let i = 0; i < bombs.current.length; i++) {
          const bomb = bombs.current[i];
          if (
            b.x + BULLET_W > bomb.x - 8 &&
            b.x < bomb.x + 8 &&
            b.y + BULLET_H > bomb.y - 8 &&
            b.y < bomb.y + 8
          ) {
            smash(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink);
            explode(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink2);
            bomb.hp--;
            if (bomb.hp <= 0) {
              explode(bomb.x, bomb.y, LCD.ink);
              bombs.current.splice(i, 1);
              scoreRef.current += 50;
              setDisplayScore(scoreRef.current);
              updateScore(currentGame, scoreRef.current);
            }
            hit = true;
            break;
          }
        }
        if (hit) return false;

        // Check collision with enemy bullets (defense mechanism)
        for (const b2 of bullets.current) {
          if (
            b2.owner === "enemy" &&
            b.x + BULLET_W > b2.x &&
            b.x < b2.x + BULLET_W &&
            b.y < b2.y + BULLET_H &&
            b.y + BULLET_H > b2.y
          ) {
            // Bullets cancel each other out
            explode((b.x + b2.x) / 2, (b.y + b2.y) / 2, LCD.ink2);
            smash((b.x + b2.x) / 2, (b.y + b2.y) / 2, LCD.ink);
            bulletsToRemove.add(b);
            bulletsToRemove.add(b2);
            hit = true;
            break;
          }
        }
        if (hit) return false;

        enemies.current = enemies.current.filter((e) => {
          const { w: ew, h: eh } = enemySize(e);
          if (
            !hit &&
            b.x + BULLET_W > e.x &&
            b.x < e.x + ew &&
            b.y < e.y + eh &&
            b.y + BULLET_H > e.y
          ) {
            // Damage tuning: boss has brief hit-invulnerability so high fire-rate / multishot
            // doesn’t melt it instantly.
            if (e.kind === "boss" && e.hitCooldown > 0) {
              // Still show impact so it feels like bullets are weakening the boss,
              // but consume the bullet.
              smash(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink);
              explode(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink2);
              hit = true;
              return true;
            }
            e.hp--;
            if (e.kind === "boss") {
              e.hitCooldown = BOSS_HIT_COOLDOWN_FRAMES;
              // Better survival: reactive zig-zag "dodge" when hit.
              e.vx += (Math.random() - 0.5) * 1.2;
              e.vx = Math.max(-3, Math.min(3, e.vx));
            }
            // Spark/impact feedback.
            smash(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink);
            if (e.hp <= 0) {
              explode(e.x + ew / 2, e.y + eh / 2, e.color);
              // Boss must always drop a bonus.
              spawnBonus(e.x + ew / 2, e.y + eh / 2, e.kind === "boss");
              scoreRef.current += e.kind === "boss" ? 500 : 100;
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
          // Shield absorbs up to 3 bullets.
          if (shieldHpRef.current > 0) {
            shieldHpRef.current--;
            setDisplayShield(shieldHpRef.current);
            smash(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink);
            explode(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink2);
            if (shieldHpRef.current === 0) {
              setDisplayShield(0);
              smash(p.x + TANK_W / 2, p.y + TANK_H / 2, LCD.ink);
            }
            return false;
          }

          explode(p.x + TANK_W / 2, p.y + TANK_H / 2, LCD.ink);
          livesRef.current = clampLives(livesRef.current - 1);
          setDisplayLives(livesRef.current);
          setLives(livesRef.current);
          if (livesRef.current <= 0) setStatus("gameover");
          p.x = W / 2 - TANK_W / 2;
          p.y = H - TANK_H - 20;
          return false;
        }

        // Enemy bullet can kill ally (instant game over)
        const allyActive = levelRef.current >= ALLY_START_LEVEL;
        if (allyActive && allyAliveRef.current) {
          const a = allyPos.current;
          if (
            b.x + BULLET_W > a.x &&
            b.x < a.x + TANK_W &&
            b.y + BULLET_H > a.y &&
            b.y < a.y + TANK_H
          ) {
            // Ally shield (separate from player shield).
            if (allyShieldHpRef.current > 0) {
              allyShieldHpRef.current--;
              smash(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink);
              explode(b.x + BULLET_W / 2, b.y + BULLET_H / 2, LCD.ink2);
              return false;
            }

            explode(a.x + TANK_W / 2, a.y + TANK_H / 2, LCD.ink);
            // Ally must be protected: costs 2 lives per hit.
            livesRef.current = clampLives(livesRef.current - 2);
            setDisplayLives(livesRef.current);
            setLives(livesRef.current);
            if (livesRef.current <= 0) setStatus("gameover");
            return false;
          }
        }
      }
      return !bulletsToRemove.has(b);
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

    // Bonuses
    bonuses.current = bonuses.current.filter((bonus) => {
      bonus.y += 2; // Fall speed
      if (bonus.y > H + BONUS_H) return false;

      // Draw bonus
      if (bonus.type === "multishot") {
        // Solid black circle
        ctx.fillStyle = LCD.ink;
        ctx.beginPath();
        ctx.arc(
          bonus.x + BONUS_W / 2,
          bonus.y + BONUS_H / 2,
          BONUS_W / 2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      } else if (bonus.type === "comboshot") {
        // Combo shot: transparent 8-point starburst.
        const cx = bonus.x + BONUS_W / 2;
        const cy = bonus.y + BONUS_H / 2;
        const r = BONUS_W / 2;
        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        for (let i = 0; i < 8; i++) {
          const ang = (i * Math.PI) / 4;
          ctx.beginPath();
          ctx.moveTo(cx, cy);
          ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r);
          ctx.stroke();
        }
        ctx.restore();
      } else if (bonus.type === "gunheads") {
        // Transparent with black border
        ctx.strokeStyle = LCD.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(
          bonus.x + BONUS_W / 2,
          bonus.y + BONUS_H / 2,
          BONUS_W / 2,
          0,
          Math.PI * 2,
        );
        ctx.stroke();
      } else if (bonus.type === "bomb") {
        // Bonus bomb: transparent square with black border.
        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.strokeRect(bonus.x, bonus.y, BONUS_W, BONUS_H);
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#000";
        ctx.fillRect(bonus.x + 2, bonus.y + 2, BONUS_W - 4, BONUS_H - 4);
        ctx.restore();
      } else if (bonus.type === "refill") {
        // Refill life: a transparent plus with black border.
        const cx = bonus.x + BONUS_W / 2;
        const cy = bonus.y + BONUS_H / 2;
        const arm = Math.max(3, Math.floor(BONUS_W / 3));
        const thickness = 4;

        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;

        // Filled (transparent) plus
        ctx.globalAlpha = 0.12;
        ctx.fillStyle = "#000";
        ctx.fillRect(cx - thickness / 2, cy - arm, thickness, arm * 2);
        ctx.fillRect(cx - arm, cy - thickness / 2, arm * 2, thickness);
        ctx.globalAlpha = 1;

        // Border (two rectangles)
        ctx.strokeRect(cx - thickness / 2, cy - arm, thickness, arm * 2);
        ctx.strokeRect(cx - arm, cy - thickness / 2, arm * 2, thickness);
        ctx.restore();
      } else if (bonus.type === "shield") {
        // Shield: half transparent / half black with black border.
        const cx = bonus.x + BONUS_W / 2;
        const cy = bonus.y + BONUS_H / 2;
        const r = BONUS_W / 2;
        ctx.save();
        // Half black
        ctx.fillStyle = LCD.ink;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, -Math.PI / 2, Math.PI / 2);
        ctx.closePath();
        ctx.fill();
        // Half transparent
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = LCD.ink;
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, Math.PI / 2, (3 * Math.PI) / 2);
        ctx.closePath();
        ctx.fill();
        ctx.globalAlpha = 1;
        // Border
        ctx.strokeStyle = LCD.ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      } else {
        // Lives bonus: cross pattern (like a plus sign)
        ctx.strokeStyle = LCD.ink;
        ctx.lineWidth = 2;
        const cx = bonus.x + BONUS_W / 2;
        const cy = bonus.y + BONUS_H / 2;
        const size = BONUS_W / 2.5;
        // Horizontal line
        ctx.beginPath();
        ctx.moveTo(cx - size, cy);
        ctx.lineTo(cx + size, cy);
        ctx.stroke();
        // Vertical line
        ctx.beginPath();
        ctx.moveTo(cx, cy - size);
        ctx.lineTo(cx, cy + size);
        ctx.stroke();
      }

      // Check collision with player
      if (
        bonus.x + BONUS_W > p.x &&
        bonus.x < p.x + TANK_W &&
        bonus.y + BONUS_H > p.y &&
        bonus.y < p.y + TANK_H
      ) {
        playSfx("shot");
        if (bonus.type === "multishot") {
          // Increase multishot count (max 3)
          multishotCountRef.current = Math.min(
            3,
            multishotCountRef.current + 1,
          );
        } else if (bonus.type === "gunheads") {
          // Increase gun heads (max 5)
          gunHeadsRef.current = Math.min(5, gunHeadsRef.current + 1);
        } else if (bonus.type === "shield") {
          // Refresh shield to full (3 hits).
          shieldHpRef.current = 3;
          setDisplayShield(3);
        } else if (bonus.type === "bomb") {
          // Bomb lasts 7s; refreshes if picked again.
          bonusBombFramesRef.current = BONUS_BOMB_DURATION_FRAMES;
        } else if (bonus.type === "comboshot") {
          comboShotUntilMsRef.current = performance.now() + COMBO_SHOT_DURATION_MS;
        } else if (bonus.type === "refill") {
          // Refill lives (adds 5 once; still capped).
          livesRef.current = clampLives(livesRef.current + 5);
          setDisplayLives(livesRef.current);
          setLives(livesRef.current);
        } else {
          // Increase lives (max 8)
          livesRef.current = clampLives(livesRef.current + 1);
          setDisplayLives(livesRef.current);
          setLives(livesRef.current);
        }
        explode(bonus.x + BONUS_W / 2, bonus.y + BONUS_H / 2, LCD.ink);
        return false; // Remove bonus
      }

      // Ally can also pick up bonuses (its own power-ups, separate from player).
      const allyActive = levelRef.current >= ALLY_START_LEVEL;
      if (allyActive && allyAliveRef.current) {
        const a = allyPos.current;
        if (
          bonus.x + BONUS_W > a.x &&
          bonus.x < a.x + TANK_W &&
          bonus.y + BONUS_H > a.y &&
          bonus.y < a.y + TANK_H
        ) {
          if (bonus.type === "multishot") {
            allyMultishotCountRef.current = Math.min(
              2,
              allyMultishotCountRef.current + 1,
            );
            explode(bonus.x + BONUS_W / 2, bonus.y + BONUS_H / 2, LCD.ink);
            return false;
          }
          if (bonus.type === "gunheads") {
            allyGunHeadsRef.current = Math.min(4, allyGunHeadsRef.current + 1);
            explode(bonus.x + BONUS_W / 2, bonus.y + BONUS_H / 2, LCD.ink);
            return false;
          }
          if (bonus.type === "shield") {
            allyShieldHpRef.current = 3;
            explode(bonus.x + BONUS_W / 2, bonus.y + BONUS_H / 2, LCD.ink);
            return false;
          }
          if (bonus.type === "comboshot") {
            allyComboShotUntilMsRef.current =
              performance.now() + ALLY_COMBO_SHOT_DURATION_MS;
            explode(bonus.x + BONUS_W / 2, bonus.y + BONUS_H / 2, LCD.ink);
            return false;
          }
          if (bonus.type === "refill") {
            // Refill lives is a global/resource bonus (shared).
            livesRef.current = clampLives(livesRef.current + 5);
            setDisplayLives(livesRef.current);
            setLives(livesRef.current);
            explode(bonus.x + BONUS_W / 2, bonus.y + BONUS_H / 2, LCD.ink);
            return false;
          }
          if (bonus.type === "lives") {
            // Lives are shared (global).
            livesRef.current = clampLives(livesRef.current + 1);
            setDisplayLives(livesRef.current);
            setLives(livesRef.current);
            explode(bonus.x + BONUS_W / 2, bonus.y + BONUS_H / 2, LCD.ink);
            return false;
          }
          // Leave bomb for the player.
        }
      }

      return true;
    });

    // Bombs
    bombs.current = bombs.current.filter((bomb) => {
      bomb.y += bomb.vy;
      if (bomb.y > H + 30) return false;

      // Draw bomb: solid black circle with a white "X"
      ctx.save();
      ctx.fillStyle = "#000";
      ctx.beginPath();
      ctx.arc(bomb.x, bomb.y, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#fff";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(bomb.x - 4, bomb.y - 4);
      ctx.lineTo(bomb.x + 4, bomb.y + 4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(bomb.x + 4, bomb.y - 4);
      ctx.lineTo(bomb.x - 4, bomb.y + 4);
      ctx.stroke();
      ctx.restore();

      if (
        !playerHitThisFrame &&
        bomb.x + 8 > p.x &&
        bomb.x - 8 < p.x + TANK_W &&
        bomb.y + 8 > p.y &&
        bomb.y - 8 < p.y + TANK_H
      ) {
        playerHitThisFrame = true;
        // Shield absorbs bombs too.
        if (shieldHpRef.current > 0) {
          shieldHpRef.current--;
          setDisplayShield(shieldHpRef.current);
          smash(bomb.x, bomb.y, LCD.ink);
          explode(bomb.x, bomb.y, LCD.ink2);
          if (shieldHpRef.current === 0) setDisplayShield(0);
          return false;
        }
        explode(p.x + TANK_W / 2, p.y + TANK_H / 2, LCD.ink);
	        livesRef.current = clampLives(livesRef.current - 3);
	        setDisplayLives(livesRef.current);
	        setLives(livesRef.current);
	        if (livesRef.current <= 0) setStatus("gameover");
        p.x = W / 2 - TANK_W / 2;
        p.y = H - TANK_H - 20;
        return false;
      }

      // Bomb can also hit ally.
      const allyActive = levelRef.current >= ALLY_START_LEVEL;
      if (allyActive && allyAliveRef.current) {
        const a = allyPos.current;
        if (
          !playerHitThisFrame &&
          bomb.x + 8 > a.x &&
          bomb.x - 8 < a.x + TANK_W &&
          bomb.y + 8 > a.y &&
          bomb.y - 8 < a.y + TANK_H
        ) {
          playerHitThisFrame = true;
          // Ally shield (separate from player shield).
          if (allyShieldHpRef.current > 0) {
            allyShieldHpRef.current--;
            smash(bomb.x, bomb.y, LCD.ink);
            explode(bomb.x, bomb.y, LCD.ink2);
            return false;
          }

          explode(a.x + TANK_W / 2, a.y + TANK_H / 2, LCD.ink);
	          livesRef.current = clampLives(livesRef.current - 3);
	          setDisplayLives(livesRef.current);
	          setLives(livesRef.current);
	          if (livesRef.current <= 0) setStatus("gameover");
	          return false;
	        }
      }

      return true;
    });

    // Draw player
    drawTank(ctx, p.x, p.y, LCD.ink, TANK_W, TANK_H);
    if (shieldHpRef.current > 0) {
      ctx.save();
      ctx.strokeStyle = "#000";
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.85;
      ctx.strokeRect(p.x - 3, p.y - 3, TANK_W + 6, TANK_H + 6);
      ctx.globalAlpha = 1;
      ctx.restore();
    }
    if (allyActive && allyAliveRef.current) {
      const a = allyPos.current;
      drawAlly(ctx, a.x, a.y, TANK_W, TANK_H);
      if (allyShieldHpRef.current > 0) {
        ctx.save();
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.85;
        ctx.strokeRect(a.x - 3, a.y - 3, TANK_W + 6, TANK_H + 6);
        ctx.globalAlpha = 1;
        ctx.restore();
      }
    }

    rafRef.current = requestAnimationFrame(loop);
  }, [
    ALLY_START_LEVEL,
    spawnBoss,
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
    livesRef.current = 5;
    frameRef.current = 0;
    waveCooldownFrames.current = 0;
    levelRef.current = 1;
    wavesSpawnedInLevelRef.current = 0;
    bossesSpawnedInLevelRef.current = 0;
    lastSpawnedRef.current = null;
    bullets.current = [];
    enemies.current = [];
    particles.current = [];
    impacts.current = [];
    bonuses.current = [];
    bombs.current = [];
    multishotCountRef.current = 0;
    gunHeadsRef.current = 1;
    bonusBombFramesRef.current = 0;
    comboShotUntilMsRef.current = 0;
    allyMultishotCountRef.current = 0;
    allyGunHeadsRef.current = 1;
    allyComboShotUntilMsRef.current = 0;
    allyShieldHpRef.current = 0;
    playerPos.current = { x: W / 2 - TANK_W / 2, y: H - TANK_H - 20 };
    allyPos.current = { x: W / 2 - TANK_W / 2, y: H - TANK_H - 70 };
    allyAliveRef.current = false;
    allyShootCooldown.current = 0;
    allyVelRef.current = { vx: 0, vy: 0 };
    shieldHpRef.current = 0;
    setDisplayShield(0);
    setDisplayScore(0);
    setDisplayLives(5);
    setLives(5);
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
        <div className="stat">
          <span>SHIELD</span>
          <strong>{"◼︎".repeat(Math.max(0, displayShield))}</strong>
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
