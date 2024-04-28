
export class Aggregate {
  private constructor(
    public avg: number,
    public min: number,
    public max: number,
  ) {}

  static init(
    avg?: number,
    min?: number,
    max?: number,
  ): Aggregate {
    let sampleAgg: Aggregate;
    sampleAgg = new Aggregate(
      avg ?? 0,
      min ?? Infinity,
      max ?? -Infinity,
    );
    return sampleAgg;
  }
}
