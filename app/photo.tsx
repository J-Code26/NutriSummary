import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PhotoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraEnabled, setCameraEnabled] = React.useState(true);
  const [scannedData, setScannedData] = React.useState<string | null>(null);
  const [scannedType, setScannedType] = React.useState<string | null>(null);

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    setScannedData(data);
    setScannedType(type);
  };

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  if (!permission) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.navButton}>
            <ThemedText style={styles.navText}>Home</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/filters')} style={styles.navButton}>
            <ThemedText style={styles.navText}>Filters</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/photo')}
            style={[styles.navButton, styles.navButtonActive]}
          >
            <ThemedText style={[styles.navText, styles.navTextActive]}>Photo</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <ThemedText>Requesting camera permission...</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.navBar}>
          <TouchableOpacity onPress={() => router.push('/')} style={styles.navButton}>
            <ThemedText style={styles.navText}>Home</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => router.push('/filters')} style={styles.navButton}>
            <ThemedText style={styles.navText}>Filters</ThemedText>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => router.push('/photo')}
            style={[styles.navButton, styles.navButtonActive]}
          >
            <ThemedText style={[styles.navText, styles.navTextActive]}>Photo</ThemedText>
          </TouchableOpacity>
        </View>
        <View style={styles.content}>
          <ThemedText>Camera access denied. Please enable camera permissions.</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      {/* Top Navigation */}
      <View style={styles.navBar}>
        <TouchableOpacity onPress={() => router.push('/')} style={styles.navButton}>
          <ThemedText style={styles.navText}>Home</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => router.push('/filters')} style={styles.navButton}>
          <ThemedText style={styles.navText}>Filters</ThemedText>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => router.push('/photo')}
          style={[styles.navButton, styles.navButtonActive]}
        >
          <ThemedText style={[styles.navText, styles.navTextActive]}>Photo</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Camera View */}
      <View style={styles.content}>
        {cameraEnabled ? (
          <CameraView
            style={styles.cameraBox}
            facing="back"
            barcodeScannerSettings={{
              barcodeTypes: [
                'ean13',
                'ean8',
                'upc_a',
                'upc_e',
                'code128',
                'code39',
                'qr',
              ],
            }}
            onBarcodeScanned={handleBarcodeScanned}
          />
        ) : (
          <View style={[styles.cameraBox, styles.cameraOffBox]} />
        )}
        
        {scannedData && (
          <View style={styles.scanResult}>
            <ThemedText style={styles.scanResultTitle}>Scanned Item:</ThemedText>
            <ThemedText style={styles.scanResultData}>{scannedData}</ThemedText>
            <ThemedText style={styles.scanResultType}>Type: {scannedType}</ThemedText>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setScannedData(null);
                setScannedType(null);
              }}
            >
              <ThemedText style={styles.clearButtonText}>Clear</ThemedText>
            </TouchableOpacity>
          </View>
        )}
        
        <TouchableOpacity
          style={styles.toggleButton}
          onPress={() => setCameraEnabled(!cameraEnabled)}
        >
          <ThemedText style={styles.toggleButtonText}>
            {cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
          </ThemedText>
        </TouchableOpacity>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ade866',
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
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  cameraBox: {
    width: '90%',
    height: 500,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#2E7D32',
  },
  cameraOffBox: {
    backgroundColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  toggleButton: {
    marginTop: 20,
    backgroundColor: '#2E7D32',
    paddingVertical: 12,
    paddingHorizontal: 30,
    borderRadius: 8,
  },
  toggleButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  scanResult: {
    marginTop: 20,
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    width: '90%',
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  scanResultTitle: {
    color: '#2E7D32',
    fontWeight: '700',
    fontSize: 18,
    marginBottom: 8,
  },
  scanResultData: {
    color: '#000',
    fontSize: 16,
    marginBottom: 5,
  },
  scanResultType: {
    color: '#666',
    fontSize: 14,
    marginBottom: 10,
  },
  clearButton: {
    backgroundColor: '#d32f2f',
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
    alignSelf: 'flex-start',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
});
