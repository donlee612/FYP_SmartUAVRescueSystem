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

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      await initDb();
      const db = getDb();

      const result = await db.executeSql(
        'SELECT * FROM user ORDER BY id DESC LIMIT 1'
      );

      if (result[0].rows.length > 0) {
        const user = result[0].rows.item(0);

        setFirstName(user.first_name || '');
        setLastName(user.last_name || '');
        setGender(user.gender || '');
        setPhoneNumber(user.phone || '');
        setEmail(user.email || '');
        setMedicalNotes(user.medical_notes || '');
        setProfileId(user.id);
        setProfileExists(true);

        if (user.emergency_contacts) {
          try {
            const parsed = JSON.parse(user.emergency_contacts);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setEmergencyContacts(parsed);
            }
          } catch {}
        }
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      Alert.alert(
        t('profilePage.alert.loadFailed.title'),
        t('profilePage.alert.loadFailed.message')
      );
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
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert(
        t('profilePage.alert.validation.title'),
        t('profilePage.alert.validation.nameRequired')
      );
      return;
    }

    setSaving(true);

    try {
      await initDb();
      const db = getDb();

      const contacts = JSON.stringify(
        emergencyContacts.filter(c => c.name.trim() || c.phone.trim())
      );

      if (profileExists && profileId) {
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
            firstName,
            lastName,
            gender,
            phoneNumber,
            email,
            medicalNotes,
            contacts,
            profileId,
          ]
        );

        Alert.alert(
          t('profilePage.alert.updateSuccess.title'),
          t('profilePage.alert.updateSuccess.message')
        );
      } else {
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
            firstName,
            lastName,
            gender,
            phoneNumber,
            email,
            medicalNotes,
            contacts,
          ]
        );

        setProfileId(result[0].insertId ?? null);
        setProfileExists(true);

        Alert.alert(
          t('profilePage.alert.createSuccess.title'),
          t('profilePage.alert.createSuccess.message')
        );
      }
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
          label={t('profilePage.form.firstName.label')}
          value={firstName}
          onChange={setFirstName}
          required
        />
        <Input
          label={t('profilePage.form.lastName.label')}
          value={lastName}
          onChange={setLastName}
          required
        />
        <Input
          label={t('profilePage.form.gender.label')}
          value={gender}
          onChange={setGender}
        />
        <Input
          label={t('profilePage.form.phone.label')}
          value={phoneNumber}
          onChange={setPhoneNumber}
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

/* -------------------------------------------------------
   Reusable Input component (加 required 星號)
-------------------------------------------------------- */
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