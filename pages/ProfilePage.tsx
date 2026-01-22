import React, { useState, useEffect } from 'react';
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
  ActivityIndicator
} from 'react-native';
import { useTranslation } from 'react-i18next';

// Import database functions
import { initDb, getDb, resetDb } from '../android/app/src/services/db/initDb.ts';

const ProfilePage = () => {
  const { t } = useTranslation();

  // Form state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [gender, setGender] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [email, setEmail] = useState('');
  const [medicalNotes, setMedicalNotes] = useState('');

  // Emergency contacts
  const [emergencyContacts, setEmergencyContacts] = useState<
    { name: string; phone: string }[]
  >([{ name: '', phone: '' }]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profileExists, setProfileExists] = useState(false);
  const [profileId, setProfileId] = useState<number | null>(null);

  // Load existing profile on mount
  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    setLoading(true);
    try {
      console.log('📋 Loading profile from database...');

      // Initialize database
      const db = await initDb();

      // Check if user table exists and has any records
      const checkTable = await db.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user'"
      );

      if (checkTable[0].rows.length === 0) {
        console.log('📭 User table does not exist yet');
        setProfileExists(false);
        return;
      }

      // Check if any user exists
      const result = await db.executeSql(
        'SELECT * FROM user ORDER BY id DESC LIMIT 1'
      );

      if (result[0].rows.length > 0) {
        const user = result[0].rows.item(0);
        console.log('✅ Found existing profile:', user);

        setFirstName(user.first_name || '');
        setLastName(user.last_name || '');
        setGender(user.gender || '');
        setPhoneNumber(user.phone || '');
        setEmail(user.email || '');
        setMedicalNotes(user.medical_notes || '');
        setProfileId(user.id);
        setProfileExists(true);

        // Try to load emergency contacts
        if (user.emergency_contacts) {
          try {
            const contacts = JSON.parse(user.emergency_contacts);
            if (Array.isArray(contacts) && contacts.length > 0) {
              setEmergencyContacts(contacts);
            }
          } catch (e) {
            console.log('⚠️ Could not parse emergency contacts');
          }
        }
      } else {
        console.log('📭 No existing profile found');
        setProfileExists(false);
      }

    } catch (error) {
      console.error('❌ Error loading profile:', error);
      setProfileExists(false);
    } finally {
      setLoading(false);
    }
  };

  const addEmergencyContact = () => {
    setEmergencyContacts([...emergencyContacts, { name: '', phone: '' }]);
  };

  const updateEmergencyContact = (index: number, field: 'name' | 'phone', value: string) => {
    const newContacts = [...emergencyContacts];
    newContacts[index] = { ...newContacts[index], [field]: value };
    setEmergencyContacts(newContacts);
  };

  const setupProfile = async () => {
    // Basic validation
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required Fields', 'First name and last name are required.');
      return;
    }

    setSaving(true);

    try {
      console.log('💾 Setting up profile...');

      const db = getDb();

      // Always create new profile for setup (don't check for existing)
      // This ensures we always start fresh when setting up
      const result = await db.executeSql(
        `INSERT INTO user (
          first_name, last_name, gender, phone, email,
          medical_notes, emergency_contacts, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
        [
          firstName.trim(),
          lastName.trim(),
          gender.trim(),
          phoneNumber.trim(),
          email.trim(),
          medicalNotes.trim(),
          JSON.stringify(emergencyContacts.filter(ec => ec.name.trim() || ec.phone.trim()))
        ]
      );

      const newProfileId = result[0].insertId;
      setProfileId(newProfileId);
      setProfileExists(true);

      console.log('✅ Profile created with ID:', newProfileId);

      Alert.alert(
        'Profile Set Up Successfully!',
        'Your rescue profile has been created. This information will be used in emergency situations.',
        [{ text: 'OK' }]
      );

    } catch (error: any) {
      console.error('❌ Error setting up profile:', error);

      // Try to get more specific error
      let errorMessage = 'Could not save profile. ';
      if (error.message) {
        errorMessage += `Error: ${error.message}`;
      }

      // Try to get database schema to debug
      try {
        const db = getDb();
        const tableInfo = await db.executeSql('PRAGMA table_info(user)');
        console.log('📊 User table columns:');
        let columns = [];
        for (let i = 0; i < tableInfo[0].rows.length; i++) {
          const column = tableInfo[0].rows.item(i);
          columns.push(column.name);
          console.log(`  ${column.name} (${column.type})`);
        }
        console.log('Available columns:', columns.join(', '));
      } catch (schemaError) {
        console.error('Could not get table info:', schemaError);
      }

      Alert.alert('Setup Error', errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = async () => {
    if (!profileId) {
      Alert.alert('Error', 'No profile ID found. Please set up profile first.');
      return;
    }

    setSaving(true);

    try {
      console.log('📝 Updating profile ID:', profileId);

      const db = getDb();

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
          firstName.trim(),
          lastName.trim(),
          gender.trim(),
          phoneNumber.trim(),
          email.trim(),
          medicalNotes.trim(),
          JSON.stringify(emergencyContacts.filter(ec => ec.name.trim() || ec.phone.trim())),
          profileId
        ]
      );

      console.log('✅ Profile updated successfully');

      Alert.alert('Profile Updated', 'Your profile has been updated successfully.');

    } catch (error: any) {
      console.error('❌ Error updating profile:', error);
      Alert.alert('Update Error', 'Could not update profile. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = () => {
    if (!firstName.trim() || !lastName.trim()) {
      Alert.alert('Required Fields', 'First name and last name are required.');
      return;
    }

    if (profileExists && profileId) {
      updateProfile();
    } else {
      setupProfile();
    }
  };

  const clearDatabase = async () => {
    Alert.alert(
      'Clear Database',
      'Are you sure you want to clear all profile data? This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
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
              Alert.alert('Database Cleared', 'All profile data has been removed.');
            } catch (error) {
              Alert.alert('Error', 'Could not clear database.');
            }
          }
        }
      ]
    );
  };

  const testDatabase = async () => {
    try {
      const db = await initDb();

      // Test insert
      const testResult = await db.executeSql(
        'INSERT INTO user (first_name, last_name, created_at) VALUES (?, ?, datetime("now"))',
        ['Test', 'User']
      );

      const testId = testResult[0].insertId;
      console.log('✅ Test profile created with ID:', testId);

      // Clean up test data
      await db.executeSql('DELETE FROM user WHERE id = ?', [testId]);

      Alert.alert('Database Test', '✅ Database is working correctly!');

    } catch (error: any) {
      Alert.alert('Database Test Failed', error.message || 'Unknown error');
    }
  };

  const checkDatabase = async () => {
    try {
      const db = await initDb();

      // Check user table
      const tableCheck = await db.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='user'"
      );

      if (tableCheck[0].rows.length === 0) {
        Alert.alert('Database Check', '❌ User table does not exist.');
        return;
      }

      // Get table schema
      const schema = await db.executeSql('PRAGMA table_info(user)');
      const columns = [];
      for (let i = 0; i < schema[0].rows.length; i++) {
        columns.push(schema[0].rows.item(i).name);
      }

      // Check record count
      const countResult = await db.executeSql('SELECT COUNT(*) as count FROM user');
      const count = countResult[0].rows.item(0).count;

      Alert.alert(
        'Database Status',
        `✅ User table exists\n📊 Columns: ${columns.join(', ')}\n👤 Records: ${count}\n${profileExists ? '✅ Profile loaded' : '📭 No profile found'}`
      );

    } catch (error) {
      Alert.alert('Database Check Failed', 'Could not check database status.');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.loadingText}>Checking profile...</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.flexContainer}
    >
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.container}>
          <Text style={styles.pageTitle}>
            {profileExists ? 'Rescue Profile' : 'Set Up Rescue Profile'}
          </Text>

          {/* Database Debug Section */}
          <View style={styles.debugSection}>
            <View style={styles.debugButtons}>
              <TouchableOpacity style={styles.debugButton} onPress={checkDatabase}>
                <Text style={styles.debugButtonText}>Check DB</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.debugButton} onPress={testDatabase}>
                <Text style={styles.debugButtonText}>Test DB</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.debugButton, styles.clearButton]} onPress={clearDatabase}>
                <Text style={styles.debugButtonText}>Clear DB</Text>
              </TouchableOpacity>
            </View>

            {profileExists ? (
              <Text style={styles.statusText}>✅ Profile loaded (ID: {profileId})</Text>
            ) : (
              <Text style={styles.statusText}>📭 No profile found. Please set up your profile.</Text>
            )}
          </View>

          {/* Personal Details */}
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>First Name *</Text>
            <TextInput
              style={styles.input}
              value={firstName}
              onChangeText={setFirstName}
              placeholder="Enter first name"
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Last Name *</Text>
            <TextInput
              style={styles.input}
              value={lastName}
              onChangeText={setLastName}
              placeholder="Enter last name"
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Gender</Text>
            <TextInput
              style={styles.input}
              value={gender}
              onChangeText={setGender}
              placeholder="Male / Female / Other"
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Phone Number</Text>
            <TextInput
              style={styles.input}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
              placeholder="+1 (123) 456-7890"
              keyboardType="phone-pad"
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="email@example.com"
              keyboardType="email-address"
              placeholderTextColor="#aaa"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>Medical Notes</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={medicalNotes}
              onChangeText={setMedicalNotes}
              placeholder="Any medical conditions, allergies, medications, etc."
              placeholderTextColor="#aaa"
              multiline
              numberOfLines={4}
            />
          </View>

          {/* Emergency Contacts */}
          <Text style={[styles.sectionTitle, { marginTop: 32 }]}>
            Emergency Contacts
          </Text>

          {emergencyContacts.map((contact, index) => (
            <View key={index} style={styles.contactCard}>
              <Text style={styles.contactLabel}>
                Contact {index + 1}
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.input}
                  value={contact.name}
                  onChangeText={(text) => updateEmergencyContact(index, 'name', text)}
                  placeholder="Contact name"
                  placeholderTextColor="#aaa"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Phone Number</Text>
                <TextInput
                  style={styles.input}
                  value={contact.phone}
                  onChangeText={(text) => updateEmergencyContact(index, 'phone', text)}
                  placeholder="Emergency phone number"
                  keyboardType="phone-pad"
                  placeholderTextColor="#aaa"
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addButton} onPress={addEmergencyContact}>
            <Text style={styles.addButtonText}>+ Add Another Emergency Contact</Text>
          </TouchableOpacity>

          {/* Save Button */}
          <TouchableOpacity
            style={[styles.submitButton, saving && styles.submitButtonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text style={styles.submitButtonText}>
                {profileExists ? 'Update Profile' : 'Set Up Profile'}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.helpText}>
            * Required fields. This information will be used in emergency situations.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  flexContainer: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 40,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
  },
  debugSection: {
    marginBottom: 20,
    padding: 12,
    backgroundColor: '#fff',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  debugButtons: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  debugButton: {
    backgroundColor: '#2196F3',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  clearButton: {
    backgroundColor: '#F44336',
  },
  debugButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '500',
  },
  statusText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 4,
  },
  pageTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 20,
    textAlign: 'center',
    color: '#333',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    marginTop: 8,
    color: '#333',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 16,
    marginBottom: 6,
    color: '#333',
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
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
    backgroundColor: '#4CAF50',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
  },
  submitButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 10,
    fontStyle: 'italic',
  },
});

export default ProfilePage;