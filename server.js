import 'dotenv/config';
import './firebase/config.js';  // Initialiser Firebase Admin SDK
import { pathToFileURL } from 'node:url';
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

// Middleware
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
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
