import type { RandomSource } from "../../kernel/public.js";

const UINT32_RANGE = 0x1_0000_0000;
const UINT32_MAX = UINT32_RANGE - 1;
const MULBERRY32_INCREMENT = 0x6d2b_79f5;

function assertUint32Seed(seed: number): void {
  if (!Number.isInteger(seed) || seed < 0 || seed > UINT32_MAX) {
    throw new RangeError("Seed must be an unsigned 32-bit integer");
  }
}

function assertIntegerRange(minimum: number, maximum: number): number {
  if (!Number.isSafeInteger(minimum) || !Number.isSafeInteger(maximum)) {
    throw new RangeError("Random integer bounds must be safe integers");
  }
  if (minimum > maximum) {
    throw new RangeError("Random integer minimum cannot exceed maximum");
  }

  const rangeSize = maximum - minimum + 1;
  if (rangeSize > UINT32_RANGE) {
    throw new RangeError("Random integer range cannot contain more than 2^32 values");
  }

  return rangeSize;
}

export function createSeededRandomSource(seed: number): RandomSource {
  assertUint32Seed(seed);

  let state = seed;

  const nextUint32 = (): number => {
    state = (state + MULBERRY32_INCREMENT) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return (value ^ (value >>> 14)) >>> 0;
  };

  return {
    integerInclusive: (minimum, maximum) => {
      const rangeSize = assertIntegerRange(minimum, maximum);
      const rejectionLimit = Math.floor(UINT32_RANGE / rangeSize) * rangeSize;

      let sample = nextUint32();
      while (sample >= rejectionLimit) {
        sample = nextUint32();
      }

      return minimum + (sample % rangeSize);
    },
  };
}
