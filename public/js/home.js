import { renderNav } from './nav.js';

const user = await renderNav();

document.querySelector('[data-greeting]').textContent = user
  ? `Ești conectat ca ${user.username}.`
  : 'Intră în cont sau creează unul ca să începi.';
