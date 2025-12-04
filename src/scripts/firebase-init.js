// scripts/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-app.js";
import {
  getAuth,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.0.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.1/firebase-firestore.js";

// 🔴 PUT YOUR REAL FIREBASE CONFIG HERE
const firebaseConfig = {
  apiKey: "AIzaSyDdmFP5OKVl-hRdeODEvLOzKq4_vKnr-tY",
  authDomain: "amr-xp.firebaseapp.com",
  projectId: "amr-xp",
  storageBucket: "amr-xp.firebasestorage.app",
  messagingSenderId: "656857018113",
  appId: "1:656857018113:web:7a28925019022878597500",
  measurementId: "G-H7P34PN5WS"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// AUTH
const auth = getAuth(app);

// ✅ Make login persist even after refresh / home / closing tab
setPersistence(auth, browserLocalPersistence)
  .then(() => {
    console.log("✔ Firebase persistence enabled");
  })
  .catch((error) => {
    console.error("Persistence error:", error);
  });

// DB
const db = getFirestore(app);

export { app, auth, db };
