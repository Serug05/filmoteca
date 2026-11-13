export function apiNotFound(req, res) {
  res.status(404).json({ error: 'Resursa nu există.' });
}

// Ultima linie de apărare: niciun detaliu intern (stack trace, mesaj SQL) nu ajunge la client.
export function errorHandler(err, req, res, next) {
  if (res.headersSent) return next(err);

  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Corpul cererii nu este JSON valid.' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Cererea este prea mare.' });
  }
  if (err.expose && err.status >= 400 && err.status < 500) {
    return res.status(err.status).json({ error: 'Cerere invalidă.' });
  }

  console.error(err);
  res.status(500).json({ error: 'A apărut o eroare internă.' });
}
