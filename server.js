import 'dotenv/config';
import './firebase/config.js';  // Initialiser Firebase Admin SDK
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

const app = express();
const port = process.env.PORT ?? 3000;

// Middleware
app.use((_req, res, next) => {
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// Offentlig statistikk for landingssiden (ingen autentisering nødvendig)
app.get('/api/statistikk', async (_req, res) => {
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

// Lokal dev: start server. Vercel: eksporter app.
if (!process.env.FUNCTION_TARGET) {
  app.listen(port, () => {
    console.log(`Server kjører på http://localhost:${port}`);
  });
}

export default app;
