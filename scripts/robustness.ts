import { Replay } from "./physics-test";
import { REPLAYS } from "../src/replays";
for (const offset of [-0.01, 0, 0.01]) {
  const r = new Replay();
  r.settle();
  for (const [a, s] of REPLAYS.low) r.fire(a + offset, s);
  console.log("angle offset", offset, "heads", r.round.heads.size);
}
