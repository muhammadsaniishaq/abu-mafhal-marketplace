import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, UIManager, FlatList, Image, StatusBar, Platform, Alert, LayoutAnimation, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

// Enable LayoutAnimation on Android (Safe check for New Architecture)
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

import { parsePrice } from '../utils/helpers';

export const CartPage = ({ cart, onUpdateQty, onRemove, onBack, onClear }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    const total = cart.reduce((sum, item) => {
        const price = parsePrice(item.price);
        const qty = parseInt(item.qty || item.quantity || 1) || 1;
        return sum + (price * qty);
    }, 0);

    const handleRemove = (id) => {
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        onRemove(id);
    };

    const handleClearCart = () => {
        Alert.alert(
            'Clear Cart',
            'Are you sure you want to remove all items?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: () => {
                        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                        if (onClear) onClear();
                    }
                }
            ]
        );
    };

    const handleCheckout = async () => {
        if (cart.length === 0) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Login Required', 'Please login to checkout');
                return;
            }

            navigation.navigate('CheckoutPage', { cart, total });
        } catch (e) {
            console.log(e);
        }
    };

    const renderItem = ({ item }) => {
        if (!item) return null;
        const imageUrl = item?.images?.[0] || (item?.img || 'https://placehold.co/100x100?text=No+Image');
        const qty = item.qty || item.quantity || 1;

        return (
            <View style={styles.card}>
                <Image
                    source={{ uri: imageUrl }}
                    style={styles.image}
                />

                <View style={styles.content}>
                    <View style={styles.cardHeader}>
                        <Text style={styles.name} numberOfLines={2}>
                            {item.name}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemove(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>

                    <Text style={styles.meta}>
                        {item.brand || 'Generic'}
                        {item.variants && item.variants.length > 0 ? ` • ${item.variants[0].name}` : ''}
                    </Text>

                    <View style={styles.footerRow}>
                        <Text style={styles.price}>
                            ₦{parsePrice(item.price).toLocaleString()}
                        </Text>

                        <View style={styles.qtyContainer}>
                            <TouchableOpacity
                                onPress={() => onUpdateQty(item?.id, -1)}
                                style={styles.qtyBtn}
                            >
                                <Ionicons name="remove" size={16} color="#0F172A" />
                            </TouchableOpacity>
                            <Text style={styles.qtyText}>
                                {qty}
                            </Text>
                            <TouchableOpacity
                                onPress={() => onUpdateQty(item?.id, 1)}
                                style={styles.qtyBtn}
                            >
                                <Ionicons name="add" size={16} color="#0F172A" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            <View style={[styles.header, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : insets.top + 10 }]}>
                <View style={styles.headerLeft}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>My Cart</Text>
                </View>

                {cart.length > 0 && (
                    <TouchableOpacity onPress={handleClearCart} style={styles.clearBtn}>
                        <Text style={styles.clearText}>Clear</Text>
                        <Ionicons name="trash-bin-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                )}
            </View>

            {cart.length > 0 ? (
                <FlatList
                    data={cart}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={styles.emptyContainer}>
                    <View style={styles.emptyIconBox}>
                        <Ionicons name="cart-outline" size={60} color="#94A3B8" />
                    </View>
                    <Text style={styles.emptyTitle}>Your cart is empty</Text>
                    <Text style={styles.emptySub}>
                        Looks like you haven't added anything to your cart yet.
                    </Text>
                    <TouchableOpacity onPress={onBack} style={styles.shopBtn}>
                        <Text style={styles.shopBtnText}>Start Shopping</Text>
                    </TouchableOpacity>
                </View>
            )}

            {cart.length > 0 && (
                <View style={[styles.checkoutBar, { paddingBottom: insets.bottom + 20 }]}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>₦{total.toLocaleString()}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Shipping</Text>
                        <Text style={styles.shippingLabel}>Calculated at checkout</Text>
                    </View>

                    <TouchableOpacity onPress={handleCheckout} style={styles.checkoutBtn}>
                        <Text style={styles.checkoutBtnText}>Checkout</Text>
                        <Text style={styles.checkoutBtnDot}>•</Text>
                        <Text style={styles.checkoutBtnAmount}>₦{total.toLocaleString()}</Text>
                        <Ionicons name="arrow-forward" size={20} color="white" style={styles.checkoutIcon} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    header: {
        paddingBottom: 16,
        paddingHorizontal: 20,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10 },
            android: { elevation: 4 }
        }),
        zIndex: 10
    },
    headerLeft: { flexDirection: 'row', alignItems: 'center' },
    backBtn: { marginRight: 16 },
    headerTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A' },
    clearBtn: { flexDirection: 'row', alignItems: 'center', padding: 8 },
    clearText: { color: '#EF4444', fontWeight: '600', marginRight: 4 },
    listContent: { padding: 20, paddingBottom: 180 },
    card: {
        flexDirection: 'row',
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 12,
        marginBottom: 16,
        alignItems: 'center',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10 },
            android: { elevation: 3 }
        })
    },
    image: { width: 90, height: 90, borderRadius: 16, backgroundColor: '#F1F5F9' },
    content: { flex: 1, marginLeft: 16 },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    name: { fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 },
    meta: { fontSize: 13, color: '#64748B', marginTop: 4 },
    footerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 },
    price: { fontSize: 17, fontWeight: '800', color: '#0F172A' },
    qtyContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, padding: 2, borderWidth: 1, borderColor: '#E2E8F0' },
    qtyBtn: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
    qtyText: { width: 34, textAlign: 'center', fontSize: 15, fontWeight: '700', color: '#0F172A' },
    emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
    emptyIconBox: { width: 120, height: 120, backgroundColor: '#F1F5F9', borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
    emptyTitle: { fontSize: 22, fontWeight: '800', color: '#0F172A', marginBottom: 8 },
    emptySub: { fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32, lineHeight: 22 },
    shopBtn: { backgroundColor: '#0F172A', paddingHorizontal: 32, paddingVertical: 18, borderRadius: 30 },
    shopBtnText: { color: 'white', fontWeight: '800', fontSize: 16 },
    checkoutBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        padding: 20,
        borderTopWidth: 1,
        borderColor: '#F1F5F9',
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 15 },
            android: { elevation: 20 }
        })
    },
    summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 },
    summaryLabel: { color: '#64748B', fontSize: 15, fontWeight: '500' },
    summaryValue: { color: '#0F172A', fontSize: 17, fontWeight: '700' },
    shippingLabel: { color: '#64748B', fontSize: 13, fontWeight: '600', fontStyle: 'italic' },
    checkoutBtn: {
        backgroundColor: '#0F172A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 64,
        borderRadius: 20,
        ...Platform.select({
            ios: { shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.2, shadowRadius: 15 },
            android: { elevation: 8 }
        })
    },
    checkoutBtnText: { color: 'white', fontSize: 17, fontWeight: '800', marginRight: 8 },
    checkoutBtnDot: { color: 'rgba(255,255,255,0.4)', fontSize: 17, fontWeight: '600' },
    checkoutBtnAmount: { color: 'white', fontSize: 17, fontWeight: '800', marginLeft: 8 },
    checkoutIcon: { position: 'absolute', right: 20 }
});
