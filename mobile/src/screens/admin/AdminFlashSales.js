import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Switch, ScrollView, ActivityIndicator, Image, Modal, FlatList } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminFlashSales = () => {
    const [sale, setSale] = useState(null);
    const [title, setTitle] = useState('Flash Sale');
    const [endTime, setEndTime] = useState('');
    const [selectedProductIds, setSelectedProductIds] = useState([]);
    const [discountPercent, setDiscountPercent] = useState('20');
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    // Product Picker State
    const [showPicker, setShowPicker] = useState(false);
    const [allProducts, setAllProducts] = useState([]);
    const [pickerSearch, setPickerSearch] = useState('');
    const [loadingProducts, setLoadingProducts] = useState(false);

    useEffect(() => {
        fetchSale();
        loadAllProducts();
    }, []);

    const fetchSale = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('flash_sales')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (data) {
                setSale(data);
                setTitle(data.title || 'Flash Sale');
                setEndTime(data.end_time ? new Date(data.end_time).toISOString() : '');
                setSelectedProductIds(Array.isArray(data.product_ids) ? data.product_ids : []);
                setIsActive(Boolean(data.is_active));
                setDiscountPercent(data.discount_percent ? String(data.discount_percent) : '20');
            } else {
                // Default 24h
                setEndTime(new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString());
            }
        } catch (e) {
            console.error('Fetch Flash Sale error:', e);
        } finally {
            setLoading(false);
        }
    };

    const loadAllProducts = async () => {
        setLoadingProducts(true);
        try {
            const { data } = await supabase
                .from('products')
                .select('id, name, price, stock, stock_quantity, images, image_url, category')
                .neq('status', 'archived')
                .order('created_at', { ascending: false })
                .limit(200);

            setAllProducts(data || []);
        } catch (e) {
            console.error('Error loading products for flash sale:', e);
        } finally {
            setLoadingProducts(false);
        }
    };

    const toggleProductSelection = (id) => {
        setSelectedProductIds(prev => {
            if (prev.includes(id)) {
                return prev.filter(pId => pId !== id);
            } else {
                return [...prev, id];
            }
        });
    };

    const setQuickDuration = (hours) => {
        const target = new Date(Date.now() + hours * 60 * 60 * 1000);
        setEndTime(target.toISOString());
    };

    const handleSave = async () => {
        const discount = parseInt(discountPercent, 10) || 0;

        try {
            setSaving(true);

            const payload = {
                title: title.trim() || 'Flash Sale',
                end_time: endTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                is_active: isActive,
                product_ids: selectedProductIds,
                discount_percent: discount
            };

            let result;
            if (sale?.id) {
                result = await supabase.from('flash_sales').update(payload).eq('id', sale.id);
            } else {
                result = await supabase.from('flash_sales').insert([payload]);
            }

            if (result.error) throw result.error;

            Alert.alert(
                'Success!',
                isActive 
                    ? `Flash Sale activated with ${discount}% discount on ${selectedProductIds.length} products.`
                    : 'Flash Sale deactivated successfully.'
            );

            fetchSale();
        } catch (e) {
            Alert.alert('Error', e.message || 'Failed to save Flash Sale settings.');
        } finally {
            setSaving(false);
        }
    };

    const filteredProductsForPicker = allProducts.filter(p => {
        if (!pickerSearch.trim()) return true;
        const q = pickerSearch.toLowerCase();
        return (p.name || '').toLowerCase().includes(q) || (p.category || '').toLowerCase().includes(q);
    });

    const selectedProductsList = allProducts.filter(p => selectedProductIds.includes(p.id));

    return (
        <ScrollView 
            style={{ flex: 1, backgroundColor: '#F8FAFC' }} 
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
        >
            {/* HEADER CARD */}
            <LinearGradient
                colors={[NAVY, '#162235']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{
                    borderRadius: 22,
                    padding: 20,
                    marginBottom: 16,
                    borderWidth: 1,
                    borderColor: 'rgba(217, 167, 58, 0.35)',
                    shadowColor: NAVY,
                    shadowOffset: { width: 0, height: 6 },
                    shadowOpacity: 0.12,
                    shadowRadius: 10,
                    elevation: 3
                }}
            >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="flash" size={18} color={GOLD} />
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#FFFFFF' }}>
                                Flash Sale Manager
                            </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 4 }}>
                            Configure limited-time promotions with live countdown timers
                        </Text>
                    </View>

                    <View style={{
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                        borderRadius: 10,
                        backgroundColor: isActive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                        borderWidth: 1,
                        borderColor: isActive ? '#10B981' : '#EF4444'
                    }}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: isActive ? '#10B981' : '#EF4444' }}>
                            {isActive ? 'ACTIVE' : 'INACTIVE'}
                        </Text>
                    </View>
                </View>
            </LinearGradient>

            {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Loading Flash Sale settings...</Text>
                </View>
            ) : (
                <View style={{ gap: 14 }}>
                    {/* SETTINGS CARD */}
                    <View style={{ backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        {/* Status Switch */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }}>
                            <View>
                                <Text style={{ fontWeight: '800', fontSize: 14, color: NAVY }}>Enable Flash Sale</Text>
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>Displays on homepage with live countdown timer</Text>
                            </View>
                            <Switch
                                value={isActive}
                                onValueChange={setIsActive}
                                trackColor={{ false: '#E2E8F0', true: GOLD }}
                                thumbColor={isActive ? NAVY : '#FFFFFF'}
                            />
                        </View>

                        {/* Title */}
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                            Campaign Title
                        </Text>
                        <TextInput
                            style={{ backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 14, fontSize: 13, color: NAVY, fontWeight: '700' }}
                            value={title}
                            onChangeText={setTitle}
                            placeholder="e.g. Mega Weekend Flash Sale"
                            placeholderTextColor="#94A3B8"
                        />

                        {/* Discount Percent */}
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                            Discount Percentage (%)
                        </Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                            <TextInput
                                style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16, color: NAVY, fontWeight: '900' }}
                                value={discountPercent}
                                onChangeText={setDiscountPercent}
                                keyboardType="numeric"
                                placeholder="20"
                                placeholderTextColor="#94A3B8"
                            />
                            {['10', '20', '30', '50'].map(pct => (
                                <TouchableOpacity
                                    key={pct}
                                    onPress={() => setDiscountPercent(pct)}
                                    style={{
                                        paddingHorizontal: 12,
                                        paddingVertical: 10,
                                        borderRadius: 10,
                                        backgroundColor: discountPercent === pct ? NAVY : '#F1F5F9',
                                        borderWidth: 1,
                                        borderColor: discountPercent === pct ? GOLD : '#E2E8F0'
                                    }}
                                >
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: discountPercent === pct ? GOLD : '#64748B' }}>
                                        {pct}%
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Duration Preset Buttons */}
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                            Campaign Duration
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                            {[
                                { label: '6 Hours', h: 6 },
                                { label: '12 Hours', h: 12 },
                                { label: '24 Hours', h: 24 },
                                { label: '3 Days', h: 72 },
                                { label: '1 Week', h: 168 }
                            ].map(item => (
                                <TouchableOpacity
                                    key={item.label}
                                    onPress={() => setQuickDuration(item.h)}
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 7,
                                        borderRadius: 10,
                                        backgroundColor: '#F8FAFC',
                                        borderWidth: 1,
                                        borderColor: 'rgba(217, 167, 58, 0.3)'
                                    }}
                                >
                                    <Text style={{ fontSize: 10.5, fontWeight: '800', color: NAVY }}>{item.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 6 }}>
                            Ends At: {endTime ? new Date(endTime).toLocaleString() : 'None'}
                        </Text>
                    </View>

                    {/* LINKED PRODUCTS CARD */}
                    <View style={{ backgroundColor: '#FFFFFF', padding: 18, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <View>
                                <Text style={{ fontWeight: '800', fontSize: 14, color: NAVY }}>
                                    Flash Sale Included Products
                                </Text>
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>
                                    An zabi kaya {selectedProductIds.length}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => setShowPicker(true)}
                                style={{
                                    flexDirection: 'row',
                                    alignItems: 'center',
                                    gap: 5,
                                    backgroundColor: NAVY,
                                    paddingHorizontal: 12,
                                    paddingVertical: 7,
                                    borderRadius: 10,
                                    borderWidth: 1,
                                    borderColor: GOLD
                                }}
                            >
                                <Ionicons name="add-circle-outline" size={15} color={GOLD} />
                                <Text style={{ fontSize: 11, fontWeight: '800', color: GOLD }}>Select Sale Products</Text>
                            </TouchableOpacity>
                        </View>

                        {selectedProductsList.length === 0 ? (
                            <View style={{ padding: 20, alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12 }}>
                                <Ionicons name="cube-outline" size={32} color="#CBD5E1" />
                                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 6, fontWeight: '600' }}>
                                    Ba a zaɓi ko wanne kaya ba tukuna. Latsa "Select Sale Products" a sama.
                                </Text>
                            </View>
                        ) : (
                            selectedProductsList.map(prod => {
                                const img = prod.images?.[0] || prod.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100';
                                return (
                                    <View
                                        key={prod.id}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            paddingVertical: 8,
                                            borderBottomWidth: 1,
                                            borderBottomColor: '#F1F5F9'
                                        }}
                                    >
                                        <Image source={{ uri: img }} style={{ width: 38, height: 38, borderRadius: 8, backgroundColor: '#F8FAFC', marginRight: 10 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1} style={{ fontSize: 12.5, fontWeight: '800', color: NAVY }}>{prod.name}</Text>
                                            <Text style={{ fontSize: 11, color: GOLD, fontWeight: '800' }}>
                                                ₦{Number(prod.price || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                        <TouchableOpacity
                                            onPress={() => toggleProductSelection(prod.id)}
                                            style={{ padding: 6 }}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                );
                            })
                        )}
                    </View>

                    {/* SAVE BUTTON */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={{
                            backgroundColor: NAVY,
                            padding: 16,
                            borderRadius: 16,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: GOLD,
                            shadowColor: NAVY,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 2
                        }}
                    >
                        {saving ? (
                            <ActivityIndicator color={GOLD} />
                        ) : (
                            <Text style={{ color: GOLD, fontWeight: '900', fontSize: 14, letterSpacing: 0.3 }}>
                                SAVE FLASH SALE SETTINGS
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}

            {/* PRODUCT PICKER MODAL */}
            <Modal
                visible={showPicker}
                animationType="slide"
                onRequestClose={() => setShowPicker(false)}
            >
                <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                    <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: NAVY }}>Select Flash Sale Products</Text>
                            <Text style={{ fontSize: 11, color: '#64748B' }}>Selected: {selectedProductIds.length}</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setShowPicker(false)}
                            style={{ backgroundColor: NAVY, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: GOLD }}
                        >
                            <Text style={{ color: GOLD, fontWeight: '800', fontSize: 12 }}>Done</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={{ padding: 12, backgroundColor: '#FFFFFF' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <Ionicons name="search" size={16} color="#94A3B8" />
                            <TextInput
                                placeholder="Search products by name or category..."
                                value={pickerSearch}
                                onChangeText={setPickerSearch}
                                style={{ flex: 1, marginLeft: 8, fontSize: 13, color: NAVY }}
                                placeholderTextColor="#94A3B8"
                            />
                        </View>
                    </View>

                    {loadingProducts ? (
                        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                            <ActivityIndicator size="large" color={GOLD} />
                        </View>
                    ) : (
                        <FlatList
                            data={filteredProductsForPicker}
                            keyExtractor={item => item.id}
                            contentContainerStyle={{ padding: 16 }}
                            renderItem={({ item }) => {
                                const isSelected = selectedProductIds.includes(item.id);
                                const img = item.images?.[0] || item.image_url || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=100';
                                return (
                                    <TouchableOpacity
                                        onPress={() => toggleProductSelection(item.id)}
                                        activeOpacity={0.7}
                                        style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            padding: 12,
                                            backgroundColor: '#FFFFFF',
                                            borderRadius: 14,
                                            marginBottom: 10,
                                            borderWidth: 1,
                                            borderColor: isSelected ? GOLD : '#E2E8F0'
                                        }}
                                    >
                                        <Image source={{ uri: img }} style={{ width: 44, height: 44, borderRadius: 10, backgroundColor: '#F8FAFC', marginRight: 12 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: NAVY }}>{item.name}</Text>
                                            <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>{item.category || 'General Product'}</Text>
                                            <Text style={{ fontSize: 12, fontWeight: '900', color: NAVY, marginTop: 2 }}>
                                                ₦{Number(item.price || 0).toLocaleString()}
                                            </Text>
                                        </View>
                                        <View style={{
                                            width: 26,
                                            height: 26,
                                            borderRadius: 8,
                                            backgroundColor: isSelected ? GOLD : '#F1F5F9',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            borderWidth: 1,
                                            borderColor: isSelected ? GOLD : '#CBD5E1'
                                        }}>
                                            {isSelected && <Ionicons name="checkmark" size={17} color={NAVY} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    )}
                </View>
            </Modal>
        </ScrollView>
    );
};
