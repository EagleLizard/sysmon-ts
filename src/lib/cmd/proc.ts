
import child_process, { ChildProcess } from 'child_process';
import { logger } from '../logger';

export type SpawnProcOpts = {
  args?: string[];
  onData?: (data: Buffer) => void;
  onErrorData?: (data: Buffer) => void;
};

export type SpawnProcResult = {
  proc: ChildProcess;
  promise: Promise<string>;
};

export function spawnProc(cmd: string, args?: string[], opts?: SpawnProcOpts): SpawnProcResult {
  let proc: ChildProcess;
  let procPromise: Promise<string>;
  let procRes: SpawnProcResult;
  let resStr: string;

  resStr = '';

  proc = child_process.spawn(cmd, args);

  procPromise = new Promise((resolve, reject) => {
    proc.on('close', () => {
      resolve(resStr);
    });
    proc.on('error', reject);
  });

  proc.stdout?.on('data', (data) => {
    if(opts?.onData === undefined) {
      resStr += data;
    } else {
      opts.onData(data);
    }
  });
  proc.stderr?.on('data', (data) => {
    if(opts?.onErrorData === undefined) {
      logger.error(`${data}`);
    } else {
      opts.onErrorData(data);
    }
  });

  procRes = {
    proc,
    promise: procPromise,
  };

  return procRes;
}
