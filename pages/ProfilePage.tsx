import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';

const ProfilePage = () => {
  const { t } = useTranslation();

  // 表單狀態
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState(''); // 可留空
  const [phoneNumber, setPhoneNumber] = useState('');

  // 緊急聯絡人（支援多個）
  const [emergencyContacts, setEmergencyContacts] = useState<
    { name: string; phone: string }[]
  >([{ name: '', phone: '' }]);

  const addEmergencyContact = () => {
    setEmergencyContacts([...emergencyContacts, { name: '', phone: '' }]);
  };

  const updateEmergencyContact = (index: number, field: 'name' | 'phone', value: string) => {
    const newContacts = [...emergencyContacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setEmergencyContacts(newContacts);
  };

  const handleSubmit = () => {
    // 這裡可以做表單驗證 + 送出到後端 / 儲存到本地
    console.log({
      firstName,
      lastName,
      gender: gender || 'Not specified',
      phoneNumber,
      emergencyContacts,
    });
    // 之後可改成 call API 或儲存到 AsyncStorage / context
    Alert.alert(t('profilePage.profileSaved'));
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flexContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <Text style={styles.pageTitle}>{t('profilePage.title')}</Text>

          {/* My Details */}
          <Text style={styles.sectionTitle}>{t('profilePage.myDetails')}</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profilePage.firstName')}</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder={t('profilePage.placeholder.firstName')}
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profilePage.lastName')}</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder={t('profilePage.placeholder.lastName')}
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profilePage.gender')}</Text>
            <TextInput
              style={styles.input}
              value={gender}
              onChangeText={setGender}
              placeholder={t('profilePage.placeholder.gender')}
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>{t('profilePage.phoneNumber')}</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder={t('profilePage.placeholder.phoneNumber')}
              keyboardType="phone-pad"
              placeholderTextColor="#aaa"
            />
          </View>

          {/* Emergency Contacts */}
          <Text style={[styles.sectionTitle, { marginTop: 32 }]}>
            {t('profilePage.emergencyContacts')}
          </Text>

          {emergencyContacts.map((contact, index) => (
            <View key={index} style={styles.contactCard}>
              <Text style={styles.contactLabel}>
                {t('profilePage.person')} {index + 1}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('profilePage.name')}</Text>
                <TextInput
                  style={styles.input}
                  value={contact.name}
                  onChangeText={(text) => updateEmergencyContact(index, 'name', text)}
                  placeholder={t('profilePage.placeholder.name')}
                  placeholderTextColor="#aaa"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('profilePage.phoneNumber')}</Text>
                <TextInput
                  style={styles.input}
                  value={contact.phone}
                  onChangeText={(text) => updateEmergencyContact(index, 'phone', text)}
                  placeholder={t('profilePage.placeholder.phoneNumber')}
                  keyboardType="phone-pad"
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addEmergencyContact}>
            <Text style={styles.addButtonText}>+ {t('profilePage.addNewEmergencyContact')}</Text>
          </TouchableOpacity>

          {/* 送出按鈕 */}
          <TouchableOpacity style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitButtonText}>{t('profilePage.setUpProfile')}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  container: {
    flex: 1,
    padding: 20,
    paddingBottom: 40,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 24,
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 8,
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  contactCard: {
    backgroundColor: '#f9f9f9',
    borderRadius: 10,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#eee',
  },
  contactLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    color: '#444',
  },
  addButton: {
    alignItems: 'center',
    padding: 12,
    marginVertical: 8,
  },
  addButtonText: {
    color: '#007AFF',
    fontSize: 16,
    fontWeight: '500',
  },
  submitButton: {
    backgroundColor: '#007AFF',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});

export default ProfilePage;