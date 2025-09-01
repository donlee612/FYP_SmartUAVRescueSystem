import React, { useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';
import { Header, Footer, Content } from './components';
import './translations/i18n'; // 導入 i18n 配置

const App = () => {
  const [currentPage, setCurrentPage] = useState(1);

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