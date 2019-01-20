# Cap'n Proto Packing Compression
Basic zero-deflating compression.
See [the spec](https://capnproto.org/encoding.html#packing).
This library uses the pattern described at
[capnp-js/transform](https://github.com/capnp-js/transform) to (1) encode
unpacked `Uint8Array` sequences into packed `Uint8Array` sequences and to (2) decode
packed `Uint8Array` sequences into unpacked `Uint8Array` sequences.

## Encoding
Given aliases `type Unpacked = Uint8Array` and `type Packed = Uint8Array`,

```js
import { encoder } from "@capnp-js/packing";

encoder(buffer: Uint8Array): IteratorTransform<Unpacked, Packed>

type IteratorTransform<Unpacked, Packed> = (source: SugarlessIterator<Unpacked>) => SugarlessIterator<Packed>

interface SugarlessIterator<T> {
  next(): SugarlessIteratorResult<T>;
}

type SugarlessIteratorResult<T> = { done: true | Error } | { done: false, value: T };
```

The `encoder` function requires a buffer with at least 2048 bytes of space.
The resulting `IteratorTransform` converts a source of unpacked data into a source of packed data.
Consider, for example, the following infinite source of word-aligned, unpacked data:

```js
const source = {
  next() {
    const wordWidth = 8;
    const randomLength = wordWidth * Math.floor(Math.random() * 250);
    const randomData = new Uint8Array(randomLength);
    for (let i=0; i<randomLength; ++i) {
      randomData[i] = Math.floor(Math.random() * 0xff);
    }

    return randomData;
  },
};
```

I can pack data from this source by providing a buffer to `encoder`:

```js
const encode = encoder(new Uint8Array(2048));
const packed: SugarlessIterator<Packed> = encode(source);
for (let i=0; i<10; ++i) {
  const p = packed.next();
  const compressedLength = p.value.length;
  console.log(compressedLength);
}
```

Note that without an end to its source stream, `p.done` will always evaluate to false.

## Decoding
Given aliases `type Unpacked = Uint8Array` and `type Packed = Uint8Array`,

```js
import { decoder } from "@capnp-js/packing";

decoder(buffer: Uint8Array): IteratorTransform<Packed, Unpacked>

type IteratorTransform<Packed, Unpacked> = (source: SugarlessIterator<Packed>) => SugarlessIterator<Unpacked>

interface SugarlessIterator<T> {
  next(): SugarlessIteratorResult<T>;
}

type SugarlessIteratorResult<T> = { done: true | Error } | { done: false, value: T };
```

The `decoder` function requires a buffer with at least 2048 bytes of space.
The resulting `IteratorTransform` converts a source of packed data into a source of unpacked data.
Consider, for example, the `packed` source that I just created under [Encoding](https://github.com/capnp-js/packing#encoding).

I can unpack this data by providing a buffer to `decoder`:

```js
const decode = decoder(new Uint8Array(2048));
const unpacked: SugarlessIterator<Unpacked> = decode(packed);
for (let i=0; i<10; ++i) {
  const u = unpacked.next();
  const randomLength = p.value.length;
  console.log(randomLength);
}
```

Note that without an end to its source stream, `u.done` will always evaluate to false.
