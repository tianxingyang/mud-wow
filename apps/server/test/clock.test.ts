import { describe, expect, it, vi } from "vitest";

import { createSystemClock } from "../src/infrastructure/clock/system-clock";
import { createFakeClock } from "./support/fake-clock";

describe("clock ports", () => {
  it("advances fake monotonic and wall time together", () => {
    const clock = createFakeClock({ monotonicNowMs: 250, wallNowMs: 1_700_000_000_000 });

    clock.advanceBy(750);

    expect(clock.monotonicNowMs()).toBe(1_000);
    expect(clock.wallNowMs()).toBe(1_700_000_000_750);
  });

  it("rejects invalid initial values and advances without changing its state", () => {
    expect(() => createFakeClock({ monotonicNowMs: -1 })).toThrow(RangeError);
    expect(() => createFakeClock({ wallNowMs: 0.5 })).toThrow(RangeError);

    const clock = createFakeClock({ monotonicNowMs: 10, wallNowMs: 20 });
    expect(() => clock.advanceBy(-1)).toThrow(RangeError);
    expect(() => clock.advanceBy(Number.MAX_SAFE_INTEGER)).toThrow(RangeError);
    expect(clock.monotonicNowMs()).toBe(10);
    expect(clock.wallNowMs()).toBe(20);
  });

  it("reads monotonic and wall time from their distinct system sources", () => {
    const wallNow = vi.spyOn(Date, "now").mockReturnValue(1_700_000_000_000);
    const clock = createSystemClock();
    const monotonicBefore = clock.monotonicNowMs();
    const monotonicAfter = clock.monotonicNowMs();

    expect(monotonicAfter).toBeGreaterThanOrEqual(monotonicBefore);
    expect(clock.wallNowMs()).toBe(1_700_000_000_000);
    expect(wallNow).toHaveBeenCalledOnce();
    wallNow.mockRestore();
  });
});
