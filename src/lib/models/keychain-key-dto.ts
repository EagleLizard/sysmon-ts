
import { z } from 'zod';

const KeychainKeyDtoSchema = z.object({
  key_id: z.number(),
  key_text: z.string(),
  iv: z.string(),
  password_id: z.string(),
  user_id: z.string(),
});

type KeychainKeyDtoType = z.infer<typeof KeychainKeyDtoSchema>;

export class KeychainKeyDto implements KeychainKeyDtoType {
  constructor(
    public key_id: number,
    public key_text: string,
    public iv: string,
    public password_id: string,
    public user_id: string,
  ) {}

  static deserialize(rawKeychainKey: unknown): KeychainKeyDto {
    let keychainKeyDto: KeychainKeyDto;
    keychainKeyDto = KeychainKeyDtoSchema.parse(rawKeychainKey);
    return new KeychainKeyDto(
      keychainKeyDto.key_id,
      keychainKeyDto.key_text,
      keychainKeyDto.iv,
      keychainKeyDto.password_id,
      keychainKeyDto.user_id,
    );
  }
}
