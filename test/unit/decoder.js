/* @flow */

import type { ZeroRange } from "../../lib/decode/state/main";

import Prando from "prando";
import test from "ava";

import writeZeroRange from "../../lib/decode/state/writeZeroRange";
import writeSlowWord from "../../lib/decode/state/writeSlowWord";

const unpacked = new Uint8Array(8 * 4096);
const packed = new Uint8Array(8 * 4096 + 32);

test("`writeZeroRange` transitions to Start state when it completes its byte count.", t => {
  t.plan(26);

  const state = {
    type: "zero range",
    byteCountdown: 24,
  };

  const unpacked = {
    buffer: new Uint8Array(24),
    i: 0,
  };
  unpacked.buffer.fill(0xff);

  const nextState = writeZeroRange(state, unpacked);

  for (let i=0; i<24; ++i) {
    t.is(unpacked.buffer[i], 0x00);
  }

  t.is(nextState.type, "start");

  t.is(unpacked.i, 24);
});

test("`writeZeroRange` remains in ZeroRange state when it doesn't write its full byte count to `unpacked`.", t => {
  t.plan(2);

  const state = {
    type: "zero range",
    byteCountdown: 32,
  };

  const unpacked = {
    buffer: new Uint8Array(24),
    i: 0,
  };
  unpacked.buffer.fill(0xff);

  const nextState = writeZeroRange(state, unpacked);

  t.is(nextState.type, "zero range");
  t.is(((nextState: any): ZeroRange).byteCountdown, 8);
});

test("`writeZeroRange` fills its unpacked target if that target has insufficient space.", t => {
  t.plan(25);

  const state = {
    type: "zero range",
    byteCountdown: 32,
  };

  const unpacked = {
    buffer: new Uint8Array(24),
    i: 0,
  };
  unpacked.buffer.fill(0xff);

  writeZeroRange(state, unpacked);

  for (let i=0; i<24; ++i) {
    t.is(unpacked.buffer[i], 0x00);
  }

  t.is(unpacked.i, 24);
});

test("`writeSlowWord` transitions VerbatimRange state to Start state when it completes its byte count.", t => {
  t.plan(10);

  const state = {
    type: "verbatim range",
    byteCountdown: 8,
  };

  const packed = {
    buffer: new Uint8Array(8),
    i: 0,
  };

  const unpacked = {
    buffer: new Uint8Array(8),
    i: 0,
  };

  for (let i=0; i<8; ++i) {
    packed.buffer[i] = i;
  }

  const nextState = writeSlowWord(state, packed, unpacked);

  for (let i=0; i<8; ++i) {
    t.is(unpacked.buffer[i], i);
  }

  t.is(nextState.type, "start");

  t.is(unpacked.i, 8);
});
//TODO: Suppose that `Remainder.prototype.tail` reads interleave with incomplete writes
//test("`Remainder.prototype.tail` transitions VerbatimRange state to Start state when it completes its byte count.", t => {
