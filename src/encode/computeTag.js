/* @flow */

import type { Word } from "../common";

type u8 = number;

/* Taking the `computeTag` output of `word` proves useful beyond tagging active
   bytes.

   If `computeTag(word) === 0`, then `word === 0x0000000000000000`. I can
   leverage this to determine whether a zero range has ended.

   I end verbatim ranges if a constituent word contains 6 or fewer non-zero
   bytes. The `bitCount` table converts `computeTag(word)` to the number of non-
   zero bytes in `word`. */
export default function computeTag(word: Word): u8 {
  return (
    (word[0] === 0 ? 0x00 : 0x01)
      | (word[1] === 0 ? 0x00 : 0x02)
      | (word[2] === 0 ? 0x00 : 0x04)
      | (word[3] === 0 ? 0x00 : 0x08)
      | (word[4] === 0 ? 0x00 : 0x10)
      | (word[5] === 0 ? 0x00 : 0x20)
      | (word[6] === 0 ? 0x00 : 0x40)
      | (word[7] === 0 ? 0x00 : 0x80)
  );
}
