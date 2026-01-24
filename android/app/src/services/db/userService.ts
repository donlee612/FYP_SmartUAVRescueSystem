import { db } from './firebaseConfig'; // Firebase setup
import initDb from './initDb';

// SQLite Functions
export const addUserProfileSQLite = async (user) => {
  try {
    const db = await initDb();
    await db.run(`INSERT INTO user (first_name, last_name, phone, emergency_contacts, medical_conditions) VALUES (?, ?, ?, ?, ?)`,
      [user.firstName, user.lastName, user.phone, JSON.stringify(user.emergencyContacts), user.medicalConditions]);
    console.log("User profile added to SQLite.");
  } catch (error) {
    console.error("Error adding user profile to SQLite:", error);
    alert("Unable to add user profile. Please try again.");
  }
};

// Firebase Functions
export const addUserProfileFirebase = async (user) => {
  try {
    const userRef = collection(db, 'users');
    await addDoc(userRef, {
      first_name: user.firstName,
      last_name: user.lastName,
      phone: user.phone,
      emergency_contacts: user.emergencyContacts,
      medical_conditions: user.medicalConditions
    });
    console.log("User profile added to Firebase.");
  } catch (error) {
    console.error("Error adding user profile to Firebase:", error);
    alert("Unable to add user profile to Firebase. Please try again.");
  }
};