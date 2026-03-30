import { onRequest } from 'firebase-functions/v2/https';
import app from './server.js';

export const api = onRequest(
  {
    region: 'europe-west1',
    secrets: ['FB_PRIVATE_KEY', 'ANTHROPIC_API_KEY', 'SMTP_PASS']
  },
  app
);
