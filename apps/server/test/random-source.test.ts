import { describe, expect, it } from "vitest";

import { createSeededRandomSource } from "../src/infrastructure/random/seeded-random-source";
import type { Clock, RandomSource } from "../src/kernel/public";
import { createFakeClock } from "./support/fake-clock";

const GOLDEN_SEED = 0x1234_5678;
const UINT32_MAX = 0xffff_ffff;

function runDeterministicExample(clock: Clock, random: RandomSource): readonly number[] {
  return [
    clock.monotonicNowMs(),
    random.integerInclusive(1, 20),
    clock.wallNowMs(),
    random.integerInclusive(-5, 5),
  ];
}

describe("seeded random source", () => {
  it("keeps its Mulberry32 output stable as a golden compatibility vector", () => {
    const random = createSeededRandomSource(GOLDEN_SEED);

    expect(Array.from({ length: 5 }, () => random.integerInclusive(0, UINT32_MAX))).toEqual([
      455_919_406, 4_042_750_857, 4_036_713_555, 1_004_527_575, 3_885_174_651,
    ]);
  });

  it("produces the same workflow result from the same clock state and seed", () => {
    const run = () =>
      runDeterministicExample(
        createFakeClock({ monotonicNowMs: 300, wallNowMs: 1_700_000_000_000 }),
        createSeededRandomSource(42),
      );

    expect(run()).toEqual(run());
  });

  it("produces distinct sequences for distinct seeds and stays inside inclusive bounds", () => {
    const first = createSeededRandomSource(1);
    const second = createSeededRandomSource(2);
    const firstSequence = Array.from({ length: 20 }, () => first.integerInclusive(-3, 3));
    const secondSequence = Array.from({ length: 20 }, () => second.integerInclusive(-3, 3));

    expect(firstSequence).not.toEqual(secondSequence);
    expect(firstSequence.every((value) => value >= -3 && value <= 3)).toBe(true);
    expect(createSeededRandomSource(0).integerInclusive(7, 7)).toBe(7);
  });

  it("rejects invalid seeds and ranges", () => {
    expect(() => createSeededRandomSource(-1)).toThrow(RangeError);
    expect(() => createSeededRandomSource(0.5)).toThrow(RangeError);
    expect(() => createSeededRandomSource(UINT32_MAX + 1)).toThrow(RangeError);

    const random = createSeededRandomSource(0);
    expect(() => random.integerInclusive(2, 1)).toThrow(RangeError);
    expect(() => random.integerInclusive(0.5, 1)).toThrow(RangeError);
    expect(() => random.integerInclusive(0, UINT32_MAX + 1)).toThrow(RangeError);
  });
});
