/* @flow */

export const DECODE_MIN_BUFFER_SIZE = 8;

export const DECODE_BUFFER_SIZE_ERROR =
  "Cap'n Proto packing decode buffers require a length of at least 8 bytes.";

export const DECODE_BUFFER_WORD_ALIGNMENT_ERROR =
  "Cap'n Proto packing decode buffers require a length aligned for 8 byte words.";

export const DECODE_END_STATE_ERROR =
  "Cap'n Proto packed data must end in the Start state.";

export const DECODE_INSUFFICIENT_SPACE_ERROR =
  "Cap'n Proto packed data unpacks beyond the supplied buffer's end.";
