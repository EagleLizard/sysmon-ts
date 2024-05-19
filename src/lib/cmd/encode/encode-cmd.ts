
import assert from 'assert';
import { SysmonCommand } from '../sysmon-args';

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
  let encodedBitArr: (0 | 1)[];
  rootFreq = getHuffTree(testStr);
  codeLookupMap = new Map();
  // console.log(rootFreq);
  traverseHuffTree(rootFreq, (val, code) => {
    console.log(`${val}: ${code.join('')}`);
    codeLookupMap.set(val, code);
  });
  encodedBitArr = [];
  for(let i = 0; i < testStr.length; ++i) {
    let currChar = testStr[i];
    let currCode = codeLookupMap.get(currChar);
    if(currCode === undefined) {
      throw new Error(`No code exists for char: '${currChar}'`);
    }
    encodedBitArr = encodedBitArr.concat(currCode);
  }
  
  let uint8Arr = bitArrToUint8Arr(encodedBitArr);
  let uint8Str = Buffer.from(uint8Arr.buffer).toString('binary');
  let decodedUint8Str = new Uint8Array(Buffer.from(uint8Str, 'binary'));
  console.log(`input string len: ${testStr.length}`);
  console.log(`encoded string len: ${uint8Str.length}`);
  let decodedBitArr = uint8ArrToBitArray(decodedUint8Str);
  let decodedHuffStr = decodeHuff(rootFreq, decodedBitArr);
  console.log(encodedBitArr.join(''));
  console.log(decodedBitArr.join(''));
  // assert.strict.equal(decodedHuffStr, testStr);
  let encodedByteArr = bitArrToByteArr(encodedBitArr);
  console.log(encodedByteArr.map((currByte) => {
    return currByte.join('');
  }).join(' '));
  let decodedByteArr = uint8ArrToByteArray(decodedUint8Str);
  console.log(decodedByteArr.map((currByte) => {
    return currByte.join('');
  }).join(' '));
}

function bitArrToByteArr(bitArr: (0 | 1)[]): (0 | 1)[][] {
  let byteArr: (0 | 1)[][];
  let currByte: (0 | 1)[];
  let bitChunks: (0 | 1)[][];
  bitChunks = chunk(bitArr, 8);

  return bitChunks;
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

function uint8ArrToByteArray(uint8Arr: Uint8Array): (0 | 1)[][] {
  let byteArr: (0 | 1)[][];
  byteArr = [];
  for(let i = 0; i < uint8Arr.length; ++i) {
    let currByte: (0 | 1)[];
    let currInt = uint8Arr[i];
    let currBitStr = currInt.toString(2);
    currByte = [];
    for(let k = 0; k < currBitStr.length; ++k) {
      let currBit = +currBitStr[k];
      if(currBit !== 0 && currBit !== 1) {
        throw new Error(`Unexpected bit: ${currBitStr[k]}`);
      }
      currByte.push(currBit);
    }
    while(currByte.length < 8) {
      currByte.unshift(0);
    }
    byteArr.push(currByte);
  }
  return byteArr;
}

function uint8ArrToBitArray(uint8Arr: Uint8Array): (0 | 1)[] {
  let bitArr: (0 | 1)[];
  let currByte: (0 | 1)[];
  bitArr = [];
  currByte = [];
  for(let i = 0; i < uint8Arr.length; ++i) {
    let currInt = uint8Arr[i];
    // console.log(currInt);
    let currBitStr = currInt.toString(2);
    // if(currBitStr.length < 8) {
    //   currBitStr = `${'0'.repeat(8 - currBitStr.length)}${currBitStr}`;
    // }
    for(let k = 0; k < currBitStr.length; ++k) {
      let currBit = +currBitStr[k];
      if(currBit !== 0 && currBit !== 1) {
        throw new Error(`Unexpected bit: ${currBitStr[k]}`);
      }
      currByte.push(currBit);
    }
    if((i !== (uint8Arr.length - 1))) {
      while(currByte.length < 8) {
        currByte.unshift(0);
      }
    }
    bitArr = bitArr.concat(currByte);
    currByte.length = 0;
  }
  return bitArr;
}

function bitArrToByteArr(bitArr: (0 | 1)[]): (0 | 1)[][] {
  let byteArr: (0 | 1)[][];
  let currByte: (0 | 1)[];
  let bitChunks: (0 | 1)[][];
  byteArr = [];
  currByte = [];
  bitChunks = chunk(bitArr, 8);

  return bitChunks;
}

function bitArrToUint8Arr(bitArr: (0 | 1)[]): Uint8Array {
  let bytes: (0 | 1)[][];
  let intArr: number[];
  let uint8Arr: Uint8Array;
  bytes = chunk(bitArr, 8);
  // console.log(bytes);
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
      chunks.push(currChunk.slice());
      currChunk.length = 0;
    }
    currChunk.push(arr[i]);
  }
  if(currChunk.length > 0) {
    chunks.push(currChunk);
  }
  return chunks;
}

function traverseHuffTree(
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
    traverseHuffTree(rootFreq.left, visitCb, soFar);
    soFar.pop();
  }
  if(rootFreq.right !== undefined) {
    soFar.push(1);
    traverseHuffTree(rootFreq.right, visitCb, soFar);
    soFar.pop();
  }
}

function getHuffTree(str: string): FreqNode {
  let freqs: FreqNode[];
  let freqRoot: FreqNode | undefined;
  freqs = getFreqs(str);
  for(let i = 0; i < freqs.length; ++i) {
    let currFreq = freqs[i];
    console.log(`${currFreq.val}: ${currFreq.freq}`);
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
  // freqs.sort((a, b) => {
  //   if(a[1] > b[1]) {
  //     return 1;
  //   } else if(a[1] < b[1]) {
  //     return -1;
  //   } else {
  //     return a[0].localeCompare(b[0]);
  //   }
  // });

  return freqs;
}
