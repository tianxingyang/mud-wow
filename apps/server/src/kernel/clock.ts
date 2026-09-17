export interface Clock {
  readonly monotonicNowMs: () => number;
  readonly wallNowMs: () => number;
}
