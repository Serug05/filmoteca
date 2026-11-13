// Validează corpul cererii cu o schemă zod. Doar datele validate (și curățate) ajung în rută.
export function validateBody(schema) {
  return (req, res, next) => {
    const result = schema.safeParse(req.body ?? {});
    if (!result.success) return res.status(400).json(formatValidationError(result.error));
    req.body = result.data;
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
