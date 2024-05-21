
import { Bit, FreqNode, HuffTree } from '../../models/encode/huff-tree';
import { chunk } from '../../util/chunk';

const HUFF_STR_DELIM = '_';

export type HuffStr = string;

export function getHuffStr(
  str: string,
  codeLookupMap: Map<string, Bit[]>
): HuffStr {
  let huffStr: HuffStr;
  let resStr: string;
  let pad: number;
  let bitArr: Bit[];
  let byteArr: Bit[][];
  let lastByte: Bit[];
  let uint8Arr: Uint8Array;
  bitArr = [];
  pad = 0;
  for(let i = 0; i < str.length; ++i) {
    let currChar = str[i];
    let currCode = codeLookupMap.get(currChar);
    if(currCode === undefined) {
      throw new Error(`No code exists for char: '${currChar}'`);
    }
    for(let k = 0; k < currCode.length; ++k) {
      bitArr.push(currCode[k]);
    }
  }

  byteArr  = chunk(bitArr, 8);
  lastByte = byteArr[byteArr.length - 1];
  if(lastByte.length < 8) {
    pad = 8 - lastByte.length;
    for(let i = 0; i < pad; ++i) {
      bitArr.unshift(0);
    }
  }
  uint8Arr = bitArrToUint8Arr(bitArr);
  resStr = Buffer.from(uint8Arr.buffer).toString('binary');
  huffStr = `${pad}${HUFF_STR_DELIM}${resStr}`;
  return huffStr;
}

export function decodeHuffStr(huffStr: HuffStr, huffTree: HuffTree): string {
  let uint8Arr: Uint8Array;
  let bitArr: Bit[];
  let decodedStr: string;

  let huffVal: string;
  let pad: number;
  let padChars: string[];
  let pos: number;
  let currChar: string;
  pos = 0;
  padChars = [];
  while((currChar = huffStr[pos++]) !== HUFF_STR_DELIM) {
    if(!/[0-9]/.test(currChar)) {
      throw new Error(`Unexpected digit in huffStr pad: ${currChar}`);
    }
    padChars.push(currChar);
  }
  huffVal = huffStr.substring(pos);
  pad = +padChars.join('');

  uint8Arr = new Uint8Array(Buffer.from(huffVal, 'binary'));
  bitArr = uint8ArrToBitArray(uint8Arr);
  bitArr.splice(0, pad);
  decodedStr = decodeHuff(huffTree, bitArr);
  return decodedStr;
}

function decodeHuff(huffTree: HuffTree, bitArr: (0 | 1)[]): string {
  let chars: string[];
  let currNode: FreqNode;
  let decodedStr: string;
  chars = [];
  currNode = huffTree.root;
  for(let i = 0; i < bitArr.length; ++i) {
    let currBit = bitArr[i];
    if(currBit === 0) {
      if(currNode.left === undefined) {
        console.error(currNode);
        throw new Error('unexpected undefined left node');
      }
      currNode = currNode.left;
    } else {
      if(currNode.right === undefined) {
        console.error(currNode);
        throw new Error('unexpected undefined right node');
      }
      currNode = currNode.right;
    }
    if(currNode.val !== undefined) {
      chars.push(currNode.val);
      currNode = huffTree.root;
    }
  }
  decodedStr = chars.join('');
  return decodedStr;
}

function bitArrToUint8Arr(bitArr: Bit[]): Uint8Array {
  let bytes: Bit[][];
  let intArr: number[];
  let uint8Arr: Uint8Array;
  bytes = chunk(bitArr, 8);
  intArr = [];
  for(let i = 0; i < bytes.length; ++i) {
    let currByte = bytes[i];
    let currInt = parseInt(currByte.join(''), 2);
    intArr.push(currInt);
  }
  uint8Arr = new Uint8Array(intArr);
  return uint8Arr;
}

function uint8ArrToBitArray(uint8Arr: Uint8Array): (0 | 1)[] {
  let bitArr: (0 | 1)[];
  let currByte: (0 | 1)[];
  bitArr = [];
  currByte = [];
  for(let i = 0; i < uint8Arr.length; ++i) {
    let currInt = uint8Arr[i];
    let currBitStr = currInt.toString(2);
    let leftPad: number;
    leftPad = 8 - currBitStr.length;
    while(leftPad--) {
      currByte.push(0);
    }
    for(let k = 0; k < currBitStr.length; ++k) {
      let currBit = +currBitStr[k];
      if(currBit !== 0 && currBit !== 1) {
        throw new Error(`Unexpected bit: ${currBitStr[k]}`);
      }
      currByte.push(currBit);
    }
    for(let k = 0; k < currByte.length; ++k) {
      bitArr.push(currByte[k]);
    }
    currByte.length = 0;
  }
  return bitArr;
}

