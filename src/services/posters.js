import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

export const MAX_POSTER_BYTES = 2 * 1024 * 1024;

const ALLOWED_FORMATS = new Set(['jpeg', 'png', 'webp']);
const MAX_INPUT_PIXELS = 25_000_000; // aproximativ 5000 × 5000
const POSTER_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.webp$/;

export class PosterError extends Error {}

// Nu avem încredere în extensia fișierului sau în tipul trimis de browser: sharp citește conținutul real.
// Imaginea e apoi redesenată ca un WebP nou, așa că orice cod ascuns în fișier sau metadatele
// (de ex. locația GPS a pozei) nu ajung niciodată pe server.
export async function processPoster(buffer) {
  let metadata;
  try {
    metadata = await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS }).metadata();
  } catch {
    throw new PosterError('Fișierul nu este o imagine validă.');
  }
  if (!ALLOWED_FORMATS.has(metadata.format)) {
    throw new PosterError('Sunt acceptate doar imagini JPG, PNG sau WebP.');
  }

  try {
    return await sharp(buffer, { limitInputPixels: MAX_INPUT_PIXELS })
      .rotate()
      .resize({ width: 600, height: 900, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 82 })
      .toBuffer();
  } catch {
    throw new PosterError('Imaginea nu a putut fi procesată.');
  }
}

// Numele fișierului e generat de server (UUID aleator); numele trimis de utilizator e ignorat,
// deci nu se pot folosi trucuri ca „../../server.js”.
export async function savePoster(dir, data) {
  const name = `${crypto.randomUUID()}.webp`;
  await fs.writeFile(path.join(dir, name), data, { flag: 'wx' });
  return name;
}

export async function removePoster(dir, name) {
  if (!name || !POSTER_NAME.test(name)) return;
  await fs.rm(path.join(dir, name), { force: true });
}
