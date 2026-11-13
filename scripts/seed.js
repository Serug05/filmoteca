import { loadConfig, loadEnvFile } from '../src/config.js';
import { describeSeed, readSeedPasswords, seedDatabase } from './seed-lib.js';

// `npm run seed`: resetează baza de date și o umple cu date demo.

loadEnvFile();

try {
  const counts = await seedDatabase(loadConfig(), readSeedPasswords());
  console.log(`Seed gata: ${describeSeed(counts)}.`);
} catch (err) {
  console.error(`Seed eșuat: ${err.message}`);
  process.exit(1);
}
