import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  Alert,
  ScrollView
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Polyline } from 'react-native-maps';
import { Platform, PermissionsAndroid, Linking } from 'react-native';
import { initDb, getDb } from '../android/app/src/services/db/initDb';

// SQLite Database Helper
class LocationTrackerDB {
  static async addLocation(
    routeId: number,
    latitude: number,
    longitude: number,
    accuracy?: number,
    altitude?: number,
    speed?: number,
    heading?: number
  ) {
    try {
      const db = getDb();
      const timestamp = new Date().toISOString();

      console.log('💾 Attempting to save location...');

      // First, check what columns exist
      const [tableInfo] = await db.executeSql('PRAGMA table_info(locations)');
      const columns = [];
      for (let i = 0; i < tableInfo.rows.length; i++) {
        columns.push(tableInfo.rows.item(i).name.toLowerCase());
      }

      console.log('📋 Available columns:', columns);

      // Build SQL dynamically based on available columns
      let sql = 'INSERT INTO locations (route_id, latitude, longitude, timestamp';
      let values = [routeId, latitude, longitude, timestamp];
      let placeholders = 4;

      if (columns.includes('accuracy')) {
        sql += ', accuracy';
        values.push(accuracy || null);
        placeholders++;
      }

      if (columns.includes('altitude')) {
        sql += ', altitude';
        values.push(altitude || null);
        placeholders++;
      }

      if (columns.includes('speed')) {
        sql += ', speed';
        values.push(speed || null);
        placeholders++;
      }

      if (columns.includes('heading')) {
        sql += ', heading';
        values.push(heading || null);
        placeholders++;
      }

      if (columns.includes('created_at')) {
        sql += ', created_at';
        values.push(new Date().toISOString());
        placeholders++;
      }

      sql += ') VALUES (' + values.map(() => '?').join(', ') + ')';

      console.log('📝 Executing:', sql);
      console.log('📦 Values:', values);

      const result = await db.executeSql(sql, values);
      const insertedId = result[0].insertId;

      console.log(`✅ Location saved! ID: ${insertedId}`);

      // Verify the save
      const [verify] = await db.executeSql('SELECT * FROM locations WHERE id = ?', [insertedId]);
      if (verify.rows.length > 0) {
        const saved = verify.rows.item(0);
        console.log('✅ Verified save:', {
          id: saved.id,
          route_id: saved.route_id,
          latitude: saved.latitude,
          longitude: saved.longitude
        });
      }

      return {
        success: true,
        insertedId,
        timestamp: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      };

    } catch (error: any) {
      console.error('❌ Error saving location:', error.message);

      // Ultimate fallback - simple insert
      try {
        const db = getDb();
        const timestamp = new Date().toISOString();
        const result = await db.executeSql(
          'INSERT INTO locations (route_id, latitude, longitude, timestamp) VALUES (?, ?, ?, ?)',
          [routeId, latitude, longitude, timestamp]
        );

        console.log(`✅ Ultimate fallback saved! ID: ${result[0].insertId}`);
        return {
          success: true,
          insertedId: result[0].insertId,
          usedFallback: true
        };
      } catch (fallbackError) {
        console.error('❌ Ultimate fallback failed:', fallbackError);
        return {
          success: false,
          error: error.message
        };
      }
    }
  }

  static async createRoute(name: string, sessionId: string) {
    try {
      const db = getDb();
      const startTime = new Date().toISOString();

      const [result] = await db.executeSql(
        'INSERT INTO routes (name, start_time, session_id) VALUES (?, ?, ?)',
        [name, startTime, sessionId]
      );

      const routeId = result.insertId;
      console.log('✅ Route created:', { routeId, name, sessionId });

      return {
        id: routeId,
        name,
        startTime,
        sessionId
      };
    } catch (error: any) {
      console.error('❌ Error creating route:', error);
      throw new Error(`Failed to create route: ${error.message}`);
    }
  }

  static async getLocations(routeId: number) {
    try {
      const db = getDb();
      const [results] = await db.executeSql(
        'SELECT * FROM locations WHERE route_id = ? ORDER BY timestamp',
        [routeId]
      );

      const locations = [];
      for (let i = 0; i < results.rows.length; i++) {
        const loc = results.rows.item(i);
        // Convert ISO timestamp to UI format
        const date = new Date(loc.timestamp);
        const uiTimestamp = date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        locations.push({
          ...loc,
          uiTimestamp: uiTimestamp
        });
      }
      return locations;
    } catch (error) {
      console.error('❌ Error getting locations:', error);
      return [];
    }
  }

  static async getAllDatabaseLocations() {
    try {
      const db = getDb();
      const [results] = await db.executeSql(
        'SELECT * FROM locations ORDER BY timestamp DESC'
      );

      const locations = [];
      for (let i = 0; i < results.rows.length; i++) {
        const loc = results.rows.item(i);
        const date = new Date(loc.timestamp);
        const uiTimestamp = date.toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });
        locations.push({
          ...loc,
          uiTimestamp: uiTimestamp
        });
      }
      return locations;
    } catch (error) {
      console.error('❌ Error getting all locations:', error);
      return [];
    }
  }

  static async getStats() {
    try {
      const db = getDb();

      const [routesResult] = await db.executeSql('SELECT COUNT(*) as count FROM routes');
      const [locationsResult] = await db.executeSql('SELECT COUNT(*) as count FROM locations');
      const [latestResult] = await db.executeSql(
        'SELECT timestamp FROM locations ORDER BY timestamp DESC LIMIT 1'
      );

      return {
        totalRoutes: routesResult.rows.item(0).count,
        totalLocations: locationsResult.rows.item(0).count,
        lastUpdate: latestResult.rows.length > 0 ? latestResult.rows.item(0).timestamp : null
      };
    } catch (error) {
      console.error('❌ Error getting stats:', error);
      return { totalRoutes: 0, totalLocations: 0, lastUpdate: null };
    }
  }

  static async clearSession() {
    try {
      const db = getDb();
      await db.executeSql('DELETE FROM locations');
      await db.executeSql('DELETE FROM routes');
      console.log('✅ Database session cleared');
      return { success: true };
    } catch (error) {
      console.error('❌ Error clearing session:', error);
      return { success: false, error };
    }
  }

  static async getDatabaseSchema() {
    try {
      const db = getDb();
      const [routesInfo] = await db.executeSql('PRAGMA table_info(routes)');
      const [locationsInfo] = await db.executeSql('PRAGMA table_info(locations)');

      const routesColumns = [];
      for (let i = 0; i < routesInfo.rows.length; i++) {
        routesColumns.push(routesInfo.rows.item(i));
      }

      const locationsColumns = [];
      for (let i = 0; i < locationsInfo.rows.length; i++) {
        locationsColumns.push(locationsInfo.rows.item(i));
      }

      return { routesColumns, locationsColumns };
    } catch (error) {
      console.error('❌ Error getting schema:', error);
      return { routesColumns: [], locationsColumns: [] };
    }
  }

  static async forceCreateTables() {
    try {
      const db = getDb();

      // Drop and recreate routes table
      await db.executeSql('DROP TABLE IF EXISTS routes');
      await db.executeSql(`
        CREATE TABLE routes (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT,
          start_time TEXT,
          session_id TEXT UNIQUE,
          status TEXT DEFAULT 'active'
        );
      `);

      // Drop and recreate locations table WITH ALL COLUMNS
      await db.executeSql('DROP TABLE IF EXISTS locations');
      await db.executeSql(`
        CREATE TABLE locations (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          route_id INTEGER,
          latitude REAL,
          longitude REAL,
          accuracy REAL,
          altitude REAL,
          speed REAL,
          heading REAL,
          timestamp TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (route_id) REFERENCES routes(id) ON DELETE CASCADE
        );
      `);

      // Create indexes
      await db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_locations_route_id
        ON locations(route_id);
      `);
      await db.executeSql(`
        CREATE INDEX IF NOT EXISTS idx_locations_timestamp
        ON locations(timestamp);
      `);

      console.log('✅ Tables force-created successfully');
      return { success: true };
    } catch (error) {
      console.error('❌ Error force-creating tables:', error);
      return { success: false, error };
    }
  }
}

const QuickStartPage = () => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<{lat: number, lng: number, timestamp: string}[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [tracking, setTracking] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<{id: number, name: string, sessionId: string} | null>(null);
  const [stats, setStats] = useState({ totalPoints: 0, distance: '0m', sessionDuration: '0 min' });
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [dbInitialized, setDbInitialized] = useState(false);
  const [databaseStats, setDatabaseStats] = useState({
    routesCount: 0,
    locationsCount: 0,
    lastCheck: ''
  });
  const [databaseLocations, setDatabaseLocations] = useState<any[]>([]);
  const [showDatabaseView, setShowDatabaseView] = useState(false);
  const [appReady, setAppReady] = useState(false);

  const UPDATE_INTERVAL = 300000; // 5 minutes

  // Initialize database
  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Starting app initialization...');

        // Try to initialize database
        try {
          await initDb();
          console.log('✅ Database initialized');
          setDbInitialized(true);

          // Test database connection
          const db = getDb();
          const [test] = await db.executeSql('SELECT 1 as test');
          console.log('✅ Database test query successful');

          // Update stats
          await updateDatabaseStats();

          // Set app as ready
          setAppReady(true);

        } catch (dbError: any) {
          console.error('❌ Database init failed, attempting reset:', dbError);

          // Try emergency reset
          try {
            const SQLite = require('react-native-sqlite-storage');
            await SQLite.deleteDatabase({
              name: 'location_tracker.db',
              location: 'default',
            });
            console.log('🗑️ Database deleted, retrying...');

            await initDb();
            setDbInitialized(true);
            console.log('✅ Database recreated successfully');
            setAppReady(true);
          } catch (resetError) {
            console.error('❌ Complete database failure:', resetError);
            Alert.alert(
              'Database Error',
              'Failed to initialize database. The app may not work correctly.',
              [{
                text: 'Continue Anyway',
                onPress: () => {
                  setDbInitialized(true);
                  setAppReady(true);
                }
              }]
            );
          }
        }

      } catch (error: any) {
        console.error('❌ App initialization failed:', error);
        // Still allow app to function
        setDbInitialized(true);
        setAppReady(true);
      }
    };

    initializeApp();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Update database stats
  const updateDatabaseStats = async () => {
    try {
      const stats = await LocationTrackerDB.getStats();
      setDatabaseStats({
        routesCount: stats.totalRoutes,
        locationsCount: stats.totalLocations,
        lastCheck: new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        })
      });
    } catch (error) {
      console.error('❌ Error updating DB stats:', error);
    }
  };

  // Load database locations
  const loadDatabaseLocations = async () => {
    try {
      const locations = await LocationTrackerDB.getAllDatabaseLocations();
      setDatabaseLocations(locations);
      console.log(`📊 Loaded ${locations.length} locations from database`);
    } catch (error) {
      console.error('❌ Error loading DB locations:', error);
    }
  };

  // Helper functions
  const calculateDistance = (points: Array<{lat: number, lng: number}>): string => {
    if (points.length < 2) return '0m';
    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const latDiff = (p2.lat - p1.lat) * 111320;
      const lngDiff = (p2.lng - p1.lng) * 111320 * Math.cos(p1.lat * Math.PI / 180);
      totalDistance += Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);
    }
    return totalDistance < 1000 ? `${Math.round(totalDistance)}m` : `${(totalDistance / 1000).toFixed(1)}km`;
  };

  const calculateSessionDuration = (locations: Array<{timestamp: string}>): string => {
    if (locations.length < 2) return '0 min';
    const firstPoint = new Date(locations[0].timestamp);
    const lastPoint = new Date(locations[locations.length - 1].timestamp);
    const durationMinutes = Math.round((lastPoint.getTime() - firstPoint.getTime()) / 60000);
    return `${durationMinutes} min`;
  };

  const updateStats = (locationPoints: Array<{lat: number, lng: number, timestamp: string}>) => {
    const newStats = {
      totalPoints: locationPoints.length,
      distance: calculateDistance(locationPoints),
      sessionDuration: calculateSessionDuration(locationPoints)
    };
    setStats(newStats);
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: 'Location Permission Required',
          message: 'This app needs access to your location to track your route.',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        console.log('✅ Location permission granted');
        return true;
      } else {
        Alert.alert('Permission Denied', 'Location permission is required for tracking.', [
          { text: 'Cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]);
        return false;
      }
    } catch (err) {
      console.warn('Permission request error:', err);
      return false;
    }
  };

  const acquireLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    Geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude, accuracy, altitude, speed, heading } = position.coords;
        const timestamp = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });

        const locationPoint = {
          lat: latitude,
          lng: longitude,
          timestamp
        };

        // Update UI
        setLocations(prev => {
          const updatedLocations = [...prev, locationPoint];
          updateStats(updatedLocations);
          return updatedLocations;
        });

        // Save to database
        if (currentRoute) {
          const result = await LocationTrackerDB.addLocation(
            currentRoute.id,
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            heading
          );

          if (result.success) {
            setLastUpdateTime(timestamp);
            console.log(`✅ Location saved (ID: ${result.insertedId})`);

            // Update database stats and reload
            await updateDatabaseStats();
            await loadDatabaseLocations();
          } else {
            console.error('❌ Save failed:', result.error);
            Alert.alert('Save Error', 'Location recorded but not saved to database.');
          }
        }
      },
      error => {
        console.warn('⚠️ Location error:', error);
        let message = 'Unable to acquire location.';
        switch (error.code) {
          case 1: message = 'Location permission denied.'; break;
          case 2: message = 'Location unavailable. Check GPS or network.'; break;
          case 3: message = 'Location request timed out.'; break;
        }
        Alert.alert('Location Service', message);
      },
      {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 300000,
        forceRequestLocation: true,
        showLocationDialog: true,
      }
    );
  };

  const generateSessionId = (): string => {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SESS-${dateStr}-${timeStr}-${randomNum}`;
  };

  const initiateTrackingSession = async () => {
    if (tracking || !appReady) return;

    console.log('🚀 Starting tracking session');
    setTracking(true);
    setLocations([]);

    const newSessionId = generateSessionId();
    setSessionId(newSessionId);

    try {
      const newRoute = await LocationTrackerDB.createRoute(
        `Session-${newSessionId}`,
        newSessionId
      );
      setCurrentRoute(newRoute);

      // Get initial location
      await acquireLocation();

      // Set interval
      if (!intervalRef.current) {
        intervalRef.current = setInterval(acquireLocation, UPDATE_INTERVAL);
        console.log(`⏱️ Interval set: ${UPDATE_INTERVAL/60000} minutes`);

        Alert.alert(
          'Tracking Active',
          `Session ID: ${newSessionId}\n\nTracking every 5 minutes.`,
          [{ text: 'OK' }]
        );
      }
    } catch (error: any) {
      console.error('❌ Failed to start tracking:', error);
      setTracking(false);
      Alert.alert('Error', `Failed to start: ${error.message}`);
    }
  };

  const terminateTrackingSession = () => {
    console.log('🛑 Stopping tracking');
    setTracking(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    Alert.alert(
      'Tracking Complete',
      `Session: ${sessionId}\n\nPoints: ${locations.length}`,
      [{ text: 'OK' }]
    );
  };

  const verifySystemOperation = async () => {
    let locationStatus = '❌ Failed';
    let databaseStatus = '❌ Failed';

    try {
      await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          reject,
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 }
        );
      });
      locationStatus = '✅ Operational';
    } catch (error) {
      console.log('Location test failed:', error);
    }

    try {
      const stats = await LocationTrackerDB.getStats();
      databaseStatus = '✅ Operational';
      console.log('Database stats:', stats);
    } catch (error) {
      console.log('Database test failed:', error);
    }

    const report = [
      '=== SYSTEM STATUS ===',
      `App Ready: ${appReady ? '✅' : '❌'}`,
      `Database: ${databaseStatus}`,
      `Location: ${locationStatus}`,
      `Tracking: ${tracking ? 'Active' : 'Inactive'}`,
      `Session: ${sessionId || 'None'}`,
      `UI Points: ${stats.totalPoints}`,
      `DB Routes: ${databaseStats.routesCount}`,
      `DB Locations: ${databaseStats.locationsCount}`,
      '==================='
    ].join('\n');

    Alert.alert('System Report', report);
  };

  const resetSessionData = async () => {
    Alert.alert(
      'Reset Session',
      'Clear all tracking data?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await LocationTrackerDB.clearSession();
              setLocations([]);
              setCurrentRoute(null);
              setSessionId('');
              setStats({ totalPoints: 0, distance: '0m', sessionDuration: '0 min' });
              await updateDatabaseStats();
              setDatabaseLocations([]);
              console.log('🔄 Session reset');
              Alert.alert('Reset Complete', 'All data cleared.');
            } catch (error) {
              console.error('Reset failed:', error);
              Alert.alert('Error', 'Failed to clear data.');
            }
          }
        }
      ]
    );
  };

  const debugDatabaseSchema = async () => {
    try {
      const schema = await LocationTrackerDB.getDatabaseSchema();
      console.log('📋 Routes table schema:', schema.routesColumns);
      console.log('📋 Locations table schema:', schema.locationsColumns);

      Alert.alert(
        'Database Schema',
        `Routes: ${schema.routesColumns.length} columns\nLocations: ${schema.locationsColumns.length} columns\n\nCheck console for details.`
      );
    } catch (error: any) {
      console.error('❌ Schema debug error:', error);
      Alert.alert('Schema Error', error.message);
    }
  };

  const debugDatabaseContent = async () => {
    await loadDatabaseLocations();

    Alert.alert(
      'Database Content',
      `Total Routes: ${databaseStats.routesCount}\nTotal Locations: ${databaseStats.locationsCount}\n\nCurrent Route: ${currentRoute?.name || 'None'}\nCurrent UI Points: ${locations.length}\n\nCheck console for details.`
    );

    console.log('📋 All database locations:', databaseLocations);
  };

  const testDatabaseInsert = async () => {
    try {
      console.log('🧪 TEST: Manual database insert...');

      // Create a test route if none exists
      let testRouteId = currentRoute?.id;
      if (!testRouteId) {
        console.log('📝 Creating test route...');
        const db = getDb();
        const [result] = await db.executeSql(
          'INSERT INTO routes (name, start_time, session_id) VALUES (?, ?, ?)',
          ['Test-Route', new Date().toISOString(), 'TEST-SESSION']
        );
        testRouteId = result.insertId;
        console.log(`✅ Test route created: ${testRouteId}`);
      }

      // Insert a test location
      const result = await LocationTrackerDB.addLocation(
        testRouteId,
        37.7749,
        -122.4194,
        10,
        100,
        5,
        90
      );

      if (result.success) {
        console.log(`✅ Test location inserted: ${result.insertedId}`);
        await updateDatabaseStats();
        await loadDatabaseLocations();
        Alert.alert('Test Successful', `Location saved with ID: ${result.insertedId}`);
      } else {
        Alert.alert('Test Failed', 'Could not insert test location.');
      }
    } catch (error: any) {
      console.error('❌ Test failed:', error);
      Alert.alert('Test Failed', error.message);
    }
  };

  const forceDatabaseFix = async () => {
    Alert.alert(
      '🔧 Force Database Fix',
      'This will recreate the database with correct schema.\n\nAll existing data will be lost!',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'FIX DATABASE',
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 Starting forced database fix...');

              // Force create tables
              const result = await LocationTrackerDB.forceCreateTables();

              if (result.success) {
                console.log('✅ Database fixed!');
                setDbInitialized(true);
                await updateDatabaseStats();
                setDatabaseLocations([]);

                Alert.alert('Success', 'Database fixed! You can now use the app normally.');
              } else {
                Alert.alert('Error', 'Failed to fix database: ' + (result.error?.message || 'Unknown error'));
              }

            } catch (error: any) {
              console.error('❌ Fix failed:', error);
              Alert.alert('Error', 'Fix failed: ' + error.message);
            }
          }
        }
      ]
    );
  };

  const emergencyReset = async () => {
    Alert.alert(
      '⚠️ EMERGENCY RESET ⚠️',
      'Delete and recreate entire database? This will erase ALL data.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'RESET',
          style: 'destructive',
          onPress: async () => {
            try {
              const { recreateDatabase } = require('../android/app/src/services/db/initDb');
              await recreateDatabase();
              await initDb();
              setDbInitialized(true);
              await updateDatabaseStats();
              setDatabaseLocations([]);
              Alert.alert('Success', 'Database reset. Please restart tracking.');
            } catch (error) {
              Alert.alert('Error', 'Reset failed. Please reinstall app.');
            }
          }
        }
      ]
    );
  };

  const toggleDatabaseView = async () => {
    if (!showDatabaseView) {
      await loadDatabaseLocations();
    }
    setShowDatabaseView(!showDatabaseView);
  };

  // Map coordinates
  const polylineCoordinates = locations.map(loc => ({
    latitude: loc.lat,
    longitude: loc.lng,
  }));

  return (
    <ScrollView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📍 Location Tracking</Text>
        <Text style={styles.subtitle}>5-minute interval</Text>
        {!appReady && <Text style={styles.warning}>Initializing app...</Text>}
      </View>

      {/* Status */}
      <View style={[styles.statusPanel, tracking ? styles.statusActive : styles.statusInactive]}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusLight, tracking ? styles.lightActive : styles.lightInactive]} />
          <Text style={styles.statusText}>
            {tracking ? 'TRACKING ACTIVE' : 'TRACKING INACTIVE'}
          </Text>
        </View>
        <View style={styles.sessionIdContainer}>
          <Text style={styles.sessionIdLabel}>Session ID:</Text>
          <Text style={styles.sessionIdValue}>
            {sessionId || (tracking ? 'Generating...' : 'Not started')}
          </Text>
        </View>
        {currentRoute && (
          <Text style={styles.routeId}>Route ID: {currentRoute.id}</Text>
        )}
      </View>

      {/* Database Status */}
      <View style={styles.databaseStatus}>
        <Text style={styles.databaseStat}>
          App Status: {appReady ? '✅ Ready' : '⏳ Initializing'}
        </Text>
        <Text style={styles.databaseStat}>
          Routes: {databaseStats.routesCount} • Locations: {databaseStats.locationsCount}
        </Text>
        {databaseStats.lastCheck && (
          <Text style={styles.databaseStat}>
            Last check: {databaseStats.lastCheck}
          </Text>
        )}
      </View>

      {/* Metrics */}
      <View style={styles.metricsPanel}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Points</Text>
            <Text style={styles.metricValue}>{stats.totalPoints}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Distance</Text>
            <Text style={styles.metricValue}>{stats.distance}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Duration</Text>
            <Text style={styles.metricValue}>{stats.sessionDuration}</Text>
          </View>
        </View>
        {lastUpdateTime && (
          <Text style={styles.lastUpdate}>Last update: {lastUpdateTime}</Text>
        )}
      </View>

      {/* Main Control Button - Green when inactive, Red when active */}
      <View style={styles.controlPanel}>
        <View style={[
          styles.buttonContainer,
          !appReady && styles.buttonDisabled
        ]}>
          <Button
            title={tracking ? "STOP TRACKING" : "START TRACKING"}
            onPress={tracking ? terminateTrackingSession : initiateTrackingSession}
            color={tracking ? "#F44336" : "#4CAF50"} // Red when active, Green when inactive
            disabled={!appReady}
          />
        </View>

        {!appReady && (
          <Text style={styles.initializingText}>
            ⏳ Please wait, app is initializing...
          </Text>
        )}
      </View>

      {/* Map */}
      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>Route Map</Text>
        {locations.length > 1 ? (
          <MapView
            style={styles.mapDisplay}
            initialRegion={{
              latitude: locations[0].lat,
              longitude: locations[0].lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
          >
            <Polyline
              coordinates={polylineCoordinates}
              strokeColor="#2196F3"
              strokeWidth={4}
            />
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.placeholderText}>No route data</Text>
            <Text style={styles.placeholderSubtext}>
              {tracking ? 'Waiting for location...' : 'Start tracking to see map'}
            </Text>
          </View>
        )}
      </View>

      {/* Recent Locations */}
      {locations.length > 0 && (
        <View style={styles.historyPanel}>
          <Text style={styles.sectionTitle}>Recent Points</Text>
          {locations.slice(-3).reverse().map((loc, idx) => (
            <View key={idx} style={styles.positionItem}>
              <Text style={styles.positionTime}>{loc.timestamp}</Text>
              <Text style={styles.positionCoordinates}>
                {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Database View Toggle */}
      <View style={styles.togglePanel}>
        <Button
          title={showDatabaseView ? "HIDE DATABASE" : "SHOW DATABASE"}
          onPress={toggleDatabaseView}
          color="#9C27B0"
          disabled={!appReady}
        />
      </View>

      {/* Database Content View */}
      {showDatabaseView && databaseLocations.length > 0 && (
        <View style={styles.databasePanel}>
          <Text style={styles.sectionTitle}>Database Locations ({databaseLocations.length})</Text>
          <ScrollView style={styles.databaseScrollView}>
            {databaseLocations.map((loc, idx) => (
              <View key={idx} style={styles.databaseItem}>
                <Text style={styles.databaseItemId}>ID: {loc.id}</Text>
                <Text style={styles.databaseItemRoute}>Route: {loc.route_id}</Text>
                <Text style={styles.databaseItemCoords}>
                  {loc.latitude?.toFixed(6) || 'N/A'}, {loc.longitude?.toFixed(6) || 'N/A'}
                </Text>
                <Text style={styles.databaseItemTime}>{loc.uiTimestamp || loc.timestamp || 'N/A'}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* System Tools */}
      <View style={styles.systemPanel}>
        <Text style={styles.sectionTitle}>System Tools</Text>

        <View style={styles.systemControls}>
          <Button title="SCHEMA" onPress={debugDatabaseSchema} color="#2196F3" disabled={!appReady} />
          <View style={styles.controlSpacer} />
          <Button title="CONTENT" onPress={debugDatabaseContent} color="#9C27B0" disabled={!appReady} />
          <View style={styles.controlSpacer} />
          <Button title="TEST" onPress={testDatabaseInsert} color="#4CAF50" disabled={!appReady} />
        </View>

        <View style={[styles.systemControls, { marginTop: 10 }]}>
          <Button title="SYSTEM CHECK" onPress={verifySystemOperation} color="#2196F3" disabled={!appReady} />
          <View style={styles.controlSpacer} />
          <Button title="RESET SESSION" onPress={resetSessionData} color="#FF9800" disabled={!appReady} />
        </View>

        <View style={[styles.systemControls, { marginTop: 10 }]}>
          <Button title="FIX DATABASE" onPress={forceDatabaseFix} color="#F44336" disabled={!appReady} />
          <View style={styles.controlSpacer} />
          <Button title="EMERGENCY RESET" onPress={emergencyReset} color="#F44336" disabled={!appReady} />
        </View>

        <Text style={styles.systemNote}>
          SQLite Database • 5-minute intervals • Debug enabled
        </Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#2196F3', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255, 255, 255, 0.9)' },
  warning: { fontSize: 12, color: '#FFEB3B', marginTop: 8, fontStyle: 'italic' },

  statusPanel: {
    margin: 16, marginTop: 20, padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  statusActive: { backgroundColor: '#E8F5E9', borderLeftWidth: 4, borderLeftColor: '#4CAF50' },
  statusInactive: { backgroundColor: '#FFEBEE', borderLeftWidth: 4, borderLeftColor: '#F44336' },
  statusIndicator: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  statusLight: { width: 12, height: 12, borderRadius: 6, marginRight: 10 },
  lightActive: { backgroundColor: '#4CAF50' },
  lightInactive: { backgroundColor: '#F44336' },
  statusText: { fontSize: 16, fontWeight: '600', color: '#333' },
  sessionIdContainer: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  sessionIdLabel: { fontSize: 14, fontWeight: '600', color: '#333', marginRight: 8 },
  sessionIdValue: { fontSize: 14, fontWeight: 'bold', color: '#2196F3', fontFamily: 'monospace' },
  routeId: { fontSize: 12, color: '#666', fontFamily: 'monospace', marginTop: 4 },

  databaseStatus: {
    backgroundColor: '#f5f5f5',
    padding: 10,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  databaseStat: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
    fontFamily: 'monospace',
  },

  metricsPanel: {
    backgroundColor: 'white', marginHorizontal: 16, marginBottom: 20, padding: 20, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metricItem: { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  metricValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  metricDivider: { width: 1, backgroundColor: '#e0e0e0', marginHorizontal: 8 },
  lastUpdate: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },

  controlPanel: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  buttonContainer: {
    opacity: 1,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  initializingText: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic',
  },

  togglePanel: {
    marginHorizontal: 16,
    marginBottom: 20,
  },

  mapSection: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  mapDisplay: { height: 250, borderRadius: 12, overflow: 'hidden' },
  mapPlaceholder: {
    height: 250, borderRadius: 12, backgroundColor: '#f0f0f0',
    justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: '#ddd', borderStyle: 'dashed',
  },
  placeholderText: { fontSize: 16, color: '#999', marginBottom: 4 },
  placeholderSubtext: { fontSize: 12, color: '#aaa' },

  historyPanel: {
    backgroundColor: 'white', marginHorizontal: 16, marginBottom: 20, padding: 16, borderRadius: 12,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3,
  },
  positionItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  positionTime: { fontSize: 12, color: '#666', marginBottom: 2 },
  positionCoordinates: { fontSize: 13, fontWeight: '600', color: '#333' },

  databasePanel: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    maxHeight: 300,
  },
  databaseScrollView: {
    maxHeight: 250,
  },
  databaseItem: {
    padding: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    backgroundColor: '#f9f9f9',
    marginBottom: 8,
    borderRadius: 6,
  },
  databaseItemId: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  databaseItemRoute: {
    fontSize: 12,
    color: '#2196F3',
    fontWeight: '600',
    marginTop: 2,
  },
  databaseItemCoords: {
    fontSize: 13,
    color: '#333',
    fontWeight: '600',
    marginTop: 2,
  },
  databaseItemTime: {
    fontSize: 11,
    color: '#888',
    marginTop: 2,
    fontStyle: 'italic',
  },

  systemPanel: {
    backgroundColor: 'white', marginHorizontal: 16, marginBottom: 30, padding: 20, borderRadius: 12,
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  systemControls: { flexDirection: 'row', justifyContent: 'center', marginBottom: 12 },
  controlSpacer: { width: 10 },
  systemNote: { fontSize: 12, color: '#666', textAlign: 'center', fontStyle: 'italic', marginTop: 8 },
});

export default QuickStartPage;