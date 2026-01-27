import { db as firebaseDb } from './firebaseConfig';
import { initDb, getDb } from './initDb';

// ✅ SQLite
export const addUserProfileSQLite = async (user: any) => {
  try {
    await initDb();               // ✅ init
    const db = getDb();           // ✅ get instance

    await db.executeSql(
      `INSERT INTO user (
        first_name,
        last_name,
        phone,
        emergency_contacts,
        medical_notes,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
      [
        user.firstName,
        user.lastName,
        user.phone,
        JSON.stringify(user.emergencyContacts),
        user.medicalConditions,
      ]
    );

    console.log('✅ User profile saved to SQLite');
  } catch (error) {
    console.error('❌ SQLite profile save failed:', error);
    throw error;
  }
};