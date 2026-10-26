import * as admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';

let app;

if (!admin.apps.length) {
  try {
    const privateKey = process.env.FIREBASE_PRIVATE_KEY || process.env.NEXT_PUBLIC_FIREBASE_PRIVATE_KEY;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

    if (privateKey && clientEmail && projectId) {
      app = admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Fallback: check if serviceAccountKey.json exists in root
      const serviceAccountPath = path.join(process.cwd(), 'serviceAccountKey.json');
      if (fs.existsSync(serviceAccountPath)) {
        const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));
        app = admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
        });
      } else {
        console.warn('Firebase admin initialization failed: Missing environment credentials and serviceAccountKey.json not found.');
      }
    }
  } catch (error: any) {
    console.error('Firebase admin initialization error', error.stack);
  }
} else {
  app = admin.app();
}

// Export getter to avoid throwing during next build when env vars are missing
export const getAdminDb = () => admin.firestore();
export const getAdminAuth = () => admin.auth();
// False when no credentials were found (local or CI build without secrets); public pages then render empty.
export const hasAdminCredentials = () => admin.apps.length > 0;
