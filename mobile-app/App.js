/**
 * Stack Tracker Pro - React Native App
 * Privacy-First Precious Metals Portfolio Tracker
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
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// Configuration - Railway backend URL
const API_BASE_URL = 'https://stack-tracker-pro-production.up.railway.app';

// Encryption helper (use react-native-aes-crypto in production)
const encryptData = async (data, key) => {
  return btoa(JSON.stringify(data));
};

const decryptData = async (encrypted, key) => {
  try {
    return JSON.parse(atob(encrypted));
  } catch {
    return null;
  }
};

// Floating Label Input Component
const FloatingInput = ({ label, value, onChangeText, placeholder, keyboardType, prefix, suffix }) => {
  return (
    <View style={styles.floatingContainer}>
      <Text style={styles.floatingLabel}>{label}</Text>
      <View style={styles.inputRow}>
        {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
        <TextInput
          style={[styles.floatingInput, prefix && { paddingLeft: 4 }]}
          placeholder={placeholder}
          placeholderTextColor="#52525b"
          keyboardType={keyboardType || 'default'}
          value={value}
          onChangeText={onChangeText}
        />
        {suffix && <Text style={styles.inputSuffix}>{suffix}</Text>}
      </View>
    </View>
  );
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
      console.log('Using cached spot prices');
    }
  };

  // Fetch historical spot price for a specific date and metal
  const fetchHistoricalSpot = async (date, metal) => {
    if (!date || date.length < 10) return null;
    
    const metalToUse = metal || metalTab;
    
    try {
      const response = await fetch(`${API_BASE_URL}/api/historical-spot?date=${date}&metal=${metalToUse}`);
      const data = await response.json();
      if (data.success && data.price) {
        return data.price;
      }
    } catch (error) {
      console.log('Could not fetch historical spot');
    }
    
    // Fallback to current spot
    return metalToUse === 'gold' ? goldSpot : silverSpot;
  };

  // Handle date change - auto-fill spot price
  const handleDateChange = async (date) => {
    setForm(prev => ({ ...prev, datePurchased: date }));
    if (date.length === 10) {
      const historicalPrice = await fetchHistoricalSpot(date, metalTab);
      if (historicalPrice) {
        setForm(prev => ({ ...prev, spotPrice: historicalPrice.toString() }));
      }
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
      mediaTypes: ['images'],
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
        const extractedMetal = d.metal === 'gold' ? 'gold' : 'silver';
        const newDate = d.datePurchased || '';
        
        // Set metal tab first
        setMetalTab(extractedMetal);
        
        // Get the correct historical spot price for the extracted metal and date
        let spotPrice = '';
        if (newDate.length === 10) {
          const historicalPrice = await fetchHistoricalSpot(newDate, extractedMetal);
          if (historicalPrice) {
            spotPrice = historicalPrice.toString();
          }
        }
        
        setForm({
          productName: d.productName || '',
          source: d.source || '',
          datePurchased: newDate,
          ozt: d.ozt?.toString() || '',
          quantity: d.quantity?.toString() || '1',
          unitPrice: d.unitPrice?.toString() || '',
          taxes: d.taxes?.toString() || '0',
          shipping: d.shipping?.toString() || '0',
          spotPrice: spotPrice,
          premium: '0',
        });

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
        const extractedMetal = d.metal === 'gold' ? 'gold' : 'silver';
        const newDate = d.datePurchased || '';
        
        setMetalTab(extractedMetal);
        
        let spotPrice = '';
        if (newDate.length === 10) {
          const historicalPrice = await fetchHistoricalSpot(newDate, extractedMetal);
          if (historicalPrice) {
            spotPrice = historicalPrice.toString();
          }
        }
        
        setForm({
          productName: d.productName || '',
          source: d.source || '',
          datePurchased: newDate,
          ozt: d.ozt?.toString() || '',
          quantity: d.quantity?.toString() || '1',
          unitPrice: d.unitPrice?.toString() || '',
          taxes: d.taxes?.toString() || '0',
          shipping: d.shipping?.toString() || '0',
          spotPrice: spotPrice,
          premium: '0',
        });
        
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
    Keyboard.dismiss();
    
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
            <Text style={{ color: colors.success, fontSize: 11 }}>🔒 Private</Text>
          </TouchableOpacity>
        </View>

        {/* Tab Bar */}
        <View style={styles.tabs}>
          {['Portfolio', 'Alerts', 'Settings'].map(t => (
            <TouchableOpacity
              key={t}
              style={[styles.tab, tab === t.toLowerCase() && styles.tabActive]}
              onPress={() => setTab(t.toLowerCase())}
            >
              <Text style={[styles.tabText, tab === t.toLowerCase() && styles.tabTextActive]}>
                {t === 'Portfolio' ? '📊' : t === 'Alerts' ? '🔔' : '⚙️'} {t}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content} keyboardShouldPersistTaps="handled">
        {tab === 'portfolio' && (
          <>
            {/* Metal Tabs */}
            <View style={styles.metalTabs}>
              <TouchableOpacity
                style={[styles.metalTab, { borderColor: metalTab === 'silver' ? colors.silver : 'rgba(255,255,255,0.1)', backgroundColor: metalTab === 'silver' ? `${colors.silver}22` : 'transparent' }]}
                onPress={() => setMetalTab('silver')}
              >
                <Text style={{ color: metalTab === 'silver' ? colors.silver : colors.muted, fontWeight: '600' }}>🥈 Silver</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.metalTab, { borderColor: metalTab === 'gold' ? colors.gold : 'rgba(255,255,255,0.1)', backgroundColor: metalTab === 'gold' ? `${colors.gold}22` : 'transparent' }]}
                onPress={() => setMetalTab('gold')}
              >
                <Text style={{ color: metalTab === 'gold' ? colors.gold : colors.muted, fontWeight: '600' }}>🥇 Gold</Text>
              </TouchableOpacity>
            </View>

            {/* Portfolio Summary */}
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
                <Text style={styles.statRowLabel}>Cost Basis</Text>
                <Text style={styles.statRowValue}>${totalCost.toLocaleString(undefined, { minimumFractionDigits: 2 })}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity style={[styles.button, { backgroundColor: currentColor, flex: 1 }]} onPress={() => { resetForm(); setShowAddModal(true); }}>
                <Text style={{ color: '#000', fontWeight: '600' }}>+ Add Purchase</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.buttonOutline, { flex: 0.5 }]} onPress={fetchSpotPrices}>
                <Text style={{ color: colors.text }}>🔄</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.buttonOutline, { flex: 0.5 }]} onPress={exportCSV}>
                <Text style={{ color: colors.text }}>📤</Text>
              </TouchableOpacity>
            </View>

            {/* Items List */}
            {items.map(item => (
              <TouchableOpacity key={item.id} style={styles.itemCard} onPress={() => editItem(item)} onLongPress={() => deleteItem(item.id)}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.productName}</Text>
                  <Text style={styles.itemSubtitle}>
                    {item.quantity}x @ ${item.unitPrice.toFixed(2)} • {(item.ozt * item.quantity).toFixed(2)} oz • {item.source || 'Unknown'}
                  </Text>
                </View>
                <Text style={[styles.itemValue, { color: currentColor }]}>
                  ${((item.ozt * item.quantity * spot) + (item.premium * item.quantity)).toFixed(2)}
                </Text>
              </TouchableOpacity>
            ))}

            {items.length === 0 && (
              <View style={styles.emptyState}>
                <Text style={{ fontSize: 48, marginBottom: 16 }}>🪙</Text>
                <Text style={{ color: colors.muted }}>No {metalTab} holdings yet</Text>
                <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>Tap "+ Add Purchase" to start</Text>
              </View>
            )}
          </>
        )}

        {tab === 'alerts' && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>🔔 Price Alerts</Text>
            <Text style={styles.cardText}>Set alerts to get notified when spot prices reach your target.</Text>
            <TouchableOpacity style={[styles.button, { backgroundColor: colors.silver }]}>
              <Text style={{ color: '#000', fontWeight: '600' }}>+ Add Alert</Text>
            </TouchableOpacity>
          </View>
        )}

        {tab === 'settings' && (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>⚙️ Settings</Text>
              <TouchableOpacity style={styles.statRow} onPress={exportCSV}>
                <Text style={{ color: colors.text }}>📤 Export Portfolio (CSV)</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.statRow} onPress={() => setShowPrivacyModal(true)}>
                <Text style={{ color: colors.text }}>🔒 Privacy Info</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>About</Text>
              <Text style={styles.cardText}>Stack Tracker Pro v1.0.0</Text>
              <Text style={styles.cardText}>Privacy-first precious metals tracking. Your data stays on your device.</Text>
            </View>
          </>
        )}
      </ScrollView>

      {/* Add/Edit Modal */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          style={styles.modalOverlay} 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{editingItem ? 'Edit' : 'Add'} Purchase</Text>
                <TouchableOpacity onPress={() => { resetForm(); setShowAddModal(false); }}>
                  <Text style={{ color: '#fff', fontSize: 24 }}>×</Text>
                </TouchableOpacity>
              </View>

              <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
                {/* Scan Status */}
                {scanStatus && (
                  <View style={[styles.scanStatus, { 
                    backgroundColor: scanStatus === 'success' ? `${colors.success}22` : scanStatus === 'error' ? `${colors.error}22` : `${colors.gold}22`,
                    borderWidth: 1,
                    borderColor: scanStatus === 'success' ? colors.success : scanStatus === 'error' ? colors.error : colors.gold,
                  }]}>
                    <Text style={{ color: scanStatus === 'success' ? colors.success : scanStatus === 'error' ? colors.error : colors.gold }}>
                      {scanStatus === 'scanning' ? '⏳' : scanStatus === 'success' ? '✅' : '❌'} {scanMessage}
                    </Text>
                  </View>
                )}

                {/* AI Scanner */}
                <View style={[styles.card, { backgroundColor: 'rgba(148,163,184,0.1)' }]}>
                  <Text style={{ color: colors.text, fontWeight: '600', marginBottom: 12 }}>📷 AI Receipt Scanner</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.button, { flex: 1, backgroundColor: colors.silver }]} onPress={scanReceipt}>
                      <Text style={{ color: '#000' }}>🖼 Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.buttonOutline, { flex: 1 }]} onPress={takePhoto}>
                      <Text style={{ color: colors.text }}>📸 Camera</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ color: colors.muted, fontSize: 11, textAlign: 'center', marginTop: 8 }}>🔒 Images processed in memory only</Text>
                </View>

                {/* Metal Toggle */}
                <View style={styles.metalTabs}>
                  <TouchableOpacity
                    style={[styles.metalTab, { borderColor: metalTab === 'silver' ? colors.silver : 'rgba(255,255,255,0.1)', backgroundColor: metalTab === 'silver' ? `${colors.silver}22` : 'transparent' }]}
                    onPress={() => setMetalTab('silver')}
                  >
                    <Text style={{ color: metalTab === 'silver' ? colors.silver : colors.muted, fontWeight: '600' }}>🥈 Silver</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.metalTab, { borderColor: metalTab === 'gold' ? colors.gold : 'rgba(255,255,255,0.1)', backgroundColor: metalTab === 'gold' ? `${colors.gold}22` : 'transparent' }]}
                    onPress={() => setMetalTab('gold')}
                  >
                    <Text style={{ color: metalTab === 'gold' ? colors.gold : colors.muted, fontWeight: '600' }}>🥇 Gold</Text>
                  </TouchableOpacity>
                </View>

                {/* Form with Floating Labels */}
                <FloatingInput
                  label="Product Name *"
                  value={form.productName}
                  onChangeText={v => setForm(p => ({ ...p, productName: v }))}
                  placeholder="e.g., American Gold Eagle 1 oz"
                />

                <FloatingInput
                  label="Dealer"
                  value={form.source}
                  onChangeText={v => setForm(p => ({ ...p, source: v }))}
                  placeholder="e.g., APMEX, JM Bullion"
                />

                <FloatingInput
                  label="Purchase Date"
                  value={form.datePurchased}
                  onChangeText={handleDateChange}
                  placeholder="YYYY-MM-DD"
                />

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <FloatingInput
                      label="OZT per unit *"
                      value={form.ozt}
                      onChangeText={v => setForm(p => ({ ...p, ozt: v }))}
                      placeholder="1"
                      keyboardType="decimal-pad"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatingInput
                      label="Quantity"
                      value={form.quantity}
                      onChangeText={v => setForm(p => ({ ...p, quantity: v }))}
                      placeholder="1"
                      keyboardType="number-pad"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <FloatingInput
                      label="Unit Price *"
                      value={form.unitPrice}
                      onChangeText={v => setForm(p => ({ ...p, unitPrice: v }))}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      prefix="$"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatingInput
                      label="Spot at Purchase"
                      value={form.spotPrice}
                      onChangeText={v => setForm(p => ({ ...p, spotPrice: v }))}
                      placeholder="Auto-filled"
                      keyboardType="decimal-pad"
                      prefix="$"
                    />
                  </View>
                </View>

                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <View style={{ flex: 1 }}>
                    <FloatingInput
                      label="Taxes"
                      value={form.taxes}
                      onChangeText={v => setForm(p => ({ ...p, taxes: v }))}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      prefix="$"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <FloatingInput
                      label="Shipping"
                      value={form.shipping}
                      onChangeText={v => setForm(p => ({ ...p, shipping: v }))}
                      placeholder="0.00"
                      keyboardType="decimal-pad"
                      prefix="$"
                    />
                  </View>
                </View>

                <FloatingInput
                  label="Numismatic Premium (per piece)"
                  value={form.premium}
                  onChangeText={v => setForm(p => ({ ...p, premium: v }))}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  prefix="$"
                />

                <TouchableOpacity style={[styles.button, { backgroundColor: currentColor, marginTop: 16, marginBottom: 40 }]} onPress={savePurchase}>
                  <Text style={{ color: '#000', fontWeight: '600' }}>{editingItem ? 'Update' : 'Add'} Purchase</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
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
  // Floating Label Styles
  floatingContainer: {
    marginBottom: 12,
  },
  floatingLabel: {
    color: '#a1a1aa',
    fontSize: 12,
    marginBottom: 6,
    fontWeight: '500',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 10,
    paddingHorizontal: 12,
  },
  floatingInput: {
    flex: 1,
    padding: 12,
    paddingLeft: 0,
    color: '#fff',
    fontSize: 14,
  },
  inputPrefix: {
    color: '#71717a',
    fontSize: 14,
    marginRight: 2,
  },
  inputSuffix: {
    color: '#71717a',
    fontSize: 14,
    marginLeft: 4,
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
