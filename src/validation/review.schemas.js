import { z } from 'zod';
import { withoutControlChars } from './common.js';

// strictObject: câmpuri ca user_id sau film_id trimise de client sunt respinse.
export const reviewSchema = z.strictObject({
  rating: z
    .number({ error: 'Alege o notă de la 1 la 5.' })
    .int({ error: 'Nota trebuie să fie un număr întreg de la 1 la 5.' })
    .min(1, { error: 'Nota trebuie să fie de la 1 la 5.' })
    .max(5, { error: 'Nota trebuie să fie de la 1 la 5.' }),
  body: withoutControlChars(
    z.string({ error: 'Scrie câteva cuvinte despre film.' })
      .trim()
      .min(3, { error: 'Recenzia trebuie să aibă cel puțin 3 caractere.' })
      .max(1000, { error: 'Recenzia poate avea cel mult 1000 de caractere.' }),
  ),
});
