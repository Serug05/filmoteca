import { createApp } from './app.js';
import { loadConfig, loadEnvFile } from './config.js';
import { openDb } from './db/index.js';
import { deleteExpiredSessions } from './models/sessions.js';

loadEnvFile();
const config = loadConfig();
const db = openDb(config.dbPath);

deleteExpiredSessions(db);
setInterval(() => deleteExpiredSessions(db), 60 * 60 * 1000).unref();

createApp({ db, config }).listen(config.port, () => {
  console.log(`Aplicația rulează pe http://localhost:${config.port}`);
});
