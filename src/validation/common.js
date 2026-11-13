// Id-urile din URL: doar numere întregi pozitive scrise normal („12”, nu „012”, „1.5”, „-1” sau „1e3”).
export function parseId(value) {
  return /^[1-9]\d{0,9}$/.test(value ?? '') ? Number(value) : null;
}

// Caractere de control invizibile (în afară de rând nou și tab), nepermise în textele utilizatorilor.
const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export function withoutControlChars(schema) {
  return schema.refine((value) => !CONTROL_CHARS.test(value), { error: 'Textul conține caractere invizibile nepermise.' });
}
