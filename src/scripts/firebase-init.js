// scripts/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-storage.js";

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

// AUTH
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(console.error);

// DB
const db = getFirestore(app);

// STORAGE ✅
const storage = getStorage(app);

export { app, auth, db, storage };
