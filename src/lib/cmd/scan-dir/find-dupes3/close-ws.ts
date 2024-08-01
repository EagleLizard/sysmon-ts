import { WriteStream } from 'fs';

export function _closeWs(ws: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.close(err => {
      if(err) {
        return reject(err);
      }
      resolve();
    });
  });
}
