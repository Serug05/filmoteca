import { z } from 'zod';
import { WATCH_STATUSES } from '../constants.js';
import { withoutControlChars } from './common.js';

const isoDay = (date) => date.toISOString().slice(0, 10);

// Acceptăm și „mâine” (după ora UTC), ca utilizatorii din fusuri orare înaintea UTC să poată
// marca un film văzut în seara asta.
function latestAllowedDate() {
  return isoDay(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

const status = z.enum(Object.keys(WATCH_STATUSES), { error: 'Starea trebuie să fie „de văzut” sau „văzut”.' });

const watchedOn = z
  .iso.date({ error: 'Data nu este validă (format AAAA-LL-ZZ).' })
  .refine((date) => date >= '1888-01-01' && date <= latestAllowedDate(), {
    error: 'Data vizionării nu poate fi în viitor.',
  })
  .nullable()
  .optional();

const note = withoutControlChars(
  z.string({ error: 'Notița trebuie să fie text.' })
    .trim()
    .max(500, { error: 'Notița poate avea cel mult 500 de caractere.' }),
).default('');

// Regula pentru dată: un film „de văzut” nu are dată; unul „văzut” fără dată primește data de azi.
function applyDateRule(entry) {
  return {
    ...entry,
    watchedOn: entry.status === 'vazut' ? (entry.watchedOn ?? isoDay(new Date())) : null,
  };
}

// strictObject: câmpuri ca user_id trimise de client sunt respinse; proprietarul vine din sesiune.
export const watchlistCreateSchema = z
  .strictObject({
    filmId: z.number({ error: 'Alege un film.' }).int({ error: 'Alege un film.' }).positive({ error: 'Alege un film.' }),
    status: status.default('de_vazut'),
    watchedOn,
    note,
  })
  .transform(applyDateRule);

export const watchlistUpdateSchema = z.strictObject({ status, watchedOn, note }).transform(applyDateRule);

export const watchlistQuerySchema = z.object({
  status: z.preprocess((value) => (value === '' ? undefined : value), status.optional()),
  film: z.coerce.number({ error: 'Filmul nu este valid.' }).int({ error: 'Filmul nu este valid.' }).positive({ error: 'Filmul nu este valid.' }).optional(),
});
