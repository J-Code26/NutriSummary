import { useRouter } from 'expo-router';
import React from 'react';
import { Image, StyleSheet, TouchableOpacity } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const background = require('@/assets/images/NutriSummaryFrontPage.png');

export default function HomeScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/filters');
  };

  // debug: log background variable
  React.useEffect(() => {
    console.log('background asset', background);
  }, []);

  return (
    <Image source={background} style={styles.container} resizeMode="cover">
      <ThemedView style={styles.overlay}>
        <ThemedText>Debug: Screen loaded</ThemedText>
        <ThemedText>{JSON.stringify(background)}</ThemedText>
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <ThemedText style={styles.startButtonText}>Start</ThemedText>
        </TouchableOpacity>
      </ThemedView>
    </Image>
  );
}

const styles = StyleSheet.create({
  // full screen container for background
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
    height: '100%',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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
