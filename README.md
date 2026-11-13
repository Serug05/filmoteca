# Filmoteca

Aplicație web pentru o listă de filme: un catalog public de filme, recenzii cu note de la 1 la 5 și o listă privată de vizionare pentru fiecare utilizator. Proiect pentru cursul de Aplicații Web (tema 6, „Listă de filme de văzut”) și pentru Provocarea 19/20.

> **Stadiu:** etapa 1 din 7 — structura proiectului, baza de date, datele demo și autentificarea.

## Tehnologii

- **Client:** HTML, CSS și JavaScript simplu (fără framework)
- **Server:** Node.js cu Express 5
- **Bază de date:** SQLite (better-sqlite3)
- **Parole:** Argon2id · **Sesiuni:** token aleator în cookie `HttpOnly`, salvat ca hash în baza de date
- **Validare:** zod · **Antete de securitate:** helmet (cu Content Security Policy)
- **Teste:** `node --test` + supertest

## Rulare

Necesită Node.js 22 sau mai nou.

```bash
npm install
cp .env.example .env
npm run seed
npm start
```

Aplicația pornește la http://localhost:3000. `npm run seed` resetează baza de date și o umple cu date demo.

## Conturi de test

Create de `npm run seed`:

| Rol   | Email              | Parolă                                                            |
|-------|--------------------|-------------------------------------------------------------------|
| admin | `admin@filme.test` | valoarea `SEED_ADMIN_PASSWORD` din `.env` (implicit `Admin-Filme-2026!`) |
| user  | `ana@filme.test`   | valoarea `SEED_USER_PASSWORD` din `.env` (implicit `Ana-Filme-2026!`)    |

Celelalte conturi demo (`admin2`, `mihai`, `elena`) primesc parole aleatorii la fiecare seed.

## Teste

```bash
npm test
```

## Structura

```
src/
  app.js            construiește aplicația Express (folosită și de teste)
  server.js         pornește serverul
  config.js         citește setările din .env
  constants.js      roluri, genuri de film, numele cookie-ului
  db/               schema SQL și conexiunea la baza de date
  models/           interogările pe tabele (users, sessions)
  routes/           rutele API
  middleware/       autentificare, roluri, validare, CSRF, limite de încercări, erori
  services/         parole (Argon2) și cookie-ul de sesiune
  validation/       schemele zod pentru datele primite
public/             paginile HTML, CSS și JavaScript-ul din browser
scripts/            scriptul de seed și datele demo
tests/              testele automate
```

## API (etapa 1)

| Metodă | Rută                 | Autentificare | Ce face                                  |
|--------|----------------------|---------------|------------------------------------------|
| POST   | `/api/auth/register` | nu            | creează un cont și pornește sesiunea      |
| POST   | `/api/auth/login`    | nu            | autentificare                             |
| POST   | `/api/auth/logout`   | nu            | închide sesiunea (o șterge de pe server)  |
| GET    | `/api/auth/me`       | opțional      | utilizatorul conectat sau `null`          |
