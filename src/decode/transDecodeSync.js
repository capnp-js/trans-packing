/* @flow */

import type { BytesR, BytesB } from "@capnp-js/bytes";
import type {
  SugarlessIterator,
  SugarlessIteratorResult,
  IteratorTransform,
} from "@capnp-js/transform";

import { EMPTY } from "../common";

import TransformCore from "./TransformCore";

/* Transform iterator for synchronously processing Cap'n Proto packed data into
   word aligned data. */
export default function transDecodeSync(buffer: BytesB): IteratorTransform<BytesR, BytesR> {
  return function transform(source: SugarlessIterator<BytesR>): SugarlessIterator<BytesR> {
    const status: {|
      doned: null | Error,
      done: null | (true | Error),
    |} = {
      doned: null,
      done: null,
    };

    const core = new TransformCore(buffer);

    return {
      next(): SugarlessIteratorResult<BytesR> {
        if (status.doned) {
          return { done: status.doned };
        }

        if (status.done) {
          return { done: status.done };
        }

        const unpacked = core.next();
        if (unpacked !== null) {
          return {
            done: false,
            value: unpacked,
          };
        } else {
          const packed = source.next();
          if (!packed.done) {
            core.set(packed.value);

            // Fighting the urge to `return this.next()`.
            // This reduces risk of stack overflow, but it seems silly.
            return {
              done: false,
              value: EMPTY,
            };
          } else {
            if (packed.done === true) {
              const remainder = core.flush();
              if (!remainder.done) {
                return remainder;
              } else {
                status.done = remainder.done;
                return remainder;
              }
            } else {
              (packed.done: Error);
              status.doned = packed.done;
              return packed;
            }
          }
        }
      },
    };
  };
}
