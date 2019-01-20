/* @flow */

/* Main Loop States */

export type State = Start | ZeroRangeWriting | VerbatimRangeWriting;

/* Packing begins in the Start state. Packing a word whose tag is not ZERO or
   VERBATIM implies that the encoder remains in the Start state. The ZERO and
   VERBATIM tags imply some state transitioning. */
export const START = "start";

export type Start = {|
  +type: "start",
|};

export const START_STATE = {
  type: START,
};

/* I transition from the Start state to the ZeroRangeWriting state by processing
   a zero word. */
export const ZERO_RANGE_WRITING = "zero range writing";

type uint = number;

export type ZeroRangeWriting = {|
  +type: "zero range writing",
  +byteCount: uint,
|};

/* I transition from Start state to VerbatimRangeWriting state if I encounter
   a VERBATIM-tagged word whose range of verbatim words ends on a TransformCore
   instance's unpacked buffer. This sufficient condition allows the
   TransformCore instance to write a word count byte without access to any
   additional unpacked bytes. */
export const VERBATIM_RANGE_WRITING = "verbatim range writing";

export type VerbatimRangeWriting = {|
  +type: "verbatim range writing",
  +byteCountdown: uint,
|};

// #if _DEBUG
export function debugMainState(state: State): string {
  switch (state.type) {
  case START:
    return `state="${START}"`;
  case ZERO_RANGE_WRITING:
    return `state="${ZERO_RANGE_WRITING}" with byteCount=${state.byteCount}`;
  default:
    (state: VerbatimRangeWriting);
    return `state="${VERBATIM_RANGE_WRITING}" with byteCountdown=${state.byteCountdown}`;
  }
}
// #endif
