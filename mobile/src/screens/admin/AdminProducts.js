import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, Image, TextInput, Alert,
    ActivityIndicator, FlatList, RefreshControl, Platform,
    StyleSheet, Animated, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../../lib/supabase';
import { AdminAddProduct } from './AdminAddProduct';

const { width: W } = Dimensions.get('window');
const SB_HEIGHT = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

const STATUS_META = {
    approved: { bg: '#ECFDF5', text: '#059669', border: '#A7F3D0', icon: 'checkmark-circle' },
    draft:    { bg: '#F1F5F9', text: '#64748B', border: '#CBD5E1', icon: 'ellipse'         },
    pending:  { bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', icon: 'time'            },
    archived: { bg: '#FEF2F2', text: '#DC2626', border: '#FECACA', icon: 'archive'         },
};

// ── Product Card ──────────────────────────────────────────────────────────────
const ProductCard = ({ item, onEdit, onDelete, index }) => {
    const scaleAnim  = useRef(new Animated.Value(0)).current;
    const pressAnim  = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        Animated.spring(scaleAnim, {
            toValue: 1, delay: index * 55, useNativeDriver: true,
            tension: 100, friction: 10,
        }).start();
    }, []);

    const onPressIn  = () => Animated.spring(pressAnim, { toValue: 0.97, useNativeDriver: true }).start();
    const onPressOut = () => Animated.spring(pressAnim, { toValue: 1,    useNativeDriver: true }).start();

    const stock   = item.stock_quantity ?? item.stock ?? 0;
    const isOut   = stock === 0;
    const isLow   = stock > 0 && stock <= 5;
    const sKey    = STATUS_META[item.status] ? item.status : 'pending';
    const sMeta   = STATUS_META[sKey];
    const hasDisc = item.compare_at_price > 0 && item.compare_at_price > item.price;
    const discPct = hasDisc ? Math.round((1 - item.price / item.compare_at_price) * 100) : 0;

    return (
        <Animated.View style={[SS.card, { transform: [{ scale: Animated.multiply(scaleAnim, pressAnim) }] }]}>
            <TouchableOpacity activeOpacity={1} onPressIn={onPressIn} onPressOut={onPressOut} style={{ gap: 12 }}>

                <View style={{ flexDirection: 'row', gap: 12 }}>
                    {/* Image */}
                    <View style={SS.thumbWrap}>
                        <Image
                            source={{ uri: item.images?.[0] || item.image_url || 'https://placehold.co/80' }}
                            style={SS.thumb}
                            resizeMode="cover"
                        />
                        {hasDisc && (
                            <View style={SS.discBadge}>
                                <Text style={{ color: 'white', fontSize: 9, fontWeight: '900' }}>{discPct}%</Text>
                            </View>
                        )}
                        {isOut && (
                            <View style={SS.outBadge}>
                                <Text style={{ color: 'white', fontSize: 7.5, fontWeight: '900' }}>OUT</Text>
                            </View>
                        )}
                    </View>

                    {/* Content */}
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                            <Text style={SS.prodName} numberOfLines={2}>{item.name}</Text>
                            <View style={[SS.statusPill, { backgroundColor: sMeta.bg, borderColor: sMeta.border }]}>
                                <Ionicons name={sMeta.icon} size={10} color={sMeta.text} />
                                <Text style={[SS.statusTxt, { color: sMeta.text }]}>{sKey}</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 4 }}>
                            <Text style={SS.priceMain}>₦{(item.price || 0).toLocaleString()}</Text>
                            {hasDisc && (
                                <Text style={SS.priceOld}>₦{item.compare_at_price.toLocaleString()}</Text>
                            )}
                        </View>

                        {item.vendor_id && (
                            <View style={[SS.infoChip, { marginTop: 4 }]}>
                                <Ionicons name="storefront-outline" size={10} color="#6366F1" />
                                <Text style={[SS.infoChipTxt, { color: '#6366F1' }]} numberOfLines={1}>
                                    {item.vendor_name || 'Vendor Product'}
                                </Text>
                            </View>
                        )}

                        <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                            <View style={[SS.infoChip, isOut && { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                                <Ionicons name="cube-outline" size={10} color={isOut ? '#EF4444' : '#64748B'} />
                                <Text style={[SS.infoChipTxt, isOut && { color: '#EF4444' }]}>
                                    {stock} in stock
                                </Text>
                            </View>
                            {isLow && !isOut && (
                                <View style={[SS.infoChip, { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' }]}>
                                    <Ionicons name="warning" size={10} color="#D9A73A" />
                                    <Text style={[SS.infoChipTxt, { color: '#D9A73A' }]}>Low</Text>
                                </View>
                            )}
                            {item.category ? (
                                <View style={SS.infoChip}>
                                    <Ionicons name="grid-outline" size={10} color="#64748B" />
                                    <Text style={SS.infoChipTxt}>{item.category}</Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                </View>

                {/* Action Row */}
                <View style={SS.actionRow}>
                    <TouchableOpacity onPress={() => onEdit(item)} style={[SS.actionBtn, SS.editBtn]}>
                        <Ionicons name="create-outline" size={14} color="#D9A73A" />
                        <Text style={[SS.actionBtnTxt, { color: '#B45309' }]}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => Alert.alert(
                            'Archive Product',
                            `This will hide "${item.name}" from all buyers. Continue?`,
                            [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Archive', style: 'destructive', onPress: () => onDelete(item.id) }
                            ]
                        )}
                        style={[SS.actionBtn, SS.archiveBtn]}
                    >
                        <Ionicons name="archive-outline" size={14} color="#EF4444" />
                        <Text style={[SS.actionBtnTxt, { color: '#EF4444' }]}>Archive</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

// ── Stats Strip ───────────────────────────────────────────────────────────────
const StatsStrip = ({ products }) => {
    const total     = products.length;
    const live      = products.filter(p => p.status === 'approved').length;
    const outCount  = products.filter(p => (p.stock_quantity ?? p.stock ?? 0) === 0).length;
    const lowCount  = products.filter(p => { const s = p.stock_quantity ?? p.stock ?? 0; return s > 0 && s <= 5; }).length;

    const items = [
        { label: 'Total',     value: total,    color: '#6366F1', icon: 'grid'           },
        { label: 'Live',      value: live,     color: '#059669', icon: 'checkmark-done' },
        { label: 'Low Stock', value: lowCount, color: '#D9A73A', icon: 'warning'        },
        { label: 'Out',       value: outCount, color: '#EF4444', icon: 'close-circle'   },
    ];

    return (
        <View style={SS.statsStrip}>
            {items.map((item, i) => (
                <View key={i} style={[SS.statCell, i < items.length - 1 && { borderRightWidth: 1, borderColor: '#F1F5F9' }]}>
                    <View style={[SS.statIcon, { backgroundColor: item.color + '18' }]}>
                        <Ionicons name={item.icon} size={14} color={item.color} />
                    </View>
                    <Text style={[SS.statValue, { color: item.color }]}>{item.value}</Text>
                    <Text style={SS.statLabel}>{item.label}</Text>
                </View>
            ))}
        </View>
    );
};

// ── Main Component ────────────────────────────────────────────────────────────
export const AdminProducts = ({ navigation, onBack }) => {

    const [view,            setView]            = useState('list');
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [products,        setProducts]        = useState([]);
    const [loading,         setLoading]         = useState(true);
    const [refreshing,      setRefreshing]      = useState(false);
    const [search,          setSearch]          = useState('');
    const [stockFilter,     setStockFilter]     = useState('all');

    useEffect(() => { fetchProducts(); }, []);

    const fetchProducts = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .neq('status', 'archived')
                .order('created_at', { ascending: false })
                .limit(200);

            if (error) {
                Alert.alert('Error Loading Products', error.message);
            } else {
                const prodList = data || [];
                const vendorIds = Array.from(new Set(prodList.map(p => p.vendor_id).filter(Boolean)));
                let nameMap = {};
                if (vendorIds.length > 0) {
                    try {
                        const [{ data: profs }, { data: storeList }] = await Promise.all([
                            supabase.from('profiles').select('id, full_name, email, role').in('id', vendorIds),
                            supabase.from('stores').select('id, vendor_id, name, logo').in('vendor_id', vendorIds)
                        ]);
                        (profs || []).forEach(p => {
                            nameMap[p.id] = p.role === 'admin' ? 'ABU MAFHAL Official Mall' : (p.full_name || 'Vendor');
                        });
                        (storeList || []).forEach(st => {
                            if (st.vendor_id && st.name) {
                                nameMap[st.vendor_id] = st.name;
                            }
                        });
                    } catch (_) {}
                }

                const enriched = prodList.map(p => ({
                    ...p,
                    vendor_name: p.vendor_id
                        ? (nameMap[p.vendor_id] || (p.vendor_id === '6d3df1f5-4983-412e-a45f-db146348aac2' ? 'ABU MAFHAL Official' : 'Vendor Product'))
                        : 'ABU MAFHAL Official'
                }));
                setProducts(enriched);
            }
        } catch (e) {
            Alert.alert('Network Error', 'Could not load products. Pull down to retry.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const handleDelete = useCallback(async (id) => {
        const { error } = await supabase.from('products').update({ status: 'archived' }).eq('id', id);
        if (!error) {
            setProducts(prev => prev.filter(p => p.id !== id));
            Alert.alert('Archived ✓', 'Product hidden from buyers.');
        } else {
            Alert.alert('Error', error.message);
        }
    }, []);

    const handleEdit = useCallback((product) => {
        setSelectedProduct(product);
        setView('add');
    }, []);

    // ── Add / Edit View ──────────────────────────────────────────────────────
    if (view === 'add') {
        return (
            <AdminAddProduct
                initialData={selectedProduct}
                onCancel={() => { setView('list'); setSelectedProduct(null); }}
                onSuccess={() => { setView('list'); setSelectedProduct(null); fetchProducts(); }}
            />
        );
    }

    // ── Filter ───────────────────────────────────────────────────────────────
    const filtered = products.filter(p => {
        const matchSearch = p.name?.toLowerCase().includes(search.toLowerCase());
        const stock = p.stock_quantity ?? p.stock ?? 0;
        if (stockFilter === 'out') return matchSearch && stock === 0;
        if (stockFilter === 'low') return matchSearch && stock > 0 && stock <= 5;
        return matchSearch;
    });

    const FILTERS = [
        { key: 'all', label: `All (${products.length})`,  color: '#0E1A2E' },
        { key: 'low', label: `Low Stock`,                  color: '#B45309' },
        { key: 'out', label: `Out of Stock`,               color: '#DC2626' },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* ── Navy Header ── */}
            <LinearGradient
                colors={[NAVY, '#162235']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[SS.header, { paddingTop: SB_HEIGHT + 8 }]}
            >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 }}>
                    {(navigation?.canGoBack?.() || onBack) && (
                        <TouchableOpacity onPress={onBack || (() => navigation.goBack())} style={SS.iconBtn}>
                            <Ionicons name="arrow-back" size={18} color={GOLD} />
                        </TouchableOpacity>
                    )}
                    <View>
                        <Text style={SS.headerTitle}>Product Catalog</Text>
                        <Text style={SS.headerSub}>
                            {loading ? 'Loading...' : `${filtered.length} of ${products.length} products`}
                        </Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={() => { setSelectedProduct(null); setView('add'); }}
                    style={SS.addBtn}
                >
                    <Ionicons name="add" size={16} color={GOLD} />
                    <Text style={SS.addBtnTxt}>Add New</Text>
                </TouchableOpacity>
            </LinearGradient>

            {/* Stats Strip — compact */}
            {!loading && products.length > 0 && <StatsStrip products={products} />}

            {/* Search & Filters */}
            <View style={SS.toolbar}>
                <View style={SS.searchBox}>
                    <Ionicons name="search" size={15} color="#94A3B8" />
                    <TextInput
                        placeholder="Search products..."
                        placeholderTextColor="#94A3B8"
                        value={search}
                        onChangeText={setSearch}
                        style={SS.searchInput}
                        returnKeyType="search"
                    />
                    {search.length > 0 && (
                        <TouchableOpacity onPress={() => setSearch('')}>
                            <Ionicons name="close-circle" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    )}
                </View>

                <View style={{ flexDirection: 'row', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                    {FILTERS.map(f => {
                        const active = stockFilter === f.key;
                        return (
                            <TouchableOpacity
                                key={f.key}
                                onPress={() => setStockFilter(f.key)}
                                style={[SS.filterPill, active && { backgroundColor: f.color, borderColor: f.color }]}
                            >
                                <Text style={[SS.filterTxt, active && { color: 'white' }]}>{f.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>

            {/* List */}
            {loading && !refreshing ? (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#0E1A2E" />
                    <Text style={{ color: '#94A3B8', marginTop: 12, fontWeight: '600' }}>Loading catalog...</Text>
                </View>
            ) : (
                <FlatList
                    data={filtered}
                    keyExtractor={item => item.id?.toString()}
                    contentContainerStyle={{ padding: 14, paddingBottom: 100 }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchProducts(); }}
                            colors={['#0E1A2E']}
                            tintColor="#0E1A2E"
                        />
                    }
                    renderItem={({ item, index }) => (
                        <ProductCard
                            item={item}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            index={index}
                        />
                    )}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', paddingTop: 60, gap: 12 }}>
                            <View style={SS.emptyIcon}>
                                <Ionicons name="cube-outline" size={44} color="#CBD5E1" />
                            </View>
                            <Text style={SS.emptyTitle}>
                                {search ? `No matches for "${search}"` : 'No products found'}
                            </Text>
                            <Text style={SS.emptySub}>
                                {search ? 'Try a different keyword.' : 'Tap Add New to populate the catalog.'}
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const SS = StyleSheet.create({
    // Header — navy gradient
    header:       { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: 'rgba(217,167,58,0.25)' },
    iconBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
    headerTitle:  { fontSize: 17, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
    headerSub:    { fontSize: 10, color: 'rgba(255,255,255,0.48)', marginTop: 1 },
    addBtn:       { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(217,167,58,0.15)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, borderWidth: 1, borderColor: GOLD },
    addBtnTxt:    { color: GOLD, fontWeight: '800', fontSize: 12 },

    // Stats — compact single-row
    statsStrip:   { flexDirection: 'row', backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' },
    statCell:     { flex: 1, alignItems: 'center', paddingVertical: 9, gap: 2 },
    statIcon:     { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center', marginBottom: 1 },
    statValue:    { fontSize: 15, fontWeight: '900' },
    statLabel:    { fontSize: 8.5, color: '#94A3B8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.4 },

    // Toolbar
    toolbar:      { backgroundColor: 'white', paddingHorizontal: 14, paddingTop: 10, paddingBottom: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    searchBox:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 11, height: 40, gap: 7, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput:  { flex: 1, fontSize: 13.5, fontWeight: '600', color: '#0E1A2E', height: '100%' },
    filterPill:   { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 18, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
    filterTxt:    { fontSize: 11.5, fontWeight: '700', color: '#64748B' },

    // Product card
    card:         { backgroundColor: 'white', borderRadius: 16, padding: 13, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 2 },
    thumbWrap:    { width: 70, height: 70, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    thumb:        { width: '100%', height: '100%' },
    discBadge:    { position: 'absolute', top: 0, left: 0, backgroundColor: '#EF4444', paddingHorizontal: 5, paddingVertical: 3, borderBottomRightRadius: 8 },
    outBadge:     { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(239,68,68,0.85)', alignItems: 'center', paddingVertical: 3 },
    prodName:     { fontSize: 13.5, fontWeight: '800', color: '#0E1A2E', flex: 1, lineHeight: 19 },
    priceMain:    { fontSize: 15, fontWeight: '900', color: '#0E1A2E', letterSpacing: -0.2 },
    priceOld:     { fontSize: 11, color: '#94A3B8', fontWeight: '600', textDecorationLine: 'line-through' },
    statusPill:   { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, borderWidth: 1 },
    statusTxt:    { fontSize: 9.5, fontWeight: '800', textTransform: 'capitalize' },
    infoChip:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 7, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    infoChipTxt:  { fontSize: 10.5, fontWeight: '600', color: '#64748B', maxWidth: 95 },
    actionRow:    { flexDirection: 'row', gap: 7, paddingTop: 10, borderTopWidth: 1, borderColor: '#F1F5F9' },
    actionBtn:    { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, paddingVertical: 8, borderRadius: 11, borderWidth: 1 },
    actionBtnTxt: { fontSize: 12.5, fontWeight: '800' },
    editBtn:      { backgroundColor: '#FFFBEB', borderColor: '#FDE68A' },
    archiveBtn:   { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },

    emptyIcon:    { width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
    emptyTitle:   { fontSize: 15, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' },
    emptySub:     { fontSize: 12.5, color: '#94A3B8', textAlign: 'center', maxWidth: W * 0.72 },
});
