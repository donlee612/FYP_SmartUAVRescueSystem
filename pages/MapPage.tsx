import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Modal, TouchableOpacity } from 'react-native';
import { useTranslation } from 'react-i18next';

interface MapPageProps {
  onSelectPage: (page: number) => void;
}

const MapPage: React.FC<MapPageProps> = ({ onSelectPage }) => {
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text>{t('mapPage.title')}</Text>
      <Button title={t('mapPage.selectAction')} onPress={() => setModalVisible(true)} />

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
    justifyContent: 'center',
    alignItems: 'center',
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
});

export default MapPage;