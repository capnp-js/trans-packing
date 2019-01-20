/* @flow */

export type UnpackedBuffer = Uint8Array;
export type PackedBuffer = Uint8Array;

type u8 = number;
type uint = number;

export type Word = [ u8, u8, u8, u8,   u8, u8, u8, u8 ];
export type Cursor = {
  buffer: Uint8Array,
  i: uint,
  ...,
};

export const EMPTY = new Uint8Array(0);
export const ZERO = 0x00;
export const VERBATIM = 0xff;

/* Lookup table for the number of non-zero bits in a byte. */
export const bitCount = new Uint8Array([
  0,1,1,2, 1,2,2,3,   1,2,2,3, 2,3,3,4,   1,2,2,3, 2,3,3,4,   2,3,3,4, 3,4,4,5, // eslint-disable-line comma-spacing
  1,2,2,3, 2,3,3,4,   2,3,3,4, 3,4,4,5,   2,3,3,4, 3,4,4,5,   3,4,4,5, 4,5,5,6, // eslint-disable-line comma-spacing
  1,2,2,3, 2,3,3,4,   2,3,3,4, 3,4,4,5,   2,3,3,4, 3,4,4,5,   3,4,4,5, 4,5,5,6, // eslint-disable-line comma-spacing
  2,3,3,4, 3,4,4,5,   3,4,4,5, 4,5,5,6,   3,4,4,5, 4,5,5,6,   4,5,5,6, 5,6,6,7, // eslint-disable-line comma-spacing
  1,2,2,3, 2,3,3,4,   2,3,3,4, 3,4,4,5,   2,3,3,4, 3,4,4,5,   3,4,4,5, 4,5,5,6, // eslint-disable-line comma-spacing
  2,3,3,4, 3,4,4,5,   3,4,4,5, 4,5,5,6,   3,4,4,5, 4,5,5,6,   4,5,5,6, 5,6,6,7, // eslint-disable-line comma-spacing
  2,3,3,4, 3,4,4,5,   3,4,4,5, 4,5,5,6,   3,4,4,5, 4,5,5,6,   4,5,5,6, 5,6,6,7, // eslint-disable-line comma-spacing
  3,4,4,5, 4,5,5,6,   4,5,5,6, 5,6,6,7,   4,5,5,6, 5,6,6,7,   5,6,6,7, 6,7,7,8, // eslint-disable-line comma-spacing
]);

// #if _DEBUG
export function debugPacked(packed: Cursor): string {
  return `${packed.i} of ${packed.buffer.length} packed`;
}

export function debugUnpacked(unpacked: Cursor): string {
  return `${unpacked.i} of ${unpacked.buffer.length} unpacked`;
}
// #endif
