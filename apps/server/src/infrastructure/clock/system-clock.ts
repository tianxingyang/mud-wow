import { performance } from "node:perf_hooks";

import type { Clock } from "../../kernel/public.js";

export function createSystemClock(): Clock {
  return {
    monotonicNowMs: () => performance.now(),
    wallNowMs: () => Date.now(),
  };
}
