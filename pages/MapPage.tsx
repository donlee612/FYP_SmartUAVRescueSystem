import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Modal, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';
import MapView from 'react-native-maps'; // 新增這行

interface MapPageProps {
  onSelectPage: (page: number) => void;
}

const MapPage: React.FC<MapPageProps> = ({ onSelectPage }) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      {/* Google Map 背景 */}
      <MapView
        style={StyleSheet.absoluteFillObject}
        initialRegion={{
          latitude: 22.3193, // 可依需求調整座標
          longitude: 114.1694,
          latitudeDelta: 0.0922,
          longitudeDelta: 0.0421,
        }}
      />
      {/* 內容疊加在地圖上 */}
      <View style={styles.overlay}>
        <View style={styles.contentBox}>
          <Text>{t('mapPage.title')}</Text>
          <Button title={t('mapPage.selectAction')} onPress={() => setModalVisible(true)} />
        </View>
      </View>

      {/* Modal for button sheet */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.button} onPress={() => { setModalVisible(false); onSelectPage(4); }}>
            <Text>{t('mapPage.quickStart')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => { setModalVisible(false); onSelectPage(5); }}>
            <Text>{t('mapPage.booking')}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => setModalVisible(false)}>
            <Text>{t('mapPage.cancel')}</Text>
          </TouchableOpacity>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1,
  },
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  button: {
    padding: 20,
    backgroundColor: 'white',
    margin: 10,
    borderRadius: 5,
    alignItems: 'center',
  },
  contentBox: {
    backgroundColor: 'rgba(255,255,255,0.9)', // 半透明白色
    padding: 12,
    borderRadius: 16,
    elevation: 4, // Android 陰影
    shadowColor: '#000', // iOS 陰影
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    alignItems: 'center',
    minWidth: 220,
  },
});

export default MapPage;