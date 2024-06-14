
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { adminMain } from './admin-cmd';
import { ParsedArgv2, parseArgv2 } from '../parse-argv';
import { KeychainKeyDto } from '../../models/keychain-key-dto';
import { UserDto } from '../../models/user-dto';

const configMocks =  vi.hoisted(() => {
  return {
    EZD_API_USER: 'mock_user',
    EZD_API_PASSWORD: 'mock_pw',
  };
});

const adminServiceMocks = vi.hoisted(() => {
  return {
    getKeychainKeys: vi.fn(),
    getUser: vi.fn(),
  };
});

const cryptoUtilMocks = vi.hoisted(() => {
  return {
    decrypt: vi.fn(),
  };
});

vi.mock('../../../config.ts', () => {
  return {
    config: {
      EZD_API_USER: configMocks.EZD_API_USER,
      EZD_API_PASSWORD: configMocks.EZD_API_PASSWORD,
    },
  };
});

vi.mock('../../service/admin-service.ts', () => {
  return {
    AdminService: {
      getKeychainKeys: adminServiceMocks.getKeychainKeys,
      getUser: adminServiceMocks.getUser,
    },
  };
});

vi.mock('../../util/crypto-util.ts', () => {
  return {
    decrypt: cryptoUtilMocks.decrypt,
  };
});

describe('admin-cmd tests', () => {
  let argvMock: string[];
  let logFnMock: Mock;
  let userIdMock: string;
  let keychainKeysMock: KeychainKeyDto[];
  let userMock: UserDto;
  beforeEach(() => {
    adminServiceMocks.getKeychainKeys.mockReset();
    adminServiceMocks.getUser.mockReset();
    cryptoUtilMocks.decrypt.mockReset();

    userIdMock = 'mock_user_id';
    keychainKeysMock = [
      KeychainKeyDto.deserialize({
        key_id: 1,
        key_text: 'mock_key_text',
        iv: 'mock_iv',
        password_id: 'mock_pw_id',
        user_id: userIdMock,
      }),
    ];
    userMock = UserDto.deserialize({
      user_name: 'mock_user',
      user_id: userIdMock,
      email: 'mock@mock.com',
      created_at: (new Date('9/11/2001 5:37:00 am')).valueOf(),
    });
    argvMock = [
      'node', 'dist/main.js', 'a', 'kc',
    ];
    logFnMock = vi.fn();

  });

  it('tests adminCmdMain()', async () => {
    let parsedArgv: ParsedArgv2;
    let logStrs: string[];
    let logStr: string;
    logStrs = [];
    parsedArgv = parseArgv2(argvMock);
    logFnMock.mockImplementation((str: string) => {
      logStrs.push(str);
    });
    adminServiceMocks.getKeychainKeys.mockResolvedValueOnce(keychainKeysMock);
    adminServiceMocks.getUser.mockResolvedValueOnce(userMock);
    await adminMain(parsedArgv, {
      logFn: logFnMock,
    });
    logStr = logStrs.join('\n');
    expect(logFnMock).toHaveBeenCalled();
    expect(logStr).toContain(userMock.user_name);
  });
});
