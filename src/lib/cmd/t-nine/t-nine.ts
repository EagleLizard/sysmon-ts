
import fs from 'fs/promises';

import { SysmonCommand } from '../sysmon-args';
import path from 'path';
import { DATA_DIR_PATH } from '../../../constants';
import { KEY_MAPPINGS, NUM_KEY_ENUM } from './t-nine-key-mappings';
import { DigitTrie, DigitTrieNode } from './digit-trie';

const NUM_KEY_MAP: Record<string, NUM_KEY_ENUM> = KEY_MAPPINGS.reduce((acc, curr) => {
  acc[`${curr[1]}`] = curr[0];
  return acc;
}, {} as Record<string, NUM_KEY_ENUM>);

const KEY_TO_NUM_MAP: Record<string, string> = KEY_MAPPINGS.reduce((acc, curr) => {
  acc[curr[2]] = `${curr[1]}`;
  return acc;
}, {} as Record<string, string>);

console.log('NUM_KEY_MAP');
console.log(NUM_KEY_MAP);
console.log('KEY_TO_NUM_MAP');
console.log(KEY_TO_NUM_MAP);

export async function tNineMain(cmd: SysmonCommand) {
  let keys: string;
  let numKeys: string;
  console.log('t9');
  if(
    cmd.args === undefined
    || cmd.args.length < 1
  ) {
    throw new Error('t9 expects one argument');
  }
  keys = cmd.args.join(' ');
  console.log(keys);
  numKeys = convertKeysToNums(keys);
  console.log(numKeys);

  let rawWords = await loadRawWords();
  let digitTrie = new DigitTrie();
  for(let i = 0; i < rawWords.length; ++i) {
    let currWord: string;
    currWord = rawWords[i];
    digitTrie.insert(currWord);
  }
  let digitsNode: DigitTrieNode | undefined;
  digitsNode = digitTrie.getDigits(numKeys);
  if(digitsNode !== undefined) {
    let wordMatches: string[];
    wordMatches = digitsNode.words;
    console.log(wordMatches);
  }
  // let rl = readline.createInterface({
  //   input: process.stdin,
  //   output: process.stdout,
  // });
  // process.stdin.setRawMode(true);
  // process.stdin.on('keypress', (str, key) => {
  //   console.log({
  //     str,
  //     key,
  //   });
  // });
}

function convertKeysToNums(str: string): string {
  let numChars: string[];
  numChars = [];
  for(let i = 0; i < str.length; ++i) {
    let c = str[i];
    if(KEY_TO_NUM_MAP[c] === undefined) {
      throw new Error(`Invalid key found during key_to_num mapping: '${c}'`);
    }
    numChars.push(KEY_TO_NUM_MAP[c]);
  }
  return numChars.join('');
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
