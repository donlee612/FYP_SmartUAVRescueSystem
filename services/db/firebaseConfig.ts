import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
 apiKey: "AIzaSyAAkpugMiPdlOqcXwJ3XAJTMUOCYTQlpmk",
  authDomain: "mydrone-7dff8.firebaseapp.com",
  projectId: "mydrone-7dff8",
  storageBucket: "mydrone-7dff8.firebasestorage.app",
  messagingSenderId: "73425703079",
  appId: "1:73425703079:android:58b358aed433d10b9dcb82"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
