/* @flow */

/* Continuation States

   When a TransformCore instance encounters a verbatim range that may span from
   the its `unpacked` buffer through to another `unpacked` buffer, the instance
   cannot yet write the verbatim range's word count. Continuation states allow
   the Core instance to short circuit `next` calls until sufficiently many
   unpacked buffers reach the verbatim range's word count. During continuation,
   the first byte on the Core instance's `packed` buffer is reserved for the
   range's word count. */

export type Continuation = VerbatimRangeInitializing | VerbatimRangeContinuing;

/* I transition to the VerbatimRangeInitializing continuation state from Start
   state when a Core instance's `unpacked` buffer may not contain a verbatim
   range's end. The `unpacked` cursor is positioned at the beginning of the
   verbatim range's words, and the range's words extend to the `unpacked`
   buffer's end. */
export const VERBATIM_RANGE_INITIALIZING = "verbatim range initializing";

export type VerbatimRangeInitializing = {|
  +type: "verbatim range initializing",
|};

export const VERBATIM_RANGE_INITIALIZING_STATE = {
  type: VERBATIM_RANGE_INITIALIZING,
};

/* State is stuck at VerbatimRangeContinuing until the Core instance encounters
   the verbatim range's end. The state's `end` value denotes the current end of
   the verbatim range on the `packed` buffer. */
export const VERBATIM_RANGE_CONTINUING = "verbatim range continuing";

type uint = number;

export type VerbatimRangeContinuing = {|
  +type: "verbatim range continuing",
  +end: uint,
|};

// #if _DEBUG
export function debugContinuationState(continuation: Continuation): string {
  switch (continuation.type) {
  case VERBATIM_RANGE_INITIALIZING:
    return `state="${VERBATIM_RANGE_INITIALIZING}"`;
  default:
    (continuation: VerbatimRangeContinuing);
    return `state="${VERBATIM_RANGE_CONTINUING}" with end=${continuation.end}`;
  }
}
// #endif
