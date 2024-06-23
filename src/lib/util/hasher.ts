
import { createHash, Hash } from 'crypto';
import { createReadStream, ReadStream } from 'fs';

// const alg = 'sha256';
// const alg = 'md5';
// const alg = 'blake2s256';
const alg = 'sha1';
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

export async function hashFile2(filePath: string): Promise<string> {
  let hashStr: string;
  let hasher: Hasher;
  let rs: ReadStream;
  hasher = getHasher();
  rs = createReadStream(filePath, {
    // highWaterMark: 16 * 1024,
  });

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
