import { z } from 'zod';
import { GENRES } from '../constants.js';
import { withoutControlChars } from './common.js';

const MAX_YEAR = new Date().getFullYear() + 5;

// strictObject: câmpuri ca owner_id sau poster trimise de client sunt respinse.
export const filmSchema = z.strictObject({
  title: withoutControlChars(
    z.string({ error: 'Titlul este obligatoriu.' })
      .trim()
      .min(1, { error: 'Titlul este obligatoriu.' })
      .max(120, { error: 'Titlul poate avea cel mult 120 de caractere.' }),
  ),
  year: z
    .number({ error: 'Anul trebuie să fie un număr.' })
    .int({ error: 'Anul trebuie să fie un număr întreg.' })
    .min(1888, { error: 'Anul trebuie să fie cel puțin 1888.' })
    .max(MAX_YEAR, { error: `Anul poate fi cel mult ${MAX_YEAR}.` }),
  genre: z.enum(Object.keys(GENRES), { error: 'Alege un gen din listă.' }),
  description: withoutControlChars(
    z.string({ error: 'Descrierea trebuie să fie text.' })
      .trim()
      .max(1000, { error: 'Descrierea poate avea cel mult 1000 de caractere.' }),
  ).default(''),
});

export const filmListQuerySchema = z.object({
  page: z.coerce
    .number({ error: 'Pagina nu este validă.' })
    .int({ error: 'Pagina nu este validă.' })
    .min(1, { error: 'Pagina nu este validă.' })
    .max(1000, { error: 'Pagina nu este validă.' })
    .default(1),
});
