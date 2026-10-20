import { CONFIG, type Ability } from "./config";
export type Phase = "READY" | "AIMING" | "FLYING" | "RESOLVING" | "TERMINAL";
export function launchVector(dx: number, dy: number) {
  const distance = Math.hypot(dx, dy);
  if (distance < CONFIG.aim.minPull || dx <= 0) return null;
  const a = Math.max(-1.15, Math.min(0.32, Math.atan2(dy, dx)));
  const speed =
    CONFIG.aim.minSpeed +
    (CONFIG.aim.maxSpeed - CONFIG.aim.minSpeed) *
      Math.min(distance / CONFIG.aim.maxPull, 1);
  return { x: Math.cos(a) * speed, y: Math.sin(a) * speed, angle: a, speed };
}
// Matter velocity is expressed per 60 Hz base step. Gravity adds g * .001 * dt² per step.
export function trajectory(
  x: number,
  y: number,
  vx: number,
  vy: number,
  t: number,
) {
  const frames = t / (1000 / 60);
  return {
    x: x + vx * frames,
    y:
      y +
      vy * frames +
      0.5 * CONFIG.physics.gravity * 0.001 * (1000 / 60) ** 2 * frames ** 2,
  };
}
export function impact(
  relativeNormalSpeed: number,
  aMass: number,
  bMass: number,
  isArrow = false,
  modifier = 1,
) {
  const reducedMass = !Number.isFinite(bMass)
    ? aMass
    : (aMass * bMass) / (aMass + bMass);
  return (
    Math.max(0, relativeNormalSpeed - CONFIG.damage.minVelocity) *
    Math.sqrt(Math.min(reducedMass, 12)) *
    (isArrow ? 2.3 : 1) *
    modifier
  );
}
export class Round {
  phase: Phase = "READY";
  arrows: number = CONFIG.round.arrows;
  seconds: number = CONFIG.round.seconds;
  score = 0;
  heads = new Set<string>();
  destroyed = new Set<string>();
  stored: Ability = "divine";
  shot = 0;
  combo = 0;
  won = false;
  reason = "";
  launch() {
    if (
      !["READY", "AIMING"].includes(this.phase) ||
      this.arrows <= 0 ||
      this.seconds <= 0
    )
      return null;
    this.arrows--;
    this.phase = "FLYING";
    this.shot++;
    this.combo = 0;
    const ability = this.stored;
    this.stored = "divine";
    return { id: this.shot, ability, count: ability === "volley" ? 3 : 1 };
  }
  defeat(id: string) {
    if (this.phase === "TERMINAL" || this.heads.has(id)) return false;
    this.heads.add(id);
    this.score +=
      CONFIG.score.head + (this.combo++ > 0 ? CONFIG.score.combo : 0);
    return true;
  }
  destroy(id: string, kind: "wood" | "stone" | "crate") {
    if (this.destroyed.has(id)) return false;
    this.destroyed.add(id);
    this.score += CONFIG.score[kind];
    return true;
  }
  collect(a: Ability) {
    this.stored = a;
  }
  tick(ms: number) {
    if (this.phase !== "TERMINAL")
      this.seconds = Math.max(0, this.seconds - ms / 1000);
  }
  finishShot() {
    if (this.heads.size === 10) this.end(true);
    else if (this.seconds <= 0) this.end(false, "Time is up");
    else if (this.arrows === 0) this.end(false, "No arrows remaining");
    else this.phase = "READY";
  }
  end(won: boolean, reason = "") {
    if (this.phase === "TERMINAL") return;
    this.won = won;
    this.reason = reason;
    this.phase = "TERMINAL";
    if (won)
      this.score +=
        Math.floor(this.seconds) * CONFIG.score.second +
        this.arrows * CONFIG.score.arrow;
  }
  stars() {
    return this.won
      ? CONFIG.stars.filter((t) => this.score >= t).length || 1
      : 0;
  }
}
export interface Best {
  score: number;
  heads: number;
  stars: number;
}
export function readBest(
  storage: Pick<Storage, "getItem"> = localStorage,
): Best {
  try {
    const b = JSON.parse(storage.getItem("vijay-baan-best") ?? "{}");
    return {
      score: Number(b.score) || 0,
      heads: Number(b.heads) || 0,
      stars: Number(b.stars) || 0,
    };
  } catch {
    return { score: 0, heads: 0, stars: 0 };
  }
}
export function saveBest(
  r: Round,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
) {
  const b = readBest(storage);
  const next = {
    score: Math.max(b.score, r.score),
    heads: Math.max(b.heads, r.heads.size),
    stars: Math.max(b.stars, r.stars()),
  };
  try {
    storage.setItem("vijay-baan-best", JSON.stringify(next));
  } catch {}
  return next;
}
export function resultText(r: Round, url: string) {
  return `${r.won ? "I defeated Ravana" : "I took the Dussehra challenge"} in VIJAY BAAN! 🏹\nScore: ${r.score.toLocaleString()}\nHeads defeated: ${r.heads.size}/10\nCan you beat my score?\nPlay here: ${url}`;
}
