import { z } from 'zod';

// strictObject respinge orice câmp în plus (de ex. "role": "admin" trimis la înregistrare).

const email = z
  .string({ error: 'Emailul este obligatoriu.' })
  .trim()
  .toLowerCase()
  .max(254, { error: 'Emailul este prea lung.' })
  .pipe(z.email({ error: 'Emailul nu este valid.' }));

export const registerSchema = z.strictObject({
  username: z
    .string({ error: 'Numele de utilizator este obligatoriu.' })
    .trim()
    .min(3, { error: 'Numele de utilizator trebuie să aibă cel puțin 3 caractere.' })
    .max(30, { error: 'Numele de utilizator poate avea cel mult 30 de caractere.' })
    .regex(/^[A-Za-z0-9_.-]+$/, { error: 'Folosește doar litere, cifre, punct, cratimă sau underscore.' }),
  email,
  password: z
    .string({ error: 'Parola este obligatorie.' })
    .min(10, { error: 'Parola trebuie să aibă cel puțin 10 caractere.' })
    .max(128, { error: 'Parola poate avea cel mult 128 de caractere.' }),
});

export const loginSchema = z.strictObject({
  email,
  password: z
    .string({ error: 'Parola este obligatorie.' })
    .min(1, { error: 'Parola este obligatorie.' })
    .max(128, { error: 'Parola poate avea cel mult 128 de caractere.' }),
});
