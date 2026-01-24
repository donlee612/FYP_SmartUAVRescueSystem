import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import MapPage from '../pages/MapPage';
import SosPage from '../pages/SosPage';
import SettingPage from '../pages/SettingPage';
import QuickStartPage from '../pages/QuickStartPage';
import EventBookingPage from '../pages/EventBookingPage';
import ProfilePage from '../pages/ProfilePage';
import { initDb } from '..android/app/src/services/db/initDb'; // Adjust the path as necessary

interface ContentProps {
  currentPage: number;
  onSelectPage: (page: number) => void;
  dbInitialized: boolean; // New prop to check if DB is initialized
}

const Content: React.FC<ContentProps> = ({ currentPage, onSelectPage, dbInitialized }) => {

  const renderPage = () => {
    switch (currentPage) {
      case 1: return <MapPage onSelectPage={onSelectPage} />;
      case 2: return <SosPage />;
      case 3: return <SettingPage onSelectPage={onSelectPage} />;
      case 4: return <QuickStartPage />;
      case 5: return <EventBookingPage />;
      case 6: return <ProfilePage />;
      default: return <MapPage onSelectPage={onSelectPage} />;
    }
  };

  // You can perform any additional setup here if needed
  useEffect(() => {
    if (dbInitialized) {
      // Optionally fetch data or perform additional operations
      console.log("Database is initialized, ready to interact.");
      // fetchData(); // Uncomment if you handle fetching data based on initialized DB
    }
  }, [dbInitialized]);

  return <View style={styles.content}>{renderPage()}</View>;
};

const styles = StyleSheet.create({
  content: {
    flex: 0.8,
  },
});

export default Content;