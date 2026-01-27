import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Button } from 'react-native';
import { LocationRepository } from './services/db/LocationRepository';
import { syncLocationsToFirebase } from './services/sync/syncService';

export default function StoredLocationsScreen({ routeId }) {
  const [rows, setRows] = useState([]);

  const load = async () => {
    const data = await LocationRepository.getLocationsByRoute(routeId);
    setRows(data);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <View style={{ padding: 16 }}>
      <Button title="Sync (UAV Contact)" onPress={syncLocationsToFirebase} />
      <ScrollView>
        {rows.map(r => (
          <Text key={r.id}>
            {r.latitude}, {r.longitude} | {r.timestamp} | synced={r.synced}
          </Text>
        ))}
      </ScrollView>
    </View>
  );
}