import { config } from '../../config';
import { KeychainKeyDto } from '../models/keychain-key-dto';
import { UserDto } from '../models/user-dto';
import { isNumber, isObject } from '../util/validate-primitives';

export class AdminService {
  static async getKeychainKeys(): Promise<KeychainKeyDto[]> {
    let url: string;
    let resp: Response;
    let rawRespBody: unknown;
    let keychainKeys: KeychainKeyDto[];
    url = `${config.EZD_API_BASE_URL}/v1/keychain/keys`;
    const body = {

    };
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    rawRespBody = await resp.json();
    if(
      !isObject(rawRespBody)
      || !isNumber(rawRespBody?.count)
      || !Array.isArray(rawRespBody?.result)
    ) {
      throw new Error(`Invalid getKeychainKeys response body: ${JSON.stringify(rawRespBody)}`);
    }
    keychainKeys = rawRespBody.result.map(KeychainKeyDto.deserialize);
    return keychainKeys;
  }

  static async getUser(userId: string): Promise<UserDto> {
    let user: UserDto;
    let url: string;
    let resp: Response;
    let rawRespBody: unknown;
    url = `${config.EZD_API_BASE_URL}/v1/users/${userId}`;
    resp = await fetch(url, {
      method: 'get',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    rawRespBody = await resp.json();
    user = UserDto.deserialize(rawRespBody);
    return user;
  }
}
