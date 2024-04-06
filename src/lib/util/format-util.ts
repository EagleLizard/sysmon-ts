
const HOURS_IN_MS = 1000 * 60 * 60;
const MINUTES_IN_MS = 1000 * 60;
const SECONDS_IN_MS = 1000;

export function getIntuitiveBytes(bytes: number): [ number, string ] {
  // let sizeVal: number, labelStr: string;
  let bytesTuple: [ number, string ];
  if(bytes > (1024 ** 3)) {
    bytesTuple = [
      bytes / (1024 ** 3),
      'gb',
    ];
  } else if(bytes > (1024 ** 2)) {
    bytesTuple = [
      bytes / (1024 ** 2),
      'mb',
    ];
  } else if(bytes > 1024) {
    bytesTuple = [
      bytes / 1024,
      'kb',
    ];
  } else {
    bytesTuple = [
      bytes,
      'b'
    ];
  }
  return bytesTuple;
}

export function getIntuitiveByteString(ms: number, toFixedVal = 3): string {
  let bytesTuple: [ number, string ];
  bytesTuple = getIntuitiveBytes(ms);
  return `${bytesTuple[0].toFixed(toFixedVal)} ${bytesTuple[1]}`;
}

export function getIntuitiveTime(ms: number): [ number, string ] {
  let timeTuple: [ number, string ];
  if(ms >= HOURS_IN_MS) {
    timeTuple = [
      ms / HOURS_IN_MS,
      'h',
    ];
  } else if(ms >= MINUTES_IN_MS) {
    timeTuple = [
      ms / MINUTES_IN_MS,
      'm',
    ];
  } else if(ms >= SECONDS_IN_MS) {
    timeTuple = [
      ms / SECONDS_IN_MS,
      's',
    ];
  } else if(ms >= 1) {
    timeTuple = [
      ms,
      'ms'
    ];
  } else {
    timeTuple = [
      ms * 1000,
      'µs',
    ];
  }
  return timeTuple;
}

export function getIntuitiveTimeString(ms: number, fixed?: number): string {
  let timeTuple: [ number, string ];
  let fixedPoints: number;
  timeTuple = getIntuitiveTime(ms);
  let includeDecimals = (
    (fixed !== undefined)
    || ((timeTuple[0] % 1) !== 0)
  );
  fixedPoints = fixed ?? 3;
  let timeNum = includeDecimals
    ? timeTuple[0].toFixed(fixedPoints)
    : timeTuple[0]
  ;
  return `${timeNum} ${timeTuple[1]}`;
}
