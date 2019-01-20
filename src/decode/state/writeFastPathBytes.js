/* @flow */

import type { Cursor } from "../../common";

import type { State, VerbatimRange } from "./main";

import { ZERO, VERBATIM } from "../../common";

import writeZeroRange from "./writeZeroRange";
// #if _DEBUG
import { debugState } from "./main";
// #endif
import { START_STATE, START, ZERO_RANGE, VERBATIM_RANGE } from "./main";

/* Given 10 packed bytes, efficiently output a bunch of unpacked words. */
export default function writeFastPathBytes(state: State, packed: Cursor, unpacked: Cursor): State {
  let nextState = state;
  switch (state.type) {
  case START: {
    const tag = packed.buffer[packed.i++];

    /* Pick the nonzero bytes from the `packed` buffer and fill zeros as needed.
    */
    unpacked.buffer[unpacked.i++] = 0x01 & tag ? packed.buffer[packed.i++] : 0x00; // 1
    unpacked.buffer[unpacked.i++] = 0x02 & tag ? packed.buffer[packed.i++] : 0x00; // 2
    unpacked.buffer[unpacked.i++] = 0x04 & tag ? packed.buffer[packed.i++] : 0x00; // 3
    unpacked.buffer[unpacked.i++] = 0x08 & tag ? packed.buffer[packed.i++] : 0x00; // 4
    unpacked.buffer[unpacked.i++] = 0x10 & tag ? packed.buffer[packed.i++] : 0x00; // 5
    unpacked.buffer[unpacked.i++] = 0x20 & tag ? packed.buffer[packed.i++] : 0x00; // 6
    unpacked.buffer[unpacked.i++] = 0x40 & tag ? packed.buffer[packed.i++] : 0x00; // 7
    unpacked.buffer[unpacked.i++] = 0x80 & tag ? packed.buffer[packed.i++] : 0x00; // 8

    if (tag === ZERO) {
      const byteCountdown = packed.buffer[packed.i++] << 3;
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
      const byteCountdown = packed.buffer[packed.i++] << 3;
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
        unpacked.buffer.set(
          packed.buffer.subarray(packed.i, packed.i + byteCountdown),
          unpacked.i,
        );
        packed.i += byteCountdown;
        unpacked.i += byteCountdown;
        nextState = START_STATE;
      } else {
        /* I ran out of space on the `unpacked` buffer. */
        unpacked.buffer.set(
          packed.buffer.subarray(packed.i, packed.i + availableBytes),
          unpacked.i,
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
        unpacked.buffer.set(
          packed.buffer.subarray(packed.i, packed.i + remainingWordBytes),
          unpacked.i,
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
        unpacked.buffer.set(
          packed.buffer.subarray(packed.i, packed.i + availableBytes),
          unpacked.i,
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
