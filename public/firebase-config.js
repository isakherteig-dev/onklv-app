// Firebase Client SDK — importert via CDN (ingen bundler nødvendig)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBkyxrGzc9Unt25PoXxFmMvdMNZA84VbyU',
  authDomain:        'olkv-app-e906d.firebaseapp.com',
  projectId:         'olkv-app-e906d',
  storageBucket:     'olkv-app-e906d.firebasestorage.app',
  messagingSenderId: '598255443710',
  appId:             '1:598255443710:web:dd9089c0b6f5df3dd2cfaf'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
