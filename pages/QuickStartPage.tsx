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

// Team Note: Simple in-memory database for tracking locations
// Production: Replace with persistent storage when database issues resolved
class LocationTrackerDB {
  private static instance: LocationTrackerDB;
  private locations: Array<{lat: number, lng: number, timestamp: string, routeId: number}> = [];
  private routes: Array<{id: number, name: string, startTime: string}> = [];

  static getInstance() {
    if (!LocationTrackerDB.instance) {
      LocationTrackerDB.instance = new LocationTrackerDB();
    }
    return LocationTrackerDB.instance;
  }

  // Add new location point to current tracking session
  async addLocation(latitude: number, longitude: number, routeId: number) {
    const newLocation = {
      lat: latitude,
      lng: longitude,
      timestamp: new Date().toISOString(),
      routeId: routeId
    };
    this.locations.push(newLocation);
    console.log('📍 Location recorded:', newLocation);
    return { success: true, location: newLocation };
  }

  // Create new tracking route
  async createRoute(name: string = '') {
    const routeId = Date.now();
    const routeName = name || `Route-${routeId}`;
    const newRoute = {
      id: routeId,
      name: routeName,
      startTime: new Date().toISOString()
    };
    this.routes.push(newRoute);
    console.log('🆕 Route created:', newRoute);
    return newRoute;
  }

  // Get all locations for current session
  async getLocations(routeId?: number) {
    if (routeId) {
      return this.locations.filter(loc => loc.routeId === routeId);
    }
    return this.locations;
  }

  // Clear all tracking data
  async clearSession() {
    this.locations = [];
    this.routes = [];
    console.log('🗑️ Tracking session cleared');
    return { success: true };
  }

  // Get statistics
  async getStats() {
    return {
      totalLocations: this.locations.length,
      totalRoutes: this.routes.length,
      lastUpdate: this.locations.length > 0 ? this.locations[this.locations.length - 1].timestamp : null
    };
  }
}

const QuickStartPage = () => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<{lat: number, lng: number, timestamp: string}[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [tracking, setTracking] = useState(false);
  const [currentRoute, setCurrentRoute] = useState<{id: number, name: string} | null>(null);
  const [stats, setStats] = useState({ totalPoints: 0, distance: '0m', sessionDuration: '0 min' });
  const [lastUpdateTime, setLastUpdateTime] = useState<string>('');
  const [sessionId, setSessionId] = useState<string>('');

  const tracker = LocationTrackerDB.getInstance();
  const UPDATE_INTERVAL = 300000; // 5 minutes in milliseconds

  // Team Note: Component mount/unmount lifecycle
  useEffect(() => {
    console.log('🔧 QuickStart tracking component initialized');

    return () => {
      // Cleanup interval on component unmount
      if (intervalRef.current) {
        console.log('🧹 Clearing tracking interval');
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  // Team Note: Calculate approximate distance between location points
  const calculateDistance = (points: Array<{lat: number, lng: number}>): string => {
    if (points.length < 2) return '0m';

    let totalDistance = 0;
    for (let i = 1; i < points.length; i++) {
      const p1 = points[i - 1];
      const p2 = points[i];

      // Approximate distance calculation (meters per degree at equator)
      const latDiff = (p2.lat - p1.lat) * 111320;
      const lngDiff = (p2.lng - p1.lng) * 111320 * Math.cos(p1.lat * Math.PI / 180);
      const segmentDistance = Math.sqrt(latDiff * latDiff + lngDiff * lngDiff);

      totalDistance += segmentDistance;
    }

    // Format distance for display
    if (totalDistance < 1000) {
      return `${Math.round(totalDistance)}m`;
    } else {
      return `${(totalDistance / 1000).toFixed(1)}km`;
    }
  };

  // Team Note: Calculate session duration based on first and last points
  const calculateSessionDuration = (locations: Array<{timestamp: string}>): string => {
    if (locations.length < 2) return '0 min';

    const firstPoint = new Date(locations[0].timestamp);
    const lastPoint = new Date(locations[locations.length - 1].timestamp);
    const durationMinutes = Math.round((lastPoint.getTime() - firstPoint.getTime()) / 60000);

    return `${durationMinutes} min`;
  };

  // Team Note: Update statistics display
  const updateStats = (locationPoints: Array<{lat: number, lng: number, timestamp: string}>) => {
    const newStats = {
      totalPoints: locationPoints.length,
      distance: calculateDistance(locationPoints),
      sessionDuration: calculateSessionDuration(locationPoints)
    };
    setStats(newStats);
  };

  // Team Note: Primary location acquisition function
  const acquireLocation = async () => {
    const hasPermission = await requestLocationPermission();
    if (!hasPermission) return;

    Geolocation.getCurrentPosition(
      async position => {
        const { latitude, longitude } = position.coords;
        const timestamp = new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit'
        });

        const locationPoint = {
          lat: latitude,
          lng: longitude,
          timestamp
        };

        setLocations(prev => {
          const updatedLocations = [...prev, locationPoint];
          updateStats(updatedLocations);
          return updatedLocations;
        });

        if (currentRoute) {
          await tracker.addLocation(latitude, longitude, currentRoute.id);
        }

        setLastUpdateTime(timestamp);
        console.log(`📍 Location acquired: ${latitude}, ${longitude}`);
      },
      error => {
        console.warn('⚠️ Location error:', error);

        let message = 'Unable to acquire location.';
        switch (error.code) {
          case 1:
            message = 'Location permission denied.';
            break;
          case 2:
            message = 'Location unavailable. Check GPS or network.';
            break;
          case 3:
            message = 'Location request timed out.';
            break;
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

  // Team Note: Generate unique session ID
  const generateSessionId = (): string => {
    const now = new Date();
    const dateStr = now.toISOString().slice(2, 10).replace(/-/g, '');
    const timeStr = now.toTimeString().slice(0, 5).replace(/:/g, '');
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `SESS-${dateStr}-${timeStr}-${randomNum}`;
  };

  // Team Note: Initialize new tracking session
  const initiateTrackingSession = async () => {
    if (tracking) return;

    console.log('🚀 Initiating new tracking session');
    setTracking(true);
    setLocations([]);

    // Generate and display session ID
    const newSessionId = generateSessionId();
    setSessionId(newSessionId);
    console.log(`🆔 Session ID: ${newSessionId}`);

    // Create new route for this session
    const newRoute = await tracker.createRoute(`Session-${newSessionId}`);
    setCurrentRoute(newRoute);

    // Initial location acquisition
    acquireLocation();

    // Establish recurring acquisition interval (5 minutes)
    if (!intervalRef.current) {
      intervalRef.current = setInterval(acquireLocation, UPDATE_INTERVAL);
      console.log(`⏱️ Tracking interval set: ${UPDATE_INTERVAL/60000} minutes`);

      Alert.alert(
        'Tracking Active',
        `Session ID: ${newSessionId}\n\nLocation tracking initiated. Position will be recorded every 5 minutes.`,
        [{ text: 'Acknowledged' }]
      );
    }
  };

  // Team Note: Terminate current tracking session
  const terminateTrackingSession = () => {
    console.log('🛑 Terminating tracking session');
    setTracking(false);

    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    Alert.alert(
      'Tracking Complete',
      `Session ID: ${sessionId}\n\nCompleted with ${locations.length} location points recorded.`,
      [{ text: 'Acknowledged' }]
    );
  };

  // Team Note: Verify system functionality
  // Team Note: Verify system functionality
  const verifySystemOperation = async () => {
    let locationStatus = '❌ Failed';
    let databaseStatus = '❌ Failed';
    let sessionInfo = sessionId ? `Session ID: ${sessionId}` : 'No active session';

    try {
      // Test location services with a shorter timeout
      await new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(
          resolve,
          (error) => {
            // Team Note: Provide specific error messages for common location issues
            let errorMessage = 'Location service unavailable';
            switch(error.code) {
              case 1: // PERMISSION_DENIED
                errorMessage = 'Location permission denied';
                break;
              case 2: // POSITION_UNAVAILABLE
                errorMessage = 'Position unavailable - check network/GPS';
                break;
              case 3: // TIMEOUT
                errorMessage = 'Location request timeout';
                break;
            }
            reject(new Error(errorMessage));
          },
          { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 }
        );
      });
      locationStatus = '✅ Operational';
    } catch (locationError: any) {
      console.log('Location test result:', locationError.message);
    }

    try {
      // Test database functionality
      const testRouteId = Date.now();
      const testResult = await tracker.addLocation(37.7749, -122.4194, testRouteId);

      if (testResult.success) {
        databaseStatus = '✅ Operational';
      } else {
        throw new Error('Database operation failed');
      }
    } catch (dbError) {
      console.log('Database test result:', dbError);
    }

    // Team Note: Generate comprehensive system report
    const systemReport = [
      '=== SYSTEM STATUS REPORT ===',
      sessionInfo,
      `Location Services: ${locationStatus}`,
      `Data Storage: ${databaseStatus}`,
      `Tracking Interval: ${UPDATE_INTERVAL/60000} minutes`,
      `Last Update: ${lastUpdateTime || 'None'}`,
      `Total Points Recorded: ${stats.totalPoints}`,
      '==========================='
    ].join('\n');

    Alert.alert(
      'System Status Report',
      systemReport,
      [{ text: 'Acknowledged' }]
    );
  };

const requestLocationPermission = async (): Promise<boolean> => {
  if (Platform.OS === 'ios') {
    return true; // iOS handled via Info.plist
  }

  try {
    const granted = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
      {
        title: 'Location Permission Required',
        message:
          'This app needs access to your location to track your route.',
        buttonNeutral: 'Ask Me Later',
        buttonNegative: 'Cancel',
        buttonPositive: 'OK',
      }
    );

    if (granted === PermissionsAndroid.RESULTS.GRANTED) {
      console.log('✅ Location permission granted');
      return true;
    } else {
      Alert.alert(
        'Permission Denied',
        'Location permission is required for tracking.',
        [
          { text: 'Cancel' },
          {
            text: 'Open Settings',
            onPress: () => Linking.openSettings(),
          },
        ]
      );
      return false;
    }
  } catch (err) {
    console.warn('Permission request error:', err);
    return false;
  }
};

  // Team Note: Clear current session data
  const resetSessionData = () => {
    Alert.alert(
      'Reset Session Data',
      `Session ID: ${sessionId || 'N/A'}\n\nClear all location points from current session?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset Session',
          style: 'destructive',
          onPress: () => {
            tracker.clearSession();
            setLocations([]);
            setCurrentRoute(null);
            setSessionId('');
            setStats({ totalPoints: 0, distance: '0m', sessionDuration: '0 min' });
            console.log('🔄 Session data cleared');
            Alert.alert('Session Reset', 'All session data has been cleared.');
          }
        }
      ]
    );
  };

  // Team Note: Generate polyline coordinates for map display
  const polylineCoordinates = locations.map(loc => ({
    latitude: loc.lat,
    longitude: loc.lng,
  }));

  return (
    <ScrollView style={styles.container}>
      {/* Session Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📍 Location Tracking</Text>
        <Text style={styles.subtitle}>5-minute position interval</Text>
      </View>

      {/* Session Status Display */}
      <View style={[styles.statusPanel, tracking ? styles.statusActive : styles.statusInactive]}>
        <View style={styles.statusIndicator}>
          <View style={[styles.statusLight, tracking ? styles.lightActive : styles.lightInactive]} />
          <Text style={styles.statusText}>
            {tracking ? 'SESSION ACTIVE' : 'SESSION INACTIVE'}
          </Text>
        </View>

        {/* Session ID Display */}
        <View style={styles.sessionIdContainer}>
          <Text style={styles.sessionIdLabel}>Session ID:</Text>
          <Text style={styles.sessionIdValue}>
            {sessionId || tracking ? 'Generating...' : 'Awaiting session start'}
          </Text>
        </View>

        {currentRoute && (
          <Text style={styles.routeId}>Internal Route ID: {currentRoute.id}</Text>
        )}
      </View>

      {/* Metrics Display */}
      <View style={styles.metricsPanel}>
        <View style={styles.metricsGrid}>
          <View style={styles.metricItem}>
            <Text style={styles.metricLabel}>Position Points</Text>
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
          <Text style={styles.lastUpdate}>Last position acquired: {lastUpdateTime}</Text>
        )}
      </View>

      {/* Session Control */}
      <View style={styles.controlPanel}>
        {!tracking ? (
          <Button
            title="INITIATE TRACKING"
            onPress={initiateTrackingSession}
            color="#4CAF50"
          />
        ) : (
          <Button
            title="TERMINATE TRACKING"
            onPress={terminateTrackingSession}
            color="#F44336"
          />
        )}
      </View>

      {/* Route Visualization */}
      <View style={styles.mapSection}>
        <Text style={styles.sectionTitle}>Route Visualization</Text>
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
            <Text style={styles.placeholderText}>Tracking session inactive</Text>
            <Text style={styles.placeholderSubtext}>Initiate tracking to visualize route</Text>
            {sessionId && (
              <Text style={styles.sessionIdNote}>Session ID: {sessionId}</Text>
            )}
          </View>
        )}
      </View>

      {/* Position History */}
      {locations.length > 0 && (
        <View style={styles.historyPanel}>
          <View style={styles.historyHeader}>
            <Text style={styles.sectionTitle}>Recent Positions</Text>
            {sessionId && (
              <Text style={styles.sessionIdSmall}>Session: {sessionId.substring(0, 12)}...</Text>
            )}
          </View>
          {locations.slice(-3).reverse().map((loc, index) => (
            <View key={index} style={styles.positionItem}>
              <Text style={styles.positionTime}>{loc.timestamp}</Text>
              <Text style={styles.positionCoordinates}>
                {loc.lat.toFixed(6)}, {loc.lng.toFixed(6)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* System Management */}
      <View style={styles.systemPanel}>
        <Text style={styles.sectionTitle}>System Management</Text>
        <View style={styles.systemControls}>
          <Button
            title="SYSTEM CHECK"
            onPress={verifySystemOperation}
            color="#2196F3"
          />
          <View style={styles.controlSpacer} />
          <Button
            title="RESET SESSION"
            onPress={resetSessionData}
            color="#FF9800"
          />
        </View>
        <Text style={styles.systemNote}>
          Tracking interval: {UPDATE_INTERVAL/60000} minutes • In-memory storage
        </Text>
        {sessionId && (
          <Text style={styles.sessionIdDisplay}>Active Session: {sessionId}</Text>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    padding: 20,
    backgroundColor: '#2196F3',
    alignItems: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.9)',
  },
  statusPanel: {
    margin: 16,
    marginTop: 20,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusActive: {
    backgroundColor: '#E8F5E9',
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  statusInactive: {
    backgroundColor: '#FFEBEE',
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  statusIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  statusLight: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  lightActive: {
    backgroundColor: '#4CAF50',
  },
  lightInactive: {
    backgroundColor: '#F44336',
  },
  statusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  sessionIdContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionIdLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginRight: 8,
  },
  sessionIdValue: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#2196F3',
    fontFamily: 'monospace',
  },
  routeId: {
    fontSize: 12,
    color: '#666',
    fontFamily: 'monospace',
    marginTop: 4,
  },
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
    elevation: 3,
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricItem: {
    alignItems: 'center',
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  metricDivider: {
    width: 1,
    backgroundColor: '#e0e0e0',
    marginHorizontal: 8,
  },
  lastUpdate: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    marginTop: 8,
  },
  controlPanel: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  mapSection: {
    marginHorizontal: 16,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 12,
  },
  mapDisplay: {
    height: 250,
    borderRadius: 12,
    overflow: 'hidden',
  },
  mapPlaceholder: {
    height: 250,
    borderRadius: 12,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  placeholderText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 4,
  },
  placeholderSubtext: {
    fontSize: 12,
    color: '#aaa',
  },
  sessionIdNote: {
    fontSize: 11,
    color: '#888',
    marginTop: 8,
    fontFamily: 'monospace',
  },
  historyPanel: {
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
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionIdSmall: {
    fontSize: 11,
    color: '#666',
    fontFamily: 'monospace',
  },
  positionItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  positionTime: {
    fontSize: 12,
    color: '#666',
    marginBottom: 2,
  },
  positionCoordinates: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  systemPanel: {
    backgroundColor: 'white',
    marginHorizontal: 16,
    marginBottom: 30,
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  systemControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 12,
  },
  controlSpacer: {
    width: 10,
  },
  systemNote: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    fontStyle: 'italic',
    marginTop: 8,
  },
  sessionIdDisplay: {
    fontSize: 12,
    color: '#2196F3',
    textAlign: 'center',
    fontWeight: '600',
    marginTop: 8,
    fontFamily: 'monospace',
  },
});

export default QuickStartPage;