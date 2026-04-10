import 'dotenv/config';
import './firebase/config.js';  // Initialiser Firebase Admin SDK
import { pathToFileURL } from 'node:url';
import { Readable } from 'node:stream';
import express from 'express';
import cookieParser from 'cookie-parser';
import { adminDB } from './firebase/config.js';
import authRuter from './routes/auth.js';
import laereplasserRuter from './routes/laereplasser.js';
import soknadRuter from './routes/soknader.js';
import adminRuter from './routes/admin.js';
import varslerRuter from './routes/varsler.js';
import aiRuter from './routes/ai.js';
import cvRuter from './routes/cv.js';
import chatRuter from './routes/chat.js';
import { rateLimiter } from './middleware/rateLimit.js';

const app = express();
app.set('trust proxy', true);
const port = process.env.PORT ?? 3000;
const isDirectRun = process.argv[1]
  ? import.meta.url === pathToFileURL(process.argv[1]).href
  : false;

// Fix: Firebase Cloud Functions konsumerer body-stream før multer.
// Denne middleware gjenskaper streamen fra rawBody for multipart-requests.
app.use((req, res, next) => {
  if (req.rawBody && req.headers['content-type']?.startsWith('multipart/form-data')) {
    const stream = Readable.from(req.rawBody);
    Object.assign(req, {
      read: stream.read.bind(stream),
      on: stream.on.bind(stream),
      pipe: stream.pipe.bind(stream),
      unpipe: stream.unpipe.bind(stream),
      removeListener: stream.removeListener.bind(stream),
      headers: { ...req.headers, 'content-length': String(req.rawBody.length) }
    });
  }
  next();
});

// Middleware
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'unsafe-none');
  res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self' https://www.gstatic.com https://apis.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' https://images.unsplash.com https://storage.googleapis.com data:; media-src 'self' https://storage.googleapis.com; connect-src 'self' https://*.firebaseio.com https://*.googleapis.com https://identitytoolkit.googleapis.com https://firestore.googleapis.com https://securetoken.googleapis.com https://www.gstatic.com; frame-src 'self' https://accounts.google.com https://onklv-app.firebaseapp.com");
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Offentlig statistikk for landingssiden (ingen autentisering nødvendig)
app.get('/api/statistikk', (req, _res, next) => { req.user = { uid: req.ip || 'anon' }; next(); }, rateLimiter(30, 60_000), async (_req, res) => {
  try {
    const [laerlinger, bedrifter, laereplasser] = await Promise.all([
      adminDB.collection('users').where('rolle', '==', 'laerling').count().get(),
      adminDB.collection('users').where('rolle', '==', 'bedrift').where('godkjent', '==', true).count().get(),
      adminDB.collection('laereplasser').where('aktiv', '==', true).count().get()
    ]);
    res.json({
      antallLaerlinger: laerlinger.data().count,
      antallBedrifter:  bedrifter.data().count,
      antallLaereplasser: laereplasser.data().count
    });
  } catch {
    res.status(500).json({ feil: 'Kunne ikke hente statistikk' });
  }
});

// API-ruter
app.use('/api/auth', authRuter);
app.use('/api/laereplasser', laereplasserRuter);
app.use('/api/soknader', soknadRuter);
app.use('/api/admin', adminRuter);
app.use('/api/varsler', varslerRuter);
app.use('/api/ai', aiRuter);
app.use('/api/cv', cvRuter);
app.use('/api/chat', chatRuter);

if (isDirectRun) {
  app.listen(port, () => {
    console.log(`Server kjører på http://localhost:${port}`);
  });
}

export default app;
