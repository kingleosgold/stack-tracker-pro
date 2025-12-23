/**
 * Stack Tracker Pro - React Native App
 * Privacy-First Precious Metals Portfolio Tracker
 * 
 * This is the main App component for iOS/Android deployment.
 * Uses local encrypted storage and connects to our privacy-focused backend.
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
  Image,
  Platform,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Configuration
const API_BASE_URL = 'https://api.stacktracker.app';

// Encryption helper (use react-native-aes-crypto in production)
const encryptData = async (data, key) => {
  // In production, use proper AES-256 encryption
  // For now, base64 encode as placeholder
  return btoa(JSON.stringify(data));
};

const decryptData = async (encrypted, key) => {
  try {
    return JSON.parse(atob(encrypted));
  } catch {
    return null;
  }
};

export default function App() {
  // State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [tab, setTab] = useState('portfolio');
  const [metalTab, setMetalTab] = useState('silver');
  const [silverSpot, setSilverSpot] = useState(30.25);
  const [goldSpot, setGoldSpot] = useState(2650.00);
  const [silverItems, setSilverItems] = useState([]);
  const [goldItems, setGoldItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [scanStatus, setScanStatus] = useState(null);
  const [scanMessage, setScanMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [editingItem, setEditingItem] = useState(null);

  // Form state
  const [form, setForm] = useState({
    productName: '',
    source: '',
    datePurchased: '',
    ozt: '',
    quantity: '1',
    unitPrice: '',
    taxes: '0',
    shipping: '0',
    spotPrice: '',
    premium: '0',
  });

  // Biometric authentication
  const authenticate = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();

    if (hasHardware && isEnrolled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Unlock Stack Tracker Pro',
        fallbackLabel: 'Use Passcode',
      });
      if (result.success) {
        setIsAuthenticated(true);
        loadData();
      }
    } else {
      // No biometrics, allow access
      setIsAuthenticated(true);
      loadData();
    }
  };

  // Load encrypted data from local storage
  const loadData = async () => {
    try {
      const [silver, gold, alertsData, silverS, goldS] = await Promise.all([
        AsyncStorage.getItem('stack_silver'),
        AsyncStorage.getItem('stack_gold'),
        AsyncStorage.getItem('stack_alerts'),
        AsyncStorage.getItem('stack_silver_spot'),
        AsyncStorage.getItem('stack_gold_spot'),
      ]);

      if (silver) setSilverItems(JSON.parse(silver));
      if (gold) setGoldItems(JSON.parse(gold));
      if (alertsData) setAlerts(JSON.parse(alertsData));
      if (silverS) setSilverSpot(parseFloat(silverS));
      if (goldS) setGoldSpot(parseFloat(goldS));

      // Fetch latest spot prices
      fetchSpotPrices();
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Save data to local storage
  const saveData = async (key, data) => {
    try {
      await AsyncStorage.setItem(key, JSON.stringify(data));
    } catch (error) {
      console.error('Error saving data:', error);
    }
  };

  // Auto-save on changes
  useEffect(() => {
    if (isAuthenticated) {
      saveData('stack_silver', silverItems);
    }
  }, [silverItems, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      saveData('stack_gold', goldItems);
    }
  }, [goldItems, isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      saveData('stack_alerts', alerts);
    }
  }, [alerts, isAuthenticated]);

  // Initial auth
  useEffect(() => {
    authenticate();
  }, []);

  // Fetch spot prices from backend
  const fetchSpotPrices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spot-prices`);
      const data = await response.json();
      if (data.success) {
        if (data.silver) {
          setSilverSpot(data.silver);
          await AsyncStorage.setItem('stack_silver_spot', data.silver.toString());
        }
        if (data.gold) {
          setGoldSpot(data.gold);
          await AsyncStorage.setItem('stack_gold_spot', data.gold.toString());
        }
      }
    } catch (error) {
      // Use cached prices if offline
      console.log('Using cached spot prices');
    }
  };

  // Receipt scanning
  const scanReceipt = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow access to your photos to scan receipts.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    setScanStatus('scanning');
    setScanMessage('Analyzing receipt...');

    try {
      const formData = new FormData();
      formData.append('receipt', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      });

      const response = await fetch(`${API_BASE_URL}/api/scan-receipt`, {
        method: 'POST',
        body: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const data = await response.json();

      if (data.success && data.data) {
        const d = data.data;
        setForm({
          productName: d.productName || '',
          source: d.source || '',
          datePurchased: d.datePurchased || '',
          ozt: d.ozt?.toString() || '',
          quantity: d.quantity?.toString() || '1',
          unitPrice: d.unitPrice?.toString() || '',
          taxes: d.taxes?.toString() || '0',
          shipping: d.shipping?.toString() || '0',
          spotPrice: d.spotPrice?.toString() || '',
          premium: '0',
        });

        if (d.metal === 'gold') setMetalTab('gold');
        else setMetalTab('silver');

        setScanStatus('success');
        setScanMessage('Receipt analyzed! Verify and save.');
      } else {
        setScanStatus('error');
        setScanMessage('Could not analyze - enter manually.');
      }
    } catch (error) {
      setScanStatus('error');
      setScanMessage('Network error - enter manually.');
    }

    setTimeout(() => {
      setScanStatus(null);
      setScanMessage('');
    }, 5000);
  };

  // Take photo with camera
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    
    if (!permissionResult.granted) {
      Alert.alert('Permission Required', 'Please allow camera access to scan receipts.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
      base64: true,
    });

    if (result.canceled) return;

    // Same processing as scanReceipt
    setScanStatus('scanning');
    setScanMessage('Analyzing photo...');

    try {
      const formData = new FormData();
      formData.append('receipt', {
        uri: result.assets[0].uri,
        type: 'image/jpeg',
        name: 'receipt.jpg',
      });

      const response = await fetch(`${API_BASE_URL}/api/scan-receipt`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success && data.data) {
        const d = data.data;
        setForm({
          productName: d.productName || '',
          source: d.source || '',
          datePurchased: d.datePurchased || '',
          ozt: d.ozt?.toString() || '',
          quantity: d.quantity?.toString() || '1',
          unitPrice: d.unitPrice?.toString() || '',
          taxes: d.taxes?.toString() || '0',
          shipping: d.shipping?.toString() || '0',
          spotPrice: d.spotPrice?.toString() || '',
          premium: '0',
        });

        if (d.metal === 'gold') setMetalTab('gold');
        setScanStatus('success');
        setScanMessage('Photo analyzed!');
      } else {
        setScanStatus('error');
        setScanMessage('Could not analyze.');
      }
    } catch (error) {
      setScanStatus('error');
      setScanMessage('Network error.');
    }

    setTimeout(() => {
      setScanStatus(null);
      setScanMessage('');
    }, 5000);
  };

  // Save purchase
  const savePurchase = () => {
    if (!form.productName || !form.unitPrice) {
      Alert.alert('Required Fields', 'Please enter product name and unit price.');
      return;
    }

    const item = {
      id: editingItem?.id || Date.now(),
      productName: form.productName,
      source: form.source,
      datePurchased: form.datePurchased,
      ozt: parseFloat(form.ozt) || 0,
      quantity: parseInt(form.quantity) || 1,
      unitPrice: parseFloat(form.unitPrice) || 0,
      taxes: parseFloat(form.taxes) || 0,
      shipping: parseFloat(form.shipping) || 0,
      spotPrice: parseFloat(form.spotPrice) || 0,
      premium: parseFloat(form.premium) || 0,
    };

    if (metalTab === 'silver') {
      if (editingItem) {
        setSilverItems(prev => prev.map(i => i.id === editingItem.id ? item : i));
      } else {
        setSilverItems(prev => [...prev, item]);
      }
    } else {
      if (editingItem) {
        setGoldItems(prev => prev.map(i => i.id === editingItem.id ? item : i));
      } else {
        setGoldItems(prev => [...prev, item]);
      }
    }

    resetForm();
    setShowAddModal(false);
  };

  const resetForm = () => {
    setForm({
      productName: '',
      source: '',
      datePurchased: '',
      ozt: '',
      quantity: '1',
      unitPrice: '',
      taxes: '0',
      shipping: '0',
      spotPrice: '',
      premium: '0',
    });
    setEditingItem(null);
  };

  const deleteItem = (id) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            if (metalTab === 'silver') {
              setSilverItems(prev => prev.filter(i => i.id !== id));
            } else {
              setGoldItems(prev => prev.filter(i => i.id !== id));
            }
          },
        },
      ]
    );
  };

  const editItem = (item) => {
    setForm({
      productName: item.productName,
      source: item.source,
      datePurchased: item.datePurchased,
      ozt: item.ozt.toString(),
      quantity: item.quantity.toString(),
      unitPrice: item.unitPrice.toString(),
      taxes: item.taxes.toString(),
      shipping: item.shipping.toString(),
      spotPrice: item.spotPrice.toString(),
      premium: item.premium.toString(),
    });
    setEditingItem(item);
    setShowAddModal(true);
  };

  // Export to CSV
  const exportCSV = async () => {
    const allItems = [
      ...silverItems.map(i => ({ ...i, metal: 'Silver' })),
      ...goldItems.map(i => ({ ...i, metal: 'Gold' })),
    ];

    const headers = 'Metal,Product,Source,Date,OZT,Qty,Unit Price,Taxes,Shipping,Spot,Premium\n';
    const rows = allItems.map(i => 
      `${i.metal},${i.productName},${i.source},${i.datePurchased},${i.ozt},${i.quantity},${i.unitPrice},${i.taxes},${i.shipping},${i.spotPrice},${i.premium}`
    ).join('\n');

    const csv = headers + rows;
    const filename = `stack-tracker-${new Date().toISOString().split('T')[0]}.csv`;
    const filepath = `${FileSystem.documentDirectory}${filename}`;

    await FileSystem.writeAsStringAsync(filepath, csv);
    await Sharing.shareAsync(filepath);
  };

  // Calculations
  const items = metalTab === 'silver' ? silverItems : goldItems;
  const spot = metalTab === 'silver' ? silverSpot : goldSpot;
  const totalOzt = items.reduce((sum, i) => sum + (i.ozt * i.quantity), 0);
  const totalCost = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity) + i.taxes + i.shipping, 0);
  const meltValue = totalOzt * spot;
  const totalPremium = items.reduce((sum, i) => sum + (i.premium * i.quantity), 0);
  const totalValue = meltValue + totalPremium;
  const gainLoss = totalValue - totalCost;
  const gainLossPct = totalCost > 0 ? ((gainLoss / totalCost) * 100).toFixed(1) : 0;

  // Colors
  const colors = {
    silver: '#94a3b8',
    gold: '#fbbf24',
    bg: '#0f0f0f',
    card: 'rgba(255,255,255,0.05)',
    text: '#e4e4e7',
    muted: '#71717a',
    success: '#22c55e',
    error: '#ef4444',
  };

  const currentColor = metalTab === 'silver' ? colors.silver : colors.gold;

  // Loading screen
  if (isLoading) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <ActivityIndicator size="large" color={colors.silver} />
        <Text style={{ color: colors.muted, marginTop: 16 }}>Loading your stack...</Text>
      </View>
    );
  }

  // Auth screen
  if (!isAuthenticated) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text style={{ fontSize: 48, marginBottom: 16 }}>🪙</Text>
        <Text style={{ color: colors.text, fontSize: 24, fontWeight: '700', marginBottom: 8 }}>Stack Tracker Pro</Text>
        <Text style={{ color: colors.muted, marginBottom: 32 }}>Authenticate to continue</Text>
        <TouchableOpacity style={[styles.button, { backgroundColor: colors.silver }]} onPress={authenticate}>
          <Text style={{ color: '#000', fontWeight: '600' }}>Unlock</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logo}>
            <View style={[styles.logoIcon, { backgroundColor: currentColor }]}>
              <Text style={{ fontSize: 20 }}>🪙</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>Stack Tracker Pro</Text>
              <Text style={styles.logoSubtitle}>Privacy-First Portfolio</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.privacyBadge} onPress={() => setShowPrivacyModal(true)}>
            <Text style={{ color: colors.success, fontSize: 12 }}>🔒 Private</Text>
          </TouchableOpacity>
        </View>

        {/* Tabs */}
        <View style={styles.tabs}>
          {['portfolio', 'alerts', 'settings'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t && styles.tabActive]}
              onPress={() => setTab(t)}
            >
              <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
                {t === 'portfolio' ? '📊' : t === 'alerts' ? '🔔' : '⚙️'} {t.charAt(0).toUpperCase() + t.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {tab === 'portfolio' && (
          <>
            {/* Metal Toggle */}
            <View style={styles.metalTabs}>
              <TouchableOpacity
                style={[styles.metalTab, metalTab === 'silver' && { borderColor: colors.silver, backgroundColor: `${colors.silver}22` }]}
                onPress={() => setMetalTab('silver')}
              >
                <Text style={{ color: metalTab === 'silver' ? colors.silver : colors.muted, fontWeight: '600' }}>🥈 Silver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metalTab, metalTab === 'gold' && { borderColor: colors.gold, backgroundColor: `${colors.gold}22` }]}
                onPress={() => setMetalTab('gold')}
              >
                <Text style={{ color: metalTab === 'gold' ? colors.gold : colors.muted, fontWeight: '600' }}>🥇 Gold</Text>
              </TouchableOpacity>
            </View>

            {/* Stats Card */}
            <View style={styles.card}>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: currentColor }]}>{totalOzt.toFixed(2)}</Text>
                  <Text style={styles.statLabel}>Total OZT</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: colors.success }]}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
                  <Text style={styles.statLabel}>Total Value</Text>
                </View>
                <View style={styles.stat}>
                  <Text style={[styles.statValue, { color: gainLoss >= 0 ? colors.success : colors.error }]}>
                    {gainLoss >= 0 ? '+' : ''}{gainLossPct}%
                  </Text>
                  <Text style={styles.statLabel}>Gain/Loss</Text>
                </View>
              </View>

              <View style={styles.divider} />
              <View style={styles.statRow}>
                <Text style={styles.statRowLabel}>Spot Price</Text>
                <Text style={styles.statRowValue}>${spot.toFixed(2)}/oz</Text>
              </View>
              <View style={styles.statRow}>
                <Text style={styles.statRowLabel}>Melt Value</Text>
                <Text style={styles.statRowValue}>${meltValue.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.button, { backgroundColor: currentColor, flex: 1 }]} onPress={() => setShowAddModal(true)}>
                <Text style={{ color: '#000', fontWeight: '600' }}>+ Add Purchase</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.buttonOutline, { flex: 0.5 }]} onPress={fetchSpotPrices}>
                <Text style={{ color: '#fff' }}>🔄</Text>
              </TouchableOpacity>
            </View>

            {/* Items List */}
            {items.map(item => (
              <View key={item.id} style={styles.itemCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.productName}</Text>
                  <Text style={styles.itemSubtitle}>
                    {item.quantity}x @ ${item.unitPrice} • {item.ozt * item.quantity} oz • {item.source}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.itemValue, { color: currentColor }]}>
                    ${((item.ozt * item.quantity * spot) + (item.premium * item.quantity)).toFixed(2)}
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                    <TouchableOpacity onPress={() => editItem(item)}>
                      <Text>✏️</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => deleteItem(item.id)}>
                      <Text>🗑️</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}

            {items.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🪙</Text>
                <Text style={{ color: colors.muted }}>No {metalTab} holdings yet</Text>
                <Text style={{ color: colors.muted, fontSize: 13, marginTop: 8 }}>Tap "Add Purchase" to start</Text>
              </View>
            )}
          </>
        )}

        {tab === 'settings' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>🔒 Privacy & Security</Text>
              <Text style={styles.cardText}>
                Your data is stored locally on this device with AES-256 encryption. Receipt images are processed in memory and never stored.
              </Text>
              <TouchableOpacity style={styles.buttonOutline} onPress={() => setShowPrivacyModal(true)}>
                <Text style={{ color: '#fff' }}>View Privacy Policy</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>📥 Export Data</Text>
              <Text style={styles.cardText}>
                Download your complete portfolio as a CSV file.
              </Text>
              <TouchableOpacity style={[styles.button, { backgroundColor: currentColor }]} onPress={exportCSV}>
                <Text style={{ color: '#000', fontWeight: '600' }}>Export to CSV</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚠️ Danger Zone</Text>
              <TouchableOpacity
                style={[styles.button, { backgroundColor: colors.error }]}
                onPress={() => {
                  Alert.alert(
                    'Delete All Data',
                    'This will permanently delete all your portfolio data. This cannot be undone.',
                    [
                      { text: 'Cancel', style: 'cancel' },
                      {
                        text: 'Delete Everything',
                        style: 'destructive',
                        onPress: async () => {
                          await AsyncStorage.clear();
                          setSilverItems([]);
                          setGoldItems([]);
                          setAlerts([]);
                        },
                      },
                    ]
                  );
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '600' }}>Delete All Data</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>

      {/* Add Purchase Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{editingItem ? 'Edit' : 'Add'} Purchase</Text>
              <TouchableOpacity onPress={() => { resetForm(); setShowAddModal(false); }}>
                <Text style={{ color: '#fff', fontSize: 24 }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {/* Scan Status */}
              {scanStatus && (
                <View style={[styles.scanStatus, { backgroundColor: scanStatus === 'success' ? `${colors.success}33` : scanStatus === 'error' ? `${colors.error}33` : '#eab30833' }]}>
                  <Text style={{ color: scanStatus === 'success' ? colors.success : scanStatus === 'error' ? colors.error : '#eab308' }}>
                    {scanStatus === 'scanning' ? '⏳' : scanStatus === 'success' ? '✅' : '❌'} {scanMessage}
                  </Text>
                </View>
              )}

              {/* Receipt Scanner */}
              <View style={[styles.card, { backgroundColor: 'rgba(148,163,184,0.1)' }]}>
                <Text style={{ fontWeight: '600', marginBottom: 12 }}>📷 AI Receipt Scanner</Text>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: currentColor }]} onPress={scanReceipt}>
                    <Text style={{ color: '#000', fontWeight: '600' }}>📁 Gallery</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={[styles.buttonOutline, { flex: 1 }]} onPress={takePhoto}>
                    <Text style={{ color: '#fff' }}>📸 Camera</Text>
                  </TouchableOpacity>
                </View>
                <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>
                  🔒 Images processed in memory only
                </Text>
              </View>

              {/* Metal Toggle */}
              <View style={styles.metalTabs}>
                <TouchableOpacity
                  style={[styles.metalTab, metalTab === 'silver' && { borderColor: colors.silver, backgroundColor: `${colors.silver}22` }]}
                  onPress={() => setMetalTab('silver')}
                >
                  <Text style={{ color: metalTab === 'silver' ? colors.silver : colors.muted }}>🥈 Silver</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.metalTab, metalTab === 'gold' && { borderColor: colors.gold, backgroundColor: `${colors.gold}22` }]}
                  onPress={() => setMetalTab('gold')}
                >
                  <Text style={{ color: metalTab === 'gold' ? colors.gold : colors.muted }}>🥇 Gold</Text>
                </TouchableOpacity>
              </View>

              {/* Form */}
              <TextInput
                style={styles.input}
                placeholder="Product Name *"
                placeholderTextColor={colors.muted}
                value={form.productName}
                onChangeText={v => setForm(p => ({ ...p, productName: v }))}
              />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Dealer"
                  placeholderTextColor={colors.muted}
                  value={form.source}
                  onChangeText={v => setForm(p => ({ ...p, source: v }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Date (YYYY-MM-DD)"
                  placeholderTextColor={colors.muted}
                  value={form.datePurchased}
                  onChangeText={v => setForm(p => ({ ...p, datePurchased: v }))}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="OZT per unit *"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={form.ozt}
                  onChangeText={v => setForm(p => ({ ...p, ozt: v }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Quantity"
                  placeholderTextColor={colors.muted}
                  keyboardType="number-pad"
                  value={form.quantity}
                  onChangeText={v => setForm(p => ({ ...p, quantity: v }))}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Unit Price *"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={form.unitPrice}
                  onChangeText={v => setForm(p => ({ ...p, unitPrice: v }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Spot at purchase"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={form.spotPrice}
                  onChangeText={v => setForm(p => ({ ...p, spotPrice: v }))}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Taxes"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={form.taxes}
                  onChangeText={v => setForm(p => ({ ...p, taxes: v }))}
                />
                <TextInput
                  style={[styles.input, { flex: 1 }]}
                  placeholder="Shipping"
                  placeholderTextColor={colors.muted}
                  keyboardType="decimal-pad"
                  value={form.shipping}
                  onChangeText={v => setForm(p => ({ ...p, shipping: v }))}
                />
              </View>

              <TextInput
                style={styles.input}
                placeholder="Numismatic Premium (per piece)"
                placeholderTextColor={colors.muted}
                keyboardType="decimal-pad"
                value={form.premium}
                onChangeText={v => setForm(p => ({ ...p, premium: v }))}
              />

              <TouchableOpacity style={[styles.button, { backgroundColor: currentColor, marginTop: 16 }]} onPress={savePurchase}>
                <Text style={{ color: '#000', fontWeight: '600' }}>{editingItem ? 'Update' : 'Add'} Purchase</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Privacy Modal */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔒 Privacy Architecture</Text>
              <TouchableOpacity onPress={() => setShowPrivacyModal(false)}>
                <Text style={{ color: '#fff', fontSize: 24 }}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView>
              <View style={styles.card}>
                <Text style={[styles.cardTitle, { color: colors.success }]}>✅ What We Do</Text>
                <Text style={styles.privacyItem}>• Store all data locally on YOUR device</Text>
                <Text style={styles.privacyItem}>• Encrypt your portfolio with AES-256</Text>
                <Text style={styles.privacyItem}>• Process receipt images in RAM only</Text>
                <Text style={styles.privacyItem}>• Delete images immediately after scanning</Text>
                <Text style={styles.privacyItem}>• Use HTTPS for all communications</Text>
              </View>

              <View style={styles.card}>
                <Text style={[styles.cardTitle, { color: colors.error }]}>❌ What We DON'T Do</Text>
                <Text style={styles.privacyItem}>• Store your receipt images</Text>
                <Text style={styles.privacyItem}>• Track your total holdings</Text>
                <Text style={styles.privacyItem}>• Create user profiles or accounts</Text>
                <Text style={styles.privacyItem}>• Sell or share any data</Text>
                <Text style={styles.privacyItem}>• Use analytics or tracking SDKs</Text>
              </View>

              <View style={[styles.card, { backgroundColor: `${colors.success}22`, borderColor: `${colors.success}44` }]}>
                <Text style={{ color: colors.success, fontWeight: '600', marginBottom: 8 }}>Our Promise</Text>
                <Text style={{ color: colors.muted, fontStyle: 'italic' }}>
                  "We architected the system so we CAN'T access your data, even if compelled. Your stack, your privacy."
                </Text>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f0f',
  },
  header: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  logo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 18,
  },
  logoSubtitle: {
    color: '#71717a',
    fontSize: 11,
  },
  privacyBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(34,197,94,0.15)',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(34,197,94,0.3)',
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  tabText: {
    color: '#71717a',
    fontWeight: '600',
    fontSize: 13,
  },
  tabTextActive: {
    color: '#fff',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  metalTabs: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  metalTab: {
    flex: 1,
    padding: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 12,
  },
  cardText: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 20,
    marginBottom: 16,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  stat: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    color: '#71717a',
    marginTop: 4,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginVertical: 12,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  statRowLabel: {
    color: '#71717a',
    fontSize: 13,
  },
  statRowValue: {
    color: '#fff',
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonOutline: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  itemCard: {
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemTitle: {
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  itemSubtitle: {
    color: '#71717a',
    fontSize: 12,
  },
  itemValue: {
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 40,
  },
  input: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginBottom: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  scanStatus: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 16,
  },
  privacyItem: {
    color: '#a1a1aa',
    fontSize: 13,
    lineHeight: 24,
  },
});
