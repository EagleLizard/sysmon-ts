
import { describe, it, expect, vi, Mock, beforeEach } from 'vitest';
import { KeychainKeyDto } from '../models/keychain-key-dto';
import { AdminService } from './admin-service';
import { SysmonCliConfig } from '../models/sysmon-cli-config';
import { UserDto } from '../models/user-dto';

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

describe('admin-service tests', () => {
  let userNameMock: string;
  let passwordMock: string;
  let tokenMock: string;
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

    userNameMock = 'mock_user';
    passwordMock = 'abc123';
    tokenMock = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoibW9ja191c2VyX2lkIiwidXNlcl9uYW1lIjoibW9ja191c2VyX25hbWUiLCJqd3Rfc2Vzc2lvbl9pZCI6MTIzLCJpYXQiOjUwMCwiZXhwIjo1MDB9.nwtciuz7fv9pqVOqRRyMXmMEJ58VBo0SgT7hb9h3FJM';
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
    userMock = UserDto.deserialize({
      user_id: 'mock_user_id',
      user_name: 'mock_user_name',
      email: 'mock@email.com',
      created_at: (new Date('9/11/2001 5:37:00 am')).valueOf(),
    });

    fetchMock = vi.fn();
    jsonMock = vi.fn();
    global.fetch = fetchMock;

    cliConfigServiceMocks.getConfig.mockReturnValueOnce(sysmonCliConfigMock);
  });

  it('tests getKeychainKeys()', async () => {
    let keychainKeys: KeychainKeyDto[];
    let getTokenPromise: Promise<{result: string}>;
    let getKeychainKeysPromise: Promise<{count: number, result: KeychainKeyDto[]}>;
    getTokenPromise = Promise.resolve({
      result: tokenMock,
    });
    getKeychainKeysPromise = Promise.resolve({
      count: 1,
      result: [
        keychainKeyDtoMock,
      ],
    });

    jsonMock.mockReturnValueOnce(getTokenPromise);
    fetchMock.mockResolvedValueOnce({
      json: jsonMock,
    });

    getTokenPromise.finally(() => {
      jsonMock.mockReturnValueOnce(getKeychainKeysPromise);
      fetchMock.mockResolvedValueOnce({
        json: jsonMock,
      });
    });

    keychainKeys = await AdminService.getKeychainKeys({
      userName: userNameMock,
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

});
