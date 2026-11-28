/**
 * 把 JPG/PNG 編成 KTX2（Basis ETC1S）。需本機已裝 ktx2-encoder + sharp：
 *   npm i -D ktx2-encoder sharp
 *   node scripts/encode-ktx2.mjs src/assets/foo.jpg src/assets/foo.ktx2 256
 */
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const src = process.argv[2];
const dst = process.argv[3];
const size = Number(process.argv[4] || 256);
if (!src || !dst) {
  console.error('usage: node scripts/encode-ktx2.mjs <in.jpg|png> <out.ktx2> [size=256]');
  process.exit(1);
}

let sharp, encodeToKTX2;
try {
  sharp = (await import('sharp')).default;
  encodeToKTX2 = (await import('ktx2-encoder')).encodeToKTX2;
} catch {
  console.error('請先：npm i -D ktx2-encoder sharp');
  process.exit(1);
}

const jpeg = new Uint8Array(fs.readFileSync(src));
const rgba = await sharp(Buffer.from(jpeg))
  .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const png = await sharp(rgba.data, { raw: { width: rgba.info.width, height: rgba.info.height, channels: 4 } })
  .png()
  .toBuffer();
const ktx2 = await encodeToKTX2(new Uint8Array(png), {
  isUASTC: false,
  generateMipmap: true,
  isPerceptual: true,
  qualityLevel: 128,
  imageDecoder: async (buffer) => {
    const { data, info } = await sharp(Buffer.from(buffer)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    return { data: new Uint8Array(data), width: info.width, height: info.height };
  },
});
fs.mkdirSync(path.dirname(dst), { recursive: true });
fs.writeFileSync(dst, ktx2);
console.log('wrote', pathToFileURL(path.resolve(dst)).href, ktx2.byteLength, `${size}x${size}`);
