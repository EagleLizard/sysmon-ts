
import { z } from 'zod';

const PingStatDtoSchema = z.object({
  time_bucket: z.coerce.date(),
  /*
    In postgres, count in aggregate function returns bigint,
      which is a string
    https://stackoverflow.com/a/47843583
    https://www.postgresql.org/docs/8.2/functions-aggregate.html
  */
  count: z.coerce.number(),
  avg: z.number(),
  max: z.number(),
  median: z.number(),
});

type PingStatDtoType = z.infer<typeof PingStatDtoSchema>;

export class PingStatDto implements PingStatDtoType {
  constructor(
    public time_bucket: Date,
    public count: number,
    public avg: number,
    public max: number,
    public median: number,
  ) {}

  static deserialize(rawStat: unknown) {
    let parsedStat: PingStatDto;
    parsedStat = PingStatDtoSchema.parse(rawStat);
    return new PingStatDto(
      parsedStat.time_bucket,
      parsedStat.count,
      parsedStat.avg,
      parsedStat.max,
      parsedStat.median,
    );
  }
}
