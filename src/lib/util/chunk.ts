
export function chunk<T>(arr: T[], chunkSize: number): T[][] {
  let chunks: T[][];
  let currChunk: T[];
  chunks = [];
  currChunk = [];
  for(let i = 0; i < arr.length; ++i) {
    if(currChunk.length >= chunkSize) {
      chunks.push(currChunk);
      currChunk = [];
    }
    currChunk.push(arr[i]);
  }
  if(currChunk.length > 0) {
    chunks.push(currChunk);
  }
  return chunks;
}
