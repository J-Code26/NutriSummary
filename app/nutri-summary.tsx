import React from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function FiltersScreen() {
  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <ThemedText type="title" style={styles.title}>
          Filters
        </ThemedText>

        {[
          'Allergies',
          'Diets',
          'Weight/Age/Gender',
          'Medical Restrictions',
          'Religion/Culture',
          'Personal Preferences',
          'Location and Availability',
          'Disabilities',
          'Illnesses',
        ].map((label) => (
          <View key={label} style={styles.field}>
            <ThemedText style={styles.label}>{label}</ThemedText>
            <TextInput style={styles.input} placeholder={`Enter ${label.toLowerCase()}`} />
          </View>
        ))}
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
});
