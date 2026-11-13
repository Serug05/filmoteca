import fs from 'node:fs';
import path from 'node:path';
import { ROOT_DIR, loadConfig, loadEnvFile } from '../src/config.js';
import { openDb } from '../src/db/index.js';
import { describeSeed, readSeedPasswords, seedDatabase } from './seed-lib.js';

// Rulează automat înainte de `npm start` (scriptul „prestart”), ca aplicația să pornească
// cu o singură comandă după instalare:
//   1. dacă lipsește .env, îl creează din .env.example;
//   2. dacă baza de date nu are niciun utilizator, o umple cu datele demo.
// Datele existente nu sunt atinse niciodată; pentru reset există `npm run seed`.

const envPath = path.join(ROOT_DIR, '.env');
if (!fs.existsSync(envPath)) {
  fs.copyFileSync(path.join(ROOT_DIR, '.env.example'), envPath, fs.constants.COPYFILE_EXCL);
  console.log('Am creat .env din .env.example.');
}

loadEnvFile();
const config = loadConfig();

const db = openDb(config.dbPath);
const { users } = db.prepare('SELECT COUNT(*) AS users FROM users').get();
db.close();

if (users === 0) {
  try {
    const counts = await seedDatabase(config, readSeedPasswords());
    console.log(`Baza de date era goală, am adăugat datele demo: ${describeSeed(counts)}.`);
  } catch (err) {
    console.error(`Pregătirea a eșuat: ${err.message}`);
    process.exit(1);
  }
}
