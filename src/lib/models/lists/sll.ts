
import { DllNode } from './dll-node';

export class Sll<TVal> {
  private _length: number;
  head: DllNode<TVal> | undefined;

  constructor() {
    this._length = 0;
  }

  get length(): number {
    return this._length;
  }

  /*
    Inserts new node as head
  */
  pushFront(dllNode: DllNode<TVal>) {
    if(this.head !== undefined) {
      dllNode.next = this.head;
    }
    this.head = dllNode;
    delete this.head.prev;
    this._length++;
  }
  popFront(): DllNode<TVal> | undefined {
    let currHead: DllNode<TVal>;
    if(this.head === undefined) {
      return undefined;
    }
    currHead = this.head;
    this.head = currHead.next;
    this._length--;
    delete currHead.next;
    delete currHead.prev;
    return currHead;
  }

  *[Symbol.iterator]() {
    let currNode: DllNode<TVal> | undefined;
    currNode = this.head;
    while(currNode !== undefined) {
      yield currNode.val;
      currNode = currNode.next;
    }
  }
}
