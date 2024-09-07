
import { createHash, Hash, HashOptions } from 'crypto';
import { createReadStream, ReadStream } from 'fs';

// const alg = 'sha256';
// const DEFAULT_ALG = 'md5';
// const alg = 'blake2s256';
// const DEFAULT_ALG = 'blake2b512';
const DEFAULT_ALG = 'sha1';
// const DEFAULT_ALG = 'sha256';
// const DEFAULT_ALG = 'sha512';
// const DEFAULT_ALG = 'shake256';
// const outputFormat = 'base64';
const outputFormat = 'hex';

export interface Hasher {
  update(data: string | Buffer | NodeJS.TypedArray | DataView): void;
  // update(data: string, input_encoding: Utf8AsciiLatin1Encoding): void;
  digest: () => string;
}

// const xofAlgos = [
//   'shake256',
// ];

export function getHasher(hashOpts: HashOptions = {}): Hasher {
  let hash: Hash;
  let alg: string;
  alg = DEFAULT_ALG;

  /*
    check if xof algo
   */
  if(alg === 'shake256') {
    hashOpts.outputLength = 4;
  }

  hash = createHash(alg, hashOpts);

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

export type HashFileResult = {
  hasher: Hasher,
  fileReadPromise: Promise<void>;
};

export function hashFile(filePath: string): HashFileResult {
  let hasher: Hasher;
  let rs: ReadStream;
  let readPromise: Promise<void>;
  hasher = getHasher();
  rs = createReadStream(filePath);

  const chunkCb = (chunk: string | Buffer) => {
    hasher.update(chunk);
  };

  readPromise = new Promise((resolve, reject) => {
    rs.on('error', reject);
    rs.on('close', resolve);
    rs.on('data', chunkCb);
  });

  return {
    hasher,
    fileReadPromise: readPromise,
  };
}

export type HashFile2Opts = {
  highWaterMark?: number;
}

export async function hashFile2(filePath: string, opts: HashFile2Opts = {}): Promise<string> {
  let hashStr: string;
  let hasher: Hasher;
  let rs: ReadStream;
  hasher = getHasher({
    highWaterMark: opts.highWaterMark,
  });
  rs = createReadStream(filePath, opts);

  const chunkCb = (chunk: string | Buffer) => {
    hasher.update(chunk);
  };

  await new Promise((resolve, reject) => {
    rs.on('error', reject);
    rs.on('close', resolve);
    rs.on('data', chunkCb);
  });

  hashStr = hasher.digest();
  return hashStr;
}
