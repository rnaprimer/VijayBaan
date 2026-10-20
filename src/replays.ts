export type ReplayShot = readonly [angle: number, speed: number];
export const REPLAYS: Record<string, readonly ReplayShot[]> = {
  low: [
    [0.08, 22],
    [-0.12, 27],
    [-0.19, 22],
    [0.02, 27],
  ],
  high: [
    [-0.18, 25],
    [0.12, 22],
    [-0.14, 25],
    [-0.16, 27],
    [0.22, 25],
    [-0.36, 22],
    [0.02, 27],
    [-0.09, 22],
  ],
};
