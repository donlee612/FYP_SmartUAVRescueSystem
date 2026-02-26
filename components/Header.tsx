import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface HeaderProps {
  currentPage: number;
}

const Header: React.FC<HeaderProps> = ({ currentPage }) => {
  const { t } = useTranslation();

  // 根據 currentPage 決定顯示哪個翻譯 key
  const getPageTitleKey = () => {
    switch (currentPage) {
      case 1:
        return 'pages.map';
      case 2:
        return 'pages.sos';
      case 3:
        return 'pages.settings';
      case 4:
        return 'pages.quickStart';
      case 5:
        return 'pages.booking';
      case 6:
        return 'pages.profile';
      default:
        return 'pages.map'; // 預設顯示地圖
    }
  };

  return (
    <View style={styles.header}>
      <Text style={styles.title}>
        {t(getPageTitleKey())}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flex: 0.1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgb(255, 255, 255)',
    paddingTop: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#eee', // 加一點分隔線更好看
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
});

export default Header;