import { api } from './api.js';
import { loadCollage } from './collage.js';
import { clearErrors, setBusy, showErrors } from './forms.js';
import { renderNav } from './nav.js';

if (await renderNav()) location.replace('/');
loadCollage(document.querySelector('[data-collage]'));

const form = document.querySelector('[data-login-form]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);
  setBusy(form, true);

  try {
    await api('/auth/login', {
      method: 'POST',
      body: { email: form.elements.email.value, password: form.elements.password.value },
    });
    location.replace('/');
  } catch (error) {
    showErrors(form, error);
  } finally {
    setBusy(form, false);
  }
});
