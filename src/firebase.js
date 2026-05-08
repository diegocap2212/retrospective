import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyA5pcBuswpZvnlh8GeRC1TZPV2Y62hGh2A",
  authDomain: "retrospective-otmow.firebaseapp.com",
  projectId: "retrospective-otmow",
  storageBucket: "retrospective-otmow.firebasestorage.app",
  messagingSenderId: "704233375131",
  appId: "1:704233375131:web:57f4b2f8eaf52f18a98d3e"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
