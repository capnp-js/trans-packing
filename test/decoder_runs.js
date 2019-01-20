/* @flow */

const Prando = require("prando");
const spawn = require("child_process").spawn;

const lib = require("../");

const unpacked = new Uint8Array(8 * 4096);
const packed = new Uint8Array(8 * 4096 + 64);//TODO: Why can't `+32` work here? (8*4096 * 2/2048 = 32)

function source(packed, random) {
  let cut = 0;
  return {
    next() {
      if (cut < packed.length) {
        const bytes = Math.min(packed.length - cut, random.nextInt(0, 2048));
        const value = packed.subarray(cut, cut + bytes);
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
  unpacked.fill(0);

  const random = new Prando(seed);
  /* Start with random bytes. */
  for (let j=0; j<unpacked.length; ++j) {
    unpacked[j] = random.nextInt(0, 256);
  }

  /* Sprinkle in some zero ranges. */
  //TODO: This is going to rarely end the whole mess with a zero range. Consider
  //      biasing 1 in 3 to ends-with-a-zero-range.
  const rangeCount = Math.floor(8*4096 / 400 * random.next());
  for (let j=0; j<rangeCount; ++j) {
    const start = random.nextInt(0, 8*4096 - 400);
    unpacked.fill(0, start, start + random.nextInt(0, 400));
  }

  /* Sprinkle in some (0x00, 0x00) pairs (to bust up verbatim ranges). */
  const pairCount = Math.floor(8*4096 / 500 * random.next());
  for (let j=0; j<pairCount; ++j) {
    const start = random.nextInt(0, 8*4096-2);
    unpacked.fill(0, start, start + 2);
  }

  /* Set the root pointer to interpret the whole buffer as a struct with a giant
     data section. This should dodge the `capnp convert` bounds checking that
     blocks conversion when I've got garbage in the root pointer's position. */
  unpacked[0] = 0x00;
  unpacked[1] = 0x00;
  unpacked[2] = 0x00;
  unpacked[3] = 0x00;

  unpacked[4] = 4095 & 0xff;
  unpacked[5] = 4095 >>> 8;
  unpacked[6] = 0x00;
  unpacked[7] = 0x00;

  /* Check that my implementation understands packed data from the reference
     implementation. It doesn' matter if we pack identically. */
  //TODO: Consider testing that they pack identically. I coded it expecting
  //      identical output, so why not check it?
  const capnp = spawn("capnp", ["convert", "--quiet", "flat:flat-packed"]);

  let err = "";
  capnp.stderr.on("data", data => {
    err += data.toString();
  });

  let end = 0;
  capnp.stdout.on("data", data => {
    packed.set(data, end);
    end += data.length;
  });

  let cut = 0;
  function write() {
    let subarray;
    let ok = true;
    do {
      subarray = unpacked.subarray(cut, cut + Math.min(2048, unpacked.length - cut));
      cut += subarray.length
      ok = capnp.stdin.write(Buffer.from(subarray));
    } while (subarray.length !== 0 && ok);
    if (subarray.length === 0) {
      capnp.stdin.end();
    } else {
      capnp.stdin.once("drain", write);
    }
  }
  write();

  return new Promise((resolve, reject) => {
    capnp.on("close", code => {
      if (code) {
        reject(`Bad exit, code=${code}, seed=${seed}.`);
      } else {
        const expectedS = Buffer.from(unpacked).toString("hex");
        const decode = lib.transDecodeSync(new Uint8Array(2048));
        const trans = decode(source(packed.subarray(0, end), random));
        let flat = "";
        //let column = 0;
        for (let t=trans.next(); !t.done; t=trans.next()) {
          //column += t.value.length * 2;
          //console.log("COLUMN: "+column);
          flat += Buffer.from(t.value).toString("hex");
        }

        if (flat !== expectedS) {
          reject(`Failed for seed=${seed}\n` + `Raw:\n${expectedS}\n` + `Round Trip:\n${flat}`);
        } else {
          resolve("Passed for seed="+seed);
        }
      }
    });
  });
}

const random = new Prando(874742);
let prior = decoderRoundTrip(8374)
for (let i=0; i<500; ++i) {
  prior = prior.then(() => decoderRoundTrip(random.nextInt(0, 65536)));
}
