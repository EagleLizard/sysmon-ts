
import { Bit } from '../../models/encode/huff-tree';
import { chunk } from '../../util/chunk';

export type HuffStr = {
  val: string;
  pad: number;
};

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
  huffStr = {
    val: resStr,
    pad,
  };
  return huffStr;
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
