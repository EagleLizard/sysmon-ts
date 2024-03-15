
import crypto, { Cipher, Decipher } from 'crypto';

import { config } from '../../config';

const alg = 'aes128';

export type EncyptResult = {
  text: string,
  iv: string;
};

export function encrypt(val: string): EncyptResult {
  let cipher: Cipher;
  let iv: Buffer;
  let encrypted: string;
  let key: Buffer;
  key = Buffer.from(config.EZD_ENCRYPTION_SECRET, 'base64');
  iv = crypto.randomBytes(16);
  cipher = crypto.createCipheriv(alg, key, iv);
  encrypted = cipher.update(val, 'utf-8', 'base64') + cipher.final('base64');
  return {
    text: encrypted,
    iv: iv.toString('base64'),
  };
}

export function decrypt(val: string, iv: string) {
  let decipher: Decipher;
  let decrypted: string;
  let ivBuf: Buffer;
  let key: Buffer;
  key = Buffer.from(config.EZD_ENCRYPTION_SECRET, 'base64');
  ivBuf = Buffer.from(iv, 'base64');
  decipher = crypto.createDecipheriv(alg, key, ivBuf);
  decrypted = decipher.update(val, 'base64', 'utf-8') + decipher.final('utf-8');
  return decrypted;
}
