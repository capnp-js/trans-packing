/* @flow */

import type {
  SugarlessIterator,
  SugarlessIteratorResult,
  IteratorTransform,
} from "@capnp-js/transform";

import type {
  UnpackedBuffer,
  PackedBuffer,
} from "../common";

import TransformCore from "./TransformCore";

import { EMPTY } from "../common";

/* Transform iterator for synchronously deflating word aligned data to Cap'n
   Proto packed data. */
export default function transEncodeSync(buffer: Uint8Array): IteratorTransform<UnpackedBuffer, PackedBuffer> {
  return function transform(source: SugarlessIterator<UnpackedBuffer>): SugarlessIterator<PackedBuffer> {
    const status: {| done: null | (true | Error) |} = { done: null };

    const core = new TransformCore(buffer);

    return {
      next(): SugarlessIteratorResult<PackedBuffer> {
        if (status.done) {
          return { done: status.done };
        }

        const packed = core.next();
        if (packed !== null) {
          return {
            done: false,
            value: packed,
          };
        } else {
          const unpacked = source.next();
          if (!unpacked.done) {
            core.set(unpacked.value);

            // Fighting the urge to `return this.next()`.
            // This reduces risk of stack overflow, but it seems silly.
            return {
              done: false,
              value: EMPTY,
            };
          } else {
            if (unpacked.done === true) {
              const remainder = core.flush();
              if (!remainder.done) {
                return remainder;
              } else {
                status.done = remainder.done;
                return remainder;
              }
            } else {
              (unpacked.done: Error);
              status.done = unpacked.done;
              return unpacked;
            }
          }
        }
      },
    };
  };
}
