import { Replay } from "./physics-test";
import { CONFIG } from "../src/config";
type Shot = [number, number];
const sequence: Shot[] = process.argv[2]
  ? JSON.parse(process.argv[2])
  : [
      [0.08, 22],
      [-0.12, 27],
    ];
for (let i = sequence.length; i < 10; i++) {
  const base = new Replay();
  base.settle();
  for (const s of sequence) base.fire(...s);
  const candidates: Shot[] = [];
  for (const speed of [22, 25, 27])
    for (const e of base.entities.filter((e) => !e.dead)) {
      const dx = e.body.position.x - CONFIG.aim.x,
        dy = e.body.position.y - CONFIG.aim.y,
        g = CONFIG.physics.gravity * 0.001 * (1000 / 60) ** 2;
      const disc = speed ** 4 - g * (g * dx * dx - 2 * dy * speed ** 2);
      if (disc < 0) continue;
      const angle = Math.atan((-speed * speed + Math.sqrt(disc)) / (g * dx));
      if (angle < -0.9 || angle > 0.32) continue;
      for (const offset of [-0.02, 0, 0.02])
        candidates.push([Math.round((angle + offset) * 100) / 100, speed]);
    }
  let best = -1,
    bestShot: Shot = candidates[0],
    heads = 0;
  for (const shot of candidates) {
    const r = new Replay();
    r.settle();
    for (const prev of sequence) r.fire(...prev);
    r.fire(...shot);
    const value =
      r.round.heads.size * 1000 +
      r.round.score * 0.1 +
      r.round.destroyed.size * 5 +
      (r.round.stored === "divine" ? 0 : 50);
    if (value > best) {
      best = value;
      bestShot = shot;
      heads = r.round.heads.size;
    }
  }
  sequence.push(bestShot);
  console.log(JSON.stringify({ sequence, heads, best }));
  if (heads === 10) break;
}
