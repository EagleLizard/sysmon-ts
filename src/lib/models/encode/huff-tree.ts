import { HuffStr } from '../../cmd/encode/huff';

export type Bit = (0 | 1);

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
    huffTreePreOrder(this.root, (val, code) => {
      lookupMap.set(val, code);
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
