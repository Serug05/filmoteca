import { z } from 'zod';
import { email, newPassword } from './auth.schemas.js';

// Schimbările sensibile cer parola actuală: cineva care a găsit o sesiune deschisă
// (de ex. un laptop nesupravegheat) nu poate prelua contul schimbând emailul sau parola.
const currentPassword = z
  .string({ error: 'Introdu parola actuală.' })
  .min(1, { error: 'Introdu parola actuală.' })
  .max(128, { error: 'Parola poate avea cel mult 128 de caractere.' });

// strictObject: username sau role trimise aici sunt respinse; ele nu se pot schimba din profil.
export const emailChangeSchema = z.strictObject({ email, currentPassword });

export const passwordChangeSchema = z
  .strictObject({ currentPassword, newPassword })
  .refine((data) => data.newPassword !== data.currentPassword, {
    error: 'Parola nouă trebuie să fie diferită de cea actuală.',
    path: ['newPassword'],
  });
