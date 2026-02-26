import React, { useEffect, useState } from 'react';
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
  ActivityIndicator,
} from 'react-native';
import { useTranslation } from 'react-i18next';

// SQLite helpers
import { initDb, getDb, resetDb } from '../services/db/initDb';

interface EmergencyContact {
  name: string;
  phone: string;
}

const ProfilePage = () => {
  const { t } = useTranslation();

  // Profile fields
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Emergency contacts
  const [emergencyContacts, setEmergencyContacts] = useState<EmergencyContact[]>([
    { name: '', phone: '' },
  ]);

  // State
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);

  // 正規化電話號碼作為 Firebase key（只保留數字）
  const normalizePhoneForKey = (phone: string) => {
    return phone.replace(/[^0-9]/g, ''); // e.g. +852-9123 4567 → 85291234567
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      await initDb();
      const db = getDb();

      // 1. 先從本地 SQLite 載入（快速、離線可用）
      const result = await db.executeSql(
        'SELECT * FROM user ORDER BY id DESC LIMIT 1'
      );

      let localData = null;
      if (result[0].rows.length > 0) {
        localData = result[0].rows.item(0);

        setFirstName(localData.first_name || '');
        setLastName(localData.last_name || '');
        setGender(localData.gender || '');
        setPhoneNumber(localData.phone || '');
        setEmail(localData.email || '');
        setMedicalNotes(localData.medical_notes || '');
        setProfileId(localData.id);
        setProfileExists(true);

        // 處理 emergency_contacts（防呆）
        let parsedContacts: EmergencyContact[] = [{ name: '', phone: '' }];
        if (localData.emergency_contacts) {
          try {
            const parsed = JSON.parse(localData.emergency_contacts);
            if (Array.isArray(parsed)) {
              parsedContacts = parsed.filter(
                c => typeof c === 'object' && c !== null && ('name' in c || 'phone' in c)
              );
            }
          } catch (parseErr) {
            console.warn('Invalid emergency_contacts JSON in local DB:', parseErr);
          }
        }
        setEmergencyContacts(parsedContacts.length > 0 ? parsedContacts : [{ name: '', phone: '' }]);
      } else {
        setProfileExists(false);
        setEmergencyContacts([{ name: '', phone: '' }]);
      }

      // 2. 背景從 Firebase 同步最新資料（如果有更新的話）
      if (localData?.phone) {
        const normalizedPhone = normalizePhoneForKey(localData.phone);
        try {
          const fbResponse = await fetch(
            `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${normalizedPhone}/profile.json`
          );
          const fbData = await fbResponse.json();

          if (fbData && fbData.updated_at > (localData.updated_at || '1970-01-01T00:00:00Z')) {
            // 雲端較新 → 覆蓋顯示
            setFirstName(fbData.first_name || localData.first_name || '');
            setLastName(fbData.last_name || localData.last_name || '');
            setGender(fbData.gender || localData.gender || '');
            setPhoneNumber(fbData.phone || localData.phone || '');
            setEmail(fbData.email || localData.email || '');
            setMedicalNotes(fbData.medical_notes || localData.medical_notes || '');

            // 同步緊急聯絡人
            let fbContacts = [{ name: '', phone: '' }];
            if (Array.isArray(fbData.emergency_contacts)) {
              fbContacts = fbData.emergency_contacts;
            }
            setEmergencyContacts(fbContacts.length > 0 ? fbContacts : [{ name: '', phone: '' }]);

            // 可選：更新本地 SQLite 以保持一致
            await db.executeSql(
              `UPDATE user SET
                first_name = ?,
                last_name = ?,
                gender = ?,
                phone = ?,
                email = ?,
                medical_notes = ?,
                emergency_contacts = ?,
                updated_at = datetime('now')
               WHERE id = ?`,
              [
                fbData.first_name || localData.first_name,
                fbData.last_name || localData.last_name,
                fbData.gender || localData.gender,
                fbData.phone || localData.phone,
                fbData.email || localData.email,
                fbData.medical_notes || localData.medical_notes,
                JSON.stringify(fbContacts),
                localData.id,
              ]
            );

            Alert.alert('已同步', '從雲端載入最新資料');
          }
        } catch (fbError) {
          console.warn('Firebase sync failed:', fbError);
          // 不影響本地使用
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(
        t('profilePage.alert.loadFailed.title'),
        t('profilePage.alert.loadFailed.message')
      );
      // 錯誤時強制重設緊急聯絡人，避免 map 錯誤
      setEmergencyContacts([{ name: '', phone: '' }]);
    } finally {
      setLoading(false);
    }
  };

  const addEmergencyContact = () => {
    setEmergencyContacts([...emergencyContacts, { name: '', phone: '' }]);
  };

  const updateEmergencyContact = (
    index: number,
    field: 'name' | 'phone',
    value: string
  ) => {
    const updated = [...emergencyContacts];
    updated[index] = { ...updated[index], [field]: value };
    setEmergencyContacts(updated);
  };

  const saveProfile = async () => {
    // 驗證必填：名字 + 電話
    if (!firstName.trim() || !phoneNumber.trim()) {
      Alert.alert(
        t('profilePage.alert.validation.title'),
        t('profilePage.alert.validation.requiredFields') || '名字與電話號碼為必填'
      );
      return;
    }

    setSaving(true);

    const normalizedPhone = normalizePhoneForKey(phoneNumber);

    const contacts = JSON.stringify(
      emergencyContacts.filter(c => c.name.trim() || c.phone.trim())
    );

    const profileData = {
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      gender: gender.trim(),
      phone: phoneNumber.trim(),
      email: email.trim(),
      medical_notes: medicalNotes.trim(),
      emergency_contacts: contacts,
      updated_at: new Date().toISOString(),
    };

    try {
      await initDb();
      const db = getDb();

      if (profileExists && profileId) {
        // 更新本地 SQLite
        await db.executeSql(
          `UPDATE user SET
            first_name = ?,
            last_name = ?,
            gender = ?,
            phone = ?,
            email = ?,
            medical_notes = ?,
            emergency_contacts = ?,
            updated_at = datetime('now')
           WHERE id = ?`,
          [
            profileData.first_name,
            profileData.last_name,
            profileData.gender,
            profileData.phone,
            profileData.email,
            profileData.medical_notes,
            profileData.emergency_contacts,
            profileId,
          ]
        );
      } else {
        // 新增本地 SQLite
        const result = await db.executeSql(
          `INSERT INTO user (
            first_name,
            last_name,
            gender,
            phone,
            email,
            medical_notes,
            emergency_contacts,
            created_at,
            updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
          [
            profileData.first_name,
            profileData.last_name,
            profileData.gender,
            profileData.phone,
            profileData.email,
            profileData.medical_notes,
            profileData.emergency_contacts,
          ]
        );

        setProfileId(result[0].insertId ?? null);
        setProfileExists(true);
      }

      // 同步上傳到 Firebase
      const fbResponse = await fetch(
        `https://rescue-drone-fyp-e0c23-default-rtdb.firebaseio.com/users/${normalizedPhone}/profile.json`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profileData),
        }
      );

      if (!fbResponse.ok) {
        console.warn('Firebase sync failed, but local saved');
        Alert.alert('警告', '本地儲存成功，但雲端同步失敗，請檢查網路');
      }

      Alert.alert(
        t('profilePage.alert.saveSuccess.title'),
        t('profilePage.alert.saveSuccess.message')
      );
    } catch (error: any) {
      console.error('❌ Save error:', error);
      Alert.alert(
        t('profilePage.alert.saveFailed.title'),
        error?.message || t('profilePage.alert.saveFailed.message')
      );
    } finally {
      setSaving(false);
    }
  };

  const clearDatabase = async () => {
    Alert.alert(
      t('profilePage.alert.clearDatabase.title'),
      t('profilePage.alert.clearDatabase.message'),
      [
        { text: t('profilePage.button.cancel'), style: 'cancel' },
        {
          text: t('profilePage.button.clear'),
          style: 'destructive',
          onPress: async () => {
            try {
              await resetDb();
              setFirstName('');
              setLastName('');
              setGender('');
              setPhoneNumber('');
              setEmail('');
              setMedicalNotes('');
              setEmergencyContacts([{ name: '', phone: '' }]);
              setProfileExists(false);
              setProfileId(null);
              Alert.alert(t('profilePage.alert.clearSuccess.title'));
            } catch (err) {
              Alert.alert(
                t('profilePage.alert.clearFailed.title'),
                t('profilePage.alert.clearFailed.message')
              );
            }
          },
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text>{t('profilePage.loading')}</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {profileExists
            ? t('profilePage.title.existing')
            : t('profilePage.title.new')}
        </Text>

        <Input
          label={t('profilePage.form.phone.label') + ' *'}
          value={phoneNumber}
          onChange={setPhoneNumber}
          required
        />

        <Input
          label={t('profilePage.form.firstName.label') + ' *'}
          value={firstName}
          onChange={setFirstName}
          required
        />
        <Input
          label={t('profilePage.form.lastName.label')}
          value={lastName}
          onChange={setLastName}
        />
        <Input
          label={t('profilePage.form.gender.label')}
          value={gender}
          onChange={setGender}
        />
        <Input
          label={t('profilePage.form.email.label')}
          value={email}
          onChange={setEmail}
        />
        <Input
          label={t('profilePage.form.medicalNotes.label')}
          value={medicalNotes}
          onChange={setMedicalNotes}
          multiline
        />

        <Text style={styles.section}>{t('profilePage.emergencyContacts.title')}</Text>

        {emergencyContacts.map((c, i) => (
          <View key={i} style={styles.contact}>
            <Input
              label={t('profilePage.emergencyContacts.name')}
              value={c.name}
              onChange={v => updateEmergencyContact(i, 'name', v)}
            />
            <Input
              label={t('profilePage.emergencyContacts.phone')}
              value={c.phone}
              onChange={v => updateEmergencyContact(i, 'phone', v)}
            />
          </View>
        ))}

        <TouchableOpacity onPress={addEmergencyContact}>
          <Text style={styles.link}>
            {t('profilePage.emergencyContacts.addButton')}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.saveButton, saving && styles.disabled]}
          onPress={saveProfile}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={styles.saveText}>
              {profileExists
                ? t('profilePage.button.update')
                : t('profilePage.button.save')}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={clearDatabase}>
          <Text style={styles.danger}>
            {t('profilePage.button.clearDatabase')}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

// Input 元件（保持不變）
const Input = ({
  label,
  value,
  onChange,
  multiline = false,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  required?: boolean;
}) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>
      {label}
      {required && <Text style={styles.required}> *</Text>}
    </Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
    />
  </View>
);

/* -------------------------------------------------------
   Styles (略微調整 required 星號顏色)
-------------------------------------------------------- */
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  section: { fontSize: 20, fontWeight: '600', marginVertical: 16 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, marginBottom: 6 },
  required: { color: '#F44336' },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    padding: 12,
    backgroundColor: 'white',
  },
  textArea: { height: 100 },
  contact: {
    borderWidth: 1,
    borderColor: '#eee',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  link: { color: '#2196F3', textAlign: 'center', marginVertical: 10 },
  saveButton: {
    backgroundColor: '#4CAF50',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 20,
  },
  disabled: { backgroundColor: '#aaa' },
  saveText: { color: 'white', fontSize: 18, fontWeight: '600' },
  danger: {
    color: '#F44336',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default ProfilePage;