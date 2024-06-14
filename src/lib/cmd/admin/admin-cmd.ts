
import { config } from '../../../config';
import { KeychainKeyDto } from '../../models/keychain-key-dto';
import { UserDto } from '../../models/user-dto';
import { AdminService } from '../../service/admin-service';
import { decrypt } from '../../util/crypto-util';
import { ParsedArgv2 } from '../parse-argv';
import { getAdminArgs } from '../parse-sysmon-args';

export type AdminCmdOpts = {
  logFn: (line: string) => void;
};

export async function adminMain(parsedArgv: ParsedArgv2, opts: AdminCmdOpts) {
  let cmdArg: string | undefined;
  cmdArg = getAdminArgs(parsedArgv.args);
  if(cmdArg === 'kc') {
    await keychainCmd(opts);
  }
}

type UserKeychain = {
  user: UserDto;
  keys: KeychainKeyDto[];
};

async function keychainCmd(opts: {
  logFn: AdminCmdOpts['logFn'];
}) {
  let keychainKeys: KeychainKeyDto[];
  let userKeychainMap: Map<string, UserKeychain>;
  let userName: string;
  let password: string;
  userName = config.EZD_API_USER;
  password = config.EZD_API_PASSWORD;
  userKeychainMap = new Map;
  opts.logFn('Fetching keychain keys');
  keychainKeys = await AdminService.getKeychainKeys({
    userName,
    password,
  });
  for(let i = 0; i < keychainKeys.length; ++i) {
    let currKeychainKey: KeychainKeyDto;
    currKeychainKey = keychainKeys[i];
    if(!userKeychainMap.has(currKeychainKey.user_id)) {
      let user: UserDto;
      user = await AdminService.getUser(currKeychainKey.user_id);
      userKeychainMap.set(user.user_id, {
        user,
        keys: []
      });
    }
    userKeychainMap.get(currKeychainKey.user_id)?.keys.push(currKeychainKey);
  }

  [ ...userKeychainMap.values() ].forEach(userKeychain => {
    opts.logFn('\nuser_name:');
    opts.logFn(userKeychain.user.user_name);
    userKeychain.keys.forEach((keychainKey, keyIdx) => {
      let decrypted: string;
      decrypted = decrypt(keychainKey.key_text, keychainKey.iv);
      opts.logFn(`${keyIdx}: ${decrypted}`);
    });
  });
}
