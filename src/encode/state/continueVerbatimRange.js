/* @flow */

import type { CursorR, CursorB } from "../../common";
import type { VerbatimRangeContinuing } from "./continuation";

import { getSubarray, setSubarray, set } from "@capnp-js/bytes";

import computeTag from "../computeTag";
import peekWord from "../peekWord";
import { bitCount } from "../../common";
import { VERBATIM_RANGE_CONTINUING } from "./continuation";

/* Continue searching for the verbatim range's end. I return null if I've found
   it, and I return another VerbatimRangeContinuing state if I still haven't
   found the verbatim range's end. */
export default function continueVerbatimRange(unpacked: CursorR, packed: CursorB): null | VerbatimRangeContinuing {
  /* `unpacked.i` should initially be 0, but I couldn't express the constraint
     with static typing, so I pretend that the caller may have input an
     `unpacked` cursor with `i !== 0`. */
  const begin = unpacked.i;

  let byteCount = packed.i - 1;

  while (unpacked.i < unpacked.buffer.length) {
    const tag = computeTag(peekWord(unpacked));

    /* To continue a verbatim range, the Cap'n Proto specification doesn't
       impose a particular predicate, but I follow the reference
       implementation's lead and continue a verbatim range so long as the next
       potential member word has 7 or more nonzero bytes. Such a word would pack
       as a tag byte followed by at least 7 bytes, at best breaking even with
       the word's encoding within a verbatim range range.

       A verbatim tag and its trailing word get followed by a single byte for
       the range's word count. The verbatim range must therefore end if its word
       count reaches 0xff, as the single byte will overflow if incremented.

       Otherwise the range has ended. */
    if (bitCount[tag] >= 7 && byteCount < 0x07f8) {
      unpacked.i += 8;
      byteCount += 8;
    } else {
      /* I've found the verbatim range's end, so I can write its word count. */
      set(byteCount >>> 3, 0, packed.buffer);

      setSubarray(
        getSubarray(begin, unpacked.i, unpacked.buffer),
        packed.i,
        packed.buffer,
      );
      packed.i += unpacked.i - begin;
      return null;
    }
  }

  setSubarray(
    getSubarray(begin, unpacked.buffer.length, unpacked.buffer),
    packed.i,
    packed.buffer,
  );
  packed.i += unpacked.buffer.length - begin;

  return {
    type: VERBATIM_RANGE_CONTINUING,
    end: packed.i,
  };
}
