/* @flow */

type uint = number;

/* State where the decoder reads a tag byte to map non-zero trailing bytes into
   an unpacked word. Tag bytes 0x00 (`ZERO`) and 0xff (`VERBATIM`) transition
   the decoder into alternate states after the trailing bytes get mapped into
   an unpacked word. */
export const START = "start";

export type Start = {|
  +type: "start",
|};

export const START_STATE = {
  type: START,
};

/* State where the decoder repeatedly writes 0x0000000000000000 words until a
   word count has been exhausted. I use `byteCountdown` instead of
   `wordCountdown`, but `byteCountdown` is always word aligned. */
export const ZERO_RANGE = "zero range";

export type ZeroRange = {|
  +type: "zero range",
  +byteCountdown: uint,
|};

/* State where the decoder transcribes whole, unaltered words. I use
   `byteCountdown` instead of `wordCountdown`, but `byteCountdown` is always
   word aligned. */
export const VERBATIM_RANGE = "verbatim range";

export type VerbatimRange = {|
  +type: "verbatim range",
  +byteCountdown: uint,
|};

export type State = Start | ZeroRange | VerbatimRange;

// #if _DEBUG
export function debugState(state: State): string {
  switch (state.type) {
  case START:
    return `state="${START}"`;
  default:
    (state: ZeroRange | VerbatimRange);
    return `state="${state.type}" with byteCountdown=${state.byteCountdown}`;
  }
}
// #endif
