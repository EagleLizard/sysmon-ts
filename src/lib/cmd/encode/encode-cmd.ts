
import fs from 'fs';
import { isString } from '../../util/validate-primitives';
import { SysmonCommand } from '../sysmon-args';
import { Timer } from '../../util/timer';
import { getIntuitiveTimeString } from '../../util/format-util';

class FreqNode {
  left: FreqNode | undefined;
  right: FreqNode | undefined;
  constructor(
    public freq: number,
    public val?: string,
  ) {}
}

/*
  huffman encoding
*/
export async function encodeMain(cmd: SysmonCommand) {
  const testStr = 'A llama likely lolls lazily about.';
  let rootFreq: FreqNode;
  let codeLookupMap: Map<string, (0 | 1)[]>;

  rootFreq = getHuffTree(testStr);
  codeLookupMap = getHuffLookupMap(rootFreq);

  let huffStr = getHuffStr(testStr, codeLookupMap);
  let decodedHuffStr = decodeHuffStr(huffStr, rootFreq);
  console.log(`input string len: ${testStr.length}`);
  console.log(`encoded string len: ${huffStr.val.length}`);
  console.log(testStr);
  console.log(decodedHuffStr);

  let filePath: string | undefined;
  filePath = cmd.args?.[0];
  if(isString(filePath)) {
    let fileData: Buffer;
    let fileDataStr: string;
    let encodedFileHuffStr: HuffStr;

    fileData = fs.readFileSync(filePath);
    fileDataStr = fileData.toString();

    rootFreq = getHuffTree(fileDataStr);

    codeLookupMap = getHuffLookupMap(rootFreq);

    encodedFileHuffStr = getHuffStr(fileDataStr, codeLookupMap);
    let huffTreeStrParts: string[];
    let huffTreeStr: string;
    let huffTreeHeader: string;
    huffTreeStrParts = [];
    huffTreePostOrder(rootFreq, (freqNode) => {
      let isLeaf: boolean;
      isLeaf = freqNode.val !== undefined;
      if(isLeaf) {
        huffTreeStrParts.push(`1${freqNode.val}`);
      } else {
        huffTreeStrParts.push('0');
      }
    });
    huffTreeStrParts.push('0');
    huffTreeStr = huffTreeStrParts.join('');
    huffTreeHeader = `${huffTreeStr.length}:${huffTreeStr}`;
    console.log('huffTreeHeader:');
    console.log(huffTreeHeader);

    console.log(`fileData.length: ${fileData.length.toLocaleString()}`);
    console.log(`encodedFileData.length: ${encodedFileHuffStr.val.length.toLocaleString()}`);
  }

}

type HuffStr = {
  val: string;
  pad: number;
};

function decodeHuffStr(huffStr: HuffStr, rootFreq: FreqNode): string {
  let uint8Arr: Uint8Array;
  let bitArr: (0 | 1)[];
  let decodedStr: string;
  uint8Arr = new Uint8Array(Buffer.from(huffStr.val, 'binary'));
  bitArr = uint8ArrToBitArray(uint8Arr);
  bitArr.splice(0, huffStr.pad);
  decodedStr = decodeHuff(rootFreq, bitArr);
  return decodedStr;
}

function getHuffStr(
  str: string,
  codeLookupMap: Map<string, (0 | 1)[]>
): HuffStr {
  let huffStr: HuffStr;
  let resStr: string;
  let pad: number;
  let bitArr: (0 | 1)[];
  let byteArr: (0 | 1)[][];
  let lastByte: (0 | 1)[];
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

function decodeHuff(rootFreq: FreqNode, bitArr: (0 | 1)[]): string {
  let chars: string[];
  let currNode: FreqNode;
  let decodedStr: string;
  chars = [];
  currNode = rootFreq;
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
      currNode = rootFreq;
    }
  }
  decodedStr = chars.join('');
  return decodedStr;
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

function bitArrToUint8Arr(bitArr: (0 | 1)[]): Uint8Array {
  let bytes: (0 | 1)[][];
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

function chunk<T>(arr: T[], chunkSize: number): T[][] {
  let chunks: T[][];
  let currChunk: T[];
  chunks = [];
  currChunk = [];
  for(let i = 0; i < arr.length; ++i) {
    if(currChunk.length >= chunkSize) {
      chunks.push(currChunk);
      currChunk = [];
    }
    currChunk.push(arr[i]);
  }
  if(currChunk.length > 0) {
    chunks.push(currChunk);
  }
  return chunks;
}

function getHuffLookupMap(rootFreq: FreqNode): Map<string, (0 | 1)[]> {
  let lookupMap: Map<string, (0 | 1)[]>;
  lookupMap = new Map();
  huffTreePreOrder(rootFreq, (val, code) => {
    lookupMap.set(val, code);
  });
  return lookupMap;
}

function huffTreePostOrder(
  rootFreq: FreqNode,
  visitCb: (freqNode: FreqNode) => void,
) {
  if(rootFreq.left !== undefined) {
    huffTreePostOrder(rootFreq.left, visitCb);
  }
  if(rootFreq.right !== undefined) {
    huffTreePostOrder(rootFreq.right, visitCb);
  }
  visitCb(rootFreq);
}

function huffTreePreOrder(
  rootFreq: FreqNode,
  visitCb: (val: string, code: (0 | 1)[]) => void,
  soFar?: (0 | 1)[]
) {
  if(soFar === undefined) {
    soFar = [];
  }
  if(rootFreq.val !== undefined) {
    /*
      leaf node
    */
    visitCb(rootFreq.val, soFar.slice());
  }
  if(rootFreq.left !== undefined) {
    soFar.push(0);
    huffTreePreOrder(rootFreq.left, visitCb, soFar);
    soFar.pop();
  }
  if(rootFreq.right !== undefined) {
    soFar.push(1);
    huffTreePreOrder(rootFreq.right, visitCb, soFar);
    soFar.pop();
  }
}

function getHuffTree(str: string): FreqNode {
  let freqs: FreqNode[];
  let freqRoot: FreqNode | undefined;
  freqs = getFreqs(str);
  for(let i = 0; i < freqs.length; ++i) {
    let currFreq = freqs[i];
    // console.log(`${currFreq.val}: ${currFreq.freq}`);
  }
  while(freqs.length > 1) {
    let leftFreq: FreqNode | undefined;
    let rightFreq: FreqNode | undefined;
    let nextFreq: FreqNode;
    freqs.sort(freqComparator);
    leftFreq = freqs.shift();
    rightFreq = freqs.shift();
    if(leftFreq === undefined) {
      throw new Error('Unexpected undefined left FreqNode');
    }
    if(rightFreq === undefined) {
      throw new Error('Unexpected undefined right FreqNode');
    }
    nextFreq = new FreqNode(leftFreq.freq + rightFreq.freq);
    nextFreq.left = leftFreq;
    nextFreq.right = rightFreq;
    freqs.push(nextFreq);
  }
  freqRoot = freqs.pop();
  if(freqRoot === undefined) {
    throw new Error('getHuffTree result is undefined, expected a FreqNode');
  }
  return freqRoot;
}

function freqComparator(a: FreqNode, b: FreqNode): number {
  if(a.freq > b.freq) {
    return 1;
  } else if(a.freq < b.freq) {
    return -1;
  } else {
    if(b.val === undefined) {
      return 1;
    } else if(a.val === undefined) {
      return 1;
    } else {
      return a.val.localeCompare(b.val);
    }
  }
}

function getFreqs(str: string): FreqNode[] {
  let freqMap: Map<string, number>;
  let freqs: FreqNode[];
  freqMap = new Map();
  for(let i = 0; i < str.length; ++i) {
    let currChar = str[i];
    let currCount = freqMap.get(currChar);
    if(currCount === undefined) {
      currCount = 0;
    }
    currCount++;
    freqMap.set(currChar, currCount);
  }
  freqs = [
    ...freqMap.entries()
  ].map(freqTuple => {
    return new FreqNode(freqTuple[1], freqTuple[0]);
  });
  freqs.sort(freqComparator);

  return freqs;
}
