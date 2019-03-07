/* @flow */

import type { CursorB } from "../../common";

import type { Start, ZeroRange } from "./main";

import { fill } from "@capnp-js/bytes";

import { START_STATE, ZERO_RANGE } from "./main";

/* Write a zero range. If the `unpacked` buffer contains insufficient space for
   the whole range, then I fill the available space and return a ZeroRange state
   with its `byteCountdown` decremented to number of zero words remaining in the
   zero range. */
export default function writeZeroRange(state: ZeroRange, unpacked: CursorB): Start | ZeroRange {
  const byteCountdown = state.byteCountdown;
  const availableBytes = unpacked.buffer.length - unpacked.i;
  let nextState = state;
  if (byteCountdown <= availableBytes) {
    /* All of the zeros fit. I get to return to the Start state. */
    fill(0x00, unpacked.i, unpacked.i + byteCountdown, unpacked.buffer);
    unpacked.i += byteCountdown;
    nextState = START_STATE;
  } else {
    /* I've run out of space on the `unpacked` buffer. Write what I can and
       remain in the ZeroRange state. */
    fill(0x00, unpacked.i, unpacked.buffer.length, unpacked.buffer);
    unpacked.i = unpacked.buffer.length;
    nextState = {
      type: ZERO_RANGE,
      byteCountdown: byteCountdown - availableBytes,
    };
  }

  return nextState;
}
