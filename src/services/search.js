// Text pregătit pentru căutare: litere mici și fără diacritice („Lăzărescu” → „lazarescu”),
// ca „fratia” să găsească „Frăția inelului”.
export function normalizeText(value) {
  return String(value ?? '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
}

// În LIKE, % și _ sunt caractere speciale. Le marcăm cu \ ca să fie căutate ca text obișnuit,
// iar interogarea folosește ESCAPE '\'.
export function likePattern(text) {
  return `%${normalizeText(text).replace(/[\\%_]/g, '\\$&')}%`;
}
