import Phaser from "phaser";
import { Battlefield } from "./scene";
import { Round, readBest, saveBest } from "./rules";
import { copyResult, shareResult, downloadCard } from "./sharing";
import "./style.css";
import { REPLAYS } from "./replays";
const asset = "/assets/game/";
document.querySelector<HTMLDivElement>("#app")!.innerHTML = `
<header class="masthead"><a class="brand" href="./" aria-label="Vijay Baan home"><span class="brand-icon">➶</span><span>VIJAY BAAN<small>THE DUSSEHRA ARROW CHALLENGE</small></span></a><div class="header-right"><span class="edition">ONE BOW. TEN HEADS. ONE EPIC CHALLENGE.</span><button id="help" class="icon" aria-label="How to play">?</button><button id="sound" class="icon" aria-label="Toggle sound" title="Toggle sound">♪</button></div></header>
<main><div class="game-topline"><span><i></i> THE BATTLEFIELD</span><span class="top-note">A little aim. A little strategy. A legendary victory.</span></div>
<section class="arena" aria-label="Vijay Baan game"><div id="game"></div><div id="hud" class="hud hidden"><div class="stats"><div><small>SCORE</small><b id="score">0</b></div><div><small>TIME</small><b id="time">1:30</b></div><div><small>ARROWS</small><b id="arrows">10 <em>➶</em></b></div><div><small>HEADS</small><b id="heads">0 <em>/ 10</em></b></div></div><div class="hud-right"><div class="ability"><span id="ability-icon">➶</span><span><small>YOUR NEXT SHOT</small><b id="ability">Divine Arrow</b></span></div><button id="pause" class="icon" aria-label="Pause game">Ⅱ</button></div></div>
<div id="message" role="status"></div><div id="aim-hint" class="aim-hint hidden">← Pull back near the bow. Release to shoot.</div><div id="overview" class="overview hidden"><span>RAMA</span><div>● ───────── ◈</div><span>FORTRESS →</span></div>
<div id="menu" class="overlay"><div class="welcome"><div class="eyebrow">CELEBRATE THE TRIUMPH OF GOOD</div><div class="title-ornament">✦ ─── 🏹 ─── ✦</div><h1>VIJAY <span>BAAN</span></h1><p class="subtitle">The Dussehra Arrow Challenge</p><div class="cast"><img src="${asset}characters/rama.png" alt="Shri Ram drawing his bow"><span class="versus">GOOD<br><i>vs</i><br>EVIL</span><img src="${asset}characters/ravana-heads/01.png" alt="A crowned Ravana head"></div><p class="intro">Ten heads. One fortress. Your legendary shot.</p><button class="primary" id="play">LET THE ARROWS FLY <span>➶</span></button><p class="menu-instruction">Drag back to aim · Release to shoot · Bring down the fortress</p><div class="best-line">PERSONAL BEST <b id="menu-best">${readBest().score.toLocaleString()}</b></div></div></div>
<div id="pause-menu" class="overlay hidden"><div class="panel"><div class="eyebrow">TAKE A BREATH, HERO</div><h2>Battle paused</h2><p>Your next legendary shot can wait.</p><button id="resume" class="primary">RESUME BATTLE ➶</button><button id="restart-pause" class="secondary">Restart challenge</button><button id="pause-sound" class="secondary">Toggle sound</button><button id="return-menu" class="text-button">Return to menu</button></div></div>
<div id="results" class="overlay hidden"><div class="panel result"><div id="result-eyebrow" class="eyebrow"></div><h2 id="result-title"></h2><p id="result-sub"></p><div id="stars" class="stars"></div><div class="final-score" id="final-score"></div><div class="result-stats" id="result-stats"></div><p class="personal" id="personal"></p><button id="again" class="primary">PLAY AGAIN ➶</button><div class="share-row"><button id="share" class="secondary">↗ Share score</button><button id="download" class="secondary">↓ Score card</button></div><button id="copy" class="text-button">Copy result</button><p id="share-status" role="status"></p></div></div>
<div id="help-menu" class="overlay hidden"><div class="panel"><div class="eyebrow">A HERO’S FIELD GUIDE</div><h2>Make every arrow count.</h2><p>Press near Ram’s bow, pull backward, and release. A longer pull sends a stronger arrow. Lift your aim for a higher arc.</p><p>Aim for wooden supports to topple the fortress. Falling blocks can defeat several heads in one shot.</p><div class="help-powerups"><span>🔥 <b>Agni</b> burns nearby supports</span><span>⚡ <b>Vajra</b> pierces three objects</span><span>✦ <b>Volley</b> fires three arrows</span></div><p>Hit a magical object directly to store its ability for your next shot. Defeat all ten heads with ten arrows in 90 seconds.</p><button id="close-help" class="primary">GOT IT ➶</button></div></div></section>
<div class="below-game"><div class="steps"><span><b>01</b> PULL TO AIM</span><i>—</i><span><b>02</b> RELEASE TO SHOOT</span><i>—</i><span><b>03</b> LET THE FORTRESS FALL</span></div><span class="landscape-note">↻ Best enjoyed in landscape</span></div>
<div class="legend"><span class="legend-label">DIVINE POSSIBILITIES</span><div><img src="${asset}powerups/agni.png" alt=""><span><b>Agni Astra</b><small>Set supports ablaze</small></span></div><div><img src="${asset}powerups/vajra.png" alt=""><span><b>Vajra Arrow</b><small>Pierce the defenses</small></span></div><div><img src="${asset}powerups/volley.png" alt=""><span><b>Astra Volley</b><small>Triple your impact</small></span></div><p>Hit a power-up.<br>Empower your next shot.</p></div></main>
<footer><span>CRAFTED FOR THE SPIRIT OF DUSSEHRA</span><span>Good triumphs. Legends live on. <i>✦</i></span></footer>`;
const $ = (id: string) => document.getElementById(id)!;
const show = (id: string, visible: boolean) =>
  $(id).classList.toggle("hidden", !visible);
const scene = new Battlefield();
let currentResult: Round | null = null;
let muted = false;
let helpWasPaused = false;
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: "game",
  transparent: true,
  antialias: true,
  scale: {
    mode: Phaser.Scale.RESIZE,
    width: $("game").clientWidth,
    height: $("game").clientHeight,
  },
  physics: {
    default: "matter",
    matter: { gravity: { x: 0, y: 0.9 }, enableSleeping: true, debug: false },
  },
  scene: [scene],
  input: { activePointers: 2 },
  render: { pixelArt: false, roundPixels: false },
  fps: { target: 60 },
});
function toast(s: string) {
  $("message").textContent = s;
  $("message").classList.add("visible");
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(
    () => $("message").classList.remove("visible"),
    2400,
  );
}
let toastTimer = 0;
scene.notify = toast;
let previous = "";
scene.hud = () => {
  const r = scene.round;
  const text = [
    r.score,
    Math.ceil(r.seconds),
    r.arrows,
    r.heads.size,
    r.stored,
    r.phase,
    scene.settled,
  ].join();
  if (text === previous) return;
  previous = text;
  $("score").textContent = r.score.toLocaleString();
  const t = Math.ceil(r.seconds);
  $("time").textContent =
    `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
  $("time").classList.toggle("urgent", t < 16);
  $("arrows").innerHTML = `${r.arrows} <em>➶</em>`;
  $("heads").innerHTML = `${r.heads.size} <em>/ 10</em>`;
  $("ability").textContent = {
    divine: "Divine Arrow",
    agni: "Agni Astra",
    vajra: "Vajra Arrow",
    volley: "Astra Volley",
  }[r.stored];
  $("ability-icon").textContent = {
    divine: "➶",
    agni: "🔥",
    vajra: "⚡",
    volley: "✦",
  }[r.stored];
  show("aim-hint", scene.started && r.phase === "READY" && scene.settled);
};
scene.onFinish = (r) => {
  currentResult = r;
  show("aim-hint", false);
  const best = saveBest(r);
  $("result-eyebrow").textContent = r.won
    ? "THE FORTRESS HAS FALLEN"
    : "A LEGEND IN THE MAKING";
  $("result-title").textContent = r.won ? "VIJAY!" : "Almost There!";
  $("result-sub").textContent = r.won
    ? "Good Triumphs Over Evil"
    : r.reason || "The fortress still stands.";
  $("stars").textContent = "★".repeat(r.stars()) + "☆".repeat(3 - r.stars());
  $("final-score").textContent = r.score.toLocaleString();
  $("result-stats").innerHTML =
    `<span><b>${r.heads.size}/10</b>HEADS DEFEATED</span><span><b>${Math.floor(r.seconds)}s</b>REMAINING</span><span><b>${r.arrows}</b>UNUSED ARROWS</span>`;
  $("personal").textContent = `PERSONAL BEST  ${best.score.toLocaleString()}`;
  $("share-status").textContent = "";
  window.setTimeout(() => show("results", true), r.won ? 950 : 250);
};
function start() {
  show("menu", false);
  show("hud", true);
  show("overview", true);
  scene.audio.unlock();
  scene.start();
}
function restart(toMenu = false) {
  show("overview", !toMenu);
  clearTimeout(toastTimer);
  $("message").textContent = "";
  $("message").classList.remove("visible");
  show("results", false);
  show("pause-menu", false);
  show("help-menu", false);
  show("aim-hint", false);
  show("menu", toMenu);
  show("hud", !toMenu);
  currentResult = null;
  previous = "";
  scene.scene.restart();
  scene.events.once("create", () => {
    scene.audio.muted = muted;
    if (!toMenu) scene.start();
  });
}
$("play").onclick = start;
$("again").onclick = () => restart();
$("restart-pause").onclick = () => restart();
$("return-menu").onclick = () => {
  restart(true);
  $("menu-best").textContent = readBest().score.toLocaleString();
};
$("pause").onclick = () => {
  scene.setPaused(true);
  show("pause-menu", true);
};
$("resume").onclick = () => {
  scene.setPaused(false);
  show("pause-menu", false);
};
function sound() {
  muted = !muted;
  scene.audio.muted = muted;
  if (!muted) scene.audio.unlock();
  $("sound").textContent = muted ? "♩" : "♪";
  $("sound").setAttribute("aria-label", muted ? "Enable sound" : "Mute sound");
  $("sound").classList.toggle("muted", muted);
  $("pause-sound").textContent = muted
    ? "Sound: off · enable"
    : "Sound: on · mute";
}
$("sound").onclick = sound;
$("pause-sound").onclick = sound;
$("help").onclick = () => {
  helpWasPaused = scene.paused;
  scene.setPaused(true);
  show("help-menu", true);
};
$("close-help").onclick = () => {
  show("help-menu", false);
  scene.setPaused(helpWasPaused);
};
$("share").onclick = async () => {
  if (currentResult)
    $("share-status").textContent = await shareResult(currentResult);
};
$("copy").onclick = async () => {
  if (currentResult)
    $("share-status").textContent = await copyResult(currentResult);
};
$("download").onclick = async () => {
  if (currentResult)
    try {
      $("share-status").textContent = await downloadCard(currentResult);
    } catch {
      $("share-status").textContent =
        "Could not create the score card. Please retry.";
    }
};
document.addEventListener("visibilitychange", () => {
  if (document.hidden && scene.started && scene.round.phase !== "TERMINAL") {
    scene.setPaused(true);
    show("pause-menu", true);
  }
});
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && scene.started && scene.round.phase !== "TERMINAL") {
    scene.setPaused(!scene.paused);
    show("pause-menu", scene.paused);
  }
});
window.addEventListener("pagehide", () => game.destroy(true), { once: true });

if (import.meta.env.DEV && new URLSearchParams(location.search).has("debug")) {
  const controls = document.createElement("div");
  controls.className = "dev-controls";
  controls.innerHTML =
    '<button id="replay-low">Replay low route</button><button id="replay-high">Replay high route</button><span id="dev-state"></span>';
  document.body.append(controls);
  for (const key of ["low", "high"])
    document.getElementById("replay-" + key)!.onclick = () => {
      restart();
      scene.events.once("create", () => {
        scene.replayQueue = [...REPLAYS[key]];
        scene.fastReplay = true;
      });
    };
  window.setInterval(() => {
    const r = scene.round;
    document.getElementById("dev-state")!.textContent =
      `${r.phase} · ${r.heads.size}/10 · ${scene.settled ? "settled" : "settling"} · camera ${scene.cameraMode}`;
  }, 200);
}
