import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Button,           // 重新 import Button
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
  id: string;
  title: string;
  date: string;
  startTime: string;
  endTime: string;
  waypoints: Waypoint[];
  createdAt: string;
}

const EventBookingPage = () => {
  const { t } = useTranslation();

  const [events, setEvents] = useState<EventItem[]>([]);
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [waypoints, setWaypoints] = useState<Waypoint[]>([]);

  const [dateOpen, setDateOpen] = useState(false);
  const [startTimeOpen, setStartTimeOpen] = useState(false);
  const [endTimeOpen, setEndTimeOpen] = useState(false);

  const mapRef = useRef<MapView>(null);

  useEffect(() => {
    loadEventsFromFirebase();
  }, []);

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

    let eventId: string;
    let createdAt: string;

    if (editingEventId) {
      eventId = editingEventId;
      const existingEvent = events.find(e => e.id === eventId);
      createdAt = existingEvent?.createdAt || new Date().toISOString();
    } else {
      const eventNumber = await getNextEventNumber();
      eventId = `event_${eventNumber}`;
      createdAt = new Date().toISOString();
    }

    const dateStr = selectedDate.toISOString().split('T')[0];
    const startStr = startTime.toTimeString().slice(0, 5);
    const endStr = endTime.toTimeString().slice(0, 5);

    const updatedEvent = {
      title: title.trim(),
      date: dateStr,
      startTime: startStr,
      endTime: endStr,
      waypoints,
      createdAt,
    };

    try {
      const response = await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${phone}/booked_events/${eventId}.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatedEvent),
        }
      );

      if (response.ok) {
        setEvents(prev => {
          if (editingEventId) {
            return prev.map(e => (e.id === eventId ? { id: eventId, ...updatedEvent } : e));
          } else {
            return [{ id: eventId, ...updatedEvent }, ...prev];
          }
        });

        Alert.alert(
          t('eventBookingPage.alert.saveSuccess.title'),
          editingEventId
            ? t('eventBookingPage.alert.saveSuccess.updated')
            : t('eventBookingPage.alert.saveSuccess.message')
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

  const deleteEvent = async (eventId: string) => {
    Alert.alert(
      t('eventBookingPage.alert.deleteConfirm.title'),
      t('eventBookingPage.alert.deleteConfirm.message'),
      [
        { text: t('eventBookingPage.button.cancel'), style: 'cancel' },
        {
          text: t('eventBookingPage.button.delete'),
          style: 'destructive',
          onPress: async () => {
            const phone = await getUserPhone();
            if (!phone) return;

            try {
              const response = await fetch(
                `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${phone}/booked_events/${eventId}.json`,
                {
                  method: 'DELETE',
                }
              );

              if (response.ok) {
                setEvents(prev => prev.filter(e => e.id !== eventId));
                Alert.alert(
                  t('eventBookingPage.alert.deleteSuccess.title'),
                  t('eventBookingPage.alert.deleteSuccess.message')
                );
              } else {
                throw new Error('Delete failed');
              }
            } catch (err) {
              console.error('Failed to delete event:', err);
              Alert.alert(
                t('eventBookingPage.alert.deleteFailed.title'),
                t('eventBookingPage.alert.deleteFailed.message')
              );
            }
          },
        },
      ]
    );
  };

  const editEvent = (event: EventItem) => {
    setEditingEventId(event.id);
    setTitle(event.title);
    setSelectedDate(new Date(event.date));
    setStartTime(new Date(`${event.date}T${event.startTime}:00`));
    setEndTime(new Date(`${event.date}T${event.endTime}:00`));
    setWaypoints(event.waypoints);
    setShowForm(true);
  };

  const resetForm = () => {
    setEditingEventId(null);
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

              <View style={styles.eventActions}>
                <TouchableOpacity onPress={() => editEvent(event)}>
                  <Text style={styles.editButton}>{t('eventBookingPage.button.edit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteEvent(event.id)}>
                  <Text style={styles.deleteButton}>{t('eventBookingPage.button.delete')}</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </View>

      {/* 新增/修改行程按鈕 */}
      <View style={styles.control}>
        <TouchableOpacity
          style={[
            styles.actionButton,
            showForm ? styles.cancelButton : styles.addButton
          ]}
          onPress={() => {
            if (showForm) resetForm();
            else setShowForm(true);
          }}
        >
          <Text style={styles.actionButtonText}>
            {showForm
              ? (editingEventId
                  ? t('eventBookingPage.button.cancelEdit')
                  : t('eventBookingPage.button.cancelAdd'))
              : t('eventBookingPage.button.addNew')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* 新增/修改表單 */}
      {showForm && (
        <View style={styles.formContainer}>
          <Text style={styles.formTitle}>
            {editingEventId ? t('eventBookingPage.form.editTitle') : t('eventBookingPage.form.addTitle')}
          </Text>

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
          <TouchableOpacity
            style={[
              styles.saveButton,
              (waypoints.length < 2 || !title.trim()) && styles.disabledSaveButton
            ]}
            onPress={saveEventToFirebase}
            disabled={waypoints.length < 2 || !title.trim()}
          >
            <Text style={styles.saveButtonText}>
              {editingEventId ? t('eventBookingPage.button.update') : t('eventBookingPage.button.save')}
            </Text>
          </TouchableOpacity>
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
  formTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16, color: '#333' },

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

  // 新增的按鈕樣式
  actionButton: {
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    backgroundColor: '#4CAF50', // 綠色 - 新增
  },
  cancelButton: {
    backgroundColor: '#F44336', // 紅色 - 取消
  },
  actionButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  saveButton: {
    backgroundColor: '#4CAF50', // 綠色
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  disabledSaveButton: {
    backgroundColor: '#cccccc', // 灰色
  },
  saveButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },

  eventActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
  },
  editButton: {
    color: '#2196F3',
    marginRight: 16,
    fontWeight: '600',
  },
  deleteButton: {
    color: '#F44336',
    fontWeight: '600',
  },
});

export default EventBookingPage;