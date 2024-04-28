
import { Aggregate } from './aggregate';

export class MemUsageAggregate {
  private constructor(
    public rss: Aggregate,
    public heapTotal: Aggregate,
    public heapUsed: Aggregate,
    public external: Aggregate,
    public arrayBuffers: Aggregate,
  ) {}

  static init(
    rss?: Aggregate,
    heapTotal?: Aggregate,
    heapUsed?: Aggregate,
    external?: Aggregate,
    arrayBuffers?: Aggregate,
  ) {
    let memUsageAgg: MemUsageAggregate;
    memUsageAgg = new MemUsageAggregate(
      rss ?? Aggregate.init(),
      heapTotal ?? Aggregate.init(),
      heapUsed ?? Aggregate.init(),
      external ?? Aggregate.init(),
      arrayBuffers ?? Aggregate.init(),
    );
    return memUsageAgg;
  }
}
