/* @flow */

import type { CursorR, CursorB } from "../../common";

import type { Start, VerbatimRangeWriting } from "./main";

import { getSubarray, setSubarray, set } from "@capnp-js/bytes";

import computeTag from "../computeTag";
import peekWord from "../peekWord";
import { bitCount } from "../../common";
import { START_STATE, VERBATIM_RANGE_WRITING } from "./main";

/* After finding 0xff tag and processing its trailing word from the Start state,
   this function searches for the end of the tag's verbatim range. If this
   function finds the range's end on the `unpacked` buffer, then I write the
   word count byte and what I can of the verbatim words to the `packed` buffer,
   transitioning to the VerbatimRangeWriting state if all of the words don't fit
   on the `packed` buffer. If, however, I don't find the verbatim range's end on
   the `unpacked` buffer, then I leave the cursors untouched and return `null`
   (indicating transition to VerbatimRangeInitializing continuation). */
export default function beginVerbatimRange(unpacked: CursorR, packed: CursorB): Start | VerbatimRangeWriting | null {
  const begin = unpacked.i;
  let byteCount = 0;

  while (unpacked.i < unpacked.buffer.length) {
    const tag = computeTag(peekWord(unpacked));

    /* To continue a verbatim range, the Cap'n Proto specification doesn't
       impose a particular predicate, but I follow the reference
       implementation's lead and continue a verbatim range so long as the next
       potential member word has 7 or more nonzero bytes. Such a word would pack
       as a tag byte followed by at least 7 bytes, at best breaking even with
       the word's encoding within a verbatim range.

       A verbatim tag and its trailing word get followed by a single byte for
       the range's word count. The verbatim range must therefore end if its word
       count reaches 0xff, as the single byte will overflow if incremented.

       Otherwise the range has ended. */
    if (bitCount[tag] >= 7 && byteCount < 0x07f8) {
      unpacked.i += 8; //if insufficient space on packed, then I need to scroll back unpacked.i
      byteCount += 8;
    } else {
      /* I found the verbatim range's end, so I can write the word count. */
      set(byteCount >>> 3, packed.i++, packed.buffer);

      const availableBytes = packed.buffer.length - packed.i;
      if (byteCount <= availableBytes) {
        /* The whole verbatim range fits into the `packed` buffer.  */
        setSubarray(
          getSubarray(begin, unpacked.i, unpacked.buffer),
          packed.i,
          packed.buffer,
        );
        packed.i += byteCount;
        return START_STATE;
      } else {
        /* The whole verbatim range doesn't fit into the `packed` buffer, so
           I've got to transition to VerbatimRangeWriting to write on an
           additional iteration's `packed` buffer too. */
        const availableWordBytes = availableBytes - (availableBytes % 8);
        setSubarray(
          getSubarray(begin, begin + availableWordBytes, unpacked.buffer),
          packed.i,
          packed.buffer,
        );
        unpacked.i = begin + availableWordBytes;
        packed.i += availableWordBytes;
        return {
          type: VERBATIM_RANGE_WRITING,
          byteCountdown: byteCount - availableWordBytes,
        };
      }
    }
  }

  /* I couldn't decide if the verbatim range ends on the `unpacked` buffer, so I
     scroll the `unpacked` cursor back to the verbatim range's beginning and
     return `null`. */
  unpacked.i = begin;
  return null;
}
