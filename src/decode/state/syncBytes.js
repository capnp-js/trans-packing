/* @flow */

import type { Start, VerbatimRange } from "./main";

import { bitCount, ZERO, VERBATIM } from "../../common";

import { START } from "./main";

type u8 = number;

/* Compute the minimum number of packed bytes that will unpack to a word. */
export default function syncBytes(state: Start | VerbatimRange, packed: u8): u8 {
  switch (state.type) {
  case START: {
    const tag = packed;
    let bytes = 1 + bitCount[tag];
    if (tag === ZERO) {
      return bytes + 1;
    } else if (tag === VERBATIM) {
      return bytes + 1;
    } else {
      return bytes;
    }
  }
  default:
    (state: VerbatimRange);
    return 8;
  }
}
