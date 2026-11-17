export const plural = (n: number, one: string, many = `${one}s`) => (n > 1 ? many : one);
export const stepScale = (value: number, delta: number) =>
  Math.min(1.6, Math.max(0.8, Math.round((value + delta) * 10) / 10));