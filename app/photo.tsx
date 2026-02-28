import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

export default function PhotoScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [cameraEnabled, setCameraEnabled] = React.useState(true);
  const [scannedData, setScannedData] = React.useState<string | null>(null);
  const [productName, setProductName] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const scanningRef = useRef(false);

  const fetchProductInfo = async (barcode: string) => {
    if (scanningRef.current) return; // Prevent multiple scans
    scanningRef.current = true;
    setIsScanning(true);
    setIsLoading(true);
    
    try {
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);
      const data = await response.json();
      
      if (data.status === 1 && data.product) {
        const name = data.product.product_name || 'Unknown Product';
        setProductName(name);
        setScannedData(barcode);
      } else {
        setProductName('Product not found in database');
        setScannedData(barcode);
      }
    } catch (error) {
      console.error('Error fetching product:', error);
      setProductName('Error loading product info');
      setScannedData(barcode);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        setIsScanning(false);
        scanningRef.current = false;
      }, 2000); // Wait 2 seconds before allowing another scan
    }
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    if (!scanningRef.current && cameraEnabled) {
      fetchProductInfo(data);
    }
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
        <View style={styles.cameraWrapper}>
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
          
          {/* Scanning Indicator */}
          {isScanning && cameraEnabled && (
            <View style={styles.scanningOverlay}>
              <View style={styles.scanLine} />
              <ThemedText style={styles.scanningText}>Scanning barcode...</ThemedText>
            </View>
          )}
        </View>
        
        {/* Product Info Display */}
        {isLoading && (
          <View style={styles.scanResult}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <ThemedText style={styles.loadingText}>Loading product info...</ThemedText>
          </View>
        )}
        
        {!isLoading && productName && (
          <View style={styles.scanResult}>
            <ThemedText style={styles.scanResultTitle}>Product Found!</ThemedText>
            <ThemedText style={styles.productName}>{productName}</ThemedText>
            <ThemedText style={styles.barcodeText}>Barcode: {scannedData}</ThemedText>
            <TouchableOpacity
              style={styles.clearButton}
              onPress={() => {
                setScannedData(null);
                setProductName(null);
                setIsScanning(false);
                scanningRef.current = false;
              }}
            >
              <ThemedText style={styles.clearButtonText}>Scan Another</ThemedText>
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
  cameraWrapper: {
    width: '90%',
    height: 500,
    position: 'relative',
  },
  cameraBox: {
    width: '100%',
    height: '100%',
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
  scanningOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  scanLine: {
    width: '80%',
    height: 3,
    backgroundColor: '#2E7D32',
    marginBottom: 10,
  },
  scanningText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
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
    marginBottom: 12,
    textAlign: 'center',
  },
  productName: {
    color: '#000',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 10,
    textAlign: 'center',
  },
  barcodeText: {
    color: '#666',
    fontSize: 14,
    marginBottom: 15,
    textAlign: 'center',
  },
  loadingText: {
    color: '#2E7D32',
    fontSize: 16,
    marginTop: 10,
    textAlign: 'center',
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
