import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,
  TextInput,
  ScrollView,
  Alert,
  TouchableOpacity,
  Platform,
} from 'react-native';
import MapView, { Marker, Polyline } from 'react-native-maps';
import DatePicker from 'react-native-date-picker';
import { useTranslation } from 'react-i18next';
import { initDb, getDb } from '../services/db/initDb';

interface Waypoint {
  latitude: number;
  longitude: number;
}

interface EventItem {
  id: string;         // 現在是 event_1, event_2...
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  waypoints: Waypoint[];
  createdAt: string;
}

const EventBookingPage = () => {
  const { t } = useTranslation();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  // 新增行程表單狀態
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  // DatePicker 控制
  const [dateOpen, setDateOpen] = useState(false);
  const [startTimeOpen, setStartTimeOpen] = useState(false);
  const [endTimeOpen, setEndTimeOpen] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    loadEventsFromFirebase();
  }, []);

  // 從 SQLite 讀取電話號碼
  const getUserPhone = async () => {
    try {
      await initDb();
      const db = getDb();
      const result = await db.executeSql(
        'SELECT phone FROM user ORDER BY id DESC LIMIT 1'
      );

      if (result[0].rows.length > 0) {
        const phone = result[0].rows.item(0).phone;
        return phone ? phone.replace(/[^0-9]/g, '') : null; // 正規化成純數字
      }
      return null;
    } catch (err) {
      console.error('Error getting phone:', err);
      return null;
    }
  };

  const loadEventsFromFirebase = async () => {
    try {
      setLoading(true);
      const phone = await getUserPhone();
      if (!phone) {
        Alert.alert(
          t('eventBookingPage.alert.noPhone.title'),
          t('eventBookingPage.alert.noPhone.message')
        );
        setEvents([]);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${phone}/booked_events.json`
      );
      const data = await response.json();

      if (data) {
        const loadedEvents: EventItem[] = Object.entries(data).map(([id, val]: [string, any]) => ({
          id,
          ...val,
        }));
        setEvents(loadedEvents.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
      } else {
        setEvents([]);
      }
    } catch (err) {
      console.error('Failed to load events:', err);
      Alert.alert(
        t('eventBookingPage.alert.loadFailed.title'),
        t('eventBookingPage.alert.loadFailed.message')
      );
    } finally {
      setLoading(false);
    }
  };

  const getNextEventNumber = async () => {
    const phone = await getUserPhone();
    if (!phone) return 1;

    try {
      const response = await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${phone}/booked_events.json`
      );
      const data = await response.json();
      if (data) {
        const count = Object.keys(data).length;
        return count + 1;
      }
      return 1;
    } catch (err) {
      console.error('Error getting event count:', err);
      return 1;
    }
  };

  const saveEventToFirebase = async () => {
    if (!title.trim()) {
      Alert.alert(
        t('eventBookingPage.alert.validation.title'),
        t('eventBookingPage.alert.validation.titleRequired')
      );
      return;
    }
    if (waypoints.length < 2) {
      Alert.alert(
        t('eventBookingPage.alert.validation.title'),
        t('eventBookingPage.alert.validation.waypointsRequired')
      );
      return;
    }

    const phone = await getUserPhone();
    if (!phone) {
      Alert.alert(
        t('eventBookingPage.alert.noPhone.title'),
        t('eventBookingPage.alert.noPhone.message')
      );
      return;
    }

    const eventNumber = await getNextEventNumber();
    const eventId = `event_${eventNumber}`;

    const dateStr = selectedDate.toISOString().split('T')[0];
    const startStr = startTime.toTimeString().slice(0, 5);
    const endStr = endTime.toTimeString().slice(0, 5);

    const newEvent = {
      title: title.trim(),
      date: dateStr,
      startTime: startStr,
      endTime: endStr,
      waypoints,
      createdAt: new Date().toISOString(),
    };

    try {
      const response = await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${phone}/booked_events/${eventId}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(newEvent),
        }
      );

      if (response.ok) {
        setEvents(prev => [{ id: eventId, ...newEvent }, ...prev]);
        Alert.alert(
          t('eventBookingPage.alert.saveSuccess.title'),
          t('eventBookingPage.alert.saveSuccess.message')
        );

        resetForm();
      } else {
        throw new Error('Save failed');
      }
    } catch (err) {
      console.error('Failed to save event:', err);
      Alert.alert(
        t('eventBookingPage.alert.saveFailed.title'),
        t('eventBookingPage.alert.saveFailed.message')
      );
    }
  };

  const resetForm = () => {
    setTitle('');
    setSelectedDate(new Date());
    setStartTime(new Date());
    setEndTime(new Date(new Date().setHours(new Date().getHours() + 2)));
    setWaypoints([]);
    setShowForm(false);
  };

  const handleMapLongPress = (e: any) => {
    const { coordinate } = e.nativeEvent;
    setWaypoints(prev => [...prev, coordinate]);
  };

  const removeLastWaypoint = () => {
    setWaypoints(prev => prev.slice(0, -1));
  };

  const formatDate = (d: Date) => d.toLocaleDateString('zh-TW');
  const formatTime = (d: Date) => d.toLocaleTimeString('zh-TW', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>{t('eventBookingPage.title')}</Text>
        <Text style={styles.subtitle}>{t('eventBookingPage.subtitle')}</Text>
      </View>

      {/* 已預訂行程列表 */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('eventBookingPage.events.title', { count: events.length })}
        </Text>

        {loading ? (
          <Text>{t('eventBookingPage.loading')}</Text>
        ) : events.length === 0 ? (
          <Text style={styles.emptyText}>{t('eventBookingPage.events.empty')}</Text>
        ) : (
          events.map(event => (
            <View key={event.id} style={styles.eventCard}>
              <Text style={styles.eventTitle}>{event.title}</Text>
              <Text>{t('eventBookingPage.events.date')}: {event.date}</Text>
              <Text>{t('eventBookingPage.events.time')}: {event.startTime} ~ {event.endTime}</Text>
              <Text>{t('eventBookingPage.events.waypoints')}: {event.waypoints.length}</Text>
            </View>
          ))
        )}
      </View>

      {/* 新增行程按鈕 */}
      <View style={styles.control}>
        <Button
          title={showForm ? t('eventBookingPage.button.cancelAdd') : t('eventBookingPage.button.addNew')}
          color={showForm ? '#F44336' : '#4CAF50'}
          onPress={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
        />
      </View>

      {/* 新增表單 */}
      {showForm && (
        <View style={styles.formContainer}>
          <TextInput
            style={styles.input}
            placeholder={t('eventBookingPage.form.titlePlaceholder')}
            value={title}
            onChangeText={setTitle}
          />

          {/* 日期選擇 */}
          <TouchableOpacity style={styles.pickerRow} onPress={() => setDateOpen(true)}>
            <Text>{t('eventBookingPage.form.date')}: {formatDate(selectedDate)}</Text>
          </TouchableOpacity>
          <DatePicker
            modal
            open={dateOpen}
            date={selectedDate}
            onConfirm={(date) => {
              setDateOpen(false);
              setSelectedDate(date);
            }}
            onCancel={() => setDateOpen(false)}
            mode="date"
            minimumDate={new Date()}
          />

          {/* 開始時間 */}
          <TouchableOpacity style={styles.pickerRow} onPress={() => setStartTimeOpen(true)}>
            <Text>{t('eventBookingPage.form.startTime')}: {formatTime(startTime)}</Text>
          </TouchableOpacity>
          <DatePicker
            modal
            open={startTimeOpen}
            date={startTime}
            onConfirm={(time) => {
              setStartTimeOpen(false);
              setStartTime(time);
            }}
            onCancel={() => setStartTimeOpen(false)}
            mode="time"
          />

          {/* 結束時間 */}
          <TouchableOpacity style={styles.pickerRow} onPress={() => setEndTimeOpen(true)}>
            <Text>{t('eventBookingPage.form.endTime')}: {formatTime(endTime)}</Text>
          </TouchableOpacity>
          <DatePicker
            modal
            open={endTimeOpen}
            date={endTime}
            onConfirm={(time) => {
              setEndTimeOpen(false);
              setEndTime(time);
            }}
            onCancel={() => setEndTimeOpen(false)}
            mode="time"
          />

          {/* 地圖選點 */}
          <View style={styles.mapSection}>
            <Text style={styles.sectionTitle}>
              {t('eventBookingPage.form.map.title', { count: waypoints.length })}
            </Text>

            <MapView
              ref={mapRef}
              style={styles.map}
              initialRegion={{
                latitude: 22.387,
                longitude: 114.195,
                latitudeDelta: 0.08,
                longitudeDelta: 0.08,
              }}
              onLongPress={handleMapLongPress}
            >
              {waypoints.map((wp, idx) => (
                <Marker
                  key={idx}
                  coordinate={wp}
                  title={t('eventBookingPage.form.map.marker', { index: idx + 1 })}
                  pinColor={idx === 0 ? 'green' : idx === waypoints.length - 1 ? 'red' : 'orange'}
                />
              ))}

              {waypoints.length >= 2 && (
                <Polyline
                  coordinates={waypoints}
                  strokeColor="#2196F3"
                  strokeWidth={4}
                />
              )}
            </MapView>

            {waypoints.length > 0 && (
              <Button
                title={t('eventBookingPage.button.removeLast')}
                color="#FF9800"
                onPress={removeLastWaypoint}
              />
            )}
          </View>

          {/* 儲存按鈕 */}
          <View style={styles.saveBtn}>
            <Button
              title={t('eventBookingPage.button.save')}
              color="#4CAF50"
              onPress={saveEventToFirebase}
              disabled={waypoints.length < 2 || !title.trim()}
            />
          </View>
        </View>
      )}

      <View style={{ height: 40 }} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f8f9fa' },
  header: { padding: 20, backgroundColor: '#673AB7', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: 'bold', color: 'white' },
  subtitle: { fontSize: 14, color: 'rgba(255,255,255,0.9)' },

  section: { margin: 16, backgroundColor: 'white', padding: 16, borderRadius: 12, elevation: 2 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#333' },
  eventCard: {
    backgroundColor: '#f0f4ff',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#673AB7',
  },
  eventTitle: { fontSize: 16, fontWeight: '600', color: '#673AB7' },
  emptyText: { textAlign: 'center', color: '#888', padding: 20 },

  control: { marginHorizontal: 16, marginVertical: 12 },

  formContainer: { margin: 16, backgroundColor: 'white', padding: 16, borderRadius: 12, elevation: 3 },

  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    fontSize: 16,
  },

  pickerRow: {
    padding: 14,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#eee',
  },

  mapSection: { marginTop: 16 },
  map: { height: 320, borderRadius: 12, marginVertical: 8 },

  saveBtn: { marginTop: 20 },
});

export default EventBookingPage;