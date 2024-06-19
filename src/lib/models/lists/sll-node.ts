
export class SllNode<TVal> {
  next?: SllNode<TVal>;
  private constructor(
    public val: TVal | undefined = undefined
  ) {}
  $destroy() {
    delete this.val;
    delete this.next;
  }

  static init<I>(val?: I): SllNode<I> {
    return new SllNode(val);
  }
}
