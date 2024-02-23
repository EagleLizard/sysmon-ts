
import { createHash, Hash } from 'crypto';

// const alg = 'sha256';
const alg = 'md5';
// const alg = 'sha1';
// const outputFormat = 'base64';
const outputFormat = 'hex';

export interface Hasher {
  update(data: string | Buffer | NodeJS.TypedArray | DataView): void;
  // update(data: string, input_encoding: Utf8AsciiLatin1Encoding): void;
  digest: () => string;
}

export function getHasher(): Hasher {
  let hash: Hash;
  hash = createHash(alg);

  return {
    update,
    digest,
  };

  function update(data: string | Buffer | NodeJS.TypedArray | DataView) {
    hash.update(data);
  }
  function digest() {
    return hash.digest(outputFormat);
  }
}

export function hashSync(data: string) {
  let hasher: Hasher;
  hasher = getHasher();
  hasher.update(data);
  return hasher.digest();
}
