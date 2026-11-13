# Filmoteca

Aplicație web pentru o listă de filme: un catalog public de filme, recenzii cu note de la 1 la 5 și o listă privată de vizionare pentru fiecare utilizator. Proiect pentru cursul de Aplicații Web (tema 6, „Listă de filme de văzut”) și pentru Provocarea 19/20.

> **Stadiu:** etapa 2 din 7. Gata: autentificarea, baza de date, datele demo, catalogul de filme (adăugare, editare, ștergere) și posterele.

## Tehnologii

- **Client:** HTML, CSS și JavaScript simplu (fără framework)
- **Server:** Node.js cu Express 5
- **Bază de date:** SQLite (better-sqlite3)
- **Parole:** Argon2id · **Sesiuni:** token aleator în cookie `HttpOnly`, salvat ca hash în baza de date
- **Validare:** zod · **Antete de securitate:** helmet (cu Content Security Policy)
- **Postere:** multer (primire, max. 2 MB) + sharp (verifică imaginea și o reface ca WebP, fără metadate)
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
  models/           interogările pe tabele (users, sessions, films)
  routes/           rutele API (auth, films, genres)
  middleware/       autentificare, roluri, validare, CSRF, limite de încercări, încărcări, erori
  services/         parole (Argon2), cookie-ul de sesiune, permisiuni, postere
  validation/       schemele zod pentru datele primite
public/             paginile HTML, CSS și JavaScript-ul din browser
scripts/            scriptul de seed și datele demo
tests/              testele automate
uploads/            posterele încărcate (creat automat, nu intră în Git)
```

## Pagini

| Pagină              | Ce conține                                              |
|---------------------|---------------------------------------------------------|
| `/`                 | catalogul de filme, cu paginare                          |
| `/film.html?id=…`   | detaliile unui film; editare și ștergere pentru proprietar |
| `/film-form.html`   | adăugarea sau editarea (`?id=…`) unui film, cu poster    |
| `/login.html`       | autentificare                                           |
| `/register.html`    | cont nou                                                |

## API

| Metodă | Rută                     | Autentificare           | Ce face                                              |
|--------|--------------------------|-------------------------|------------------------------------------------------|
| POST   | `/api/auth/register`     | nu                      | creează un cont și pornește sesiunea                  |
| POST   | `/api/auth/login`        | nu                      | autentificare                                         |
| POST   | `/api/auth/logout`       | nu                      | închide sesiunea (o șterge de pe server)              |
| GET    | `/api/auth/me`           | opțional                | utilizatorul conectat sau `null`                      |
| GET    | `/api/films?page=`       | nu                      | lista de filme, câte 12 pe pagină                      |
| GET    | `/api/films/:id`         | nu                      | detaliile unui film                                   |
| POST   | `/api/films`             | da                      | adaugă un film (proprietar = utilizatorul conectat)   |
| PUT    | `/api/films/:id`         | da, proprietar sau admin | editează filmul                                       |
| DELETE | `/api/films/:id`         | da, proprietar sau admin | șterge filmul*                                        |
| POST   | `/api/films/:id/poster`  | da, proprietar sau admin | încarcă posterul (JPG/PNG/WebP, max. 2 MB)            |
| GET    | `/api/genres`            | nu                      | lista de genuri                                       |

\* Proprietarul nu își poate șterge filmul dacă alți utilizatori l-au recenzat sau l-au pus în lista lor: altfel ar șterge, indirect, datele lor. În acest caz doar un administrator îl poate șterge.
