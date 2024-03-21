/*
Keymapping:
  1 2 3
  4 5 6
  7 8 9
    0
  1: .!?:;@-_
  2: abc
  3: def
  4: ghi
  5: jkl
  6: mno
  7: pqrs
  8: tuv
  9: wxyz
  0: <space>
Mapped:
  q w e
  a s d
  z x c
    _
*/

export enum NUM_KEY_ENUM {
  ONE = 'ONE',
  TWO = 'TWO',
  THREE = 'THREE',
  FOUR = 'FOUR',
  FIVE = 'FIVE',
  SIX = 'SIX',
  SEVEN = 'SEVEN',
  EIGHT = 'EIGHT',
  NINE = 'NINE',
  ZERO = 'ZERO',
}

export const KEY_MAPPINGS: [ NUM_KEY_ENUM, number, string, string ][] = [
  [ NUM_KEY_ENUM.ONE, 1, 'q',  '@' ],
  [ NUM_KEY_ENUM.TWO, 2, 'w', 'abc' ],
  [ NUM_KEY_ENUM.THREE, 3, 'e', 'def' ],
  [ NUM_KEY_ENUM.FOUR, 4, 'a', 'ghi' ],
  [ NUM_KEY_ENUM.FIVE, 5, 's', 'jkl' ],
  [ NUM_KEY_ENUM.SIX, 6, 'd', 'mno' ],
  [ NUM_KEY_ENUM.SEVEN, 7, 'z', 'pqrs' ],
  [ NUM_KEY_ENUM.EIGHT, 8, 'x', 'tuv' ],
  [ NUM_KEY_ENUM.NINE, 9, 'c', 'wxyz' ],
  [ NUM_KEY_ENUM.ZERO, 0, ' ',  ' ' ],
];

export const NUM_KEY_CHAR_MAP: Record<NUM_KEY_ENUM, string> = KEY_MAPPINGS.reduce((acc, curr) => {
  acc[curr[0]] = curr[3];
  return acc;
}, {} as Record<NUM_KEY_ENUM, string>);

export const LETTER_TO_DIGIT_MAP: Record<string, string> = KEY_MAPPINGS.reduce((acc, curr) => {
  let chars: string[];
  chars = curr[3].split('');
  chars.forEach(char => {
    acc[char] = `${curr[1]}`;
  });
  return acc;
}, {} as Record<string, string>);

// export const NUM_KEY_CHAR_MAP: Record<NUM_KEY_ENUM, string> = {
//   [NUM_KEY_ENUM.ONE]: '@',
//   [NUM_KEY_ENUM.TWO]: 'abc',
//   [NUM_KEY_ENUM.THREE]: 'def',
//   [NUM_KEY_ENUM.FOUR]: 'ghi',
//   [NUM_KEY_ENUM.FIVE]: 'jkl',
//   [NUM_KEY_ENUM.SIX]: 'mno',
//   [NUM_KEY_ENUM.SEVEN]: 'pqrs',
//   [NUM_KEY_ENUM.EIGHT]: 'tuv',
//   [NUM_KEY_ENUM.NINE]: 'wxyz',
//   [NUM_KEY_ENUM.ZERO]: ' ',
// };
