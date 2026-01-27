// src/sync/syncService.ts
import { LocationRepository } from '../database/LocationRepository';
// Import whatever Firebase service you already use
// Example:
// import firestore from '@react-native-firebase/firestore';

export async function syncLocationsToFirebase() {
  const unsynced = await LocationRepository.getUnsyncedLocations();

  if (!unsynced.length) {
    console.log('✅ No data to sync');
    return;
  }

  console.log(`🚀 Syncing ${unsynced.length} points to Firebase`);

  // TODO: replace with your actual Firebase write
  for (const row of unsynced) {
    /*
    await firestore()
      .collection('uav_locations')
      .add({
        latitude: row.latitude,
        longitude: row.longitude,
        timestamp: row.timestamp,
        routeId: row.route_id,
      });
    */
  }

  await LocationRepository.markLocationsSynced(
    unsynced.map(r => r.id)
  );

  console.log('✅ Sync complete');
}