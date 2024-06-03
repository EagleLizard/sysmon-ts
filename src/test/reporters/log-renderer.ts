
import readline, { moveCursor } from 'readline';
import { Writable } from 'stream';
import { Vitest } from 'vitest';

type LogRendererOpts = {
  maxLines: number;
};

// const ESC = '\x1B[';
// const CURSOR_TO_START = `${ESC}1;1H`;
// const CLEAR_SCREEN = '\x1Bc';

export class LogRenderer {
  maxLines: number;
  outputStream: NodeJS.WritableStream | Writable;
  errorStream: NodeJS.WritableStream | Writable;

  private currLinesLogged: number = 0;

  private constructor(
    public logger: Vitest['logger'],
    opts: LogRendererOpts,
  ) {
    this.maxLines = opts.maxLines;
    this.outputStream = logger.outputStream;
    this.errorStream = logger.errorStream;
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
    if(this.currLinesLogged < 1) {
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

  private logLine(line: string) {
    this.currLinesLogged++;
    console.log(line);
  }

  private errorLine(line: string) {
    this.logger.error(line);
  }

  static init(logger: Vitest['logger'], opts: LogRendererOpts): LogRenderer {
    let logRenderer: LogRenderer;
    logRenderer = new LogRenderer(logger, opts);
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
