import { useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { StyleSheet } from 'react-native';

export default function HomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/filters');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>NutriSummary</ThemedText>
      <TouchableOpacity style={styles.startButton} onPress={handleStart}>
        <ThemedText style={styles.startButtonText}>Start</ThemedText>
      </TouchableOpacity>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    marginBottom: 20,
    textAlign: 'center',
  },
  startButton: {
    backgroundColor: '#007aff',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 5,
  },
  startButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
});
