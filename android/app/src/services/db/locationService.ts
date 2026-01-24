import initDb from './initDb';
import { db } from './firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';

// Save location to SQLite
export const saveLocationSQLite = async (userId, location) => {
  try {
    const db = await initDb();
    await db.run(`INSERT INTO location (user_id, latitude, longitude) VALUES (?, ?, ?)`,
      [userId, location.latitude, location.longitude]);
    console.log("Location saved to SQLite.");
  } catch (error) {
    console.error("Error saving location to SQLite:", error);
    alert("Unable to save location. Please try again.");
  }
};

// Sync location to Firebase
export const syncLocationToFirebase = async (userId, location) => {
  try {
    const locationRef = collection(db, 'locations');
    await addDoc(locationRef, { userId, ...location });
    console.log("Location synchronized to Firebase.");
  } catch (error) {
    console.error("Error synchronizing location to Firebase:", error);
    alert("Unable to sync location. Please try again.");
  }
};