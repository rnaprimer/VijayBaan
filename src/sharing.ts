import { Round, resultText } from "./rules";
import { ASSET_BASE } from "./config";

export const POSTER_ART = ASSET_BASE + "sharing/poster.png";
interface ScorePoster {
  file: File;
  url: string;
}
let cached: { round: Round; poster: Promise<ScorePoster> } | null = null;

export function releaseScoreCard() {
  const previous = cached;
  cached = null;
  if (previous)
    void previous.poster.then(
      (p) => URL.revokeObjectURL(p.url),
      () => {},
    );
}

export function prepareScoreCard(r: Round): Promise<ScorePoster> {
  if (cached?.round === r) return cached.poster;
  releaseScoreCard();
  const poster = renderPoster(r);
  cached = { round: r, poster };
  return poster;
}

async function renderPoster(r: Round): Promise<ScorePoster> {
  const image = new Image();
  image.src = POSTER_ART;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  const artHeight = Math.round(
    (1200 * image.naturalHeight) / image.naturalWidth,
  );
  canvas.height = artHeight + 320;
  const g = canvas.getContext("2d");
  if (!g) throw new Error("Score poster canvas unavailable");
  // Preserve the entire uploaded illustration; put the result in a separate footer.
  g.drawImage(image, 0, 0, canvas.width, artHeight);
  g.fillStyle = "#fff5df";
  g.fillRect(0, artHeight, canvas.width, 320);
  g.fillStyle = "#bd4428";
  g.fillRect(0, artHeight, canvas.width, 7);
  g.textAlign = "left";
  g.font = "bold 25px sans-serif";
  g.fillText(
    r.won ? "VIJAY! GOOD TRIUMPHS OVER EVIL" : "THE VIJAY BAAN CHALLENGE",
    50,
    artHeight + 55,
  );
  g.fillStyle = "#77331e";
  g.font = "bold 84px Georgia";
  g.fillText(r.score.toLocaleString(), 50, artHeight + 145, 570);
  g.fillStyle = "#a17628";
  g.textAlign = "right";
  g.font = "50px sans-serif";
  g.fillText(
    "★".repeat(r.stars()) + "☆".repeat(3 - r.stars()),
    1150,
    artHeight + 135,
  );
  g.fillStyle = "#56422e";
  g.textAlign = "left";
  g.font = "27px sans-serif";
  g.fillText(
    `${r.heads.size}/10 heads · ${Math.floor(r.seconds)}s left · ${r.arrows} arrows left`,
    50,
    artHeight + 195,
  );
  g.font = "bold 26px sans-serif";
  g.fillText("Can you beat my score? Play VIJAY BAAN!", 50, artHeight + 250);
  g.font = "19px sans-serif";
  g.fillText(location.href.split(/[?#]/)[0], 50, artHeight + 291, 1100);
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Poster encoding failed"))),
      "image/png",
    ),
  );
  const file = new File([blob], "vijay-baan-score.png", { type: "image/png" });
  return { file, url: URL.createObjectURL(blob) };
}

export async function copyResult(r: Round) {
  const text = resultText(r, location.href.split("?")[0]);
  try {
    await navigator.clipboard.writeText(text);
    return "Result copied";
  } catch {
    const el = document.createElement("textarea");
    el.value = text;
    document.body.append(el);
    el.select();
    const ok = document.execCommand("copy");
    el.remove();
    return ok
      ? "Result copied"
      : "Copy unavailable — please try your browser's copy option";
  }
}

// The poster is prepared when results appear, before the share-button gesture.
export async function shareResult(r: Round) {
  const text = resultText(r, location.href.split("?")[0]);
  if (navigator.share) {
    try {
      let poster: ScorePoster | null = null;
      try {
        poster = await prepareScoreCard(r);
      } catch {
        /* Text sharing still works if image generation fails. */
      }
      const files = poster ? [poster.file] : [];
      if (files.length && navigator.canShare?.({ files })) {
        await navigator.share({ title: "VIJAY BAAN", text, files });
        return "Poster share completed";
      }
      await navigator.share({ title: "VIJAY BAAN", text });
      return "Score shared. Download the poster to attach it where image sharing is unavailable.";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "Sharing cancelled";
    }
  }
  window.open(
    "https://wa.me/?text=" + encodeURIComponent(text),
    "_blank",
    "noopener,noreferrer",
  );
  return "WhatsApp sharing opened. Download your poster to attach it to your message.";
}

export async function downloadCard(r: Round) {
  const poster = await prepareScoreCard(r);
  const a = document.createElement("a");
  a.download = poster.file.name;
  a.href = poster.url;
  document.body.append(a);
  a.click();
  a.remove();
  return "Poster ready — check your downloads, then share it with your friends.";
}
