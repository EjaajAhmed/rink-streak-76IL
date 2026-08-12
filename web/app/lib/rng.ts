// Deterministic RNG (BUILD_PLAN principle 4). A run's player sequence is derived
// from a seed, not per-pick Math.random(), so the same seed always replays the
// same run. That is what later enables replay/verification, shareable daily
// challenges, and identical sequences for both players in 1v1 (Phase 6).

/** mulberry32 — tiny, fast, well-distributed 32-bit PRNG. Returns [0, 1). */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A fresh random 32-bit seed for a new run. */
export function randomSeed(): number {
  return (Math.random() * 0xffffffff) >>> 0;
}
