/* @flow */

import type { CursorR, Word } from "../common";

import { get } from "@capnp-js/bytes";

/* Get the word at the `unpacked` cursor's location without touching the 
   cursor's position. */
export default function peekWord(unpacked: CursorR): Word {
  let i = unpacked.i;
  return [
    get(i++, unpacked.buffer),
    get(i++, unpacked.buffer),
    get(i++, unpacked.buffer),
    get(i++, unpacked.buffer),
    get(i++, unpacked.buffer),
    get(i++, unpacked.buffer),
    get(i++, unpacked.buffer),
    get(i++, unpacked.buffer),
  ];
}
