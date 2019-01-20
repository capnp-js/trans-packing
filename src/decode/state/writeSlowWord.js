/* @flow */

import type { Cursor } from "../../common";

import type { State, Start, VerbatimRange } from "./main";

import { ZERO, VERBATIM } from "../../common";

import {
  START_STATE,
  START,
  ZERO_RANGE,
  VERBATIM_RANGE,
} from "./main";

/* Unpack as many words as efficiently possible. This function cannot perform as
   well as the fast path, but it has weaker preconditions. */
export default function writeSlowWord(state: Start | VerbatimRange, packed: Cursor, unpacked: Cursor): State {
  switch (state.type) {
  case START: {
    const tag = packed.buffer[packed.i++];

    for (let mask=0x01; mask<=0x80; mask<<=1) {
      unpacked.buffer[unpacked.i++] = (tag & mask) ? packed.buffer[packed.i++] : 0x00;
    }

    if (tag === ZERO) {
      /* I've found a ZERO tag, so I compute the zero range's byte count from
         the word count embedded in the packed buffer. */
      return {
        type: ZERO_RANGE,
        byteCountdown: packed.buffer[packed.i++] << 3,
      };
    } else if (tag === VERBATIM) {
      /* I've found a VERBATIM tag, so I compute the verbatim range's byte count
         from the word count embedded in the packed buffer. */
      return {
        type: VERBATIM_RANGE,
        byteCountdown: packed.buffer[packed.i++] << 3,
      };
    } else {
      return START_STATE;
    }
  }
  default: {
    (state: VerbatimRange);

    /* I was already in a verbatim range. Write a single, verbatim word into the
       `unpacked` buffer. */
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 1
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 2
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 3
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 4
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 5
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 6
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 7
    unpacked.buffer[unpacked.i++] = packed.buffer[packed.i++]; // 8

    const byteCountdown = state.byteCountdown - 8;

    if (byteCountdown > 0) {
      return {
        type: VERBATIM_RANGE,
        byteCountdown,
      };
    } else {
      return START_STATE;
    }
  }
  }
}
