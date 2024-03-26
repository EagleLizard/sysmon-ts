
import { z } from 'zod';

const JwtSessionPayloadSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  jwt_session_id: z.number(),
  iat: z.number(),
  exp: z.number(),
});

type JwtSessionPayloadType = z.infer<typeof JwtSessionPayloadSchema>;

export class JwtSessionPayload implements JwtSessionPayloadType {
  constructor(
    public user_id: string,
    public user_name: string,
    public jwt_session_id: number,
    public iat: number,
    public exp: number,
  ) {}

  static deserialize(rawPayload: unknown): JwtSessionPayload {
    let jwtPayload: JwtSessionPayload;
    jwtPayload = JwtSessionPayloadSchema
      .passthrough()
      .parse(rawPayload)
    ;
    return new JwtSessionPayload(
      jwtPayload.user_id,
      jwtPayload.user_name,
      jwtPayload.jwt_session_id,
      jwtPayload.iat,
      jwtPayload.exp,
    );
  }
}

