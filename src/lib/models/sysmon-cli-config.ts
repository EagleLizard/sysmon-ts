
import { z } from 'zod';

const SysmonCliConfigSchema = z.object({
  created_at: z.number(),
  last_modified: z.number(),
  token: z.string().optional(),
});

type SysmonCliConfigType = z.infer<typeof SysmonCliConfigSchema>;

export class SysmonCliConfig implements SysmonCliConfigType {
  constructor(
    public created_at: number,
    public last_modified: number,
    public token?: string,
  ) {}

  static deserialize(rawCfg: unknown): SysmonCliConfig {
    let sysmonCliCfg: SysmonCliConfig;
    sysmonCliCfg = SysmonCliConfigSchema.parse(rawCfg);
    return new SysmonCliConfig(
      sysmonCliCfg.created_at,
      sysmonCliCfg.last_modified,
      sysmonCliCfg.token,
    );
  }
}
