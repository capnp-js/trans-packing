/* @flow */

import type { Cursor, Word } from "../common";

/* Get the word at the `unpacked` cursor's location without touching the 
   cursor's position. */
export default function peekWord(unpacked: Cursor): Word {
  let i = unpacked.i;
  return [
    unpacked.buffer[i++],
    unpacked.buffer[i++],
    unpacked.buffer[i++],
    unpacked.buffer[i++],
    unpacked.buffer[i++],
    unpacked.buffer[i++],
    unpacked.buffer[i++],
    unpacked.buffer[i++],
  ];
}
