// three.js's GLTF loader decodes the model's JSON chunk with TextDecoder.
// Hermes may not ship it, so provide a small UTF-8 decoder when it is missing.
const g = globalThis as unknown as { TextDecoder?: unknown };

if (typeof g.TextDecoder === 'undefined') {
  class Utf8Decoder {
    decode(input?: ArrayBuffer | ArrayBufferView) {
      if (!input) return '';
      const bytes =
        input instanceof ArrayBuffer ? new Uint8Array(input) : new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
      let out = '';
      for (let i = 0; i < bytes.length; ) {
        const b = bytes[i++];
        let cp = b;
        if (b >= 0xf0) cp = ((b & 0x07) << 18) | ((bytes[i++] & 0x3f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else if (b >= 0xe0) cp = ((b & 0x0f) << 12) | ((bytes[i++] & 0x3f) << 6) | (bytes[i++] & 0x3f);
        else if (b >= 0xc0) cp = ((b & 0x1f) << 6) | (bytes[i++] & 0x3f);
        out += String.fromCodePoint(cp);
      }
      return out;
    }
  }
  g.TextDecoder = Utf8Decoder;
}

export {};
