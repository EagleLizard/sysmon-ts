
import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import jwt from 'jsonwebtoken';

import { KeychainKeyDto } from '../models/keychain-key-dto';
import { AdminService } from './admin-service';
import { SysmonCliConfig } from '../models/sysmon-cli-config';
import { UserDto } from '../models/user-dto';
import { JwtSessionPayload } from '../models/jwt';

const cliConfigServiceMocks = vi.hoisted(() => {
  return {
    getConfig: vi.fn(),
    saveConfig: vi.fn(),
  };
});

vi.mock('./cli-config-service', (importOriginal) => {
  return {
    CliConfigService: {
      getConfig: cliConfigServiceMocks.getConfig,
      saveConfig: cliConfigServiceMocks.saveConfig,
    },
  };
});

const EZD_JWT_SECRET_MOCK = 'mock_jwt_secret';

const MINUTES_MS = 1000 * 60;
const HOUR_MS = 1000 * 60 * 60;

describe('admin-service tests', () => {
  let passwordMock: string;

  let tokenPayloadMock: JwtSessionPayload;
  let tokenMock: string;
  let expiredTokenPayloadMock: JwtSessionPayload;
  let expiredTokenMock: string;
  let willExpireTokenPayloadMock: JwtSessionPayload;
  let willExpireTokenMock: string;
  let keychainKeyDtoMock: KeychainKeyDto;
  let sysmonCliConfigMock: SysmonCliConfig;
  let userMock: UserDto;

  let fetchMock: Mock<any>;
  let jsonMock: Mock<any>;

  // beforeAll(() => {
  //   global.fetch = adminServiceMocks.fetch;
  // });

  beforeEach(() => {
    cliConfigServiceMocks.getConfig.mockReset();
    cliConfigServiceMocks.saveConfig.mockReset();

    userMock = UserDto.deserialize({
      user_id: 'mock_user_id',
      user_name: 'mock_user_name',
      email: 'mock@email.com',
      created_at: (new Date('9/11/2001 5:37:00 am')).valueOf(),
    });
    passwordMock = 'abc123';
    tokenPayloadMock = {
      user_id: userMock.user_id,
      user_name: userMock.user_name,
      jwt_session_id: 123,
      iat: Date.now() / 1000,
      exp: (Date.now() + HOUR_MS) / 1000,
    };
    expiredTokenPayloadMock = {
      user_id: userMock.user_id,
      user_name: userMock.user_name,
      jwt_session_id: 121,
      iat: (new Date('9/11/2001 5:37:00 am')).valueOf() / 1000,
      exp: (new Date('9/11/2001 7:28:00 am')).valueOf() / 1000,
    };
    willExpireTokenPayloadMock = {
      user_id: userMock.user_id,
      user_name: userMock.user_name,
      jwt_session_id: 122,
      iat: (Date.now() - (MINUTES_MS * 35)) / 1000,
      exp: (Date.now() + (MINUTES_MS * 25)) / 1000,
    };
    tokenMock = jwt.sign(tokenPayloadMock, EZD_JWT_SECRET_MOCK);
    expiredTokenMock = jwt.sign(expiredTokenPayloadMock, EZD_JWT_SECRET_MOCK);
    willExpireTokenMock = jwt.sign(willExpireTokenPayloadMock, EZD_JWT_SECRET_MOCK);
    keychainKeyDtoMock = KeychainKeyDto.deserialize({
      key_id: 123,
      key_text: 'mock_key_text',
      iv: 'mock_iv',
      password_id: 'mock_password_id',
      user_id: 'mock_user_id',
    });
    sysmonCliConfigMock = SysmonCliConfig.deserialize({
      created_at: (new Date('9/11/2001 5:37:00 am')).valueOf(),
      last_modified: (new Date('9/11/2001 7:28:00 am')).valueOf(),
      token: tokenMock,
    });

    fetchMock = vi.fn();
    jsonMock = vi.fn();
    global.fetch = fetchMock;

    cliConfigServiceMocks.getConfig.mockReturnValueOnce(sysmonCliConfigMock);
  });

  it('tests getKeychainKeys()', async () => {
    let keychainKeys: KeychainKeyDto[];
    let getKeychainKeysPromise: Promise<{count: number, result: KeychainKeyDto[]}>;
    getKeychainKeysPromise = Promise.resolve({
      count: 1,
      result: [
        keychainKeyDtoMock,
      ],
    });

    jsonMock.mockReturnValueOnce(getKeychainKeysPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });

    keychainKeys = await AdminService.getKeychainKeys({
      userName: userMock.user_name,
      password: passwordMock,
    });
    expect(keychainKeys[0]).toEqual(keychainKeyDtoMock);
  });

  it('tests getUser()', async () => {
    let getUserPromise: Promise<UserDto>;
    let user: UserDto;
    getUserPromise = Promise.resolve(userMock);
    jsonMock.mockReturnValueOnce(getUserPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    user = await AdminService.getUser(userMock.user_id);
    expect(user).toEqual(userMock);
  });

  it('tests getToken() with token exchange', async () => {
    let exchangeTokenPromise: Promise<{ nextToken: string }>;
    let nextToken: string;
    exchangeTokenPromise = Promise.resolve({
      nextToken: tokenMock,
    });
    sysmonCliConfigMock.token = willExpireTokenMock;
    cliConfigServiceMocks.getConfig.mockReturnValueOnce(sysmonCliConfigMock);
    jsonMock.mockReturnValueOnce(exchangeTokenPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    nextToken = await AdminService.getToken({
      userName: userMock.user_name,
      password: passwordMock,
    });
    expect(nextToken).toBe(tokenMock);
  });

  it('tests getToken() with expired token', async () => {
    let getTokenPromise: Promise<{ result: string }>;
    let nextToken: string;
    sysmonCliConfigMock.token = expiredTokenMock;
    cliConfigServiceMocks.getConfig.mockReturnValueOnce(sysmonCliConfigMock);
    getTokenPromise = Promise.resolve({
      result: tokenMock,
    });
    jsonMock.mockReturnValueOnce(getTokenPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    nextToken = await AdminService.getToken({
      userName: userMock.user_name,
      password: passwordMock,
    });
    expect(nextToken).toBe(tokenMock);
  });

  it('tests exchangeToken()', async () => {
    let exchangeTokenPromise: Promise<{ nextToken: string }>;
    let nextToken: string;
    exchangeTokenPromise = Promise.resolve({
      nextToken: tokenMock,
    });
    cliConfigServiceMocks.getConfig.mockReturnValueOnce(sysmonCliConfigMock);
    jsonMock.mockReturnValueOnce(exchangeTokenPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });
    nextToken = await AdminService.exchangeToken(expiredTokenMock);
    expect(nextToken).toBe(tokenMock);
  });

});
