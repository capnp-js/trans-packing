/* @flow */

import type { ZeroRange } from "../../src/decode/state/main";

import * as assert from "assert";
import { describe, it } from "mocha";
import { create, fill, get, set } from "@capnp-js/bytes";

import writeZeroRange from "../../src/decode/state/writeZeroRange";
import writeSlowWord from "../../src/decode/state/writeSlowWord";

const unpacked = create(8 * 4096);
const packed = create(8 * 4096 + 32);

describe("writeZeroRange", function () {
  it("transitions to Start state when it completes its byte count", function () {
    const state = {
      type: "zero range",
      byteCountdown: 24,
    };

    const unpacked = {
      buffer: create(24),
      i: 0,
    };
    fill(0xff, 0, unpacked.buffer.length, unpacked.buffer);

    const nextState = writeZeroRange(state, unpacked);

    for (let i=0; i<24; ++i) {
      assert.equal(get(i, unpacked.buffer), 0x00);
    }

    assert.equal(nextState.type, "start");

    assert.equal(unpacked.i, 24);
  });

  it("remains in ZeroRange state when it doesn't write its full byte count", function () {
    const state = {
      type: "zero range",
      byteCountdown: 32,
    };

    const unpacked = {
      buffer: create(24),
      i: 0,
    };
    fill(0xff, 0, unpacked.buffer.length, unpacked.buffer);

    const nextState = writeZeroRange(state, unpacked);

    assert.equal(nextState.type, "zero range");
    assert.equal(((nextState: any): ZeroRange).byteCountdown, 8);
  });

  it("fills its unpacked target if that target has insufficient space", function () {
    const state = {
      type: "zero range",
      byteCountdown: 32,
    };

    const unpacked = {
      buffer: create(24),
      i: 0,
    };
    fill(0xff, 0, unpacked.buffer.length, unpacked.buffer);

    writeZeroRange(state, unpacked);

    for (let i=0; i<24; ++i) {
      assert.equal(get(i, unpacked.buffer), 0x00);
    }

    assert.equal(unpacked.i, 24);
  });
});

describe("writeSlowWord", function () {
  it("transitions VerbatimRange state to Start state when it completes its byte count", function () {
    const state = {
      type: "verbatim range",
      byteCountdown: 8,
    };

    const packed = {
      buffer: create(8),
      i: 0,
    };

    const unpacked = {
      buffer: create(8),
      i: 0,
    };

    for (let i=0; i<8; ++i) {
      set(i, i, packed.buffer);
    }

    const nextState = writeSlowWord(state, packed, unpacked);

    for (let i=0; i<8; ++i) {
      assert.equal(get(i, unpacked.buffer), i);
    }

    assert.equal(nextState.type, "start");

    assert.equal(unpacked.i, 8);
  });
});
//TODO: Suppose that `Remainder.prototype.tail` reads interleave with incomplete writes
//test("`Remainder.prototype.tail` transitions VerbatimRange state to Start state when it completes its byte count.", t => {
