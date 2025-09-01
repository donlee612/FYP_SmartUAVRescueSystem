import React from 'react';
import { View, Button, StyleSheet } from 'react-native';

interface FooterProps {
  onSelectPage: (page: number) => void;
}

const Footer: React.FC<FooterProps> = ({ onSelectPage }) => {
  return (
    <View style={styles.footer}>
      <View style={styles.buttonContainer}>
        <Button title="地圖頁" onPress={() => onSelectPage(1)} />
        <Button title="SOS頁" onPress={() => onSelectPage(2)} />
        <Button title="設置頁" onPress={() => onSelectPage(3)} />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    flex: 0.1,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    backgroundColor: '#f8f8f8',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
  },
});

export default Footer;