
import { Sll } from './sll';

let dllNodePool: Sll<unknown> | undefined;
let enableDllNodePool = true;

export type InitDllNodePoolOpts = {
  poolSize: number;
  lazy?: boolean;
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
    delete this._val;
    delete this.next;
    delete this.prev;
    // push onto pool
    if(dllNodePool === undefined) {
      throw new Error('Attempted to call $destroy on DllNode before initializing pool');
    }
    if(DllNode.isPoolEnabled()) {
      dllNodePool.pushFront(this);
    }
  }

  static init<I>(
    val?: I
  ): DllNode<I> {
    let poolNode: DllNode<unknown> | undefined;
    // get from pool or make a new DllNode
    if(dllNodePool === undefined) {
      throw new Error('Attemped to initialize DllNode before initializing pool');
    }
    if(
      (dllNodePool.length > 0)
      && DllNode.isPoolEnabled()
    ) {
      poolNode = dllNodePool.popFront();
      if(poolNode !== undefined) {
        poolNode._val = val;
        poolNode.next = undefined;
        poolNode.prev = undefined;
        return poolNode as DllNode<I>;
      }
    }
    return new DllNode(val);
  }

  static initDllNodePool(opts: InitDllNodePoolOpts) {
    let poolSize: number;
    let lazy: boolean;

    poolSize = opts.poolSize;
    lazy = opts.lazy = false;

    if(dllNodePool !== undefined) {
      throw new Error('DllNodePool already initialized');
    }
    dllNodePool = new Sll();
    if(poolSize === -1) {
      enableDllNodePool = false;
    } else {
      Array(poolSize).fill(0).forEach(() => {
        dllNodePool?.pushFront(DllNode.init());
      });
    }
  }

  static resetDllNodePool() {
    dllNodePool = undefined;
  }

  static isPoolEnabled(): boolean {
    return enableDllNodePool === true;
  }
  static get poolLength(): number {
    if(dllNodePool?.length === undefined) {
      throw new Error('Attempted to access pooleLength property with invalid pool');
    }
    return dllNodePool.length;
  }
}
