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
import initDb, { resetDb }  from '../android/app/src/services/db/initDb';

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

  /* -------------------------------------------------------
     Load profile on mount
  -------------------------------------------------------- */
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      const db = await initDb();

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
    } finally {
      setLoading(false);
    }
  };

  /* -------------------------------------------------------
     Emergency contacts helpers
  -------------------------------------------------------- */
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

  /* -------------------------------------------------------
     Save profile (insert or update)
  -------------------------------------------------------- */
  const saveProfile = async () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required Fields', 'First and last name are required.');
      return;
    }

    setSaving(true);

    try {
      const db = await initDb();

      const contacts = JSON.stringify(
        emergencyContacts.filter(c => c.name || c.phone)
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

        Alert.alert('Profile Updated', 'Your profile has been updated.');
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

        setProfileId(result[0].insertId);
        setProfileExists(true);

        Alert.alert('Profile Created', 'Your rescue profile is ready.');
      }
    } catch (error: any) {
      console.error('Save error FULL:', error);
      Alert.alert(
        'Save Error',
        error?.message ?? JSON.stringify(error)
      );
    } finally {
      setSaving(false);
    }
  };

  /* -------------------------------------------------------
     Debug helpers (safe to remove later)
  -------------------------------------------------------- */
  const clearDatabase = async () => {
    Alert.alert('Clear Database', 'Delete all profile data?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
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
          Alert.alert('Database cleared');
        },
      },
    ]);
  };

  /* -------------------------------------------------------
     Loading state
  -------------------------------------------------------- */
  if (loading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text>Loading profile…</Text>
      </View>
    );
  }

  /* -------------------------------------------------------
     UI
  -------------------------------------------------------- */
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>
          {profileExists ? 'Rescue Profile' : 'Set Up Rescue Profile'}
        </Text>

        <Input label="First Name *" value={firstName} onChange={setFirstName} />
        <Input label="Last Name *" value={lastName} onChange={setLastName} />
        <Input label="Gender" value={gender} onChange={setGender} />
        <Input label="Phone" value={phoneNumber} onChange={setPhoneNumber} />
        <Input label="Email" value={email} onChange={setEmail} />
        <Input
          label="Medical Notes"
          value={medicalNotes}
          onChange={setMedicalNotes}
          multiline
        />

        <Text style={styles.section}>Emergency Contacts</Text>

        {emergencyContacts.map((c, i) => (
          <View key={i} style={styles.contact}>
            <Input
              label="Name"
              value={c.name}
              onChange={v => updateEmergencyContact(i, 'name', v)}
            />
            <Input
              label="Phone"
              value={c.phone}
              onChange={v => updateEmergencyContact(i, 'phone', v)}
            />
          </View>
        ))}

        <TouchableOpacity onPress={addEmergencyContact}>
          <Text style={styles.link}>+ Add Emergency Contact</Text>
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
              {profileExists ? 'Update Profile' : 'Save Profile'}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={clearDatabase}>
          <Text style={styles.danger}>Clear Database</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

/* -------------------------------------------------------
   Reusable Input component
-------------------------------------------------------- */
const Input = ({
  label,
  value,
  onChange,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) => (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{label}</Text>
    <TextInput
      style={[styles.input, multiline && styles.textArea]}
      value={value}
      onChangeText={onChange}
      multiline={multiline}
    />
  </View>
);

/* -------------------------------------------------------
   Styles
-------------------------------------------------------- */
const styles = StyleSheet.create({
  flex: { flex: 1 },
  container: { padding: 20 },
  loading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 26, fontWeight: 'bold', marginBottom: 20, textAlign: 'center' },
  section: { fontSize: 20, fontWeight: '600', marginVertical: 16 },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 14, marginBottom: 6 },
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