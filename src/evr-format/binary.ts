export const DISPLAY_WIDTH = 576;
export const DISPLAY_HEIGHT = 288;
export const TILE_WIDTH = 288;
export const TILE_HEIGHT = 144;
export const TILE_BYTES_GRAY4 = (TILE_WIDTH * TILE_HEIGHT) / 2;

export function rgbaToGray4(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): Uint8Array {
  if (width % 2 !== 0) {
    throw new Error(`Width must be an even number, got ${width}`);
  }

  const totalPixels = width * height;
  const outBytes = new Uint8Array(totalPixels / 2);

  let byteIdx = 0;
  for (let i = 0; i < totalPixels; i += 2) {
    const offset1 = i * 4;
    const r1 = rgba[offset1];
    const g1 = rgba[offset1 + 1];
    const b1 = rgba[offset1 + 2];
    const a1 = rgba[offset1 + 3];

    let lum1 = 0;
    if (a1 > 0) {
      const rawLum1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
      lum1 = Math.round((rawLum1 * (a1 / 255) / 255) * 15);
      if (lum1 < 0) lum1 = 0;
      if (lum1 > 15) lum1 = 15;
    }

    const offset2 = (i + 1) * 4;
    const r2 = rgba[offset2];
    const g2 = rgba[offset2 + 1];
    const b2 = rgba[offset2 + 2];
    const a2 = rgba[offset2 + 3];

    let lum2 = 0;
    if (a2 > 0) {
      const rawLum2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;
      lum2 = Math.round((rawLum2 * (a2 / 255) / 255) * 15);
      if (lum2 < 0) lum2 = 0;
      if (lum2 > 15) lum2 = 15;
    }

    outBytes[byteIdx++] = (lum1 << 4) | (lum2 & 0x0f);
  }

  return outBytes;
}

export function gray4ToRgba(
  gray4: Uint8Array,
  width: number,
  height: number,
  mode: 'green' | 'grayscale' = 'green'
): Uint8ClampedArray {
  const totalPixels = width * height;
  const rgba = new Uint8ClampedArray(totalPixels * 4);

  let pixelIdx = 0;
  for (let i = 0; i < gray4.length; i++) {
    const byte = gray4[i];
    const p1 = (byte >> 4) & 0x0f;
    const p2 = byte & 0x0f;

    const val1 = p1 * 17;
    const val2 = p2 * 17;

    const off1 = pixelIdx * 4;
    if (mode === 'green') {
      rgba[off1] = Math.round(val1 * 0.15);
      rgba[off1 + 1] = val1;
      rgba[off1 + 2] = Math.round(val1 * 0.15);
      rgba[off1 + 3] = val1 > 0 ? 255 : 0;
    } else {
      rgba[off1] = val1;
      rgba[off1 + 1] = val1;
      rgba[off1 + 2] = val1;
      rgba[off1 + 3] = val1 > 0 ? 255 : 0;
    }
    pixelIdx++;

    const off2 = pixelIdx * 4;
    if (mode === 'green') {
      rgba[off2] = Math.round(val2 * 0.15);
      rgba[off2 + 1] = val2;
      rgba[off2 + 2] = Math.round(val2 * 0.15);
      rgba[off2 + 3] = val2 > 0 ? 255 : 0;
    } else {
      rgba[off2] = val2;
      rgba[off2 + 1] = val2;
      rgba[off2 + 2] = val2;
      rgba[off2 + 3] = val2 > 0 ? 255 : 0;
    }
    pixelIdx++;
  }

  return rgba;
}

export function extractRgbaTile(
  fullRgba: Uint8Array | Uint8ClampedArray,
  fullWidth: number,
  tileX: number,
  tileY: number,
  tileWidth: number,
  tileHeight: number
): Uint8ClampedArray {
  const tileRgba = new Uint8ClampedArray(tileWidth * tileHeight * 4);

  for (let row = 0; row < tileHeight; row++) {
    const srcRow = tileY + row;
    const srcStart = (srcRow * fullWidth + tileX) * 4;
    const srcEnd = srcStart + tileWidth * 4;
    const destStart = row * tileWidth * 4;

    tileRgba.set(fullRgba.subarray(srcStart, srcEnd), destStart);
  }

  return tileRgba;
}

export function sliceFullDisplayToGray4Tiles(
  fullRgba: Uint8Array | Uint8ClampedArray
): [Uint8Array, Uint8Array, Uint8Array, Uint8Array] {
  if (fullRgba.length !== DISPLAY_WIDTH * DISPLAY_HEIGHT * 4) {
    throw new Error(
      `Expected full display RGBA length ${DISPLAY_WIDTH * DISPLAY_HEIGHT * 4}, got ${fullRgba.length}`
    );
  }

  const rgba00 = extractRgbaTile(fullRgba, DISPLAY_WIDTH, 0, 0, TILE_WIDTH, TILE_HEIGHT);
  const gray00 = rgbaToGray4(rgba00, TILE_WIDTH, TILE_HEIGHT);

  const rgba01 = extractRgbaTile(fullRgba, DISPLAY_WIDTH, 288, 0, TILE_WIDTH, TILE_HEIGHT);
  const gray01 = rgbaToGray4(rgba01, TILE_WIDTH, TILE_HEIGHT);

  const rgba02 = extractRgbaTile(fullRgba, DISPLAY_WIDTH, 0, 144, TILE_WIDTH, TILE_HEIGHT);
  const gray02 = rgbaToGray4(rgba02, TILE_WIDTH, TILE_HEIGHT);

  const rgba03 = extractRgbaTile(fullRgba, DISPLAY_WIDTH, 288, 144, TILE_WIDTH, TILE_HEIGHT);
  const gray03 = rgbaToGray4(rgba03, TILE_WIDTH, TILE_HEIGHT);

  return [gray00, gray01, gray02, gray03];
}
