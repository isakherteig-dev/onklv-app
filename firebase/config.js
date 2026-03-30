import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialiser kun én gang (viktig i dev med hot-reload)
const fbPrivateKey = process.env.FB_PRIVATE_KEY ?? process.env.LOCAL_FB_PRIVATE_KEY;

if (!getApps().length) {
  if (fbPrivateKey) {
    // Lokal dev: bruk eksplisitt service account fra .env
    initializeApp({
      credential: cert({
        projectId: process.env.FB_PROJECT_ID,
        clientEmail: process.env.FB_CLIENT_EMAIL,
        privateKey: fbPrivateKey.replace(/\\n/g, '\n')
      }),
      storageBucket: process.env.FB_STORAGE_BUCKET
    });
  } else {
    // Cloud Functions: Application Default Credentials håndterer auth automatisk
    initializeApp({
      storageBucket: process.env.FB_STORAGE_BUCKET || 'onklv-app.firebasestorage.app'
    });
  }
}

export const adminAuth = getAuth();
export const adminDB = getFirestore();
export const adminStorage = getStorage();
