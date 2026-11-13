import { z } from 'zod';
import { withoutControlChars } from './common.js';

const page = z.coerce
  .number({ error: 'Pagina nu este validă.' })
  .int({ error: 'Pagina nu este validă.' })
  .min(1, { error: 'Pagina nu este validă.' })
  .max(1000, { error: 'Pagina nu este validă.' })
  .default(1);

export const pageQuerySchema = z.object({ page });

export const adminUsersQuerySchema = z.object({
  page,
  q: z.preprocess(
    (value) => (value === '' ? undefined : value),
    withoutControlChars(
      z.string({ error: 'Textul căutat nu este valid.' })
        .trim()
        .max(100, { error: 'Textul căutat poate avea cel mult 100 de caractere.' }),
    ).optional(),
  ),
});

// Singurul lucru pe care adminul îl poate schimba la un cont este blocarea.
// strictObject: un câmp „role” sau „email” trimis aici e respins, deci rolurile nu se pot schimba prin API.
export const blockUserSchema = z.strictObject({
  blocked: z.boolean({ error: 'Valoarea „blocked” trebuie să fie true sau false.' }),
});
