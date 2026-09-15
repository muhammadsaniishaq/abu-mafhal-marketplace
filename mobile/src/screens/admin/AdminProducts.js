import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, Image, TextInput, Alert,
    ActivityIndicator, FlatList, RefreshControl, Platform,
    StyleSheet, Animated, Dimensions, StatusBar, Modal
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
            <TouchableOpacity activeOpacity={1} onPressIn={onPressIn} onPressOut={onPressOut}
                style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>

                {/* Thumbnail */}
                <View style={SS.thumbWrap}>
                    <Image
                        source={{ uri: item.images?.[0] || item.image_url || 'https://placehold.co/64' }}
                        style={SS.thumb} resizeMode="cover"
                    />
                    {hasDisc && (
                        <View style={SS.discBadge}>
                            <Text style={{ color: 'white', fontSize: 8, fontWeight: '900' }}>{discPct}%</Text>
                        </View>
                    )}
                    {isOut && (
                        <View style={SS.outBadge}>
                            <Text style={{ color: 'white', fontSize: 7, fontWeight: '900' }}>OUT</Text>
                        </View>
                    )}
                </View>

                {/* Content */}
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 6 }}>
                        <Text style={SS.prodName} numberOfLines={1}>{item.name}</Text>
                        <View style={[SS.statusPill, { backgroundColor: sMeta.bg, borderColor: sMeta.border }]}>
                            <Text style={[SS.statusTxt, { color: sMeta.text }]}>{sKey}</Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                        <Text style={SS.priceMain}>₦{(item.price || 0).toLocaleString()}</Text>
                        {hasDisc && <Text style={SS.priceOld}>₦{item.compare_at_price.toLocaleString()}</Text>}
                        {isLow && !isOut && <Text style={{ fontSize: 9.5, color: '#D9A73A', fontWeight: '800' }}>⚠ Low</Text>}
                    </View>

                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 5, alignItems: 'center' }}>
                        <TouchableOpacity onPress={() => onEdit(item)} style={SS.actionBtnS}>
                            <Ionicons name="create-outline" size={11} color="#B45309" />
                            <Text style={[SS.actionBtnSTxt, { color: '#B45309' }]}>Edit</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => onDelete(item)}
                            style={[SS.actionBtnS, { backgroundColor: '#FEF2F2', borderColor: '#FECACA' }]}>
                            <Ionicons name="trash-outline" size={11} color="#DC2626" />
                            <Text style={[SS.actionBtnSTxt, { color: '#DC2626' }]}>Delete</Text>
                        </TouchableOpacity>
                        {item.category && (
                            <Text style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: '600' }}>{item.category}</Text>
                        )}
                        <Text style={{ fontSize: 9.5, color: isOut ? '#EF4444' : '#94A3B8', fontWeight: '600', marginLeft: 'auto' }}>{stock} pcs</Text>
                    </View>
                </View>
            </TouchableOpacity>
        </Animated.View>
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

    const [productToDelete, setProductToDelete] = useState(null);
    const [deleting, setDeleting] = useState(false);

    const handleDelete = useCallback((product) => {
        setProductToDelete(product);
    }, []);

    const confirmDeleteProduct = useCallback(async () => {
        if (!productToDelete) return;
        const id = productToDelete.id;
        setDeleting(true);
        try {
            // 1. First attempt hard delete with .select() to verify rows actually deleted
            const { data: delData, error: delError } = await supabase
                .from('products')
                .delete()
                .eq('id', id)
                .select('id');

            if (!delError && delData && delData.length > 0) {
                setProducts(prev => prev.filter(p => p.id !== id));
                setProductToDelete(null);
                if (Platform.OS === 'web') alert('Product successfully deleted.');
                else Alert.alert('Deleted ✅', 'Product successfully removed from store.');
                return;
            }

            console.warn('Hard delete affected 0 rows (FK or RLS), falling back to archive:', delError?.message);

            // 2. Fallback: Archive & deactivate product so it immediately vanishes from store
            const { data: archData, error: archError } = await supabase
                .from('products')
                .update({ 
                    status: 'archived', 
                    is_active: false,
                    stock: 0,
                    stock_quantity: 0 
                })
                .eq('id', id)
                .select('id');

            if (!archError && archData && archData.length > 0) {
                setProducts(prev => prev.filter(p => p.id !== id));
                setProductToDelete(null);
                if (Platform.OS === 'web') alert('Product archived & removed from store.');
                else Alert.alert('Archived & Removed ✅', 'Product has past order history, so it was safely hidden and removed from active catalog.');
                return;
            }

            // 3. Fallback without .select()
            const { error: simpleArcError } = await supabase
                .from('products')
                .update({ 
                    status: 'archived', 
                    is_active: false,
                    stock: 0,
                    stock_quantity: 0 
                })
                .eq('id', id);

            if (!simpleArcError) {
                setProducts(prev => prev.filter(p => p.id !== id));
                setProductToDelete(null);
                if (Platform.OS === 'web') alert('Product archived & removed from store.');
                else Alert.alert('Archived & Removed ✅', 'Product removed from active catalog.');
                return;
            }

            throw delError || archError || simpleArcError || new Error('Could not delete product.');
        } catch (err) {
            if (Platform.OS === 'web') alert('Delete Failed: ' + (err?.message || 'Could not delete product.'));
            else Alert.alert('Delete Failed ❌', err?.message || 'Could not delete product.');
        } finally {
            setDeleting(false);
        }
    }, [productToDelete]);

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

            {/* ── Compact Navy Header with inline stats ── */}
            <LinearGradient
                colors={[NAVY, '#162235']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[SS.header, { paddingTop: SB_HEIGHT + 6 }]}
            >
                {/* Row 1: back + title + add btn */}
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    {(navigation?.canGoBack?.() || onBack) && (
                        <TouchableOpacity onPress={onBack || (() => navigation.goBack())} style={SS.iconBtn}>
                            <Ionicons name="arrow-back" size={18} color={GOLD} />
                        </TouchableOpacity>
                    )}
                    <Text style={[SS.headerTitle, { flex: 1, marginLeft: onBack || navigation?.canGoBack?.() ? 10 : 0 }]}>Product Catalog</Text>
                    <TouchableOpacity
                        onPress={() => { setSelectedProduct(null); setView('add'); }}
                        style={SS.addBtn}
                    >
                        <Ionicons name="add" size={15} color={GOLD} />
                        <Text style={SS.addBtnTxt}>Add</Text>
                    </TouchableOpacity>
                </View>

                {/* Row 2: inline stats pills */}
                {!loading && products.length > 0 && (
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 8 }}>
                        {[
                            { label: `${products.length} Total`,   color: 'rgba(255,255,255,0.55)' },
                            { label: `${products.filter(p => p.status === 'approved').length} Live`, color: '#34D399' },
                            { label: `${products.filter(p => { const s = p.stock_quantity ?? p.stock ?? 0; return s > 0 && s <= 5; }).length} Low`, color: GOLD },
                            { label: `${products.filter(p => (p.stock_quantity ?? p.stock ?? 0) === 0).length} Out`, color: '#F87171' },
                        ].map((s, i) => (
                            <View key={i} style={SS.statPill}>
                                <Text style={[SS.statPillTxt, { color: s.color }]}>{s.label}</Text>
                            </View>
                        ))}
                    </View>
                )}
            </LinearGradient>

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

            {/* ── IN-APP DELETE CONFIRMATION MODAL (100% CROSS-PLATFORM) ── */}
            <Modal
                visible={!!productToDelete}
                transparent
                animationType="fade"
                onRequestClose={() => !deleting && setProductToDelete(null)}
            >
                <View style={SS.modalOverlay}>
                    <View style={SS.modalBox}>
                        <View style={SS.modalIconCircle}>
                            <Ionicons name="trash" size={26} color="#DC2626" />
                        </View>
                        <Text style={SS.modalHead}>Delete Product</Text>
                        <Text style={SS.modalBody}>
                            Are you sure you want to delete{' '}
                            <Text style={{ fontWeight: '800', color: '#0F172A' }}>
                                "{productToDelete?.name}"
                            </Text>
                            ? This will remove the item from your store.
                        </Text>
                        <View style={SS.modalActions}>
                            <TouchableOpacity
                                disabled={deleting}
                                onPress={() => setProductToDelete(null)}
                                style={SS.modalCancel}
                            >
                                <Text style={SS.modalCancelTxt}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={deleting}
                                onPress={confirmDeleteProduct}
                                style={SS.modalConfirm}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                                        <Text style={SS.modalConfirmTxt}>Delete Now</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const SS = StyleSheet.create({
    // Header
    header:        { paddingHorizontal: 14, paddingBottom: 10, borderBottomWidth: 1, borderColor: 'rgba(217,167,58,0.2)' },
    iconBtn:       { width: 32, height: 32, borderRadius: 9, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
    headerTitle:   { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
    addBtn:        { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(217,167,58,0.18)', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: GOLD },
    addBtnTxt:     { color: GOLD, fontWeight: '800', fontSize: 12 },
    statPill:      { backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
    statPillTxt:   { fontSize: 10.5, fontWeight: '700' },

    // Toolbar
    toolbar:       { backgroundColor: 'white', paddingHorizontal: 12, paddingTop: 8, paddingBottom: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    searchBox:     { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 10, height: 36, gap: 6, borderWidth: 1, borderColor: '#E2E8F0' },
    searchInput:   { flex: 1, fontSize: 13, fontWeight: '600', color: '#0E1A2E', height: '100%' },
    filterPill:    { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0' },
    filterTxt:     { fontSize: 11, fontWeight: '700', color: '#64748B' },

    // Ultra-compact product card
    card:          { backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 7, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 4, elevation: 1 },
    thumbWrap:     { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    thumb:         { width: '100%', height: '100%' },
    discBadge:     { position: 'absolute', top: 0, left: 0, backgroundColor: '#EF4444', paddingHorizontal: 4, paddingVertical: 2, borderBottomRightRadius: 6 },
    outBadge:      { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(239,68,68,0.85)', alignItems: 'center', paddingVertical: 2 },
    prodName:      { fontSize: 13, fontWeight: '800', color: '#0E1A2E', flex: 1, lineHeight: 18 },
    priceMain:     { fontSize: 13.5, fontWeight: '900', color: '#0E1A2E' },
    priceOld:      { fontSize: 10.5, color: '#94A3B8', fontWeight: '600', textDecorationLine: 'line-through' },
    statusPill:    { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    statusTxt:     { fontSize: 9, fontWeight: '800', textTransform: 'capitalize' },
    actionBtnS:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 7, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    actionBtnSTxt: { fontSize: 10.5, fontWeight: '700' },

    emptyIcon:     { width: 72, height: 72, borderRadius: 36, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0' },
    emptyTitle:    { fontSize: 14.5, fontWeight: '800', color: '#0E1A2E', textAlign: 'center' },
    emptySub:      { fontSize: 12, color: '#94A3B8', textAlign: 'center', maxWidth: W * 0.72 },

    // In-app Delete Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    modalBox: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#FFFFFF',
        borderRadius: 18,
        padding: 22,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 16,
        elevation: 8,
    },
    modalIconCircle: {
        width: 52,
        height: 52,
        borderRadius: 26,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    modalHead: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
    },
    modalBody: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    modalActions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    modalCancel: {
        flex: 1,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalCancelTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    modalConfirm: {
        flex: 1.2,
        paddingVertical: 11,
        borderRadius: 10,
        backgroundColor: '#DC2626',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    modalConfirmTxt: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },
});
