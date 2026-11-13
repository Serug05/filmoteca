import { api } from './api.js';
import { formatDate } from './components.js';
import { clearErrors, setBusy, showErrors, showSuccess } from './forms.js';
import { requireUser } from './nav.js';

const emailForm = document.querySelector('[data-email-form]');
const passwordForm = document.querySelector('[data-password-form]');
const ROLE_LABELS = { user: 'Utilizator', admin: 'Administrator' };

function renderProfile(profile) {
  document.querySelector('[data-username]').textContent = profile.username;
  document.querySelector('[data-email]').textContent = profile.email;
  document.querySelector('[data-role]').textContent = ROLE_LABELS[profile.role] ?? profile.role;
  document.querySelector('[data-since]').textContent = formatDate(profile.createdAt);
  for (const node of document.querySelectorAll('[data-stat]')) {
    node.textContent = String(profile.stats[node.dataset.stat]);
  }
  document.querySelector('[data-profile]').hidden = false;
}

async function changeEmail(event) {
  event.preventDefault();
  clearErrors(emailForm);
  setBusy(emailForm, true);
  try {
    const { email, currentPassword } = emailForm.elements;
    const { profile } = await api('/me/profile', {
      method: 'PUT',
      body: { email: email.value, currentPassword: currentPassword.value },
    });
    renderProfile(profile);
    emailForm.reset();
    showSuccess(emailForm, 'Emailul a fost schimbat.');
  } catch (error) {
    showErrors(emailForm, error);
  } finally {
    setBusy(emailForm, false);
  }
}

async function changePassword(event) {
  event.preventDefault();
  clearErrors(passwordForm);

  const { currentPassword, newPassword, confirm } = passwordForm.elements;
  if (newPassword.value !== confirm.value) {
    showErrors(passwordForm, { fields: { confirm: 'Parolele nu coincid.' } });
    return;
  }

  setBusy(passwordForm, true);
  try {
    await api('/me/password', {
      method: 'PUT',
      body: { currentPassword: currentPassword.value, newPassword: newPassword.value },
    });
    passwordForm.reset();
    showSuccess(passwordForm, 'Parola a fost schimbată. Celelalte sesiuni ale contului au fost închise.');
  } catch (error) {
    showErrors(passwordForm, error);
  } finally {
    setBusy(passwordForm, false);
  }
}

async function main() {
  if (!(await requireUser())) return;
  emailForm.addEventListener('submit', changeEmail);
  passwordForm.addEventListener('submit', changePassword);

  try {
    const { profile } = await api('/me/profile');
    renderProfile(profile);
  } catch (error) {
    document.querySelector('[data-page-error]').textContent = error.message;
  }
}

main();
