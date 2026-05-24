import { initializeApp, getApps } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY            ?? "AIzaSyC2mQ8zuj4omrJSUMbqsI68vQGPEV_WxXY",
  authDomain:        process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN        ?? "asia-lb.firebaseapp.com",
  databaseURL:       process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL       ?? "https://asia-lb-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID         ?? "asia-lb",
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET     ?? "asia-lb.firebasestorage.app",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "542622985658",
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID             ?? "1:542622985658:web:f802a84eaa9cbd4e450183",
  measurementId:     process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID     ?? "G-EYSTYTEZGB",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const db = getDatabase(app);
export default app;
