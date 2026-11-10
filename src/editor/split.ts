export function clampSplit(value: number) {
  return Number.isFinite(value) ? Math.max(20, Math.min(80, value)) : 50;
}
export function pointerSplit(x: number, left: number, width: number) {
  return width > 0 ? clampSplit(((x - left) / width) * 100) : 50;
}
