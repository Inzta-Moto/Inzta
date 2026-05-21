import { initializeApp, getApps } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, setPersistence, browserLocalPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyA4dvAli7mc_0LSO7Ig9iWqb7N330K049U",
  authDomain: "inzta-5244e.firebaseapp.com",
  projectId: "inzta-5244e",
  storageBucket: "inzta-5244e.firebasestorage.app",
  messagingSenderId: "97605265667",
  appId: "1:97605265667:web:e836aec51004fedb9aa136"
};

// WA_NUMBER DIDEKLARASIKAN DI SINI
export const WA_NUMBER: string = "6289513482410";

let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApps()[0];
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export { firebaseConfig };

if (typeof window !== 'undefined') {
  setPersistence(auth, browserLocalPersistence).catch(() => {});
}
