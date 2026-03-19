// Firebase Client SDK — importert via CDN (ingen bundler nødvendig)

import { initializeApp } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js';

const firebaseConfig = {
  apiKey:            'AIzaSyBojMaQLu8x6HYW0llxP6UsLIRcZZoWMYs',
  authDomain:        'onklv-app.firebaseapp.com',
  projectId:         'onklv-app',
  storageBucket:     'onklv-app.firebasestorage.app',
  messagingSenderId: '316757651135',
  appId:             '1:316757651135:web:cd559792ab7388c6e8e00a'
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
