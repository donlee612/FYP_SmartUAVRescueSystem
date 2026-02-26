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
import { Platform, PermissionsAndroid } from 'react-native';
import { initDb, getDb } from '../services/db/initDb';

// ────────────────────────────────────────────────
// SQLite Helper（保持不變）
// ────────────────────────────────────────────────
class LocationTrackerDB {
  static async addLocation(
    routeId: number,
    latitude: number,
    longitude: number,
    accuracy?: number | null,
    altitude?: number | null,
    speed?: number | null,
    heading?: number | null
  ) {
    try {
      const db = getDb();
      const timestamp = new Date().toISOString();

      const result = await db.executeSql(
        'INSERT INTO locations (route_id, latitude, longitude, timestamp, accuracy, altitude, speed, heading) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [routeId, latitude, longitude, timestamp, accuracy, altitude, speed, heading]
      );

      return {
        success: true,
        insertedId: result[0].insertId,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
    } catch (error: any) {
      console.error('Error saving location:', error);
      return { success: false, error: error.message };
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

      return {
        id: result.insertId,
        name,
        startTime,
        sessionId
      };
    } catch (error: any) {
      console.error('Error creating route:', error);
      throw error;
    }
  }

  static async getStats() {
    try {
      const db = getDb();
      const [routes] = await db.executeSql('SELECT COUNT(*) as count FROM routes');
      const [locations] = await db.executeSql('SELECT COUNT(*) as count FROM locations');

      return {
        totalRoutes: routes.rows.item(0).count,
        totalLocations: locations.rows.item(0).count
      };
    } catch (error) {
      console.error('Error getting stats:', error);
      return { totalRoutes: 0, totalLocations: 0 };
    }
  }
}

// ────────────────────────────────────────────────
// 主畫面元件
// ────────────────────────────────────────────────
const QuickStartPage = () => {
  const { t } = useTranslation();

  const [locations, setLocations] = useState<{ lat: number; lng: number; timestamp: string }[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentSessionRef = useRef<string | null>(null);
  const currentPointCounter = useRef(1);
  const [tracking, setTracking] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<{ id: number; name: string; sessionId: string } | null>(null);
  const [stats, setStats] = useState({ totalPoints: 0, distance: '0m', sessionDuration: '0 min' });
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');
  const [appReady, setAppReady] = useState(false);
  const [firebaseUploadCount, setFirebaseUploadCount] = useState(0);
  const [lastFirebaseUpload, setLastFirebaseUpload] = useState<string>('');

  const UPDATE_INTERVAL = 5000;

  // 初始化資料庫
  useEffect(() => {
    const initialize = async () => {
      try {
        await initDb();
        setAppReady(true);
      } catch (err) {
        console.error('Failed to initialize database', err);
        Alert.alert(
          t('quickStartPage.alert.initFailed.title'),
          t('quickStartPage.alert.initFailed.message')
        );
        setAppReady(true);
      }
    };

    initialize();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // ────────────────────────────────────────────────
  // 工具函式（全部定義在這裡）
  // ────────────────────────────────────────────────
  const calculateDistance = (points: Array<{ lat: number; lng: number }>): string => {
    if (points.length < 2) return t('quickStartPage.stats.zeroDistance');
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const latDiff = (p2.lat - p1.lat) * 111320;
      const lngDiff = (p2.lng - p1.lng) * 111320 * Math.cos((p1.lat * Math.PI) / 180);
      total += Math.sqrt(latDiff ** 2 + lngDiff ** 2);
    }
    return total < 1000
      ? t('quickStartPage.stats.meters', { value: Math.round(total) })
      : t('quickStartPage.stats.kilometers', { value: (total / 1000).toFixed(1) });
  };

  const calculateSessionDuration = (locs: Array<{ timestamp: string }>): string => {
    if (locs.length < 2) return t('quickStartPage.stats.zeroDuration');
    const start = new Date(locs[0].timestamp);
    const end = new Date(locs[locs.length - 1].timestamp);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return t('quickStartPage.stats.minutes', { value: minutes });
  };

  const updateStats = (locs: typeof locations) => {
    setStats({
      totalPoints: locs.length,
      distance: calculateDistance(locs),
      sessionDuration: calculateSessionDuration(locs)
    });
  };

  const requestLocationPermission = async (): Promise<boolean> => {
    if (Platform.OS === 'ios') return true;

    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        {
          title: t('quickStartPage.permission.title'),
          message: t('quickStartPage.permission.message'),
          buttonNeutral: t('quickStartPage.permission.neutral'),
          buttonNegative: t('quickStartPage.permission.negative'),
          buttonPositive: t('quickStartPage.permission.positive')
        }
      );
      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (err) {
      console.warn('Permission request error', err);
      return false;
    }
  };

  // ────────────────────────────────────────────────
  // 核心函式
  // ────────────────────────────────────────────────
  const getUserPhone = async () => {
    try {
      await initDb();
      const db = getDb();
      const result = await db.executeSql(
        'SELECT phone FROM user ORDER BY id DESC LIMIT 1'
      );

      if (result[0].rows.length > 0) {
        const phone = result[0].rows.item(0).phone;
        return phone ? phone.replace(/[^0-9]/g, '') : null;
      }
      return null;
    } catch (err) {
      console.error('Error getting phone from SQLite:', err);
      return null;
    }
  };

  const uploadLocationToFirebase = async (
    latitude: number,
    longitude: number,
    accuracy?: number | null,
    altitude?: number | null,
    speed?: number | null,
    heading?: number | null,
    sid?: string
  ) => {
    const phone = await getUserPhone();
    if (!phone || !sid) {
      console.warn('Missing phone or sessionId, skipping upload');
      return;
    }

    const data = {
      latitude,
      longitude,
      accuracy: accuracy ?? null,
      altitude: altitude ?? null,
      speed: speed ?? null,
      heading: heading ?? null,
      timestamp: Date.now(),
      timestampISO: new Date().toISOString()
    };

    const pointKey = `point_${currentPointCounter.current}`;
    currentPointCounter.current += 1;

    try {
      const res = await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${phone}/QuickStartSessions/${sid}/points/${pointKey}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        }
      );

      if (res.ok) {
        setFirebaseUploadCount(c => c + 1);
        setLastFirebaseUpload(
          new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        );
      } else {
        console.warn('Upload failed, status:', res.status);
      }
    } catch (err) {
      console.error('Firebase upload error:', err);
    }
  };

  const acquireLocation = async () => {
    const hasPerm = await requestLocationPermission();
    if (!hasPerm) return;

    Geolocation.getCurrentPosition(
      async pos => {
        const { latitude, longitude, accuracy, altitude, speed, heading } = pos.coords;
        const ts = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

        const newLoc = { lat: latitude, lng: longitude, timestamp: ts };
        setLocations(prev => {
          const updated = [...prev, newLoc];
          updateStats(updated);
          return updated;
        });
        setLastUpdateTime(ts);

        const sidToUse = currentSessionRef.current || (currentRoute?.sessionId || '');
        if (sidToUse) {
          await LocationTrackerDB.addLocation(
            currentRoute?.id || 0,
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            heading
          );

          await uploadLocationToFirebase(
            latitude,
            longitude,
            accuracy,
            altitude,
            speed,
            heading,
            sidToUse
          );
        } else {
          console.warn('No sessionId available for saving location');
        }
      },
      err => {
        console.warn('Get location failed', err);
        let msg = t('quickStartPage.alert.locationError.default');
        if (err.code === 1) msg = t('quickStartPage.alert.locationError.permission');
        if (err.code === 2) msg = t('quickStartPage.alert.locationError.unavailable');
        if (err.code === 3) msg = t('quickStartPage.alert.locationError.timeout');
        Alert.alert(t('quickStartPage.alert.locationError.title'), msg);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 300000 }
    );
  };

  const generateSessionId = async () => {
    const nextNum = await getNextSessionNumber();
    return `session_${nextNum}`;
  };

  const getNextSessionNumber = async () => {
    try {
      await initDb();
      const db = getDb();
      const [result] = await db.executeSql('SELECT COUNT(*) as count FROM routes');
      const count = result.rows.item(0).count || 0;
      return count + 1;
    } catch (err) {
      console.error('Error getting session count:', err);
      return 1;
    }
  };

  const startTracking = async () => {
    if (tracking || !appReady) return;

    setTracking(true);
    setLocations([]);
    currentPointCounter.current = 1;

    const sid = await generateSessionId();
    setSessionId(sid);
    currentSessionRef.current = sid;

    try {
      const route = await LocationTrackerDB.createRoute(`Session-${sid}`, sid);
      setCurrentRoute(route);

      const phone = await getUserPhone();
      if (!phone) {
        Alert.alert('錯誤', '請先在個人資料頁設定電話號碼');
        setTracking(false);
        return;
      }

      const normalizedPhone = phone;

      const startTime = new Date().toISOString();

      await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${normalizedPhone}/QuickStartSessions/${sid}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            startTime,
            status: 'ACTIVE'
          })
        }
      );

      await acquireLocation();

      intervalRef.current = setInterval(acquireLocation, UPDATE_INTERVAL);

      Alert.alert(
        t('quickStartPage.alert.trackingStarted.title'),
        t('quickStartPage.alert.trackingStarted.message', { sessionId: sid })
      );
    } catch (err: any) {
      setTracking(false);
      currentSessionRef.current = null;
      Alert.alert(
        t('quickStartPage.alert.startFailed.title'),
        err.message || t('quickStartPage.alert.startFailed.message')
      );
    }
  };

  const stopTracking = async () => {
    setTracking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const phone = await getUserPhone();
    if (phone && sessionId) {
      const normalizedPhone = phone;

      // 先讀取現有 points
      const currentDataRes = await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${normalizedPhone}/QuickStartSessions/${sessionId}.json`
      );
      const currentData = await currentDataRes.json() || {};

      const points = currentData.points || {};

      await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${normalizedPhone}/QuickStartSessions/${sessionId}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            points,           // 第一個屬性
            endTime: new Date().toISOString(),
            startTime: currentData.startTime || new Date().toISOString(),
            status: 'COMPLETED'
          })
        }
      );
    }

    currentSessionRef.current = null;
    setSessionId('');

    Alert.alert(
      t('quickStartPage.alert.trackingStopped.title'),
      t('quickStartPage.alert.trackingStopped.message', { count: locations.length })
    );
  };

  const polylineCoords = locations.map(loc => ({
    latitude: loc.lat,
    longitude: loc.lng
  }));

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('quickStartPage.title')}</Text>
        <Text style={styles.subtitle}>{t('quickStartPage.subtitle')}</Text>
        {!appReady && <Text style={styles.warning}>{t('quickStartPage.initializing')}</Text>}
      </View>

      <View style={[styles.statusPanel, tracking ? styles.statusActive : styles.statusInactive]}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusLight, tracking ? styles.lightActive : styles.lightInactive]} />
          <Text style={styles.statusText}>
            {tracking ? t('quickStartPage.status.active') : t('quickStartPage.status.inactive')}
          </Text>
        </View>
        <View style={styles.sessionIdContainer}>
          <Text style={styles.sessionIdLabel}>{t('quickStartPage.session.label')}</Text>
          <Text style={styles.sessionIdValue}>
            {sessionId || (tracking ? t('quickStartPage.session.generating') : t('quickStartPage.session.notStarted'))}
          </Text>
        </View>
        {currentRoute && (
          <Text style={styles.routeId}>
            {t('quickStartPage.route.label')}: {currentRoute.id}
          </Text>
        )}
      </View>

      <View style={styles.databaseStatus}>
        <Text style={styles.databaseStat}>
          {t('quickStartPage.firebase.uploads')}: {firebaseUploadCount}
          {lastFirebaseUpload ? ` • ${t('quickStartPage.firebase.last')}: ${lastFirebaseUpload}` : ''}
        </Text>
      </View>

      <View style={styles.metricsPanel}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('quickStartPage.stats.points')}</Text>
            <Text style={styles.metricValue}>{stats.totalPoints}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('quickStartPage.stats.distance')}</Text>
            <Text style={styles.metricValue}>{stats.distance}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('quickStartPage.stats.duration')}</Text>
            <Text style={styles.metricValue}>{stats.sessionDuration}</Text>
          </View>
        </View>
        {lastUpdateTime && (
          <Text style={styles.lastUpdate}>
            {t('quickStartPage.lastUpdate')}: {lastUpdateTime}
          </Text>
        )}
      </View>

      <View style={styles.controlPanel}>
        <View style={[styles.buttonContainer, !appReady && styles.buttonDisabled]}>
          <Button
            title={tracking ? t('quickStartPage.button.stop') : t('quickStartPage.button.start')}
            onPress={tracking ? stopTracking : startTracking}
            color={tracking ? '#F44336' : '#4CAF50'}
            disabled={!appReady}
          />
        </View>
        {!appReady && (
          <Text style={styles.initializingText}>{t('quickStartPage.initializing')}</Text>
        )}
      </View>

      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>{t('quickStartPage.map.title')}</Text>
        {locations.length > 1 ? (
          <MapView
            style={styles.mapDisplay}
            initialRegion={{
              latitude: locations[0].lat,
              longitude: locations[0].lng,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01
            }}
          >
            <Polyline
              coordinates={polylineCoords}
              strokeColor="#2196F3"
              strokeWidth={4}
            />
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.placeholderText}>{t('quickStartPage.map.noData')}</Text>
            <Text style={styles.placeholderSubtext}>
              {tracking
                ? t('quickStartPage.map.waitingForLocation')
                : t('quickStartPage.map.promptToStart')}
            </Text>
          </View>
        )}
      </View>

      {locations.length > 0 && (
        <View style={styles.historyPanel}>
          <Text style={styles.sectionTitle}>{t('quickStartPage.history.title')}</Text>
          {locations.slice(-3).reverse().map((loc, i) => (
            <View key={i} style={styles.positionItem}>
              <Text style={styles.positionTime}>{loc.timestamp}</Text>
              <Text style={styles.positionCoordinates}>
                {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
              </Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#2196F3', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 4 },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },
  warning: { fontSize: 12, color: '#FFEB3B', marginTop: 8, fontStyle: 'italic' },

  statusPanel: {
    margin: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
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
    borderColor: '#e0e0e0'
  },
  databaseStat: { fontSize: 12, color: '#666', fontFamily: 'monospace' },

  metricsPanel: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 20,
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  metricsGrid: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  metricItem: { alignItems: 'center', flex: 1 },
  metricLabel: { fontSize: 12, color: '#666', marginBottom: 4 },
  metricValue: { fontSize: 20, fontWeight: 'bold', color: '#333' },
  metricDivider: { width: 1, backgroundColor: '#e0e0e0', marginHorizontal: 8 },
  lastUpdate: { fontSize: 12, color: '#888', textAlign: 'center', marginTop: 8 },

  controlPanel: { marginHorizontal: 16, marginBottom: 20 },
  buttonContainer: { opacity: 1 },
  buttonDisabled: { opacity: 0.6 },
  initializingText: {
    fontSize: 12,
    color: '#FF9800',
    textAlign: 'center',
    marginTop: 8,
    fontStyle: 'italic'
  },

  mapSection: { marginHorizontal: 16, marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#333', marginBottom: 12 },
  mapDisplay: { height: 250, borderRadius: 12, overflow: 'hidden' },
  mapPlaceholder: {
    height: 250,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed'
  },
  placeholderText: { fontSize: 16, color: '#999', marginBottom: 4 },
  placeholderSubtext: { fontSize: 12, color: '#aaa' },

  historyPanel: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 30,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3
  },
  positionItem: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  positionTime: { fontSize: 12, color: '#666', marginBottom: 2 },
  positionCoordinates: { fontSize: 13, fontWeight: '600', color: '#333' }
});

export default QuickStartPage;