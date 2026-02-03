import React from 'react';
import { View, Text, StyleSheet, Button } from 'react-native';
import { useTranslation } from 'react-i18next';

interface SettingPageProps {
  onSelectPage: (page: number) => void;
}

const SettingPage: React.FC<SettingPageProps> = ({ onSelectPage }) => {
  const { t, i18n } = useTranslation();
  const currentLanguage = i18n.language;
  const targetLanguage = currentLanguage === 'en' ? 'zh' : 'en';

  return (
    <View style={styles.container}>
      <Text>{t('settingPage.title')}</Text>
      <Button
        title={t('settingPage.switchLanguage', { language: t(`settingPage.language.${targetLanguage}`) })}
        onPress={() => i18n.changeLanguage(targetLanguage)}
      />
      <Button title={t('settingPage.goToProfile')} onPress={() => onSelectPage(6)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SettingPage;