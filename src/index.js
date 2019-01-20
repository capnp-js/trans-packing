/* @flow */

export {
  DECODE_MIN_BUFFER_SIZE,
  DECODE_BUFFER_SIZE_ERROR,
  DECODE_BUFFER_WORD_ALIGNMENT_ERROR,
  DECODE_END_STATE_ERROR,
  DECODE_INSUFFICIENT_SPACE_ERROR,
} from "./decode/constant";

export { default as UnpackingTarget } from "./decode/UnpackingTarget";
export { default as transDecode } from "./decode/transDecode";
export { default as transDecodeSync } from "./decode/transDecodeSync";
export { default as finishDecode } from "./decode/finishDecode";
export { default as finishDecodeSync } from "./decode/finishDecodeSync";

export {
  ENCODE_MIN_BUFFER_SIZE,
  ENCODE_BUFFER_SIZE_ERROR,
} from "./encode/constant";

export { default as transEncode } from "./encode/transEncode";
export { default as transEncodeSync } from "./encode/transEncodeSync";
