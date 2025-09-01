import React, { useState } from 'react';
import { View, Text, StyleSheet, Button, Modal, TouchableOpacity } from 'react-native';

interface MapPageProps {
  onSelectPage: (page: number) => void;
}

const MapPage: React.FC<MapPageProps> = ({ onSelectPage }) => {
  const [modalVisible, setModalVisible] = useState(false);

  return (
    <View style={styles.container}>
      <Text>這是MapPage</Text>
      <Button title="選擇操作" onPress={() => setModalVisible(true)} />

      {/* Modal for button sheet */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity style={styles.button} onPress={() => { setModalVisible(false); onSelectPage(4); }}>
            <Text>QuickStart</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => { setModalVisible(false); onSelectPage(5); }}>
            <Text>預約</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={() => setModalVisible(false)}>
            <Text>取消</Text>
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