
export function getStdDev(vals: number[]) {
  let sum: number;
  let avg: number;
  sum = 0;
  for(let i = 0; i < vals.length; ++i) {
    sum += vals[i];
  }
  avg = sum / vals.length;
  let meanDevs = [];
  for(let i = 0; i < vals.length; ++i) {
    meanDevs.push(Math.pow((vals[i] - avg), 2));
  }
  let meanDevSum = 0;
  for(let i = 0; i < meanDevs.length; ++i) {
    meanDevSum += meanDevs[i];
  }
  let variance = meanDevSum / meanDevs.length;
  return Math.sqrt(variance);
}
