import type { Clock } from "../../src/kernel/public";

export interface FakeClockOptions {
  readonly monotonicNowMs?: number;
  readonly wallNowMs?: number;
}

export type FakeClock = Clock & {
  readonly advanceBy: (milliseconds: number) => void;
};

function assertTimestamp(value: number, name: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new RangeError(`${name} must be a non-negative safe integer`);
  }
}

export function createFakeClock({
  monotonicNowMs: initialMonotonicNowMs = 0,
  wallNowMs: initialWallNowMs = 0,
}: FakeClockOptions = {}): FakeClock {
  assertTimestamp(initialMonotonicNowMs, "Monotonic timestamp");
  assertTimestamp(initialWallNowMs, "Wall timestamp");

  let monotonicNowMs = initialMonotonicNowMs;
  let wallNowMs = initialWallNowMs;

  return {
    monotonicNowMs: () => monotonicNowMs,
    wallNowMs: () => wallNowMs,
    advanceBy: (milliseconds) => {
      assertTimestamp(milliseconds, "Clock advance");

      const nextMonotonicNowMs = monotonicNowMs + milliseconds;
      const nextWallNowMs = wallNowMs + milliseconds;
      if (!Number.isSafeInteger(nextMonotonicNowMs) || !Number.isSafeInteger(nextWallNowMs)) {
        throw new RangeError("Clock advance would exceed the safe integer range");
      }

      monotonicNowMs = nextMonotonicNowMs;
      wallNowMs = nextWallNowMs;
    },
  };
}
