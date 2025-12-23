import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, Tooltip } from 'recharts';

// API Configuration - Change this to your deployed backend URL
const API_BASE_URL = 'https://api.stacktracker.app'; // or http://localhost:3000 for dev

export default function StackTrackerPro() {
  // Core state
  const [tab, setTab] = useState('portfolio');
  const [metalTab, setMetalTab] = useState('silver');
  const [silverSpot, setSilverSpot] = useState(30.25);
  const [goldSpot, setGoldSpot] = useState(2650.00);
  const [silverItems, setSilverItems] = useState([]);
  const [goldItems, setGoldItems] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [scanStatus, setScanStatus] = useState(null); // null, 'scanning', 'success', 'partial', 'error'
  const [scanMessage, setScanMessage] = useState('');
  
  // Form state
  const [form, setForm] = useState({
    productName: '', source: '', datePurchased: '', ozt: '', quantity: 1,
    unitPrice: '', taxes: 0, shipping: 0, spotPrice: '', premium: 0
  });

  // Alert form
  const [alertForm, setAlertForm] = useState({ metal: 'silver', price: '', condition: 'above' });

  // Melt calculator
  const [meltType, setMeltType] = useState('dimes');

  // Load data from localStorage on mount
  useEffect(() => {
    const savedSilver = localStorage.getItem('stacktracker_silver');
    const savedGold = localStorage.getItem('stacktracker_gold');
    const savedAlerts = localStorage.getItem('stacktracker_alerts');
    if (savedSilver) setSilverItems(JSON.parse(savedSilver));
    if (savedGold) setGoldItems(JSON.parse(savedGold));
    if (savedAlerts) setAlerts(JSON.parse(savedAlerts));
    fetchSpotPrices();
  }, []);

  // Save to localStorage when data changes
  useEffect(() => {
    localStorage.setItem('stacktracker_silver', JSON.stringify(silverItems));
  }, [silverItems]);

  useEffect(() => {
    localStorage.setItem('stacktracker_gold', JSON.stringify(goldItems));
  }, [goldItems]);

  useEffect(() => {
    localStorage.setItem('stacktracker_alerts', JSON.stringify(alerts));
  }, [alerts]);

  // Fetch spot prices from backend
  const fetchSpotPrices = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/spot-prices`);
      const data = await res.json();
      if (data.success) {
        if (data.silver) setSilverSpot(data.silver);
        if (data.gold) setGoldSpot(data.gold);
      }
    } catch (e) {
      console.log('Using cached spot prices');
    }
  };

  // Receipt scanning - integrates with privacy-focused backend
  const handleReceiptScan = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanStatus('scanning');
    setScanMessage('Analyzing receipt...');

    const formData = new FormData();
    formData.append('receipt', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/scan-receipt`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.success && result.data) {
        const d = result.data;
        
        // Auto-fill form with extracted data
        setForm(prev => ({
          ...prev,
          productName: d.productName || prev.productName,
          source: d.source || prev.source,
          datePurchased: d.datePurchased || prev.datePurchased,
          ozt: d.ozt || prev.ozt,
          quantity: d.quantity || prev.quantity,
          unitPrice: d.unitPrice || prev.unitPrice,
          taxes: d.taxes || prev.taxes,
          shipping: d.shipping || prev.shipping,
          spotPrice: d.spotPrice || prev.spotPrice,
        }));

        // Auto-switch metal tab
        if (d.metal === 'gold') setMetalTab('gold');
        else if (d.metal === 'silver') setMetalTab('silver');

        // Set status based on completeness
        const filledFields = result.fieldsExtracted || 0;
        if (filledFields >= 6) {
          setScanStatus('success');
          setScanMessage('Receipt analyzed! Fields auto-filled.');
        } else {
          setScanStatus('partial');
          setScanMessage('Partial data extracted - please verify.');
        }
      } else {
        setScanStatus('error');
        setScanMessage('Could not analyze - enter manually.');
      }
    } catch (error) {
      setScanStatus('error');
      setScanMessage('Network error - enter manually.');
    }

    // Clear status after 5 seconds
    setTimeout(() => {
      setScanStatus(null);
      setScanMessage('');
    }, 5000);
  };

  // Stack photo analysis
  const handleStackAnalysis = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanStatus('scanning');
    setScanMessage('Identifying coins & bars...');

    const formData = new FormData();
    formData.append('stack', file);

    try {
      const res = await fetch(`${API_BASE_URL}/api/analyze-stack`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (result.success && result.data?.items?.length > 0) {
        const item = result.data.items[0];
        setForm(prev => ({
          ...prev,
          productName: item.productName || prev.productName,
          ozt: item.ozt || prev.ozt,
          quantity: item.estimatedCount || prev.quantity,
        }));
        if (item.metal === 'gold') setMetalTab('gold');
        setScanStatus('success');
        setScanMessage(`Found ${result.data.items.length} item type(s)!`);
      } else {
        setScanStatus('partial');
        setScanMessage('Could not identify items.');
      }
    } catch (error) {
      setScanStatus('error');
      setScanMessage('Network error.');
    }

    setTimeout(() => { setScanStatus(null); setScanMessage(''); }, 5000);
  };

  // Save item
  const saveItem = () => {
    const item = {
      id: editId || Date.now(),
      ...form,
      ozt: parseFloat(form.ozt) || 0,
      quantity: parseInt(form.quantity) || 1,
      unitPrice: parseFloat(form.unitPrice) || 0,
      taxes: parseFloat(form.taxes) || 0,
      shipping: parseFloat(form.shipping) || 0,
      spotPrice: parseFloat(form.spotPrice) || 0,
      premium: parseFloat(form.premium) || 0,
    };

    if (metalTab === 'silver') {
      if (editId) setSilverItems(prev => prev.map(i => i.id === editId ? item : i));
      else setSilverItems(prev => [...prev, item]);
    } else {
      if (editId) setGoldItems(prev => prev.map(i => i.id === editId ? item : i));
      else setGoldItems(prev => [...prev, item]);
    }

    resetForm();
  };

  const resetForm = () => {
    setForm({ productName: '', source: '', datePurchased: '', ozt: '', quantity: 1, unitPrice: '', taxes: 0, shipping: 0, spotPrice: '', premium: 0 });
    setShowAdd(false);
    setEditId(null);
  };

  const deleteItem = (id, metal) => {
    if (metal === 'silver') setSilverItems(prev => prev.filter(i => i.id !== id));
    else setGoldItems(prev => prev.filter(i => i.id !== id));
  };

  const editItem = (item, metal) => {
    setForm(item);
    setEditId(item.id);
    setMetalTab(metal);
    setShowAdd(true);
  };

  // Calculations
  const items = metalTab === 'silver' ? silverItems : goldItems;
  const spot = metalTab === 'silver' ? silverSpot : goldSpot;
  const color = metalTab === 'silver' ? '#94a3b8' : '#fbbf24';

  const totalOzt = items.reduce((sum, i) => sum + (i.ozt * i.quantity), 0);
  const totalCost = items.reduce((sum, i) => sum + (i.unitPrice * i.quantity) + i.taxes + i.shipping, 0);
  const meltValue = totalOzt * spot;
  const totalPremium = items.reduce((sum, i) => sum + (i.premium * i.quantity), 0);
  const totalValue = meltValue + totalPremium;
  const gainLoss = totalValue - totalCost;
  const gainLossPct = totalCost > 0 ? ((gainLoss / totalCost) * 100).toFixed(1) : 0;

  // All items for charts
  const allSilverOzt = silverItems.reduce((sum, i) => sum + (i.ozt * i.quantity), 0);
  const allGoldOzt = goldItems.reduce((sum, i) => sum + (i.ozt * i.quantity), 0);
  const silverValue = allSilverOzt * silverSpot;
  const goldValue = allGoldOzt * goldSpot;

  // Quick templates
  const silverTemplates = [
    { name: 'American Silver Eagle', ozt: 1 },
    { name: 'Canadian Maple Leaf', ozt: 1 },
    { name: 'Austrian Philharmonic', ozt: 1 },
    { name: 'Generic Round', ozt: 1 },
    { name: '10 oz Bar', ozt: 10 },
    { name: '100 oz Bar', ozt: 100 },
  ];

  const goldTemplates = [
    { name: 'American Gold Eagle 1oz', ozt: 1 },
    { name: 'Canadian Gold Maple 1oz', ozt: 1 },
    { name: 'Gold Buffalo 1oz', ozt: 1 },
    { name: '1/10 oz Gold Eagle', ozt: 0.1 },
    { name: '1/4 oz Gold Eagle', ozt: 0.25 },
    { name: '1 oz Gold Bar', ozt: 1 },
  ];

  const dealers = ['APMEX', 'JM Bullion', 'SD Bullion', 'Money Metals', 'Provident', 'eBay', 'LCS', 'Other'];

  // Melt calculator data
  const meltData = {
    dimes: { name: 'Pre-1965 Dimes', silverPer: 0.0723, face: 0.10 },
    quarters: { name: 'Pre-1965 Quarters', silverPer: 0.1808, face: 0.25 },
    halves: { name: 'Pre-1965 Half Dollars', silverPer: 0.3617, face: 0.50 },
    dollars: { name: 'Peace/Morgan Dollars', silverPer: 0.7734, face: 1.00 },
    warNickels: { name: 'War Nickels (35%)', silverPer: 0.0563, face: 0.05 },
    kennedy40: { name: '40% Kennedy Halves', silverPer: 0.1479, face: 0.50 },
  };

  // Export CSV
  const exportCSV = () => {
    const allItems = [
      ...silverItems.map(i => ({ ...i, metal: 'Silver' })),
      ...goldItems.map(i => ({ ...i, metal: 'Gold' }))
    ];
    
    const headers = ['Metal', 'Product', 'Source', 'Date', 'OZT', 'Qty', 'Unit Price', 'Taxes', 'Shipping', 'Spot', 'Premium'];
    const rows = allItems.map(i => [i.metal, i.productName, i.source, i.datePurchased, i.ozt, i.quantity, i.unitPrice, i.taxes, i.shipping, i.spotPrice, i.premium]);
    
    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `stack-tracker-export-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  // Styles
  const styles = {
    container: { minHeight: '100vh', background: 'linear-gradient(135deg, #0f0f0f 0%, #1a1a2e 50%, #16213e 100%)', color: '#e4e4e7', fontFamily: "'SF Pro Display', -apple-system, BlinkMacSystemFont, sans-serif" },
    header: { background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(20px)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: '16px 20px', position: 'sticky', top: 0, zIndex: 100 },
    logo: { display: 'flex', alignItems: 'center', gap: 12 },
    logoIcon: { width: 40, height: 40, background: `linear-gradient(135deg, ${color}, ${metalTab === 'silver' ? '#64748b' : '#f59e0b'})`, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 },
    tabs: { display: 'flex', gap: 4, background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 4, marginTop: 16 },
    tab: (active) => ({ flex: 1, padding: '10px 16px', borderRadius: 8, border: 'none', background: active ? 'rgba(255,255,255,0.15)' : 'transparent', color: active ? '#fff' : '#71717a', fontWeight: 600, fontSize: 13, cursor: 'pointer', transition: 'all 0.2s' }),
    card: { background: 'rgba(255,255,255,0.05)', borderRadius: 16, padding: 20, marginBottom: 16, border: '1px solid rgba(255,255,255,0.08)' },
    metalTabs: { display: 'flex', gap: 8, marginBottom: 16 },
    metalTab: (active, c) => ({ flex: 1, padding: '12px', borderRadius: 12, border: `2px solid ${active ? c : 'rgba(255,255,255,0.1)'}`, background: active ? `${c}22` : 'transparent', color: active ? c : '#71717a', fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s' }),
    stat: { textAlign: 'center' },
    statValue: { fontSize: 28, fontWeight: 700, color },
    statLabel: { fontSize: 12, color: '#71717a', marginTop: 4 },
    btn: (c = color) => ({ padding: '12px 24px', borderRadius: 12, border: 'none', background: c, color: '#000', fontWeight: 600, cursor: 'pointer', fontSize: 14, transition: 'all 0.2s' }),
    btnOutline: { padding: '12px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.2)', background: 'transparent', color: '#fff', fontWeight: 600, cursor: 'pointer', fontSize: 14 },
    input: { width: '100%', padding: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' },
    select: { width: '100%', padding: 12, background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, color: '#fff', fontSize: 14, outline: 'none' },
    scanStatus: (status) => ({
      padding: '12px 16px',
      borderRadius: 10,
      marginBottom: 16,
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      background: status === 'scanning' ? 'rgba(234,179,8,0.2)' : status === 'success' ? 'rgba(34,197,94,0.2)' : status === 'partial' ? 'rgba(234,179,8,0.2)' : 'rgba(239,68,68,0.2)',
      border: `1px solid ${status === 'scanning' ? '#eab308' : status === 'success' ? '#22c55e' : status === 'partial' ? '#eab308' : '#ef4444'}`,
      color: status === 'scanning' ? '#eab308' : status === 'success' ? '#22c55e' : status === 'partial' ? '#eab308' : '#ef4444',
    }),
    privacyBadge: { display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: 20, fontSize: 11, color: '#22c55e', cursor: 'pointer' },
    itemCard: { background: 'rgba(0,0,0,0.2)', borderRadius: 12, padding: 16, marginBottom: 12, border: '1px solid rgba(255,255,255,0.05)' },
    quickBtn: { padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: '#a1a1aa', fontSize: 12, cursor: 'pointer', whiteSpace: 'nowrap' },
  };

  return (
    <div style={styles.container}>
      {/* Header */}
      <header style={styles.header}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={styles.logo}>
            <div style={styles.logoIcon}>🪙</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 18 }}>Stack Tracker Pro</div>
              <div style={{ fontSize: 11, color: '#71717a' }}>Privacy-First Portfolio</div>
            </div>
          </div>
          <div style={styles.privacyBadge} onClick={() => setShowPrivacy(true)}>
            🔒 Privacy Mode
          </div>
        </div>

        {/* Main Tabs */}
        <div style={styles.tabs}>
          {['portfolio', 'charts', 'alerts', 'melt', 'settings'].map(t => (
            <button key={t} style={styles.tab(tab === t)} onClick={() => setTab(t)}>
              {t === 'portfolio' ? '📊' : t === 'charts' ? '📈' : t === 'alerts' ? '🔔' : t === 'melt' ? '🧮' : '⚙️'}
              <span style={{ marginLeft: 6 }}>{t.charAt(0).toUpperCase() + t.slice(1)}</span>
            </button>
          ))}
        </div>
      </header>

      <main style={{ padding: 20, maxWidth: 600, margin: '0 auto' }}>
        {/* Portfolio Tab */}
        {tab === 'portfolio' && (
          <>
            {/* Metal Toggle */}
            <div style={styles.metalTabs}>
              <button style={styles.metalTab(metalTab === 'silver', '#94a3b8')} onClick={() => setMetalTab('silver')}>
                🥈 Silver
              </button>
              <button style={styles.metalTab(metalTab === 'gold', '#fbbf24')} onClick={() => setMetalTab('gold')}>
                🥇 Gold
              </button>
            </div>

            {/* Stats Card */}
            <div style={styles.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
                <div style={styles.stat}>
                  <div style={styles.statValue}>{totalOzt.toFixed(2)}</div>
                  <div style={styles.statLabel}>Total OZT</div>
                </div>
                <div style={styles.stat}>
                  <div style={{ ...styles.statValue, color: '#22c55e' }}>${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div style={styles.statLabel}>Total Value</div>
                </div>
                <div style={styles.stat}>
                  <div style={{ ...styles.statValue, color: gainLoss >= 0 ? '#22c55e' : '#ef4444' }}>
                    {gainLoss >= 0 ? '+' : ''}{gainLossPct}%
                  </div>
                  <div style={styles.statLabel}>Gain/Loss</div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#71717a', fontSize: 13 }}>Spot Price</span>
                <span style={{ fontWeight: 600 }}>${spot.toFixed(2)}/oz</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#71717a', fontSize: 13 }}>Melt Value</span>
                <span style={{ fontWeight: 600 }}>${meltValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                <span style={{ color: '#71717a', fontSize: 13 }}>Numismatic Premium</span>
                <span style={{ fontWeight: 600, color: '#a855f7' }}>+${totalPremium.toLocaleString()}</span>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
              <button style={styles.btn()} onClick={() => setShowAdd(true)}>+ Add Purchase</button>
              <button style={styles.btnOutline} onClick={fetchSpotPrices}>🔄 Refresh</button>
            </div>

            {/* Items List */}
            {items.map(item => (
              <div key={item.id} style={styles.itemCard}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>{item.productName}</div>
                    <div style={{ fontSize: 12, color: '#71717a' }}>
                      {item.quantity}x @ ${item.unitPrice} • {item.ozt * item.quantity} oz • {item.source}
                    </div>
                    {item.premium > 0 && (
                      <div style={{ fontSize: 11, color: '#a855f7', marginTop: 4 }}>+${item.premium * item.quantity} numismatic</div>
                    )}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 600, color }}>${((item.ozt * item.quantity * spot) + (item.premium * item.quantity)).toFixed(2)}</div>
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button style={{ ...styles.quickBtn, padding: '4px 8px' }} onClick={() => editItem(item, metalTab)}>✏️</button>
                      <button style={{ ...styles.quickBtn, padding: '4px 8px', borderColor: '#ef4444' }} onClick={() => deleteItem(item.id, metalTab)}>🗑️</button>
                    </div>
                  </div>
                </div>
              </div>
            ))}

            {items.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, color: '#71717a' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🪙</div>
                <div>No {metalTab} holdings yet</div>
                <div style={{ fontSize: 13, marginTop: 8 }}>Tap "Add Purchase" to start tracking</div>
              </div>
            )}
          </>
        )}

        {/* Charts Tab */}
        {tab === 'charts' && (
          <>
            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Portfolio Allocation</div>
              <div style={{ height: 200 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Silver', value: silverValue, color: '#94a3b8' },
                        { name: 'Gold', value: goldValue, color: '#fbbf24' },
                      ].filter(d => d.value > 0)}
                      cx="50%"
                      cy="50%"
                      innerRadius={50}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    >
                      {[
                        { name: 'Silver', value: silverValue, color: '#94a3b8' },
                        { name: 'Gold', value: goldValue, color: '#fbbf24' },
                      ].filter(d => d.value > 0).map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, background: '#94a3b8', borderRadius: 3 }}></div>
                  <span style={{ fontSize: 13 }}>Silver: ${silverValue.toLocaleString()}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 12, height: 12, background: '#fbbf24', borderRadius: 3 }}></div>
                  <span style={{ fontSize: 13 }}>Gold: ${goldValue.toLocaleString()}</span>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Total Portfolio Value</div>
              <div style={{ fontSize: 32, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>
                ${(silverValue + goldValue).toLocaleString(undefined, { minimumFractionDigits: 2 })}
              </div>
              <div style={{ fontSize: 13, color: '#71717a' }}>
                {allSilverOzt.toFixed(2)} oz silver + {allGoldOzt.toFixed(2)} oz gold
              </div>
            </div>
          </>
        )}

        {/* Alerts Tab */}
        {tab === 'alerts' && (
          <>
            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Create Alert</div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select style={{ ...styles.select, flex: 1 }} value={alertForm.metal} onChange={e => setAlertForm(p => ({ ...p, metal: e.target.value }))}>
                  <option value="silver">Silver</option>
                  <option value="gold">Gold</option>
                </select>
                <select style={{ ...styles.select, flex: 1 }} value={alertForm.condition} onChange={e => setAlertForm(p => ({ ...p, condition: e.target.value }))}>
                  <option value="above">Goes Above</option>
                  <option value="below">Goes Below</option>
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="number"
                  placeholder="Price target"
                  style={{ ...styles.input, flex: 1 }}
                  value={alertForm.price}
                  onChange={e => setAlertForm(p => ({ ...p, price: e.target.value }))}
                />
                <button
                  style={styles.btn()}
                  onClick={() => {
                    if (alertForm.price) {
                      setAlerts(prev => [...prev, { id: Date.now(), ...alertForm, price: parseFloat(alertForm.price), active: true }]);
                      setAlertForm({ metal: 'silver', price: '', condition: 'above' });
                    }
                  }}
                >
                  Add
                </button>
              </div>
            </div>

            {alerts.map(alert => (
              <div key={alert.id} style={{ ...styles.itemCard, borderLeft: `3px solid ${alert.metal === 'silver' ? '#94a3b8' : '#fbbf24'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>
                      {alert.metal === 'silver' ? '🥈' : '🥇'} {alert.metal.charAt(0).toUpperCase() + alert.metal.slice(1)} {alert.condition} ${alert.price}
                    </div>
                    <div style={{ fontSize: 12, color: '#71717a' }}>
                      Current: ${alert.metal === 'silver' ? silverSpot : goldSpot}
                    </div>
                  </div>
                  <button style={{ ...styles.quickBtn, borderColor: '#ef4444' }} onClick={() => setAlerts(prev => prev.filter(a => a.id !== alert.id))}>
                    🗑️
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {/* Melt Calculator Tab */}
        {tab === 'melt' && (
          <>
            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🧮 Junk Silver Calculator</div>
              <div style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>
                Calculate melt value of US 90% silver coins
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 20 }}>
                {Object.entries(meltData).map(([key, data]) => (
                  <button
                    key={key}
                    style={{ ...styles.quickBtn, background: meltType === key ? 'rgba(148,163,184,0.2)' : 'transparent', borderColor: meltType === key ? '#94a3b8' : 'rgba(255,255,255,0.15)', padding: '12px', textAlign: 'left' }}
                    onClick={() => setMeltType(key)}
                  >
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#fff' }}>{data.name}</div>
                    <div style={{ fontSize: 11, color: '#71717a' }}>{data.silverPer.toFixed(4)} oz/coin</div>
                  </button>
                ))}
              </div>

              <div style={{ background: 'rgba(148,163,184,0.1)', borderRadius: 12, padding: 16 }}>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>{meltData[meltType].name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#71717a' }}>Silver content</span>
                  <span>{meltData[meltType].silverPer.toFixed(4)} oz</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#71717a' }}>Face value</span>
                  <span>${meltData[meltType].face.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <span style={{ color: '#71717a' }}>Melt per coin</span>
                  <span style={{ color: '#94a3b8', fontWeight: 600 }}>${(meltData[meltType].silverPer * silverSpot).toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
                  <span style={{ color: '#71717a' }}>Multiplier</span>
                  <span style={{ fontWeight: 600 }}>{((meltData[meltType].silverPer * silverSpot) / meltData[meltType].face).toFixed(2)}x face</span>
                </div>
              </div>
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📊 Reference: $1 Face Value</div>
              <div style={{ fontSize: 13, color: '#71717a', marginBottom: 8 }}>
                At ${silverSpot.toFixed(2)}/oz spot:
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, color: '#94a3b8' }}>
                ${(0.715 * silverSpot).toFixed(2)}
              </div>
              <div style={{ fontSize: 12, color: '#71717a' }}>per $1 face value (90% silver)</div>
            </div>
          </>
        )}

        {/* Settings Tab */}
        {tab === 'settings' && (
          <>
            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>🔒 Privacy & Security</div>
              <div style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>
                Your data is stored locally on this device. Receipt images are processed in memory and never stored on our servers.
              </div>
              <button style={styles.btnOutline} onClick={() => setShowPrivacy(true)}>
                View Privacy Policy
              </button>
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>📥 Export Data</div>
              <div style={{ fontSize: 13, color: '#71717a', marginBottom: 16 }}>
                Download your complete portfolio as a CSV file for your records.
              </div>
              <button style={styles.btn()} onClick={exportCSV}>
                Export to CSV
              </button>
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>⚠️ Danger Zone</div>
              <button
                style={{ ...styles.btn('#ef4444'), width: '100%' }}
                onClick={() => {
                  if (confirm('Are you sure? This will delete ALL your data.')) {
                    setSilverItems([]);
                    setGoldItems([]);
                    setAlerts([]);
                    localStorage.clear();
                  }
                }}
              >
                Delete All Data
              </button>
            </div>
          </>
        )}
      </main>

      {/* Add/Edit Modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)', zIndex: 200, overflow: 'auto' }}>
          <div style={{ maxWidth: 500, margin: '20px auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>{editId ? 'Edit' : 'Add'} Purchase</h2>
              <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }} onClick={resetForm}>×</button>
            </div>

            {/* Scan Status */}
            {scanStatus && (
              <div style={styles.scanStatus(scanStatus)}>
                {scanStatus === 'scanning' && <span style={{ animation: 'spin 1s linear infinite' }}>⏳</span>}
                {scanStatus === 'success' && '✅'}
                {scanStatus === 'partial' && '⚠️'}
                {scanStatus === 'error' && '❌'}
                <span>{scanMessage}</span>
              </div>
            )}

            {/* Receipt Scanner */}
            <div style={{ ...styles.card, background: 'rgba(148,163,184,0.1)', marginBottom: 20 }}>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>📷 AI Receipt Scanner</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <label style={{ ...styles.btn(), flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                  Scan Receipt
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleReceiptScan} />
                </label>
                <label style={{ ...styles.btnOutline, flex: 1, textAlign: 'center', cursor: 'pointer' }}>
                  📸 Stack Photo
                  <input type="file" accept="image/*" style={{ display: 'none' }} onChange={handleStackAnalysis} />
                </label>
              </div>
              <div style={{ fontSize: 11, color: '#71717a', marginTop: 8, textAlign: 'center' }}>
                🔒 Images processed in memory only — never stored
              </div>
            </div>

            {/* Metal Toggle */}
            <div style={styles.metalTabs}>
              <button style={styles.metalTab(metalTab === 'silver', '#94a3b8')} onClick={() => setMetalTab('silver')}>🥈 Silver</button>
              <button style={styles.metalTab(metalTab === 'gold', '#fbbf24')} onClick={() => setMetalTab('gold')}>🥇 Gold</button>
            </div>

            {/* Quick Templates */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 12, color: '#71717a', marginBottom: 8 }}>Quick Select:</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {(metalTab === 'silver' ? silverTemplates : goldTemplates).map(t => (
                  <button
                    key={t.name}
                    style={styles.quickBtn}
                    onClick={() => setForm(p => ({ ...p, productName: t.name, ozt: t.ozt }))}
                  >
                    {t.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Form Fields */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input placeholder="Product Name *" style={styles.input} value={form.productName} onChange={e => setForm(p => ({ ...p, productName: e.target.value }))} />
              
              <div style={{ display: 'flex', gap: 8 }}>
                <select style={{ ...styles.select, flex: 1 }} value={form.source} onChange={e => setForm(p => ({ ...p, source: e.target.value }))}>
                  <option value="">Select Dealer</option>
                  {dealers.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
                <input type="date" style={{ ...styles.input, flex: 1 }} value={form.datePurchased} onChange={e => setForm(p => ({ ...p, datePurchased: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.001" placeholder="OZT per unit *" style={{ ...styles.input, flex: 1 }} value={form.ozt} onChange={e => setForm(p => ({ ...p, ozt: e.target.value }))} />
                <input type="number" placeholder="Quantity" style={{ ...styles.input, flex: 1 }} value={form.quantity} onChange={e => setForm(p => ({ ...p, quantity: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {[0.1, 0.25, 0.5, 1, 5, 10, 100].map(oz => (
                  <button key={oz} style={{ ...styles.quickBtn, padding: '6px 10px' }} onClick={() => setForm(p => ({ ...p, ozt: oz }))}>{oz} oz</button>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" placeholder="Unit Price *" style={{ ...styles.input, flex: 1 }} value={form.unitPrice} onChange={e => setForm(p => ({ ...p, unitPrice: e.target.value }))} />
                <input type="number" step="0.01" placeholder="Spot at purchase" style={{ ...styles.input, flex: 1 }} value={form.spotPrice} onChange={e => setForm(p => ({ ...p, spotPrice: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <input type="number" step="0.01" placeholder="Taxes" style={{ ...styles.input, flex: 1 }} value={form.taxes} onChange={e => setForm(p => ({ ...p, taxes: e.target.value }))} />
                <input type="number" step="0.01" placeholder="Shipping" style={{ ...styles.input, flex: 1 }} value={form.shipping} onChange={e => setForm(p => ({ ...p, shipping: e.target.value }))} />
              </div>

              <input type="number" step="0.01" placeholder="Numismatic Premium (per piece)" style={styles.input} value={form.premium} onChange={e => setForm(p => ({ ...p, premium: e.target.value }))} />

              {/* Calculated Total */}
              {form.unitPrice && form.quantity && (
                <div style={{ background: 'rgba(34,197,94,0.1)', borderRadius: 10, padding: 12, textAlign: 'center' }}>
                  <div style={{ fontSize: 12, color: '#71717a' }}>Calculated Total</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#22c55e' }}>
                    ${((parseFloat(form.unitPrice) || 0) * (parseInt(form.quantity) || 1) + (parseFloat(form.taxes) || 0) + (parseFloat(form.shipping) || 0)).toFixed(2)}
                  </div>
                </div>
              )}

              <button style={{ ...styles.btn(), width: '100%', marginTop: 8 }} onClick={saveItem} disabled={!form.productName || !form.unitPrice}>
                {editId ? 'Update Purchase' : 'Add Purchase'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Privacy Modal */}
      {showPrivacy && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(10px)', zIndex: 200, overflow: 'auto' }}>
          <div style={{ maxWidth: 500, margin: '20px auto', padding: 20 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontSize: 20, fontWeight: 700 }}>🔒 Privacy Architecture</h2>
              <button style={{ background: 'none', border: 'none', color: '#fff', fontSize: 24, cursor: 'pointer' }} onClick={() => setShowPrivacy(false)}>×</button>
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#22c55e' }}>✅ What We Do</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#a1a1aa', fontSize: 13, lineHeight: 1.8 }}>
                <li>Store all data locally on YOUR device</li>
                <li>Encrypt your portfolio with AES-256</li>
                <li>Process receipt images in RAM only</li>
                <li>Delete images immediately after scanning</li>
                <li>Use HTTPS for all communications</li>
              </ul>
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12, color: '#ef4444' }}>❌ What We DON'T Do</div>
              <ul style={{ margin: 0, paddingLeft: 20, color: '#a1a1aa', fontSize: 13, lineHeight: 1.8 }}>
                <li>Store your receipt images</li>
                <li>Track your total holdings</li>
                <li>Create user profiles or accounts</li>
                <li>Sell or share any data</li>
                <li>Use analytics or tracking SDKs</li>
                <li>Log any user activity</li>
              </ul>
            </div>

            <div style={styles.card}>
              <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>🔐 Receipt Scanner</div>
              <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>
                When you scan a receipt, the image is sent to our server over encrypted HTTPS. It's held in RAM only (never written to disk), analyzed by AI, and immediately garbage collected. We cannot recover or reproduce any receipt image after processing.
              </div>
            </div>

            <div style={{ ...styles.card, background: 'rgba(34,197,94,0.1)', borderColor: 'rgba(34,197,94,0.3)' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#22c55e', marginBottom: 8 }}>Our Promise</div>
              <div style={{ fontSize: 13, color: '#a1a1aa', fontStyle: 'italic' }}>
                "We architected the system so we CAN'T access your data, even if compelled. Your stack, your privacy."
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
