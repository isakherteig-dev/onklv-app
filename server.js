import 'dotenv/config';
import './firebase/config.js';  // Initialiser Firebase Admin SDK
import express from 'express';
import cookieParser from 'cookie-parser';
import { initDB } from './db/init.js';
import authRuter from './routes/auth.js';
import laereplasserRuter from './routes/laereplasser.js';
import soknadRuter from './routes/soknader.js';
import adminRuter from './routes/admin.js';
import varslerRuter from './routes/varsler.js';
import aiRuter from './routes/ai.js';
import cvRuter from './routes/cv.js';

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

// API-ruter
app.use('/api/auth', authRuter);
app.use('/api/laereplasser', laereplasserRuter);
app.use('/api/soknader', soknadRuter);
app.use('/api/admin', adminRuter);
app.use('/api/varsler', varslerRuter);
app.use('/api/ai', aiRuter);
app.use('/api/cv', cvRuter);

// Start SQLite (laereplasser, soknader, varsler)
initDB();

app.listen(port, () => {
  console.log(`Server kjører på http://localhost:${port}`);
});
