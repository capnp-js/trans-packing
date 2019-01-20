/* @flow */

import type { PackedBuffer, UnpackedBuffer } from "../common";

import type { State } from "./state/main";

// #if _DEBUG
import { debugPacked, debugUnpacked } from "../common";
// #endif

import UnpackingTarget from "./UnpackingTarget";

import Remainder from "./state/Remainder";
import writeFastPathBytes from "./state/writeFastPathBytes";
// #if _DEBUG
import { debugState } from "./state/main";
// #endif
import { START_STATE } from "./state/main";

export default class FinishCore {
  +unpacked: UnpackingTarget;
  +remainder: Remainder;
  state: State;

  constructor(unpacked: UnpackingTarget) {
    this.unpacked = unpacked;

    /* Track extra packed bytes from prior iterations. */
    this.remainder = new Remainder();

    this.state = START_STATE;
  }

  /* Packed buffers get consumed immediately. Consumers can immediately reuse
     the `packed` buffer after calling `set`. */
  set(packed_: PackedBuffer): true | Error {
    // #if _DEBUG
    console.log("\n***** set(packed) beginning *****");
    // #endif

    const packed = {
      buffer: packed_,
      i: 0,
    };

    while (!this.remainder.isSynced()) {
      // #if _DEBUG
      {
        const remainderS = `${this.remainder.end} remainder bytes`;
        const packedS = debugPacked(packed);
        const unpackedS = debugUnpacked(this.unpacked);
        console.log(`synchronizing: ${remainderS}, ${packedS}, ${unpackedS}`);
      }
      // #endif

      if (this.unpacked.i === this.unpacked.buffer.length) {
        const growed = this.unpacked.grow();
        if (growed instanceof Error) {
          return growed;
        }
      }

      const nextState = this.remainder.sync(this.state, packed, this.unpacked);
      if (nextState === null) {
        /* I've exhausted the packed buffer without synchronizing. */
        return true;
      } else {
        /* I've found some word aligned output. */
        this.state = nextState;
      }
    }

    /* I exit the fast path (1) when I've advanced across the `packed` buffer to
       fewer than 10 bytes from its end or (2) when my `unpacked` buffer fills
       up. (1) follows from the worst case demand where a verbatim range gets
       entered. To process this case I require 1 byte for its tag, 8 bytes for
       the tag's trailing word, and 1 byte for its word count byte. */
    let remainingBytes = packed.buffer.length - packed.i;
    while (remainingBytes >= 10) {
      // #if _DEBUG
      {
        const packedS = debugPacked(packed);
        const unpackedS = debugUnpacked(this.unpacked);
        console.log(`fast path (${debugState(this.state)}): ${packedS}, ${unpackedS}`);
      }
      // #endif

      if (this.unpacked.i === this.unpacked.buffer.length) {
        const growed = this.unpacked.grow();
        if (growed instanceof Error) {
          return growed;
        }
      }

      this.state = writeFastPathBytes(this.state, packed, this.unpacked);
      remainingBytes = packed.buffer.length - packed.i;
    }

    // #if _DEBUG
    {
      const packedS = debugPacked(packed);
      const unpackedS = debugUnpacked(this.unpacked);
      console.log(`fast path complete (${debugState(this.state)}): ${packedS}, ${unpackedS}`);
    }
    // #endif

    this.remainder.intern(packed);

    return true;
  }

  /* After I've `set` all of the packed bytes that I have to decode, `finish`
     processes any remainder to complete the decode. I truncate the
     `this.unpacked` buffer to remove any excess space that wasn't used. */
  finish(): UnpackedBuffer | Error {
    // #if _DEBUG
    console.log("\n***** finish() beginning *****");
    // #endif

    while (!this.remainder.isFlushed(this.state)) {
      if (this.unpacked.i === this.unpacked.buffer.length) {
        const growed = this.unpacked.grow();
        if (growed instanceof Error) {
          return growed;
        }
      }

      const flushed = this.remainder.flush(this.state, this.unpacked);
      if (flushed instanceof Error) {
        return flushed;
      } else {
        (flushed: State);
        this.state = flushed;
      }
    }

    return this.unpacked.buffer.subarray(0, this.unpacked.i);
  }
}
