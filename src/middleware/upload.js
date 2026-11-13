import multer from 'multer';
import { MAX_POSTER_BYTES } from '../services/posters.js';

// Fișierul stă doar în memorie (maximum 2 MB) până e verificat; nimic nevalidat nu ajunge pe disc.
// Se acceptă exact un fișier, în câmpul „poster”, fără alte câmpuri.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_POSTER_BYTES, files: 1, fields: 0, parts: 1 },
}).single('poster');

export function posterUpload(req, res, next) {
  upload(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
      const message = 'Fișierul depășește 2 MB.';
      return res.status(413).json({ error: message, fields: { poster: message } });
    }
    const message = 'Trimite o singură imagine, în câmpul „poster”.';
    return res.status(400).json({ error: message, fields: { poster: message } });
  });
}
