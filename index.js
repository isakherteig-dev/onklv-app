// Cloud Functions Gen 2 entry point — wrapper rundt Express-appen.
// Brukes kun i produksjon. Lokal dev bruker server.js direkte via npm run dev.

import { onRequest } from 'firebase-functions/v2/https';
import app from './server.js';

export const api = onRequest(
  {
    region: 'europe-west1',
    memory: '512MiB',
    timeoutSeconds: 120,
    secrets: ['FIREBASE_PRIVATE_KEY', 'ANTHROPIC_API_KEY', 'SMTP_PASS']
  },
  app
);
