/**
 * The logo's hexagon, standing on a point, as SVG path data: centred on (cx, cy), `radius` from
 * the centre to each point, the points rounded as the mark's are.
 */
export function hexagon(cx: number, cy: number, radius: number): string {
  const round = 0.16 * radius;
  // A point's angle is 120 degrees, so its rounding starts this share of a side away from it;
  // every side is as long as the radius.
  const share = round / Math.tan(Math.PI / 3) / radius;
  const point = (k: number) => {
    const angle = ((60 * k - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(angle), cy + radius * Math.sin(angle)] as const;
  };
  const toward = (from: readonly [number, number], to: readonly [number, number]) =>
    `${(from[0] + (to[0] - from[0]) * share).toFixed(2)} ${(from[1] + (to[1] - from[1]) * share).toFixed(2)}`;
  let path = "";
  for (let k = 0; k < 6; k++) {
    const here = point(k);
    path += `${k ? "L" : "M"}${toward(here, point(k - 1))}`;
    path += `A${round.toFixed(2)} ${round.toFixed(2)} 0 0 1 ${toward(here, point(k + 1))}`;
  }
  return `${path}Z`;
}
