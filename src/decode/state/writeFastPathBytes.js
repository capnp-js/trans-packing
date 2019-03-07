/* @flow */

import type { CursorR, CursorB } from "../../common";

import type { State, VerbatimRange } from "./main";

import { getSubarray, setSubarray, get, set } from "@capnp-js/bytes";

import { ZERO, VERBATIM } from "../../common";

import writeZeroRange from "./writeZeroRange";
// #if _DEBUG
import { debugState } from "./main";
// #endif
import { START_STATE, START, ZERO_RANGE, VERBATIM_RANGE } from "./main";

/* Given 10 packed bytes, efficiently output a bunch of unpacked words. */
export default function writeFastPathBytes(state: State, packed: CursorR, unpacked: CursorB): State {
  let nextState = state;
  switch (state.type) {
  case START: {
    const tag = get(packed.i++, packed.buffer);

    /* Pick the nonzero bytes from the `packed` buffer and fill zeros as needed.
    */
    set(0x01 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 1
    set(0x02 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 2
    set(0x04 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 3
    set(0x08 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 4
    set(0x10 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 5
    set(0x20 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 6
    set(0x40 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 7
    set(0x80 & tag ? get(packed.i++, packed.buffer) : 0x00, unpacked.i++, unpacked.buffer); // 8

    if (tag === ZERO) {
      const byteCountdown = get(packed.i++, packed.buffer) << 3;
      if (byteCountdown > 0) {
        /* TODO: I introduced `nextState` because I expect a higher likelihood
           of inlining if my function has one exit point. Revert to the prettier
           version if there's no performance penalty. */
        nextState = {
          type: ZERO_RANGE,
          byteCountdown,
        };
        // #if _DEBUG
        console.log(`transitioned to ${debugState(nextState)}`);
        // #endif
      } /* Otherwise `nextState` remains START_STATE. */
    } else if (tag === VERBATIM) {
      const byteCountdown = get(packed.i++, packed.buffer) << 3;
      if (byteCountdown > 0) {
        nextState = {
          type: VERBATIM_RANGE,
          byteCountdown,
        };
        // #if _DEBUG
        console.log(`transitioned to ${debugState(nextState)}`);
        // #endif
      } /* Otherwise `nextState` remains START_STATE. */
    }

    /* If neither `tag === ZERO` nor `tag === VERBATIM`, then `nextState`
       remains START_STATE. */
    break;
  }
  case ZERO_RANGE:
    nextState = writeZeroRange(state, unpacked);
    break;
  default: {
    (state: VerbatimRange);
    const remainingBytes = packed.buffer.length - packed.i;
    const availableBytes = unpacked.buffer.length - unpacked.i;
    const byteCountdown = state.byteCountdown;
    if (byteCountdown <= remainingBytes) {
      if (byteCountdown <= availableBytes) {
        /* Everything fits. I get to continue with my fast path. */
        setSubarray(
          getSubarray(packed.i, packed.i + byteCountdown, packed.buffer),
          unpacked.i,
          unpacked.buffer,
        );
        packed.i += byteCountdown;
        unpacked.i += byteCountdown;
        nextState = START_STATE;
      } else {
        /* I ran out of space on the `unpacked` buffer. */
        setSubarray(
          getSubarray(packed.i, packed.i + availableBytes, packed.buffer),
          unpacked.i,
          unpacked.buffer,
        );
        packed.i += availableBytes;
        unpacked.i = unpacked.buffer.length;
        nextState = {
          type: VERBATIM_RANGE,
          byteCountdown: byteCountdown - availableBytes,
        };
      }
    } else {
      /* The verbatim range reaches the end of my `packed` buffer. */
      if (remainingBytes < availableBytes) {
        /* I can't write all of the remaining bytes from the `packed` buffer to
           the `unpacked` buffer because the end of `packed` may not map to a
           word boundary in the `unpacked` buffer. Instead I stop at a known
           word boundary.

           Since `packed.i` is currently at a word boundary and the verbatim
           range reaches the end of the `packed` buffer, I can just round
           `remainingBytes` down to the nearest multiple of 8 to get end-of-
           word-aligned-bytes for the `packed` buffer. */
        const remainingWordBytes = remainingBytes - (remainingBytes % 8);
        setSubarray(
          getSubarray(packed.i, packed.i + remainingWordBytes, packed.buffer),
          unpacked.i,
          unpacked.buffer,
        );
        packed.i += remainingWordBytes;
        unpacked.i += remainingWordBytes;
        nextState = {
          type: VERBATIM_RANGE,
          byteCountdown: byteCountdown - remainingWordBytes,
        };
      } else {
        /* The `packed` buffer has more verbatim range bytes than the `unpacked`
           buffer can hold, so I write what I can to the `unpacked` buffer and
           leave the remaining `packed` bytes for later. */
        setSubarray(
          getSubarray(packed.i, packed.i + availableBytes, packed.buffer),
          unpacked.i,
          unpacked.buffer,
        );
        packed.i += availableBytes;
        unpacked.i = unpacked.buffer.length;
        nextState = {
          type: VERBATIM_RANGE,
          byteCountdown: byteCountdown - availableBytes,
        };
      }
    }
  }
  }

  return nextState;
}
