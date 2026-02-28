import { useRouter } from 'expo-router';
import React from 'react';
import { ImageBackground, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';

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
    <ImageBackground source={background} style={styles.container} resizeMode="cover">
      <View style={styles.overlay}>
        <ThemedText>Debug: Screen loaded</ThemedText>
        <ThemedText>{JSON.stringify(background)}</ThemedText>
        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <ThemedText style={styles.startButtonText}>Start</ThemedText>
        </TouchableOpacity>
      </View>
    </ImageBackground>
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
