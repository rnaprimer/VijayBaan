export type Kind = "wood" | "stone" | "crate" | "head" | "pickup";
export interface Placement {
  id: string;
  kind: Kind;
  texture: string;
  x: number;
  y: number;
  w: number;
  h: number;
  ability?: "agni" | "vajra" | "volley";
}
export const TERRAIN = [
  { x: 245, y: 773, w: 520, h: 96 },
  { x: 1194, y: 824, w: 982, h: 116 },
];
export const LAYOUT: Placement[] = [];
let n = 0;
const add = (
  kind: Kind,
  texture: string,
  x: number,
  y: number,
  w: number,
  h: number,
  id?: string,
) => LAYOUT.push({ id: id ?? "block-" + n++, kind, texture, x, y, w, h });
for (const [bay, x] of [1040, 1230, 1420].entries()) {
  for (const tier of [0, 1]) {
    const bottom = 766 - tier * 126;
    add("wood", "column", x - 68, bottom - 53, 22, 106);
    add("wood", "column", x + 68, bottom - 53, 22, 106);
    add("wood", "wood", x, bottom - 116, 170, 20);
    add(
      "head",
      "head" + (bay + tier * 3),
      x,
      bottom - 34,
      58,
      68,
      "head-" + (bay + tier * 3),
    );
  }
  add("head", "head" + (bay + 6), x, 480, 58, 68, "head-" + (bay + 6));
}
add("wood", "column", 1175, 471, 22, 86);
add("wood", "column", 1285, 471, 22, 86);
add("wood", "wood", 1230, 418, 160, 20);
add("head", "head9", 1230, 374, 58, 68, "head-9");
add("stone", "stoneWide", 1135, 743, 52, 46);
add("stone", "stone", 1325, 740, 48, 52);
add("crate", "crate", 1140, 618, 45, 44);
add("crate", "crate", 1325, 618, 45, 44);
for (const [i, ability] of (["agni", "vajra", "volley"] as const).entries())
  LAYOUT.push({
    id: ability,
    kind: "pickup",
    texture: ability,
    x: [905, 1125, 1495][i],
    y: [695, 490, 490][i],
    w: 51,
    h: 68,
    ability,
  });
