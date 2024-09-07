
import { describe, it, expect, beforeEach, vi, Mock } from 'vitest';
import { ReadFileByLineOpts } from '../../util/files';
import { TNineService } from './t-nine-service';
import { Deferred } from '../../../test/deferred';

const fsMocks = vi.hoisted(() => {
  return {
    createReadStream: vi.fn(),
  };
});

const readlineMocks = vi.hoisted(() => {
  return {
    createInterface: vi.fn(),
  };
});

const filesMocks = vi.hoisted(() => {
  return {
    readFileByLine: vi.fn(),
  };
});

vi.mock('fs', () => {
  return {
    createReadStream: fsMocks.createReadStream,
  };
});

vi.mock('readline', () => {
  return {
    default: {
      createInterface: readlineMocks.createInterface,
    },
  };
});

vi.mock('../../util/files', () => {
  return {
    readFileByLine: filesMocks.readFileByLine,
  };
});

describe('t-nine-service tests', () => {
  beforeEach(() => {
    fsMocks.createReadStream.mockReset();
    readlineMocks.createInterface.mockReset();
    filesMocks.readFileByLine.mockReset();
  });

  it('tests loadWords()', async () => {
    let lineCb: ReadFileByLineOpts['lineCb'] | undefined;
    let resumeCb: () => void;
    let loadWordsPromise: Promise<string[]>;
    let deferred: Deferred<void>;
    let testWords: string[];
    let expectedWords: string[];
    let words: string[];
    deferred = Deferred.init();
    testWords = [
      'one',
      '',
      'two',
      'three',
    ];
    expectedWords = testWords.filter(testWord => testWord.length > 0);
    filesMocks.readFileByLine.mockImplementation((filePath: string, opts: ReadFileByLineOpts) => {
      lineCb = opts.lineCb;
      return deferred.promise;
    });
    loadWordsPromise = TNineService.loadWords();
    resumeCb = () => {
      // noop
    };

    if(lineCb === undefined) {
      throw new Error('lineCb is undefined');
    }
    for(let i = 0; i < testWords.length; ++i) {
      lineCb(testWords[i], resumeCb);
    }
    deferred.resolve();
    words = await loadWordsPromise;
    expect(words).toEqual(expectedWords);
  });

  it('tests getFrequencyMap()', async () => {
    let testWords: string[];
    let testWordTuples: [string, number][];
    let freqMapPromise: Promise<Map<string, number>>;
    let freqMap: Map<string, number>;
    let rlOnMock: Mock;
    let rejecter: (() => void) | undefined;
    let resolver: (() => void) | undefined;
    let lineCb: ((str: string) => void) | undefined;
    testWords = [
      'the',
      'of',
      'and',
    ];
    rlOnMock = vi.fn();
    readlineMocks.createInterface.mockReturnValueOnce({
      on: rlOnMock.mockImplementation((evt: string, fn: () => void) => {
        switch(evt) {
          case 'error':
            rejecter = fn;
            break;
          case 'close':
            resolver = fn;
            break;
          case 'line':
            lineCb = fn;
            break;
          default:
            throw new Error(`Unexpected rl.on() event: ${evt}`);
        }
      }),
    });
    testWordTuples = [];
    for(let i = 0; i < testWords.length; ++i) {
      let testWordTuple: [ string, number ];
      testWordTuple = [ testWords[i], i + 1 ];
      testWordTuples.push(testWordTuple);
    }
    freqMapPromise = TNineService.getFrequencyMap(testWords);
    if(lineCb === undefined) {
      throw new Error('lineCb is undefined');
    }
    if(rejecter === undefined) {
      throw new Error('rejecter is undefined');
    }
    if(resolver === undefined) {
      throw new Error('resolver is undefined');
    }
    for(let i = 0; i < testWordTuples.length; ++i) {
      lineCb(testWordTuples[i].join(' '));
    }
    resolver();

    freqMap = await freqMapPromise;
    expect([ ...freqMap.entries() ]).toEqual(testWordTuples);
  });
});
