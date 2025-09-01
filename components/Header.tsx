import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const Header = () => {
  return (
    <View style={styles.header}>
      <Text>當前頁面</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flex: 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff0000ff',
    paddingTop: 20,
  },
});

export default Header;