
import { describe, it, expect, beforeEach  } from 'vitest';
import { Sll } from './sll';

describe('singly linked list (SLL) tests', () => {
  let testNums: number[];
  beforeEach(() => {
    testNums = [ 1, 2, 3, 4, 5 ];
  });

  it('tests pushFront() inserts nodes in correct order', () => {
    let sll: Sll<number>;
    sll = new Sll();
    for(let i = 0; i < testNums.length; ++i) {
      sll.pushFront(testNums[i]);
    }
    let reversedNums = testNums.slice();
    reversedNums.reverse();
    let currNode = sll.head;
    let currNodeIdx = 0;
    while(currNode !== undefined) {
      expect(currNode.val).toBe(reversedNums[currNodeIdx]);
      currNode = currNode.next;
      currNodeIdx++;
    }
  });

  it('Tests iterable interface', () => {
    let sll: Sll<number>;
    let reversedNums: number[];
    sll = new Sll();
    for(let i = 0; i < testNums.length; ++i) {
      sll.pushFront(testNums[i]);
    }
    reversedNums = testNums.slice();
    reversedNums.reverse();
    expect([ ...sll ]).toEqual(reversedNums);
  });

  it('Tests popFront() pops removes int he correct order', () => {
    let sll: Sll<number>;
    sll = new Sll();
    for(let i = 0; i < testNums.length; ++i) {
      sll.pushFront(testNums[i]);
    }

    for(let i = 0; i < testNums.length; ++i) {
      const poppedNode = sll.popFront();
      const poppedNum = testNums.pop();
      if(poppedNode === undefined) {
        throw new Error(`Unexpect undefined node, i: ${i}`);
      }
      if(poppedNum === undefined) {
        throw new Error(`Unexpect undefined num, i: ${i}`);
      }
      expect(poppedNode.val).toEqual(poppedNum);
    }
  });

  it('tests length getter returns correct length', () => {
    let sll: Sll<number>;
    sll = new Sll();
    for(let i = 0; i < testNums.length; ++i) {
      sll.pushFront(testNums[i]);
    }
    expect(sll.length).toEqual(testNums.length);
  });
  it('tests length getter returns correct length after popFront()', () => {
    let sll: Sll<number>;
    sll = new Sll();
    for(let i = 0; i < testNums.length; ++i) {
      sll.pushFront(testNums[i]);
    }
    sll.popFront();
    expect(sll.length).toEqual(testNums.length - 1);
  });
});
