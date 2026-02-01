import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuración de Firebase para el nuevo proyecto Chronicles of the Eldritch Raid
const firebaseConfig = {
  apiKey: "AIzaSyDnfytB6714BdUUMRMD8RjB-VFxiRq-ShM",
  authDomain: "shuffle-raid-bf1c3.firebaseapp.com",
  projectId: "shuffle-raid-bf1c3",
  storageBucket: "shuffle-raid-bf1c3.firebasestorage.app",
  messagingSenderId: "471193527658",
  appId: "1:471193527658:web:cc8666660b7967975af113",
  measurementId: "G-JWLQR80K84"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);