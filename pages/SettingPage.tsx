import React from 'react';
import { View, Text, Button, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  onSelectPage: (page: number) => void;
}

const SettingPage: React.FC<Props> = ({ onSelectPage }) => {
  const { t, i18n } = useTranslation();
  const nextLang = i18n.language === 'en' ? 'zh' : 'en';

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t('settingPage.title')}</Text>
      <Button
        title={t('settingPage.switchLanguage', { language: nextLang })}
        onPress={() => i18n.changeLanguage(nextLang)}
      />
      <Button title={t('settingPage.goToProfile')} onPress={() => onSelectPage(6)} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 22, marginBottom: 20 },
});

export default SettingPage;