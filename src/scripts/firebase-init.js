// scripts/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔴 REPLACE THESE VALUES with your real config
// Find them in Firebase Console → Project settings → "SDK setup and configuration" → CDN
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
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };