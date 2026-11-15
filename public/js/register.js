import { api } from './api.js';
import { startAuthScene3d } from './auth-scene.js';
import { clearErrors, setBusy, showErrors } from './forms.js';
import { renderNav } from './nav.js';

if (await renderNav()) location.replace('/');
startAuthScene3d();

const form = document.querySelector('[data-register-form]');

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  clearErrors(form);

  const { username, email, password, confirm } = form.elements;

  // Verificare doar pentru confort; regulile reale le aplică serverul.
  if (password.value !== confirm.value) {
    showErrors(form, { fields: { confirm: 'Parolele nu coincid.' } });
    return;
  }

  setBusy(form, true);
  try {
    await api('/auth/register', {
      method: 'POST',
      body: { username: username.value, email: email.value, password: password.value },
    });
    location.replace('/');
  } catch (error) {
    showErrors(form, error);
  } finally {
    setBusy(form, false);
  }
});
