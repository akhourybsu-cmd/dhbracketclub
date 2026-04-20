// Deterministic seeded PRNG (mulberry32). Same seed → same sequence everywhere.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

export function rngInt(rng: Rng, max: number): number {
  return Math.floor(rng() * max);
}

export function rngPick<T>(rng: Rng, arr: T[]): T {
  return arr[rngInt(rng, arr.length)];
}
