
import readline from 'readline';
import { Key } from 'readline';

import { TNineService } from './t-nine-service';
import { DIGIT_CHAR_MAP, KEY_MAPPINGS, KEY_TO_NUM_MAP } from './t-nine-key-mappings';
import { DigitTrie, DigitTrieNode } from './digit-trie';
import { isString } from '../../util/validate-primitives';
import { ParsedArgv2 } from '../parse-argv';

export async function tNineMain(parsedArgv: ParsedArgv2) {
  let args: string[];
  let keys: string;
  let numKeys: string;
  setProcName();
  console.log('t9');
  args = parsedArgv.args;
  keys = args.join(' ') ?? '';
  console.log(keys);
  numKeys = convertKeysToNums(keys);
  console.log(numKeys);

  let rawWords = await TNineService.loadWords();
  let freqMap = await TNineService.getFrequencyMap(rawWords);
  console.log('rawWords');
  let digitTrie = new DigitTrie(freqMap);
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

  const T_NINE_KEYS: string[] = KEY_MAPPINGS.map(keyMapping => {
    return keyMapping[2];
  });
  let inputChars: string[];
  inputChars = [];
  let rl = readline.createInterface({
    input: process.stdin,
    // output: process.stdout,
  });
  readline.emitKeypressEvents(process.stdin, rl);
  // await rl.question('press any key to continue');
  // let rlInput = ((rl as unknown) as any).input as ReadStream;
  if(process.stdin.isTTY) {
    process.stdin.setRawMode(true);
  }
  // process.stdin.resume();
  process.stdin.setEncoding('utf8');
  process.stdin.on('keypress', (str: string, key: Key) => {
    let isNumKey: boolean;
    let currChar: string;
    let currDigit: string | undefined;
    let printInputChars: boolean;
    let inputCharsChanged: boolean;
    let inputDigits: string;
    let outLines: string[];

    outLines = [];

    printInputChars = false;
    inputCharsChanged = false;

    if(key.ctrl === true && key.name === 'c') {
      process.stdin.setRawMode(false);
      rl.close();
      process.exitCode = 0;
      return;
    }

    isNumKey = T_NINE_KEYS.some(tNineKey => {
      return tNineKey === key.name;
    });
    if(!isString(key.name)) {
      console.error(key);
      console.error(new Error(`unrecognized key: ${key.name}, sequence: ${key.sequence}`));
      return;
    }
    if(isNumKey) {
      inputChars.push(key.name);
      currDigit = convertKeysToNums(key.name);
      printInputChars = true;
      inputCharsChanged = true;
    } else {
      printInputChars = true;
      switch(key.name) {
        case 'backspace':
          inputChars.pop();
          inputCharsChanged = true;
          break;
        case 'down':
          console.log('TODO: select down');
          break;
        case 'up':
          console.log('TODO: select up');
          break;
        case 'return':
          break;
        default:
          printInputChars = false;
      }
    }

    if(inputCharsChanged && (inputChars.length > 0)) {
      currChar = inputChars[inputChars.length - 1];
      currDigit = convertKeysToNums(currChar);
      inputDigits = convertKeysToNums(inputChars.join(''));
      digitsNode = digitTrie.getDigits(inputDigits);
      if(digitsNode !== undefined) {
        let topWords = digitsNode.words.slice(0, 10);
        // let topWordsStr = [
        //   `${topWords[0]}`,
        //   ...topWords.slice(1),
        // ];
        for(let i = 0; i < topWords.length; ++i) {
          outLines.push(topWords[i]);
        }
        // console.log(topWordsStr.join('\n'));
        // console.log('\n');
      }
      outLines.push(`'${currChar}' -> ${DIGIT_CHAR_MAP[currDigit]}`);
      // console.log(`\n'${currChar}' -> ${DIGIT_CHAR_MAP[currDigit]}\n`);
    }

    if(printInputChars && (inputChars.length > 0)) {
      outLines.push('-'.repeat(100));
      outLines.push(inputChars.join(''));
      // console.log(inputChars.join(''));
    }
    console.clear();
    console.log(outLines.join('\n'));
  });
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

function setProcName() {
  process.title = `${process.title}-t9`;
}
