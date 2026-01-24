import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  currentPage: string; // Accept currentPage as a prop
}

const Header: React.FC<HeaderProps> = ({ currentPage }) => {
  const { t } = useTranslation();

  return (
    <View style={styles.header}>
      <Text style={styles.title}>{t('header.currentPage')}: {currentPage}</Text> {/* Display current page */}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flex: 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ff0000', // Keep or change color as needed
    paddingTop: 20,
    paddingBottom: 10, // Add padding for better spacing
  },
  title: {
    color: '#ffffff', // Added text color for readability
    fontSize: 18, // Set a font size for the header text
    fontWeight: 'bold', // Make the text bold
  },
});

export default Header;