import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

// Initialiser kun én gang (viktig i dev med hot-reload)
if (!getApps().length) {
  if (process.env.FIREBASE_PRIVATE_KEY) {
    // Lokal dev: bruk eksplisitt service account fra .env
    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
      }),
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET
    });
  } else {
    // Cloud Functions: Application Default Credentials håndterer auth automatisk
    initializeApp({
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'onklv-app.firebasestorage.app'
    });
  }
}

export const adminAuth = getAuth();
export const adminDB = getFirestore();
export const adminStorage = getStorage();
