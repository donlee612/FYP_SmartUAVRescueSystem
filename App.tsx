import React, { useState, useEffect } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Header, Footer, Content } from './components';
import './translations/i18n';
import { initDb } from './android/app/src/services/db/initDb';

const App = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [dbInitialized, setDbInitialized] = useState(false);

  useEffect(() => {
    const initializeDatabase = async () => {
      try {
        await initDb();
        setDbInitialized(true);
        console.log('Database initialized successfully');
      } catch (error) {
        console.error('Failed to initialize database:', error);
      }
    };

    initializeDatabase();
  }, []);

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
});

export default App;