// Validează corpul cererii cu o schemă zod. Doar datele validate (și curățate) ajung în rută.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return res.status(400).json(formatValidationError(result.error));
    req.body = result.data;
    next();
  };
}

// La fel pentru parametrii din URL (?page=2). În Express 5, req.query nu poate fi înlocuit,
// așa că valorile validate ajung în req.validQuery.
export function validateQuery(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) return res.status(400).json(formatValidationError(result.error));
    req.validQuery = result.data;
    next();
  };
}

function formatValidationError(error) {
  const fields = {};
  for (const issue of error.issues) {
    if (issue.code === 'unrecognized_keys') {
      fields._ = 'Cererea conține câmpuri nepermise.';
      continue;
    }
    const field = issue.path[0] ?? '_';
    fields[field] ??= issue.message;
  }
  return { error: 'Date invalide.', fields };
}
