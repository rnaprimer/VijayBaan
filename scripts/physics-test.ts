import Matter from "matter-js";
import assert from "node:assert/strict";
import { CONFIG, type Ability } from "../src/config";
import { createWorld, makeArrow, type Entity } from "../src/physics";
import { Round, impact } from "../src/rules";
export class Replay {
  engine = Matter.Engine.create({ enableSleeping: true });
  entities = createWorld(this.engine);
  round = new Round();
  armed = false;
  arrow: ReturnType<typeof makeArrow>[] = [];
  ability: Ability = "divine";
  hit = new Map<number, Set<number>>();
  vel = new Map<number, Matter.Vector>();
  constructor() {
    Matter.Events.on(this.engine, "collisionStart", (event) => {
      if (!this.armed) return;
      for (const p of event.pairs) {
        const a = p.bodyA,
          b = p.bodyB,
          av = this.vel.get(a.id) ?? a.velocity,
          bv = this.vel.get(b.id) ?? b.velocity;
        const normal = p.collision.normal;
        const rel = Math.abs(
          (av.x - bv.x) * normal.x + (av.y - bv.y) * normal.y,
        );
        const shot = this.arrow.find((ar) => ar.id === a.id || ar.id === b.id);
        if (shot) {
          const target = shot.id === a.id ? b : a;
          this.arrowHit(
            shot,
            target,
            Math.max(rel, Math.hypot(av.x - bv.x, av.y - bv.y) * 0.65),
          );
        } else
          for (const [body, other] of [
            [a, b],
            [b, a],
          ]) {
            const e = this.entities.find(
              (e) => !e.dead && e.body.id === body.id,
            );
            if (e) this.damage(e, impact(rel, body.mass, other.mass));
          }
      }
    });
  }
  remove(e: Entity) {
    e.dead = true;
    for (const other of this.entities)
      if (!other.dead && other.p.kind !== "pickup")
        Matter.Sleeping.set(other.body, false);
    Matter.Composite.remove(this.engine.world, e.body);
  }
  damage(e: Entity, d: number) {
    if (e.dead || e.p.kind === "pickup") return;
    e.health -= d;
    if (e.health <= 0) {
      if (e.p.kind === "head") this.round.defeat(e.p.id);
      else this.round.destroy(e.p.id, e.p.kind);
      this.remove(e);
    }
  }
  arrowHit(a: Matter.Body, b: Matter.Body, speed: number) {
    const hit = this.hit.get(a.id)!;
    if (hit.has(b.id)) return;
    hit.add(b.id);
    const e = this.entities.find((e) => !e.dead && e.body.id === b.id);
    if (e?.p.kind === "pickup") {
      this.round.collect(e.p.ability!);
      this.remove(e);
      return;
    }
    if (e) {
      this.damage(
        e,
        impact(
          speed,
          a.mass,
          b.mass,
          true,
          CONFIG.weapons[this.ability].damage *
            (this.ability === "agni" && e.p.kind === "wood" ? 1.8 : 1),
        ),
      );
      const f = 0.0025 * Math.min(b.mass, 8);
      Matter.Body.applyForce(b, b.position, {
        x: a.velocity.x * f,
        y: a.velocity.y * f,
      });
    }
    if (this.ability === "agni")
      for (const other of this.entities) {
        const d = Matter.Vector.magnitude(
          Matter.Vector.sub(other.body.position, a.position),
        );
        if (d < CONFIG.weapons.agni.radius)
          this.damage(other, (1 - d / 125) * 14);
      }
    const allowed = CONFIG.weapons[this.ability].penetration;
    if (allowed && hit.size <= allowed && !b.isStatic)
      Matter.Body.setVelocity(a, {
        x: Math.cos(a.angle) * 22,
        y: Math.sin(a.angle) * 22,
      });
    else {
      Matter.Composite.remove(this.engine.world, a);
      this.arrow = this.arrow.filter((x) => x !== a);
    }
  }
  step(ms: number) {
    for (let elapsed = 0; elapsed < ms; elapsed += CONFIG.physics.step) {
      for (const b of Matter.Composite.allBodies(this.engine.world))
        this.vel.set(b.id, { ...b.velocity });
      const prev = new Map(this.arrow.map((a) => [a.id, { ...a.position }]));
      for (const a of this.arrow)
        if (a.speed > 0.5)
          Matter.Body.setAngle(a, Math.atan2(a.velocity.y, a.velocity.x));
      Matter.Engine.update(this.engine, CONFIG.physics.step);
      if (this.armed) {
        this.round.tick(CONFIG.physics.step);
        for (const a of [...this.arrow]) {
          for (const hit of Matter.Query.ray(
            Matter.Composite.allBodies(this.engine.world).filter(
              (b) => b.label !== "arrow",
            ),
            prev.get(a.id)!,
            a.position,
            5,
          )) {
            this.arrowHit(a, hit.bodyA, Math.hypot(a.velocity.x, a.velocity.y));
            if (!this.arrow.includes(a)) break;
          }
          if (a.position.y > 1020 || a.position.x > 1750) {
            Matter.Composite.remove(this.engine.world, a);
            this.arrow = this.arrow.filter((x) => x !== a);
          }
        }
        for (const e of this.entities)
          if (!e.dead && e.body.position.y > 1000) {
            if (e.p.kind === "head") this.damage(e, 999);
            else this.remove(e);
          }
      }
    }
  }
  settle() {
    this.step(1200);
    this.armed = true;
  }
  fire(angle: number, speed: number) {
    const shot = this.round.launch();
    if (!shot) return;
    this.ability = shot.ability;
    for (let i = 0; i < shot.count; i++) {
      const ang =
        angle + (shot.count === 3 ? (i - 1) * CONFIG.volleySpread : 0);
      const a = makeArrow(
        CONFIG.aim.x,
        CONFIG.aim.y,
        Math.cos(ang) * speed,
        Math.sin(ang) * speed,
      );
      this.arrow.push(a);
      this.hit.set(a.id, new Set());
      Matter.Composite.add(this.engine.world, a);
    }
    this.step(6500);
    for (const a of this.arrow) Matter.Composite.remove(this.engine.world, a);
    this.arrow = [];
    this.round.finishShot();
  }
}
if (process.argv[1]?.endsWith("physics-test.ts")) {
  const stable = new Replay();
  stable.step(4000);
  const errors = stable.entities.filter(
    (e) =>
      e.p.kind !== "pickup" &&
      Math.hypot(
        e.body.position.x - e.p.x,
        e.body.position.y - e.p.y - (e.p.kind === "head" ? 10 : 0),
      ) > 20,
  );
  console.log(
    "Stability drift >20px:",
    errors.map((e) => [
      e.p.id,
      Math.round(e.body.position.x - e.p.x),
      Math.round(e.body.position.y - e.p.y),
    ]),
  );
  assert.equal(errors.length, 0, "Fortress must remain stable before a shot");
  const sequences = [
    [-0.15, 24],
    [-0.36, 23],
    [-0.55, 23],
    [-0.15, 26],
    [-0.36, 26],
  ];
  for (const [a, s] of sequences) {
    const r = new Replay();
    r.settle();
    for (let i = 0; i < 10 && r.round.phase !== "TERMINAL"; i++) r.fire(a, s);
    console.log(
      "Repeated",
      a,
      s,
      "heads",
      r.round.heads.size,
      "score",
      r.round.score,
      "remaining",
      r.entities
        .filter((e) => e.p.kind === "head" && !e.dead)
        .map((e) => [
          e.p.id,
          Math.round(e.body.position.x),
          Math.round(e.body.position.y),
        ]),
    );
  }
}
