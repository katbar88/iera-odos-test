// firebase.js — Firebase initialization
// ΣΗΜΑΝΤΙΚΟ: Αλλάξτε το ADMIN_EMAIL με το δικό σας Google email

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';
import { getAuth, GoogleAuthProvider } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getStorage } from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js';

const firebaseConfig = {
  apiKey:            "AIzaSyC6FMPgAusyAnCTXarVt-qqMcDFpakOk0M",
  authDomain:        "iera-odos.firebaseapp.com",
  projectId:         "iera-odos",
  storageBucket:     "iera-odos.firebasestorage.app",
  messagingSenderId: "951270422795",
  appId:             "1:951270422795:web:083a8d6d210f2931f70a0e",
};

const app = initializeApp(firebaseConfig);
export const db             = getFirestore(app);
export const auth           = getAuth(app);
export const storage        = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Το email του admin (εσείς) — αλλάξτε το με το Google email σας
export const ADMIN_EMAIL = 'kbartsoka@gmail.com';
