import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBZE0Zwwvyc963ddo_I8LTc8emlhayZ_NY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "crm-webapp-d32bc.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "crm-webapp-d32bc",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "crm-webapp-d32bc.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "940267952934",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:940267952934:web:18ba7928b92968bcdcbfe7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
