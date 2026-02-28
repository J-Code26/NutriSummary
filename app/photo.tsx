import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useCallback } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { RulesEngine, RULES, SYNONYMS, normalizeOFF, EvaluationResponse, FilterProfile } from '@/utils/nutrition-logic';

// --- Decision Tree Evaluation ---
// This function uses the migrated Python logic to evaluate products.
const engine = new RulesEngine(RULES, SYNONYMS);

function evaluateProductWithDecisionTree(productData: any, userFilters: any): EvaluationResponse {
  const product = normalizeOFF(productData);
  
  // Map app filters to the RulesEngine's FilterProfile
  const profile: FilterProfile = {
    diet: null,
    religion: null,
    medical: null,
    allergens: (userFilters.allergies || []).map((a: string) => {
      let val = a.toLowerCase();
      if (val === 'eggs') return 'egg';
      if (val === 'dairy') return 'milk';
      if (val === 'artificial sweeteners') return 'artificial_sweeteners';
      if (val === 'sugar alcohol') return 'sugar_alcohols';
      if (val === 'seed oils') return 'seed_oils';
      if (val === 'high-fructose corn syrup') return 'hfcs';
      return val;
    }),
    unitsPreference: 'per_serving',
    strictness: 'balanced'
  };

  // Improved mapping: If multiple diets, religions, or medical restrictions are selected, 
  // we try to map them to the keys expected by the RulesEngine.
  // Note: The current RulesEngine logic (in _applies_when) uses strict equality check,
  // so we pick the most relevant single value if multiple are present.
  
  if (userFilters.diets && userFilters.diets.length > 0) {
    const dietOptions = ['keto', 'vegan', 'pescetarian', 'dairy-free', 'gluten-free', 'carnivore', 'mediterranean', 'paleo', 'high-protein', 'pork-free', 'vegetarian'];
    const foundDiet = userFilters.diets.find((d: string) => dietOptions.includes(d.toLowerCase()));
    if (foundDiet) profile.diet = foundDiet.toLowerCase();
  }

  if (userFilters.religions && userFilters.religions.length > 0) {
    const rel = userFilters.religions[0].toLowerCase();
    if (rel.includes('islamic') || rel.includes('halal')) profile.religion = 'halal';
    else if (rel.includes('jewish') || rel.includes('kosher')) profile.religion = 'kosher';
  }

  if (userFilters.medicalRestrictions && userFilters.medicalRestrictions.length > 0) {
    const medicalMap: Record<string, string> = {
      'celiac': 'celiac',
      'diabetes': 'diabetes',
      'lactose': 'lactose',
      'sodium': 'low sodium',
      'cholesterol': 'cholesterol',
      'crohn': "crohn's"
    };
    
    for (const med of userFilters.medicalRestrictions) {
      const lowerMed = med.toLowerCase();
      for (const [key, value] of Object.entries(medicalMap)) {
        if (lowerMed.includes(key)) {
          profile.medical = value;
          break;
        }
      }
      if (profile.medical) break;
    }
  }

  return engine.evaluate(product, profile);
}

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

  const [refreshKey, setRefreshKey] = React.useState(0);

  useEffect(() => {
    if (!isEnabled) {
      // Stop scanner when disabled
      if (scanIntervalRef.current) {
        clearInterval(scanIntervalRef.current);
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Error stopping track during cleanup:', e);
          }
        });
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
            frameRate: { ideal: 30 }
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
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setDebugInfo('Optimizing focus...');
        
        // Try to trigger continuous focus on the video track
        try {
          const videoTrack = streamRef.current?.getVideoTracks()[0];
          if (videoTrack && videoTrack.applyConstraints) {
            const capabilities = (videoTrack as any).getCapabilities?.() || {};
            const constraints: any = { advanced: [] };

            // Log capabilities for debugging
            console.log('Camera capabilities:', capabilities);

            if (capabilities.focusMode?.includes('continuous')) {
              constraints.advanced.push({ focusMode: 'continuous' });
            } else if (capabilities.focusMode?.includes('macro')) {
              constraints.advanced.push({ focusMode: 'macro' });
            }

            if (capabilities.zoom) {
              // Slight zoom can help with small barcodes
              const minZoom = capabilities.zoom.min || 1;
              const maxZoom = capabilities.zoom.max || 1;
              if (maxZoom > 1.2) {
                constraints.advanced.push({ zoom: 1.2 });
              }
            }

            if (capabilities.focusDistance) {
              // Try to set for close-up if available, usually 0 is closest
              constraints.advanced.push({ focusDistance: 0 });
            }

            if (constraints.advanced.length > 0) {
              await videoTrack.applyConstraints(constraints);
            }
          }
        } catch (e) {
          console.log('Could not apply focus constraints:', e);
        }
        
        setDebugInfo('Creating ZXing scanner with enhanced preprocessing...');
        const { DecodeHintType, BarcodeFormat } = await import('@zxing/library');

        // Define hints for multi-format reader to be more robust
        const hints = new Map();
        const formats = [
          BarcodeFormat.AZTEC,
          BarcodeFormat.CODABAR,
          BarcodeFormat.CODE_39,
          BarcodeFormat.CODE_93,
          BarcodeFormat.CODE_128,
          BarcodeFormat.DATA_MATRIX,
          BarcodeFormat.EAN_8,
          BarcodeFormat.EAN_13,
          BarcodeFormat.ITF,
          BarcodeFormat.MAXICODE,
          BarcodeFormat.PDF_417,
          BarcodeFormat.QR_CODE,
          BarcodeFormat.RSS_14,
          BarcodeFormat.RSS_EXPANDED,
          BarcodeFormat.UPC_A,
          BarcodeFormat.UPC_E,
          BarcodeFormat.UPC_EAN_EXTENSION
        ];
        hints.set(DecodeHintType.POSSIBLE_FORMATS, formats);
        hints.set(DecodeHintType.TRY_HARDER, true);
        
        // Create hidden canvas for frame capture and preprocessing
        const scanCanvas = document.createElement('canvas');
        const scanCtx = scanCanvas.getContext('2d');

        codeReaderRef.current = new BrowserMultiFormatReader(hints);
        detectedRef.current = false;
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
        streamRef.current.getTracks().forEach(track => {
          try {
            track.stop();
          } catch (e) {
            console.warn('Error stopping track in cleanup effect:', e);
          }
        });
      }
    };
  }, [isEnabled, onBarcodeScanned, refreshKey]);

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
        const capabilities = (videoTrack as any).getCapabilities?.() || {};
        if (capabilities.focusMode?.includes('continuous')) {
          videoTrack.applyConstraints({
            advanced: [{ focusMode: 'continuous' }]
          } as any).catch(err => console.log('Focus tap failed:', err));
        }
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
      {/* Debug header bar - only shown when needed */}
      {debugInfo.includes('error') && (
        <View style={styles.webHelpText}>
          <ThemedText style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>
            {debugInfo}
          </ThemedText>
        </View>
      )}

      {/* Video element with tap-to-focus */}
      <View 
        {...({ onClick: handleVideoTap } as any)}
        style={{ 
          width: '100%', 
          height: '100%', 
          cursor: 'pointer',
          position: 'absolute',
          top: 0,
          left: 0,
          zIndex: 1
        } as any}
      >
        <video 
          ref={videoRef as any}
          autoPlay
          muted
          playsInline
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            borderRadius: 12,
            backgroundColor: '#000',
            // Enhance contrast for better barcode detection in all lighting conditions
            filter: 'contrast(1.3) brightness(1.15) saturate(1.2)',
            WebkitFilter: 'contrast(1.3) brightness(1.15) saturate(1.2)'
          } as any}
        />
      </View>
      
      {/* Manual barcode input overlay - Higher zIndex */}
      <View style={[styles.manualInputContainer, { zIndex: 10 }]}>
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

      <View style={{ position: 'absolute', bottom: 80, left: 20, right: 20, gap: 10, zIndex: 5 }}>
        <View style={{ backgroundColor: 'rgba(0,0,0,0.6)', padding: 8, borderRadius: 6 }}>
          <ThemedText style={{ color: '#fff', fontSize: 10, textAlign: 'center' }}>
            {isScanning ? '🔍 Scanning vertical/angled barcodes' : '📷 Camera active'}
          </ThemedText>
        </View>
        <TouchableOpacity
          onPress={() => setRefreshKey(prev => prev + 1)}
          style={{ backgroundColor: 'rgba(46, 125, 50, 0.8)', padding: 8, borderRadius: 6, alignSelf: 'center' }}
        >
          <ThemedText style={{ color: '#fff', fontSize: 10, fontWeight: '700' }}>🔄 Reset Camera</ThemedText>
        </TouchableOpacity>
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
  const [evaluationResult, setEvaluationResult] = React.useState<EvaluationResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const [userFilters, setUserFilters] = React.useState<any>({});
  const scanningRef = useRef(false);

  const loadFilters = async () => {
    try {
      let savedData: string | null = null;
      if (Platform.OS === 'web') {
        if (typeof localStorage !== 'undefined') {
          savedData = localStorage.getItem('nutri-filters');
        }
      } else {
        const fileUri = FileSystem.documentDirectory ? FileSystem.documentDirectory + 'filters.txt' : null;
        if (fileUri) {
          const exists = await FileSystem.getInfoAsync(fileUri);
          if (exists.exists) {
            savedData = await FileSystem.readAsStringAsync(fileUri);
          }
        }
      }
      if (savedData) {
        const parsed = JSON.parse(savedData);
        setUserFilters(parsed);
        console.log('Filters loaded in Photo screen');
      }
    } catch (e) {
      console.log('Failed to load filters in Photo screen', e);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadFilters();
    }, [])
  );

  const fetchProductInfo = async (barcode: string) => {
    if (scanningRef.current) return; // Prevent multiple scans
    scanningRef.current = true;
    setIsScanning(true);
    setIsLoading(true);
    setEvaluationResult(null);

    try {
      console.log(`🔍 Starting product lookup for barcode: ${barcode}`);
      // 1. Fetch from Open Food Facts
      const response = await fetch(`https://world.openfoodfacts.org/api/v2/product/${barcode}.json`);

      if (!response.ok) {
        if (response.status === 404) {
          setProductName('Product not found in Open Food Facts database');
          setScannedData(barcode);
          return;
        }
        throw new Error(`Open Food Facts API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      console.log('Open Food Facts response received');

      if (data.status === 1 && data.product) {
        const product = data.product;
        const name = product.product_name || 'Unknown Product';
        setScannedData(barcode);
        setProductName(name);

        // 3. Evaluate with Decision Tree Logic (Migrated from Python)
        try {
          // Re-load filters right before evaluation to ensure we have the absolute latest
          let latestFilters = userFilters;
          try {
            let savedData: string | null = null;
            if (Platform.OS === 'web') {
              if (typeof localStorage !== 'undefined') {
                savedData = localStorage.getItem('nutri-filters');
              }
            } else {
              const fileUri = FileSystem.documentDirectory ? FileSystem.documentDirectory + 'filters.txt' : null;
              if (fileUri) {
                const exists = await FileSystem.getInfoAsync(fileUri);
                if (exists.exists) {
                  savedData = await FileSystem.readAsStringAsync(fileUri);
                }
              }
            }
            if (savedData) {
              latestFilters = JSON.parse(savedData);
              setUserFilters(latestFilters);
            }
          } catch (e) {
            console.log('Error reloading filters for evaluation:', e);
          }

          const result = evaluateProductWithDecisionTree(product, latestFilters);
          setEvaluationResult(result);
        } catch (evalError: any) {
          console.error('Evaluation Error:', evalError);
          setEvaluationResult(`Failed to evaluate product: ${evalError.message}`);
        }

      } else {
        console.warn(`Product not found for barcode: ${barcode}`);
        setProductName('Product not found in database');
        setScannedData(barcode);
      }
    } catch (error: any) {
      console.error(`Error fetching product for ${barcode}:`, error);
      setProductName(`Error: ${error.message || 'Check connection'}`);
      setScannedData(barcode);
    } finally {
      setIsLoading(false);
      // Ensure scanning is reset after a delay
      const cleanupTimer = setTimeout(() => {
        setIsScanning(false);
        scanningRef.current = false;
        console.log('Scanner ready for next scan');
      }, 2500); // Wait 2.5 seconds before allowing another scan

      return () => clearTimeout(cleanupTimer);
    }
  };

  const handleClear = () => {
    setScannedData(null);
    setProductName(null);
    setEvaluationResult(null);
    setIsScanning(false);
    scanningRef.current = false;
    setIsLoading(false);
    setCameraEnabled(true);
  };

  const handleBarcodeScanned = ({ type, data }: { type: string; data: string }) => {
    console.log('Barcode detected!', type, data);
    if (!scanningRef.current && cameraEnabled) {
      console.log('Processing barcode...');
      setCameraEnabled(false);
      fetchProductInfo(data);
    } else {
      console.log('Scan blocked - cooldown active');
    }
  };

  useEffect(() => {
    const checkPermissions = async () => {
      if (Platform.OS !== 'web') {
        const { status } = await requestPermission();
        if (status !== 'granted') {
          console.warn('Camera permission not granted:', status);
        }
      }
    };
    checkPermissions();
  }, []);

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
        {!productName && (
          <View style={styles.cameraWrapper}>
            {Platform.OS === 'web' ? (
              // Web-specific camera
              <>
                <WebCamera
                  onBarcodeScanned={handleBarcodeScanned}
                  isEnabled={cameraEnabled && !scannedData}
                />

                {cameraEnabled && (
                  <>
                    {/* Always show scanning frame */}
                    <View style={styles.scanFrame} pointerEvents="none">
                      <View style={styles.scanCorner} />
                    </View>

                    {/* Status indicator */}
                    <View style={styles.statusBar} pointerEvents="none">
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
                        'aztec',
                        'codabar',
                        'code128',
                        'code39',
                        'code93',
                        'datamatrix',
                        'ean13',
                        'ean8',
                        'itf14',
                        'pdf417',
                        'qr',
                        'upc_a',
                        'upc_e',
                      ],
                    }}
                    onBarcodeScanned={handleBarcodeScanned}
                  />

                  {/* Always show scanning frame */}
                  <View style={styles.scanFrame} pointerEvents="none">
                    <View style={styles.scanCorner} />
                  </View>

                  {/* Status indicator */}
                  <View style={styles.statusBar} pointerEvents="none">
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
              <View style={styles.scanningOverlay} pointerEvents="none">
                <View style={styles.scanLine} />
                <ThemedText style={styles.scanningText}>Scanning barcode...</ThemedText>
              </View>
            )}
          </View>
        )}
        
        {/* Product Info Display */}
        {isLoading && (
          <View style={styles.scanResult}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <ThemedText style={styles.loadingText}>Loading product info...</ThemedText>
          </View>
        )}
        
        {!isLoading && productName && (
          <View style={styles.scanResultContainer}>
            <ScrollView style={styles.scanResult}>
              <ThemedText style={styles.scanResultTitle}>
                {productName.startsWith('Error:') || productName.includes('not found') ? 'Scan Result' : 'Product Found!'}
              </ThemedText>
              <ThemedText style={styles.productName}>{productName}</ThemedText>

              {evaluationResult ? (
                <View style={styles.summaryContainer}>
                  <ThemedText style={[
                    styles.summaryTitle, 
                    { color: evaluationResult.verdict === 'PASS' ? '#2E7D32' : evaluationResult.verdict === 'FAIL' ? '#C62828' : '#F57C00' }
                  ]}>
                    Evaluation: {evaluationResult.verdict} (Score: {evaluationResult.score})
                  </ThemedText>
                  
                  {evaluationResult.reasons.length > 0 ? (
                    evaluationResult.reasons.map((reason, idx) => (
                      <ThemedText key={idx} style={styles.summaryText}>• {reason}</ThemedText>
                    ))
                  ) : (
                    <ThemedText style={styles.summaryText}>This product appears to align with your current filters. No specific health suggestions were triggered.</ThemedText>
                  )}
                  
                  <ThemedText style={[styles.summaryText, { fontStyle: 'italic', marginTop: 10, fontSize: 10, color: '#666' }]}>
                    Note: This evaluation is based on automated rule checks and may not be medically accurate.
                  </ThemedText>
                  
                  {evaluationResult.missing_data.length > 0 && (
                    <ThemedText style={[styles.summaryText, { fontStyle: 'italic', marginTop: 5, fontSize: 12 }]}>
                      Missing info for: {evaluationResult.missing_data.join(', ')}
                    </ThemedText>
                  )}
                </View>
              ) : (
                productName !== 'Product not found in database' && 
                productName !== 'Product not found in Open Food Facts database' && 
                !productName.startsWith('Error:') && (
                  <View style={{ marginVertical: 10, alignItems: 'center' }}>
                    <ActivityIndicator size="small" color="#2E7D32" />
                    <ThemedText style={{ fontSize: 12, marginTop: 5, color: '#666' }}>Evaluating product...</ThemedText>
                  </View>
                )
              )}

              <ThemedText style={styles.barcodeText}>Barcode: {scannedData}</ThemedText>
              <TouchableOpacity
                style={styles.clearButton}
                onPress={handleClear}
              >
                <ThemedText style={styles.clearButtonText}>Scan Another</ThemedText>
              </TouchableOpacity>
            </ScrollView>
          </View>
        )}
        
        {!productName && (
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => {
              if (cameraEnabled) {
                setCameraEnabled(false);
                // Force cleanup if turning off
                handleClear();
              } else {
                setCameraEnabled(true);
              }
            }}
          >
            <ThemedText style={styles.toggleButtonText}>
              {cameraEnabled ? 'Turn Off Camera' : 'Turn On Camera'}
            </ThemedText>
          </TouchableOpacity>
        )}
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
    backgroundColor: '#fff',
    padding: 15,
    borderRadius: 8,
    width: '100%',
    borderWidth: 2,
    borderColor: '#2E7D32',
  },
  scanResultContainer: {
    width: '90%',
    height: '80%',
    marginVertical: 20,
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
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
    marginTop: 15,
    alignSelf: 'center',
  },
  clearButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  summaryContainer: {
    backgroundColor: '#f1f8e9',
    padding: 15,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#2E7D32',
    marginVertical: 10,
  },
  summaryTitle: {
    color: '#1B5E20',
    fontWeight: '700',
    fontSize: 16,
    marginBottom: 5,
  },
  summaryText: {
    color: '#333',
    fontSize: 15,
    lineHeight: 22,
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
