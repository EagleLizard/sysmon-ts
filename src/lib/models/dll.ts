
let dllNodePool: DllNode<unknown>[] | undefined;

export function initializeDllNodePool(poolSize: number) {
  if(dllNodePool !== undefined) {
    throw new Error('DllNodePool already initialized');
  }
  dllNodePool = [];
  dllNodePool = Array(poolSize).fill(0).map(() => {
    return DllNode.init();
  });
  console.log(dllNodePool);
}

export function resetDllNodePool() {
  dllNodePool = undefined;
}

export class DllNode<TVal> {
  private _val: TVal | undefined;
  next?: DllNode<TVal>;
  prev?: DllNode<TVal>;
  private constructor(
    val?: TVal
  ) {
    this._val = val ?? undefined;
  }

  get val(): TVal {
    if(this._val === undefined) {
      console.error(this);
      throw new Error('Attempt to access "val" of uninitialized DllNode');
    }
    return this._val;
  }

  $destroy() {
    // this._val = undefined;
    // this.next = undefined;
    // this.prev = undefined;
    // push onto pool
    if(dllNodePool === undefined) {
      throw new Error('Attempted to call $destroy on DllNode before initializing pool');
    }
    dllNodePool.push(this);
  }

  static init<I>(
    val?: I
  ): DllNode<I> {
    let poolNode: DllNode<unknown> | undefined;
    // get from pool or make a new DllNode
    if(dllNodePool === undefined) {
      throw new Error('Attemped to initialize DllNode before initializing pool');
    }
    if(dllNodePool.length > 0) {
      poolNode = dllNodePool.pop();
      if(poolNode !== undefined) {
        poolNode._val = val;
        poolNode.next = undefined;
        poolNode.prev = undefined;
        return poolNode as DllNode<I>;
      }
    }
    return new DllNode(val);
  }
}

export class Dll<TVal> {
  private _length: number;

  first: DllNode<TVal> | undefined;
  last: DllNode<TVal> | undefined;

  constructor() {
    this._length = 0;
  }

  get length() {
    return this._length;
  }

  push(val: TVal) {
    let nextNode: DllNode<TVal>;
    nextNode = DllNode.init(val);
    this._length++;
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
    nextNode = DllNode.init(val);
    this._length++;
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
    let val: TVal;
    currLast = this.last;
    if(currLast === undefined) {
      return;
    }
    this._length--;
    if(currLast.prev === undefined) {
      // no more nodes, unset first and last
      this.first = undefined;
      this.last = undefined;
      return currLast.val;
    }
    this.last = currLast.prev;
    this.last.next = undefined;

    val = currLast.val;
    currLast.$destroy();
    return val;
  }

  popFront(): TVal | undefined {
    let currFirst: DllNode<TVal> | undefined;
    let val: TVal;
    currFirst = this.first;
    if(currFirst === undefined) {
      return undefined;
    }
    this._length--;
    if(currFirst.next === undefined) {
      // no more nodes, unset first and last
      this.first = undefined;
      this.last = undefined;
      return currFirst.val;
    }
    this.first = currFirst.next;
    this.first.prev = undefined;
    val = currFirst.val;
    currFirst.$destroy();
    return val;
  }

  *[Symbol.iterator]() {
    let currNode: DllNode<TVal> | undefined;
    currNode = this.first;
    while(currNode !== undefined) {
      yield currNode.val;
      currNode = currNode.next;
    }
  }
}
