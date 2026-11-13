# SECURITY.md — Filmoteca

Modelul amenințărilor: ce date protejăm, cine ce vede și unde e fiecare protecție în cod. Toate verificările rulează **pe server**, la fiecare cerere; interfața doar ascunde butoane.

## 1. Date sensibile

| Date | Cine le vede | Protecție |
|------|--------------|-----------|
| Parola | nimeni | doar hash Argon2id; nu iese din server |
| Tokenul de sesiune | doar browserul utilizatorului | cookie `HttpOnly`; în baza de date doar hash SHA-256 |
| Emailul | proprietarul și adminii | doar în `/api/auth/me`, `/api/me/profile`, `/api/admin/users` |
| Lista mea (stare, dată, notițe) | **doar** proprietarul, nici adminii | fiecare interogare filtrează după `user_id` din sesiune |
| Jurnalul de audit | adminii | sub `/api/admin` |
| Filme, postere, recenzii, nume de utilizator | toată lumea | public |

## 2. Reguli

| Acțiune | Vizitator | `user` | `admin` |
|---------|:---------:|:------:|:-------:|
| Vede catalogul, filmele, recenziile | da | da | da |
| Adaugă film / poster | — | da | da |
| Editează film | — | doar al lui | oricare |
| Șterge film | — | al lui, dacă nu e recenzat/salvat de alții | oricare |
| Scrie / editează recenzie | — | una per film / doar a lui | la fel ca `user` |
| Șterge recenzie | — | doar a lui | oricare |
| Lista mea, profilul | — | doar ale lui | doar ale lui |
| Utilizatori, raport, jurnal; blocare conturi | — | — | da (nu se poate bloca singur, nici alți admini) |
| Schimbă rolul cuiva | — | — | nimeni; rolurile vin doar din seed |

**Comportamente acceptate (nu sunt încălcări):** la înregistrare se poate afla că un email are cont (409; max. 20 de încercări/oră/IP). Proprietarul unui film află că filmul e folosit de alții (409 la ștergere), dar nu de cine. Proprietarul își poate edita filmul și după ce a fost recenzat. Data vizionării acceptă cel mult ziua de mâine (fusuri orare). Conturile demo din README sunt publice, cum cere cursul.

## 3. Protecții de bază

| # | Atac | Apărare | Unde în cod |
|---|------|---------|-------------|
| 1 | Furtul parolelor | Argon2id (64 MiB, t=3, p=4); hash-ul nu e trimis clientului | `services/passwords.js`, `toPrivateUser` (`models/users.js`) |
| 2 | Forță brută | 5 încercări / 15 min per email, 20 per IP; `X-Forwarded-For` ignorat dacă `TRUST_PROXY=0` | `middleware/rateLimits.js`, `config.js` |
| 3 | Aflarea conturilor la login | același mesaj și același timp (hash fictiv pentru emailurile fără cont) | `routes/auth.routes.js`, `verifyAgainstDummy` |
| 4 | Sesiuni slabe, fixation, furt | token aleator 256 biți; cookie `HttpOnly`, `SameSite=Strict`, `Secure` prin HTTPS; expiră în 24 h; token nou la login; logout, blocarea și schimbarea parolei șterg sesiunile pe server | `models/sessions.js`, `services/sessionCookie.js`, `routes/auth.routes.js`, `routes/me.routes.js` |
| 5 | CSRF | `SameSite=Strict` + verificarea `Sec-Fetch-Site`/`Origin`; doar JSON (multipart la poster) | `crossOriginGuard` (`middleware/security.js`) |
| 6 | Escaladarea privilegiilor | rolul nu vine niciodată din cerere; `requireRole('admin')` pe tot `/api/admin` | `middleware/auth.js`, `routes/admin.routes.js` |
| 7 | IDOR | proprietarul verificat la fiecare modificare (`canManage`/`isAuthor` → 403); lista privată caută după `id` **și** `user_id` (→ 404) | `services/permissions.js`, `routes/films.routes.js`, `routes/reviews.routes.js`, `models/watchlist.js` |
| 8 | Mass assignment | `z.strictObject` pe toate corpurile (`role`, `owner_id`, `user_id` respinse) | `validation/` |
| 9 | Expunerea datelor | coloane alese explicit + funcțiile `to…Json`; `Cache-Control: no-store` pe API | `models/`, `app.js` |
| 10 | XSS stocat/reflectat | afișare doar cu `textContent`, niciodată `innerHTML`; CSP fără inline; `nosniff`; caracterele invizibile respinse | `public/js/`, `middleware/security.js`, `validation/common.js` |
| 11 | Injecție SQL/NoSQL | doar parametri `?`; SQL din bucăți fixe; `ORDER BY` din listă fixă; `LIKE` cu escape; liste/obiecte respinse | `models/films.js`, `models/admin.js`, `services/search.js` |
| 12 | Fișiere malițioase sau mari | max. 2 MB, un fișier; sharp acceptă doar JPEG/PNG/WebP reale și le reface ca WebP fără metadate; permisiuni verificate înainte de citire | `services/posters.js`, `middleware/upload.js` |
| 13 | Path traversal | nume UUID generat de server; static doar `public/` și `uploads/posters/` | `savePoster`, `app.js` |
| 14 | Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options` | `middleware/security.js` |
| 15 | Scurgeri prin erori | handler generic fără stack/SQL; pagină 404 proprie; fără `X-Powered-By` | `middleware/errors.js`, `app.js` |
| 16 | Secrete în depozit | `.env` în `.gitignore`, `.env.example` livrat; conturile demo nelistate au parole aleatorii | `.gitignore`, `scripts/seed-lib.js` |
| 17 | Dependențe vulnerabile | versiuni fixate; `npm audit`: 0 vulnerabilități la predare | `package.json` |
| 18 | Abuzul drepturilor de admin | jurnal de audit pentru blocări și orice modificare a datelor altcuiva | `models/adminLog.js` |

Căile sunt relative la `src/`, în afară de `public/`, `scripts/` și fișierele din rădăcină.

## 4. Verificare și limitări

- `npm test`: 74 de teste, peste 20 pentru controlul accesului (de ex. Ana primește 403 la filmul/recenzia lui Mihai, 404 la lista lui privată, 403 pe `/api/admin`).
- `npm run attack -- <adresa>`: 126 de verificări pe aplicația pornită; 0 probleme la predare.
- DoS e în afara domeniului; limitele de încercări sunt în memorie. Fără 2FA sau verificare prin email. Pe HTTPS se setează `COOKIE_SECURE=true` (activează HSTS) și, în spatele unui proxy, `TRUST_PROXY=1`.
