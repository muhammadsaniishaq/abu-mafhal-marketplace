import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    TextInput,
    ScrollView,
    Image,
    ActivityIndicator,
    Platform,
    FlatList,
    Alert,
    StyleSheet,
    Switch,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { supabase } from '../../lib/supabase';
import { Toast } from '../../components/Toast';

// ─── Balanced Executive Design Tokens ─────────────────────────────────────────
const C = {
    canvas: '#F8FAFC',
    card: '#FFFFFF',
    navy: '#0F172A',
    navySoft: '#1E293B',
    slate: '#334155',
    muted: '#64748B',
    subtle: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    emerald: '#059669',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    amber: '#D97706',
    amberBg: '#FFFBEB',
    amberBorder: '#FDE68A',
    rose: '#EF4444',
    roseBg: '#FEF2F2',
    roseBorder: '#FECACA',
    indigo: '#4F46E5',
    indigoBg: '#EEF2FF',
    indigoBorder: '#C7D2FE',
    gold: '#D9A73A',
    goldBg: '#FEF9C3',
    goldBorder: '#FACC15',
    blue: '#2563EB',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE'
};

// Helper: Calculate remaining countdown string
const formatRemainingTime = (dateStr) => {
    if (!dateStr) return 'No timer set';
    try {
        const target = new Date(dateStr).getTime();
        const now = Date.now();
        const diff = target - now;
        if (diff <= 0) return 'Expired';
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const secs = Math.floor((diff % (1000 * 60)) / 1000);
        if (days > 0) return `${days}d ${hours}h ${mins}m left`;
        return `${hours}h ${mins}m ${secs}s left`;
    } catch {
        return 'Invalid date';
    }
};

// ─── Main AdminFlashSales Component ───────────────────────────────────────────
export const AdminFlashSales = ({ navigation, onBack }) => {
    // ── Campaign State ────────────────────────────────────────────────────────
    const [title, setTitle] = useState('Mega Weekend Flash Sale');
    const [endTime, setEndTime] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
    const [discountPercent, setDiscountPercent] = useState('30');
    const [isActive, setIsActive] = useState(false);
    const [selectedProductIds, setSelectedProductIds] = useState([]);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showDatePicker, setShowDatePicker] = useState(false);

    // ── Inventory Catalog State ───────────────────────────────────────────────
    const [allProducts, setAllProducts] = useState([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [showPicker, setShowPicker] = useState(false);
    const [pickerSearch, setPickerSearch] = useState('');
    const [pickerCategory, setPickerCategory] = useState('All');

    // ── Toast State ───────────────────────────────────────────────────────────
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 2600);
    };

    // ── Live Ticking Clock for Storefront Simulator ────────────────────────────
    const [clockNow, setClockNow] = useState(Date.now());
    useEffect(() => {
        const interval = setInterval(() => setClockNow(Date.now()), 1000);
        return () => clearInterval(interval);
    }, []);

    // ── Load Flash Sale Settings from Supabase ────────────────────────────────
    const fetchFlashSale = useCallback(async () => {
        try {
            setLoading(true);

            // 1. Try reading from app_settings (key: active_flash_sale)
            const { data: settingData, error: settingError } = await supabase
                .from('app_settings')
                .select('*')
                .eq('key', 'active_flash_sale')
                .maybeSingle();

            if (settingData && settingData.value) {
                const cfg = settingData.value;
                setTitle(cfg.title || 'Flash Sale');
                setDiscountPercent(cfg.discount_percent ? String(cfg.discount_percent) : '30');
                setEndTime(cfg.end_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
                setIsActive(Boolean(cfg.is_active));
                setSelectedProductIds(Array.isArray(cfg.product_ids) ? cfg.product_ids : []);
            } else {
                // Check if flash_sales table exists
                try {
                    const { data: tableData } = await supabase
                        .from('flash_sales')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (tableData) {
                        setTitle(tableData.title || 'Flash Sale');
                        setDiscountPercent(tableData.discount_percent ? String(tableData.discount_percent) : '30');
                        setEndTime(tableData.end_time || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
                        setIsActive(Boolean(tableData.is_active));
                        setSelectedProductIds(Array.isArray(tableData.product_ids) ? tableData.product_ids : []);
                    }
                } catch {
                    // Fallback to default 24h
                }
            }
        } catch (err) {
            console.error('Fetch Flash Sale error:', err);
            showToast('Could not load flash sale: ' + err.message, 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    // ── Load Catalog Products ─────────────────────────────────────────────────
    const loadAllProducts = useCallback(async () => {
        setLoadingProducts(true);
        try {
            const { data, error } = await supabase
                .from('products')
                .select('id, name, price, stock, stock_quantity, images, image_url, category, status')
                .neq('status', 'archived')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) throw error;
            setAllProducts(data || []);
        } catch (err) {
            console.error('Error loading inventory products:', err);
        } finally {
            setLoadingProducts(false);
        }
    }, []);

    useEffect(() => {
        fetchFlashSale();
        loadAllProducts();

        // Real-Time Supabase Sync
        const channel = supabase
            .channel('flash_sale_realtime_sync')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, (payload) => {
                if (payload.new?.key === 'active_flash_sale' || payload.old?.key === 'active_flash_sale') {
                    fetchFlashSale();
                }
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchFlashSale, loadAllProducts]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchFlashSale();
        loadAllProducts();
    };

    // ── Quick Presets ─────────────────────────────────────────────────────────
    const setQuickDuration = (hours) => {
        const target = new Date(Date.now() + hours * 60 * 60 * 1000);
        setEndTime(target.toISOString());
        showToast(`Timer set to +${hours} hours`, 'success');
    };

    const toggleProductSelection = (id) => {
        setSelectedProductIds(prev =>
            prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        );
    };

    // ── Save Flash Sale Settings Live ─────────────────────────────────────────
    const handleSave = async () => {
        const discountNum = parseInt(discountPercent, 10) || 0;

        if (discountNum <= 0 || discountNum >= 100) {
            Alert.alert('Invalid Discount', 'Please enter a valid discount percentage between 1% and 99%.');
            return;
        }

        try {
            setSaving(true);

            const payload = {
                title: title.trim() || 'Flash Sale',
                discount_percent: discountNum,
                end_time: endTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                is_active: isActive,
                product_ids: selectedProductIds,
                updated_at: new Date().toISOString()
            };

            // 1. Save to app_settings (100% reliable singleton storage)
            const { error: settingError } = await supabase
                .from('app_settings')
                .upsert({
                    key: 'active_flash_sale',
                    value: payload,
                    description: 'Active Flash Sale Campaign Configuration',
                    updated_at: new Date().toISOString()
                });

            if (settingError) throw settingError;

            // 2. Also sync to banners table with section = 'flash_sale' for widgets
            try {
                await supabase.from('banners').upsert({
                    title: payload.title,
                    subtitle: `${discountNum}% OFF FLASH SALE`,
                    section: 'flash_sale',
                    is_active: isActive,
                    action_link: JSON.stringify({
                        discountPercent: discountNum,
                        endTime: payload.end_time,
                        productCount: selectedProductIds.length
                    }),
                    updated_at: new Date().toISOString()
                });
            } catch {
                // Secondary sync
            }

            // 3. Optional sync to flash_sales table if it exists
            try {
                await supabase.from('flash_sales').insert([payload]);
            } catch {
                // Secondary table optional
            }

            showToast(
                isActive
                    ? `Flash Sale is now LIVE with ${discountNum}% off!`
                    : 'Flash Sale paused successfully.',
                'success'
            );
        } catch (err) {
            console.error('Error saving flash sale:', err);
            showToast('Save failed: ' + err.message, 'error');
        } finally {
            setSaving(false);
        }
    };

    // ── Filtered Catalog Products ─────────────────────────────────────────────
    const selectedProductsList = useMemo(() => {
        return allProducts.filter(p => selectedProductIds.includes(p.id));
    }, [allProducts, selectedProductIds]);

    const categoriesList = useMemo(() => {
        const cats = Array.from(new Set(allProducts.map(p => p.category).filter(Boolean)));
        return ['All', ...cats];
    }, [allProducts]);

    const filteredProductsForPicker = useMemo(() => {
        return allProducts.filter(p => {
            const matchesQuery = !pickerSearch.trim() ||
                (p.name || '').toLowerCase().includes(pickerSearch.toLowerCase()) ||
                (p.category || '').toLowerCase().includes(pickerSearch.toLowerCase());
            const matchesCat = pickerCategory === 'All' || p.category === pickerCategory;
            return matchesQuery && matchesCat;
        });
    }, [allProducts, pickerSearch, pickerCategory]);

    const countdownRemaining = formatRemainingTime(endTime);
    const discountVal = parseInt(discountPercent, 10) || 0;

    return (
        <View style={S.container}>
            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

            {/* ── Executive Top Header ────────────────────────────────────────── */}
            <View style={S.header}>
                <View style={S.headerTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {onBack ? (
                            <TouchableOpacity onPress={onBack} style={S.backButton}>
                                <Ionicons name="arrow-back" size={17} color={C.navy} />
                            </TouchableOpacity>
                        ) : navigation?.canGoBack?.() ? (
                            <TouchableOpacity onPress={() => navigation.goBack()} style={S.backButton}>
                                <Ionicons name="arrow-back" size={17} color={C.navy} />
                            </TouchableOpacity>
                        ) : null}

                        <View>
                            <Text style={S.headerTitle}>Flash Sale Console</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 1 }}>
                                <View style={[S.liveDot, { backgroundColor: isActive ? C.emerald : C.muted }]} />
                                <Text style={S.headerSubtitle}>
                                    {isActive ? 'Storefront Campaign Live' : 'Campaign Paused'}
                                </Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={onRefresh}
                            style={S.iconBtn}
                            disabled={refreshing}
                        >
                            <Ionicons name="refresh" size={16} color={C.navy} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleSave}
                            disabled={saving}
                            style={S.saveTopBtn}
                            activeOpacity={0.8}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="checkmark-circle" size={15} color="#FFFFFF" />
                                    <Text style={S.saveTopBtnText}>Save Live</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── 4-Tile Live KPI Dashboard Ribbon ────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.kpiScroll}
                >
                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: isActive ? C.emeraldBg : C.canvas }]}>
                                <Ionicons name="flash" size={13} color={isActive ? C.emerald : C.muted} />
                            </View>
                            <Text style={[S.kpiBadge, { color: isActive ? C.emerald : C.muted, backgroundColor: isActive ? '#DCFCE7' : '#F1F5F9' }]}>
                                {isActive ? 'LIVE NOW' : 'PAUSED'}
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{isActive ? 'ACTIVE' : 'OFF'}</Text>
                        <Text style={S.kpiSub}>Store Visibility</Text>
                    </View>

                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.roseBg }]}>
                                <Ionicons name="pricetag" size={13} color={C.rose} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.rose, backgroundColor: '#FEE2E2' }]}>
                                DISCOUNT
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{discountVal}%</Text>
                        <Text style={S.kpiSub}>Price Reduction</Text>
                    </View>

                    <TouchableOpacity
                        onPress={() => setShowPicker(true)}
                        style={S.kpiCard}
                        activeOpacity={0.8}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.indigoBg }]}>
                                <Ionicons name="cube" size={13} color={C.indigo} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.indigo, backgroundColor: '#E0E7FF' }]}>
                                ITEMS
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{selectedProductIds.length}</Text>
                        <Text style={S.kpiSub}>Selected Products</Text>
                    </TouchableOpacity>

                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.amberBg }]}>
                                <Ionicons name="time" size={13} color={C.amber} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.amber, backgroundColor: '#FEF3C7' }]}>
                                EXPIRY
                            </Text>
                        </View>
                        <Text style={[S.kpiValue, { fontSize: 13 }]} numberOfLines={1}>
                            {countdownRemaining}
                        </Text>
                        <Text style={S.kpiSub}>Live Countdown</Text>
                    </View>
                </ScrollView>
            </View>

            {loading && !refreshing ? (
                <View style={S.centerLoader}>
                    <ActivityIndicator size="small" color={C.navy} />
                    <Text style={S.loaderText}>Loading live Flash Sale configuration...</Text>
                </View>
            ) : (
                <ScrollView
                    style={{ flex: 1 }}
                    contentContainerStyle={S.contentScroll}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[C.navy, C.gold]} />
                    }
                >
                    {/* ── Live Customer Storefront Preview Card ─────────────────── */}
                    <View style={S.previewSection}>
                        <View style={S.previewHeaderRow}>
                            <Text style={S.sectionLabel}>LIVE STOREFRONT PREVIEW</Text>
                            <View style={S.liveBadgeWrap}>
                                <Ionicons name="eye-outline" size={13} color={C.emerald} />
                                <Text style={S.liveBadgeText}>Customer View</Text>
                            </View>
                        </View>

                        <View style={S.storefrontPreviewCard}>
                            <View style={S.previewCardTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <View style={S.flashIconBadge}>
                                        <Ionicons name="flash" size={14} color="#FFFFFF" />
                                    </View>
                                    <View>
                                        <Text style={S.previewSaleTitle}>{title || 'Flash Sale'}</Text>
                                        <Text style={S.previewSaleSub}>Limited Time Special Offers</Text>
                                    </View>
                                </View>

                                {/* 4 Red Countdown Boxes */}
                                <View style={S.countdownBoxesRow}>
                                    {(() => {
                                        const diff = Math.max(0, new Date(endTime).getTime() - clockNow);
                                        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
                                        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                                        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                                        const s = Math.floor((diff % (1000 * 60)) / 1000);

                                        const pad = n => String(n).padStart(2, '0');
                                        return [
                                            { val: pad(d), label: 'D' },
                                            { val: pad(h), label: 'H' },
                                            { val: pad(m), label: 'M' },
                                            { val: pad(s), label: 'S' }
                                        ].map((unit, idx) => (
                                            <View key={idx} style={S.countdownBox}>
                                                <Text style={S.countdownBoxNum}>{unit.val}</Text>
                                                <Text style={S.countdownBoxLabel}>{unit.label}</Text>
                                            </View>
                                        ));
                                    })()}
                                </View>
                            </View>

                            {/* Preview Sample Products Row */}
                            {selectedProductsList.length > 0 ? (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.previewItemsScroll}>
                                    {selectedProductsList.slice(0, 5).map(prod => {
                                        const origPrice = Number(prod.price || 0);
                                        const discountedPrice = Math.round(origPrice * (1 - discountVal / 100));
                                        const img = prod.images?.[0] || prod.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=120';
                                        return (
                                            <View key={prod.id} style={S.previewItemCard}>
                                                <View style={S.previewItemImgWrap}>
                                                    <Image source={{ uri: img }} style={S.previewItemImg} />
                                                    <View style={S.discountPill}>
                                                        <Text style={S.discountPillText}>-{discountVal}%</Text>
                                                    </View>
                                                </View>
                                                <Text style={S.previewItemTitle} numberOfLines={1}>{prod.name}</Text>
                                                <Text style={S.previewItemPrice}>₦{discountedPrice.toLocaleString()}</Text>
                                                <Text style={S.previewItemOrigPrice}>₦{origPrice.toLocaleString()}</Text>
                                            </View>
                                        );
                                    })}
                                </ScrollView>
                            ) : (
                                <View style={S.previewEmptyProducts}>
                                    <Ionicons name="cube-outline" size={24} color={C.subtle} />
                                    <Text style={S.previewEmptyProductsText}>
                                        No products linked yet. Select products below to showcase in this flash deal.
                                    </Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ── Campaign Configuration Form ────────────────────────────── */}
                    <View style={S.formCard}>
                        {/* Status Switch */}
                        <View style={S.rowBetweenBorder}>
                            <View>
                                <Text style={S.formCardHeading}>Enable Flash Sale</Text>
                                <Text style={S.formCardSub}>Broadcast and activate on homepage with countdown ticker</Text>
                            </View>
                            <Switch
                                value={isActive}
                                onValueChange={setIsActive}
                                trackColor={{ false: '#E2E8F0', true: C.navy }}
                                thumbColor={isActive ? C.gold : '#FFFFFF'}
                            />
                        </View>

                        {/* Title */}
                        <View style={{ marginTop: 14, marginBottom: 14 }}>
                            <Text style={S.inputTitle}>CAMPAIGN TITLE</Text>
                            <TextInput
                                style={S.formInput}
                                value={title}
                                onChangeText={setTitle}
                                placeholder="e.g. Mega Weekend Flash Sale"
                                placeholderTextColor={C.subtle}
                            />
                        </View>

                        {/* Discount Percentage */}
                        <View style={{ marginBottom: 14 }}>
                            <Text style={S.inputTitle}>FLASH DISCOUNT PERCENTAGE (%)</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 }}>
                                <TextInput
                                    style={S.discountInput}
                                    value={discountPercent}
                                    onChangeText={setDiscountPercent}
                                    keyboardType="numeric"
                                    placeholder="30"
                                    placeholderTextColor={C.subtle}
                                />
                                {['15', '20', '30', '50'].map(pct => {
                                    const isSel = discountPercent === pct;
                                    return (
                                        <TouchableOpacity
                                            key={pct}
                                            onPress={() => setDiscountPercent(pct)}
                                            style={[S.discountChip, isSel && S.discountChipActive]}
                                        >
                                            <Text style={[S.discountChipText, isSel && S.discountChipTextActive]}>
                                                {pct}%
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>

                        {/* Duration Preset Buttons */}
                        <View style={{ marginBottom: 14 }}>
                            <Text style={S.inputTitle}>CAMPAIGN DURATION PRESETS</Text>
                            <View style={{ flexDirection: 'row', gap: 6, marginVertical: 6, flexWrap: 'wrap' }}>
                                {[
                                    { label: '6 Hours', h: 6 },
                                    { label: '12 Hours', h: 12 },
                                    { label: '24 Hours', h: 24 },
                                    { label: '3 Days', h: 72 },
                                    { label: '7 Days', h: 168 }
                                ].map(item => (
                                    <TouchableOpacity
                                        key={item.label}
                                        onPress={() => setQuickDuration(item.h)}
                                        style={S.durationPresetBtn}
                                    >
                                        <Text style={S.durationPresetText}>{item.label}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowDatePicker(true)}
                                style={S.expiryPickerBtn}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                                    <Ionicons name="calendar-outline" size={17} color={C.muted} />
                                    <Text style={S.expiryPickerText}>
                                        Ends: {new Date(endTime).toLocaleString()} ({countdownRemaining})
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={C.muted} />
                            </TouchableOpacity>

                            {showDatePicker && (
                                Platform.OS === 'web' ? (
                                    <View style={{ marginTop: 8 }}>
                                        <input
                                            type="datetime-local"
                                            value={endTime.slice(0, 16)}
                                            onChange={(e) => {
                                                if (e.target.value) {
                                                    setEndTime(new Date(e.target.value).toISOString());
                                                    setShowDatePicker(false);
                                                }
                                            }}
                                            style={{
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #CBD5E1',
                                                backgroundColor: '#FFFFFF',
                                                fontSize: '13px',
                                                color: '#0F172A',
                                                width: '100%'
                                            }}
                                        />
                                    </View>
                                ) : (
                                    <DateTimePicker
                                        value={new Date(endTime)}
                                        mode="date"
                                        display="default"
                                        minimumDate={new Date()}
                                        onChange={(event, selectedDate) => {
                                            setShowDatePicker(Platform.OS === 'ios');
                                            if (selectedDate) {
                                                setEndTime(selectedDate.toISOString());
                                            }
                                        }}
                                    />
                                )
                            )}
                        </View>
                    </View>

                    {/* ── Selected Participating Products ──────────────────────── */}
                    <View style={S.formCard}>
                        <View style={S.rowBetween}>
                            <View>
                                <Text style={S.formCardHeading}>Included Products</Text>
                                <Text style={S.formCardSub}>
                                    {selectedProductIds.length} item{selectedProductIds.length === 1 ? '' : 's'} participating in this deal
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowPicker(true)}
                                style={S.manageProductsBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add-circle" size={16} color="#FFFFFF" />
                                <Text style={S.manageProductsBtnText}>Manage Products</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedProductsList.length === 0 ? (
                            <View style={S.emptyItemsBox}>
                                <Ionicons name="cube-outline" size={36} color={C.subtle} />
                                <Text style={S.emptyItemsTitle}>No Products Linked Yet</Text>
                                <Text style={S.emptyItemsSub}>
                                    Tap "Manage Products" above to pick items from your catalog to offer on flash discount.
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setShowPicker(true)}
                                    style={S.addFirstBtn}
                                >
                                    <Text style={S.addFirstBtnText}>+ Select Products</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={{ marginTop: 12 }}>
                                {selectedProductsList.map(prod => {
                                    const orig = Number(prod.price || 0);
                                    const discounted = Math.round(orig * (1 - discountVal / 100));
                                    const img = prod.images?.[0] || prod.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100';

                                    return (
                                        <View key={prod.id} style={S.productRowItem}>
                                            <Image source={{ uri: img }} style={S.productRowThumb} />
                                            <View style={{ flex: 1, paddingRight: 8 }}>
                                                <Text numberOfLines={1} style={S.productRowName}>{prod.name}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                    <Text style={S.productRowPrice}>₦{discounted.toLocaleString()}</Text>
                                                    <Text style={S.productRowOrigPrice}>₦{orig.toLocaleString()}</Text>
                                                    <View style={S.tagDiscount}>
                                                        <Text style={S.tagDiscountText}>-{discountVal}%</Text>
                                                    </View>
                                                </View>
                                            </View>
                                            <TouchableOpacity
                                                onPress={() => toggleProductSelection(prod.id)}
                                                style={S.removeBtn}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="trash-outline" size={16} color={C.rose} />
                                            </TouchableOpacity>
                                        </View>
                                    );
                                })}
                            </View>
                        )}
                    </View>

                    {/* ── Main Save Button ──────────────────────────────────────── */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={S.saveMainBtn}
                        activeOpacity={0.85}
                    >
                        {saving ? (
                            <ActivityIndicator color="#FFFFFF" size="small" />
                        ) : (
                            <>
                                <Ionicons name="flash" size={18} color={C.gold} />
                                <Text style={S.saveMainBtnText}>SAVE & PUBLISH FLASH SALE</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </ScrollView>
            )}

            {/* ── Product Catalog Picker Modal ─────────────────────────────────── */}
            {showPicker && (
                <View style={S.modalOverlay}>
                    <View style={S.modalCard}>
                        {/* Modal Header */}
                        <View style={S.modalHeader}>
                            <View>
                                <Text style={S.modalTitle}>Select Participating Products</Text>
                                <Text style={S.modalSub}>
                                    Selected: {selectedProductIds.length} of {allProducts.length} items
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowPicker(false)}
                                style={S.modalDoneBtn}
                            >
                                <Text style={S.modalDoneText}>Done</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Search & Category Filter */}
                        <View style={S.modalSearchWrap}>
                            <Ionicons name="search" size={16} color={C.muted} />
                            <TextInput
                                placeholder="Search by product name or keyword..."
                                placeholderTextColor={C.subtle}
                                value={pickerSearch}
                                onChangeText={setPickerSearch}
                                style={S.modalSearchInput}
                            />
                            {pickerSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setPickerSearch('')}>
                                    <Ionicons name="close-circle" size={16} color={C.muted} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Category Chips */}
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.categoryChipsScroll}>
                            {categoriesList.map(cat => {
                                const isSel = pickerCategory === cat;
                                return (
                                    <TouchableOpacity
                                        key={cat}
                                        onPress={() => setPickerCategory(cat)}
                                        style={[S.catChip, isSel && S.catChipActive]}
                                    >
                                        <Text style={[S.catChipText, isSel && S.catChipTextActive]}>{cat}</Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>

                        {/* Product List */}
                        {loadingProducts ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <ActivityIndicator size="small" color={C.navy} />
                                <Text style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>Loading store inventory...</Text>
                            </View>
                        ) : filteredProductsForPicker.length === 0 ? (
                            <View style={{ padding: 40, alignItems: 'center' }}>
                                <Ionicons name="cube-outline" size={36} color={C.subtle} />
                                <Text style={{ color: C.muted, fontSize: 13, marginTop: 8 }}>No matching products found.</Text>
                            </View>
                        ) : (
                            <FlatList
                                data={filteredProductsForPicker}
                                keyExtractor={item => item.id}
                                contentContainerStyle={{ paddingHorizontal: 14, paddingBottom: 20 }}
                                showsVerticalScrollIndicator={false}
                                renderItem={({ item }) => {
                                    const isSelected = selectedProductIds.includes(item.id);
                                    const img = item.images?.[0] || item.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100';
                                    const orig = Number(item.price || 0);
                                    const dealPrice = Math.round(orig * (1 - discountVal / 100));

                                    return (
                                        <TouchableOpacity
                                            onPress={() => toggleProductSelection(item.id)}
                                            activeOpacity={0.75}
                                            style={[S.pickerItemCard, isSelected && S.pickerItemCardActive]}
                                        >
                                            <Image source={{ uri: img }} style={S.pickerItemThumb} />
                                            <View style={{ flex: 1, paddingRight: 8 }}>
                                                <Text numberOfLines={1} style={S.pickerItemName}>{item.name}</Text>
                                                <Text style={S.pickerItemCat}>{item.category || 'General Product'}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                                                    <Text style={S.pickerItemPrice}>₦{dealPrice.toLocaleString()}</Text>
                                                    <Text style={S.pickerItemOrigPrice}>₦{orig.toLocaleString()}</Text>
                                                </View>
                                            </View>
                                            <View style={[S.checkCircle, isSelected && S.checkCircleActive]}>
                                                {isSelected && <Ionicons name="checkmark" size={16} color="#FFFFFF" />}
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        )}
                    </View>
                </View>
            )}
        </View>
    );
};

// ─── Balanced & Elegant Stylesheet ────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.canvas
    },
    header: {
        backgroundColor: C.card,
        paddingTop: 14,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    backButton: {
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    headerSubtitle: {
        fontSize: 11.5,
        fontWeight: '600',
        color: C.muted
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3
    },
    iconBtn: {
        width: 34,
        height: 34,
        borderRadius: 9,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    saveTopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 9,
        backgroundColor: C.navy
    },
    saveTopBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    kpiScroll: {
        gap: 10,
        paddingRight: 6
    },
    kpiCard: {
        width: 132,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        padding: 10
    },
    kpiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    kpiIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center'
    },
    kpiBadge: {
        fontSize: 9.5,
        fontWeight: '900',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4
    },
    kpiValue: {
        fontSize: 17,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    kpiSub: {
        fontSize: 11,
        fontWeight: '600',
        color: C.muted,
        marginTop: 2
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 36
    },
    loaderText: {
        marginTop: 10,
        fontSize: 12.5,
        fontWeight: '600',
        color: C.muted
    },
    contentScroll: {
        padding: 14,
        paddingBottom: 90
    },
    previewSection: {
        marginBottom: 14
    },
    previewHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    sectionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: C.muted,
        letterSpacing: 0.5
    },
    liveBadgeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    liveBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.emerald
    },
    storefrontPreviewCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2
    },
    previewCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    flashIconBadge: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: C.rose,
        alignItems: 'center',
        justifyContent: 'center'
    },
    previewSaleTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: C.navy
    },
    previewSaleSub: {
        fontSize: 11,
        color: C.muted,
        fontWeight: '600'
    },
    countdownBoxesRow: {
        flexDirection: 'row',
        gap: 4
    },
    countdownBox: {
        backgroundColor: C.rose,
        width: 28,
        height: 28,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center'
    },
    countdownBoxNum: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '900'
    },
    countdownBoxLabel: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 7.5,
        fontWeight: '800',
        marginTop: -2
    },
    previewItemsScroll: {
        gap: 8,
        paddingTop: 4
    },
    previewItemCard: {
        width: 96,
        backgroundColor: C.canvas,
        borderRadius: 10,
        padding: 7,
        borderWidth: 1,
        borderColor: C.border
    },
    previewItemImgWrap: {
        position: 'relative',
        width: '100%',
        height: 70,
        borderRadius: 7,
        overflow: 'hidden',
        marginBottom: 6
    },
    previewItemImg: {
        width: '100%',
        height: '100%'
    },
    discountPill: {
        position: 'absolute',
        top: 4,
        left: 4,
        backgroundColor: C.rose,
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    discountPillText: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900'
    },
    previewItemTitle: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.navy
    },
    previewItemPrice: {
        fontSize: 11,
        fontWeight: '900',
        color: C.navy,
        marginTop: 1
    },
    previewItemOrigPrice: {
        fontSize: 9.5,
        color: C.muted,
        textDecorationLine: 'line-through'
    },
    previewEmptyProducts: {
        padding: 20,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.canvas,
        borderRadius: 10
    },
    previewEmptyProductsText: {
        fontSize: 11.5,
        color: C.muted,
        textAlign: 'center',
        marginTop: 6,
        maxWidth: 240
    },
    formCard: {
        backgroundColor: C.card,
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 14
    },
    rowBetween: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    rowBetweenBorder: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight
    },
    formCardHeading: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy
    },
    formCardSub: {
        fontSize: 11.5,
        color: C.muted,
        marginTop: 2
    },
    inputTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: C.muted,
        letterSpacing: 0.4
    },
    formInput: {
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 13,
        color: C.navy,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 6
    },
    discountInput: {
        flex: 1,
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        fontWeight: '900',
        color: C.navy,
        borderWidth: 1,
        borderColor: C.border
    },
    discountChip: {
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    discountChipActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    discountChipText: {
        fontSize: 11.5,
        fontWeight: '800',
        color: C.muted
    },
    discountChipTextActive: {
        color: '#FFFFFF'
    },
    durationPresetBtn: {
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    durationPresetText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.slate
    },
    expiryPickerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 6
    },
    expiryPickerText: {
        fontSize: 12,
        color: C.navy,
        fontWeight: '700'
    },
    manageProductsBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: C.navy,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 8
    },
    manageProductsBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800'
    },
    emptyItemsBox: {
        padding: 24,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: C.canvas,
        borderRadius: 12,
        marginTop: 12
    },
    emptyItemsTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: C.navy,
        marginTop: 8
    },
    emptyItemsSub: {
        fontSize: 11.5,
        color: C.muted,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 16,
        maxWidth: 260
    },
    addFirstBtn: {
        marginTop: 12,
        backgroundColor: C.navy,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8
    },
    addFirstBtnText: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800'
    },
    productRowItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight
    },
    productRowThumb: {
        width: 38,
        height: 38,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
        marginRight: 10
    },
    productRowName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: C.navy
    },
    productRowPrice: {
        fontSize: 12,
        fontWeight: '900',
        color: C.navy
    },
    productRowOrigPrice: {
        fontSize: 10.5,
        color: C.muted,
        textDecorationLine: 'line-through'
    },
    tagDiscount: {
        backgroundColor: C.roseBg,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    tagDiscountText: {
        color: C.rose,
        fontSize: 9.5,
        fontWeight: '900'
    },
    removeBtn: {
        padding: 6
    },
    saveMainBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.navy,
        paddingVertical: 14,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.goldBorder
    },
    saveMainBtnText: {
        color: C.gold,
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'center',
        padding: 16,
        zIndex: 99
    },
    modalCard: {
        backgroundColor: C.card,
        borderRadius: 16,
        maxHeight: '85%',
        borderWidth: 1,
        borderColor: C.border,
        overflow: 'hidden'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: C.navy
    },
    modalSub: {
        fontSize: 11.5,
        color: C.muted,
        marginTop: 2
    },
    modalDoneBtn: {
        backgroundColor: C.navy,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8
    },
    modalDoneText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    modalSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderWidth: 1,
        borderColor: C.border,
        margin: 14,
        marginBottom: 8
    },
    modalSearchInput: {
        flex: 1,
        fontSize: 13,
        color: C.navy,
        padding: 0
    },
    categoryChipsScroll: {
        gap: 6,
        paddingHorizontal: 14,
        paddingBottom: 10
    },
    catChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    catChipActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    catChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted
    },
    catChipTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    pickerItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: C.canvas,
        borderRadius: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.borderLight
    },
    pickerItemCardActive: {
        backgroundColor: '#FFFBEB',
        borderColor: C.goldBorder
    },
    pickerItemThumb: {
        width: 42,
        height: 42,
        borderRadius: 8,
        backgroundColor: '#E2E8F0',
        marginRight: 10
    },
    pickerItemName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: C.navy
    },
    pickerItemCat: {
        fontSize: 10.5,
        color: C.muted,
        marginTop: 1
    },
    pickerItemPrice: {
        fontSize: 12,
        fontWeight: '900',
        color: C.navy
    },
    pickerItemOrigPrice: {
        fontSize: 10.5,
        color: C.muted,
        textDecorationLine: 'line-through'
    },
    checkCircle: {
        width: 26,
        height: 26,
        borderRadius: 8,
        backgroundColor: C.card,
        borderWidth: 1.5,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    checkCircleActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    }
});
