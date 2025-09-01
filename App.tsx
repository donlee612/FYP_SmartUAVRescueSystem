import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import Header from './components/Header';
import Footer from './components/Footer';
import Content from './components/Content';

const App = () => {
  const [currentPage, setCurrentPage] = useState(1);

  return (
    <View style={styles.container}>
      <Header />
      <Content currentPage={currentPage} onSelectPage={setCurrentPage} />
      <Footer onSelectPage={setCurrentPage} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default App;