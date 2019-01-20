/* @flow */

import type { Source, Sink } from "@capnp-js/transform";

import type { PackedBuffer, UnpackedBuffer } from "../common";

import type UnpackingTarget from "./UnpackingTarget";

import { EMPTY } from "../common";

import FinishCore from "./FinishCore";

export default function finishDecode(target: UnpackingTarget, cb: (null | Error, UnpackedBuffer) => void): Sink<PackedBuffer> {
  const core = new FinishCore(target);
  return function sink(source: Source<PackedBuffer>): void {
    source(null, function next(done, value) {
      if (done === null) {
        const setted = core.set(value);
        if (setted === true) {
          source(null, next);
        } else {
          (setted: Error);
          source(true, function () {});
          cb(setted, EMPTY);
        }
      } else {
        if (done === true) {
          const finished = core.finish();
          if (finished instanceof Error) {
            cb(finished, EMPTY);
          } else {
            (finished: UnpackedBuffer);
            cb(null, finished);
          }
        } else {
          (done: Error);
          cb(done, EMPTY);
        }
      }
    });
  };
}
