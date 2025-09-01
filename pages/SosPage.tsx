import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SosPage = () => {
  return (
    <View style={styles.container}>
      <Text>這是SosPage</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SosPage;