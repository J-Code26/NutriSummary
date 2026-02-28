import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Web camera component with automatic barcode scanning
function WebCamera({ 
  onBarcodeScanned, 
  isEnabled 
}: { 
  onBarcodeScanned: (data: { type: string; data: string }) => void;
  isEnabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [manualBarcode, setManualBarcode] = React.useState('');
  const [isScanning, setIsScanning] = React.useState(false);
  const [debugInfo, setDebugInfo] = React.useState('Initializing...');
  const detectedRef = useRef(false);
  const codeReaderRef = useRef<any>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const frameCountRef = useRef(0);

  useEffect(() => {
    if (!isEnabled) {
      // Stop scanner when disabled
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
        streamRef.current = null;
      }
      setIsScanning(false);
      return;
    }

    // Start barcode scanner using ZXing continuous decoding (like a grocery store scanner)
    const startScanner = async () => {
      try {
        const msg = 'Starting barcode scanner...';
        console.log(msg);
        setDebugInfo(msg);
        
        const { BrowserMultiFormatReader, DecodeHintType, BarcodeFormat } = await import('@zxing/browser');
        setDebugInfo('ZXing imported successfully');
        
        // Wait for video element to be ready
        await new Promise(resolve => setTimeout(resolve, 500));
        
        if (!videoRef.current) {
          const err = 'Video element not found';
          console.error(err);
          setDebugInfo(err);
          return;
        }

        // Get camera stream with improved settings for better scanning in various conditions
        setDebugInfo('Requesting camera access...');
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { 
            facingMode: 'environment',
            width: { ideal: 1280 },
            height: { ideal: 720 },
            // Enable continuous autofocus for instant focusing
            focusMode: 'continuous' as any,
            // Request best framerate for smooth scanning
            frameRate: { ideal: 30 }
          }
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        // Try to enable macro mode for close-range focusing
        try {
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack && videoTrack.getCapabilities) {
            const capabilities = videoTrack.getCapabilities() as any;
            if (capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
              await videoTrack.applyConstraints({
                advanced: [
                  { focusMode: 'continuous' as any }
                ] as any
              });
            }
            // Enable manual focus if available
            if (capabilities.focusDistance) {
              await videoTrack.applyConstraints({
                advanced: [
                  { focusDistance: 0 } // 0 = closest focus
                ] as any
              });
            }
          }
        } catch (e) {
          console.log('Auto-focus enhancement not fully supported on this device');
        }
        
        setDebugInfo('Camera stream obtained');
        
        // Wait for video to load
        await new Promise(resolve => {
          const timeout = setTimeout(() => {
            console.warn('Video loadedmetadata timeout - proceeding anyway');
            resolve(true);
          }, 2000);
          
          videoRef.current?.addEventListener('loadedmetadata', () => {
            clearTimeout(timeout);
            resolve(true);
          }, { once: true });
        });
        
        setDebugInfo('Creating ZXing scanner with enhanced hints...');
        codeReaderRef.current = new BrowserMultiFormatReader();
        
        // Configure scanner hints for maximum detection capability
        // TRY_HARDER: Spend more time decoding, especially useful for rotated/glared barcodes
        // POSSIBLE_FORMATS: Support all common barcode types including sideways
        const hints = new Map();
        hints.set(DecodeHintType.TRY_HARDER, true);
        hints.set(DecodeHintType.POSSIBLE_FORMATS, [
          BarcodeFormat.EAN_13,
          BarcodeFormat.EAN_8,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.CODE_128,
          BarcodeFormat.CODE_39,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.CODABAR,
          BarcodeFormat.ITF // Interleaved 2 of 5 for warehouse barcodes
        ]);
        
        codeReaderRef.current.setHints(hints);
        
        setIsScanning(true);
        frameCountRef.current = 0;
        
        // Use continuous decode with callback for instant scanning
        // This is the proper API for real-time barcode scanning
        const decodePromise = codeReaderRef.current.decodeFromVideoElement(
          videoRef.current,
          (result, error) => {
            if (result) {
              frameCountRef.current++;
              const code = result.getText();
              const format = result.getBarcodeFormat()?.toString() || 'unknown';
              console.log('✅ Barcode detected:', code, 'Format:', format);
              setDebugInfo(`Barcode found: ${code}`);
              
              if (!detectedRef.current) {
                detectedRef.current = true;
                onBarcodeScanned({
                  type: format,
                  data: code
                });
                
                // Short 1.5 second cooldown to allow picking up another barcode quickly
                setTimeout(() => {
                  detectedRef.current = false;
                  setDebugInfo('Ready for next barcode');
                }, 1500);
              }
            }
            
            if (frameCountRef.current % 0 === 0 && frameCountRef.current > 0) {
              // Only update status occasionally to reduce re-renders
            }
          }
        );
        
        // Store the promise so we can cancel it later
        scanIntervalRef.current = decodePromise as any;
        setDebugInfo('✓ Scanner ready - scan any angle and lighting');
        console.log('✅ Scanner started with enhanced rotation and glare handling!');
        
        
      } catch (error: any) {
        console.error('Error starting scanner:', error);
        setDebugInfo(`Scanner error: ${error.message}`);
      }
    };

    startScanner();

    return () => {
      // Cancel the continuous decode
      if (codeReaderRef.current) {
        try {
          codeReaderRef.current.reset();
        } catch (e) {
          // Ignore cancel errors
        }
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isEnabled, onBarcodeScanned]);

  const handleManualSubmit = () => {
    if (manualBarcode.trim()) {
      onBarcodeScanned({
        type: 'manual',
        data: manualBarcode.trim()
      });
      setManualBarcode('');
    }
  };

  if (!isEnabled) {
    return (
      <View style={[styles.cameraBox, styles.cameraOffBox]}>
        <ThemedText style={{ color: '#666' }}>Camera Off</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      <video 
        ref={videoRef as any}
        autoPlay
        playsInline
        muted
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          borderRadius: 12,
          backgroundColor: '#000',
          // Enhance contrast for better barcode detection in glare/poor lighting
          filter: 'contrast(1.1) brightness(1.05)',
          WebkitFilter: 'contrast(1.1) brightness(1.05)',
          position: 'absolute',
          top: 0,
          left: 0
        } as any}
      />
      
      {/* Manual barcode input overlay */}
      <View style={styles.manualInputContainer}>
        <TextInput
          style={styles.manualInput}
          placeholder="Or enter barcode manually"
          placeholderTextColor="#999"
          value={manualBarcode}
          onChangeText={setManualBarcode}
          onSubmitEditing={handleManualSubmit}
          returnKeyType="search"
        />
        <TouchableOpacity onPress={handleManualSubmit} style={styles.scanManualButton}>
          <ThemedText style={styles.scanManualButtonText}>Scan</ThemedText>
        </TouchableOpacity>
      </View>

      {/* Debug info and status - rendered last so it appears on top */}
      <View style={styles.webHelpText}>
        <ThemedText style={{ color: '#fff', fontSize: 12, textAlign: 'center', marginBottom: 4 }}>
          {debugInfo}
        </ThemedText>
        <ThemedText style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>
          {isScanning ? '🔍 Scanning...' : 'Starting...'}
        </ThemedText>
      </View>
    </View>
  );
}

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
    console.log('Barcode detected!', type, data);
    if (!scanningRef.current && cameraEnabled) {
      console.log('Processing barcode...');
      fetchProductInfo(data);
    } else {
      console.log('Scan blocked - cooldown active');
    }
  };

  useEffect(() => {
    if (Platform.OS !== 'web' && !permission?.granted) {
      requestPermission();
    }
  }, [permission, requestPermission]);

  // Skip permission checks for web
  if (Platform.OS !== 'web') {
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
          {Platform.OS === 'web' ? (
            // Web-specific camera
            <>
              <WebCamera 
                onBarcodeScanned={handleBarcodeScanned}
                isEnabled={cameraEnabled}
              />
              
              {cameraEnabled && (
                <>
                  {/* Always show scanning frame */}
                  <View style={styles.scanFrame}>
                    <View style={styles.scanCorner} />
                  </View>
                  
                  {/* Status indicator */}
                  <View style={styles.statusBar}>
                    <ThemedText style={styles.statusText}>
                      {isScanning ? '📊 Processing...' : '📷 Point at barcode'}
                    </ThemedText>
                  </View>
                </>
              )}
            </>
          ) : (
            // Native mobile camera
            cameraEnabled ? (
              <>
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
                
                {/* Always show scanning frame */}
                <View style={styles.scanFrame}>
                  <View style={styles.scanCorner} />
                </View>
                
                {/* Status indicator */}
                <View style={styles.statusBar}>
                  <ThemedText style={styles.statusText}>
                    {isScanning ? '📊 Processing...' : '📷 Point at barcode'}
                  </ThemedText>
                </View>
              </>
            ) : (
              <View style={[styles.cameraBox, styles.cameraOffBox]}>
                <ThemedText style={{ color: '#666' }}>Camera Off</ThemedText>
              </View>
            )
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
  scanFrame: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 250,
    height: 150,
    marginLeft: -125,
    marginTop: -75,
    borderWidth: 3,
    borderColor: '#2E7D32',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  scanCorner: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 40,
    height: 40,
    borderTopWidth: 5,
    borderLeftWidth: 5,
    borderColor: '#ade866',
    borderRadius: 4,
  },
  statusBar: {
    position: 'absolute',
    top: 20,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  statusText: {
    backgroundColor: 'rgba(46, 125, 50, 0.9)',
    color: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
    fontSize: 16,
    fontWeight: '600',
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
  manualInputContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
    borderWidth: 2,
    borderColor: '#2E7D32',
    color: '#000',
  },
  scanManualButton: {
    backgroundColor: '#2E7D32',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
  },
  scanManualButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  webHelpText: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.8)',
    padding: 12,
    borderRadius: 0,
    zIndex: 999999,
  },
});
