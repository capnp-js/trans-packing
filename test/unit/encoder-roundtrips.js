/* @flow */

import Prando from "prando";
import { spawn } from "child_process";
import { describe, it } from "mocha";
import { create, fill, getSubarray, set } from "@capnp-js/bytes";

import transEncodeSync from "../../src/encode/transEncodeSync";

const unpacked = create(8 * 4096);
const packed = create(8 * 4096 + 64);

function source(random) {
  let cut = 0;
  return {
    next() {
      if (cut < unpacked.length) {
        const bytes = Math.min(unpacked.length - cut, 8*random.nextInt(0, 256));
        const value = getSubarray(cut, cut+ bytes, unpacked);
        cut += bytes;
        return {
          done: false,
          value,
        };
      } else {
        return { done: true };
      }
    },
  };
};

function decoderRoundTrip(seed) {
  fill(0, 0, unpacked.length, unpacked);

  const random = new Prando(seed);
  /* Start with random bytes. */
  for (let j=0; j<unpacked.length; ++j) {
    set(random.nextInt(0, 256), j, unpacked);
  }

  /* Sprinkle in some zero ranges. */
  //TODO: This is going to rarely end the whole mess with a zero range. Consider
  //      biasing 1 in 3 to ends-with-a-zero-range.
  const rangeCount = Math.floor(8*4096 / 400 * random.next());
  for (let j=0; j<rangeCount; ++j) {
    const start = random.nextInt(0, 8*4096 - 400);
    fill(0, start, start + random.nextInt(0, 400), unpacked);
  }

  /* Sprinkle in some (0x00, 0x00) pairs (to bust up verbatim ranges). */
  const pairCount = Math.floor(8*4096 / 500 * random.next());
  for (let j=0; j<pairCount; ++j) {
    const start = random.nextInt(0, 8*4096-2);
    fill(0, start, start + 2, unpacked);
  }

  /* Set the root pointer to interpret the whole buffer as a struct with a giant
     data section. This should dodge the `capnp convert` bounds checking that
     blocks conversion when I've got garbage in the root pointer's position. */
  set(0x00, 0, unpacked);
  set(0x00, 1, unpacked);
  set(0x00, 2, unpacked);
  set(0x00, 3, unpacked);

  set(4095 & 0xff, 4, unpacked);
  set(4095 >>> 8, 5, unpacked);
  set(0x00, 6, unpacked);
  set(0x00, 7, unpacked);

  const expectedS = Buffer.from(((unpacked: any): Uint8Array)).toString("hex");

  /* Check that the reference implementation understands packed data from my
     implementation. It doesn' matter if we pack identically. */
  //TODO: Consider testing that they pack identically. I coded it expecting
  //      identical output, so why not check it?
  const capnp = spawn("capnp", ["convert", "--quiet", "flat-packed:flat"]);

  /*
  const capnp_exp = spawn("capnp", ["convert", "--quiet", "flat:flat-packed"]);
  capnp_exp.stdin.write(Buffer.from(((unpacked: any): Uint8Array)));
  capnp_exp.stdin.end();
  let packed_exp = "";
  capnp_exp.stdout.on("data", data => {
    packed_exp += data.toString("hex");
  });
  capnp_exp.on("close", () => {
    const fs = require("fs");
    fs.writeFileSync("expected.txt", packed_exp);
  });
  */
  
  let err = "";
  capnp.stderr.on("data", data => {
    err += data.toString();
  });

  let flat = "";
  capnp.stdout.on("data", data => {
    flat += data.toString("hex");
  });

  //TODO: Parametrize the buffer length to lengths other than 2048. Decoder too.
  const encode = transEncodeSync(create(2048));
  const trans = encode(source(random));

//  let column = 0;
  function write() {
    let t = trans.next();
    let ok = true;
    while (!t.done && ok) {
//      column += t.value.length * 2;
//      console.log("\nCOLUMN: "+column);
      ok = capnp.stdin.write(Buffer.from(((t.value: any): Uint8Array)));
      t = trans.next();
    }
    if (t.done) {
      capnp.stdin.end();
    } else {
      capnp.stdin.once("drain", write);
    }
  }
  write();

  return new Promise((resolve, reject) => {
    capnp.on("close", code => {
      if (code) {
        reject(`Bad exit, code=${code}, seed=${seed}, stderr: ${err}`);
      } else {
        if (flat !== expectedS) {
          reject(`Failed for seed=${seed}\n` + `stderr: ${err}\n` + `Raw:\n${expectedS}\n` + `Round Trip:\n${flat}`);
        } else {
          resolve("Passed for seed="+seed);
        }
      }
    });
  });
}

describe("transEncodeSync", function () {
  const random = new Prando(874742);
  let prior = decoderRoundTrip(8374);
  for (let i=0; i<500; ++i) {
    it(`decodes random data i=${i}`, function (done) {
      prior = prior.then(() => {
        done();
        return decoderRoundTrip(random.nextInt(0, 65536));
      }, done);
    });
  }
});
