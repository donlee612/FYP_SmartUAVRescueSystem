import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { Header, Footer, Content } from './components';
import './translations/i18n';
import { initDb, getDb, reset } from './android/app/src/services/db/initDb';

const App = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [loading, setLoading] = useState(true); // State for loading indicator

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await initDb();
        setDbInitialized(true);
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      } finally {
        setLoading(false); // Stop loading when done
      }
    };

    initializeDatabase();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" /> {/* Loading spinner */}
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header />
      <Content currentPage={currentPage} onSelectPage={setCurrentPage} />
      <Footer onSelectPage={setCurrentPage} />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default App;