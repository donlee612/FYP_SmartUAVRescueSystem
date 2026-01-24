import React from 'react';
import { View, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface FooterProps {
  onSelectPage: (page: number) => void;
}

const Footer: React.FC<FooterProps> = ({ onSelectPage }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.footer}>
      <View style={styles.buttonContainer}>
        <Button title={t('footer.mapPage')} onPress={() => onSelectPage(1)} color="#007BFF" />
        <Button title={t('footer.sosPage')} onPress={() => onSelectPage(2)} color="#FF4081" />
        <Button title={t('footer.settingPage')} onPress={() => onSelectPage(3)} color="#28A745" />
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
    paddingBottom: 10, // Added padding for aesthetic
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '90%',
  },
});

export default Footer;