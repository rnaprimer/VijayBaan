import Matter from "matter-js";
import { CONFIG } from "./config";
import { LAYOUT, TERRAIN, type Placement } from "./layout";
export interface Entity {
  p: Placement;
  body: Matter.Body;
  health: number;
  dead: boolean;
  hit: Set<number>;
}
export function makeEntity(p: Placement): Entity {
  const options = {
    ...CONFIG.materials[p.kind === "pickup" ? "head" : p.kind],
    label: p.id,
    sleepThreshold: 90,
  };
  let body =
    p.kind === "head"
      ? Matter.Bodies.circle(p.x, p.y + 10, 24, options)
      : Matter.Bodies.rectangle(p.x, p.y, p.w, p.h, {
          ...options,
          isStatic: p.kind === "pickup",
          isSensor: p.kind === "pickup",
          chamfer: { radius: 2 },
        });
  return {
    p,
    body,
    health: CONFIG.damage[p.kind === "pickup" ? "head" : p.kind],
    dead: false,
    hit: new Set(),
  };
}
export function createWorld(engine: Matter.Engine) {
  engine.gravity.y = CONFIG.physics.gravity;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  const ground = TERRAIN.map((g) =>
    Matter.Bodies.rectangle(g.x, g.y, g.w, g.h, {
      isStatic: true,
      label: "terrain",
      friction: 0.9,
    }),
  );
  const entities = LAYOUT.map(makeEntity);
  Matter.Composite.add(engine.world, [
    ...ground,
    ...entities.map((e) => e.body),
  ]);
  return entities;
}
export function makeArrow(x: number, y: number, vx: number, vy: number) {
  const b = Matter.Bodies.rectangle(x, y, 64, 8, {
    label: "arrow",
    density: 0.008,
    frictionAir: 0,
    friction: 0.3,
    restitution: 0.05,
    collisionFilter: { category: 2, mask: 1 },
  });
  Matter.Body.setVelocity(b, { x: vx, y: vy });
  Matter.Body.setAngle(b, Math.atan2(vy, vx));
  return b;
}
