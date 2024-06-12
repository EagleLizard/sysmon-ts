
import { describe, it, expect, beforeEach } from 'vitest';
import { DigitTrie, DigitTrieNode } from './digit-trie';

describe('digit-trie tests', () => {
  let digitTrie: DigitTrie;
  let freqMap: Map<string, number>;
  let testWord1: string;
  let testWord2: string;
  let testWord3: string;

  let words: string[];
  beforeEach(() => {
    testWord1 = 'the';
    testWord2 = 'hello';
    testWord3 = 'llama';

    freqMap = new Map();
    freqMap.set(testWord1, 1);
    freqMap.set(testWord2, 2);
    freqMap.set(testWord3, 3);
    digitTrie = new DigitTrie(freqMap);

    words = [ ...freqMap.entries() ].reduce((acc, curr) => {
      for(let i = 0; i < curr[1]; ++i) {
        acc.push(curr[0]);
      }
      return acc;
    }, [] as string[]);
    for(let i = 0; i < words.length; ++i) {
      digitTrie.insert(words[i]);
    }
  });

  it('tests constructor', () => {
    expect(digitTrie.head.isTerminal).toBe(false);
  });

  it('tests insert()', () => {
    let leafNodes: DigitTrieNode[];
    leafNodes = [];
    traversePreOrder(digitTrie.head, (dtNode, soFar) => {
      if(dtNode.children.size === 0) {
        leafNodes.push(dtNode);
      }
    });

    expect(leafNodes.length).toBe(freqMap.size);
  });

  it('tests getDigits()', () => {
    let digitNode: DigitTrieNode | undefined;
    digitNode = digitTrie.getDigits('43556');

    expect(digitNode?.words).toContain('hello');
  });
});

function traversePreOrder(root: DigitTrieNode, visitCb: (dtNode: DigitTrieNode, soFar: DigitTrieNode[]) => void) {
  _preorder(root);
  function _preorder(currNode: DigitTrieNode, soFar?: DigitTrieNode[]) {
    let childEntries: [ string, DigitTrieNode ][];
    if(currNode === undefined) {
      return;
    }
    soFar = soFar ?? [];
    visitCb(currNode, soFar);
    soFar.push(currNode);
    childEntries = [ ...currNode.children.entries() ];
    for(let i = 0; i < childEntries.length; ++i) {
      _preorder(childEntries[i][1], soFar);
    }
    soFar.pop();
  }
}
