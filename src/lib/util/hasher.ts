
import { createHash, Hash, HashOptions } from 'crypto';
import { createReadStream, ReadStream } from 'fs';

// const alg = 'sha256';
// const alg = 'md5';
// const alg = 'blake2s256';
const DEFAULT_ALG = 'sha1';
// const DEFAULT_ALG = 'sha256';
// const DEFAULT_ALG = 'sha512';
// const DEFAULT_ALG = 'shake256';
// const outputFormat = 'base64';
const outputFormat = 'hex';

// ba8d154465f7fd15e2fc2ced6dceec90 - md5
// 9332f95e8e3ef26980cb7a7787da6d40bc5e9c8a - sha1
// df6f20944f1ccd20eaad71f9b5e7263702e0179e3623b7f608379814e98736b3 - sha256
// 570e01980ecb07f9e74c33e22b4acfbf2d7cc5701351177a6747f87da11c5efd - shake256
// 570e01980ecb07f9e74c33e22b4acfbf - shake256, outputLength: 16
//  - shake256, outputLength: 8

export interface Hasher {
  update(data: string | Buffer | NodeJS.TypedArray | DataView): void;
  // update(data: string, input_encoding: Utf8AsciiLatin1Encoding): void;
  digest: () => string;
}

const xofAlgos = [
  'shake256',
];

export function getHasher(hashOpts: HashOptions = {}): Hasher {
  let hash: Hash;
  let alg: string;
  alg = DEFAULT_ALG;
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
