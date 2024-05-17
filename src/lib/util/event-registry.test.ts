
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { EventRegistry } from './event-registry';

describe('event-registry tests', () => {
  let evtCbMock: Mock;
  let evtCbAsyncMock: Mock;

  beforeEach(() => {
    evtCbMock = vi.fn<any>();
    evtCbAsyncMock = vi.fn<any>();
  });

  it('tests constructor', () => {
    let evtRegistry: EventRegistry;
    evtRegistry = new EventRegistry();
    expect(evtRegistry).toHaveProperty('handler');
  });

  it('tests register()', () => {
    let evtRegistry: EventRegistry;

    evtRegistry = new EventRegistry();
    evtRegistry.register((data) => {
      evtCbMock(data);
    });
    expect(((evtRegistry as unknown) as any).handler).toBeDefined();
  });

  it('tests trigger() calls registered callback', () => {
    let evtRegistry: EventRegistry;
    let evtDataMock: any;

    evtRegistry = new EventRegistry();
    evtDataMock = {
      abc: 123,
    };
    evtRegistry.register((data) => {
      evtCbMock(data);
    });
    evtRegistry.trigger(evtDataMock);
    expect(evtCbMock).toHaveBeenCalledWith(evtDataMock);
  });

  it('tests register() deregister callback', () => {
    let evtRegistry: EventRegistry;
    let deregCb: () => void;

    evtRegistry = new EventRegistry();
    deregCb = evtRegistry.register((data) => {
      evtCbMock(data);
    });
    deregCb();
    expect(((evtRegistry as unknown) as any).handler).toBeUndefined();
  });

  it('tests unRegister()', () => {
    let evtRegistry: EventRegistry;

    evtRegistry = new EventRegistry();
    evtRegistry.register((data) => {
      evtCbMock(data);
    });
    evtRegistry.unregister(-1);
    expect(((evtRegistry as unknown) as any).handler).toBeDefined();
  });

  it('tests constructor (non-singleton)', () => {
    let evtRegistry: EventRegistry;
    evtRegistry = new EventRegistry(false);
    expect(evtRegistry).toHaveProperty('handlers');
  });

  it('tests register() (non-singleton)', () => {
    let evtRegistry: EventRegistry;
    evtRegistry = new EventRegistry(false);
    expect(evtRegistry).toHaveProperty('handlers');
    evtRegistry.register((data) => {
      evtCbMock(data);
    });
    expect(((evtRegistry as unknown) as any).handlers[0]).toBeDefined();
  });

  it('tests register() deregister callback (non-singleton)', () => {
    let evtRegistry: EventRegistry;
    let deregCb: () => void;
    evtRegistry = new EventRegistry(false);
    expect(evtRegistry).toHaveProperty('handlers');
    deregCb = evtRegistry.register((data) => {
      evtCbMock(data);
    });
    deregCb();
    expect(((evtRegistry as unknown) as any).handlers[0]).toBeUndefined();
  });

  it('tests trigger() (non-singleton)', () => {
    let evtRegistry: EventRegistry;
    let evtDataMock: any;

    evtRegistry = new EventRegistry(false);
    evtDataMock = {
      abc: 123,
    };
    expect(evtRegistry).toHaveProperty('handlers');
    evtRegistry.register((data) => {
      evtCbMock(data);
    });
    evtRegistry.register((data) => {
      evtCbMock(data);
    });
    evtRegistry.trigger(evtDataMock);
    expect(((evtRegistry as unknown) as any).handlers).toHaveLength(2);
    expect(evtCbMock).toHaveBeenCalledTimes(2);
  });

  it('tests trigger() calls only registered event callbacks (non-singleton)', () => {
    let evtRegistry: EventRegistry;
    let evtDataMock: any;
    let deregCb1: () => void;

    evtRegistry = new EventRegistry(false);
    evtDataMock = {
      abc: 123,
    };
    expect(evtRegistry).toHaveProperty('handlers');
    deregCb1 = evtRegistry.register((data) => {
      evtCbMock(data);
    });
    evtRegistry.register((data) => {
      evtCbMock(data);
    });
    deregCb1();
    evtRegistry.trigger(evtDataMock);
    expect(((evtRegistry as unknown) as any).handlers).toHaveLength(1);
    expect(evtCbMock).toHaveBeenCalledTimes(1);
  });

  it('tests async register()', () => {
    let evtRegistry: EventRegistry;
    let evtDataMock: any;
    let triggerPromise: Promise<void>;

    evtRegistry = new EventRegistry();
    evtDataMock = {
      abc: 123,
    };
    evtCbAsyncMock.mockResolvedValueOnce(undefined);

    evtRegistry.register(async (data) => {
      await evtCbAsyncMock(data);
    });
    triggerPromise = evtRegistry.trigger(evtDataMock);
    expect(triggerPromise).resolves;
  });
  it('tests async register() (non-singleton)', async () => {
    let evtRegistry: EventRegistry;
    let evtDataMock: any;

    evtRegistry = new EventRegistry(false);
    evtDataMock = {
      abc: 123,
    };
    evtCbAsyncMock.mockResolvedValue(undefined);

    evtRegistry.register(async (data) => {
      await evtCbAsyncMock(data);
    });
    evtRegistry.register(async (data) => {
      await evtCbAsyncMock(data);
    });
    await evtRegistry.trigger(evtDataMock);
    expect(evtCbAsyncMock).toHaveBeenCalledTimes(2);
  });

});
