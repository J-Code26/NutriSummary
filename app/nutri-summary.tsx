import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Modal, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// custom multi-select dropdown component
function MultiSelectDropdown({
  label,
  options,
  selected,
  setSelected,
}: {
  label: string;
  options: string[];
  selected: string[];
  setSelected: (v: string[]) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const toggle = (item: string) => {
    if (selected.includes(item)) {
      setSelected(selected.filter((i) => i !== item));
    } else {
      setSelected([...selected, item]);
    }
  };

  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(true)}>
        <ThemedText style={styles.dropdownText}>
          {selected.length > 0 ? selected.join(', ') : `Select ${label.toLowerCase()}`}
        </ThemedText>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => toggle(opt)}
                  style={styles.option}
                >
                  <ThemedText>
                    {selected.includes(opt) ? '☑️ ' : '⬜️ '}
                    {opt}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setOpen(false)}
            >
              <ThemedText>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// single-select dropdown to enforce only one choice
function SingleSelectDropdown({
  label,
  options,
  selected,
  setSelected,
}: {
  label: string;
  options: string[];
  selected: string;
  setSelected: (v: string) => void;
}) {
  const [open, setOpen] = React.useState(false);

  const choose = (item: string) => {
    setSelected(item);
    setOpen(false);
  };

  return (
    <View style={styles.field}>
      <ThemedText style={styles.label}>{label}</ThemedText>
      <TouchableOpacity style={styles.dropdown} onPress={() => setOpen(true)}>
        <ThemedText style={styles.dropdownText}>
          {selected ? selected : `Select ${label.toLowerCase()}`}
        </ThemedText>
      </TouchableOpacity>
      <Modal visible={open} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              {options.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => choose(opt)}
                  style={styles.option}
                >
                  <ThemedText>
                    {selected === opt ? '🔘 ' : '⚪️ '}
                    {opt}
                  </ThemedText>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setOpen(false)}
            >
              <ThemedText>Done</ThemedText>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

export default function FiltersScreen() {
  const router = useRouter();
  const [allergies, setAllergies] = React.useState<string[]>([]);
  const [diets, setDiets] = React.useState<string[]>([]);
  const [medicalRestrictions, setMedicalRestrictions] = React.useState<string[]>([]);
  const [religions, setReligions] = React.useState<string[]>([]);

  const [weight, setWeight] = React.useState('');
  const [age, setAge] = React.useState('');
  const [height, setHeight] = React.useState('');
  const [gender, setGender] = React.useState('');

  const isLoaded = useRef(false);

  // whenever any of the filters change, serialize and save to disk
  useEffect(() => {
    // skip saving if we haven't finished loading existing filters
    if (!isLoaded.current) return;

    const data = {
      allergies,
      diets,
      medicalRestrictions,
      religions,
      weight,
      age,
      height,
      gender,
    };

    const json = JSON.stringify(data);

    if (Platform.OS === 'web') {
      if (typeof localStorage !== 'undefined') {
        try {
          localStorage.setItem('nutri-filters', json);
        } catch (e) {
          console.warn('Failed to save filters to localStorage', e);
        }
      }
    } else {
      // file we will write to within the app document directory
      const fileUri = FileSystem.documentDirectory ? FileSystem.documentDirectory + 'filters.txt' : null;
      if (fileUri) {
        // omit encoding option to avoid issues on web (EncodingType may be undefined)
        FileSystem.writeAsStringAsync(fileUri, json)
          .catch((e) => console.warn('Failed to write filters file', e));
      }
    }
  }, [allergies, diets, medicalRestrictions, religions, weight, age, height, gender]);

  // load filters on mount
  useEffect(() => {
    const loadFilters = async () => {
      let savedData: string | null = null;
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          savedData = localStorage.getItem('nutri-filters');
        }
      } else {
        const fileUri = FileSystem.documentDirectory ? FileSystem.documentDirectory + 'filters.txt' : null;
        if (fileUri) {
          try {
            const exists = await FileSystem.getInfoAsync(fileUri);
            if (exists.exists) {
              savedData = await FileSystem.readAsStringAsync(fileUri);
            }
          } catch (e) {
            console.warn('Failed to read filters file', e);
          }
        }
      }

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData);
          if (parsed.allergies) setAllergies(parsed.allergies);
          if (parsed.diets) setDiets(parsed.diets);
          if (parsed.medicalRestrictions) setMedicalRestrictions(parsed.medicalRestrictions);
          if (parsed.religions) setReligions(parsed.religions);
          if (parsed.weight) setWeight(parsed.weight);
          if (parsed.age) setAge(parsed.age);
          if (parsed.height) setHeight(parsed.height);
          if (parsed.gender) setGender(parsed.gender);
        } catch (e) {
          console.warn('Failed to parse saved filters', e);
        }
      }
      isLoaded.current = true;
    };
    loadFilters();
  }, []);

  const saveFilters = async () => {
    const data = {
      allergies,
      diets,
      medicalRestrictions,
      religions,
      weight,
      age,
      height,
      gender,
    };

    const json = JSON.stringify(data);

    try {
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('nutri-filters', json);
        }
      } else {
        const fileUri = FileSystem.documentDirectory ? FileSystem.documentDirectory + 'filters.txt' : null;
        if (fileUri) {
          await FileSystem.writeAsStringAsync(fileUri, json);
        }
      }
      console.log('Filters saved successfully');
    } catch (e) {
      console.warn('Failed to save filters', e);
    }
  };

  const handleProceed = async () => {
    await saveFilters();
    router.push('/photo');
  };

  return (
    <ThemedView style={styles.container} lightColor="#ade866" darkColor="#0A2F0A">
      {/* Top Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.navButton}>
          <ThemedText style={styles.navText}>Home</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/filters')}
          style={[styles.navButton, styles.navButtonActive]}
        >
          <ThemedText style={[styles.navText, styles.navTextActive]}>Filters</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/photo')} style={styles.navButton}>
          <ThemedText style={styles.navText}>Photo</ThemedText>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title" style={styles.title}>
          Filters
        </ThemedText>

        <MultiSelectDropdown
          label="Allergies"
          options={[
            'Peanuts',
            'Tree Nuts',
            'Soy',
            'Shellfish',
            'Eggs',
            'Dairy',
            'Wheat',
            'Sesame',
            'Artificial sweeteners',
            'Sugar alcohol',
            'Seed oils',
            'High-fructose corn syrup',
          ]}
          selected={allergies}
          setSelected={setAllergies}
        />

        <MultiSelectDropdown
          label="Diets"
          options={[
            'Keto',
            'Vegan',
            'Pescetarian',
            'Dairy-free',
            'Gluten-free',
            'Carnivore',
            'Mediterranean',
            'Paleo',
            'High-Protein',
            'Pork-free',
          ]}
          selected={diets}
          setSelected={setDiets}
        />

        <View style={styles.field}>
          <ThemedText style={styles.label}>Weight (lbs)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Enter weight (lbs)"
            value={weight}
            onChangeText={(t) => setWeight(t.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Age (years)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Enter age (years)"
            value={age}
            onChangeText={(t) => setAge(t.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
        </View>

        <View style={styles.field}>
          <ThemedText style={styles.label}>Height (inches)</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Enter height (inches)"
            value={height}
            onChangeText={(t) => setHeight(t.replace(/[^0-9]/g, ''))}
            keyboardType="numeric"
          />
        </View>

        <SingleSelectDropdown
          label="Gender"
          options={["Male", "Female", "Other"]}
          selected={gender}
          setSelected={setGender}
        />

        <MultiSelectDropdown
          label="Medical Restrictions"
          options={[
            'Lactose Intollerance',
            'Celiac Disease / Gluten Intolerance',
            'Common Diabetes Limitations',
            'Low Sodium Restrictions',
            'Cholesterol Restrictions',
            'Crohn\'s Disease',
          ]}
          selected={medicalRestrictions}
          setSelected={setMedicalRestrictions}
        />

        <MultiSelectDropdown
          label="Religion dietary restrictions"
          options={[
            'Common Islamic Dietary Law (Halal and Haram)',
            'Common Jewish Dietary Law (Kosher)',
          ]}
          selected={religions}
          setSelected={setReligions}
        />

        <TouchableOpacity
          style={styles.proceedButton}
          onPress={handleProceed}
        >
          <ThemedText style={styles.proceedButtonText}>Proceed</ThemedText>
        </TouchableOpacity>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 10,
  },
  navButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  navButtonActive: {
    backgroundColor: '#1B5E20',
  },
  navText: {
    color: '#fff',
    fontWeight: '600',
    textAlign: 'center',
  },
  navTextActive: {
    color: '#ade866',
  },
  scroll: {
    padding: 20,
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  field: {
    marginBottom: 15,
  },
  label: {
    marginBottom: 5,
    color: '#fff',
    backgroundColor: '#2E7D32',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    color: '#000',
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 40,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    backgroundColor: '#fff',
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
  },
  dropdownText: {
    color: '#000',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '80%',
    maxHeight: '70%',
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 20,
  },
  option: {
    paddingVertical: 10,
  },
  closeButton: {
    marginTop: 10,
    alignSelf: 'flex-end',
    padding: 10,
  },
  proceedButton: {
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 6,
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 20,
  },
  proceedButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});
