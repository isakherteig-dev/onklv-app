import 'dotenv/config';
import './firebase/config.js';  // Initialiser Firebase Admin SDK
import express from 'express';
import cookieParser from 'cookie-parser';
import { initDB } from './db/init.js';
import authRuter from './routes/auth.js';
import laereplasserRuter from './routes/laereplasser.js';
import soknadRuter from './routes/soknader.js';
import adminRuter from './routes/admin.js';

const app = express();
const port = process.env.PORT ?? 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(express.static('public'));

// API-ruter
app.use('/api/auth', authRuter);
app.use('/api/laereplasser', laereplasserRuter);
app.use('/api/soknader', soknadRuter);
app.use('/api/admin', adminRuter);

// Start SQLite (kun for laereplasser + soknader)
initDB();

app.listen(port, () => {
  console.log(`Server kjører på http://localhost:${port}`);
});
