
export class DllNode<TVal> {
  constructor(
    public val: TVal,
    public next?: DllNode<TVal>,
    public prev?: DllNode<TVal>,
  ) {}
}

export class Dll<TVal> {
  first: DllNode<TVal> | undefined;
  last: DllNode<TVal> | undefined;
  constructor() {
  }

  push(val: TVal) {
    let nextNode: DllNode<TVal>;
    nextNode = new DllNode(val);
    if(
      (this.first === undefined)
      || (this.last === undefined)
    ) {
      this.first = nextNode;
      this.last = nextNode;
      return;
    }
    nextNode.prev = this.last;
    this.last.next = nextNode;
    this.last = nextNode;
  }

  pushFront(val: TVal) {
    let nextNode: DllNode<TVal>;
    nextNode = new DllNode(val);
    if(
      (this.first === undefined)
      || (this.last === undefined)
    ) {
      this.first = nextNode;
      this.last = nextNode;
      return;
    }
    nextNode.next = this.first;
    this.first.prev = nextNode;
    this.first = nextNode;
  }

  pop(): TVal | undefined {
    let currLast: DllNode<TVal> | undefined;
    currLast = this.last;
    if(currLast === undefined) {
      return;
    }
    if(currLast.prev === undefined) {
      // no more nodes, unset first and last
      this.first = undefined;
      this.last = undefined;
      return currLast.val;
    }
    this.last = currLast.prev;
    this.last.next = undefined;
    return currLast.val;
  }

  popFront(): TVal | undefined {
    let currFirst: DllNode<TVal> | undefined;
    currFirst = this.first;
    if(currFirst === undefined) {
      return undefined;
    }
    if(currFirst.next === undefined) {
      // no more nodes, unset first and last
      this.first = undefined;
      this.last = undefined;
      return currFirst.val;
    }
    this.first = currFirst.next;
    this.first.prev = undefined;
    return currFirst.val;
  }
}
