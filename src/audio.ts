export class AudioManager {
  muted = false;
  ctx: AudioContext | null = null;
  unlock() {
    if (!this.ctx) this.ctx = new AudioContext();
    void this.ctx.resume();
  }
  play(kind: "launch" | "impact" | "head" | "power" | "win") {
    if (this.muted || !this.ctx) return;
    const c = this.ctx,
      t = c.currentTime,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = kind === "impact" ? "triangle" : "sine";
    const f = { launch: 360, impact: 110, head: 620, power: 880, win: 1046 }[
      kind
    ];
    o.frequency.setValueAtTime(f, t);
    o.frequency.exponentialRampToValueAtTime(
      kind === "impact" ? 40 : f * 1.6,
      t + 0.16,
    );
    g.gain.setValueAtTime(0.055, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    o.connect(g);
    g.connect(c.destination);
    o.start(t);
    o.stop(t + 0.23);
  }
}
