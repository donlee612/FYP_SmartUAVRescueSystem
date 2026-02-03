import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Alert, Linking } from 'react-native';
import { useTranslation } from 'react-i18next';

const SosPage = () => {
  const { t } = useTranslation();

  const handleSOSCall = async () => {  // 加上 async
  const phoneNumber = '999';
  const url = Platform.OS === 'ios' ? `telprompt:${phoneNumber}` : `tel:${phoneNumber}`;

  try {
    await Linking.openURL(url);
  } catch (err) {
    console.error('撥號失敗:', err);
    Alert.alert(
      t('sosPage.errorTitle'),
      t('sosPage.callFailed')  // 改用這個比較中性的錯誤訊息
    );
  }
};

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('sosPage.title')}</Text>
      <Text style={styles.subtitle}>{t('sosPage.description')}</Text>

      <TouchableOpacity style={styles.sosButton} onPress={handleSOSCall}>
        <Text style={styles.buttonText}>{t('sosPage.callButton')}</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff', // 可依需求改成深色背景
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#d32f2f', // 紅色主題
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 18,
    color: '#555',
    textAlign: 'center',
    marginBottom: 48,
  },
  sosButton: {
    backgroundColor: '#d32f2f', // 醒目的紅色
    paddingVertical: 20,
    paddingHorizontal: 60,
    borderRadius: 50,
    elevation: 8, // Android 陰影
    shadowColor: '#000', // iOS 陰影
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
  },
  buttonText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: 'bold',
  },
});

export default SosPage;