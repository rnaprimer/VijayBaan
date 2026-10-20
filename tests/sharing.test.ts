import { test } from "node:test";
import assert from "node:assert/strict";
import { Round } from "../src/rules";
import {
  POSTER_ART,
  prepareScoreCard,
  releaseScoreCard,
  shareResult,
  downloadCard,
} from "../src/sharing";

function browser(
  share?: (data: ShareData) => Promise<void>,
  canShare = () => true,
) {
  const drawn: unknown[][] = [],
    text: string[] = [],
    opened: string[] = [],
    links: { download?: string; href?: string; clicked?: boolean }[] = [];
  const descriptors = new Map<string, PropertyDescriptor | undefined>();
  const define = (key: string, value: unknown) => {
    descriptors.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      value,
      configurable: true,
      writable: true,
    });
  };
  define(
    "Image",
    class {
      src = "";
      naturalWidth = 1448;
      naturalHeight = 1086;
      async decode() {
        assert.equal(this.src, POSTER_ART);
      }
    },
  );
  define("location", {
    href: "https://game.example/play?debug",
    origin: "https://game.example",
  });
  define("navigator", { share, canShare });
  define("window", {
    open: (url: string) => {
      opened.push(url);
      return {};
    },
  });
  define("document", {
    body: { append: () => {} },
    createElement: (tag: string) => {
      if (tag === "canvas")
        return {
          width: 0,
          height: 0,
          getContext: () => ({
            drawImage: (...args: unknown[]) => drawn.push(args),
            fillRect: () => {},
            fillText: (value: string) => text.push(value),
          }),
          toBlob: (cb: (b: Blob) => void) =>
            cb(new Blob(["poster"], { type: "image/png" })),
        };
      const link = {
        download: "",
        href: "",
        clicked: false,
        click() {
          this.clicked = true;
        },
        remove() {},
      };
      links.push(link);
      return link;
    },
  });
  return {
    drawn,
    text,
    opened,
    links,
    restore() {
      releaseScoreCard();
      for (const [key, value] of descriptors) {
        if (value) Object.defineProperty(globalThis, key, value);
        else delete (globalThis as Record<string, unknown>)[key];
      }
    },
  };
}

test("poster preserves the complete illustration and includes actual round results", async () => {
  const b = browser();
  try {
    const r = new Round();
    r.score = 2450;
    r.heads.add("head-0");
    r.seconds = 42;
    r.arrows = 6;
    const p = await prepareScoreCard(r);
    assert.equal(p.file.type, "image/png");
    assert.equal(p.file.name, "vijay-baan-score.png");
    assert.deepEqual(b.drawn[0].slice(1), [0, 0, 1200, 900]);
    assert.ok(b.text.includes("2,450"));
    assert.ok(b.text.includes("1/10 heads · 42s left · 6 arrows left"));
    assert.ok(b.text.includes("https://game.example/play"));
    assert.equal(await prepareScoreCard(r), p);
  } finally {
    b.restore();
  }
});
test("native image sharing sends the generated PNG and dynamic score text", async () => {
  let data: ShareData | undefined;
  const b = browser(async (d) => {
    data = d;
  });
  try {
    const r = new Round();
    r.score = 3210;
    const status = await shareResult(r);
    assert.equal(status, "Poster share completed");
    assert.equal(data!.files!.length, 1);
    assert.equal(data!.files![0].type, "image/png");
    assert.ok(data!.text!.includes("3,210"));
    assert.equal(b.opened.length, 0);
  } finally {
    b.restore();
  }
});
test("cancelling native image sharing does not open another service", async () => {
  const b = browser(async () => {
    throw new DOMException("Cancelled", "AbortError");
  });
  try {
    assert.equal(await shareResult(new Round()), "Sharing cancelled");
    assert.equal(b.opened.length, 0);
  } finally {
    b.restore();
  }
});
test("text-only native sharing explains how to attach the poster", async () => {
  let data: ShareData | undefined;
  const b = browser(
    async (d) => {
      data = d;
    },
    () => false,
  );
  try {
    const status = await shareResult(new Round());
    assert.equal(data!.files, undefined);
    assert.match(status, /Download the poster/);
    assert.equal(b.opened.length, 0);
  } finally {
    b.restore();
  }
});
test("unsupported native sharing opens WhatsApp compose without claiming to send", async () => {
  const b = browser();
  try {
    const r = new Round();
    r.score = 2000;
    const status = await shareResult(r);
    assert.match(b.opened[0], /^https:\/\/wa.me\/\?text=/);
    assert.ok(decodeURIComponent(b.opened[0]).includes("2,000"));
    assert.match(status, /opened/);
    assert.match(status, /Download your poster/);
  } finally {
    b.restore();
  }
});
test("download uses the same generated poster as the share action", async () => {
  const b = browser();
  try {
    const r = new Round(),
      poster = await prepareScoreCard(r);
    await downloadCard(r);
    assert.equal(b.links[0].href, poster.url);
    assert.equal(b.links[0].download, "vijay-baan-score.png");
    assert.equal(b.links[0].clicked, true);
  } finally {
    b.restore();
  }
});
