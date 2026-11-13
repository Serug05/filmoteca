import { createApp } from '../src/app.js';
import { openDb } from '../src/db/index.js';
import { createUser } from '../src/models/users.js';
import { hashPassword } from '../src/services/passwords.js';

export const TEST_CONFIG = { cookieSecure: false, sessionTtlMs: 60 * 60 * 1000 };

// Fiecare test primește o aplicație nouă, cu propria bază de date în memorie.
export function makeApp() {
  const db = openDb(':memory:');
  return { db, app: createApp({ db, config: TEST_CONFIG }) };
}

export async function addUser(db, { username, email, password, role }) {
  return createUser(db, { username, email, role, passwordHash: await hashPassword(password) });
}

// Extrage „sid=...” din răspuns, ca să-l putem retrimite manual.
export function sessionCookie(response) {
  return response.headers['set-cookie']?.find((c) => c.startsWith('sid='))?.split(';')[0];
}
