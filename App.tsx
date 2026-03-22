import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet, ActivityIndicator } from 'react-native';
import { Header, Footer, Content } from './components';
import './translations/i18n';
import { initDb } from './services/db/initDb';

const App = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [dbInitialized, setDbInitialized] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        console.log('🔥 App starting — initializing database');
        await initDb();
        console.log('✅ Database initialized successfully');
        setDbInitialized(true);
      } catch (error) {
        console.error('❌ Failed to initialize database:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeDatabase();
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#FFFFFF' }]}>
      <Header currentPage={currentPage} />
      {dbInitialized && (
        <Content
          currentPage={currentPage}
          onSelectPage={setCurrentPage}
          dbInitialized={dbInitialized}
        />
      )}
      <Footer 
        currentPage={currentPage} 
        onSelectPage={setCurrentPage} 
      />
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