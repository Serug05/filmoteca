# Imaginea aplicației: `docker compose up --build` o construiește și o pornește.
FROM node:24.22.1-slim

WORKDIR /app
ENV NODE_ENV=production

# Întâi doar dependențele (cu versiunile exacte din package-lock.json), ca să fie refolosite din cache.
# --ignore-scripts: modulele native (argon2, better-sqlite3, sharp) vin deja compilate pentru Linux,
# deci nu e nevoie de compilator în imagine.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY .env.example ./
COPY src ./src
COPY public ./public
COPY scripts ./scripts

# Aplicația nu rulează ca root.
RUN mkdir -p data uploads && chown -R node:node /app
USER node

EXPOSE 3000
CMD ["npm", "start"]
