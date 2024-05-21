
import { Bit } from '../../models/encode/huff-tree';
import { chunk } from '../../util/chunk';

const HUFF_STR_DELIM = '_';

export type HuffStr = string;

export function getHuffStr(
  str: string,
  codeLookupMap: Map<string, Bit[]>
): HuffStr {
  let huffParser: HuffStrParser;
  let huffStr: HuffStr;
  huffParser = getHuffStrParser(codeLookupMap);
  for(let i = 0; i < str.length; ++i) {
    huffParser.parse(str[i]);
  }
  huffStr = huffParser.end();
  return huffStr;
}

type HuffStrParser = {
  parse: (char: string) => void;
  end: () => HuffStr;
}

function getHuffStrParser(codeLookupMap: Map<string, Bit[]>): HuffStrParser {
  let bitArr: Bit[];
  bitArr = [];
  const parse = (currChar: string) => {
    let currCode = codeLookupMap.get(currChar);
    if(currCode === undefined) {
      throw new Error(`No code exists for char: '${currChar}'`);
    }
    for(let k = 0; k < currCode.length; ++k) {
      bitArr.push(currCode[k]);
    }
  };

  const end = () => {
    let byteArr: Bit[][];
    let lastByte: Bit[];
    let pad: number;
    let uint8Arr: Uint8Array;
    let resStr: string;
    let huffStr: HuffStr;
    pad = 0;
    byteArr = chunk(bitArr, 8);
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
  };

  return {
    parse,
    end,
  };
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

export function uint8ArrToBitArray(uint8Arr: Uint8Array): (0 | 1)[] {
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

