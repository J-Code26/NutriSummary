import { useRouter } from 'expo-router';
import React from 'react';
import { TouchableOpacity, Image, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const logo = require('@/assets/images/nutri-logo.png');

export default function HomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/filters');
  };

  return (
    <ThemedView style={styles.container}>
      <Image source={logo} style={styles.logo} />
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
  logo: {
    width: 200,
    height: 200,
    marginBottom: 20,
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
