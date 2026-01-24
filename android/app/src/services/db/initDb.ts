import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const initDb = async () => {
  const db = await open({
    filename: 'database.db',
    driver: sqlite3.Database,
  });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS user (
      id INTEGER PRIMARY KEY,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      emergency_contacts TEXT,
      medical_conditions TEXT
    );
    CREATE TABLE IF NOT EXISTS location (
      id INTEGER PRIMARY KEY,
      user_id INTEGER,
      latitude REAL,
      longitude REAL,
      recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  return db;
};

export default initDb;