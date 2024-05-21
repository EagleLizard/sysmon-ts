import { HuffStr, getHuffStr, uint8ArrToBitArray } from '../../cmd/encode/huff';

const HUFF_HEADER_DELIM = ':';
const HUFF_STR_START_DELIM = '-';
const HUFF_STR_DELIM = '_';

export type Bit = (0 | 1);

export type HuffHeader = {
  header: string;
  pos: number;
};

export class FreqNode {
  left: FreqNode | undefined;
  right: FreqNode | undefined;
  constructor(
    public freq: number,
    public val?: string,
  ) {}
}

export class HuffTree {
  root: FreqNode;
  private constructor(root: FreqNode) {
    this.root = root;
  }

  getLookupMap(): Map<string, Bit[]> {
    let lookupMap: Map<string, Bit[]>;
    lookupMap = new Map();
    huffTreePreOrder(this.root, (freq, code) => {
      if(freq.val !== undefined) {
        lookupMap.set(freq.val, code);
      }
    });
    return lookupMap;
  }

  getTreeStr(): string {
    let treeStrParts: string[];
    let treeStr: string;
    // let treeHeader: string;
    treeStrParts = [];
    huffTreePostOrder(this.root, (freqNode) => {
      let isLeaf: boolean;
      isLeaf = freqNode.val !== undefined;
      if(isLeaf) {
        treeStrParts.push(`1${freqNode.val}`);
      } else {
        treeStrParts.push('0');
      }
    });
    treeStrParts.push('0');
    treeStr = treeStrParts.join('');
    return treeStr;
  }

  getHuffHeader(): string {
    let treeStr: string;
    let huffHeader: string;
    treeStr = this.getTreeStr();
    huffHeader = `${treeStr.length}${HUFF_HEADER_DELIM}${treeStr}`;
    return huffHeader;
  }

  encode(str: string): string {
    let codeLookupMap: Map<string, Bit[]>;
    let huffStr: HuffStr;
    let headerStr: string;
    let encodedStr: string;
    codeLookupMap = this.getLookupMap();
    headerStr = this.getHuffHeader();
    huffStr = getHuffStr(str, codeLookupMap);
    encodedStr = `${headerStr}${HUFF_STR_START_DELIM}${huffStr}`;
    return encodedStr;
  }

  decodeHuffStr(huffStr: HuffStr): string {
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
    decodedStr = this.decodeHuffBits(bitArr);
    return decodedStr;
  }

  private decodeHuffBits(bitArr: (0 | 1)[]): string {
    let chars: string[];
    let currNode: FreqNode;
    let decodedStr: string;
    chars = [];
    currNode = this.root;
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
        currNode = this.root;
      }
    }
    decodedStr = chars.join('');
    return decodedStr;
  }

  static parseHeader(str: string): HuffHeader {
    let pos: number;
    let currChar: string;
    let header: string;
    let headerLenStr: string;
    let headerLen: number;
    headerLenStr = '';
    pos = 0;
    while((currChar = str[pos++]) !== HUFF_HEADER_DELIM) {
      if(!/[0-9]/.test(currChar)) {
        throw new Error(`unexpected header length digit: ${currChar}`);
      }
      headerLenStr += currChar;
    }

    headerLen = +headerLenStr;
    let headerPos = 0;
    header = '';
    while(headerPos < headerLen) {
      currChar = str[pos + headerPos++];
      header += currChar;
    }
    if(str[pos + headerPos] !== HUFF_STR_START_DELIM) {
      throw new Error(`Unexpect HuffStr start delimiter: ${str[pos + headerPos]}`);
    }
    headerPos++;

    return {
      header,
      pos: pos + headerPos,
    };
  }

  static fromHeader(headerStr: string): HuffTree {
    let charStack: FreqNode[];
    let pos: number;
    charStack = [];
    pos = 0;
    while(pos < headerStr.length) {
      let currChar = headerStr[pos++];
      switch(currChar) {
        case '1':
          charStack.push(new FreqNode(-1, headerStr[pos++]));
          break;
        case '0':
          let freq: FreqNode;
          if(charStack.length > 1) {
            freq = new FreqNode(-1);
            freq.right = charStack.pop();
            freq.left = charStack.pop();
            charStack.push(freq);
          }
          break;
        default:
          throw new Error(`Unexpected char at header postion ${pos}: ${currChar}`);
      }
    }
    return new HuffTree(charStack[0]);
  }

  static init(str: string): HuffTree {
    let freqs: FreqNode[];
    let freqRoot: FreqNode | undefined;
    freqs = getFreqs(str);
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
    return new HuffTree(freqRoot);
  }
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

export function huffTreePreOrder(
  rootFreq: FreqNode,
  visitCb: (freqNode: FreqNode, code: (0 | 1)[]) => void,
  soFar?: (0 | 1)[]
) {
  if(soFar === undefined) {
    soFar = [];
  }
  visitCb(rootFreq, soFar.slice());
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

function freqComparator(a: FreqNode, b: FreqNode): number {
  if(a.freq > b.freq) {
    return 1;
  } else if(a.freq < b.freq) {
    return -1;
  } else {
    if(b.val === undefined) {
      return 1;
    } else if(a.val === undefined) {
      return -1;
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
