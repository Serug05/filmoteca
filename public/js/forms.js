export function clearErrors(form) {
  for (const slot of form.querySelectorAll('[data-error-for], [data-form-error], [data-form-success]')) {
    slot.textContent = '';
  }
  for (const field of form.querySelectorAll('[aria-invalid]')) field.removeAttribute('aria-invalid');
}

// Afișează erorile primite de la server: fiecare lângă câmpul ei, plus un mesaj general.
export function showErrors(form, error) {
  const fields = error.fields ?? {};
  let markedField = false;

  for (const [name, message] of Object.entries(fields)) {
    const slot = form.querySelector(`[data-error-for="${CSS.escape(name)}"]`);
    if (!slot) continue;
    slot.textContent = message;
    form.elements.namedItem(name)?.setAttribute('aria-invalid', 'true');
    markedField = true;
  }

  const general = form.querySelector('[data-form-error]');
  general.textContent = fields._ ?? (markedField ? 'Verifică câmpurile marcate.' : error.message);
}

export function showSuccess(form, message) {
  form.querySelector('[data-form-success]').textContent = message;
}

export function setBusy(form, busy) {
  form.querySelector('button[type="submit"]').disabled = busy;
}
