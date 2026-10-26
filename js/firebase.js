
"use strict";

/* =========================================
   FIREBASE — ЗВЯГЕЛЬ ТУРИСТИЧНИЙ
   Ініціалізація Firebase та Firestore
========================================= */

(function () {
  const FIREBASE_CONFIG = {
    apiKey: "AIzaSyDEizfKA8Ll-BT_olZSq7gt2z5WHH3PC2M",
    authDomain: "zviahel-tourist.firebaseapp.com",
    projectId: "zviahel-tourist",
    storageBucket: "zviahel-tourist.firebasestorage.app",
    messagingSenderId: "914549612868",
    appId: "1:914549612868:web:3abce6606a89167134b711",
    measurementId: "G-DV5YF43W24"
  };

  // Перевіряємо, чи завантажилася бібліотека Firebase.
  if (!window.firebase) {
    console.error(
      "Firebase не завантажився. Перевірте підключення SDK."
    );
    return;
  }

  // Ініціалізуємо застосунок лише один раз.
  if (!firebase.apps.length) {
    firebase.initializeApp(FIREBASE_CONFIG);
  }

  // Створюємо спільне підключення до Firestore.
  window.db = firebase.firestore();

  // Ознака успішної ініціалізації.
  window.firebaseReady = true;

  console.info("Firebase успішно ініціалізовано.");
})();
