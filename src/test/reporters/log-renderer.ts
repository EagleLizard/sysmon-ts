
import readline from 'readline';
import { Writable } from 'stream';
import { Vitest } from 'vitest';
import { ErrorFmtUtil } from './error-fmt-util';

type LogRendererOpts = {
  maxLines: number;
  clearScreen?: boolean;
  doClear?: boolean;
};

// const ESC = '\x1B[';
// const CURSOR_TO_START = `${ESC}1;1H`;
// const CLEAR_SCREEN = '\x1Bc';

export class LogRenderer {
  maxLines: number;

  doClearScreen: boolean;
  doClear: boolean;

  private currLinesLogged: number = 0;

  private constructor(
    private ctx: Vitest,
    opts: LogRendererOpts,
  ) {

    this.maxLines = opts.maxLines;
    this.doClearScreen = opts.clearScreen ?? true;
    this.doClear = opts.doClear ?? true;

    const _clearHighlightCach = this.ctx.logger.clearHighlightCache;
    this.ctx.logger.clearHighlightCache = (filename?: string | undefined) => {
      ErrorFmtUtil.clearHighlightCache();
      _clearHighlightCach.bind(this.ctx.logger)(filename);
    };
  }

  public get outputStream(): NodeJS.WritableStream | Writable {
    return this.ctx.logger.outputStream;
  }
  public get errorStream(): NodeJS.WritableStream | Writable {
    return this.ctx.logger.errorStream;
  }

  log(msg?: string) {
    let lines: string[];
    lines = getLogLines(msg);
    for(let i = 0; i < lines.length; ++i) {
      this.logLine(lines[i]);
    }
  }

  error(msg?: string) {
    let lines: string[];
    lines = getLogLines(msg);
    for(let i = 0; i < lines.length; ++i) {
      this.errorLine(lines[i]);
    }
  }

  clear() {
    // console.log('this.currLinesLogged');
    // console.log(this.currLinesLogged);
    // console.log(this.currLinesLogged);
    if(!this.doClear || this.currLinesLogged < 1) {
      return;
    }
    // readline.cursorTo(process.stdout, 0);
    for(let i = 0; i < this.currLinesLogged; ++i) {
      // let y = i === 0 ? null : -1;
      readline.clearLine(process.stdout, 0);
      readline.moveCursor(process.stdout, 0, -1);
    }
    this.currLinesLogged = 0;
  }
  clearScreen(msg = '') {
    if(this.doClearScreen) {
      this.ctx.logger.clearScreen(msg);
    }
  }
  clearFullScreen(msg = '') {
    if(this.doClearScreen) {
      this.ctx.logger.clearFullScreen(msg);
    }
  }

  private logLine(line: string) {
    this.currLinesLogged++;
    console.log(line);
  }

  private errorLine(line: string) {
    this.ctx.logger.error(line);
  }

  static init(ctx: Vitest, opts: LogRendererOpts): LogRenderer {
    let logRenderer: LogRenderer;
    logRenderer = new LogRenderer(ctx, opts);
    return logRenderer;
  }
}

function getLogLines(msg?: string): string[] {
  let lines: string[];
  lines = msg?.includes('\n')
    ? msg.split('\n')
    : [ msg ?? '' ]
  ;
  return lines;
}
