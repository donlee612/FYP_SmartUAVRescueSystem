import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Linking, Platform } from 'react-native';
import { useTranslation } from 'react-i18next';
import Geolocation from '@react-native-community/geolocation';

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
      (position) => {
        const { latitude, longitude } = position.coords;

        const rescueData = {
          latitude,
          longitude,
          status: 'PENDING',
          timestamp: Date.now(),
        };

        fetch(
          'https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/rescue_requests.json',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rescueData),
          }
        )
          .then((response) => {
            if (response.ok) {
              Alert.alert(
                t('sosPage.successTitle') || 'Success',
                t('sosPage.successMessage') || 'SOS request sent successfully!'
              );
            } else {
              throw new Error('Failed to send SOS request');
            }
          })
          .catch((error) => {
            console.error('SOS request error:', error);
            Alert.alert(
              t('sosPage.errorTitle') || 'Error',
              t('sosPage.requestFailed') || 'Failed to send SOS request. Please try again.'
            );
          });
      },
      (error) => {
        console.error('Location error:', error);
        let errorMsg = t('sosPage.requestFailed') || 'Failed to get location.';

        switch (error.code) {
          case 1:
            errorMsg = t('sosPage.locationPermissionDenied') || 'Location permission denied.';
            break;
          case 2:
            errorMsg = t('sosPage.locationUnavailable') || 'Location service unavailable.';
            break;
          case 3:
            errorMsg = t('sosPage.locationTimeout') || 'Location request timed out.';
            break;
          default:
            errorMsg = error.message || errorMsg;
        }

        Alert.alert(t('sosPage.errorTitle') || 'Error', errorMsg);
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

      {/* 頁面標題與 Logo（置底或置中） */}
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