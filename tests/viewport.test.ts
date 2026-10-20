import { test } from "node:test";
import assert from "node:assert/strict";
import { battlefieldView, bindGameViewport } from "../src/viewport";

function fixture() {
  const frames = new Map<number, FrameRequestCallback>();
  const timers = new Map<number, () => void>();
  const properties = new Map<string, string>();
  const calls: number[][] = [];
  let id = 0,
    bounds = 0,
    followCss = false,
    disconnected = false;
  let observe = () => {};
  const host = { clientWidth: 390, clientHeight: 634 };
  const visual = Object.assign(new EventTarget(), {
    width: 390,
    height: 844,
    scale: 1,
  });
  const orientation = new EventTarget();
  const document = Object.assign(new EventTarget(), {
    documentElement: {
      style: {
        getPropertyValue: (key: string) => properties.get(key) ?? "",
        setProperty: (key: string, value: string) => {
          properties.set(key, value);
          if (followCss) {
            if (key.endsWith("width")) host.clientWidth = parseInt(value);
            if (key.endsWith("height")) host.clientHeight = parseInt(value);
          }
        },
      },
    },
  });
  const win = Object.assign(new EventTarget(), {
    document,
    visualViewport: visual,
    screen: { orientation },
    innerWidth: 390,
    innerHeight: 844,
    requestAnimationFrame: (callback: FrameRequestCallback) => {
      frames.set(++id, callback);
      return id;
    },
    cancelAnimationFrame: (key: number) => frames.delete(key),
    setTimeout: (callback: () => void) => {
      timers.set(++id, callback);
      return id;
    },
    clearTimeout: (key: number) => timers.delete(key),
  });
  const canvas = {
    width: 390,
    height: 634,
    style: { width: "390px", height: "634px" },
  };
  const scale = {
    width: 390,
    height: 634,
    resize(width: number, height: number) {
      this.width = canvas.width = width;
      this.height = canvas.height = height;
      calls.push([width, height]);
    },
    updateBounds() {
      bounds++;
    },
  };
  const previous = Object.getOwnPropertyDescriptor(
    globalThis,
    "ResizeObserver",
  );
  Object.defineProperty(globalThis, "ResizeObserver", {
    configurable: true,
    value: class {
      constructor(callback: () => void) {
        observe = callback;
      }
      observe() {}
      disconnect() {
        disconnected = true;
      }
    },
  });
  const stop = bindGameViewport(
    host,
    { canvas, scale } as any,
    win as unknown as Window,
  );
  const flush = () => {
    const batch = [...frames.values()];
    frames.clear();
    batch.forEach((cb) => cb(0));
  };
  return {
    win,
    host,
    visual,
    canvas,
    calls,
    properties,
    frames,
    timers,
    flush,
    stop,
    layout() {
      observe();
    },
    autoLayout() {
      followCss = true;
    },
    settle() {
      const batch = [...timers.values()];
      timers.clear();
      batch.forEach((cb) => cb());
      flush();
    },
    get bounds() {
      return bounds;
    },
    get disconnected() {
      return disconnected;
    },
    cleanup() {
      stop();
      if (previous)
        Object.defineProperty(globalThis, "ResizeObserver", previous);
      else delete (globalThis as any).ResizeObserver;
    },
  };
}

test("late CSS layout after rotation resizes the backing canvas without a refresh", () => {
  const f = fixture();
  try {
    f.flush();
    f.win.innerWidth = 844;
    f.win.innerHeight = 390;
    f.win.dispatchEvent(new Event("orientationchange"));
    f.flush();
    // The browser still reports the old portrait visual viewport; do not use it.
    assert.equal(f.properties.get("--game-viewport-width"), "844px");
    assert.equal(f.canvas.width, 390);
    // CSS finishes AFTER the orientation event, without another window resize.
    f.host.clientWidth = 844;
    f.host.clientHeight = 390;
    f.layout();
    f.flush();
    assert.deepEqual(f.calls, [[844, 390]]);
    assert.equal(f.canvas.style.width, "844px");
    assert.equal(f.canvas.style.height, "390px");
  } finally {
    f.cleanup();
  }
});
test("delayed rotation retries recover even if container notification is missed", () => {
  const f = fixture();
  try {
    f.flush();
    f.win.dispatchEvent(new Event("orientationchange"));
    f.flush();
    f.host.clientWidth = 915;
    f.host.clientHeight = 320;
    f.settle();
    assert.deepEqual(f.calls, [[915, 320]]);
  } finally {
    f.cleanup();
  }
});
test("address-bar viewport changes resize the game even without a window resize", () => {
  const f = fixture();
  try {
    f.autoLayout();
    f.win.innerWidth = f.visual.width = 844;
    f.win.innerHeight = f.visual.height = 390;
    f.flush();
    f.visual.height = 320;
    f.visual.dispatchEvent(new Event("resize"));
    f.flush();
    assert.deepEqual(f.calls, [
      [844, 390],
      [844, 320],
    ]);
    assert.equal(f.canvas.height, 320);
    assert.ok(f.bounds >= 2);
  } finally {
    f.cleanup();
  }
});
test("repeated rotations coalesce events and never leave the old canvas dimensions", () => {
  const f = fixture();
  try {
    f.flush();
    for (const [width, height] of [
      [844, 390],
      [390, 634],
      [915, 320],
      [390, 634],
      [844, 390],
    ]) {
      f.host.clientWidth = width;
      f.host.clientHeight = height;
      f.win.dispatchEvent(new Event("resize"));
      f.win.dispatchEvent(new Event("orientationchange"));
      f.layout();
      assert.equal(f.frames.size, 1);
      f.flush();
      assert.equal(f.canvas.width, width);
      assert.equal(f.canvas.height, height);
    }
    assert.equal(f.calls.length, 5);
  } finally {
    f.cleanup();
  }
});
test("hidden or zero-sized layout is skipped and later recovers", () => {
  const f = fixture();
  try {
    f.host.clientWidth = 0;
    f.host.clientHeight = 0;
    f.flush();
    assert.equal(f.calls.length, 0);
    f.host.clientWidth = 844;
    f.host.clientHeight = 390;
    f.layout();
    f.flush();
    assert.deepEqual(f.calls, [[844, 390]]);
  } finally {
    f.cleanup();
  }
});
test("pinch zoom does not shrink the logical game viewport", () => {
  const f = fixture();
  try {
    f.visual.scale = 2;
    f.visual.width = 195;
    f.visual.height = 422;
    f.flush();
    assert.equal(f.properties.get("--game-viewport-width"), "390px");
    assert.equal(f.properties.get("--game-viewport-height"), "844px");
  } finally {
    f.cleanup();
  }
});
test("destroying the game cancels retries, frames, observers, and listeners", () => {
  const f = fixture();
  try {
    f.stop();
    assert.equal(f.frames.size, 0);
    assert.equal(f.timers.size, 0);
    assert.equal(f.disconnected, true);
    f.win.dispatchEvent(new Event("resize"));
    f.visual.dispatchEvent(new Event("resize"));
    f.layout();
    assert.equal(f.frames.size, 0);
    assert.equal(f.calls.length, 0);
  } finally {
    f.cleanup();
  }
});
test("camera orientation follows actual canvas dimensions, not stale CSS media state", () => {
  const portrait = battlefieldView(390, 634, true),
    landscape = battlefieldView(844, 390, true);
  assert.equal(portrait.centerX, 350);
  assert.equal(portrait.width, 390);
  assert.equal(landscape.centerX, 836);
  assert.equal(landscape.width, 844);
  assert.equal(landscape.height, 390);
  assert.ok(Math.abs(landscape.zoom * 1672 - 844) < 0.001);
  const shallow = battlefieldView(915, 320, true);
  assert.ok(shallow.centerY + shallow.height / shallow.zoom / 2 >= 826);
  assert.ok(shallow.centerY - shallow.height / shallow.zoom / 2 < 340);
});
