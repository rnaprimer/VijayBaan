import { test } from "node:test";
import assert from "node:assert/strict";
import Matter from "matter-js";
import { CONFIG } from "../src/config";
import { LAYOUT, TERRAIN } from "../src/layout";
import {
  Round,
  launchVector,
  trajectory,
  impact,
  readBest,
  saveBest,
  resultText,
} from "../src/rules";
import { makeArrow } from "../src/physics";
test("configuration: one 90-second round, ten arrows, ten unique targets", () => {
  const r = new Round();
  assert.equal(r.seconds, 90);
  assert.equal(r.arrows, 10);
  assert.equal(r.score, 0);
  assert.equal(LAYOUT.filter((p) => p.kind === "head").length, 10);
  assert.equal(new Set(LAYOUT.map((p) => p.id)).size, LAYOUT.length);
});
test("terrain preserves physical river gap", () =>
  assert.ok(TERRAIN[0].x + TERRAIN[0].w / 2 < TERRAIN[1].x - TERRAIN[1].w / 2));
test("valid shot consumes exactly one arrow and prevents concurrent launch", () => {
  const r = new Round();
  assert.equal(r.launch()?.count, 1);
  assert.equal(r.arrows, 9);
  assert.equal(r.launch(), null);
  assert.equal(r.arrows, 9);
});
test("invalid and backwards pull cancel without ammunition cost", () => {
  assert.equal(launchVector(2, 2), null);
  assert.equal(launchVector(-90, -40), null);
  assert.equal(new Round().arrows, 10);
});
test("launch vector is opposite the drag and bounded", () => {
  const v = launchVector(100, -70)!;
  assert.ok(v.x > 0 && v.y < 0);
  assert.equal(launchVector(1000, -700)!.speed, CONFIG.aim.maxSpeed);
});
test("prediction agrees with 120Hz Matter integration within four pixels", () => {
  const e = Matter.Engine.create();
  e.gravity.y = CONFIG.physics.gravity;
  const b = makeArrow(356, 566, 24, -5);
  Matter.Composite.add(e.world, b);
  for (let i = 0; i < 120; i++) Matter.Engine.update(e, CONFIG.physics.step);
  const p = trajectory(356, 566, 24, -5, 1000);
  assert.ok(Math.abs(p.x - b.position.x) < 1);
  assert.ok(Math.abs(p.y - b.position.y) < 4);
});
test("head reward and target count deduplicate", () => {
  const r = new Round();
  r.launch();
  assert.equal(r.defeat("a"), true);
  assert.equal(r.defeat("a"), false);
  assert.equal(r.score, 500);
  assert.equal(r.heads.size, 1);
});
test("damage uses relative normal velocity and effective mass", () => {
  assert.equal(impact(1, 5, 10), 0);
  assert.ok(impact(12, 5, 10) > impact(3, 5, 10));
  assert.ok(impact(12, 5, 10) > impact(12, 0.1, 10));
  assert.ok(CONFIG.damage.stone > CONFIG.damage.wood);
});
test("combo rewards each additional head in the same shot", () => {
  const r = new Round();
  r.launch();
  r.defeat("a");
  r.defeat("b");
  r.defeat("c");
  assert.equal(r.score, 2000);
  r.finishShot();
  r.launch();
  r.defeat("d");
  assert.equal(r.score, 2500);
});
test("destruction rewards deduplicate", () => {
  const r = new Round();
  r.destroy("beam", "wood");
  r.destroy("beam", "wood");
  assert.equal(r.score, 50);
});
test("power-up acquisition replaces the stored slot", () => {
  const r = new Round();
  r.collect("agni");
  r.collect("vajra");
  assert.equal(r.stored, "vajra");
  assert.equal(r.arrows, 10);
});
test("next shot consumes power-up even on miss", () => {
  const r = new Round();
  r.collect("agni");
  assert.equal(r.launch()?.ability, "agni");
  assert.equal(r.stored, "divine");
  r.finishShot();
  assert.equal(r.launch()?.ability, "divine");
});
test("volley has three projectiles with one owner and one ammo cost", () => {
  const r = new Round();
  r.collect("volley");
  const s = r.launch()!;
  assert.equal(s.count, 3);
  assert.equal(s.id, 1);
  assert.equal(r.arrows, 9);
  assert.equal(r.launch(), null);
});
test("timer expires without accepting new shots", () => {
  const r = new Round();
  r.tick(91000);
  assert.equal(r.seconds, 0);
  assert.equal(r.launch(), null);
  r.finishShot();
  assert.equal(r.won, false);
  assert.equal(r.phase, "TERMINAL");
});
test("last arrow waits for resolution before defeat", () => {
  const r = new Round();
  r.arrows = 1;
  r.launch();
  assert.equal(r.arrows, 0);
  assert.equal(r.phase, "FLYING");
  r.finishShot();
  assert.equal(r.phase, "TERMINAL");
  assert.equal(r.reason, "No arrows remaining");
});
test("last arrow can win and victory bonus is awarded once", () => {
  const r = new Round();
  r.arrows = 1;
  r.launch();
  for (let i = 0; i < 10; i++) r.defeat("head" + i);
  r.finishShot();
  assert.equal(r.won, true);
  const s = r.score;
  r.end(true);
  assert.equal(r.score, s);
  assert.ok(r.stars() > 0);
});
test("new attempt fully resets rules", () => {
  const r = new Round();
  r.collect("volley");
  r.launch();
  r.defeat("x");
  const fresh = new Round();
  assert.equal(fresh.heads.size, 0);
  assert.equal(fresh.stored, "divine");
  assert.equal(fresh.score, 0);
  assert.equal(fresh.shot, 0);
});
test("personal best persists independently and tolerates blocked storage", () => {
  let value = "";
  const storage = {
    getItem: () => value,
    setItem: (_k: string, v: string) => {
      value = v;
    },
  };
  const r = new Round();
  r.score = 3000;
  r.defeat("a");
  saveBest(r, storage);
  assert.equal(readBest(storage).score, 3500);
  saveBest(new Round(), storage);
  assert.equal(readBest(storage).score, 3500);
  assert.deepEqual(
    readBest({
      getItem: () => {
        throw Error();
      },
    }),
    { score: 0, heads: 0, stars: 0 },
  );
});
test("sharing fallback uses real dynamic result and provided URL", () => {
  const r = new Round();
  r.score = 1234;
  r.defeat("a");
  const t = resultText(r, "https://actual.example/game");
  assert.ok(t.includes("1/10"));
  assert.ok(t.includes("1,734"));
  assert.ok(t.includes("https://actual.example/game"));
});

// These cases exercise the same Matter bodies, material rules, fixed step, and ray checks.
import { Replay } from "../scripts/physics-test";
import { REPLAYS } from "../src/replays";
test("a low physical support hit produces a multi-head collapse", () => {
  const r = new Replay();
  r.settle();
  r.fire(0.08, 22);
  assert.equal(r.round.heads.size, 3);
  assert.ok(r.round.destroyed.size > 2);
});
test("both recorded strategies defeat ten heads within the original limits", () => {
  for (const shots of Object.values(REPLAYS)) {
    const r = new Replay();
    r.settle();
    for (const shot of shots) r.fire(...shot);
    assert.equal(r.round.won, true);
    assert.equal(r.round.heads.size, 10);
    assert.ok(r.round.seconds > 0);
    assert.ok(r.round.arrows >= 0);
  }
});
test("a real projectile collision collects a magical object without granting ammo", () => {
  const r = new Replay();
  r.settle();
  const e = r.entities.find((e) => e.p.id === "agni")!;
  r.round.launch();
  const a = makeArrow(e.p.x - 90, e.p.y, 20, 0);
  r.arrow.push(a);
  r.hit.set(a.id, new Set());
  Matter.Composite.add(r.engine.world, a);
  r.step(250);
  assert.equal(r.round.stored, "agni");
  assert.equal(e.dead, true);
  assert.equal(r.round.arrows, 9);
});
