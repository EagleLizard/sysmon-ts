
export class MathUtil {
  static stddev(vals: number[]): number {
    let stdRes: number;
    let sum: number;
    let avg: number;
    let vSum: number;
    let variance: number;
    sum = 0;
    for(let i = 0; i < vals.length; ++i) {
      sum += vals[i];
    }
    avg = sum / vals.length;
    vSum = 0;
    for(let i = 0; i < vals.length; ++i) {
      vSum += Math.pow(vals[i] - avg, 2);
    }
    variance = vSum / (vals.length - 1);
    // variance = vSum / vals.length;
    stdRes = Math.sqrt(variance);
    return stdRes;
  }
}
