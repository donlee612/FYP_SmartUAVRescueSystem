import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

interface Props {
  onSelectPage: (page: number) => void;
}

const SettingPage: React.FC<Props> = ({ onSelectPage }) => {
  const { t, i18n } = useTranslation();

  const currentLang = i18n.language === 'zh' ? '繁體中文' : 'English';
  const nextLang = i18n.language === 'en' ? 'zh' : 'en';
  const nextLangLabel = i18n.language === 'en' ? '繁體中文' : 'English';

  const handleLanguageChange = () => {
    i18n.changeLanguage(nextLang);
  };

  const handleGoToProfile = () => {
    onSelectPage(6);
  };

  const handleAbout = () => {
    Alert.alert(
      t('settingPage.about.title'),
      t('settingPage.about.message')
    );
  };

  const handleTerms = () => {
    Alert.alert(
      t('settingPage.terms.title'),
      t('settingPage.terms.message')
    );
  };

  const handlePrivacy = () => {
    Alert.alert(
      t('settingPage.privacy.title'),
      t('settingPage.privacy.message')
    );
  };

  const SettingItem = ({
    titleKey,
    subtitleKey,
    onPress,
  }: {
    titleKey: string;
    subtitleKey?: string;
    onPress?: () => void;
  }) => (
    <TouchableOpacity
      style={styles.itemContainer}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle}>{t(titleKey)}</Text>
        {subtitleKey && <Text style={styles.itemSubtitle}>{t(subtitleKey)}</Text>}
      </View>
      <Text style={styles.arrow}>{'>'}</Text>
    </TouchableOpacity>
  );

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>
          {t('settingPage.title')}
        </Text>
      </View>

      <View style={styles.section}>
        <SettingItem
          titleKey="settingPage.profile"
          subtitleKey="settingPage.profileSubtitle"
          onPress={handleGoToProfile}
        />

        <SettingItem
          titleKey="settingPage.language"
          subtitleKey={currentLang} // 這裡直接用變數，因為是動態的
          onPress={handleLanguageChange}
        />

        <SettingItem
          titleKey="settingPage.aboutApp"
          onPress={handleAbout}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('settingPage.section.legal')}
        </Text>

        <SettingItem
          titleKey="settingPage.terms.title"
          onPress={handleTerms}
        />

        <SettingItem
          titleKey="settingPage.privacy.title"
          onPress={handlePrivacy}
        />
      </View>

      <Text style={styles.footerText}>
        MyDrone © {new Date().getFullYear()} • v1.0.0
      </Text>
    </ScrollView>
  );
};

// styles 保持不變（與你之前的一樣）
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 20,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#111827',
  },
  section: {
    marginTop: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginHorizontal: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6b7280',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  itemContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  itemSubtitle: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 4,
  },
  arrow: {
    fontSize: 18,
    color: '#9ca3af',
    marginLeft: 8,
  },
  footerText: {
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 12,
    marginVertical: 24,
    marginBottom: 40,
  },
});

export default SettingPage;