import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// Web camera component
function WebCamera({ 
  onBarcodeScanned, 
  isEnabled 
}: { 
  onBarcodeScanned: (data: { type: string; data: string }) => void;
  isEnabled: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [stream, setStream] = React.useState<MediaStream | null>(null);

  useEffect(() => {
    if (!isEnabled) {
      // Stop camera when disabled
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
        setStream(null);
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
        scanIntervalRef.current = null;
      }
      return;
    }

    // Start camera for web
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' }
        });
        
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          setStream(mediaStream);
          
          // Start scanning
          videoRef.current.addEventListener('loadedmetadata', () => {
            startScanning();
          });
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
      }
    };

    const startScanning = async () => {
      // Dynamically import ZXing for web only
      const { BrowserMultiFormatReader } = await import('@zxing/library');
      const codeReader = new BrowserMultiFormatReader();

      scanIntervalRef.current = setInterval(async () => {
        if (videoRef.current && canvasRef.current && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          const canvas = canvasRef.current;
          const video = videoRef.current;
          
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            
            try {
              const result = await codeReader.decodeFromCanvas(canvas);
              if (result) {
                console.log('Web barcode detected:', result.getText());
                onBarcodeScanned({
                  type: result.getBarcodeFormat().toString(),
                  data: result.getText()
                });
                // Stop scanning briefly after detection
                if (scanIntervalRef.current) {
                  clearInterval(scanIntervalRef.current);
                }
              }
            } catch (err) {
              // No barcode found in this frame, continue scanning
            }
          }
        }
      }, 300); // Scan every 300ms
    };

    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
    };
  }, [isEnabled, onBarcodeScanned]);

  if (!isEnabled) {
    return (
      <View style={[styles.cameraBox, styles.cameraOffBox]}>
        <ThemedText style={{ color: '#666' }}>Camera Off</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.cameraBox}>
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
        }}
      />
      <canvas ref={canvasRef as any} style={{ display: 'none' }} />
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
});
