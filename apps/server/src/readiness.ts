export interface ReadinessResult {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, string>>;
}

export type ReadinessProbe = () => Promise<ReadinessResult>;

export function combineReadinessProbes(...probes: readonly ReadinessProbe[]): ReadinessProbe {
  return async () => {
    const results = await Promise.all(probes.map((probe) => probe()));

    return {
      ready: results.every((result) => result.ready),
      checks: Object.assign({}, ...results.map((result) => result.checks)),
    };
  };
}
