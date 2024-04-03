
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Dll, initializeDllNodePool, resetDllNodePool } from './dll';

describe('Dll tests', () => {
  let testNums: number[] = [];
  beforeEach(() => {
    testNums = [ 1, 2, 3, 4, 5 ];
    initializeDllNodePool(0);
  });
  afterEach(() => {
    resetDllNodePool();
  });

  it('Test init on push()', () => {
    let dll: Dll<number>;
    const testNum = 1;
    dll = new Dll();
    dll.push(testNum);
    expect(dll.first?.val).toBe(testNum);
    expect(dll.last?.val).toBe(testNum);
    expect(dll.first).equals(dll.last);
  });
  it('Test init on pushFront()', () => {
    let dll: Dll<number>;
    const testNum = 1;
    dll = new Dll();
    dll.pushFront(testNum);
    expect(dll.first?.val).toBe(testNum);
    expect(dll.last?.val).toBe(testNum);
    expect(dll.first).equals(dll.last);
  });

  it('Tests push() inserts in correct order', () => {
    let dll: Dll<number>;
    dll = new Dll();
    console.log(testNums);
    for(let i = 0; i < testNums.length; ++i) {
      dll.push(testNums[i]);
    }
    let currNode = dll.first;
    let currNodeIdx = 0;
    while(currNode !== undefined) {
      let n = testNums[currNodeIdx];
      expect(n).toBe(currNode.val);
      currNode = currNode.next;
      currNodeIdx++;
    }
  });

  it('Tests iteratable', () => {
    let dll: Dll<number>;
    let dllArr: number[];
    dll = new Dll();
    for(let i = 0; i < testNums.length; ++i) {
      dll.push(testNums[i]);
    }
    dllArr = [ ...dll ];
    expect(dllArr).toEqual(testNums);
  });

  it('Tests pushFront() inserts in correct order', () => {
    let dll: Dll<number>;
    let reversedNums: number[];
    dll = new Dll();
    for(let i = 0; i < testNums.length; ++i) {
      dll.pushFront(testNums[i]);
    }
    reversedNums = testNums.slice();
    reversedNums.reverse();
    expect([ ...dll ]).toEqual(reversedNums);
  });

  it('tests pop() dequeues in correct order', () => {
    let dll: Dll<number>;
    let dllVals: number[];
    let currNodeVal: number | undefined;
    let reversedNums: number[];
    dll = new Dll();
    for(let i = 0; i < testNums.length; ++i) {
      dll.push(testNums[i]);
    }
    dllVals = [];
    while((currNodeVal = dll.pop()) !== undefined) {
      dllVals.push(currNodeVal);
    }
    reversedNums = testNums.slice();
    reversedNums.reverse();
    expect(dllVals).toEqual(reversedNums);
  });

  it('tests popFront() dequeues in correct order', () => {
    let dll: Dll<number>;
    let dllVals: number[];
    let currNodeVal: number | undefined;
    dll = new Dll();
    for(let i = 0; i < testNums.length; ++i) {
      dll.push(testNums[i]);
    }
    dllVals = [];
    while((currNodeVal = dll.popFront()) !== undefined) {
      dllVals.push(currNodeVal);
    }
    expect(dllVals).toEqual(testNums);
  });

  it('tests the length getter returns correct length', () => {
    let dll: Dll<number>;
    dll = new Dll();
    for(let i = 0; i < testNums.length; ++i) {
      dll.push(testNums[i]);
    }
    expect(dll.length).toEqual(testNums.length);
  });

  it('tests the length getter returns correct length after pop()', () => {
    let dll: Dll<number>;
    dll = new Dll();
    for(let i = 0; i < testNums.length; ++i) {
      dll.push(testNums[i]);
    }
    dll.pop();
    expect(dll.length).toEqual(testNums.length - 1);
  });
  it('tests the length getter returns correct length after popFront()', () => {
    let dll: Dll<number>;
    dll = new Dll();
    for(let i = 0; i < testNums.length; ++i) {
      dll.push(testNums[i]);
    }
    dll.popFront();
    expect(dll.length).toEqual(testNums.length - 1);
  });

});
