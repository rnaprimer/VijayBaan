import { CONFIG } from "./config";

/** Camera framing depends on the canvas we have, never a possibly newer CSS orientation. */
export function battlefieldView(width: number, height: number, touch: boolean) {
  const world = CONFIG.world;
  const portrait = width < height;
  const immersive = !portrait && (height <= 600 || touch);
  const zoom = portrait
    ? height / world.height
    : immersive
      ? Math.max(width / world.width, height / world.height)
      : Math.min(width / world.width, height / world.height);
  const fill = portrait || immersive;
  const viewportWidth = fill ? width : world.width * zoom;
  const viewportHeight = fill ? height : world.height * zoom;
  return {
    x: fill ? 0 : (width - viewportWidth) / 2,
    y: fill ? 0 : (height - viewportHeight) / 2,
    width: viewportWidth,
    height: viewportHeight,
    zoom,
    centerX: portrait ? CONFIG.camera.playerX : world.width / 2,
    // Browser controls make some landscape viewports very shallow. Keep the platforms visible.
    centerY: immersive
      ? Math.max(
          world.height / 2,
          CONFIG.camera.landscapeBottom - height / zoom / 2,
        )
      : world.height / 2,
  };
}

interface ViewportGame {
  canvas: Pick<HTMLCanvasElement, "width" | "height" | "style">;
  scale: {
    width: number;
    height: number;
    resize(width: number, height: number): unknown;
    updateBounds(): unknown;
  };
}

/** One owner sizes CSS, the backing canvas, renderer, cameras, and pointer bounds together. */
export function bindGameViewport(
  host: Pick<HTMLElement, "clientWidth" | "clientHeight">,
  game: ViewportGame,
  win: Window = window,
) {
  let stopped = false;
  let frame: number | null = null;
  let retries: number[] = [];
  const root = win.document.documentElement.style;
  const visual = win.visualViewport;
  const orientation = win.screen.orientation;

  const sync = () => {
    frame = null;
    if (stopped) return;
    // Ignore pinch zoom and transient visual-viewport measurements from the old orientation.
    const sameOrientation =
      visual &&
      visual.width >= visual.height === win.innerWidth >= win.innerHeight;
    const useVisual =
      visual && Math.abs(visual.scale - 1) < 0.01 && sameOrientation;
    const viewportWidth = useVisual ? visual.width : win.innerWidth;
    const viewportHeight = useVisual ? visual.height : win.innerHeight;
    for (const [key, value] of [
      ["--game-viewport-width", viewportWidth],
      ["--game-viewport-height", viewportHeight],
    ] as const) {
      if (value > 0 && Number.isFinite(value)) {
        const pixels = `${Math.floor(value)}px`;
        if (root.getPropertyValue(key) !== pixels)
          root.setProperty(key, pixels);
      }
    }
    // Read AFTER CSS dimensions and orientation rules have been applied to the container.
    const width = Math.floor(host.clientWidth);
    const height = Math.floor(host.clientHeight);
    if (width <= 0 || height <= 0) return;
    const resized =
      game.scale.width !== width ||
      game.scale.height !== height ||
      game.canvas.width !== width ||
      game.canvas.height !== height;
    // NONE mode deliberately avoids Phaser's independent parent-size polling.
    game.canvas.style.width = `${width}px`;
    game.canvas.style.height = `${height}px`;
    if (resized) game.scale.resize(width, height);
    game.scale.updateBounds();
  };
  const schedule = () => {
    if (!stopped && frame === null) frame = win.requestAnimationFrame(sync);
  };
  const settle = () => {
    schedule();
    retries.forEach((id) => win.clearTimeout(id));
    // Mobile browsers may announce rotation before layout and address-bar animation finish.
    retries = [80, 250, 700].map((delay) => win.setTimeout(schedule, delay));
  };
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  if (observer) observer.observe(host as HTMLElement);
  win.addEventListener("resize", settle);
  win.addEventListener("orientationchange", settle);
  win.addEventListener("pageshow", settle);
  visual?.addEventListener("resize", settle);
  visual?.addEventListener("scroll", schedule);
  orientation?.addEventListener("change", settle);
  win.document.addEventListener("visibilitychange", settle);
  settle();

  return () => {
    stopped = true;
    if (frame !== null) win.cancelAnimationFrame(frame);
    retries.forEach((id) => win.clearTimeout(id));
    observer?.disconnect();
    win.removeEventListener("resize", settle);
    win.removeEventListener("orientationchange", settle);
    win.removeEventListener("pageshow", settle);
    visual?.removeEventListener("resize", settle);
    visual?.removeEventListener("scroll", schedule);
    orientation?.removeEventListener("change", settle);
    win.document.removeEventListener("visibilitychange", settle);
  };
}
