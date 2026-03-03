/**
 * ShareUtils - Handles compressing and decompressing JSON payloads for shareable URLs
 */
const ShareUtils = {
  /**
   * Convert a string to a base64-url string safely
   */
  bytesToBase64Url(bytes) {
    let result = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      result += String.fromCharCode(bytes[i]);
    }
    // Convert to base64, then make it url-safe
    return btoa(result).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },

  /**
   * Convert a base64-url string safely back to bytes
   */
  base64UrlToBytes(base64Url) {
    // Revert url-safe modifications and pad
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return bytes;
  },

  /**
   * Compress a JSON string and return a base64-url encoded payload
   * @param {string} jsonStr
   * @returns {Promise<string>}
   */
  async compress(jsonStr) {
    if (!window.CompressionStream) {
      throw new Error('CompressionStream is not supported in this browser.');
    }

    // Convert string to Uint8Array
    const encoder = new TextEncoder();
    const data = encoder.encode(jsonStr);

    // Pipe through CompressionStream
    const cs = new CompressionStream('deflate-raw');
    const writer = cs.writable.getWriter();
    writer.write(data);
    writer.close();

    // Read the compressed stream
    const chunks = [];
    const reader = cs.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Merge chunks
    let totalLength = 0;
    chunks.forEach((chunk) => (totalLength += chunk.length));
    const compressedData = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      compressedData.set(chunk, offset);
      offset += chunk.length;
    });

    return this.bytesToBase64Url(compressedData);
  },

  /**
   * Decompress a base64-url encoded payload back to a JSON string
   * @param {string} base64UrlStr
   * @returns {Promise<string>}
   */
  async decompress(base64UrlStr) {
    if (!window.DecompressionStream) {
      throw new Error('DecompressionStream is not supported in this browser.');
    }

    const compressedData = this.base64UrlToBytes(base64UrlStr);

    // Pipe through DecompressionStream
    const ds = new DecompressionStream('deflate-raw');
    const writer = ds.writable.getWriter();
    writer.write(compressedData);
    writer.close();

    // Read the decompressed stream
    const chunks = [];
    const reader = ds.readable.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
    }

    // Merge chunks
    let totalLength = 0;
    chunks.forEach((chunk) => (totalLength += chunk.length));
    const decompressedData = new Uint8Array(totalLength);
    let offset = 0;
    chunks.forEach((chunk) => {
      decompressedData.set(chunk, offset);
      offset += chunk.length;
    });

    // Convert back to string
    const decoder = new TextDecoder();
    return decoder.decode(decompressedData);
  },

  /**
   * Generate a full shareable URL
   * @param {string} jsonStr
   * @returns {Promise<string>}
   */
  async generateShareUrl(jsonStr) {
    const payload = await this.compress(jsonStr);
    const url = new URL(window.location.href);
    url.hash = `share=${payload}`;
    return url.toString();
  },
};

window.ShareUtils = ShareUtils;
