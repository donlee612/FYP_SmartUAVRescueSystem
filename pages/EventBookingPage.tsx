import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

const EventBookingPage = () => {
  return (
    <View style={styles.container}>
      <Text>這是EventBookingPage</Text>
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

export default EventBookingPage;