/* @flow */

import type { CursorR, Word } from "../common";

import { get } from "@capnp-js/bytes";

/* Get the word at the `unpacked` cursor's location, and advance the cursor's
   position to the following word. */
export default function readWord(unpacked: CursorR): Word {
  return [
    get(unpacked.i++, unpacked.buffer),
    get(unpacked.i++, unpacked.buffer),
    get(unpacked.i++, unpacked.buffer),
    get(unpacked.i++, unpacked.buffer),
    get(unpacked.i++, unpacked.buffer),
    get(unpacked.i++, unpacked.buffer),
    get(unpacked.i++, unpacked.buffer),
    get(unpacked.i++, unpacked.buffer),
  ];
}
