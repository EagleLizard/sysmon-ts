
import fs from 'fs/promises';
import { ReadStream, createReadStream } from 'fs';
import path from 'path';
import readline from 'readline';

import { DATA_DIR_PATH } from '../../../constants';

export class TNineService {
  static async loadWords() {
    console.log('loadWords()');
    let rawWords: string[];
    rawWords = await loadRawWords();
    return rawWords;
  }

  static async getFrequencyMap(words: string[]): Promise<Map<string, number>> {
    let rawFreqMap: Map<string, number>;
    let freqMap: Map<string, number>;
    freqMap = new Map;
    rawFreqMap = await loadBaseFrequencies();
    for(let i = 0; i < words.length; ++i) {
      let rawCount: number | undefined;
      const currWord = words[i];
      if(
        (rawCount = rawFreqMap.get(currWord)) !== undefined
      ) {
        freqMap.set(currWord, rawCount);
      }
    }
    return freqMap;
  }
}

async function loadBaseFrequencies(): Promise<Map<string, number>> {
  let wordCountFilePath: string;
  let fileLines: string[];
  let wordCountMap: Map<string, number>;

  let rsPromise: Promise<void>;

  fileLines = [];

  wordCountFilePath = [
    DATA_DIR_PATH,
    '_wc_total.txt',
  ].join(path.sep);

  rsPromise = new Promise((resolve, reject) => {
    let rs: ReadStream;
    let rl: readline.Interface;
    rs = createReadStream(wordCountFilePath);
    rl = readline.createInterface({
      input: rs,
      crlfDelay: Infinity,
    });
    rl.on('error', reject);
    rl.on('close', resolve);
    rl.on('line', (line) => {
      fileLines.push(line);
    });
  });
  await rsPromise;
  // wordCountTuples = [];
  wordCountMap = new Map;
  for(let i = 0; i < fileLines.length; ++i) {
    const fileLine = fileLines[i];
    let lineParts: string[];
    let wordPart: string;
    let countPart: string;
    let countVal: number;
    lineParts = fileLine.split(' ');
    if(lineParts.length !== 2) {
      throw new Error(`Line at index ${i} is not a valid tuple, line: '${fileLine}'`);
    }
    [
      wordPart,
      countPart,
    ] = lineParts;
    /*
      skip any words that are not latin or have punctuation
    */
    if(!/[a-zA-Z]/.test(wordPart)) {
      continue;
    }

    if(isNaN(+countPart)) {
      throw new Error(`Line at index ${i} has invalid count value ${countPart}, line: '${fileLine}'`);
    }
    countVal = +countPart;
    // wordCountTuples.push([
    //   wordPart,
    //   countVal,
    // ]);
    wordCountMap.set(wordPart, countVal);
  }

  // return wordCountTuples;
  return wordCountMap;
}

async function loadRawWords() {
  let wordFilePath: string;
  let fileData: Buffer;
  let fileLines: string[];
  wordFilePath = [
    DATA_DIR_PATH,
    'words.txt',
  ].join(path.sep);
  fileData = await fs.readFile(wordFilePath);
  fileLines = fileData.toString()
    .split('\n')
    .filter(fileLine => {
      return fileLine.trim().length > 0;
    })
  ;
  return fileLines;
}
