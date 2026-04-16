import { cert, getApps, initializeApp, getApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;

if (!serviceAccountKey) {
  throw new Error("Missing FIREBASE_SERVICE_ACCOUNT_KEY in server environment.");
}

const serviceAccount = JSON.parse(serviceAccountKey);
const adminApp = !getApps().length ? initializeApp({ credential: cert(serviceAccount) }) : getApp();

export const firebaseAdminAuth = getAuth(adminApp);
