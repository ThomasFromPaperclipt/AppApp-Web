import * as admin from 'firebase-admin';

if (!admin.apps.length) {
    const serviceAccount = process.env.FIREBASE_PRIVATE_KEY
        ? {
            projectId: process.env.FIREBASE_PROJECT_ID,
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
        }
        : undefined;

    admin.initializeApp({
        credential: serviceAccount 
            ? admin.credential.cert(serviceAccount) 
            : admin.credential.applicationDefault(),
        projectId: process.env.FIREBASE_PROJECT_ID || 'appappi',
    });
}

const db = admin.firestore();
const auth = admin.auth();

export { db, auth };
