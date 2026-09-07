/** Local RNG helpers for tests and the review fixture. Do not replace global Math.random. */

/** Returns values in order, then holds the last value. Empty input yields 0. */
export function sequenceRandom(values: readonly number[]): () => number {
  let i = 0;
  return () => {
    if (values.length === 0) return 0;
    const v = values[Math.min(i, values.length - 1)];
    i += 1;
    return v;
  };
}

/** Unit interval that yields `face` from `1 + floor(random() * 6)`. */
export function unitForDie(face: number): number {
  const n = Math.min(6, Math.max(1, Math.floor(face)));
  return (n - 1) / 6;
}

export function diceSequence(faces: readonly number[]): () => number {
  return sequenceRandom(faces.map(unitForDie));
}
