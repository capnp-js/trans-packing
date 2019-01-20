/* @flow */

import type {
  Source,
  AsyncIteratorTransform,
} from "@capnp-js/transform";

import type { UnpackedBuffer, PackedBuffer } from "../common";

import { PULL_STREAM_BROKE_PROTOCOL } from "@capnp-js/transform";

import { EMPTY } from "../common";

import TransformCore from "./TransformCore";

/* Pull stream transform for asynchronously processing Cap'n Proto packed data
   into word aligned data. Since the user supplies the buffer used by
   `asynchronous`, the user could use the same buffer all over the place for
   many purposes. Don't do that unless you've got a really good reason. */
export default function transDecode(buffer: Uint8Array): AsyncIteratorTransform<PackedBuffer, UnpackedBuffer> {
  return function transform(source: Source<PackedBuffer>): Source<UnpackedBuffer> {
    const status: {|
      doned: null | Error,
      done: null | (true | Error),
    |} = {
      doned: null,
      done: null,
    };

    const core = new TransformCore(buffer);

    return function decoded(abort: null | true, put: (null | (true | Error), UnpackedBuffer) => void): void {
      if (status.doned) {
        put(status.doned, EMPTY);
        return;
      }

      if (status.done) {
        put(status.done, EMPTY);
        return;
      }

      if (abort) {
        source(true, function (done, packed) { // eslint-disable-line no-unused-vars
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

      const unpacked = core.next();
      if (unpacked !== null) {
        /* `core` is still unpacking the buffer from its prior `set`. */
        put(null, unpacked);
      } else {
        /* The prior `set` buffer has been exhausted. Try to grab some more
           packed bytes for processing. */
        source(null, function (done, packed) {
          if (!done) {
            /* I've got some more packed bytes to process (if `packed` contains
               any bytes). Prepare `core` for the next iteration. */
            core.set(packed);

            /* Put an empty unpacked buffer. The next `decoded` call can handle
               any packed bytes discovered during this call. */
            put(null, EMPTY);
          } else {
            /* There are no more packed bytes to process, but why is that? */
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
