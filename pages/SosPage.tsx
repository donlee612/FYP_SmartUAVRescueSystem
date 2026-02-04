import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';

const SosPage = () => {
  const { t } = useTranslation();

  const callSOS = async () => {
    const number = '999';
    const url = Platform.OS === 'ios' ? `telprompt:${number}` : `tel:${number}`;

    try {
      await Linking.openURL(url);
    } catch {
      Alert.alert(t('sosPage.errorTitle'), t('sosPage.callFailed'));
    }
  };

  const requestRescue = async () => {
    const rescueData = {
      latitude: 22.3000,
      longitude: 114.2000,
      status: 'PENDING',
      timestamp: Date.now(),
    };

    try {
      const response = await fetch(
        'https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/rescue_requests.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(rescueData),
        }
      );

      if (response.ok) {
        Alert.alert('Success', 'Rescue Signal Sent!');
      } else {
        throw new Error('Failed to send rescue request');
      }
    } catch (error) {
      console.error('Error sending rescue request:', error);
      Alert.alert('Error', 'Failed to send rescue signal. Please try again.');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('sosPage.title')}</Text>
      <TouchableOpacity style={styles.button} onPress={callSOS}>
        <Text style={styles.buttonText}>{t('sosPage.callButton')}</Text>
      </TouchableOpacity>
      <TouchableOpacity style={styles.rescueButton} onPress={requestRescue}>
        <Text style={styles.buttonText}>Request Rescue</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40 },
  button: { backgroundColor: '#d32f2f', padding: 20, borderRadius: 50 },
  rescueButton: { backgroundColor: '#ff6f00', padding: 20, borderRadius: 50, marginTop: 20 },
  buttonText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
});

export default SosPage;