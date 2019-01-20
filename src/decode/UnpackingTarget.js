/* @flow */

import type { UnpackedBuffer } from "../common";

import {
  DECODE_MIN_BUFFER_SIZE,
  DECODE_BUFFER_SIZE_ERROR,
  DECODE_BUFFER_WORD_ALIGNMENT_ERROR,
  DECODE_INSUFFICIENT_SPACE_ERROR,
} from "./constant";

type uint = number;

export default class UnpackingTarget {
  buffer: UnpackedBuffer;
  i: uint;

  constructor(buffer: UnpackedBuffer) {
    if (buffer.length < DECODE_MIN_BUFFER_SIZE) {
      throw new Error(DECODE_BUFFER_SIZE_ERROR);
    }

    if (buffer.length % 8) {
      throw new Error(DECODE_BUFFER_WORD_ALIGNMENT_ERROR);
    }

    this.buffer = buffer;
    this.i = 0;
  }

  /* The `grow` method must add at least 8 bytes of unpacked space. */
  grow(): true | Error {
    // #if _DEBUG
    console.log("growing the unpacked buffer");
    // #endif

    return new Error(DECODE_INSUFFICIENT_SPACE_ERROR);
  }

  /* Reclaim any unused buffer. */
  finish(): Uint8Array {
    const tail = this.buffer.subarray(this.i);
    this.i = this.buffer.length;

    return tail;
  }
}
