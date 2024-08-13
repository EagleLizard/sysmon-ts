
const UNICODE_BITMASK_MAP = [
  [ 0x01, 0x8 ],
  [ 0x02, 0x10 ],
  [ 0x4, 0x20 ],
  [ 0x40, 0x80 ],
];

export class BrailleCanvas {
  width: number;
  height: number;
  charMatrix: number[][]; // accessed like charMatrix[y][x]
  constructor(width: number, height: number) {
    if(
      (width < 1)
      || ((width % 2) !== 0)
    ) {
      throw new Error(`Canvas width must be greater than 0 and divisible by 2, received: ${width}`);
    }
    if(
      (height < 1)
      || ((height % 4) !== 0)
    ) {
      throw new Error('Canvas height must be greater than 0 and divisible by 4');
    }
    this.width = width;
    this.height = height;
    this.charMatrix = Array(this.height / 4).fill(0).map(() => {
      return Array(this.width / 2).fill(0).map(() => 0);
    });
  }

  set(x: number, y: number) {
    let charX: number, charY: number;
    let pixelX: number, pixelY: number;
    let currChar: number;
    if(
      (x < 0)
      || (x >= this.width)
      || (y < 0)
      || (y >= this.height)
    ) {
      return;
    }
    x = Math.floor(x);
    y = Math.floor(y);
    charX = Math.floor(x / 2);
    charY = Math.floor(y / 4);
    pixelX = x % 2;
    pixelY = y % 4;
    currChar = this.charMatrix[charY][charX];
    currChar = currChar | UNICODE_BITMASK_MAP[pixelY][pixelX];
    this.charMatrix[charY][charX] = currChar;
  }

  unset(x: number, y: number) {
    let charX: number, charY: number;
    let pixelX: number, pixelY: number;
    let currChar: number;
    if(
      (x < 0)
      || (x >= this.width)
      || (y < 0)
      || (y >= this.height)
    ) {
      return;
    }
    x = Math.floor(x);
    y = Math.floor(y);
    charX = Math.floor(x / 2);
    charY = Math.floor(y / 4);
    pixelX = x % 2;
    pixelY = y % 4;
    currChar = this.charMatrix[charY][charX];
    currChar = currChar & ~UNICODE_BITMASK_MAP[pixelY][pixelX];
    this.charMatrix[charY][charX] = currChar;
  }

  clear() {
    for(let y = 0; y < this.charMatrix.length; ++y) {
      let currRow: number[];
      currRow = this.charMatrix[y];
      for(let x = 0; x < currRow.length; ++x) {
        currRow[x] = 0;
      }
    }
  }

  getStrMatrix(): string[][] {
    return this.charMatrix.map((row, y) => {
      return row.map((charInt, x) => {
        let unicodeIntVal: number;
        unicodeIntVal = 0x2800 + charInt;
        return String.fromCharCode(unicodeIntVal);
      });
    });
  }
}
