import { LETTER_TO_DIGIT_MAP } from './t-nine-key-mappings';

export class DigitTrieNode {
  children: Map<string, DigitTrieNode>; // digit -> DigitTrieNode
  isTerminal: boolean;
  val: string; // digit
  words: string[];
  constructor(val: string, isTerminal?: boolean) {
    this.children = new Map;
    this.isTerminal = isTerminal ?? false;
    this.val = val;
    this.words = [];
  }
}

export class DigitTrie {
  head: DigitTrieNode;
  constructor() {
    this.head = new DigitTrieNode('');
  }

  insert(word: string) {
    let chars: string[];
    let currNode: DigitTrieNode;
    chars = word.split('');
    currNode = this.head;
    for(let i = 0; i < chars.length; ++i) {
      let currChar: string;
      let currDigit: string;
      let nextNode: DigitTrieNode | undefined;
      currChar = chars[i].toLowerCase();
      currDigit = LETTER_TO_DIGIT_MAP[currChar];
      nextNode = currNode.children.get(currDigit);
      if(nextNode === undefined) {
        nextNode = new DigitTrieNode(currDigit);
        currNode.children.set(currDigit, nextNode);
      }
      nextNode.words.push(word);
      currNode = nextNode;
    }
  }

  getDigits(digits: string) {
    let currNode: DigitTrieNode;
    let nextNode: DigitTrieNode | undefined;
    currNode = this.head;
    for(let i = 0; i < digits.length; ++i) {
      let currDigit: string;
      currDigit = digits[i];
      nextNode = currNode.children.get(currDigit);
      if(nextNode === undefined) {
        return;
      }
      currNode = nextNode;
    }
    return currNode;
  }
}
