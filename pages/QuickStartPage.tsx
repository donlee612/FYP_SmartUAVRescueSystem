import React, { useState, useRef, useEffect } from 'react';
import { View, Text, StyleSheet, Button, Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import Geolocation from '@react-native-community/geolocation';
import MapView, { Polyline } from 'react-native-maps';

const QuickStartPage = () => {
  const { t } = useTranslation();
  const [locations, setLocations] = useState<{lat: number, lng: number, time: string}[]>([]);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const [tracking, setTracking] = useState(true);

  // 取得定位
  const getLocation = () => {
    Geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setLocations(prev => [
          ...prev,
          { lat: latitude, lng: longitude, time: new Date().toLocaleTimeString() }
        ]);
      },
      err => {
        Alert.alert(t('quickStartPage.locationFailed'), err.message);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );
  };

  // 按下 Quick Start
  const handleQuickStart = () => {
    setTracking(true);
    setLocations([]); // 重新開始時清空路線
    getLocation(); // 立即取得一次
    if (!intervalRef.current) {
      intervalRef.current = setInterval(getLocation, 5 * 60 * 1000); // 每5分鐘
      Alert.alert(t('quickStartPage.quickStart'), t('quickStartPage.startTracking'));
    }
  };

  // 按下 結束
  const handleStop = () => {
    setTracking(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    Alert.alert(t('quickStartPage.trackingEnded'), t('quickStartPage.showRoute'));
  };

  // 清理 interval
  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Polyline points
  const polylineCoords = locations.map(loc => ({
    latitude: loc.lat,
    longitude: loc.lng,
  }));

  return (
    <View style={styles.container}>
      <Text>{t('quickStartPage.title')}</Text>
      <Button title={t('quickStartPage.quickStart')} onPress={handleQuickStart} />
      <Button title={t('quickStartPage.endTracking')} onPress={handleStop} color="#d9534f" />
      <View style={styles.list}>
        {locations.map((loc, idx) => (
          <Text key={idx}>
            {loc.time}: {loc.lat.toFixed(5)}, {loc.lng.toFixed(5)}
          </Text>
        ))}
      </View>
      {/* 顯示路線地圖 */}
      {!tracking && locations.length > 1 && (
        <MapView
          style={styles.map}
          initialRegion={{
            latitude: locations[0].lat,
            longitude: locations[0].lng,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
        >
          <Polyline
            coordinates={polylineCoords}
            strokeColor="#007bff"
            strokeWidth={4}
          />
        </MapView>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: 40,
  },
  list: {
    marginTop: 20,
    alignItems: 'center',
  },
  map: {
    width: '90%',
    height: 300,
    marginTop: 20,
    borderRadius: 12,
  },
});

export default QuickStartPage;