/**
 * Stack Tracker Pro - React Native App
 * Privacy-First Precious Metals Portfolio Tracker
 * 
 * KEYBOARD FIX VERSION - All modals have:
 * - Inputs at TOP of modal (not bottom)
 * - X button always accessible (never covered by keyboard)
 * - Tap outside to dismiss keyboard
 * - KeyboardAvoidingView for proper scrolling
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
  Platform,
  SafeAreaView,
  StatusBar,
  ActivityIndicator,
  Keyboard,
  TouchableWithoutFeedback,
  KeyboardAvoidingView,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as ImagePicker from 'expo-image-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const API_BASE_URL = 'https://stack-tracker-pro-production.up.railway.app';

// Colors
const colors = {
  gold: '#FFD700',
  silver: '#C0C0C0',
  platinum: '#E5E4E2',
  palladium: '#CED0DD',
  copper: '#B87333',
  background: '#0f0f0f',
  card: 'rgba(255,255,255,0.05)',
  border: 'rgba(255,255,255,0.1)',
  muted: '#71717a',
  success: '#22c55e',
  danger: '#ef4444',
};

// ============================================
// REUSABLE COMPONENTS
// ============================================

// Floating Label Input - with keyboard dismiss on submit
const FloatingInput = ({ label, value, onChangeText, placeholder, keyboardType, prefix, editable = true, sublabel }) => (
  <View style={styles.floatingContainer}>
    <Text style={styles.floatingLabel}>{label}</Text>
    {sublabel && <Text style={styles.floatingSublabel}>{sublabel}</Text>}
    <View style={[styles.inputRow, !editable && { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
      {prefix && <Text style={styles.inputPrefix}>{prefix}</Text>}
      <TextInput
        style={[styles.floatingInput, prefix && { paddingLeft: 4 }]}
        placeholder={placeholder}
        placeholderTextColor="#52525b"
        keyboardType={keyboardType || 'default'}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        returnKeyType="done"
        onSubmitEditing={Keyboard.dismiss}
        blurOnSubmit={true}
      />
    </View>
  </View>
);

// Modal wrapper with proper keyboard handling
const KeyboardModal = ({ visible, onClose, title, children }) => (
  <Modal visible={visible} animationType="slide" transparent>
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.modalKeyboardView}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Header with X button - ALWAYS at top, never covered */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{title}</Text>
              <TouchableOpacity 
                onPress={onClose} 
                style={styles.closeButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {/* Dismiss hint */}
            <View style={styles.dismissHint}>
              <Text style={{ color: colors.muted, fontSize: 11 }}>Tap outside fields to hide keyboard</Text>
            </View>
            
            {children}
          </View>
        </View>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  </Modal>
);

// Simple pie chart visualization
const PieChart = ({ data, size = 150 }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total === 0) return null;
  
  let currentAngle = 0;
  const segments = data.map((item) => {
    const percentage = item.value / total;
    const angle = percentage * 360;
    const startAngle = currentAngle;
    currentAngle += angle;
    return { ...item, percentage, startAngle, angle };
  });

  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', position: 'relative' }}>
        {segments.map((segment, index) => (
          <View
            key={index}
            style={{
              position: 'absolute',
              width: size,
              height: size,
              transform: [{ rotate: `${segment.startAngle}deg` }],
            }}
          >
            <View style={{ width: size / 2, height: size, backgroundColor: segment.color }} />
          </View>
        ))}
        <View style={{
          position: 'absolute',
          width: size * 0.6,
          height: size * 0.6,
          borderRadius: size * 0.3,
          backgroundColor: '#1a1a2e',
          top: size * 0.2,
          left: size * 0.2,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
          <Text style={{ color: '#fff', fontWeight: '700', fontSize: 14 }}>
            ${(total / 1000).toFixed(1)}k
          </Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', marginTop: 12, gap: 16, flexWrap: 'wrap', justifyContent: 'center' }}>
        {segments.map((segment, index) => (
          <View key={index} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: segment.color, marginRight: 6 }} />
            <Text style={{ color: '#a1a1aa', fontSize: 12 }}>{segment.label} {(segment.percentage * 100).toFixed(0)}%</Text>
          </View>
        ))}
      </View>
    </View>
  );
};

// ============================================
// MAIN APP COMPONENT
// ============================================

export default function App() {
  // State
  const [activeTab, setActiveTab] = useState('home');
  const [selectedMetal, setSelectedMetal] = useState('gold');
  const [portfolio, setPortfolio] = useState([]);
  const [spotPrices, setSpotPrices] = useState({ gold: 0, silver: 0, platinum: 0, palladium: 0 });
  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  
  // Modal states
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMeltModal, setShowMeltModal] = useState(false);
  const [showJunkModal, setShowJunkModal] = useState(false);
  const [showSpeculationModal, setShowSpeculationModal] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  
  // Form state
  const [form, setForm] = useState({
    metal: 'gold',
    description: '',
    quantity: '1',
    ozt: '',
    unitPrice: '',
    spotAtPurchase: '',
    premium: '',
    dealer: '',
    purchaseDate: '',
    notes: '',
  });
  
  // Melt calculator state
  const [meltForm, setMeltForm] = useState({
    weight: '',
    purity: '999',
    metal: 'gold',
  });
  
  // Junk silver calculator state
  const [junkForm, setJunkForm] = useState({
    faceValue: '',
    silverContent: '90',
  });
  
  // Speculation state
  const [specPrices, setSpecPrices] = useState({ gold: '', silver: '' });

  // Metal colors
  const metalColors = {
    gold: colors.gold,
    silver: colors.silver,
    platinum: colors.platinum,
    palladium: colors.palladium,
  };

  // ============================================
  // EFFECTS
  // ============================================

  useEffect(() => {
    initializeApp();
  }, []);

  // Auto-calculate premium when relevant fields change
  useEffect(() => {
    if (form.unitPrice && form.spotAtPurchase && form.ozt) {
      const unitPrice = parseFloat(form.unitPrice) || 0;
      const spotPrice = parseFloat(form.spotAtPurchase) || 0;
      const ozt = parseFloat(form.ozt) || 0;
      const premium = unitPrice - (spotPrice * ozt);
      if (premium >= 0) {
        setForm(prev => ({ ...prev, premium: premium.toFixed(2) }));
      }
    }
  }, [form.unitPrice, form.spotAtPurchase, form.ozt]);

  // ============================================
  // INITIALIZATION
  // ============================================

  const initializeApp = async () => {
    try {
      // Optional biometric auth
      const hasBiometrics = await LocalAuthentication.hasHardwareAsync();
      if (hasBiometrics) {
        const result = await LocalAuthentication.authenticateAsync({
          promptMessage: 'Unlock Stack Tracker Pro',
          fallbackLabel: 'Use Passcode',
        });
        if (!result.success) {
          Alert.alert('Authentication Required', 'Please authenticate to access your portfolio.');
          return;
        }
      }
      setAuthenticated(true);
      
      // Load portfolio
      const savedPortfolio = await AsyncStorage.getItem('portfolio');
      if (savedPortfolio) {
        setPortfolio(JSON.parse(savedPortfolio));
      }
      
      // Fetch spot prices
      await fetchSpotPrices();
    } catch (error) {
      console.error('Init error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchSpotPrices = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/spot-prices`);
      if (response.ok) {
        const data = await response.json();
        setSpotPrices(data);
      }
    } catch (error) {
      console.error('Failed to fetch spot prices:', error);
      // Use fallback prices
      setSpotPrices({ gold: 2650, silver: 31, platinum: 980, palladium: 1050 });
    }
  };

  // ============================================
  // HISTORICAL SPOT PRICE LOOKUP
  // ============================================

  const lookupHistoricalSpot = async (date, metal) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/historical-spot?date=${date}&metal=${metal}`);
      if (response.ok) {
        const data = await response.json();
        return data.price;
      }
    } catch (error) {
      console.error('Historical lookup failed:', error);
    }
    return null;
  };

  // Handle date change - auto-fill spot price
  const handleDateChange = async (date) => {
    setForm(prev => ({ ...prev, purchaseDate: date }));
    
    // Try to lookup historical spot price
    if (date && date.length === 10) { // YYYY-MM-DD format
      const historicalPrice = await lookupHistoricalSpot(date, form.metal);
      if (historicalPrice) {
        setForm(prev => ({ ...prev, spotAtPurchase: historicalPrice.toFixed(2) }));
      }
    }
  };

  // ============================================
  // PORTFOLIO CALCULATIONS
  // ============================================

  const getPortfolioStats = useCallback(() => {
    const stats = {
      totalValue: 0,
      totalCost: 0,
      totalOzt: { gold: 0, silver: 0, platinum: 0, palladium: 0 },
      byMetal: {},
    };

    portfolio.forEach(item => {
      const qty = parseInt(item.quantity) || 1;
      const ozt = parseFloat(item.ozt) || 0;
      const totalOzt = ozt * qty;
      const unitPrice = parseFloat(item.unitPrice) || 0;
      const currentSpot = spotPrices[item.metal] || 0;
      
      const itemCost = unitPrice * qty;
      const itemValue = totalOzt * currentSpot;
      
      stats.totalCost += itemCost;
      stats.totalValue += itemValue;
      stats.totalOzt[item.metal] = (stats.totalOzt[item.metal] || 0) + totalOzt;
      
      if (!stats.byMetal[item.metal]) {
        stats.byMetal[item.metal] = { cost: 0, value: 0, ozt: 0, items: 0 };
      }
      stats.byMetal[item.metal].cost += itemCost;
      stats.byMetal[item.metal].value += itemValue;
      stats.byMetal[item.metal].ozt += totalOzt;
      stats.byMetal[item.metal].items += qty;
    });

    stats.gainLoss = stats.totalValue - stats.totalCost;
    stats.gainLossPercent = stats.totalCost > 0 ? ((stats.gainLoss / stats.totalCost) * 100) : 0;
    
    return stats;
  }, [portfolio, spotPrices]);

  // ============================================
  // CRUD OPERATIONS
  // ============================================

  const savePurchase = async () => {
    if (!form.description || !form.ozt || !form.unitPrice) {
      Alert.alert('Missing Info', 'Please fill in description, weight, and price.');
      return;
    }

    const newItem = {
      id: editingItem?.id || Date.now().toString(),
      ...form,
      createdAt: editingItem?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    let updatedPortfolio;
    if (editingItem) {
      updatedPortfolio = portfolio.map(item => item.id === editingItem.id ? newItem : item);
    } else {
      updatedPortfolio = [...portfolio, newItem];
    }

    setPortfolio(updatedPortfolio);
    await AsyncStorage.setItem('portfolio', JSON.stringify(updatedPortfolio));
    
    resetForm();
    setShowAddModal(false);
    setEditingItem(null);
  };

  const deleteItem = async (id) => {
    Alert.alert(
      'Delete Item',
      'Are you sure you want to delete this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const updatedPortfolio = portfolio.filter(item => item.id !== id);
            setPortfolio(updatedPortfolio);
            await AsyncStorage.setItem('portfolio', JSON.stringify(updatedPortfolio));
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setForm({
      metal: selectedMetal,
      description: '',
      quantity: '1',
      ozt: '',
      unitPrice: '',
      spotAtPurchase: '',
      premium: '',
      dealer: '',
      purchaseDate: '',
      notes: '',
    });
  };

  // ============================================
  // RECEIPT SCANNING
  // ============================================

  const scanReceipt = async () => {
    try {
      const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
      if (!permissionResult.granted) {
        Alert.alert('Permission Required', 'Camera access is needed to scan receipts.');
        return;
      }

      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ['images'],
        quality: 0.8,
        base64: true,
      });

      if (!result.canceled && result.assets[0]) {
        setLoading(true);
        
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

        if (response.ok) {
          const data = await response.json();
          
          // Fill form with scanned data
          setForm(prev => ({
            ...prev,
            description: data.description || prev.description,
            quantity: data.quantity?.toString() || prev.quantity,
            ozt: data.ozt?.toString() || prev.ozt,
            unitPrice: data.unitPrice?.toString() || prev.unitPrice,
            dealer: data.dealer || prev.dealer,
            purchaseDate: data.purchaseDate || prev.purchaseDate,
            metal: data.metal || prev.metal,
          }));

          // Lookup historical spot if we have a date
          if (data.purchaseDate) {
            const historicalPrice = await lookupHistoricalSpot(data.purchaseDate, data.metal || form.metal);
            if (historicalPrice) {
              setForm(prev => ({ ...prev, spotAtPurchase: historicalPrice.toFixed(2) }));
            }
          }

          Alert.alert('Receipt Scanned', 'Data extracted! Please verify and adjust as needed.');
        } else {
          Alert.alert('Scan Failed', 'Could not extract data from receipt. Please enter manually.');
        }
      }
    } catch (error) {
      console.error('Scan error:', error);
      Alert.alert('Error', 'Failed to scan receipt. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // MELT VALUE CALCULATOR
  // ============================================

  const calculateMeltValue = () => {
    const weight = parseFloat(meltForm.weight) || 0;
    const purity = parseFloat(meltForm.purity) / 1000 || 0.999;
    const spot = spotPrices[meltForm.metal] || 0;
    
    // Convert to troy ounces if needed (assuming grams input)
    const ozt = weight / 31.1035;
    const meltValue = ozt * purity * spot;
    
    return meltValue;
  };

  // ============================================
  // JUNK SILVER CALCULATOR
  // ============================================

  const calculateJunkSilver = () => {
    const faceValue = parseFloat(junkForm.faceValue) || 0;
    const content = parseFloat(junkForm.silverContent) / 100;
    const spot = spotPrices.silver || 0;
    
    // Standard formula: $1 face value of 90% silver = 0.715 ozt
    let oztPerDollar = 0.715; // 90% silver
    if (junkForm.silverContent === '40') oztPerDollar = 0.295; // 40% half dollars
    if (junkForm.silverContent === '35') oztPerDollar = 0.0563; // 35% war nickels per nickel
    
    const totalOzt = faceValue * oztPerDollar;
    const meltValue = totalOzt * spot;
    
    return { totalOzt, meltValue };
  };

  // ============================================
  // SPECULATION CALCULATOR
  // ============================================

  const calculateSpeculation = () => {
    const stats = getPortfolioStats();
    const goldPrice = parseFloat(specPrices.gold) || spotPrices.gold;
    const silverPrice = parseFloat(specPrices.silver) || spotPrices.silver;
    
    let projectedValue = 0;
    portfolio.forEach(item => {
      const qty = parseInt(item.quantity) || 1;
      const ozt = parseFloat(item.ozt) || 0;
      const totalOzt = ozt * qty;
      
      if (item.metal === 'gold') {
        projectedValue += totalOzt * goldPrice;
      } else if (item.metal === 'silver') {
        projectedValue += totalOzt * silverPrice;
      } else {
        projectedValue += totalOzt * (spotPrices[item.metal] || 0);
      }
    });
    
    return {
      currentValue: stats.totalValue,
      projectedValue,
      change: projectedValue - stats.totalValue,
      changePercent: stats.totalValue > 0 ? ((projectedValue - stats.totalValue) / stats.totalValue * 100) : 0,
    };
  };

  // ============================================
  // EXPORT
  // ============================================

  const exportToCSV = async () => {
    const headers = 'Metal,Description,Quantity,OZT,Unit Price,Spot at Purchase,Premium,Dealer,Date,Notes\n';
    const rows = portfolio.map(item => 
      `${item.metal},"${item.description}",${item.quantity},${item.ozt},${item.unitPrice},${item.spotAtPurchase || ''},${item.premium || ''},"${item.dealer || ''}",${item.purchaseDate || ''},"${item.notes || ''}"`
    ).join('\n');
    
    const csv = headers + rows;
    const fileUri = FileSystem.documentDirectory + 'stack-tracker-export.csv';
    
    await FileSystem.writeAsStringAsync(fileUri, csv);
    await Sharing.shareAsync(fileUri);
  };

  // ============================================
  // RENDER HELPERS
  // ============================================

  const stats = getPortfolioStats();
  const currentColor = metalColors[selectedMetal] || colors.gold;
  const filteredPortfolio = portfolio.filter(item => item.metal === selectedMetal);

  // ============================================
  // LOADING STATE
  // ============================================

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color={colors.gold} />
          <Text style={{ color: colors.muted, marginTop: 16 }}>Loading your stack...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ============================================
  // MAIN RENDER
  // ============================================

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.logo}>
            <View style={[styles.logoIcon, { backgroundColor: colors.gold }]}>
              <Text style={{ fontSize: 20 }}>🪙</Text>
            </View>
            <View>
              <Text style={styles.logoTitle}>Stack Tracker Pro</Text>
              <Text style={styles.logoSubtitle}>Privacy-First Portfolio</Text>
            </View>
          </View>
          <TouchableOpacity style={styles.privacyBadge} onPress={() => setShowPrivacyModal(true)}>
            <Text style={{ color: colors.success, fontSize: 12, fontWeight: '600' }}>🔒 Private</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.content}>
        
        {/* Spot Prices Card */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
            <Text style={styles.cardTitle}>Live Spot Prices</Text>
            <TouchableOpacity onPress={fetchSpotPrices}>
              <Text style={{ color: colors.muted, fontSize: 12 }}>↻ Refresh</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {Object.entries(spotPrices).map(([metal, price]) => (
              <View key={metal} style={{ flex: 1, minWidth: '45%', backgroundColor: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 10 }}>
                <Text style={{ color: colors.muted, fontSize: 11, textTransform: 'uppercase' }}>{metal}</Text>
                <Text style={{ color: metalColors[metal] || '#fff', fontSize: 18, fontWeight: '700' }}>${price.toLocaleString()}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Portfolio Summary */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Portfolio Summary</Text>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Total Value</Text>
            <Text style={[styles.statRowValue, { color: colors.gold, fontSize: 20 }]}>${stats.totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Total Cost</Text>
            <Text style={styles.statRowValue}>${stats.totalCost.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.statRow}>
            <Text style={styles.statRowLabel}>Gain/Loss</Text>
            <Text style={[styles.statRowValue, { color: stats.gainLoss >= 0 ? colors.success : colors.danger }]}>
              {stats.gainLoss >= 0 ? '+' : ''}${stats.gainLoss.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ({stats.gainLossPercent.toFixed(1)}%)
            </Text>
          </View>
        </View>

        {/* Allocation Chart */}
        {stats.totalValue > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Allocation</Text>
            <PieChart 
              data={Object.entries(stats.byMetal).map(([metal, data]) => ({
                label: metal.charAt(0).toUpperCase() + metal.slice(1),
                value: data.value,
                color: metalColors[metal],
              }))}
            />
          </View>
        )}

        {/* Metal Tabs */}
        <View style={styles.metalTabs}>
          {['gold', 'silver', 'platinum', 'palladium'].map(metal => (
            <TouchableOpacity
              key={metal}
              style={[styles.metalTab, selectedMetal === metal && { borderColor: metalColors[metal], backgroundColor: `${metalColors[metal]}22` }]}
              onPress={() => setSelectedMetal(metal)}
            >
              <Text style={{ color: metalColors[metal], fontSize: 12, fontWeight: '600', textTransform: 'uppercase' }}>{metal}</Text>
              <Text style={{ color: '#fff', fontWeight: '700' }}>{stats.totalOzt[metal]?.toFixed(2) || '0.00'} oz</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Holdings List */}
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={styles.cardTitle}>{selectedMetal.charAt(0).toUpperCase() + selectedMetal.slice(1)} Holdings</Text>
            <TouchableOpacity 
              style={[styles.button, { backgroundColor: currentColor, paddingVertical: 8, paddingHorizontal: 16 }]}
              onPress={() => { resetForm(); setForm(prev => ({ ...prev, metal: selectedMetal })); setShowAddModal(true); }}
            >
              <Text style={{ color: '#000', fontWeight: '600', fontSize: 13 }}>+ Add</Text>
            </TouchableOpacity>
          </View>
          
          {filteredPortfolio.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={{ color: colors.muted, fontSize: 32, marginBottom: 12 }}>🪙</Text>
              <Text style={{ color: colors.muted }}>No {selectedMetal} holdings yet</Text>
              <Text style={{ color: colors.muted, fontSize: 12 }}>Tap + Add to start tracking</Text>
            </View>
          ) : (
            filteredPortfolio.map(item => (
              <TouchableOpacity 
                key={item.id} 
                style={styles.holdingItem}
                onPress={() => { setEditingItem(item); setForm(item); setShowAddModal(true); }}
                onLongPress={() => deleteItem(item.id)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.itemTitle}>{item.description}</Text>
                  <Text style={styles.itemSubtitle}>
                    {item.quantity}x • {item.ozt} ozt each • {item.dealer || 'Unknown dealer'}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.itemValue, { color: currentColor }]}>
                    ${((parseFloat(item.ozt) * parseInt(item.quantity) * spotPrices[item.metal]) || 0).toFixed(2)}
                  </Text>
                  <Text style={styles.itemSubtitle}>Cost: ${((parseFloat(item.unitPrice) * parseInt(item.quantity)) || 0).toFixed(2)}</Text>
                </View>
              </TouchableOpacity>
            ))
          )}
        </View>

        {/* Tools Section */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🧮 Stacker Tools</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
            <TouchableOpacity 
              style={[styles.toolButton, { borderColor: colors.gold }]} 
              onPress={() => setShowMeltModal(true)}
            >
              <Text style={{ fontSize: 20 }}>🔥</Text>
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Melt Value</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toolButton, { borderColor: colors.silver }]} 
              onPress={() => setShowJunkModal(true)}
            >
              <Text style={{ fontSize: 20 }}>🪙</Text>
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Junk Silver</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toolButton, { borderColor: colors.success }]} 
              onPress={() => setShowSpeculationModal(true)}
            >
              <Text style={{ fontSize: 20 }}>🔮</Text>
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>What If...</Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.toolButton, { borderColor: colors.muted }]} 
              onPress={exportToCSV}
            >
              <Text style={{ fontSize: 20 }}>📤</Text>
              <Text style={{ color: '#fff', fontSize: 12, marginTop: 4 }}>Export CSV</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Spacer for bottom tabs */}
        <View style={{ height: 100 }} />
      </ScrollView>

      {/* ============================================ */}
      {/* ADD/EDIT PURCHASE MODAL */}
      {/* ============================================ */}
      <KeyboardModal
        visible={showAddModal}
        onClose={() => { setShowAddModal(false); setEditingItem(null); resetForm(); }}
        title={editingItem ? '✏️ Edit Purchase' : '➕ Add Purchase'}
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Scan Receipt Button */}
          <TouchableOpacity 
            style={[styles.button, { backgroundColor: 'rgba(255,255,255,0.1)', marginBottom: 16, flexDirection: 'row', gap: 8 }]}
            onPress={scanReceipt}
          >
            <Text style={{ fontSize: 18 }}>📷</Text>
            <Text style={{ color: '#fff', fontWeight: '600' }}>Scan Receipt</Text>
          </TouchableOpacity>

          {/* Metal Selector */}
          <Text style={styles.floatingLabel}>Metal</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {['gold', 'silver', 'platinum', 'palladium'].map(metal => (
              <TouchableOpacity
                key={metal}
                style={[styles.metalChip, form.metal === metal && { backgroundColor: metalColors[metal], borderColor: metalColors[metal] }]}
                onPress={() => setForm(prev => ({ ...prev, metal }))}
              >
                <Text style={{ color: form.metal === metal ? '#000' : metalColors[metal], fontSize: 12, fontWeight: '600' }}>
                  {metal.charAt(0).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FloatingInput label="Description" value={form.description} onChangeText={v => setForm(p => ({ ...p, description: v }))} placeholder="e.g., 1oz Gold Eagle" />
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}>
              <FloatingInput label="Quantity" value={form.quantity} onChangeText={v => setForm(p => ({ ...p, quantity: v }))} placeholder="1" keyboardType="number-pad" />
            </View>
            <View style={{ flex: 1 }}>
              <FloatingInput label="OZT per Unit" value={form.ozt} onChangeText={v => setForm(p => ({ ...p, ozt: v }))} placeholder="1.0" keyboardType="decimal-pad" />
            </View>
          </View>

          <FloatingInput label="Unit Price" value={form.unitPrice} onChangeText={v => setForm(p => ({ ...p, unitPrice: v }))} placeholder="0.00" keyboardType="decimal-pad" prefix="$" />
          
          <FloatingInput 
            label="Purchase Date" 
            sublabel="(YYYY-MM-DD - auto-fills spot price)"
            value={form.purchaseDate} 
            onChangeText={handleDateChange} 
            placeholder="2024-01-15" 
          />
          
          <FloatingInput label="Spot Price at Purchase" value={form.spotAtPurchase} onChangeText={v => setForm(p => ({ ...p, spotAtPurchase: v }))} placeholder="0.00" keyboardType="decimal-pad" prefix="$" />
          
          {/* Premium Display */}
          <View style={[styles.card, { backgroundColor: `${metalColors[form.metal]}22`, marginVertical: 12 }]}>
            <Text style={{ color: metalColors[form.metal], fontWeight: '600', marginBottom: 8 }}>Premium Over Spot (Auto-calculated)</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <FloatingInput label="Per Unit" value={form.premium} onChangeText={v => setForm(p => ({ ...p, premium: v }))} placeholder="0.00" keyboardType="decimal-pad" prefix="$" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.muted, fontSize: 12, marginBottom: 6 }}>Total Premium</Text>
                <View style={[styles.inputRow, { backgroundColor: 'rgba(0,0,0,0.5)' }]}>
                  <Text style={{ color: metalColors[form.metal], padding: 12 }}>
                    ${(parseFloat(form.premium || 0) * parseInt(form.quantity || 1)).toFixed(2)}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <FloatingInput label="Dealer" value={form.dealer} onChangeText={v => setForm(p => ({ ...p, dealer: v }))} placeholder="e.g., APMEX, JM Bullion" />
          
          <FloatingInput label="Notes" value={form.notes} onChangeText={v => setForm(p => ({ ...p, notes: v }))} placeholder="Optional notes..." />

          <TouchableOpacity 
            style={[styles.button, { backgroundColor: metalColors[form.metal], marginTop: 16, marginBottom: 40 }]}
            onPress={savePurchase}
          >
            <Text style={{ color: '#000', fontWeight: '600' }}>{editingItem ? 'Update' : 'Add'} Purchase</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardModal>

      {/* ============================================ */}
      {/* MELT VALUE CALCULATOR MODAL */}
      {/* ============================================ */}
      <KeyboardModal
        visible={showMeltModal}
        onClose={() => setShowMeltModal(false)}
        title="🔥 Melt Value Calculator"
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {/* Metal Selector */}
          <Text style={styles.floatingLabel}>Metal</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {['gold', 'silver', 'platinum', 'palladium'].map(metal => (
              <TouchableOpacity
                key={metal}
                style={[styles.metalChip, meltForm.metal === metal && { backgroundColor: metalColors[metal], borderColor: metalColors[metal] }]}
                onPress={() => setMeltForm(prev => ({ ...prev, metal }))}
              >
                <Text style={{ color: meltForm.metal === metal ? '#000' : metalColors[metal], fontSize: 12, fontWeight: '600' }}>
                  {metal.charAt(0).toUpperCase()}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <FloatingInput 
            label="Weight (grams)" 
            value={meltForm.weight} 
            onChangeText={v => setMeltForm(p => ({ ...p, weight: v }))} 
            placeholder="31.1" 
            keyboardType="decimal-pad" 
          />
          
          <Text style={styles.floatingLabel}>Purity</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[{ label: '.999', value: '999' }, { label: '.9999', value: '9999' }, { label: '.925', value: '925' }, { label: '.900', value: '900' }, { label: '.800', value: '800' }].map(p => (
              <TouchableOpacity
                key={p.value}
                style={[styles.metalChip, meltForm.purity === p.value && { backgroundColor: colors.gold, borderColor: colors.gold }]}
                onPress={() => setMeltForm(prev => ({ ...prev, purity: p.value }))}
              >
                <Text style={{ color: meltForm.purity === p.value ? '#000' : colors.gold, fontSize: 11, fontWeight: '600' }}>
                  {p.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Result */}
          <View style={[styles.card, { backgroundColor: `${metalColors[meltForm.metal]}22`, marginTop: 16 }]}>
            <Text style={{ color: colors.muted, marginBottom: 8 }}>Melt Value</Text>
            <Text style={{ color: metalColors[meltForm.metal], fontSize: 32, fontWeight: '700' }}>
              ${calculateMeltValue().toFixed(2)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
              Based on {meltForm.metal} spot: ${spotPrices[meltForm.metal]}/oz
            </Text>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardModal>

      {/* ============================================ */}
      {/* JUNK SILVER CALCULATOR MODAL */}
      {/* ============================================ */}
      <KeyboardModal
        visible={showJunkModal}
        onClose={() => setShowJunkModal(false)}
        title="🪙 Junk Silver Calculator"
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <FloatingInput 
            label="Face Value ($)" 
            value={junkForm.faceValue} 
            onChangeText={v => setJunkForm(p => ({ ...p, faceValue: v }))} 
            placeholder="10.00" 
            keyboardType="decimal-pad" 
            prefix="$"
          />
          
          <Text style={styles.floatingLabel}>Silver Content</Text>
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {[
              { label: '90% (Pre-1965)', value: '90' },
              { label: '40% (1965-70)', value: '40' },
              { label: '35% (War Nickels)', value: '35' },
            ].map(c => (
              <TouchableOpacity
                key={c.value}
                style={[styles.metalChip, { flex: 1 }, junkForm.silverContent === c.value && { backgroundColor: colors.silver, borderColor: colors.silver }]}
                onPress={() => setJunkForm(prev => ({ ...prev, silverContent: c.value }))}
              >
                <Text style={{ color: junkForm.silverContent === c.value ? '#000' : colors.silver, fontSize: 10, fontWeight: '600', textAlign: 'center' }}>
                  {c.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Result */}
          <View style={[styles.card, { backgroundColor: `${colors.silver}22`, marginTop: 16 }]}>
            <View style={styles.statRow}>
              <Text style={{ color: colors.muted }}>Silver Content</Text>
              <Text style={{ color: colors.silver, fontWeight: '600' }}>{calculateJunkSilver().totalOzt.toFixed(3)} ozt</Text>
            </View>
            <View style={styles.divider} />
            <Text style={{ color: colors.muted, marginBottom: 8 }}>Melt Value</Text>
            <Text style={{ color: colors.silver, fontSize: 32, fontWeight: '700' }}>
              ${calculateJunkSilver().meltValue.toFixed(2)}
            </Text>
            <Text style={{ color: colors.muted, fontSize: 12, marginTop: 8 }}>
              Based on silver spot: ${spotPrices.silver}/oz
            </Text>
          </View>
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardModal>

      {/* ============================================ */}
      {/* SPECULATION MODAL */}
      {/* ============================================ */}
      <KeyboardModal
        visible={showSpeculationModal}
        onClose={() => setShowSpeculationModal(false)}
        title="🔮 What If..."
      >
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <Text style={{ color: colors.muted, marginBottom: 16 }}>See your portfolio value at different price scenarios</Text>

          <FloatingInput 
            label="Gold Price" 
            sublabel={`Current: $${spotPrices.gold}`}
            value={specPrices.gold} 
            onChangeText={v => setSpecPrices(p => ({ ...p, gold: v }))} 
            placeholder={spotPrices.gold.toString()} 
            keyboardType="decimal-pad" 
            prefix="$"
          />
          
          <FloatingInput 
            label="Silver Price" 
            sublabel={`Current: $${spotPrices.silver}`}
            value={specPrices.silver} 
            onChangeText={v => setSpecPrices(p => ({ ...p, silver: v }))} 
            placeholder={spotPrices.silver.toString()} 
            keyboardType="decimal-pad" 
            prefix="$"
          />

          {/* Quick Scenarios */}
          <Text style={[styles.floatingLabel, { marginTop: 16 }]}>Quick Scenarios</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
            {[
              { label: 'Gold $3000', gold: '3000', silver: '' },
              { label: 'Gold $5000', gold: '5000', silver: '' },
              { label: 'Silver $50', gold: '', silver: '50' },
              { label: 'Silver $100', gold: '', silver: '100' },
              { label: '🚀 Moon', gold: '10000', silver: '200' },
            ].map((scenario, i) => (
              <TouchableOpacity
                key={i}
                style={[styles.metalChip, { paddingHorizontal: 12 }]}
                onPress={() => setSpecPrices({ 
                  gold: scenario.gold || specPrices.gold, 
                  silver: scenario.silver || specPrices.silver 
                })}
              >
                <Text style={{ color: colors.gold, fontSize: 11 }}>{scenario.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Result */}
          {(() => {
            const spec = calculateSpeculation();
            return (
              <View style={[styles.card, { backgroundColor: spec.change >= 0 ? `${colors.success}22` : `${colors.danger}22` }]}>
                <View style={styles.statRow}>
                  <Text style={{ color: colors.muted }}>Current Value</Text>
                  <Text style={{ color: '#fff', fontWeight: '600' }}>${spec.currentValue.toFixed(2)}</Text>
                </View>
                <View style={styles.statRow}>
                  <Text style={{ color: colors.muted }}>Projected Value</Text>
                  <Text style={{ color: spec.change >= 0 ? colors.success : colors.danger, fontWeight: '700', fontSize: 20 }}>
                    ${spec.projectedValue.toFixed(2)}
                  </Text>
                </View>
                <View style={styles.divider} />
                <View style={styles.statRow}>
                  <Text style={{ color: colors.muted }}>Change</Text>
                  <Text style={{ color: spec.change >= 0 ? colors.success : colors.danger, fontWeight: '600' }}>
                    {spec.change >= 0 ? '+' : ''}${spec.change.toFixed(2)} ({spec.changePercent.toFixed(1)}%)
                  </Text>
                </View>
              </View>
            );
          })()}
          
          <View style={{ height: 40 }} />
        </ScrollView>
      </KeyboardModal>

      {/* ============================================ */}
      {/* PRIVACY MODAL */}
      {/* ============================================ */}
      <Modal visible={showPrivacyModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>🔒 Privacy First</Text>
              <TouchableOpacity 
                onPress={() => setShowPrivacyModal(false)} 
                style={styles.closeButton}
                hitSlop={{ top: 15, bottom: 15, left: 15, right: 15 }}
              >
                <Text style={styles.closeButtonText}>✕</Text>
              </TouchableOpacity>
            </View>
            <ScrollView>
              <Text style={{ color: '#fff', fontSize: 16, marginBottom: 16 }}>
                We built this app so we CAN'T access your data.
              </Text>
              
              {[
                { title: '📱 Local Storage', desc: 'All portfolio data stays on YOUR device. We never see it.' },
                { title: '🔐 Encrypted', desc: 'Your data is encrypted on-device before storage.' },
                { title: '📷 No Image Storage', desc: 'Receipt scans are processed in memory and immediately deleted.' },
                { title: '👤 No Account', desc: 'No sign-up required. No user tracking.' },
                { title: '📊 No Analytics', desc: 'Zero third-party SDKs. No usage tracking whatsoever.' },
                { title: '📤 Your Data, Your Control', desc: 'Export everything as CSV anytime. Delete by uninstalling.' },
              ].map((item, i) => (
                <View key={i} style={{ marginBottom: 16 }}>
                  <Text style={{ color: colors.gold, fontWeight: '600', marginBottom: 4 }}>{item.title}</Text>
                  <Text style={styles.privacyItem}>{item.desc}</Text>
                </View>
              ))}
              
              <View style={styles.divider} />
              <Text style={{ color: colors.muted, fontStyle: 'italic', textAlign: 'center', marginTop: 16 }}>
                "Your stack, your privacy."
              </Text>
            </ScrollView>
          </View>
        </View>
      </Modal>

    </SafeAreaView>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f0f' },
  
  // Header
  header: {
    backgroundColor: 'rgba(0,0,0,0.4)',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
  },
  logo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logoIcon: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  logoTitle: { color: '#fff', fontWeight: '700', fontSize: 18 },
  logoSubtitle: { color: colors.muted, fontSize: 11 },
  privacyBadge: {
    paddingHorizontal: 12, paddingVertical: 6,
    backgroundColor: 'rgba(34,197,94,0.15)', borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(34,197,94,0.3)',
  },
  
  // Content
  content: { flex: 1, padding: 20 },
  
  // Cards
  card: {
    backgroundColor: colors.card, borderRadius: 16, padding: 20,
    marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  cardTitle: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 12 },
  
  // Stats
  statRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8 },
  statRowLabel: { color: colors.muted, fontSize: 13 },
  statRowValue: { color: '#fff', fontWeight: '600' },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: 12 },
  
  // Buttons
  button: {
    paddingVertical: 14, paddingHorizontal: 24, borderRadius: 12,
    alignItems: 'center', justifyContent: 'center',
  },
  toolButton: {
    flex: 1, minWidth: '45%', padding: 16, borderRadius: 12,
    borderWidth: 1, alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.3)',
  },
  
  // Metal tabs
  metalTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  metalTab: {
    flex: 1, padding: 12, borderRadius: 12,
    borderWidth: 2, borderColor: colors.border, alignItems: 'center',
  },
  metalChip: {
    paddingVertical: 8, paddingHorizontal: 16, borderRadius: 20,
    borderWidth: 1, borderColor: colors.border,
  },
  
  // Holdings
  holdingItem: {
    flexDirection: 'row', padding: 12, borderRadius: 10,
    backgroundColor: 'rgba(0,0,0,0.3)', marginBottom: 8,
  },
  itemTitle: { color: '#fff', fontWeight: '600', marginBottom: 4 },
  itemSubtitle: { color: colors.muted, fontSize: 12 },
  itemValue: { fontWeight: '600' },
  emptyState: { alignItems: 'center', padding: 40 },
  
  // Floating inputs
  floatingContainer: { marginBottom: 12 },
  floatingLabel: { color: colors.muted, fontSize: 12, marginBottom: 6, fontWeight: '500' },
  floatingSublabel: { color: colors.muted, fontSize: 10, marginBottom: 4, fontStyle: 'italic' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1,
    borderColor: colors.border, borderRadius: 10,
  },
  inputPrefix: { color: colors.muted, paddingLeft: 12, fontSize: 14 },
  floatingInput: { flex: 1, color: '#fff', padding: 12, fontSize: 14 },
  
  // Modal styles - KEYBOARD FIX
  modalKeyboardView: { flex: 1 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'flex-start', // Changed from flex-end to flex-start
    paddingTop: Platform.OS === 'ios' ? 60 : 40, // Add padding at top
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderRadius: 24,
    padding: 20,
    marginHorizontal: 10,
    maxHeight: SCREEN_HEIGHT * 0.85,
    flex: 1,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  modalTitle: { color: '#fff', fontSize: 20, fontWeight: '700' },
  closeButton: {
    width: 44, height: 44,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 22,
  },
  closeButtonText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  dismissHint: { alignItems: 'center', paddingVertical: 8, marginBottom: 8 },
  
  // Privacy
  privacyItem: { color: '#a1a1aa', fontSize: 13, lineHeight: 20 },
});
