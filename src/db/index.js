import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Database from 'better-sqlite3';
import { normalizeText } from '../services/search.js';

const SCHEMA = fs.readFileSync(fileURLToPath(new URL('./schema.sql', import.meta.url)), 'utf8');

// Deschide baza SQLite (un fișier sau ':memory:' pentru teste) și creează tabelele lipsă.
export function openDb(file) {
  if (file !== ':memory:') fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new Database(file);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // Funcție disponibilă în SQL, folosită de căutarea după titlu (fără diacritice).
  db.function('normalize_text', { deterministic: true }, normalizeText);
  db.exec(SCHEMA);
  return db;
}
