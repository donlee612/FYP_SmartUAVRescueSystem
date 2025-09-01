import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const SettingPage = () => {
  return (
    <View style={styles.container}>
      <Text>這是SettingPage</Text>
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

export default SettingPage;