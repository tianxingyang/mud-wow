export interface ReadinessResult {
  readonly ready: boolean;
  readonly checks: Readonly<Record<string, string>>;
}

export type ReadinessProbe = () => Promise<ReadinessResult>;
