// scripts/firebase-init.js
// Lightweight Firebase initialization for client-side modules.
// IMPORTANT: fill the firebaseConfig values from your Firebase console.

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

// Replace the placeholder strings below with values from your Firebase project settings.
// Do NOT commit real keys to public repos.
const firebaseConfig = {
  apiKey: "AIzaSyDdmFP5OKVl-hRdeODEvLOzKq4_vKnr-tY",
  authDomain: "amr-xp.firebaseapp.com",
  projectId: "amr-xp",
  storageBucket: "amr-xp.firebasestorage.app",
  messagingSenderId: "656857018113",
  appId: "1:656857018113:web:7a28925019022878597500",
  measurementId: "G-H7P34PN5WS"
};

const app = initializeApp(firebaseConfig);

// AUTH (optional — only used if you rely on Firebase Auth)
let auth = null;
try {
  auth = getAuth(app);
  setPersistence(auth, browserLocalPersistence).catch(console.error);
} catch (e) {
  console.warn('Firebase Auth not initialized:', e.message);
}

// FIRESTORE
const db = getFirestore(app);

// STORAGE (optional)
let storage = null;
try {
  storage = getStorage(app);
} catch (e) {
  console.warn('Firebase Storage not initialized:', e.message);
}

// Export the things other modules import
export { app, auth, db, storage };
