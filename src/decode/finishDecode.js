/* @flow */

import type { BytesR, BytesB } from "@capnp-js/bytes";
import type { Source, Sink } from "@capnp-js/transform";

import type UnpackingTarget from "./UnpackingTarget";

import { EMPTY } from "../common";

import FinishCore from "./FinishCore";

export default function finishDecode(target: UnpackingTarget, cb: (null | Error, BytesB) => void): Sink<BytesR> {
  const core = new FinishCore(target);
  return function sink(source: Source<BytesR>): void {
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
            (finished: BytesB);
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
