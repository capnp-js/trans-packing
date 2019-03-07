/* @flow */

import type { CursorR, CursorB } from "../../common";
import type { Start, VerbatimRangeWriting } from "./main";

import { getSubarray, setSubarray } from "@capnp-js/bytes";

import {
  START_STATE,
  VERBATIM_RANGE_WRITING,
} from "./main";

type uint = number;

/* Write `byteCountdown` bytes from the `unpacked` cursor to the `packed`
   cursor. I advance both cursors unless I've run out of space on the `packed`
   buffer. I don't have to worry about running out of bytes from the `unpacked`
   buffer because I must discovered the verbatim range's end to enter the
   VerbatimRangeWriting state. */
export function writeVerbatimRange(byteCountdown: uint, unpacked: CursorR, packed: CursorB): VerbatimRangeWriting | Start {
  const availableBytes = packed.buffer.length - packed.i;
  if (byteCountdown <= availableBytes) {
    setSubarray(
      getSubarray(unpacked.i, unpacked.i + byteCountdown, unpacked.buffer),
      packed.i,
      packed.buffer,
    );
    unpacked.i += byteCountdown;
    packed.i += byteCountdown;
    return START_STATE;
  } else {
    const availableWordBytes = availableBytes - (availableBytes % 8);
    setSubarray(
      getSubarray(unpacked.i, unpacked.i + availableWordBytes, unpacked.buffer),
      packed.i,
      packed.buffer,
    );
    unpacked.i += availableWordBytes;
    packed.i += availableWordBytes;
    return {
      type: VERBATIM_RANGE_WRITING,
      byteCountdown: byteCountdown - availableWordBytes,
    };
  }
}
