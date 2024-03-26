
import fs from 'fs/promises';
import readline from 'readline/promises';

import { SysmonCommand } from '../sysmon-args';
import path from 'path';
import { DATA_DIR_PATH } from '../../../constants';
import { DIGIT_CHAR_MAP, KEY_MAPPINGS, KEY_TO_NUM_MAP } from './t-nine-key-mappings';
import { DigitTrie, DigitTrieNode } from './digit-trie';
import { Key } from 'readline';

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

  const CTRL_KEYS = [
    'backspace',
    'return',
    'down',
    'escape',
  ];
  const T_NINE_KEYS: string[] = KEY_MAPPINGS.map(keyMapping => {
    return keyMapping[2];
  });
  let inputChars: string[];
  inputChars = [];
  let rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  await rl.question('press any key to continue');
  // let rlInput = ((rl as unknown) as any).input as ReadStream;
  process.stdin.on('keypress', (str: string, key: Key) => {
    let isCtrlKey: boolean;
    let isNumKey: boolean;
    let inputDigits: string;
    let currDigit: string | undefined;
    isCtrlKey = CTRL_KEYS.some(ctrlKey => ctrlKey === key.name);
    if(isCtrlKey || (key.ctrl === true)) {
      console.log('');
      switch(key.name) {
        case 'backspace':
          console.log('backspace');
          inputChars.pop();
          break;
        case 'down':
          return;
        case 'return':
          inputChars.length = 0;
          break;
        default:
          console.log({
            str,
            key,
          });
      }
      return;
    }
    isNumKey = T_NINE_KEYS.some(tNineKey => {
      return tNineKey === key.sequence;
    });
    if(
      !isNumKey
      || (key.name === undefined)
    ) {
      console.log({
        str,
        key,
      });
      return;
    }
    console.log('');
    inputChars.push(key.name);
    currDigit = convertKeysToNums(key.name);

    console.log(DIGIT_CHAR_MAP[currDigit]);
    console.log(inputChars.join(''));
    inputDigits = convertKeysToNums(inputChars.join(''));
    console.log(inputDigits);
    digitsNode = digitTrie.getDigits(inputDigits);
    if(digitsNode !== undefined) {
      console.log(digitsNode.words);
    }
  });
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');
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
