// Firebase configuration for web
// This uses the same Firebase project as the mobile app
import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
    apiKey: "AIzaSyDjl3FJD1AexSJ2QcILLPPdgknjRE7idK0",
    authDomain: "appappi.firebaseapp.com",
    projectId: "appappi",
    storageBucket: "appappi.appspot.com",
    messagingSenderId: "1061196731577",
    appId: "1:1061196731577:web:fda6b87765348d3d813768",
};

// Initialize Firebase only if it hasn't been initialized yet
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

export { auth, db, storage, functions, firebaseConfig };
export default app;
