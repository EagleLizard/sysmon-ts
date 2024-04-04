
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

  $destroy() {
    delete this._val;
    delete this.next;
    delete this.prev;
  }

  get val(): TVal {
    if(this._val === undefined) {
      console.error(this);
      throw new Error('Attempt to access "val" of uninitialized DllNode');
    }
    return this._val;
  }

  static init<I>(
    val?: I
  ): DllNode<I> {
    return new DllNode(val);
  }
}
