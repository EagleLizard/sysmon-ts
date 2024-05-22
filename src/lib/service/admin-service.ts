import { config } from '../../config';
import { JwtSessionPayload } from '../models/jwt';
import { KeychainKeyDto } from '../models/keychain-key-dto';
import { SysmonCliConfig } from '../models/sysmon-cli-config';
import { UserDto } from '../models/user-dto';
import { getIntuitiveTimeString } from '../util/format-util';
import { isNumber, isObject, isString } from '../util/validate-primitives';
import { CliConfigService } from './cli-config-service';

export type GetTokenOpts = {
  userName: string,
  password: string,
};

export type GetKeychainOpts = {
  //
} & GetTokenOpts;

export class AdminService {
  static async getKeychainKeys(opts: GetKeychainOpts): Promise<KeychainKeyDto[]> {
    let url: string;
    let resp: Response;
    let rawRespBody: unknown;
    let keychainKeys: KeychainKeyDto[];
    let apiToken: string;
    url = `${config.EZD_API_BASE_URL}/v1/keychain/keys`;
    apiToken = await AdminService.getToken({
      userName: opts.userName,
      password: opts.password,
    });
    const body = {

    };
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': apiToken,
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

  static async getToken(opts: GetTokenOpts) {
    let token: string;
    let url: string;
    let resp: Response;
    let rawRespBody: unknown;

    let cfg: SysmonCliConfig;
    let storedOrNextToken: string | undefined;

    cfg = CliConfigService.getConfig();

    storedOrNextToken = await getStoredTokenOrExchange(cfg);
    if(storedOrNextToken !== undefined) {
      return storedOrNextToken;
    }

    url = `${config.EZD_API_BASE_URL}/v1/jwt/auth`;
    const body = {
      userName: config.EZD_API_USER,
      password: config.EZD_API_PASSWORD,
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
      || !isString(rawRespBody.result)
    ) {
      throw new Error(`Invalid getToken response body: ${JSON.stringify(rawRespBody)}`);
    }
    token = rawRespBody.result;
    cfg.token = token;
    CliConfigService.saveConfig(cfg);
    return token;
  }

  static async exchangeToken(token: string) {
    let url: string;
    let resp: Response;
    let rawRespBody: unknown;

    let nextToken: string;

    url = `${config.EZD_API_BASE_URL}/v1/jwt/exchange`;
    const body = {
      token,
    };
    resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-token': token,
      },
      body: JSON.stringify(body),
    });
    rawRespBody = await resp.json();
    if(
      !isObject(rawRespBody)
      || !isString(rawRespBody.nextToken)
    ) {
      console.error(rawRespBody);
      throw new Error(`Invalid exchangeToken response body: ${JSON.stringify(rawRespBody)}`);
    }
    nextToken = rawRespBody.nextToken;
    return nextToken;
  }
}

async function getStoredTokenOrExchange(cfg: SysmonCliConfig): Promise<string | undefined> {
  let tokenValid: boolean;
  let jwtPayload: JwtSessionPayload;
  let tokenWillExpire: boolean;
  let nextToken: string;
  if(cfg.token !== undefined) {
    jwtPayload = getJwtPayload(cfg.token);
    tokenValid = checkTokenExpired(jwtPayload);
    if(tokenValid) {
      tokenWillExpire = checkTokenWillExpire(jwtPayload);
      if(tokenWillExpire) {
        /*
          Use the token to get a new token if it
           will expire soon
        */
        console.log('Exchanging token.');
        nextToken = await AdminService.exchangeToken(cfg.token);
        cfg.token = nextToken;
        CliConfigService.saveConfig(cfg);
        return cfg.token;
      }
      /*
        return the stored token if it's not
          expired yet
      */
      return cfg.token;
    } else {
      console.log('Stored token is expired');
    }
  }
}

function checkTokenWillExpire(jwtPayload: JwtSessionPayload): boolean {
  let jwtTtlMs: number;
  let expiresInMs: number;
  let tokenWillExpire: boolean;
  let expiredInStr: string;
  jwtTtlMs = (jwtPayload.exp - jwtPayload.iat) * 1000;
  expiresInMs = (jwtPayload.exp * 1000) - Date.now();
  expiredInStr = getIntuitiveTimeString(expiresInMs);
  console.log(`Stored token expires in ${expiredInStr}`);
  tokenWillExpire = expiresInMs < (jwtTtlMs / 2);
  return tokenWillExpire;
}

function checkTokenExpired(jwtPayload: JwtSessionPayload): boolean {
  let exp: number;
  let tokenValid: boolean;
  exp = jwtPayload.exp * 1000;
  tokenValid = Date.now() < exp;
  return tokenValid;
}

function getJwtPayload(token: string): JwtSessionPayload {
  let tokenParts: string[];
  let payloadPart: string;
  let rawPayload: Record<string, unknown>;
  let jwtPayload: JwtSessionPayload;
  tokenParts = token.split('.');
  if(tokenParts.length !== 3) {
    console.error({
      token,
    });
    const err = new Error(`Invalid JWT. Expected 3 parts, got ${tokenParts.length}`);
    console.error(err);
    throw err;
  }
  payloadPart = tokenParts[1];
  rawPayload = parseJwtPart(payloadPart);
  jwtPayload = JwtSessionPayload.deserialize(rawPayload);
  return jwtPayload;
}

function parseJwtPart(jwtPart: string): Record<string, unknown> {
  let resBuf: Buffer;
  let resStr: string;
  let rawRes: unknown;
  let res: Record<string, unknown>;
  resBuf = Buffer.from(jwtPart, 'base64');
  resStr = resBuf.toString();
  rawRes = JSON.parse(resStr);
  if(!isObject(rawRes)) {
    throw new Error('Invalid JWT part.');
  }
  res = rawRes;
  return res;
}
