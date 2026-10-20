import Phaser from "phaser";
import Matter from "matter-js";
import { CONFIG, SPRITES, ASSET_BASE, type Ability } from "./config";
import { Round, launchVector, trajectory, impact } from "./rules";
import { createWorld, makeArrow, type Entity } from "./physics";
import { AudioManager } from "./audio";
type Arrow = {
  body: Matter.Body;
  image: Phaser.GameObjects.Image;
  ability: Ability;
  shot: number;
  life: number;
  done: boolean;
  penetration: number;
  hit: Set<number>;
  previous: Matter.Vector;
};
export type CameraMode =
  | "OVERVIEW"
  | "AIMING"
  | "FOLLOW_PROJECTILE"
  | "FOLLOW_DESTRUCTION"
  | "RETURN_TO_PLAYER";
export class Battlefield extends Phaser.Scene {
  engine!: Matter.Engine;
  round = new Round();
  audio = new AudioManager();
  entities: Entity[] = [];
  arrows: Arrow[] = [];
  images = new Map<number, Phaser.GameObjects.Image>();
  started = false;
  paused = false;
  settled = false;
  age = 0;
  shotAge = 0;
  accumulator = 0;
  expiryAge = 0;
  cameraMode: CameraMode = "OVERVIEW";
  pointerId: number | null = null;
  aimVector: ReturnType<typeof launchVector> = null;
  guide!: Phaser.GameObjects.Graphics;
  fx!: Phaser.GameObjects.Graphics;
  rama!: Phaser.GameObjects.Image;
  liveArrow!: Phaser.GameObjects.Image;
  rope!: Phaser.GameObjects.Graphics;
  reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  debug =
    import.meta.env.DEV && new URLSearchParams(location.search).has("debug");
  particles: {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    max: number;
    color: number;
    r: number;
  }[] = [];
  velocity = new Map<number, Matter.Vector>();
  hud = () => {};
  onFinish = (r: Round) => {};
  notify = (s: string) => {};
  replayQueue: (readonly [number, number])[] = [];
  replayAt = 1300;
  fastReplay = false;
  constructor() {
    super("Battlefield");
  }
  preload() {
    for (const [key, path] of Object.entries(SPRITES))
      this.load.image(key, ASSET_BASE + path + ".png");
  }
  create() {
    this.replayQueue = [];
    this.fastReplay = false;
    this.replayAt = 1300;
    this.round = new Round();
    this.entities = [];
    this.arrows = [];
    this.images.clear();
    this.started = false;
    this.paused = false;
    this.settled = false;
    this.age = 0;
    this.shotAge = 0;
    this.accumulator = 0;
    this.expiryAge = 0;
    this.pointerId = null;
    this.aimVector = null;
    this.particles = [];
    this.velocity.clear();
    this.cameraMode = "OVERVIEW";
    this.matter.world.autoUpdate = false;
    this.engine = Matter.Engine.create({ enableSleeping: true });
    this.matter.world.engine = this.engine as unknown as MatterJS.Engine;
    this.add
      .image(836, 470.5, "background")
      .setDisplaySize(1672, 941)
      .setDepth(-10);
    this.rama = this.add
      .image(224, 600, "rama")
      .setDisplaySize(287, 296)
      .setOrigin(0.5, 1)
      .setY(731)
      .setDepth(8);
    this.liveArrow = this.add
      .image(CONFIG.aim.x, CONFIG.aim.y, "arrow")
      .setDisplaySize(92, 20)
      .setDepth(10)
      .setVisible(false);
    this.rope = this.add.graphics().setDepth(9);
    this.guide = this.add.graphics().setDepth(5);
    this.fx = this.add.graphics().setDepth(20);
    this.entities = createWorld(this.engine);
    for (const e of this.entities) {
      const im = this.add
        .image(e.body.position.x, e.body.position.y, e.p.texture)
        .setDisplaySize(e.p.w, e.p.h)
        .setDepth(e.p.kind === "head" ? 4 : 3);
      this.images.set(e.body.id, im);
    }
    Matter.Events.on(
      this.engine,
      "collisionStart",
      (event: Matter.IEventCollision<Matter.Engine>) => {
        for (const p of event.pairs)
          this.collision(p.bodyA, p.bodyB, p.collision.normal);
      },
    );
    this.input.on("pointerdown", (p: Phaser.Input.Pointer) =>
      this.pointerDown(p),
    );
    this.input.on("pointermove", (p: Phaser.Input.Pointer) =>
      this.pointerMove(p),
    );
    this.input.on("pointerup", (p: Phaser.Input.Pointer) => this.pointerUp(p));
    this.input.on("pointerupoutside", (p: Phaser.Input.Pointer) =>
      this.pointerUp(p),
    );
    const cancel = () => this.cancelAim();
    this.game.canvas.addEventListener("pointercancel", cancel);
    const contextMenu = (e: Event) => e.preventDefault();
    this.game.canvas.addEventListener("contextmenu", contextMenu);
    this.scale.on("resize", this.resize, this);
    this.resize();
    this.events.once("shutdown", () => {
      Matter.Events.off(this.engine, "collisionStart");
      Matter.Engine.clear(this.engine);
      Matter.Composite.clear(this.engine.world, false);
      this.game.canvas.removeEventListener("pointercancel", cancel);
      this.game.canvas.removeEventListener("contextmenu", contextMenu);
      this.scale.off("resize", this.resize, this);
    });
    if (import.meta.env.DEV)
      (window as any).__vijay = {
        scene: this,
        fire: (a: number, p: number) =>
          this.fire(Math.cos(a) * p, Math.sin(a) * p),
        snapshot: () => ({
          phase: this.round.phase,
          heads: this.round.heads.size,
          arrows: this.round.arrows,
          score: this.round.score,
          seconds: this.round.seconds,
          settled: this.settled,
          entities: this.entities
            .filter((e) => !e.dead)
            .map((e) => ({
              id: e.p.id,
              x: e.body.position.x,
              y: e.body.position.y,
            })),
        }),
      };
    this.hud();
  }
  resize() {
    const c = this.cameras.main,
      w = this.scale.width,
      h = this.scale.height;
    const portrait = w / h < 1;
    const immersiveLandscape = matchMedia(
      "(orientation: landscape) and (max-height: 600px), (orientation: landscape) and (hover: none) and (pointer: coarse)",
    ).matches;
    const fillViewport = portrait || immersiveLandscape;
    // Fill mobile landscape without stretching the art. Overflow is cropped while preserving the artwork’s proportions.
    const z = portrait
      ? h / 941
      : immersiveLandscape
        ? Math.max(w / 1672, h / 941)
        : Math.min(w / 1672, h / 941);
    c.setViewport(
      fillViewport ? 0 : (w - 1672 * z) / 2,
      fillViewport ? 0 : (h - 941 * z) / 2,
      fillViewport ? w : 1672 * z,
      fillViewport ? h : 941 * z,
    );
    c.setZoom(z);
    c.setBounds(0, 0, 1672, 941);
    c.centerOn(portrait ? 350 : 836, 470.5);
  }
  world(p: Phaser.Input.Pointer) {
    return this.cameras.main.getWorldPoint(p.x, p.y);
  }
  pointerDown(p: Phaser.Input.Pointer) {
    if (
      !this.started ||
      this.paused ||
      !this.settled ||
      this.round.phase !== "READY" ||
      this.round.seconds <= 0 ||
      this.pointerId !== null
    )
      return;
    const w = this.world(p);
    if (
      Math.hypot(w.x - CONFIG.aim.x, w.y - CONFIG.aim.y) > CONFIG.aim.hitRadius
    )
      return;
    this.audio.unlock();
    this.pointerId = p.id;
    this.round.phase = "AIMING";
    this.cameraMode = "AIMING";
    this.pointerMove(p);
  }
  pointerMove(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;
    const w = this.world(p);
    this.aimVector = launchVector(CONFIG.aim.x - w.x, CONFIG.aim.y - w.y);
    this.drawAim();
  }
  pointerUp(p: Phaser.Input.Pointer) {
    if (p.id !== this.pointerId) return;
    const v = this.aimVector;
    this.pointerId = null;
    this.guide.clear();
    this.rope.clear();
    this.liveArrow.setPosition(CONFIG.aim.x, CONFIG.aim.y).setRotation(0);
    if (v) this.fire(v.x, v.y);
    else this.round.phase = "READY";
    this.aimVector = null;
  }
  cancelAim() {
    this.pointerId = null;
    this.aimVector = null;
    if (this.round.phase === "AIMING") this.round.phase = "READY";
    this.guide?.clear();
    this.rope?.clear();
    this.liveArrow?.setPosition(CONFIG.aim.x, CONFIG.aim.y).setRotation(0);
  }
  drawAim() {
    this.guide.clear();
    this.rope.clear();
    const v = this.aimVector;
    if (!v) return;
    const angle = v.angle,
      pull =
        ((v.speed - CONFIG.aim.minSpeed) /
          (CONFIG.aim.maxSpeed - CONFIG.aim.minSpeed)) *
        42;
    this.liveArrow.setVisible(false);
    this.rama.setRotation(angle * 0.045);
    this.rope
      .lineStyle(3, 0xffe497, 0.9)
      .beginPath()
      .moveTo(249, 439)
      .lineTo(CONFIG.aim.x - pull, CONFIG.aim.y)
      .lineTo(279, 629)
      .strokePath();
    for (let i = 1; i < 38; i++) {
      const p = trajectory(CONFIG.aim.x, CONFIG.aim.y, v.x, v.y, i * 44);
      if (p.y > 770 || p.x > 1645) break;
      this.guide
        .fillStyle(0xfffcde, 1 - i / 46)
        .fillCircle(p.x, p.y, i % 4 === 0 ? 4.5 : 3);
      if (
        this.entities.some(
          (e) =>
            !e.dead &&
            Math.abs(e.body.position.x - p.x) < e.p.w / 2 &&
            Math.abs(e.body.position.y - p.y) < e.p.h / 2,
        )
      )
        break;
    }
  }
  fire(vx: number, vy: number) {
    if (!this.started || this.paused || !this.settled) return false;
    const shot = this.round.launch();
    if (!shot) return false;
    this.shotAge = 0;
    this.cameraMode = "FOLLOW_PROJECTILE";
    this.audio.play("launch");
    this.liveArrow.setVisible(false);
    this.rama.setX(219);
    this.tweens.add({ targets: this.rama, x: 224, duration: 170 });
    for (let i = 0; i < shot.count; i++) {
      const a =
          Math.atan2(vy, vx) +
          (shot.count === 3 ? (i - 1) * CONFIG.volleySpread : 0),
        s = Math.hypot(vx, vy);
      const b = makeArrow(
        CONFIG.aim.x,
        CONFIG.aim.y,
        Math.cos(a) * s,
        Math.sin(a) * s,
      );
      Matter.Composite.add(this.engine.world, b);
      const im = this.add
        .image(b.position.x, b.position.y, "arrow")
        .setDisplaySize(85, 18)
        .setDepth(12);
      if (shot.ability !== "divine")
        im.setTint(CONFIG.weapons[shot.ability].color);
      this.arrows.push({
        body: b,
        image: im,
        ability: shot.ability,
        shot: shot.id,
        life: 0,
        done: false,
        penetration: CONFIG.weapons[shot.ability].penetration,
        hit: new Set(),
        previous: { ...b.position },
      });
    }
    this.hud();
    return true;
  }
  collision(a: Matter.Body, b: Matter.Body, normal: Matter.Vector) {
    if (
      !this.started ||
      !this.settled ||
      String(this.round.phase) === "TERMINAL"
    )
      return;
    const av = this.velocity.get(a.id) ?? a.velocity,
      bv = this.velocity.get(b.id) ?? b.velocity;
    const relative = Math.abs(
      (av.x - bv.x) * normal.x + (av.y - bv.y) * normal.y,
    );
    const arrowA = this.arrows.find((p) => p.body.id === a.id && !p.done),
      arrowB = this.arrows.find((p) => p.body.id === b.id && !p.done);
    if (arrowA || arrowB) {
      const arrow = (arrowA ?? arrowB)!;
      const target = arrowA ? b : a;
      this.arrowHit(
        arrow,
        target,
        Math.max(relative, Math.hypot(av.x - bv.x, av.y - bv.y) * 0.65),
      );
      return;
    }
    for (const [body, other] of [
      [a, b],
      [b, a],
    ]) {
      const e = this.entities.find((e) => e.body.id === body.id && !e.dead);
      if (!e || e.p.kind === "pickup") continue;
      const d = impact(relative, body.mass, other.mass);
      if (d > 0) this.damage(e, d);
    }
  }
  arrowHit(arrow: Arrow, body: Matter.Body, speed: number) {
    if (arrow.hit.has(body.id) || arrow.done) return;
    arrow.hit.add(body.id);
    const e = this.entities.find((e) => e.body.id === body.id && !e.dead);
    if (e?.p.kind === "pickup") {
      this.round.collect(e.p.ability!);
      this.remove(e);
      this.burst(
        e.body.position.x,
        e.body.position.y,
        CONFIG.weapons[e.p.ability!].color,
        18,
      );
      this.audio.play("power");
      this.notify(
        `${{ agni: "Agni Astra", vajra: "Vajra Arrow", volley: "Astra Volley" }[e.p.ability!]} collected · ready for your next shot`,
      );
      this.hud();
      return;
    }
    if (e) {
      const modifier =
        CONFIG.weapons[arrow.ability].damage *
        (arrow.ability === "agni" && e.p.kind === "wood" ? 1.8 : 1);
      this.damage(e, impact(speed, arrow.body.mass, body.mass, true, modifier));
      const force = 0.0025 * Math.min(body.mass, 8);
      Matter.Body.applyForce(body, body.position, {
        x: arrow.body.velocity.x * force,
        y: arrow.body.velocity.y * force,
      });
    }
    this.audio.play("impact");
    this.burst(
      body.position.x,
      body.position.y,
      CONFIG.weapons[arrow.ability].color,
      8,
    );
    if (arrow.ability === "agni") {
      const { x, y } = arrow.body.position;
      for (const other of this.entities) {
        if (other.dead || other.p.kind === "pickup") continue;
        const d = Math.hypot(
          other.body.position.x - x,
          other.body.position.y - y,
        );
        if (d < CONFIG.weapons.agni.radius)
          this.damage(other, (1 - d / CONFIG.weapons.agni.radius) * 14);
      }
    }
    if (arrow.penetration > 0 && !body.isStatic) {
      arrow.penetration--;
      Matter.Body.setVelocity(arrow.body, {
        x: Math.cos(arrow.body.angle) * 22,
        y: Math.sin(arrow.body.angle) * 22,
      });
    } else this.finishArrow(arrow);
  }
  damage(e: Entity, d: number) {
    if (e.dead || e.p.kind === "pickup") return;
    e.health -= d;
    if (e.health > 0) {
      if (d > 1) this.images.get(e.body.id)?.setTint(0xffd0a0);
      return;
    }
    if (e.p.kind === "head") {
      if (this.round.defeat(e.p.id)) {
        this.audio.play("head");
        this.notify(
          this.round.combo > 1
            ? `${this.round.combo} HEAD COMBO  +750`
            : "Ravana head defeated  +500",
        );
        this.burst(e.body.position.x, e.body.position.y, 0xffdb58, 13);
      }
    } else this.round.destroy(e.p.id, e.p.kind);
    this.remove(e);
    this.hud();
  }
  remove(e: Entity) {
    if (e.dead) return;
    e.dead = true;
    for (const other of this.entities)
      if (!other.dead && other.p.kind !== "pickup")
        Matter.Sleeping.set(other.body, false);
    Matter.Composite.remove(this.engine.world, e.body);
    const im = this.images.get(e.body.id);
    if (im) {
      this.tweens.add({
        targets: im,
        alpha: 0,
        scaleX: im.scaleX * 1.15,
        scaleY: im.scaleY * 1.15,
        duration: this.reduced ? 20 : 200,
        onComplete: () => im.destroy(),
      });
      this.images.delete(e.body.id);
    }
  }
  finishArrow(a: Arrow) {
    a.done = true;
    Matter.Composite.remove(this.engine.world, a.body);
    this.tweens.add({
      targets: a.image,
      alpha: 0,
      duration: 180,
      onComplete: () => a.image.destroy(),
    });
  }
  burst(x: number, y: number, color: number, count: number) {
    if (this.reduced) count = 3;
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      this.particles.push({
        x,
        y,
        vx: Math.cos(angle) * (1 + Math.random() * 3),
        vy: Math.sin(angle) * 3 - 2,
        life: 600,
        max: 600,
        color,
        r: 2 + Math.random() * 4,
      });
    }
    this.particles = this.particles.slice(-180);
  }
  start() {
    this.started = true;
    this.paused = false;
    this.round = new Round();
    this.age = 0;
    this.settled = false;
    this.cameraMode = "RETURN_TO_PLAYER";
    this.hud();
  }
  setPaused(p: boolean) {
    this.cancelAim();
    this.paused = p;
    this.hud();
  }
  update(time: number, delta: number) {
    for (let i = 0; i < (this.fastReplay ? 12 : 1); i++)
      this.advance(time, delta);
  }
  advance(_time: number, delta: number) {
    const dt = Math.min(delta, 50);
    if (this.paused) return;
    if (this.started && String(this.round.phase) !== "TERMINAL") {
      this.age += dt;
      if (this.age > CONFIG.physics.settle) this.settled = true;
      if (this.settled) this.round.tick(dt);
      if (
        import.meta.env.DEV &&
        this.replayQueue.length &&
        this.age >= this.replayAt &&
        this.round.phase === "READY"
      ) {
        const next = this.replayQueue.shift()!;
        this.fire(Math.cos(next[0]) * next[1], Math.sin(next[0]) * next[1]);
        this.replayAt = this.age + 6500;
      }
      this.accumulator += dt;
      while (this.accumulator >= CONFIG.physics.step) {
        for (const b of Matter.Composite.allBodies(this.engine.world))
          this.velocity.set(b.id, { ...b.velocity });
        for (const a of this.arrows)
          if (!a.done && a.body.speed > 0.5)
            Matter.Body.setAngle(
              a.body,
              Math.atan2(a.body.velocity.y, a.body.velocity.x),
            );
        Matter.Engine.update(this.engine, CONFIG.physics.step);
        this.accumulator -= CONFIG.physics.step;
        for (const a of this.arrows) {
          if (a.done) continue;
          a.life += CONFIG.physics.step;
          const b = a.body;
          // Swept ray supplements discrete contact for a fast, thin arrow.
          const hits = Matter.Query.ray(
            Matter.Composite.allBodies(this.engine.world).filter(
              (t) => t.id !== b.id && t.label !== "arrow",
            ),
            a.previous,
            b.position,
            5,
          );
          for (const hit of hits) {
            const target = hit.bodyA.id === b.id ? hit.bodyB : hit.bodyA;
            if (!a.hit.has(target.id))
              this.arrowHit(a, target, Math.hypot(b.velocity.x, b.velocity.y));
            if (a.done) break;
          }
          a.previous = { ...b.position };
          if (
            a.life > 3800 ||
            b.position.y > 1020 ||
            b.position.x > 1750 ||
            b.position.x < 0
          )
            this.finishArrow(a);
        }
      }
      for (const e of this.entities) {
        if (e.dead) continue;
        if (e.body.position.y > 1000) {
          if (e.p.kind === "head") this.damage(e, 999);
          else this.remove(e);
        }
      }
      if (this.round.phase === "FLYING" || this.round.phase === "RESOLVING") {
        this.shotAge += dt;
        const active = this.arrows.some((a) => !a.done);
        if (!active) {
          this.round.phase = "RESOLVING";
          this.cameraMode = "FOLLOW_DESTRUCTION";
        }
        const moving = this.entities.some(
          (e) =>
            !e.dead &&
            e.p.kind !== "pickup" &&
            (e.body.speed > 1 || e.body.angularSpeed > 0.04),
        );
        if (
          this.shotAge > CONFIG.physics.resolve ||
          (!active && !moving && this.shotAge > CONFIG.physics.minimumResolve)
        ) {
          for (const a of this.arrows) if (!a.done) this.finishArrow(a);
          this.round.finishShot();
          this.liveArrow.setVisible(false);
          this.rama.setRotation(0);
          this.cameraMode = "RETURN_TO_PLAYER";
        }
      }
      if (this.round.seconds <= 0) {
        this.cancelAim();
        this.expiryAge += dt;
        if (this.expiryAge > CONFIG.physics.expiryGrace)
          this.round.end(this.round.heads.size === 10, "Time is up");
        else if (this.round.phase === "READY") this.round.finishShot();
      }
      if (this.round.heads.size === 10) this.round.end(true);
      if (String(this.round.phase) === "TERMINAL") {
        this.cancelAim();
        if (this.round.won) {
          this.audio.play("win");
          for (let i = 0; i < 6; i++) {
            this.burst(
              960 + Math.random() * 570,
              240 + Math.random() * 350,
              [0xffbd45, 0xf65c3c, 0xffe9b2][i % 3],
              25,
            );
          }
        }
        this.onFinish(this.round);
      }
      this.hud();
    }
    for (const e of this.entities) {
      const im = this.images.get(e.body.id);
      if (im && !e.dead)
        im.setPosition(
          e.body.position.x,
          e.body.position.y - (e.p.kind === "head" ? 10 : 0),
        ).setRotation(e.body.angle);
    }
    for (const a of this.arrows) {
      if (a.done) continue;
      const v = a.body.velocity;
      a.image
        .setPosition(a.body.position.x, a.body.position.y)
        .setRotation(a.body.angle);
    }
    this.fx.clear();
    if (this.round.won && this.round.phase === "TERMINAL")
      for (let i = 0; i < 10; i++) {
        const x = 975 + i * 54;
        const sway = this.reduced ? 0 : Math.sin(_time / 190 + i) * 10;
        this.fx
          .fillStyle(0xed6425, 0.55)
          .fillTriangle(
            x - 16,
            765,
            x + 16,
            765,
            x + sway,
            710 - Math.sin(_time / 280 + i) * 18,
          );
        this.fx
          .fillStyle(0xffcf58, 0.65)
          .fillTriangle(x - 9, 765, x + 9, 765, x - sway * 0.4, 735);
      }
    for (const p of this.particles) {
      p.life -= dt;
      p.x += (p.vx * dt) / 16.67;
      p.y += (p.vy * dt) / 16.67;
      p.vy += (0.05 * dt) / 16.67;
      this.fx
        .fillStyle(p.color, Math.max(0, p.life / p.max))
        .fillCircle(p.x, p.y, p.r);
    }
    this.particles = this.particles.filter((p) => p.life > 0);
    if (
      this.scale.width / this.scale.height < 1 &&
      this.started &&
      this.round.phase !== "AIMING"
    ) {
      const c = this.cameras.main;
      const a = this.arrows.find((a) => !a.done);
      const x =
        this.cameraMode === "FOLLOW_PROJECTILE" && a
          ? a.body.position.x
          : this.cameraMode === "FOLLOW_DESTRUCTION"
            ? 1250
            : 350;
      const target = Phaser.Math.Clamp(
        x - c.width / 2 / c.zoom,
        0,
        1672 - c.width / c.zoom,
      );
      c.scrollX = Phaser.Math.Linear(
        c.scrollX,
        target,
        this.reduced ? 1 : CONFIG.camera.follow,
      );
    }
    if (this.debug) {
      this.fx.lineStyle(1, 0xff00cc, 0.8);
      for (const b of Matter.Composite.allBodies(this.engine.world)) {
        this.fx.strokePoints(
          b.vertices as Phaser.Types.Math.Vector2Like[],
          true,
        );
      }
    }
  }
}
