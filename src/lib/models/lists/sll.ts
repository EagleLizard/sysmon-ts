
import { SllNode } from './sll-node';

export class Sll<TVal> {
  private _length: number;
  head: SllNode<TVal> | undefined;

  constructor(vals: TVal[] = []) {
    this._length = 0;
    for(let i = 0; i < vals.length; ++i) {
      this.pushFront(vals[i]);
    }
  }

  get length(): number {
    return this._length;
  }

  /*
    Inserts new node as head
  */
  pushFront(val: TVal) {
    let nextNode: SllNode<TVal>;
    nextNode = SllNode.init(val);
    if(this.head !== undefined) {
      nextNode.next = this.head;
    }
    this.head = nextNode;
    this._length++;
  }
  popFront(): SllNode<TVal> | undefined {
    let currHead: SllNode<TVal>;
    if(this.head === undefined) {
      return undefined;
    }
    currHead = this.head;
    this.head = currHead.next;
    this._length--;
    delete currHead.next;
    return currHead;
  }

  *[Symbol.iterator]() {
    let currNode: SllNode<TVal> | undefined;
    currNode = this.head;
    while(currNode !== undefined) {
      yield currNode.val;
      currNode = currNode.next;
    }
  }
}
