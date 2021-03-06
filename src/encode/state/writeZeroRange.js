/* @flow */

import type { CursorR, CursorB } from "../../common";
import type { Start, ZeroRangeWriting } from "./main";

import { set } from "@capnp-js/bytes";

import computeTag from "../computeTag";
import peekWord from "../peekWord";

import {
  START_STATE,
  ZERO_RANGE_WRITING,
} from "./main";

type u8 = number;

/* Starting from `wordCount`, advance the `unpacked` cursor until the zero range
   ends. If I exhaust the `unpacked` buffer without reaching the 0xff upper
   limit, then I return a ZeroRangeWriting state so that another `unpacked`
   buffer can continue searching for the final zero word in the zero range. If
   I find the final zero word, then I write the word count and return the Start
   state. */
export default function writeZeroRange(byteCount: u8, unpacked: CursorR, packed: CursorB): ZeroRangeWriting | Start {
  while (unpacked.i < unpacked.buffer.length) {
    const tag = computeTag(peekWord(unpacked));

    /* Zero `tag` implies zero `word`, so continue counting.

       A zero tag is trailed by a single byte for its word count. The zero range
       must therefore end if its word count reaches 0xff, as the single byte
       will overflow if incremented.

       Otherwise the range has ended. */
    if (tag === 0x00 && byteCount < 0x07f8) {
      unpacked.i += 8;
      byteCount += 8;
    } else {
      set(byteCount >>> 3, packed.i++, packed.buffer);
      return START_STATE;
    }
  }

  return {
    type: ZERO_RANGE_WRITING,
    byteCount,
  };
}
