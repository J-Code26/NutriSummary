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
  const scanningActiveRef = useRef(false);
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
        
        const { BrowserMultiFormatReader } = await import('@zxing/browser');
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
            frameRate: { ideal: 30 },
            // Use advanced constraints for focus (must be in advanced array for browser compatibility)
            advanced: [
              { focusMode: 'continuous' } as any,
              { focusDistance: 0 } as any
            ] as any
          }
        });
        streamRef.current = stream;
        videoRef.current.srcObject = stream;
        
        setDebugInfo('Camera stream obtained');
        
        // Wait for video to load and be ready
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
        
        // Additional wait to let video stabilize and focus
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setDebugInfo('Optimizing focus...');
        
        // Try to trigger continuous focus on the video track
        try {
          const videoTrack = streamRef.current?.getVideoTracks()[0];
          if (videoTrack && videoTrack.applyConstraints) {
            await videoTrack.applyConstraints({
              advanced: [
                { focusMode: 'continuous' } as any,
                { focusDistance: 0 } as any,
                { torch: false } as any // Disable flash if it was on
              ]
            } as any);
          }
        } catch (e) {
          console.log('Could not apply focus constraints:', e);
        }
        
        setDebugInfo('Creating ZXing scanner with enhanced preprocessing...');
        codeReaderRef.current = new BrowserMultiFormatReader();
        
        // Create hidden canvas for frame capture and preprocessing
        const scanCanvas = document.createElement('canvas');
        const scanCtx = scanCanvas.getContext('2d');
        
        setIsScanning(true);
        frameCountRef.current = 0;
        scanningActiveRef.current = true;
        // More robust scanning with frame preprocessing for rotated barcodes
        const enhancedScanInterval = setInterval(async () => {
          if (!videoRef.current || !scanCtx || !codeReaderRef.current || !scanningActiveRef.current) return;
          
          try {
            frameCountRef.current++;
            
            // Set canvas size to match video
            scanCanvas.width = videoRef.current.videoWidth;
            scanCanvas.height = videoRef.current.videoHeight;
            
            // Draw original frame
            scanCtx.drawImage(videoRef.current, 0, 0);
            try {
              const result = await codeReaderRef.current.decodeFromCanvas(scanCanvas);
              if (result && !detectedRef.current) {
                const code = result.getText();
                const format = result.getBarcodeFormat()?.toString() || 'unknown';
                console.log('✅ Barcode detected:', code, 'Format:', format);
                setDebugInfo(`Barcode found: ${code}`);
                
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
                              return;
              }
            } catch (e) {
              // Continue to rotation attempt if normal scan fails
            }
            
            // Try rotated version every 3rd frame for vertical barcodes
              if (frameCountRef.current % 3 === 0) {
                try {
                  // Rotate canvas 90 degrees and try again (for vertical barcodes)
                  const rotatedCanvas = document.createElement('canvas');
                  rotatedCanvas.width = scanCanvas.height;
                  rotatedCanvas.height = scanCanvas.width;
                  const rotCtx = rotatedCanvas.getContext('2d');
                  if (rotCtx) {
                    rotCtx.translate(rotatedCanvas.width / 2, rotatedCanvas.height / 2);
                    rotCtx.rotate(Math.PI / 2);
                    rotCtx.drawImage(scanCanvas, -scanCanvas.width / 2, -scanCanvas.height / 2);
                    
                    try {
                      const resultRotated = await codeReaderRef.current.decodeFromCanvas(rotatedCanvas);
                      if (resultRotated && !detectedRef.current) {
                        const code = resultRotated.getText();
                        const format = resultRotated.getBarcodeFormat()?.toString() || 'unknown';
                        console.log('✅ Barcode detected (rotated 90°):', code, 'Format:', format);
                        setDebugInfo(`Barcode found (rotated): ${code}`);
                        
                        detectedRef.current = true;
                        onBarcodeScanned({
                          type: format,
                          data: code
                        });
                        
                        setTimeout(() => {
                          detectedRef.current = false;
                          setDebugInfo('Ready for next barcode');
                        }, 1500);
                        return;
                      }
                    } catch (e2) {
                      // No barcode in rotated frame either
                    }
                    }
                  }
                } catch (rotErr) {
                  console.log('Rotation scan error:', rotErr);
                }
              }
          } catch (err) {
            console.error('Scan error:', err);
          }
        }, 200); // Faster scanning (200ms) for better vertical detection
        
        scanIntervalRef.current = enhancedScanInterval as any;
        setDebugInfo('✓ Scanner ready - enhanced for vertical/angled barcodes');
        console.log('✅ Scanner started with edge enhancement and rotation support!');
        
        
      } catch (error: any) {
        console.error('Error starting scanner:', error);
        setDebugInfo(`Scanner error: ${error.message}`);
      }
    };

    startScanner();

    return () => {
      // Stop the enhanced scan loop
      scanningActiveRef.current = false;
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current as any);
      }
      // Clean up stream
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

  const handleVideoTap = () => {
    // Trigger focus when user taps the video
    if (streamRef.current) {
      const videoTrack = streamRef.current.getVideoTracks()[0];
      if (videoTrack && videoTrack.applyConstraints) {
        videoTrack.applyConstraints({
          advanced: [
            { focusMode: 'continuous' } as any
          ]
        } as any).catch(err => console.log('Focus tap failed:', err));
      }
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
      {/* Debug header bar - FIRST so it's at absolute top */}
      <View style={styles.webHelpText}>
        <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
          {debugInfo}
        </ThemedText>
      </View>

      {/* Video element with tap-to-focus */}
      <View 
        onClick={handleVideoTap}
        style={{ 
          width: '100%', 
          height: '100%', 
          cursor: 'pointer',
          position: 'absolute',
          top: 0,
          left: 0
        } as any}
      >
        <video 
          ref={videoRef as any}
          autoPlay
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 12,
            backgroundColor: '#000',
            // Aggressive enhancement for glare and vertical barcodes
            filter: 'contrast(1.3) brightness(1.15) saturate(1.2) hue-rotate(0deg)',
            WebkitFilter: 'contrast(1.3) brightness(1.15) saturate(1.2)'
          } as any}
        />
      </View>
      
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

      {/* Status indicator only */}
      <View style={{ position: 'absolute', bottom: 80, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6 }}>
        <ThemedText style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>
          {isScanning ? '🔍 Scanning vertical/angled barcodes' : '📷 Initializing camera...'}
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
