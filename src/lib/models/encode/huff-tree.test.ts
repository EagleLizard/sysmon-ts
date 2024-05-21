
import { describe, it, expect, beforeEach } from 'vitest';
import { Bit, HuffHeader, HuffTree, huffTreePreOrder } from './huff-tree';

describe('huff-tree tests', () => {
  let strMock: string;
  beforeEach(() => {
    strMock = 'aaabbcdefaaabbcdefaaabbcdef';
    console.log(strMock);
  });

  it('tests HuffTree.init()', () => {
    let leafCount: number;
    let huffTree: HuffTree;
    let testCharSet: Set<string>;
    leafCount = 0;
    huffTree = HuffTree.init(strMock);
    huffTreePreOrder(huffTree.root, (freq, code) => {
      if(freq.val !== undefined) {
        leafCount++;
      }
    });
    testCharSet = new Set(strMock.split(''));
    expect(leafCount).toBe(testCharSet.size);
  });

  it('tests huffTree.getLookupMap()', () => {
    let huffTree: HuffTree;
    let lookupMap: Map<string, Bit[]>;
    let testCharSet: Set<string>;
    huffTree = HuffTree.init(strMock);
    lookupMap = huffTree.getLookupMap();
    testCharSet = new Set(strMock.split(''));
    expect(lookupMap.size).toBe(testCharSet.size);
  });

  it('tests huffTree.encode()', () => {
    let huffTree: HuffTree;
    let encoded: string;
    let huffHeader: HuffHeader;
    let decoded: string;
    huffTree = HuffTree.init(strMock);
    encoded = huffTree.encode(strMock);
    huffHeader = HuffTree.parseHeader(encoded);
    console.log(huffHeader.header);
    decoded = huffTree.decodeHuffStr(encoded.substring(huffHeader.pos));
    expect(decoded).toBe(strMock);
  });

  it('tests HuffTree.fromheader()', () => {
    let huffHeaderStr: string;
    let huffTree: HuffTree;
    let leafCount: number;
    let testCharSet: Set<string>;
    huffHeaderStr = '1c1d01e1f001b1a000';
    huffTree = HuffTree.fromHeader(huffHeaderStr);
    leafCount = 0;
    huffTreePreOrder(huffTree.root, (freq, code) => {
      if(freq.val !== undefined) {
        leafCount++;
      }
    });
    testCharSet = new Set(strMock.split(''));
    expect(leafCount).toBe(testCharSet.size);
  });
});
