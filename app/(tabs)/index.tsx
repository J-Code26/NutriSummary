import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const background = require('@/assets/images/nutri-logo.png');

export default function HomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/filters');
  };

  return (
    <ImageBackground source={background} style={styles.container} resizeMode="cover">
      <ThemedView style={styles.overlay}>
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <ThemedText style={styles.startButtonText}>Start</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  // full screen container for background
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    width: '100%',
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
