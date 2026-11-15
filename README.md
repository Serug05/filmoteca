# Filmoteca

Aplicație web pentru o listă de filme: un catalog public de filme, recenzii cu note de la 1 la 5 și o listă privată de vizionare pentru fiecare utilizator. Proiect pentru cursul de Aplicații Web (tema 6, „Listă de filme de văzut”) și pentru Provocarea 19/20.

Modelul de securitate (ce date sunt sensibile, cine ce vede și unde e fiecare protecție în cod) e descris în [SECURITY.md](SECURITY.md).

## Roluri

| Rol     | Ce poate face |
|---------|---------------|
| vizitator | vede catalogul, filmele și recenziile |
| `user`  | tot ce poate un vizitator, plus: adaugă filme și postere, își editează/șterge propriile filme*, scrie câte o recenzie la fiecare film, își ține lista privată și își administrează profilul |
| `admin` | tot ce poate un `user`, plus: vede toți utilizatorii (cu emailul), blochează/deblochează conturi de `user`, editează sau șterge orice film, șterge orice recenzie, vede raportul și jurnalul de audit |

Adminul **nu** poate: vedea listele private ale altora, scrie sau edita recenzii în numele altcuiva, bloca alți admini sau propriul cont, schimba rolul cuiva. Rolurile se stabilesc doar prin seed.

## Tehnologii

- **Client:** HTML, CSS și JavaScript simplu (fără framework)
- **Server:** Node.js cu Express 5
- **Bază de date:** SQLite (better-sqlite3)
- **Parole:** Argon2id · **Sesiuni:** token aleator în cookie `HttpOnly`, salvat ca hash în baza de date
- **Validare:** zod · **Antete de securitate:** helmet (cu Content Security Policy)
- **Postere:** multer (primire, max. 2 MB) + sharp (verifică imaginea și o reface ca WebP, fără metadate)
- **Grafică 3D (doar decor):** Three.js, servit de pe propriul server: lanțul cromat care trece prin prima pagină și sfera de postere (`public/js/scene3d.js`). Fără WebGL sau cu „animații reduse” activat în sistem, pagina rămâne statică.
- **Teste:** `node --test` + supertest

## Rulare

Aplicația pornește la **http://localhost:3000**. La prima pornire își creează singură fișierul `.env` (din `.env.example`) și, dacă baza de date e goală, o umple cu datele demo.

### Varianta 1: Docker (o singură comandă)

Necesită Docker cu Docker Compose.

```bash
docker compose up --build
```

Baza de date și posterele se păstrează în volume Docker între reporniri. Oprire: `Ctrl+C`, apoi `docker compose down`.

### Varianta 2: Node.js

Necesită Node.js 22 sau mai nou.

```bash
npm ci --ignore-scripts
npm start
```

`--ignore-scripts` folosește modulele native deja compilate din pachete (pentru Linux, Windows și Mac cu Apple Silicon), fără să fie nevoie de un compilator. Pe un Mac cu procesor Intel, folosește `npm ci` simplu.

### Alte comenzi

| Comandă         | Ce face |
|-----------------|---------|
| `npm run seed`  | resetează baza de date la datele demo (șterge tot ce s-a adăugat) |
| `npm run dev`   | pornește serverul și îl repornește la fiecare modificare de cod |
| `npm test`      | rulează testele automate |
| `npm run attack -- http://localhost:3000` | atacă aplicația pornită (126 de verificări de securitate); creează date de test, deci rulează apoi `npm run seed` |

### Setări (`.env`)

| Variabilă             | Implicit         | Ce face |
|-----------------------|------------------|---------|
| `PORT`                | `3000`           | portul serverului |
| `DB_PATH`             | `data/filme.db`  | fișierul bazei de date SQLite |
| `UPLOADS_DIR`         | `uploads`        | folderul pentru postere |
| `COOKIE_SECURE`       | `false`          | pune `true` când aplicația e servită prin HTTPS |
| `TRUST_PROXY`         | `0`              | numărul de proxy-uri din fața aplicației (de ex. `1` în spatele unui server HTTPS) |
| `SESSION_TTL_HOURS`   | `24`             | cât rămâne valabilă o sesiune |
| `SEED_ADMIN_PASSWORD` | vezi `.env.example` | parola contului demo de admin |
| `SEED_USER_PASSWORD`  | vezi `.env.example` | parola contului demo de utilizator |

Dacă aplicația e publicată la o adresă publică, schimbă `SEED_ADMIN_PASSWORD` și `SEED_USER_PASSWORD` înainte de prima pornire: valorile implicite sunt publice în acest depozit.

## Conturi de test

Create automat la prima pornire (sau cu `npm run seed`):

| Rol   | Email              | Parolă                                                            |
|-------|--------------------|-------------------------------------------------------------------|
| admin | `admin@filme.test` | valoarea `SEED_ADMIN_PASSWORD` din `.env` (implicit `Admin-Filme-2026!`) |
| user  | `ana@filme.test`   | valoarea `SEED_USER_PASSWORD` din `.env` (implicit `Ana-Filme-2026!`)    |

Celelalte conturi demo (`admin2`, `mihai`, `elena`) primesc parole aleatorii la fiecare seed.

Filmele demo primesc postere **generate**: artă abstractă originală, colorată după gen (`scripts/poster-art.js`). Aplicația nu folosește postere reale, protejate de drepturi de autor. Orice poster poate fi înlocuit din „Editează filmul”.

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
  models/           interogările pe tabele (users, sessions, films, reviews, watchlist, admin, adminLog)
  routes/           rutele API (auth, films, reviews, me, admin, genres)
  middleware/       autentificare, roluri, validare, CSRF, limite de încercări, încărcări, erori
  services/         parole (Argon2), cookie-ul de sesiune, permisiuni, postere, căutare
  validation/       schemele zod pentru datele primite
public/             paginile HTML, CSS și JavaScript-ul din browser
scripts/            pregătirea la prima pornire (setup.js), seed-ul, datele demo și scriptul de atac
tests/              testele automate
uploads/            posterele încărcate (creat automat, nu intră în Git)
data/               baza de date SQLite (creată automat, nu intră în Git)
Dockerfile          imaginea aplicației
docker-compose.yml  pornirea cu Docker
```

## Pagini

| Pagină              | Ce conține                                              |
|---------------------|---------------------------------------------------------|
| `/`                 | catalogul de filme: căutare, filtru pe gen, sortare, paginare |
| `/film.html?id=…`   | detaliile unui film și recenziile lui; editare și ștergere pentru proprietar |
| `/film-form.html`   | adăugarea sau editarea (`?id=…`) unui film, cu poster    |
| `/lista-mea.html`   | lista privată de vizionare: de văzut / văzute, cu notițe |
| `/profil.html`      | profilul: emailul, statistici, schimbarea emailului și a parolei |
| `/admin.html`       | doar pentru admin: raport, utilizatori, moderarea recenziilor, jurnal |
| orice altă adresă   | pagina 404                                              |
| `/login.html`       | autentificare                                           |
| `/register.html`    | cont nou                                                |

## API

| Metodă | Rută                     | Autentificare           | Ce face                                              |
|--------|--------------------------|-------------------------|------------------------------------------------------|
| POST   | `/api/auth/register`     | nu                      | creează un cont și pornește sesiunea                  |
| POST   | `/api/auth/login`        | nu                      | autentificare                                         |
| POST   | `/api/auth/logout`       | nu                      | închide sesiunea (o șterge de pe server)              |
| GET    | `/api/auth/me`           | opțional                | utilizatorul conectat sau `null`                      |
| GET    | `/api/films`             | nu                      | lista de filme, câte 12 pe pagină (vezi parametrii mai jos) |
| GET    | `/api/films/:id`         | nu                      | detaliile unui film                                   |
| POST   | `/api/films`             | da                      | adaugă un film (proprietar = utilizatorul conectat)   |
| PUT    | `/api/films/:id`         | da, proprietar sau admin | editează filmul                                       |
| DELETE | `/api/films/:id`         | da, proprietar sau admin | șterge filmul*                                        |
| POST   | `/api/films/:id/poster`  | da, proprietar sau admin | încarcă posterul (JPG/PNG/WebP, max. 2 MB)            |
| GET    | `/api/films/:id/reviews` | nu                      | recenziile unui film                                  |
| POST   | `/api/films/:id/reviews` | da                      | scrie o recenzie (una per utilizator și film)         |
| PUT    | `/api/reviews/:id`       | da, doar autorul        | editează recenzia                                     |
| DELETE | `/api/reviews/:id`       | da, autorul sau admin   | șterge recenzia                                       |
| GET    | `/api/genres`            | nu                      | lista de genuri                                       |
| GET    | `/api/me/profile`        | da                      | profilul propriu (email, statistici)                  |
| PUT    | `/api/me/profile`        | da + parola actuală     | schimbă emailul                                       |
| PUT    | `/api/me/password`       | da + parola actuală     | schimbă parola și închide celelalte sesiuni           |
| GET    | `/api/me/watchlist`      | da                      | lista privată (`?status=de_vazut\|vazut`, `?film=id`)  |
| POST   | `/api/me/watchlist`      | da                      | adaugă un film în listă                               |
| PUT    | `/api/me/watchlist/:id`  | da, doar proprietarul   | schimbă starea, data vizionării sau notița             |
| DELETE | `/api/me/watchlist/:id`  | da, doar proprietarul   | scoate filmul din listă                               |

| GET    | `/api/admin/stats`       | admin                   | raport: totaluri, cele mai bine notate filme, cei mai activi recenzenți |
| GET    | `/api/admin/users`       | admin                   | utilizatorii, cu email (`?q=` caută după nume sau email) |
| PATCH  | `/api/admin/users/:id`   | admin                   | blochează/deblochează un cont de `user` (`{ "blocked": true }`) |
| GET    | `/api/admin/reviews`     | admin                   | recenziile recente, pentru moderare                   |
| GET    | `/api/admin/log`         | admin                   | jurnalul acțiunilor administratorilor                 |

Rutele `/api/me/...` lucrează doar cu datele utilizatorului conectat. O intrare din lista altcuiva răspunde 404, ca și cum n-ar exista, ca să nu se afle nici măcar că există.

Parametrii pentru `GET /api/films`: `q` (caută în titlu, fără să țină cont de majuscule sau diacritice), `genre` (un gen din `/api/genres`), `sort` (`recent`, `rating`, `year` sau `title`) și `page`.

\* Proprietarul nu își poate șterge filmul dacă alți utilizatori l-au recenzat sau l-au pus în lista lor: altfel ar șterge, indirect, datele lor. În acest caz doar un administrator îl poate șterge.

## Provocarea 19/20: lista de eligibilitate

| Cerință | Unde se vede |
|---------|--------------|
| ✅ Înregistrare, autentificare, deconectare; parole hash-uite cu Argon2 (F1) | `/register.html`, `/login.html`, `src/routes/auth.routes.js`, `src/services/passwords.js` |
| ✅ Cel puțin 2 roluri, acțiunile de admin impuse pe server (F2) | `user` și `admin`; `requireRole('admin')` în `src/routes/admin.routes.js` |
| ✅ Cel puțin 3 entități relaționate, într-o bază de date reală (F3) | SQLite: `users` → `films` → `reviews`, plus `watchlist`, `sessions`, `admin_log` (`src/db/schema.sql`) |
| ✅ CRUD complet cu verificarea proprietarului pe cel puțin 2 entități (F4) | filme, recenzii și lista mea (`src/routes/`, `src/services/permissions.js`) |
| ✅ Date private pentru fiecare utilizator (F5) | lista mea cu notițe și emailul (`/lista-mea.html`, `/profil.html`, `src/routes/me.routes.js`) |
| ✅ Conținut generat de utilizatori, afișat altora (F6) | filmele (titlu, descriere, poster) și recenziile |
| ✅ Căutare / filtru pe baza unei interogări în baza de date (F7) | `/?q=…&genre=…&sort=…`, `src/models/films.js` |
| ✅ Încărcare de fișiere cu limite de tip și dimensiune (F8) | posterul filmului: JPG/PNG/WebP, max. 2 MB (`src/services/posters.js`) |
| ✅ 6+ pagini, 8+ endpoint-uri de date (4+ cu autentificare), 3+ formulare validate pe server | 8 pagini; 27 de endpoint-uri, dintre care 19 cer autentificare; 8 formulare validate cu zod (înregistrare, login, film, poster, recenzie, listă, email, parolă) |
| ✅ Rulează cu o singură comandă | `docker compose up --build` sau `npm start` după instalare |
| ✅ Date de seed: 2+ utilizatori pentru fiecare rol, 20+ înregistrări | 2 admini, 3 utilizatori, 43 de înregistrări (`scripts/seed-lib.js`, testat în `tests/seed.test.js`) |
| ✅ README, SECURITY.md și .env.example incluse; niciun secret în depozit | `.env` e în `.gitignore` |
| ✅ Cel puțin 10 teste automate, dintre care 3 pentru controlul accesului | 74 de teste, peste 20 pentru controlul accesului (`npm test`) |
| ✅ Commit-uri de la fiecare membru al echipei | proiect individual, câte un commit pentru fiecare etapă |
