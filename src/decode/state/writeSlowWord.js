/* @flow */

import type { CursorR, CursorB } from "../../common";

import type { State, Start, VerbatimRange } from "./main";

import { get, set } from "@capnp-js/bytes";

import { ZERO, VERBATIM } from "../../common";

import {
  START_STATE,
  START,
  ZERO_RANGE,
  VERBATIM_RANGE,
} from "./main";

/* Unpack as many words as efficiently possible. This function cannot perform as
   well as the fast path, but it has weaker preconditions. */
export default function writeSlowWord(state: Start | VerbatimRange, packed: CursorR, unpacked: CursorB): State {
  switch (state.type) {
  case START: {
    const tag = get(packed.i++, packed.buffer);

    for (let mask=0x01; mask<=0x80; mask<<=1) {
      set((tag & mask) ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer);
    }

    if (tag === ZERO) {
      /* I've found a ZERO tag, so I compute the zero range's byte count from
         the word count embedded in the packed buffer. */
      return {
        type: ZERO_RANGE,
        byteCountdown: get(packed.i++, packed.buffer) << 3,
      };
    } else if (tag === VERBATIM) {
      /* I've found a VERBATIM tag, so I compute the verbatim range's byte count
         from the word count embedded in the packed buffer. */
      return {
        type: VERBATIM_RANGE,
        byteCountdown: get(packed.i++, packed.buffer) << 3,
      };
    } else {
      return START_STATE;
    }
  }
  default: {
    (state: VerbatimRange);

    /* I was already in a verbatim range. Write a single, verbatim word into the
       `unpacked` buffer. */
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 1
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 2
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 3
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 4
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 5
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 6
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 7
    set(get(packed.i++, packed.buffer), unpacked.i++, unpacked.buffer); // 8

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
