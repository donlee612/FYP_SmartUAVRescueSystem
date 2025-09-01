import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

const Header = () => {
  const { t } = useTranslation();
  return (
    <View style={styles.header}>
      <Text>{t('header.currentPage')}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flex: 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff0000ff',
    paddingTop: 20,
  },
});

export default Header;