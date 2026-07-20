export interface RandomSource {
  readonly integerInclusive: (minimum: number, maximum: number) => number;
}
