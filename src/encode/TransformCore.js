/* @flow */

import type { BytesR, BytesB } from "@capnp-js/bytes";
import type { SugarlessIteratorResult } from "@capnp-js/transform";

import type { CursorR, CursorB } from "../common";

import type { State, VerbatimRangeWriting } from "./state/main";
import type {
  Continuation,
  VerbatimRangeContinuing,
} from "./state/continuation";

import { getSubarray, setSubarray, set } from "@capnp-js/bytes";

import { EMPTY, ZERO, VERBATIM } from "../common";
// #if _DEBUG
import { debugPacked, debugUnpacked } from "../common";
// #endif

import computeTag from "./computeTag";
import readWord from "./readWord";
import {
  ENCODE_MIN_BUFFER_SIZE,
  ENCODE_BUFFER_SIZE_ERROR,
} from "./constant";

import beginVerbatimRange from "./state/beginVerbatimRange";
import continueVerbatimRange from "./state/continueVerbatimRange";
import writeZeroRange from "./state/writeZeroRange";
import {
  START_STATE,
  START,
  ZERO_RANGE_WRITING,
  VERBATIM_RANGE_WRITING,
} from "./state/main";
// #if _DEBUG
import { debugMainState } from "./state/main";
import { debugContinuationState } from "./state/continuation";
// #endif
import {
  VERBATIM_RANGE_INITIALIZING_STATE,
  VERBATIM_RANGE_CONTINUING,
  VERBATIM_RANGE_INITIALIZING,
} from "./state/continuation";

export default class TransformCore {
  +buffer: BytesB;
  unpacked: CursorR;
  continuation: null | Continuation;
  state: State;

  constructor(buffer: BytesB) {
    /* The buffer must have at least 2048 bytes. Because each iteration clobbers
       the last iteration's data, I demand 2048 bytes so that I can efficiently
       handle verbatim ranges (technically I only need 2041 bytes, but 2048 is
       my lucky number). */
    if (buffer.length < ENCODE_MIN_BUFFER_SIZE) {
      throw new Error(ENCODE_BUFFER_SIZE_ERROR);
    }

    this.buffer = buffer;

    this.unpacked = {
      buffer: EMPTY,
      i: 0,
    };

    this.continuation = null;

    this.state = START_STATE;
  }

  set(unpacked: BytesR): void {
    this.unpacked = {
      buffer: unpacked,
      i: 0,
    };
  }

  next(): BytesR | null {
    // #if _DEBUG
    console.log("\n***** next() beginning *****");
    // #endif

    const packed: CursorB = {
      buffer: this.buffer,
      i: 0,
    };

    if (this.continuation !== null) {
      /* The minimum buffer size imposed by the constructor allows me to ignore
         the `packed` buffer bounds. Famous last words: Overflow is not
         possible. */
      if (this.continuation.type === VERBATIM_RANGE_INITIALIZING) {
        // #if _DEBUG
        {
          const continuationStateS = debugContinuationState(this.continuation);
          const unpackedS = debugUnpacked(this.unpacked);
          const packedS = debugPacked({
            buffer: this.buffer,
            i: 1,
          });
          console.log(`continuation (${continuationStateS}): ${unpackedS}, ${packedS}`);
        }
        // #endif

        const verbatim = getSubarray(this.unpacked.i, this.unpacked.buffer.length, this.unpacked.buffer);
        this.unpacked.i = this.unpacked.buffer.length;
        setSubarray(verbatim, 1, this.buffer);
        this.continuation = {
          type: VERBATIM_RANGE_CONTINUING,
          end: 1 + verbatim.length,
        };
      } else {
        (this.continuation: VerbatimRangeContinuing);

        /* If the continuation happens to end during this run, then I need to
           keep `packed.i` positioned correctly for the trailing main run. */
        packed.i = this.continuation.end;

        // #if _DEBUG
        {
          const continuationStateS = debugContinuationState(this.continuation);
          const unpackedS = debugUnpacked(this.unpacked);
          const packedS = debugPacked(packed);
          console.log(`continuation (${continuationStateS}): ${unpackedS}, ${packedS}`);
        }
        // #endif

        this.continuation = continueVerbatimRange(this.unpacked, packed);
      }

      if (this.continuation !== null) {
        return null;
      } /* Otherwise continuation gets entered from START_STATE, so `this.state`
           remains START_STATE which is correct for exiting continuation. The
           final continuation probably had
           `this.unpacked.i !== this.unpacked.buffer`, so I leave
           `this.unpacked.i` for main to process like usual. The initialization
           branch always returns null, but the continuing branch may allow entry
           into main. The `packed` cursor position has been updated properly. */
    }

    /* Entering a verbatim range requires 10 bytes of packed space (1 byte for
       its tag, 8 bytes for the tag's trailing word, and 1 word count byte). */
    while (this.unpacked.i !== this.unpacked.buffer.length) {
      // #if _DEBUG
      {
        const mainStateS = debugMainState(this.state);
        const unpackedS = debugUnpacked(this.unpacked);
        const packedS = debugPacked(packed);
        console.log(`main (${mainStateS}): ${unpackedS}, ${packedS}`);
      }
      // #endif

      if (packed.buffer.length - packed.i < 10) {
        const value = getSubarray(0, packed.i, packed.buffer);
        packed.i = 0;
        return value;
      }

      switch (this.state.type) {
      case START: {
        const word = readWord(this.unpacked);
        const tag = computeTag(word);

        set(tag, packed.i++, packed.buffer);

        if (word[0] !== 0x00) set(word[0], packed.i++, packed.buffer);
        if (word[1] !== 0x00) set(word[1], packed.i++, packed.buffer);
        if (word[2] !== 0x00) set(word[2], packed.i++, packed.buffer);
        if (word[3] !== 0x00) set(word[3], packed.i++, packed.buffer);
        if (word[4] !== 0x00) set(word[4], packed.i++, packed.buffer);
        if (word[5] !== 0x00) set(word[5], packed.i++, packed.buffer);
        if (word[6] !== 0x00) set(word[6], packed.i++, packed.buffer);
        if (word[7] !== 0x00) set(word[7], packed.i++, packed.buffer);

        if (tag === ZERO) {
          this.state = writeZeroRange(0, this.unpacked, packed);

          // #if _DEBUG
          if (this.state.type === ZERO_RANGE_WRITING) {
            const mainStateS = debugMainState(this.state);
            const unpackedS = debugUnpacked(this.unpacked);
            const packedS = debugPacked(packed);
            console.log(`transitioned to ${mainStateS}: ${unpackedS}, ${packedS}`);
          }
          // #endif
        } else if (tag === VERBATIM) {
          const hypoState = beginVerbatimRange(this.unpacked, packed);
          if (hypoState !== null) {
            this.state = hypoState;

            // #if _DEBUG
            if (this.state.type === VERBATIM_RANGE_WRITING) {
              const mainStateS = debugMainState(this.state);
              const unpackedS = debugUnpacked(this.unpacked);
              const packedS = debugPacked(packed);
              console.log(`transitioned to ${mainStateS}: ${unpackedS}, ${packedS}`);
            }
            // #endif
          } else {
            this.continuation = VERBATIM_RANGE_INITIALIZING_STATE;

            // #if _DEBUG
            {
              const continuationStateS = debugContinuationState(this.continuation);
              const unpackedS = debugUnpacked(this.unpacked);
              const packedS = debugPacked(packed);
              console.log(`transitioned to ${continuationStateS}: ${unpackedS}, ${packedS}`);
            }
            // #endif

            /* The current `this.state === START_STATE` will be correct when the
               continuation exits. */
            return getSubarray(0, packed.i, packed.buffer);
          }
        }

        /* If neither `tag === ZERO` nor `tag === VERBATIM`, then `this.state`
           remains START_STATE. */
        break;
      }
      case ZERO_RANGE_WRITING:
        this.state = writeZeroRange(this.state.byteCount, this.unpacked, packed);
        break;
      default: {
        (this.state: VerbatimRangeWriting);

        /* Entering the VerbatimRangeWriting state requires access to the end
           of the range upon finding a verbatim range. This implies that
           `this.state.byteCountdown < this.unpacked.buffer.length - this.unpacked.i`.
        */
        const bytes = this.state.byteCountdown;
        const availableBytes = packed.buffer.length - packed.i;
        if (bytes <= availableBytes) {
          const end = this.unpacked.i + bytes;
          setSubarray(
            getSubarray(this.unpacked.i, end, this.unpacked.buffer),
            packed.i,
            packed.buffer,
          );
          this.unpacked.i = end;
          packed.i += bytes;
          this.state = START_STATE;
        } else {
          const availableWordBytes = availableBytes - (availableBytes % 8);
          const end = this.unpacked.i + availableWordBytes;
          setSubarray(
            getSubarray(this.unpacked.i, end, this.unpacked.buffer),
            packed.i,
            packed.buffer,
          );
          this.unpacked.i = end;
          packed.i += availableWordBytes;
          this.state = {
            type: VERBATIM_RANGE_WRITING,
            byteCountdown: bytes - availableWordBytes,
          };

          return getSubarray(0, packed.i, packed.buffer);
        }
      }
      }
    }

    // #if _DEBUG
    {
      const mainStateS = debugMainState(this.state);
      const unpackedS = debugUnpacked(this.unpacked);
      const packedS = debugPacked(packed);
      console.log(`next() exiting (${mainStateS}): ${unpackedS}, ${packedS}`);
    }
    // #endif

    if (packed.i !== 0) {
      return getSubarray(0, packed.i, packed.buffer);
    } else {
      return null;
    }
  }

  flush(): SugarlessIteratorResult<BytesR> {
    // #if _DEBUG
    console.log("\n***** flush() beginning *****");
    // #endif

    /* The `flush()` method is intended for use after `next()` has returned
       null. The `flush()` method therefore needs to handle any data that
       remains after a null from `next()`. */

    /* The `this.continuation !== null` case from `next()` can return a null if
       a verbatim range continuation doesn't find its verbatim range end. */
    if (this.continuation !== null) {
      if (this.continuation.type === VERBATIM_RANGE_INITIALIZING) {
        const byteCount = this.unpacked.buffer.length - this.unpacked.i;

        // #if _DEBUG
        {
          const continuationStateS = debugContinuationState(this.continuation);
          const unpackedS = debugUnpacked(this.unpacked);
          const packedS = debugPacked({
            buffer: this.buffer,
            i: 1,
          });
          console.log(`continuation (${continuationStateS}): ${unpackedS}, ${packedS}`);
        }
        // #endif

        set(byteCount >>> 3, 0, this.buffer);
        setSubarray(
          getSubarray(this.unpacked.i, this.unpacked.buffer.length, this.unpacked.buffer),
          1,
          this.buffer,
        );
        this.unpacked.i = this.unpacked.buffer.length;
        this.continuation = null;

        /* The `this.state === START_STATE` at continuation entry is the correct
           state upon exit, so leave it untouched. */

        return {
          done: false,
          value: getSubarray(0, byteCount + 1, this.buffer),
        };
      } else {
        (this.continuation: VerbatimRangeContinuing);

        const end = this.continuation.end;

        // #if _DEBUG
        {
          const continuationStateS = debugContinuationState(this.continuation);
          const unpackedS = debugUnpacked(this.unpacked);
          const packedS = debugPacked({
            buffer: this.buffer,
            i: end,
          });
          console.log(`continuation (${continuationStateS}): ${unpackedS}, ${packedS}`);
        }
        // #endif

        set(end >>> 3, 0, this.buffer);
        this.continuation = null;

        /* The `this.state === START_STATE` at continuation entry is the correct
           state upon exit, so leave it untouched. */

        return {
          done: false,
          value: getSubarray(0, end, this.buffer),
        };
      }
    } else {
      if (this.state.type === ZERO_RANGE_WRITING) {
        const byteCount = this.state.byteCount;

        // #if _DEBUG
        {
          const mainStateS = debugMainState(this.state);
          const unpackedS = debugUnpacked(this.unpacked);
          const packedS = debugPacked({
            buffer: this.buffer,
            i: 0,
          });
          console.log(`main (${mainStateS}): ${unpackedS}, ${packedS}`);
        }
        // #endif

        /* The this.state.type === ZERO_RANGE_WRITING` case can return null if
           the `this.unpacked` cursor reached the end of its buffer without
           reaching the word count byte's overflow limit. */
        set(byteCount >>> 3, 0, this.buffer);
        this.state = START_STATE;
        return {
          done: false,
          value: getSubarray(0, 1, this.buffer),
        };
      } else {
        /* The `this.state === START_STATE` case can return null, but there's
           nothing more to output in that case.

           The `this.state.type === VERBATIM_RANGE_WRITING` case cannot return
           null. Entering the VerbatimRangeWriting state requires that the range
           is entirely contained on the `unpacked` buffer. The state must
           therefore transition back to START_STATE before `next()` returns
           null.

           The `continuation !== null` case maintains
           `this.state === START_STATE` during the continuation's execution
           because it's the correct state at exit. It was therefore important to
           handle the `this.continuation !== null` case before the
           `this.state === START_STATE` case. */
        return {
          done: true,
        };
      }
    }
  }
}
