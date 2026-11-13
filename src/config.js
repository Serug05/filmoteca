import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Citește .env dacă există. Variabilele deja setate în mediu au prioritate.
export function loadEnvFile() {
  try {
    process.loadEnvFile(path.join(ROOT_DIR, '.env'));
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
}

export function loadConfig(env = process.env) {
  const ttlHours = Number(env.SESSION_TTL_HOURS ?? 24);
  const dbPath = env.DB_PATH ?? 'data/filme.db';

  return {
    port: Number(env.PORT ?? 3000),
    dbPath: dbPath === ':memory:' ? dbPath : path.resolve(ROOT_DIR, dbPath),
    uploadsDir: path.resolve(ROOT_DIR, env.UPLOADS_DIR ?? 'uploads'),
    cookieSecure: env.COOKIE_SECURE === 'true',
    // Câte proxy-uri (de ex. serverul HTTPS din fața aplicației) stau între utilizator și aplicație.
    // 0 = niciunul: antetul X-Forwarded-For e ignorat, deci nu poate fi folosit pentru a păcăli
    // limitarea încercărilor pe IP.
    trustProxy: Math.max(0, Number.parseInt(env.TRUST_PROXY ?? '0', 10) || 0),
    sessionTtlMs: (Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : 24) * 60 * 60 * 1000,
  };
}
