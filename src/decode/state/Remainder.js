/* @flow */

import type { Cursor, PackedBuffer } from "../../common";
import type { State, Start, VerbatimRange } from "./main";

import syncBytes from "./syncBytes";
import writeSlowWord from "./writeSlowWord";
import writeZeroRange from "./writeZeroRange";
// #if _DEBUG
import { debugState } from "./main";
import { VERBATIM_RANGE } from "./main";
// #endif
import { START, ZERO_RANGE } from "./main";
import { DECODE_END_STATE_ERROR } from "../constant";

type uint = number;

/* Remainder instances track packed bytes that the fast path cannot handle. The
   intended use is that a Remainder instance `intern`s packed bytes that remain
   after the fast path exits with fewer than 10 remaining packed bytes. Upon
   receiving more packed bytes during a subsequent iteration, Remainder
   instances have a `sync` method that consumes part of the subsequent
   iteration's packed bytes. The `sync` method adds sufficiently many packed
   bytes to the prior iteration's remaining bytes to satisfy the preconditions
   of `writeSlowWord` and then unpacks the remaining bytes. This process
   advances the `packed` cursor to a position from which the fast path can
   resume processing. */
export default class Remainder {
  +buffer: PackedBuffer;
  end: uint; // 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10

  constructor() {
    this.buffer = new Uint8Array(10);
    this.end = 0;
  }

  intern(packed: Cursor): void {
    // #if _DEBUG
    if (this.end !== 0) {
      throw new Error("Remainder's end should be 0 when interning a new remainder.");
    }
    // #endif
    
    while (packed.i < packed.buffer.length) {
      this.buffer[this.end++] = packed.buffer[packed.i++];
    }
  }

  /* Unpack full words within `this.buffer`. After the fast path exits, the
     remaining bytes may contain full words (from the Start state, for instance,
     0x00 followed by 0xff implies 256 words). The `tail` method writes these
     full words. */
  tail(state: Start | VerbatimRange, unpacked: Cursor): State {
    const p = {
      buffer: this.buffer,
      i: 0,
    };

    /* The `writeSlowWord` function advances `p.i` to the preimage of the
       unpacked word's end. After the write, I overwrite the consumed, packed
       bytes with unconsumed packed bytes from later in `this.buffer`. */
    const nextState = writeSlowWord(state, p, unpacked);

    const offset = p.i;
    while (p.i < this.end) {
      this.buffer[p.i - offset] = this.buffer[p.i];
      ++p.i;
    }
    this.end -= offset;

    return nextState;
  }

  /* Iteratively consume remainder bytes and then `packed` buffer bytes. Return
     null if there aren't enough `packed` bytes to continue iterating. The
     `isSynced` method returns true when the remainder has been exhausted by
     `sync` calls. */
  sync(state: State, packed: Cursor, unpacked: Cursor): State | null {
    if (state.type === ZERO_RANGE) {
      return writeZeroRange(state, unpacked);
    } else {
      const syncLength = syncBytes(state, this.buffer[0]);
      if (syncLength < this.end) {
        return this.tail(state, unpacked);
      } else {
        /* My next write requires some packed bytes from the `packed` buffer. */
        const remainingBytes = this.end + (packed.buffer.length - packed.i);
        if (syncLength <= remainingBytes) {
          /* The `packed` buffer contains sufficiently many bytes for
             `writeSlowWord` to finish processing the prior iteration's
             remaining packed bytes. After this write completes, the fast path
             can safely resume processing. */
          while (this.end < syncLength) {
            /* Move bytes from the `packed` buffer to `this.buffer` so that
               `writeSlowWord` can read everything from a single buffer. */
            this.buffer[this.end++] = packed.buffer[packed.i++];
          }

          const p = {
            buffer: this.buffer,
            i: 0,
          };

          state = writeSlowWord(state, p, unpacked);
          this.end = 0;
          return state;
        } else {
          /* The `packed` buffer doesn't contain sufficiently many bytes for
             `writeSlowWord` to process. I append them to my current buffer so
             that I can move the packed cursor to the buffer's end. */
          while(packed.i < packed.buffer.length) {
            this.buffer[this.end++] = packed.buffer[packed.i++];
          }

          return null;
        }
      }
    }
  }

  /* True when there's no remainder. */
  isSynced(): boolean {
    return this.end === 0;
  }

  /* When the last of the packed bytes have been provided by a user, I can no
     longer `sync` the remainder with a next iteration's. I still need to
     process the remaining bytes, however. The `finish` method consumes these
     last packed bytes. */
  flush(state: State, unpacked: Cursor): State | Error {
    if (state.type === ZERO_RANGE) {
      // #if _DEBUG
      console.log("finishing a zero range");
      // #endif

      return writeZeroRange(state, unpacked);
    } else if (this.end > 0) {
      const syncLength = syncBytes(state, this.buffer[0]);
      if (syncLength <= this.end) {
        // #if _DEBUG
        console.log(`[okay] ${debugState(state)}, [0, ${syncLength}) remainder bytes unpack to word aligned bytes`);
        // #endif

        return this.tail(state, unpacked);
      } else {
        // #if _DEBUG
        console.log(`[no good] debugState(state), [0, ${this.end}) remainder bytes do not unpack to word aligned bytes`);
        // #endif

        return new Error(DECODE_END_STATE_ERROR);
      }
    } else {
      /* Since `this.end === 0`, I know that `state.type !== START` because the
         `this.end === 0 && state.type === START` case was handled specifically.
         Since I've already handled `state.type === ZERO_RANGE` too, that leaves
         me with `this.end === 0 && state.type === VERBATIM_RANGE`, an error. */

      // #if _DEBUG
      {
        if (state.type !== VERBATIM_RANGE) {
          throw new Error(`Expected verbatim range state, but found ${state.type} state`);
        }
        console.log(`[no good] ${debugState(state)}, empty remainder`);
      }
      // #endif

      return new Error(DECODE_END_STATE_ERROR);
    }
  }

  isFlushed(state: State): boolean {
    return this.end === 0 && state.type === START;
  }
}
