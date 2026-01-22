-- Schema: initial SQLite CREATE TABLE statements for SmartUAV Rescue System
-- Save as scripts/schema.sql

PRAGMA foreign_keys = ON;

-- device: information about the mobile device / app instance
CREATE TABLE IF NOT EXISTS device (
id INTEGER PRIMARY KEY AUTOINCREMENT,
device_uuid TEXT,
model TEXT,
os TEXT,
app_version TEXT,
last_seen TEXT
);

-- user: people (victims / responders)
CREATE TABLE IF NOT EXISTS user (
id INTEGER PRIMARY KEY AUTOINCREMENT,
external_id TEXT,
first_name TEXT,
last_name TEXT,
phone TEXT,
medical_notes TEXT,
created_at TEXT DEFAULT (datetime('now')),
updated_at TEXT DEFAULT (datetime('now'))
);

-- location_ping: GPS/location pings from device/user
CREATE TABLE IF NOT EXISTS location_ping (
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
device_id INTEGER,
latitude REAL NOT NULL,
longitude REAL NOT NULL,
altitude REAL,
accuracy REAL,
provider TEXT,
recorded_at TEXT DEFAULT (datetime('now')),
sent INTEGER DEFAULT 0,
created_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE SET NULL,
FOREIGN KEY(device_id) REFERENCES device(id) ON DELETE SET NULL
);

-- sos_event: emergency events (SOS calls)
CREATE TABLE IF NOT EXISTS sos_event (
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
device_id INTEGER,
latitude REAL,
longitude REAL,
recorded_at TEXT DEFAULT (datetime('now')),
status TEXT,
assigned_mission_id INTEGER,
estimated_finish_at TEXT,
created_at TEXT DEFAULT (datetime('now')),
updated_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE SET NULL,
FOREIGN KEY(device_id) REFERENCES device(id) ON DELETE SET NULL,
FOREIGN KEY(assigned_mission_id) REFERENCES mission(id) ON DELETE SET NULL
);

-- route_plan: saved route plans (collections of waypoints)
CREATE TABLE IF NOT EXISTS route_plan (
id INTEGER PRIMARY KEY AUTOINCREMENT,
user_id INTEGER,
title TEXT,
description TEXT,
estimated_finish_at TEXT,
is_active INTEGER DEFAULT 1,
created_at TEXT DEFAULT (datetime('now')),
updated_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(user_id) REFERENCES user(id) ON DELETE SET NULL
);

-- route_waypoint: waypoints belonging to a route_plan
CREATE TABLE IF NOT EXISTS route_waypoint (
id INTEGER PRIMARY KEY AUTOINCREMENT,
route_plan_id INTEGER NOT NULL,
seq INTEGER DEFAULT 0,
latitude REAL NOT NULL,
longitude REAL NOT NULL,
altitude REAL,
created_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(route_plan_id) REFERENCES route_plan(id) ON DELETE CASCADE
);

-- mission: mission objects (search/rescue tasks)
CREATE TABLE IF NOT EXISTS mission (
id INTEGER PRIMARY KEY AUTOINCREMENT,
external_id TEXT,
source TEXT,
source_sos_id INTEGER,
title TEXT,
description TEXT,
mission_type TEXT,
priority INTEGER,
status TEXT,
target_latitude REAL,
target_longitude REAL,
created_by TEXT,
created_at TEXT DEFAULT (datetime('now')),
updated_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(source_sos_id) REFERENCES sos_event(id) ON DELETE SET NULL
);

-- mission_waypoint: waypoints for missions
CREATE TABLE IF NOT EXISTS mission_waypoint (
id INTEGER PRIMARY KEY AUTOINCREMENT,
mission_id INTEGER NOT NULL,
seq INTEGER DEFAULT 0,
latitude REAL NOT NULL,
longitude REAL NOT NULL,
altitude REAL,
created_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(mission_id) REFERENCES mission(id) ON DELETE CASCADE
);

-- mission_log: events / logs associated with a mission
CREATE TABLE IF NOT EXISTS mission_log (
id INTEGER PRIMARY KEY AUTOINCREMENT,
mission_id INTEGER NOT NULL,
event_type TEXT,
message TEXT,
timestamp TEXT DEFAULT (datetime('now')),
actor TEXT,
FOREIGN KEY(mission_id) REFERENCES mission(id) ON DELETE CASCADE
);

-- sync_queue: queue of local changes to send to server
CREATE TABLE IF NOT EXISTS sync_queue (
id INTEGER PRIMARY KEY AUTOINCREMENT,
table_name TEXT NOT NULL,
row_id INTEGER NOT NULL,
operation TEXT NOT NULL,
payload TEXT,
created_at TEXT DEFAULT (datetime('now')),
processed INTEGER DEFAULT 0
);

-- uav_telemetry: UAV/vehicle telemetry messages
CREATE TABLE IF NOT EXISTS uav_telemetry (
id INTEGER PRIMARY KEY AUTOINCREMENT,
uav_id INTEGER,
mission_id INTEGER,
latitude REAL NOT NULL,
longitude REAL NOT NULL,
altitude REAL,
speed REAL,
heading REAL,
battery_percent REAL,
rssi REAL,
raw_payload TEXT,
recorded_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(mission_id) REFERENCES mission(id) ON DELETE SET NULL
);

-- comm_log: communication logs (messages exchanged)
CREATE TABLE IF NOT EXISTS comm_log (
id INTEGER PRIMARY KEY AUTOINCREMENT,
direction TEXT,
message_type TEXT,
payload TEXT,
related_sos_id INTEGER,
related_mission_id INTEGER,
created_at TEXT DEFAULT (datetime('now')),
FOREIGN KEY(related_sos_id) REFERENCES sos_event(id) ON DELETE SET NULL,
FOREIGN KEY(related_mission_id) REFERENCES mission(id) ON DELETE SET NULL
);

-- peer_device: discovered peer devices (local network / mesh)
CREATE TABLE IF NOT EXISTS peer_device (
id INTEGER PRIMARY KEY AUTOINCREMENT,
peer_uuid TEXT,
display_name TEXT,
device_type TEXT,
ip TEXT,
port INTEGER,
last_seen TEXT DEFAULT (datetime('now')),
meta TEXT
);

CREATE INDEX IF NOT EXISTS idx_location_user_recorded ON location_ping(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_location_sent ON location_ping(sent, created_at);
CREATE INDEX IF NOT EXISTS idx_sync_queue_pending ON sync_queue(processed, created_at);
CREATE INDEX IF NOT EXISTS idx_mission_status ON mission(status, priority);
CREATE INDEX IF NOT EXISTS idx_sos_status ON sos_event(status, created_at);
CREATE INDEX IF NOT EXISTS idx_uav_mission_recorded ON uav_telemetry(mission_id, recorded_at DESC);

