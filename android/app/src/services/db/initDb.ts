import SQLite, { SQLiteDatabase } from 'react-native-sqlite-storage';
import AsyncStorage from '@react-native-async-storage/async-storage';

SQLite.enablePromise(true);
SQLite.DEBUG(false);

const DB_NAME = 'mobile_app.db';
const DB_LOCATION = 'default';
let dbInstance: SQLiteDatabase | null = null;

// Simplified mobile-focused schema
const MOBILE_SCHEMA = `
PRAGMA foreign_keys = ON;

-- Device information (this mobile device)
CREATE TABLE IF NOT EXISTS device (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    device_uuid TEXT UNIQUE,
    model TEXT,
    os TEXT,
    app_version TEXT,
    last_seen TEXT DEFAULT (datetime('now')),
    created_at TEXT DEFAULT (datetime('now'))
);

-- User (person using this device)
CREATE TABLE IF NOT EXISTS user (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    external_id TEXT,
    first_name TEXT,
    last_name TEXT,
    phone TEXT,
    email TEXT,
    is_responder INTEGER DEFAULT 0, -- 0 = victim, 1 = responder
    medical_notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Location tracking (for this device/user)
CREATE TABLE IF NOT EXISTS location_ping (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    device_id INTEGER,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    accuracy REAL,
    speed REAL,
    heading REAL,
    provider TEXT, -- 'gps', 'network', etc.
    recorded_at TEXT DEFAULT (datetime('now')),
    sent_to_server INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE SET NULL,
    FOREIGN KEY(device_id) REFERENCES device(id) ON DELETE SET NULL
);

-- SOS emergency events
CREATE TABLE IF NOT EXISTS sos_event (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    device_id INTEGER NOT NULL,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    recorded_at TEXT DEFAULT (datetime('now')),
    status TEXT DEFAULT 'active', -- 'active', 'canceled', 'resolved'
    description TEXT,
    severity INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high, 4=critical
    sent_to_server INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE CASCADE,
    FOREIGN KEY(device_id) REFERENCES device(id) ON DELETE CASCADE
);

-- Route plans (for responders to plan routes)
CREATE TABLE IF NOT EXISTS route_plan (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    estimated_duration_minutes INTEGER,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE CASCADE
);

-- Route waypoints
CREATE TABLE IF NOT EXISTS route_waypoint (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    route_plan_id INTEGER NOT NULL,
    sequence INTEGER DEFAULT 0,
    latitude REAL NOT NULL,
    longitude REAL NOT NULL,
    altitude REAL,
    name TEXT,
    notes TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY(route_plan_id) REFERENCES route_plan(id) ON DELETE CASCADE
);

-- Communications (messages between app and server)
CREATE TABLE IF NOT EXISTS comm_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT, -- 'outgoing' or 'incoming'
    message_type TEXT, -- 'sos', 'location', 'status', 'chat'
    payload TEXT NOT NULL,
    status TEXT DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    related_sos_id INTEGER,
    retry_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    sent_at TEXT,
    FOREIGN KEY(related_sos_id) REFERENCES sos_event(id) ON DELETE SET NULL
);

-- Sync queue for offline-first architecture
CREATE TABLE IF NOT EXISTS sync_queue (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    table_name TEXT NOT NULL,
    record_id INTEGER NOT NULL,
    operation TEXT NOT NULL, -- 'create', 'update', 'delete'
    payload TEXT, -- JSON of the record data
    priority INTEGER DEFAULT 1, -- 1=low, 2=medium, 3=high
    retry_count INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    processed_at TEXT,
    error TEXT,
    UNIQUE(table_name, record_id, operation)
);

-- Settings/preferences
CREATE TABLE IF NOT EXISTS app_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT UNIQUE NOT NULL,
    value TEXT,
    category TEXT DEFAULT 'general',
    updated_at TEXT DEFAULT (datetime('now'))
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_location_user_time ON location_ping(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_sent ON location_ping(sent_to_server, created_at);
CREATE INDEX IF NOT EXISTS idx_sos_status_time ON sos_event(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sos_sent ON sos_event(sent_to_server, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_pending ON sync_queue(processed_at, priority DESC, created_at);
CREATE INDEX IF NOT EXISTS idx_comm_pending ON comm_log(status, created_at);
CREATE INDEX IF NOT EXISTS idx_route_active ON route_plan(is_active, user_id);
CREATE INDEX IF NOT EXISTS idx_waypoint_sequence ON route_waypoint(route_plan_id, sequence);
`;

export async function isDbInitialized(): Promise<boolean> {
    try {
        const db = await SQLite.openDatabase({
            name: DB_NAME,
            location: DB_LOCATION,
        });

        const result = await db.executeSql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name='device'"
        );

        const tableExists = result[0].rows.length > 0;
        await db.close();

        console.log(`[isDbInitialized] Database ${tableExists ? 'has' : 'does not have'} tables`);
        return tableExists;

    } catch (error) {
        console.log('[isDbInitialized] Error:', error);
        return false;
    }
}

async function applyMobileSchema(db: SQLiteDatabase): Promise<void> {
    console.log('[applyMobileSchema] Starting schema application...');

    try {
        // Disable foreign keys during creation
        await db.executeSql('PRAGMA foreign_keys = OFF;');

        const statements = MOBILE_SCHEMA
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));

        for (const stmt of statements) {
            if (stmt.trim().length === 0) continue;
            try {
                await db.executeSql(stmt + ';', []);
            } catch (stmtError: any) {
                // Ignore errors for duplicate table/index creation
                if (!stmtError.message?.includes('already exists')) {
                    console.warn(`[applyMobileSchema] Statement warning: ${stmtError.message}`);
                }
            }
        }

        // Re-enable foreign keys
        await db.executeSql('PRAGMA foreign_keys = ON;');

        console.log('[applyMobileSchema] Schema applied successfully');

    } catch (error) {
        console.error('[applyMobileSchema] Error:', error);
        throw error;
    }
}

async function ensureDefaultSettings(db: SQLiteDatabase): Promise<void> {
    const defaultSettings = [
        { key: 'location_tracking_enabled', value: 'true', category: 'location' },
        { key: 'location_update_interval', value: '30000', category: 'location' },
        { key: 'high_accuracy_mode', value: 'false', category: 'location' },
        { key: 'auto_sync_enabled', value: 'true', category: 'sync' },
        { key: 'sync_interval', value: '60000', category: 'sync' },
        { key: 'wifi_only_sync', value: 'false', category: 'sync' },
        { key: 'server_url', value: 'https://api.example.com', category: 'connection' },
        { key: 'auth_token', value: '', category: 'connection' },
        { key: 'user_role', value: 'victim', category: 'user' },
        { key: 'emergency_contacts', value: '[]', category: 'sos' },
        { key: 'sos_auto_send_location', value: 'true', category: 'sos' },
    ];

    try {
        for (const setting of defaultSettings) {
            await db.executeSql(
                `INSERT OR IGNORE INTO app_settings (key, value, category) VALUES (?, ?, ?)`,
                [setting.key, setting.value, setting.category]
            );
        }
        console.log('[ensureDefaultSettings] Default settings ensured');
    } catch (error) {
        console.warn('[ensureDefaultSettings] Error ensuring settings:', error);
    }
}

export async function initDb(): Promise<SQLiteDatabase> {
    console.log('[initDb] Starting mobile database initialization...');

    if (dbInstance) {
        console.log('[initDb] Returning existing database instance');
        return dbInstance;
    }

    try {
        console.log('[initDb] Opening database...');
        dbInstance = await SQLite.openDatabase({
            name: DB_NAME,
            location: DB_LOCATION,
        });

        // Test connection
        await dbInstance.executeSql('SELECT 1');

        // Apply mobile schema
        await applyMobileSchema(dbInstance);

        // Insert default settings if needed
        await ensureDefaultSettings(dbInstance);

        console.log('[initDb] ✅ Mobile database ready');
        return dbInstance;

    } catch (err) {
        console.error('[initDb] Failed to initialize database:', err);
        dbInstance = null;
        // Try to delete and recreate on critical error
        try {
            await SQLite.deleteDatabase({
                name: DB_NAME,
                location: DB_LOCATION,
            });
            console.log('[initDb] Deleted corrupted database, retrying...');

            dbInstance = await SQLite.openDatabase({
                name: DB_NAME,
                location: DB_LOCATION,
            });
            await applyMobileSchema(dbInstance);
            await ensureDefaultSettings(dbInstance);
            return dbInstance;
        } catch (retryErr) {
            console.error('[initDb] Failed to recreate database:', retryErr);
            throw retryErr;
        }
    }
}

export function getDb(): SQLiteDatabase {
    if (!dbInstance) {
        throw new Error('Database not initialized. Call initDb() first.');
    }
    return dbInstance;
}

export async function closeDb(): Promise<void> {
    if (dbInstance) {
        await dbInstance.close();
        dbInstance = null;
        console.log('[closeDb] Database closed');
    }
}

export async function resetDb(): Promise<void> {
    await closeDb();

    try {
        await SQLite.deleteDatabase({
            name: DB_NAME,
            location: DB_LOCATION,
        });
        console.log('[resetDb] Mobile database deleted');
    } catch (error) {
        console.error('[resetDb] Error deleting database:', error);
    }
}

export async function verifySchema(): Promise<{
    tablesCreated: string[];
    tableCounts: Record<string, number>;
    schemaVersion: string;
}> {
    try {
        const db = getDb();

        // Get all table names
        const tablesResult = await db.executeSql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );

        const tables: string[] = [];
        for (let i = 0; i < tablesResult[0].rows.length; i++) {
            tables.push(tablesResult[0].rows.item(i).name);
        }

        // Get row counts for each table
        const tableCounts: Record<string, number> = {};
        for (const table of tables) {
            const countResult = await db.executeSql(`SELECT COUNT(*) as count FROM ${table}`);
            tableCounts[table] = countResult[0].rows.item(0).count;
        }

        return {
            tablesCreated: tables.sort(),
            tableCounts,
            schemaVersion: '1.0 - Mobile Rescue App'
        };

    } catch (error) {
        console.error('[verifySchema] Error:', error);
        throw error;
    }
}

// Essential CRUD operations for mobile app
export async function saveLocationPing(
    latitude: number,
    longitude: number,
    accuracy?: number,
    speed?: number,
    heading?: number,
    altitude?: number
): Promise<number> {
    const db = getDb();

    // Get current user and device IDs
    const userId = await getCurrentUserId();
    const deviceId = await getCurrentDeviceId();

    const result = await db.executeSql(
        `INSERT INTO location_ping
         (user_id, device_id, latitude, longitude, altitude, accuracy, speed, heading, provider, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
        [userId, deviceId, latitude, longitude, altitude || null, accuracy || null,
         speed || null, heading || null, 'gps']
    );

    // Add to sync queue
    await addToSyncQueue('location_ping', result[0].insertId, 'create');

    return result[0].insertId;
}

export async function createSosEvent(
    latitude: number,
    longitude: number,
    description?: string,
    severity: number = 3
): Promise<number> {
    const db = getDb();

    const userId = await getCurrentUserId();
    const deviceId = await getCurrentDeviceId();

    const result = await db.executeSql(
        `INSERT INTO sos_event
         (user_id, device_id, latitude, longitude, description, severity, recorded_at)
         VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
        [userId, deviceId, latitude, longitude, description || '', severity]
    );

    const sosId = result[0].insertId;

    // Add to sync queue with high priority
    await addToSyncQueue('sos_event', sosId, 'create', 3);

    // Also log as outgoing communication
    await db.executeSql(
        `INSERT INTO comm_log (direction, message_type, payload, related_sos_id, status)
         VALUES ('outgoing', 'sos', ?, ?, 'pending')`,
        [JSON.stringify({ sosId, latitude, longitude, severity }), sosId]
    );

    return sosId;
}

export async function getActiveSosEvents(): Promise<any[]> {
    const db = getDb();

    const result = await db.executeSql(
        `SELECT * FROM sos_event WHERE status = 'active' ORDER BY created_at DESC`
    );

    const events = [];
    for (let i = 0; i < result[0].rows.length; i++) {
        events.push(result[0].rows.item(i));
    }

    return events;
}

export async function getPendingSyncItems(limit: number = 50): Promise<any[]> {
    const db = getDb();

    const result = await db.executeSql(
        `SELECT * FROM sync_queue
         WHERE processed_at IS NULL
         ORDER BY priority DESC, created_at ASC
         LIMIT ?`,
        [limit]
    );

    const items = [];
    for (let i = 0; i < result[0].rows.length; i++) {
        items.push(result[0].rows.item(i));
    }

    return items;
}

export async function markSyncItemProcessed(id: number, error?: string): Promise<void> {
    const db = getDb();

    if (error) {
        await db.executeSql(
            `UPDATE sync_queue SET processed_at = datetime('now'), error = ? WHERE id = ?`,
            [error, id]
        );
    } else {
        await db.executeSql(
            `UPDATE sync_queue SET processed_at = datetime('now') WHERE id = ?`,
            [id]
        );
    }
}

export async function getSetting(key: string): Promise<string | null> {
    const db = getDb();

    try {
        const result = await db.executeSql(
            `SELECT value FROM app_settings WHERE key = ?`,
            [key]
        );

        if (result[0].rows.length > 0) {
            return result[0].rows.item(0).value;
        }
        return null;
    } catch (error) {
        console.error(`[getSetting] Error getting setting ${key}:`, error);
        return null;
    }
}

export async function setSetting(key: string, value: string): Promise<void> {
    const db = getDb();

    try {
        await db.executeSql(
            `INSERT OR REPLACE INTO app_settings (key, value, updated_at)
             VALUES (?, ?, datetime('now'))`,
            [key, value]
        );
    } catch (error) {
        console.error(`[setSetting] Error setting ${key}:`, error);
    }
}

async function addToSyncQueue(
    tableName: string,
    recordId: number,
    operation: 'create' | 'update' | 'delete',
    priority: number = 1
): Promise<void> {
    const db = getDb();

    try {
        await db.executeSql(
            `INSERT OR REPLACE INTO sync_queue
             (table_name, record_id, operation, priority, created_at)
             VALUES (?, ?, ?, ?, datetime('now'))`,
            [tableName, recordId, operation, priority]
        );
    } catch (error) {
        console.error('[addToSyncQueue] Error:', error);
    }
}

// Helper functions
async function getCurrentUserId(): Promise<number> {
    // Try to get from settings first
    const userId = await getSetting('current_user_id');
    if (userId) {
        return parseInt(userId, 10);
    }

    // Otherwise, get or create a default user
    const db = getDb();
    const result = await db.executeSql(
        `SELECT id FROM user ORDER BY id LIMIT 1`
    );

    if (result[0].rows.length > 0) {
        const id = result[0].rows.item(0).id;
        await setSetting('current_user_id', id.toString());
        return id;
    } else {
        // Create a default user
        const insertResult = await db.executeSql(
            `INSERT INTO user (first_name, last_name) VALUES (?, ?)`,
            ['Mobile', 'User']
        );
        const id = insertResult[0].insertId;
        await setSetting('current_user_id', id.toString());
        return id;
    }
}

async function getCurrentDeviceId(): Promise<number> {
    const db = getDb();

    // Check if device exists (using a default UUID for now)
    const deviceUUID = 'mobile-device-001'; // In real app, use react-native-device-info
    const result = await db.executeSql(
        `SELECT id FROM device WHERE device_uuid = ? LIMIT 1`,
        [deviceUUID]
    );

    if (result[0].rows.length > 0) {
        return result[0].rows.item(0).id;
    } else {
        // Create new device record
        const insertResult = await db.executeSql(
            `INSERT INTO device (device_uuid, model, os, app_version)
             VALUES (?, ?, ?, ?)`,
            [deviceUUID, 'Unknown', 'iOS/Android', '1.0.0']
        );
        return insertResult[0].insertId;
    }
}

// Quick health check
export async function checkDbHealth(): Promise<{
    status: 'healthy' | 'degraded' | 'unhealthy';
    tables: string[];
    unsyncedItems: number;
    activeSosCount: number;
    lastLocation?: any;
}> {
    try {
        const db = getDb();

        // Check tables exist
        const tablesResult = await db.executeSql(
            "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'"
        );

        const tables = [];
        for (let i = 0; i < tablesResult[0].rows.length; i++) {
            tables.push(tablesResult[0].rows.item(i).name);
        }

        // Check unsynced items
        const syncResult = await db.executeSql(
            "SELECT COUNT(*) as count FROM sync_queue WHERE processed_at IS NULL"
        );
        const unsyncedItems = syncResult[0].rows.item(0).count;

        // Check active SOS events
        const sosResult = await db.executeSql(
            "SELECT COUNT(*) as count FROM sos_event WHERE status = 'active'"
        );
        const activeSosCount = sosResult[0].rows.item(0).count;

        // Get last location
        const locationResult = await db.executeSql(
            "SELECT * FROM location_ping ORDER BY created_at DESC LIMIT 1"
        );
        const lastLocation = locationResult[0].rows.length > 0 ?
            locationResult[0].rows.item(0) : null;

        return {
            status: unsyncedItems < 100 ? 'healthy' : 'degraded',
            tables,
            unsyncedItems,
            activeSosCount,
            lastLocation
        };

    } catch (error) {
        return {
            status: 'unhealthy',
            tables: [],
            unsyncedItems: 0,
            activeSosCount: 0
        };
    }
}

// Simple location saving (legacy support)
export async function saveSimpleLocation(latitude: number, longitude: number, routeId?: number) {
    try {
        console.log('💾 Saving simple location:', { latitude, longitude });

        // Use the new location ping function
        const id = await saveLocationPing(latitude, longitude);

        console.log(`✅ Saved location ID: ${id}`);
        return { success: true, id };

    } catch (error) {
        console.error('❌ Failed to save location:', error);
        return { success: false, error: String(error) };
    }
}