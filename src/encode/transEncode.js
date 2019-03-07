/* @flow */

import type { BytesR, BytesB } from "@capnp-js/bytes";
import type {
  Source,
  AsyncIteratorTransform,
} from "@capnp-js/transform";

import { PULL_STREAM_BROKE_PROTOCOL } from "@capnp-js/transform";

import TransformCore from "./TransformCore";

import { EMPTY } from "../common";

/* Pull stream transform to asynchronously deflate word aligned data to Cap'n
   Proto packed data. Since the user supplies the buffer used by `asynchronous`,
   the user could use the same buffer all over the place for many purposes.
   Don't do that unless you've got a really good reason. */
export default function transEncode(buffer: BytesB): AsyncIteratorTransform<BytesR, BytesR> {
  return function transform(source: Source<BytesR>): Source<BytesR> {
    const status: {|
      doned: null | Error,
      done: null | (true | Error),
    |} = {
      doned: null,
      done: null,
    };

    const core = new TransformCore(buffer);

    return function encoded(abort: null | true, put: (null | (true | Error), BytesR) => void): void {
      if (status.doned) {
        put(status.doned, EMPTY);
        return;
      }

      if (status.done) {
        put(status.done, EMPTY);
        return;
      }

      if (abort) {
        source(true, function (done, unpacked) { // eslint-disable-line no-unused-vars
          if (!done) {
            throw new Error(PULL_STREAM_BROKE_PROTOCOL);
          } else {
            if (done === true) {
              put(true, EMPTY);
            } else {
              (done: Error);
              put(status.doned = done, EMPTY);
            }
          }
        });

        return;
      }

      const packed = core.next();
      if (packed !== null) {
        /* `core` is still packing the buffer from its prior `set`. */
        put(null, packed);
      } else {
        /* The prior `set` buffer has been exhausted. Try to grab some more
           unpacked bytes for processing. */
        source(null, function (done, unpacked) {
          if (!done) {
            /* I've got some more unpacked bytes to process (if `unpacked`
               contains any bytes). Prepare `core` for the next iteration. */
            core.set(unpacked);

            /* Put an empty packed buffer. The next `encoded` call can handle
               any unpacked bytes discovered during this call. */
            put(null, EMPTY);
          } else {
            /* There are no more unpacked bytes to process, but why is that? */
            if (done === true) {
              /* I've exhausted the source, so flush `core`. */
              const remainder = core.flush();
              if (!remainder.done) {
                put(null, remainder.value);
              } else {
                put(status.done = remainder.done, EMPTY);
              }
            } else {
              (done: Error);
              /* The `source` put an error. Pass it along. */
              put(status.doned = done, EMPTY);
            }
          }
        });
      }
    };
  };
}

