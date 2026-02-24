#!/usr/bin/env node
/**
 * Generate a proper multi-size Windows ICO from the chevron-dark.png source.
 *
 * ICO format (with PNG payloads):
 *   Header:    6 bytes  — reserved(2) + type(2) + count(2)
 *   Directory: N × 16 bytes — width, height, colors, reserved, planes, bpp, size, offset
 *   Payloads:  PNG data for each entry
 *
 * Sizes: 16, 24, 32, 48, 64, 256 — covers all Windows DPI / taskbar / Explorer contexts.
 */

import sharp from 'sharp';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SOURCE_PNG = join(ROOT, 'electron', 'assets', 'logos', 'chevron-dark.png');
const OUTPUT_ICO = join(ROOT, 'electron', 'assets', 'icon.ico');

const SIZES = [16, 24, 32, 48, 64, 256];

async function generateIco() {
  console.log(`Source: ${SOURCE_PNG}`);

  // Load the source and make it square first (the source is 1010×995 — not square)
  const meta = await sharp(SOURCE_PNG).metadata();
  console.log(`Source dimensions: ${meta.width}×${meta.height}`);

  const maxDim = Math.max(meta.width, meta.height);

  // Extend to square with transparent padding, centered
  const squarePng = sharp(SOURCE_PNG).resize(maxDim, maxDim, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });

  // Generate each size as PNG buffer
  const entries = [];
  for (const size of SIZES) {
    const buf = await squarePng
      .clone()
      .resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer();
    entries.push({ size, data: buf });
    console.log(`  ${size}×${size}: ${buf.length} bytes`);
  }

  // Assemble ICO binary
  const headerSize = 6;
  const dirSize = entries.length * 16;
  let dataOffset = headerSize + dirSize;

  // Header: reserved(0) + type(1=icon) + count
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);                  // reserved
  header.writeUInt16LE(1, 2);                  // type = ICO
  header.writeUInt16LE(entries.length, 4);      // image count

  // Directory entries
  const dir = Buffer.alloc(dirSize);
  for (let i = 0; i < entries.length; i++) {
    const { size, data } = entries[i];
    const off = i * 16;
    dir[off + 0] = size < 256 ? size : 0;      // width  (0 = 256)
    dir[off + 1] = size < 256 ? size : 0;      // height (0 = 256)
    dir[off + 2] = 0;                          // color palette
    dir[off + 3] = 0;                          // reserved
    dir.writeUInt16LE(1, off + 4);              // color planes
    dir.writeUInt16LE(32, off + 6);             // bits per pixel
    dir.writeUInt32LE(data.length, off + 8);    // image data size
    dir.writeUInt32LE(dataOffset, off + 12);    // offset to image data
    dataOffset += data.length;
  }

  // Write ICO file
  const ico = Buffer.concat([header, dir, ...entries.map(e => e.data)]);
  writeFileSync(OUTPUT_ICO, ico);
  console.log(`\nWrote ${OUTPUT_ICO} (${ico.length} bytes, ${entries.length} sizes)`);
}

generateIco().catch(err => {
  console.error('Failed:', err);
  process.exit(1);
});
