import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity, UIManager, FlatList, Image, StatusBar, Platform, Alert, LayoutAnimation } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { NotificationService } from '../lib/notifications';

// Enable LayoutAnimation on Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Helper to safely parse price
const parsePrice = (price) => {
    if (typeof price === 'number') return price;
    if (typeof price === 'string') {
        const clean = price.replace(/[^0-9.]/g, '');
        return parseFloat(clean) || 0;
    }
    return 0;
};

export const CartPage = ({ cart, onUpdateQty, onRemove, onBack, onClear }) => {
    const navigation = useNavigation();
    const insets = useSafeAreaInsets();

    // Auto-save is handled in App.js via cartLines dependency

    const total = cart.reduce((sum, item) => sum + (parsePrice(item.price) * item.qty), 0);

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
        const imageUrl = item.images && item.images.length > 0
            ? item.images[0]
            : (item.img || 'https://placehold.co/100x100?text=No+Image');

        return (
            <View style={{
                flexDirection: 'row',
                backgroundColor: 'white',
                borderRadius: 16,
                padding: 12,
                marginBottom: 16,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.05,
                shadowRadius: 8,
                elevation: 2,
                alignItems: 'center'
            }}>
                <Image
                    source={{ uri: imageUrl }}
                    style={{ width: 80, height: 80, borderRadius: 12, backgroundColor: '#F1F5F9' }}
                />

                <View style={{ flex: 1, marginLeft: 16 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 8 }} numberOfLines={2}>
                            {item.name}
                        </Text>
                        <TouchableOpacity onPress={() => handleRemove(item.id)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                        </TouchableOpacity>
                    </View>

                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>
                        {item.brand || 'Generic'}
                        {item.variants && item.variants.length > 0 ? ` • ${item.variants[0].name}` : ''}
                    </Text>

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 12 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#3B82F6' }}>
                            ₦{parsePrice(item.price).toLocaleString()}
                        </Text>

                        {/* Qty Control */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 8, padding: 2, borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <TouchableOpacity
                                onPress={() => onUpdateQty(item.id, -1)}
                                style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="remove" size={16} color="#0F172A" />
                            </TouchableOpacity>
                            <Text style={{ width: 30, textAlign: 'center', fontSize: 14, fontWeight: '600', color: '#0F172A' }}>
                                {item.qty}
                            </Text>
                            <TouchableOpacity
                                onPress={() => onUpdateQty(item.id, 1)}
                                style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center' }}
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
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Header */}
            <View style={{
                paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : insets.top + 10,
                paddingBottom: 16,
                paddingHorizontal: 20,
                backgroundColor: 'white',
                borderBottomWidth: 1,
                borderColor: '#F1F5F9',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.03,
                shadowRadius: 10,
                elevation: 5,
                zIndex: 10
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TouchableOpacity onPress={onBack} style={{ marginRight: 16 }}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A' }}>My Cart</Text>
                </View>

                {cart.length > 0 && (
                    <TouchableOpacity
                        onPress={handleClearCart}
                        style={{ flexDirection: 'row', alignItems: 'center', padding: 8 }}
                    >
                        <Text style={{ color: '#EF4444', fontWeight: '600', marginRight: 4 }}>Clear</Text>
                        <Ionicons name="trash-bin-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                )}
            </View>

            {/* List */}
            {cart.length > 0 ? (
                <FlatList
                    data={cart}
                    keyExtractor={item => item.id.toString()}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 20, paddingBottom: 150 }}
                    showsVerticalScrollIndicator={false}
                />
            ) : (
                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 }}>
                    <View style={{ width: 120, height: 120, backgroundColor: '#F1F5F9', borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
                        <Ionicons name="cart-outline" size={60} color="#94A3B8" />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Your cart is empty</Text>
                    <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 32 }}>
                        Looks like you haven't added anything to your cart yet.
                    </Text>
                    <TouchableOpacity
                        onPress={onBack}
                        style={{ backgroundColor: '#0F172A', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 30 }}
                    >
                        <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>Start Shopping</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Checkout Bar */}
            {cart.length > 0 && (
                <View style={{
                    position: 'absolute',
                    bottom: 0,
                    left: 0,
                    right: 0,
                    backgroundColor: 'white',
                    padding: 20,
                    paddingBottom: insets.bottom + 20,
                    borderTopWidth: 1,
                    borderColor: '#F1F5F9',
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: -4 },
                    shadowOpacity: 0.05,
                    shadowRadius: 10,
                    elevation: 20
                }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                        <Text style={{ color: '#64748B', fontSize: 15 }}>Subtotal</Text>
                        <Text style={{ color: '#0F172A', fontSize: 16, fontWeight: '700' }}>₦{total.toLocaleString()}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 }}>
                        <Text style={{ color: '#64748B', fontSize: 15 }}>Shipping</Text>
                        <Text style={{ color: '#22C55E', fontSize: 15, fontWeight: '600' }}>Free</Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleCheckout}
                        style={{
                            backgroundColor: '#0F172A',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 18,
                            borderRadius: 16,
                            shadowColor: '#0F172A',
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.3,
                            shadowRadius: 10,
                            elevation: 8
                        }}
                    >
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginRight: 8 }}>Checkout</Text>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 16, fontWeight: '600' }}>•</Text>
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700', marginLeft: 8 }}>₦{total.toLocaleString()}</Text>
                        <Ionicons name="arrow-forward" size={20} color="white" style={{ position: 'absolute', right: 20 }} />
                    </TouchableOpacity>
                </View>
            )}
        </View>
    );
};
