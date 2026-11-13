export class ApiError extends Error {
  constructor(status, body) {
    super(body?.error ?? 'A apărut o eroare neașteptată.');
    this.status = status;
    this.fields = body?.fields ?? {};
  }
}

// Toate cererile către server trec pe aici. Cookie-ul de sesiune e trimis automat de browser.
// `body` poate fi un obiect (trimis ca JSON) sau un FormData (pentru fișiere).
export async function api(path, { method = 'GET', body } = {}) {
  const options = { method, credentials: 'same-origin', headers: { Accept: 'application/json' } };
  if (body instanceof FormData) {
    options.body = body;
  } else if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`/api${path}`, options);
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new ApiError(response.status, data);
  return data;
}
