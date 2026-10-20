import assert from "node:assert/strict";
import { Replay } from "./physics-test";
import { REPLAYS } from "../src/replays";
for (const [name, shots] of Object.entries(REPLAYS)) {
  const r = new Replay();
  r.settle();
  for (const shot of shots) {
    r.fire(...shot);
    console.log(
      name,
      shot,
      "heads",
      r.round.heads.size,
      "score",
      r.round.score,
    );
  }
  console.log("RESULT", name, r.round.won, r.round.seconds);
  assert.equal(r.round.won, true);
  assert.ok(shots.length <= 10);
  assert.ok(r.round.seconds > 0);
}
