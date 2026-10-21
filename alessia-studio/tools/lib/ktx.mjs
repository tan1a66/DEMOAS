import { encodeToKTX2 } from 'ktx2-encoder';

// Codifica RGBA8 grezzo in KTX2 (Basis UASTC + Zstandard), con o senza mipmap.
export async function encodeRGBA(data, width, height, {
  srgb = false, mipmaps = true, rdo = 1.2, quality = 2, normalMap = false,
} = {}) {
  const raw = data instanceof Uint8Array ? data : new Uint8Array(data);
  return encodeToKTX2(raw, {
    imageDecoder: async () => ({ width, height, data: raw }),
    isUASTC: true,
    uastcLDRQualityLevel: quality,
    enableRDO: rdo > 0,
    rdoQualityLevel: rdo,
    needSupercompression: true,
    generateMipmap: mipmaps,
    isPerceptual: srgb,
    isSetKTX2SRGBTransferFunc: srgb,
    isNormalMap: normalMap,
    isKTX2File: true,
  });
}

// Riduzione 2x2 (media), usata per le versioni a risoluzione minore
export function downsample(data, size, channels = 4) {
  const n = size / 2;
  const out = new Uint8Array(n * n * channels);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      for (let c = 0; c < channels; c++) {
        const i = (yy, xx) => ((yy * size + xx) * channels) + c;
        out[(y * n + x) * channels + c] = Math.round(
          (data[i(2 * y, 2 * x)] + data[i(2 * y, 2 * x + 1)] + data[i(2 * y + 1, 2 * x)] + data[i(2 * y + 1, 2 * x + 1)]) / 4,
        );
      }
    }
  }
  return out;
}
