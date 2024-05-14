
export class Deferred<T> {
  private constructor(
    public promise: Promise<T>,
    public resolve: (val: T | PromiseLike<T>) => void,
    public reject: (reason?: any) => void,
  ) {}

  static init<K>(): Deferred<K> {
    let resolver: (val: K | PromiseLike<K>) => void;
    let rejecter: (reason?: any) => void;
    resolver = () => {
      return; //noop
    };
    rejecter = () => {
      return; //noop
    };
    let promise = new Promise<K>((resolve, reject) => {
      resolver = resolve;
      rejecter = reject;
    });
    return new Deferred(
      promise,
      resolver,
      rejecter,
    );
  }
}
