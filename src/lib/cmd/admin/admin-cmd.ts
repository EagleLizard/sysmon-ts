
import { KeychainKeyDto } from '../../models/keychain-key-dto';
import { UserDto } from '../../models/user-dto';
import { AdminService } from '../../service/admin-service';
import { decrypt } from '../../util/crypto-util';
import { SysmonCommand } from '../sysmon-args';

export async function adminMain(cmd: SysmonCommand) {
  let cmdArg: string | undefined;
  cmdArg = cmd?.args?.[0];
  if(cmdArg === 'kc') {
    await keychainCmd();
  }
}

type UserKeychain = {
  user: UserDto;
  keys: KeychainKeyDto[];
};

async function keychainCmd() {
  let keychainKeys: KeychainKeyDto[];
  let userKeychainMap: Map<string, UserKeychain>;
  userKeychainMap = new Map;
  console.log('Fetching keychain keys');
  keychainKeys = await AdminService.getKeychainKeys();
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
    console.log('\nuser_name:');
    console.log(userKeychain.user.user_name);
    userKeychain.keys.forEach((keychainKey, keyIdx) => {
      let decrypted: string;
      decrypted = decrypt(keychainKey.key_text, keychainKey.iv);
      console.log(`${keyIdx}: ${decrypted}`);
    });
  });
}
