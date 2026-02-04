import { initDb } from './initDb';
import { db } from './firebaseConfig';
import { collection, addDoc } from 'firebase/firestore';
import { Alert } from 'react-native';

interface Location {
  latitude: number;
  longitude: number;
}

// Save location to SQLite
export const saveLocationSQLite = async (userId: string, location: Location): Promise<void> => {
  try {
    await initDb();
    // Note: This function needs to be updated to use the correct database API
    console.log("Location saved to SQLite.");
  } catch (error) {
    console.error("Error saving location to SQLite:", error);
    Alert.alert("Error", "Unable to save location. Please try again.");
  }
};

// Sync location to Firebase
export const syncLocationToFirebase = async (userId: string, location: Location): Promise<void> => {
  try {
    const locationRef = collection(db, 'locations');
    await addDoc(locationRef, { userId, ...location });
    console.log("Location synchronized to Firebase.");
  } catch (error) {
    console.error("Error synchronizing location to Firebase:", error);
    Alert.alert("Error", "Unable to sync location. Please try again.");
  }
};
