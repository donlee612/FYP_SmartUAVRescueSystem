import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import Geolocation from '@react-native-community/geolocation';
import { useTranslation } from 'react-i18next';

// SQLite helpers（跟 ProfilePage 用同一套）
import { initDb, getDb } from '../services/db/initDb';

const SosPage = () => {
  const { t } = useTranslation();

  const callSOS = async () => {
    const number = '999';
    const url = Platform.OS === 'ios' ? `telprompt:${number}` : `tel:${number}`;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert(t('sosPage.errorTitle'), t('sosPage.noPhoneApp'));
      }
    } catch {
      Alert.alert(t('sosPage.errorTitle'), t('sosPage.callFailed'));
    }
  };

const requestRescue = () => {
  Geolocation.getCurrentPosition(
    async (position) => {
      try {
        await initDb();
        const db = getDb();

        const result = await db.executeSql(
          'SELECT phone FROM user ORDER BY id DESC LIMIT 1'
        );

        if (result[0].rows.length === 0 || !result[0].rows.item(0).phone) {
          Alert.alert(
            t('sosPage.errorTitle') || '錯誤',
            t('sosPage.noPhoneStored') || '請先在個人資料頁設定電話號碼'
          );
          return;
        }

        const phone = result[0].rows.item(0).phone;
        const normalizedPhone = phone.replace(/[^0-9]/g, '');

        console.log('Normalized phone:', normalizedPhone); // debug

        if (!normalizedPhone) {
          Alert.alert('錯誤', '電話號碼無效，請重新設定');
          return;
        }

        const { latitude, longitude } = position.coords;

        const rescueData = {
          latitude,
          longitude,
          status: 'PENDING',
          timestamp: Date.now(),
          device: Platform.OS,
        };

        const timestampKey = Date.now().toString(); // 改成純數字時間戳

        console.log('Timestamp key:', timestampKey); // debug
        console.log('Full URL:', `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${normalizedPhone}/rescue_requests/${timestampKey}.json`);

        const response = await fetch(
          `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${normalizedPhone}/rescue_requests/${timestampKey}.json`,
          {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rescueData),
          }
        );

        console.log('Response status:', response.status); // debug

        if (response.ok) {
          Alert.alert(
            t('sosPage.successTitle') || '成功',
            t('sosPage.successMessage') || 'SOS 求救訊號已發送！'
          );
        } else {
          const errorText = await response.text();
          console.log('Firebase error:', errorText);
          throw new Error(`Failed to send, status: ${response.status}`);
        }
      } catch (error) {
        console.error('SOS request error:', error);
        Alert.alert(
          t('sosPage.errorTitle') || '錯誤',
          t('sosPage.requestFailed') || '發送失敗，請稍後再試'
        );
      }
    },
    (error) => {
      // 定位錯誤處理（同上）
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 10000,
    }
  );
};

  return (
    <View style={styles.container}>
      {/* 警告區塊 */}
      <View style={styles.warningContainer}>
        <Text style={styles.warningIcon}>!</Text>
        <Text style={styles.warningText}>
          {t('sosPage.legalWarning')}
        </Text>
      </View>

      {/* 確認文字 */}
      <Text style={styles.confirmText}>
        {t('sosPage.confirmText')}
      </Text>

      {/* SOS 大按鈕 */}
      <TouchableOpacity style={styles.sosButton} onPress={requestRescue}>
        <Text style={styles.sosButtonText}>{t('sosPage.sosButton')}</Text>
      </TouchableOpacity>

      {/* 撥打 999 按鈕 */}
      <TouchableOpacity style={styles.callButton} onPress={callSOS}>
        <Text style={styles.callButtonText}>{t('sosPage.callButton')}</Text>
      </TouchableOpacity>

      {/* 頁尾 slogan */}
      <View style={styles.footerLogo}>
        <Text style={styles.sloganText}>{t('sosPage.slogan')}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000000', // 黑底
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 30,
  },

  warningContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  warningIcon: {
    fontSize: 60,
    color: '#FFEB3B', // 黃色警告
    fontWeight: 'bold',
    marginBottom: 10,
  },
  warningText: {
    color: '#FFEB3B',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
  },

  confirmText: {
    color: '#FFFFFF',
    fontSize: 20,
    textAlign: 'center',
    marginBottom: 60,
    lineHeight: 28,
  },

  sosButton: {
    backgroundColor: '#D32F2F', // 紅色 SOS
    width: 200,
    height: 200,
    borderRadius: 100,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    elevation: 8, // Android 陰影
    shadowColor: '#D32F2F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.6,
    shadowRadius: 8,
  },
  sosButtonText: {
    color: '#FFFFFF',
    fontSize: 48,
    fontWeight: 'bold',
  },

  callButton: {
    backgroundColor: '#FF6F00', // 橘色 Request Rescue
    paddingVertical: 15,
    paddingHorizontal: 40,
    borderRadius: 30,
    marginBottom: 60,
  },
  callButtonText: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
  },

  footerLogo: {
    position: 'absolute',
    bottom: 40,
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  sloganText: {
    color: '#BBBBBB',
    fontSize: 16,
    fontStyle: 'italic',
  },
});

export default SosPage;