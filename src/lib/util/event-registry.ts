
import { isPromise } from './validate-primitives';

type EventHandlerFnSync<CbParam, CbReturnValue> = (
  data: CbParam
) => CbReturnValue;
type EventHandlerFnAsync<CbParam, CbReturnValue> = (
  data: CbParam
) => Promise<CbReturnValue>;
type EventHandlerFn<CbParam, CbReturnValue> =
  | EventHandlerFnSync<CbParam, CbReturnValue>
  | EventHandlerFnAsync<CbParam, CbReturnValue>;
type RegisteredEvent<CbParam, CbReturnValue> = {
  callback: EventHandlerFn<CbParam, CbReturnValue>;
  id: number;
};

let uniqueIdCounter = 0;
export class EventRegistry<CbParam = any, CbReturnValue = any> {
  private isSingletonHandler: boolean;
  private handlers: RegisteredEvent<any, any>[];
  private handler: EventHandlerFn<CbParam, CbReturnValue> | undefined;

  constructor(isSingletonHandler = true) {
    this.isSingletonHandler = !!isSingletonHandler;
    this.handlers = [];
    this.handler = undefined;
  }

  register = (callback: EventHandlerFn<CbParam, CbReturnValue>) => {
    let id: number;
    if(this.isSingletonHandler) {
      this.handler = callback;
      return () => {
        this.handler = undefined;
      };
    } else {
      id = uniqueIdCounter++;
      this.handlers.push({
        callback,
        id,
      });
      return () => {
        this.unregister(id);
      };
    }
  };

  unregister(id: number) {
    if(this.isSingletonHandler) {
      return;
    }
    const foundIdx = this.handlers.findIndex((handler) => handler.id === id);
    if(foundIdx !== -1) {
      this.handlers.splice(foundIdx, 1);
    }
  }

  async trigger(data: CbParam) {
    if(this.isSingletonHandler) {
      if(this.handler !== undefined) {
        const result = this.handler(data);
        const resultValue = isPromise(result) ? await result : result;
        return resultValue;
      } else {
        console.warn('Attempted to trigger singleton event handler');
        return data;
      }
    } else {
      const resultValuesPromises = this.handlers.map(
        (currHandler: RegisteredEvent<CbParam, CbReturnValue>) => {
          const result = currHandler.callback(data);
          return isPromise(result) ? result : Promise.resolve(result);
        }
      );
      return await Promise.all(resultValuesPromises);
    }
  }
}
