/* @flow */

import type { Finish, SugarlessIterator } from "@capnp-js/transform";

import type { PackedBuffer, UnpackedBuffer } from "../common";

import FinishCore from "./FinishCore";
import UnpackingTarget from "./UnpackingTarget";

export default function finishDecodeSync(target: UnpackingTarget): Finish<PackedBuffer, UnpackedBuffer | Error> {
  const core = new FinishCore(target);
  return function finish(source: SugarlessIterator<PackedBuffer>): UnpackedBuffer | Error {
    let s = source.next();
    while (!s.done) {
      const setted = core.set(s.value);
      if (setted instanceof Error) {
        return setted;
      }
      s = source.next();
    }

    if (s.done === true) {
      return core.finish();
    } else {
      (s.done: Error);
      return s.done;
    }
  };
}
