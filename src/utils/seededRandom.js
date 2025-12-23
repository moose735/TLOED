// src/utils/seededRandom.js
// Small deterministic PRNG utilities (mulberry32) seeded from a string

// Simple string -> 32-bit hash (xmur3)
export const xmur3 = (str) => {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
};

// Mulberry32 PRNG using a 32-bit seed
export const mulberry32 = (seed) => {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// Convenience: create a seeded RNG from a string
export const seededRandomFromString = (str) => {
  const seedFn = xmur3(String(str || 'seed'));
  const seed = seedFn();
  return mulberry32(seed);
};
