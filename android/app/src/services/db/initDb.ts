import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';

SQLite.enablePromise(true);

let dbInstance: SQLiteDatabase | null = null;

const initDb = async (): Promise<SQLiteDatabase> => {
  if (dbInstance) {
    return dbInstance;
  }

  const db = await SQLite.openDatabase({
    name: 'rescue.db',
    location: 'default',
  });

  await db.executeSql(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      gender TEXT,
      phone TEXT,
      email TEXT,
      medical_notes TEXT,
      emergency_contacts TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    );
  `);

  dbInstance = db;
  return db;
};

export const resetDb = async () => {
  const db = await initDb();
  await db.executeSql('DROP TABLE IF EXISTS user');
  dbInstance = null;
};

export default initDb;