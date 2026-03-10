/** Bjorklund's algorithm: distribute `pulses` evenly across `steps` */
export function euclidean(steps: number, pulses: number): boolean[] {
  if (steps <= 0) return [];
  if (pulses <= 0) return new Array(steps).fill(false);
  if (pulses >= steps) return new Array(steps).fill(true);

  let pattern: number[][] = [];
  let remainder: number[][] = [];

  for (let i = 0; i < pulses; i++) pattern.push([1]);
  for (let i = 0; i < steps - pulses; i++) remainder.push([0]);

  while (remainder.length > 1) {
    const newPattern: number[][] = [];
    const minLen = Math.min(pattern.length, remainder.length);

    for (let i = 0; i < minLen; i++) {
      newPattern.push([...pattern[i], ...remainder[i]]);
    }

    const leftover =
      pattern.length > remainder.length
        ? pattern.slice(minLen)
        : remainder.slice(minLen);

    pattern = newPattern;
    remainder = leftover;
  }

  const flat = [...pattern, ...remainder].flat();
  return flat.map((v) => v === 1);
}

/** Circular rotation of array */
export function rotatePattern<T>(arr: T[], rotation: number): T[] {
  if (arr.length === 0) return arr;
  const r = ((rotation % arr.length) + arr.length) % arr.length;
  return [...arr.slice(r), ...arr.slice(0, r)];
}
