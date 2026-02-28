import { CameraView, useCameraPermissions } from 'expo-camera';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Platform, ScrollView, StyleSheet, TextInput, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

// --- Decision Tree Evaluation (placeholder) ---
// This function will be replaced with the migrated Python logic.
// It evaluates a product from Open Food Facts against saved user filters.
function evaluateProductWithDecisionTree(product: any, userFilters: any): string {
  try {
    const text = (product.ingredients_text || '').toLowerCase();
    const labels: string[] = product.labels_tags || [];
    const nutriments = product.nutriments || {};

    const filters = userFilters || {};
    const allergies: string[] = Array.isArray(filters.allergies) ? filters.allergies : [];
    const diets: string[] = Array.isArray(filters.diets) ? filters.diets : [];
    const medical: string[] = Array.isArray(filters.medicalRestrictions) ? filters.medicalRestrictions : [];

    const warnings: string[] = [];
    const positives: string[] = [];

    // Allergies check: simple substring match against ingredients text
    allergies.forEach((a) => {
      const key = String(a).toLowerCase();
      if (key && text.includes(key)) {
        warnings.push(`Contains or may contain: ${a}`);
      }
    });

    // Diet checks (basic heuristics)
    const labelHas = (k: string) => labels.some((t) => String(t).toLowerCase().includes(k));

    if (diets.includes('Vegan')) {
      if (labelHas('vegan')) {
        positives.push('Labeled vegan');
      } else if (/milk|egg|honey|gelatin|whey|casein|lactose|butter|cheese|yogurt|cream|shellfish|fish|pork|beef|chicken/i.test(text)) {
        warnings.push('Not vegan-friendly (animal-derived ingredient found)');
      } else {
        positives.push('Likely vegan (no obvious animal ingredients)');
      }
    }

    if (diets.includes('Dairy-free')) {
      if (/milk|whey|casein|lactose|butter|cheese|yogurt|cream/i.test(text)) {
        warnings.push('Contains dairy');
      } else {
        positives.push('No obvious dairy ingredients');
      }
    }

    if (diets.includes('Gluten-free')) {
      if (/wheat|barley|rye|malt|spelt|semolina|farro|triticale|bulgur/i.test(text)) {
        warnings.push('Contains gluten sources');
      } else {
        positives.push('No obvious gluten sources');
      }
    }

    if (diets.includes('Keto')) {
      const carbs = Number(nutriments.carbohydrates_100g ?? nutriments.carbs_100g ?? nutriments.carbohydrates);
      if (!Number.isNaN(carbs)) {
        if (carbs <= 10) positives.push(`Low carb (~${carbs}/100g)`);
        else warnings.push(`Higher carbs for keto (~${carbs}/100g)`);
      }
    }

    if (diets.includes('High-Protein')) {
      const protein = Number(nutriments.proteins_100g ?? nutriments.protein_100g ?? nutriments.proteins);
      if (!Number.isNaN(protein)) {
        if (protein >= 15) positives.push(`High protein (~${protein}/100g)`);
        else warnings.push(`Lower protein (~${protein}/100g)`);
      }
    }

    // General health heuristics
    const sugar = Number(nutriments.sugars_100g ?? nutriments.sugar_100g ?? nutriments.sugars);
    if (!Number.isNaN(sugar)) {
      if (sugar >= 15) warnings.push(`High sugar (~${sugar}/100g)`);
      else if (sugar <= 5) positives.push(`Low sugar (~${sugar}/100g)`);
    }
    const satFat = Number(nutriments['saturated-fat_100g'] ?? nutriments.saturated_fat_100g ?? nutriments.saturated_fat);
    if (!Number.isNaN(satFat) && satFat >= 5) warnings.push(`Higher saturated fat (~${satFat}/100g)`);
    const salt = Number(nutriments.salt_100g ?? nutriments.sodium_100g);
    if (!Number.isNaN(salt) && salt >= 1.5) warnings.push(`High salt (~${salt}/100g)`);

    // Add common additive flags
    if (/high[- ]?fructose corn syrup|hfcs/i.test(text)) warnings.push('Contains high-fructose corn syrup');
    if (/aspartame|sucralose|acesulfame|saccharin|stevia/i.test(text)) warnings.push('Contains artificial/alternative sweeteners');
    if (/canola oil|soybean oil|corn oil|sunflower oil|safflower oil|cottonseed oil|grapeseed oil/i.test(text)) warnings.push('Contains seed oils');

    // Score and outcome
    const score = (positives.length * 2) - (warnings.length * 3);
    let verdict = 'Neutral choice';
    if (score <= -3) verdict = 'Avoid';
    else if (score >= 3) verdict = 'Good choice';

    const bullets = [
      `Verdict: ${verdict}`,
      ...(positives.length ? ['Positives: ' + positives.join('; ')] : []),
      ...(warnings.length ? ['Warnings: ' + warnings.join('; ')] : []),
    ];

    return bullets.join('\n• ');
  } catch (e: any) {
    return `Evaluation error: ${e.message || 'unknown'}`;
  }
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
  const [evaluationResult, setEvaluationResult] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [isScanning, setIsScanning] = React.useState(false);
  const scanningRef = useRef(false);

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
        setProductName(name);
        setScannedData(barcode);

        // 2. Read User Filters
        let userFilters = {};
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
            userFilters = JSON.parse(savedData);
          }
        } catch (e) {
          console.log('No filters found or failed to read filters', e);
        }

        // 3. Evaluate with Decision Tree Logic (Migrated from Python)
        // For now, this is a placeholder until the user provides the Python logic
        try {
          // Placeholder implementation
          const result = evaluateProductWithDecisionTree(product, userFilters);
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
                  <ThemedText style={styles.summaryTitle}>Health Evaluation:</ThemedText>
                  <ThemedText style={styles.summaryText}>{evaluationResult}</ThemedText>
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
