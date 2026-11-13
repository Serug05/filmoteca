import argon2 from 'argon2';

// Argon2id cu 64 MiB de memorie: fiecare încercare de parolă costă timp și memorie atacatorului.
const OPTIONS = { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 4 };

let dummyHash;

export function hashPassword(password) {
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash, password) {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}

// Când emailul nu există, verificăm totuși o parolă, ca răspunsul să dureze la fel de mult.
// Altfel, după timpul de răspuns s-ar putea afla ce emailuri au cont.
export async function verifyAgainstDummy(password) {
  dummyHash ??= hashPassword('parola-fictiva-pentru-timp-constant');
  await verifyPassword(await dummyHash, password);
  return false;
}
