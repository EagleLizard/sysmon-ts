
import { z } from 'zod';

const UserDtoSchema = z.object({
  user_id: z.string(),
  user_name: z.string(),
  email: z.string(),
  created_at: z.coerce.date(),
});

type UserDtoType = z.infer<typeof UserDtoSchema>;

export class UserDto implements UserDtoType {
  constructor(
    public user_name: string,
    public user_id: string,
    public email: string,
    public created_at: Date,
  ) {}

  static deserialize(rawUser: unknown): UserDto {
    let userDto: UserDto;
    userDto = UserDtoSchema.parse(rawUser);
    return new UserDto(
      userDto.user_name,
      userDto.user_id,
      userDto.email,
      userDto.created_at,
    );
  }
}
