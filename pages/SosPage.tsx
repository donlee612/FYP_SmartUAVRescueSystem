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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('sosPage.title')}</Text>
      <TouchableOpacity style={styles.button} onPress={callSOS}>
        <Text style={styles.buttonText}>{t('sosPage.callButton')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', marginBottom: 40 },
  button: { backgroundColor: '#d32f2f', padding: 20, borderRadius: 50 },
  buttonText: { color: 'white', fontSize: 22, fontWeight: 'bold' },
});

export default SosPage;