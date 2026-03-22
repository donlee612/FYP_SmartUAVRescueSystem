import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Platform,
  PermissionsAndroid,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Polyline } from 'react-native-maps';
import { initDb, getDb } from '../services/db/initDb';

// ────────────────────────────────────────────────
// 顏色與樣式常數（方便未來統一調整）
const COLORS = {
  primary: '#3B82F6',       // blue-500
  primaryDark: '#1D4ED8',
  success: '#10B981',       // green-500
  danger: '#EF4444',
  background: '#F9FAFB',
  card: '#FFFFFF',
  text: '#111827',
  textSecondary: '#6B7280',
  border: '#E5E7EB',
  mapBorder: '#BFDBFE',
  lightBg: '#F0F9FF',
  header: '#000000',
};

const SHADOW_SM = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.06,
  shadowRadius: 4,
  elevation: 2,
};

const SHADOW_MD = {
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.1,
  shadowRadius: 8,
  elevation: 4,
};

// ────────────────────────────────────────────────
// SQLite Helper（保持原樣）
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
  // 工具函式
  // ────────────────────────────────────────────────
  const calculateDistance = (points: Array<{ lat: number; lng: number }>): string => {
    if (points.length < 2) return '0m';
    let total = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];
      const latDiff = (p2.lat - p1.lat) * 111320;
      const lngDiff = (p2.lng - p1.lng) * 111320 * Math.cos((p1.lat * Math.PI) / 180);
      total += Math.sqrt(latDiff ** 2 + lngDiff ** 2);
    }
    return total < 1000
      ? `${Math.round(total)}m`
      : `${(total / 1000).toFixed(1)}km`;
  };

  const calculateSessionDuration = (locs: Array<{ timestamp: string }>): string => {
    if (locs.length < 2) return '0 min';
    const start = new Date(locs[0].timestamp);
    const end = new Date(locs[locs.length - 1].timestamp);
    const minutes = Math.round((end.getTime() - start.getTime()) / 60000);
    return `${minutes} min`;
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

      const normalizedPhone = phone.replace(/[^0-9]/g, '');

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
      const normalizedPhone = phone.replace(/[^0-9]/g, '');

      try {
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
              points,
              endTime: new Date().toISOString(),
              startTime: currentData.startTime || new Date().toISOString(),
              status: 'COMPLETED'
            })
          }
        );
      } catch (err) {
        console.error('Failed to finalize session on Firebase:', err);
      }
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
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>{t('quickStartPage.title')}</Text>
        <Text style={styles.subtitle}>{t('quickStartPage.subtitle')}</Text>
        {!appReady && (
          <View style={styles.initializingContainer}>
            <ActivityIndicator size="small" color="white" />
            <Text style={styles.initializingText}>{t('quickStartPage.initializing')}</Text>
          </View>
        )}
      </View>

      {/* 狀態卡片 */}
      <View style={[styles.statusCard, tracking ? styles.statusActive : styles.statusInactive, SHADOW_MD]}>
        <View style={styles.statusRow}>
          <View style={[
            styles.statusLight,
            { backgroundColor: tracking ? COLORS.success : COLORS.danger }
          ]} />
          <Text style={styles.statusText}>
            {tracking ? t('quickStartPage.status.active') : t('quickStartPage.status.inactive')}
          </Text>
        </View>

        <View style={styles.sessionInfoRow}>
          <Text style={styles.sessionLabel}>{t('quickStartPage.session.label')}</Text>
          <Text style={styles.sessionValue}>
            {sessionId || (tracking ? t('quickStartPage.session.generating') : '—')}
          </Text>
        </View>

        {currentRoute && (
          <Text style={styles.routeInfo}>
            Route #{currentRoute.id}
          </Text>
        )}

        <View style={styles.uploadStat}>
          <Text style={styles.uploadText}>
            Firebase 上傳: {firebaseUploadCount}
            {lastFirebaseUpload ? ` • 最後: ${lastFirebaseUpload}` : ''}
          </Text>
        </View>
      </View>

      {/* 數據面板 */}
      <View style={[styles.metricsCard, SHADOW_MD]}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('quickStartPage.stats.points')}</Text>
            <Text style={[styles.metricValue, { color: COLORS.primary }]}>{stats.totalPoints}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('quickStartPage.stats.distance')}</Text>
            <Text style={[styles.metricValue, { color: COLORS.primary }]}>{stats.distance}</Text>
          </View>
          <View style={styles.metricDivider} />
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>{t('quickStartPage.stats.duration')}</Text>
            <Text style={[styles.metricValue, { color: COLORS.primary }]}>{stats.sessionDuration}</Text>
          </View>
        </View>

        {lastUpdateTime && (
          <Text style={styles.lastUpdateText}>
            最後更新：{lastUpdateTime}
          </Text>
        )}
      </View>

      {/* 主要按鈕 */}
      <View style={styles.controlSection}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            tracking ? styles.buttonStop : styles.buttonStart,
            !appReady && styles.buttonDisabled,
            SHADOW_MD,
          ]}
          onPress={tracking ? stopTracking : startTracking}
          disabled={!appReady}
          activeOpacity={0.85}
        >
          <Text style={styles.buttonText}>
            {tracking ? t('quickStartPage.button.stop') : t('quickStartPage.button.start')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 地圖區域 */}
      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>{t('quickStartPage.map.title')}</Text>
        <View style={[styles.mapContainer, SHADOW_MD]}>
          {locations.length > 1 ? (
            <MapView
              style={StyleSheet.absoluteFillObject}
              initialRegion={{
                latitude: locations[0].lat,
                longitude: locations[0].lng,
                latitudeDelta: 0.018,
                longitudeDelta: 0.018,
              }}
              showsUserLocation={true}
              showsMyLocationButton={true}
              showsCompass={true}
            >
              <Polyline
                coordinates={polylineCoords}
                strokeColor={COLORS.primary}
                strokeWidth={5}
                lineCap="round"
                lineJoin="round"
              />
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.placeholderMain}>
                {tracking ? '等待定位資料...' : '點擊「開始」以記錄軌跡'}
              </Text>
              <Text style={styles.placeholderSub}>
                {t('quickStartPage.map.noData')}
              </Text>
            </View>
          )}
        </View>
      </View>

      {/* 最近記錄（可選展開） */}
      {locations.length > 0 && (
        <View style={[styles.historyCard, SHADOW_MD]}>
          <Text style={styles.sectionTitle}>最近位置</Text>
          {locations.slice(-4).reverse().map((loc, i) => (
            <View key={i} style={styles.historyItem}>
              <Text style={styles.historyTime}>{loc.timestamp}</Text>
              <Text style={styles.historyCoords}>
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
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingVertical: 32,
    paddingHorizontal: 24,
    backgroundColor: COLORS.header,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: 'white',
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.88)',
    textAlign: 'center',
  },
  initializingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  initializingText: {
    color: 'white',
    marginLeft: 10,
    fontSize: 14,
  },

  // 狀態卡片
  statusCard: {
    marginHorizontal: 20,
    marginTop: 24,
    marginBottom: 16,
    padding: 20,
    borderRadius: 20,
  },
  statusActive: {
    backgroundColor: '#F0FDF4',
    borderLeftWidth: 5,
    borderLeftColor: COLORS.success,
  },
  statusInactive: {
    backgroundColor: '#FEF2F2',
    borderLeftWidth: 5,
    borderLeftColor: COLORS.danger,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  statusLight: {
    width: 18,
    height: 18,
    borderRadius: 9,
    marginRight: 12,
    borderWidth: 3,
    borderColor: 'white',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
  },
  sessionInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  sessionLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 10,
  },
  sessionValue: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.primary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  routeInfo: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  uploadStat: {
    marginTop: 8,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  uploadText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // 數據卡片
  metricsCard: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 24,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    flex: 1,
    alignItems: 'center',
  },
  metricLabel: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 6,
  },
  metricValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  metricDivider: {
    width: 1,
    backgroundColor: COLORS.border,
    marginHorizontal: 12,
  },
  lastUpdateText: {
    fontSize: 13,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },

  // 主要按鈕
  controlSection: {
    marginHorizontal: 20,
    marginBottom: 28,
  },
  actionButton: {
    paddingVertical: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonStart: {
    backgroundColor: COLORS.success,
  },
  buttonStop: {
    backgroundColor: COLORS.danger,
  },
  buttonDisabled: {
    opacity: 0.55,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '700',
  },

  // 地圖
  mapSection: {
    marginHorizontal: 20,
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 12,
  },
  mapContainer: {
    height: 340,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: COLORS.mapBorder,
    backgroundColor: COLORS.lightBg,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  placeholderMain: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4B5563',
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSub: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
  },

  // 歷史記錄
  historyCard: {
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 20,
    borderRadius: 20,
    backgroundColor: 'white',
  },
  historyItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  historyTime: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  historyCoords: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
});

export default QuickStartPage;