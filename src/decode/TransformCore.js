/* @flow */

import type { BytesR, BytesB } from "@capnp-js/bytes";
import type { SugarlessIteratorResult } from "@capnp-js/transform";

import type { CursorR, CursorB } from "../common";

import type { State } from "./state/main";

import { getSubarray } from "@capnp-js/bytes";

// #if _DEBUG
import { debugPacked, debugUnpacked } from "../common";
import { debugState } from "./state/main";
// #endif
import { EMPTY } from "../common";

import {
  DECODE_BUFFER_WORD_ALIGNMENT_ERROR,
  DECODE_MIN_BUFFER_SIZE,
  DECODE_BUFFER_SIZE_ERROR,
} from "./constant";

import Remainder from "./state/Remainder";
import writeFastPathBytes from "./state/writeFastPathBytes";
import { START_STATE } from "./state/main";

/* The TransformCore class provides processing for Cap'n Proto packed bytes
   under synchronous and asynchronous use cases. After instantiation a user
   typically calls `set` to prescribe a chunk of packed bytes for processing.
   Then each call on the instance's `next` batches some unpacked bytes onto the
   instance's buffer, where the returned iterator result contains that call's
   unpacked bytes (`{ done: true }` indicates that the `set` packed bytes have
   all been processed). Once the instance's `next` calls reach end with
   `{ done: true }`, then a user continues by (1) iterating `flush` until any
   remaining packed bytes have been processed or (2) `set`ting another
   chunk of packed bytes for processing. */
export default class TransformCore {
  +buffer: BytesB;
  +remainder: Remainder;
  packed: CursorR;
  state: State;

  constructor(buffer: BytesB) {
    if (buffer.length < DECODE_MIN_BUFFER_SIZE) {
      throw new Error(DECODE_BUFFER_SIZE_ERROR);
    }

    if (buffer.length % 8) {
      throw new Error(DECODE_BUFFER_WORD_ALIGNMENT_ERROR);
    }

    this.buffer = buffer;

    /* The `packed` cursor persists across `next` calls. */
    this.packed = {
      buffer: EMPTY,
      i: 0,
    };

    /* Track extra packed bytes from prior iterations. */
    this.remainder = new Remainder();

    this.state = START_STATE;
  }

  /* Iterating `next` draws from this source of packed bytes. Once iteration
     returns null, users can reuse the `packed` buffer without corrupting the
     core instance's processing. */
  set(packed: BytesR): void {
    this.packed = {
      buffer: packed,
      i: 0,
    };
  }

  /* Process as many convenient packed bytes into `this.buffer` as possible and
     return the resulting subarray as an iterator value. When all of the packed
     bytes have been exhausted, then return null. */
  next(): BytesR | null {
    /* Iteration ends when the `packed` buffer has been exhausted. */
    if (this.packed.i === this.packed.buffer.length) {
      return null;
    }

    // #if _DEBUG
    console.log("\n***** next() beginning *****");
    // #endif

    /* I overwrite the prior iteration's unpacked data by taking the `unpacked`
       cursor's position as 0. Consumers should beware of iterating without
       first consuming (or cloning) the prior iteration's data. */
    const unpacked: CursorB = {
      buffer: this.buffer,
      i: 0,
    };

    while(!this.remainder.isSynced()) {
      // #if _DEBUG
      {
        const remainderS = `${this.remainder.end} remainder bytes`;
        const packedS = debugPacked(this.packed);
        const unpackedS = debugUnpacked(unpacked);
        console.log(`synchronizing: ${remainderS}, ${packedS}, ${unpackedS}`);
      }
      // #endif

      const nextState = this.remainder.sync(this.state, this.packed, unpacked);
      if (nextState === null) {
        /* I've exhausted the packed buffer without synchronizing. The `packed`
           cursor has moved to the end so the following `next` call will early
           exit with null. */
        return getSubarray(0, unpacked.i, unpacked.buffer);
      } else {
        /* I've found some word aligned output. */
        this.state = nextState;
      }

      if (unpacked.i === unpacked.buffer.length) {
        /* The remainder didn't fit on the `unpacked` buffer. The remainder
           0x00 0xff 0x00 0xff 0x00 0xff 0x00 0xff, for instance, translates to
           8192 bytes. */
        return unpacked.buffer;
      }
    }

    /* I exit the fast path (1) when I've advanced across the `packed` buffer to
       fewer than 10 bytes from its end or (2) when my `unpacked` buffer fills
       up. (1) follows from the worst case demand where a verbatim range gets
       entered. To process this case I require 1 byte for its tag, 8 bytes for
       the tag's trailing word, and 1 byte for its word count byte. */
    let remainingBytes = this.packed.buffer.length - this.packed.i;
    while (remainingBytes >= 10 && unpacked.i !== unpacked.buffer.length) {
      // #if _DEBUG
      {
        const packedS = debugPacked(this.packed);
        const unpackedS = debugUnpacked(unpacked);
        console.log(`fast path (${debugState(this.state)}): ${packedS}, ${unpackedS}`);
      }
      // #endif

      this.state = writeFastPathBytes(this.state, this.packed, unpacked);
      remainingBytes = this.packed.buffer.length - this.packed.i;
    }

    // #if _DEBUG
    {
      const packedS = debugPacked(this.packed);
      const unpackedS = debugUnpacked(unpacked);
      console.log(`fast path complete (${debugState(this.state)}): ${packedS}, ${unpackedS}`);
    }
    // #endif

    if (remainingBytes < 10) {
      /* I intern the remaining packed bytes. The next iteration will have
         `this.packed.i === this.packed.buffer.length`, so it will return null.
         At that point, the user can call `set` followed by `next` to process
         the remaining packed bytes or dummy can call `flush` to process the
         remaining packed bytes. */
      this.remainder.intern(this.packed);
    }

    return getSubarray(0, unpacked.i, unpacked.buffer);
  }

  /* After `next` iteration completes, there may still exist remaining packed
     bytes that have been interned by `this.remainder`. Iterating `flush`
     processes these remaining bytes. */
  flush(): SugarlessIteratorResult<BytesR> {
    // #if _DEBUG
    console.log("\n***** flush() beginning *****");
    // #endif

    const unpacked = {
      buffer: this.buffer,
      i: 0,
    };

    while (!this.remainder.isFlushed(this.state)) {
      const flushed = this.remainder.flush(this.state, unpacked);
      if (flushed instanceof Error) {
        return { done: flushed };
      } else {
        (flushed: State);
        this.state = flushed;
      }

      if (unpacked.i === unpacked.buffer.length) {
        return {
          done: false,
          value: getSubarray(0, unpacked.i, unpacked.buffer),
        };
      }
    }

    if (unpacked.i === 0) {
      return { done: true };
    } else {
      return {
        done: false,
        value: getSubarray(0, unpacked.i, unpacked.buffer),
      };
    }
  }
}
