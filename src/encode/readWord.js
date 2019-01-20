/* @flow */

import type { Cursor, Word } from "../common";

/* Get the word at the `unpacked` cursor's location, and advance the cursor's
   position to the following word. */
export default function readWord(unpacked: Cursor): Word {
  return [
    unpacked.buffer[unpacked.i++],
    unpacked.buffer[unpacked.i++],
    unpacked.buffer[unpacked.i++],
    unpacked.buffer[unpacked.i++],
    unpacked.buffer[unpacked.i++],
    unpacked.buffer[unpacked.i++],
    unpacked.buffer[unpacked.i++],
    unpacked.buffer[unpacked.i++],
  ];
}
