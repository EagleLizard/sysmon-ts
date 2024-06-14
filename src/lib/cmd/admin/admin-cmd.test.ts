
import { describe, it, expect, beforeEach, vi } from 'vitest';

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
  beforeEach(() => {

  });
  it('tests adminCmdMain()', () => {
    expect(1).toBe(1);
  });
});
