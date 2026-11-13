# SECURITY.md — Filmoteca

Modelul amenințărilor pentru Filmoteca: ce date protejăm, cine ce are voie să vadă și, pentru fiecare protecție, unde anume e implementată în cod. Toate verificările rulează **pe server**, la fiecare cerere: interfața doar ascunde butoane, nu protejează nimic.

## 1. Date sensibile și cine le vede

| Date | Cine le vede | Cum sunt protejate |
|------|--------------|--------------------|
| Parola | nimeni | se salvează doar hash-ul Argon2id; nu iese niciodată din server |
| Tokenul de sesiune | doar browserul utilizatorului | cookie `HttpOnly`; în baza de date stă doar hash-ul SHA-256 |
| Emailul | proprietarul și adminii | apare doar în `/api/me/profile`, `/api/auth/me` (pentru sine) și `/api/admin/users` |
| Lista mea (stare, dată, notițe) | **doar** proprietarul, nici adminii | fiecare interogare filtrează după `user_id` din sesiune |
| Jurnalul de audit | adminii | rută sub `/api/admin` |
| Filme, postere, recenzii, numele de utilizator | toată lumea | public, prin regula aplicației |

## 2. Regulile aplicației

| Acțiune | Vizitator | `user` | `admin` |
|---------|:---------:|:------:|:-------:|
| Vede catalogul, filmele, recenziile | da | da | da |
| Adaugă un film / poster | — | da | da |
| Editează un film | — | doar al lui | orice film |
| Șterge un film | — | doar al lui, dacă nu l-au recenzat sau salvat alții | orice film |
| Scrie o recenzie | — | una per film | una per film |
| Editează o recenzie | — | doar a lui | doar a lui |
| Șterge o recenzie | — | doar a lui | orice recenzie |
| Lista mea, profilul | — | doar ale lui | doar ale lui |
| Vede utilizatorii, raportul, jurnalul | — | — | da |
| Blochează un cont | — | — | doar conturi `user`, nu pe sine, nu alți admini |
| Schimbă rolul cuiva | — | — | nimeni; rolurile vin doar din seed |

**Comportamente acceptate, care nu sunt considerate încălcări:**
- **Email deja folosit:** la înregistrare se poate afla că un email are deja cont (răspuns 409). E limitat la 20 de încercări pe oră per IP. Numele de utilizator sunt oricum publice.
- **Film folosit de alții:** când proprietarul încearcă să-și șteargă un film recenzat sau salvat de alții, află că filmul e folosit (409). Nu află de cine și nici ce au scris.
- **Editarea filmelor recenzate:** proprietarul își poate edita filmul și după ce alții l-au recenzat.
- **Data vizionării:** se acceptă cel mult ziua de mâine (după ora UTC), din cauza fusurilor orare.
- **Conturile demo din README** sunt publice, pentru că așa cere cursul. Într-o instalare reală se schimbă din `.env`.

## 3. Protecții de bază

| # | Atac | Apărare | Unde în cod |
|---|------|---------|-------------|
| 1 | Furtul parolelor din baza de date | Argon2id (64 MiB, t=3, p=4). Hash-ul nu e trimis niciodată clientului | `src/services/passwords.js`, `toPrivateUser` în `src/models/users.js` |
| 2 | Forță brută, credential stuffing | max. 5 încercări greșite / 15 min per email, 20 per IP. `X-Forwarded-For` e ignorat dacă `TRUST_PROXY=0` | `src/middleware/rateLimits.js`, `trustProxy` în `src/config.js` |
| 3 | Aflarea conturilor prin login | același mesaj și același timp de răspuns. Pentru emailurile fără cont se verifică un hash fictiv | `src/routes/auth.routes.js`, `verifyAgainstDummy` în `src/services/passwords.js` |
| 4 | Sesiuni slabe, furt de sesiune, session fixation | token aleator de 256 biți. Cookie `HttpOnly`, `SameSite=Strict`, `Secure` sub HTTPS. Expiră în 24 h. Token nou la fiecare login. Logout-ul șterge sesiunea din baza de date. Blocarea contului și schimbarea parolei închid celelalte sesiuni | `src/models/sessions.js`, `src/services/sessionCookie.js`, `src/routes/auth.routes.js`, `src/routes/me.routes.js` |
| 5 | CSRF | `SameSite=Strict`. Cererile care modifică date sunt verificate după `Sec-Fetch-Site`/`Origin`. Se acceptă doar JSON (sau multipart pentru poster) | `crossOriginGuard` în `src/middleware/security.js`, `src/app.js` |
| 6 | Escaladarea privilegiilor | rolul nu vine niciodată din cerere. `requireRole('admin')` protejează tot `/api/admin`. Schemele resping câmpul `role` | `src/middleware/auth.js`, `src/routes/admin.routes.js`, `src/validation/*.schemas.js` |
| 7 | IDOR (schimbarea unui id) | la fiecare modificare se verifică proprietarul: `canManage` / `isAuthor` → 403. Lista privată caută după `id` **și** `user_id` → 404, fără să dezvăluie că intrarea există | `src/services/permissions.js`, `src/routes/films.routes.js`, `src/routes/reviews.routes.js`, `src/models/watchlist.js` |
| 8 | Mass assignment (`owner_id`, `user_id`, `role`) | `z.strictObject` pe toate corpurile de cerere. Proprietarul și autorul vin doar din sesiune | `src/validation/`, rutele din `src/routes/` |
| 9 | Expunerea datelor private | coloanele sunt cerute explicit în SQL, iar răspunsurile trec prin funcțiile `to…Json`. `/api/me` lucrează doar cu propriul cont. API-ul trimite `Cache-Control: no-store` | `src/models/*.js`, `src/routes/me.routes.js`, `src/app.js` |
| 10 | XSS stocat și reflectat | frontend-ul afișează doar cu `textContent`/`createElement`, niciodată cu `innerHTML`. CSP fără scripturi inline. `nosniff`. Caracterele invizibile și de inversare a textului sunt respinse | `public/js/*.js`, `src/middleware/security.js`, `src/validation/common.js` |
| 11 | Injecție SQL / NoSQL | doar interogări parametrizate (`?`). SQL-ul e compus doar din bucăți fixe. `ORDER BY` se alege dintr-o listă fixă. `LIKE` cu escape. Listele și obiectele din URL sau JSON sunt respinse | `src/models/films.js`, `src/models/admin.js`, `src/services/search.js`, `src/validation/` |
| 12 | Fișiere malițioase, fișiere prea mari | max. 2 MB, exact un fișier, fără alte câmpuri. Conținutul e verificat de sharp: doar JPEG/PNG/WebP reale. Imaginea e refăcută ca WebP fără metadate (EXIF/GPS). Permisiunile se verifică înainte de citirea fișierului | `src/services/posters.js`, `src/middleware/upload.js`, `src/routes/films.routes.js` |
| 13 | Path traversal, citirea fișierelor interne | numele fișierelor e un UUID generat de server. Se servesc static doar `public/` și `uploads/posters/`, fără dotfiles | `savePoster` în `src/services/posters.js`, `src/app.js` |
| 14 | Clickjacking | `frame-ancestors 'none'` și `X-Frame-Options` | `src/middleware/security.js` |
| 15 | Scurgeri prin mesajele de eroare | handler generic, fără stack trace sau SQL. 400 pentru JSON invalid. Pagină 404 proprie. Fără `X-Powered-By` | `src/middleware/errors.js`, `src/app.js` |
| 16 | Secrete în depozit | `.env` e în `.gitignore`, iar în depozit e livrat `.env.example`. Parolele demo vin din `.env`. Conturile demo nelistate primesc parole aleatorii | `.gitignore`, `scripts/seed-lib.js` |
| 17 | Dependențe vulnerabile | versiuni fixate exact, `npm audit`: 0 vulnerabilități la predare | `package.json`, `package-lock.json` |
| 18 | Abuzul de drepturi de admin | jurnal de audit pentru orice editare/ștergere făcută de un admin pe datele altcuiva și pentru blocări | `src/models/adminLog.js`, `src/routes/admin.routes.js` |

## 4. Cum am verificat

- **73 de teste automate** (`npm test`), dintre care peste 20 verifică controlul accesului. Exemple: Ana primește 403 când editează filmul sau recenzia lui Mihai, 404 la lista lui privată, 403 pe orice rută `/api/admin`.
- **Atac automat** (`npm run attack -- <adresa>`): 126 de verificări pe aplicația pornită, cu 0 probleme găsite la predare. Acoperă escaladare, IDOR, scurgeri de date, injecții SQL/NoSQL, XSS stocat și reflectat, fișiere malițioase, path traversal, CSRF, sesiuni, forță brută și reguli de business.
- **`npm audit`** fără vulnerabilități.

## 5. Limitări cunoscute

- Atacurile de tip denial-of-service sunt în afara domeniului provocării. Limitele de încercări sunt ținute în memorie și se resetează la repornire.
- Nu există verificare prin email sau autentificare în doi pași.
- Local aplicația rulează pe HTTP. Publicată pe HTTPS, trebuie setate în `.env` `COOKIE_SECURE=true` (activează și HSTS) și, în spatele unui proxy, `TRUST_PROXY=1`.
