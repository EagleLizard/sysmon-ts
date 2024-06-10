
import { describe, it, expect, beforeEach, Vitest, vi, Mock } from 'vitest';
import { LogRenderer } from './log-renderer';

const readlineMocks = vi.hoisted(() => {
  return {
    clearLine: vi.fn(),
    moveCursor: vi.fn(),
  };
});
const errorFmtUtilMocks = vi.hoisted(() => {
  return {
    clearHighlightCache: vi.fn(),
  };
});

vi.mock('readline', () => {
  return {
    default: {
      clearLine: readlineMocks.clearLine,
      moveCursor: readlineMocks.moveCursor,
    },
  };
});

vi.mock('./error-fmt-util', () => {
  return {
    ErrorFmtUtil: {
      clearHighlightCache: errorFmtUtilMocks.clearHighlightCache,
    },
  };
});

describe('log-renderer tests', () => {
  let ctxMock: {
    logger: {
      clearHighlightCache: Mock;
      error: Mock;
      clearScreen: Mock;
      clearFullScreen: Mock;
    };
  };
  let errorFnMock: Mock;
  let clearScreenMock: Mock;
  let clearFullScreenMock: Mock;
  let clearHighlightCacheMock: Mock;
  let logFnMock: Mock;
  let logRenderer: LogRenderer;

  beforeEach(() => {
    errorFnMock = vi.fn();
    clearHighlightCacheMock = vi.fn();
    clearScreenMock = vi.fn();
    clearFullScreenMock = vi.fn();
    ctxMock = {
      logger: {
        clearHighlightCache: clearHighlightCacheMock,
        error: errorFnMock,
        clearScreen: clearScreenMock,
        clearFullScreen: clearFullScreenMock,
      }
    };
    logFnMock = vi.fn();
    logRenderer = LogRenderer.init((ctxMock as unknown) as Vitest, {
      logFn: logFnMock,
      maxLines: 20,
    });

    readlineMocks.clearLine.mockReset();
    readlineMocks.moveCursor.mockReset();

    errorFmtUtilMocks.clearHighlightCache.mockReset();
  });

  it('tests LogRenderer.log()', () => {
    let logStr: string;
    logStr = 'mock_log_str';
    logRenderer.log(logStr);
    expect(logFnMock).toHaveBeenCalledWith(logStr);
  });

  it('tests LogRenderer.log() with multiple lines', () => {
    let logLines: string[];
    let logStr: string;
    logLines = [
      'mock_log_str',
      'mock_log_str_2',
    ];
    logStr = logLines.join('\n');
    logRenderer.log(logStr);
    expect(logFnMock).toHaveBeenCalledTimes(logLines.length);
    for(let i = 0; i < logLines.length; ++i) {
      expect(logFnMock).toHaveBeenCalledWith(logLines[i]);
    }
  });

  it('tests LogRenderer.error()', () => {
    let logStr: string;
    logStr = 'mock_log_str';
    logRenderer.error(logStr);
    expect(errorFnMock).toHaveBeenCalledWith(logStr);
  });

  it('tests LogRenderer.clear()', () => {
    let logLines: string[];
    let logStr: string;
    logLines = [
      'mock_log_str',
      'mock_log_str_2',
    ];
    logStr = logLines.join('\n');
    logRenderer.log(logStr);
    logRenderer.clear();
    expect(readlineMocks.clearLine).toHaveBeenCalledTimes(logLines.length);
    expect(readlineMocks.moveCursor).toHaveBeenCalledTimes(logLines.length);
  });
  it('tests LogRenderer.clear() not called when doClear set to false', () => {
    let logLines: string[];
    let logStr: string;
    logLines = [
      'mock_log_str',
      'mock_log_str_2',
    ];
    logStr = logLines.join('\n');
    logRenderer.doClear = false;
    logRenderer.log(logStr);
    logRenderer.clear();
    expect(readlineMocks.clearLine).not.toHaveBeenCalled();
    expect(readlineMocks.moveCursor).not.toHaveBeenCalled();
  });

  it('tests underlying logger.clearHighlightCache() is called', () => {
    let fileNameMock: string;
    fileNameMock = 'file_name_mock.test.ts';
    ctxMock.logger.clearHighlightCache(fileNameMock);
    expect(errorFmtUtilMocks.clearHighlightCache).toHaveBeenCalledOnce();
    expect(clearHighlightCacheMock).toHaveBeenCalledWith(fileNameMock);
  });

  it('tests clearScreen()', () => {
    let clearScreenMsg: string;
    clearScreenMsg = 'mock_clear_screen';
    logRenderer.clearScreen('');
    logRenderer.clearScreen(clearScreenMsg);
    expect(clearScreenMock).toHaveBeenCalledTimes(2);
    expect(clearScreenMock).toHaveBeenLastCalledWith(clearScreenMsg);
  });
  it('tests clearFullScreen()', () => {
    let clearFullScreenMsg: string;
    clearFullScreenMsg = 'mock_clear_full_screen';
    logRenderer.clearFullScreen('');
    logRenderer.clearFullScreen(clearFullScreenMsg);
    expect(clearFullScreenMock).toHaveBeenCalledTimes(2);
    expect(clearFullScreenMock).toHaveBeenLastCalledWith(clearFullScreenMsg);
  });
});
