import * as FileSystem from 'expo-file-system';
import React, { useEffect } from 'react';
import { Modal, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

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
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setOpen(true)}
      >
        <ThemedText>
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
      <TouchableOpacity
        style={styles.dropdown}
        onPress={() => setOpen(true)}
      >
        <ThemedText>
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
  const [allergies, setAllergies] = React.useState<string[]>([]);
  const [diets, setDiets] = React.useState<string[]>([]);
  const [medicalRestrictions, setMedicalRestrictions] = React.useState<string[]>([]);
  const [religions, setReligions] = React.useState<string[]>([]);

  const [weight, setWeight] = React.useState('');
  const [age, setAge] = React.useState('');
  const [height, setHeight] = React.useState('');
  const [gender, setGender] = React.useState('');

  // file we will write to within the app document directory
  const fileUri = FileSystem.documentDirectory + 'filters.txt';

  // whenever any of the filters change, serialize and save to disk
  useEffect(() => {
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

    // omit encoding option to avoid issues on web (EncodingType may be undefined)
    FileSystem.writeAsStringAsync(fileUri, JSON.stringify(data))
      .catch((e) => console.warn('Failed to write filters file', e));
  }, [allergies, diets, medicalRestrictions, religions, weight, age, height, gender]);

  return (
    <ThemedView style={styles.container}>
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

        <View style={styles.startButtonContainer}>
          <TouchableOpacity style={styles.startButton} onPress={() => {/* placeholder */}}>
            <ThemedText style={styles.startButtonText}>Start</ThemedText>
          </TouchableOpacity>
        </View>

      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  },
  input: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 40,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 4,
    paddingHorizontal: 10,
    height: 40,
    justifyContent: 'center',
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
  startButtonContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  startButton: {
    backgroundColor: '#007aff',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
