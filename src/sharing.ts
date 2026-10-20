import { Round, resultText } from "./rules";
import { ASSET_BASE } from "./config";
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
      : "Copy unavailable — select the result text above";
  }
}
export async function shareResult(r: Round) {
  const text = resultText(r, location.href.split("?")[0]);
  if (navigator.share) {
    try {
      await navigator.share({ title: "VIJAY BAAN", text });
      return "Share dialog completed";
    } catch (e) {
      if ((e as Error).name === "AbortError") return "Sharing cancelled";
    }
  }
  window.open(
    "https://wa.me/?text=" + encodeURIComponent(text),
    "_blank",
    "noopener,noreferrer",
  );
  return "WhatsApp sharing opened";
}
export async function downloadCard(r: Round) {
  const c = document.createElement("canvas");
  c.width = 1200;
  c.height = 750;
  const g = c.getContext("2d")!;
  g.fillStyle = "#fff5df";
  g.fillRect(0, 0, 1200, 750);
  g.strokeStyle = "#dfb666";
  g.lineWidth = 4;
  g.strokeRect(25, 25, 1150, 700);
  const im = new Image();
  im.src = ASSET_BASE + "characters/rama.png";
  await im.decode();
  g.drawImage(im, 58, 230, 410, 420);
  g.fillStyle = "#ab341f";
  g.font = "bold 72px Georgia";
  g.fillText("VIJAY BAAN", 75, 135);
  g.fillStyle = "#50402f";
  g.font = "25px sans-serif";
  g.fillText("THE DUSSEHRA ARROW CHALLENGE", 80, 185);
  g.font = "bold 38px Georgia";
  g.fillText(r.won ? "Good Triumphs Over Evil" : "A heroic attempt", 525, 290);
  g.fillStyle = "#bd4025";
  g.font = "bold 90px Georgia";
  g.fillText(r.score.toLocaleString(), 525, 395);
  g.fillStyle = "#50402f";
  g.font = "28px sans-serif";
  g.fillText(
    `${r.heads.size}/10 heads · ${Math.floor(r.seconds)}s left · ${r.arrows} arrows`,
    525,
    452,
  );
  g.fillStyle = "#d8971c";
  g.font = "50px sans-serif";
  g.fillText("★".repeat(r.stars()) + "☆".repeat(3 - r.stars()), 525, 525);
  g.fillStyle = "#50402f";
  g.font = "23px sans-serif";
  g.fillText("Can you beat my score?", 525, 590);
  g.font = "17px sans-serif";
  g.fillText(location.origin, 75, 695, 1050);
  const a = document.createElement("a");
  a.download = "vijay-baan-score.png";
  a.href = c.toDataURL("image/png");
  a.click();
  return "Score card downloaded";
}
