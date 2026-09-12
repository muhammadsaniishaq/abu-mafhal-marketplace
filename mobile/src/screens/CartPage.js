import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Image, StatusBar,
    Platform, Alert, StyleSheet
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { parsePrice } from '../utils/helpers';

const AM_LOGO = require('../../assets/am_logo.png');

const PAYMENT_METHODS = [
    { id: 'paystack', name: 'Paystack', icon: 'card-outline', color: '#00C3F8' },
    { id: 'flutterwave', name: 'Flutterwave', icon: 'wallet-outline', color: '#F5A623' },
    { id: 'wallet', name: 'Wallet', icon: 'cash-outline', color: '#10B981' },
    { id: 'crypto', name: 'Crypto', icon: 'logo-bitcoin', color: '#8B5CF6' },
    { id: 'pod', name: 'Pay on Delivery', icon: 'car-outline', color: '#F97316' },
];

export const CartPage = ({ cart = [], onUpdateQty, onRemove, onBack, onClear }) => {
    const navigation = useNavigation();
    const [selectedPayment, setSelectedPayment] = useState('paystack');

    const subtotal = cart.reduce((sum, item) => {
        const price = parsePrice(item.price);
        const qty = parseInt(item.qty || item.quantity || 1) || 1;
        return sum + (price * qty);
    }, 0);

    const deliveryFee = cart.length > 0 ? 2500 : 0;
    const discount = cart.length > 0 ? Math.min(5000, Math.floor(subtotal * 0.05)) : 0;
    const total = Math.max(0, subtotal + deliveryFee - discount);

    const handleClearCart = () => {
        Alert.alert(
            'Clear Cart',
            'Are you sure you want to remove all items from your cart?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Clear All',
                    style: 'destructive',
                    onPress: () => {
                        if (onClear) onClear();
                    }
                }
            ]
        );
    };

    const handleProceedToCheckout = async () => {
        if (cart.length === 0) {
            Alert.alert('Cart Empty', 'Please add items to your cart before proceeding to checkout.');
            return;
        }

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Login Required', 'Please login to checkout.', [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Login', onPress: () => navigation.navigate('Auth', { redirectTo: 'CheckoutPage' }) }
                ]);
                return;
            }

            navigation.navigate('CheckoutPage', {
                cart,
                total,
                subtotal,
                deliveryFee,
                discount,
                paymentMethod: selectedPayment
            });
        } catch (e) {
            console.error('Checkout error:', e);
        }
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar backgroundColor="#0A192F" barStyle="light-content" />

            {/* Top Dark Navy Header */}
            <View style={{
                backgroundColor: '#0A192F',
                paddingTop: 48,
                paddingHorizontal: 16,
                paddingBottom: 16,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <TouchableOpacity onPress={onBack || (() => navigation.goBack())} style={{ padding: 6 }}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Image source={AM_LOGO} style={{ width: 34, height: 34, resizeMode: 'contain' }} />
                    <View>
                        <Text style={{ color: '#00D2FF', fontSize: 16, fontWeight: '900', letterSpacing: 0.6 }}>
                            ABU <Text style={{ color: '#38BDF8' }}>MAFHAL</Text>
                        </Text>
                        <Text style={{ color: '#94A3B8', fontSize: 7, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }}>
                            Your Marketplace, Your Choice.
                        </Text>
                    </View>
                </View>

                <View style={{ position: 'relative', padding: 6 }}>
                    <Ionicons name="cart" size={24} color="white" />
                    {cart.length > 0 && (
                        <View style={{
                            position: 'absolute',
                            top: 2,
                            right: 0,
                            backgroundColor: '#F59E0B',
                            borderRadius: 9,
                            minWidth: 18,
                            height: 18,
                            alignItems: 'center',
                            justifyContent: 'center',
                            paddingHorizontal: 3,
                            borderWidth: 1.5,
                            borderColor: '#0A192F'
                        }}>
                            <Text style={{ color: '#0A192F', fontSize: 10, fontWeight: '900' }}>{cart.length}</Text>
                        </View>
                    )}
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 18, paddingBottom: 130 }}>
                {/* Header Title: My Cart & Clear Cart link */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <Text style={{ fontSize: 22, fontWeight: '900', color: '#0A192F', letterSpacing: -0.4 }}>
                        My Cart <Text style={{ color: '#64748B', fontSize: 16, fontWeight: '700' }}>({cart.length} {cart.length === 1 ? 'item' : 'items'})</Text>
                    </Text>

                    {cart.length > 0 && (
                        <TouchableOpacity onPress={handleClearCart} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="trash-outline" size={15} color="#EF4444" />
                            <Text style={{ color: '#EF4444', fontSize: 12.5, fontWeight: '800' }}>
                                Clear Cart
                            </Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Cart Items List */}
                {cart.length === 0 ? (
                    <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 32, alignItems: 'center', marginVertical: 20 }}>
                        <Ionicons name="cart-outline" size={60} color="#CBD5E1" />
                        <Text style={{ fontSize: 17, fontWeight: '800', color: '#0A192F', marginTop: 12 }}>Your Cart is Empty</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4, textAlign: 'center' }}>Explore our top deals and add items to your cart!</Text>
                        <TouchableOpacity
                            onPress={onBack || (() => navigation.navigate('Shop'))}
                            style={{ marginTop: 20, backgroundColor: '#0A192F', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 14 }}
                        >
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>Start Shopping</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={{ gap: 12, marginBottom: 20 }}>
                        {cart.map((item, idx) => {
                            const imgUrl = item?.images?.[0] || item?.image || item?.image_url || 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?q=80&w=300&auto=format&fit=crop';
                            const qty = item.qty || item.quantity || 1;
                            const price = parsePrice(item.price);
                            const vendorName = item.vendor_name || item.brand || 'TrendZone Store';

                            return (
                                <View
                                    key={item.id || idx}
                                    style={{
                                        backgroundColor: 'white',
                                        borderRadius: 20,
                                        padding: 14,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        borderWidth: 1,
                                        borderColor: '#F1F5F9',
                                        shadowColor: '#0F172A',
                                        shadowOffset: { width: 0, height: 3 },
                                        shadowOpacity: 0.03,
                                        shadowRadius: 8,
                                        elevation: 1.5,
                                    }}
                                >
                                    <Image
                                        source={{ uri: imgUrl }}
                                        style={{ width: 76, height: 76, borderRadius: 16, backgroundColor: '#F8FAFC', marginRight: 12, resizeMode: 'cover' }}
                                    />

                                    <View style={{ flex: 1 }}>
                                        <Text numberOfLines={1} style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>
                                            {item.name || 'Product Item'}
                                        </Text>
                                        <Text numberOfLines={1} style={{ fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 1 }}>
                                            By {vendorName}
                                        </Text>

                                        <Text style={{ fontSize: 14.5, fontWeight: '900', color: '#0A192F', marginTop: 4 }}>
                                            ₦{price.toLocaleString()}
                                        </Text>

                                        <Text style={{ fontSize: 10.5, color: '#94A3B8', fontWeight: '600', marginTop: 2 }}>
                                            Size: {item.selectedSize || '42'} | Color: {item.selectedColor || 'White'}
                                        </Text>
                                    </View>

                                    {/* Stepper + Delete Icon */}
                                    <View style={{ alignItems: 'flex-end', gap: 10 }}>
                                        <View style={{
                                            flexDirection: 'row',
                                            alignItems: 'center',
                                            backgroundColor: '#F8FAFC',
                                            borderRadius: 12,
                                            borderWidth: 1,
                                            borderColor: '#E2E8F0',
                                            paddingHorizontal: 4,
                                            paddingVertical: 2,
                                        }}>
                                            <TouchableOpacity
                                                onPress={() => onUpdateQty && onUpdateQty(item.id, -1)}
                                                style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Ionicons name="remove" size={15} color="#0A192F" />
                                            </TouchableOpacity>

                                            <Text style={{ fontSize: 13, fontWeight: '900', color: '#0A192F', paddingHorizontal: 6 }}>
                                                {qty}
                                            </Text>

                                            <TouchableOpacity
                                                onPress={() => onUpdateQty && onUpdateQty(item.id, 1)}
                                                style={{ width: 26, height: 26, alignItems: 'center', justifyContent: 'center' }}
                                            >
                                                <Ionicons name="add" size={15} color="#0A192F" />
                                            </TouchableOpacity>
                                        </View>

                                        <TouchableOpacity
                                            onPress={() => onRemove && onRemove(item.id)}
                                            style={{ padding: 4 }}
                                        >
                                            <Ionicons name="trash-outline" size={17} color="#94A3B8" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                {/* Order Summary Card */}
                {cart.length > 0 && (
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 22,
                        padding: 18,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: '#F1F5F9',
                    }}>
                        <Text style={{ fontSize: 16, fontWeight: '900', color: '#0A192F', marginBottom: 14 }}>
                            Order Summary
                        </Text>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>
                                Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                            </Text>
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                                ₦{subtotal.toLocaleString()}
                            </Text>
                        </View>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                            <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }}>Delivery Fee</Text>
                            <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#0F172A' }}>
                                ₦{deliveryFee.toLocaleString()}
                            </Text>
                        </View>

                        {discount > 0 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                                <Text style={{ fontSize: 13, color: '#10B981', fontWeight: '600' }}>Discount</Text>
                                <Text style={{ fontSize: 13.5, fontWeight: '800', color: '#10B981' }}>
                                    - ₦{discount.toLocaleString()}
                                </Text>
                            </View>
                        )}

                        <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 }} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0A192F' }}>Total</Text>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0A192F' }}>
                                ₦{total.toLocaleString()}
                            </Text>
                        </View>
                    </View>
                )}

                {/* Delivery Address Card */}
                {cart.length > 0 && (
                    <View style={{
                        backgroundColor: 'white',
                        borderRadius: 22,
                        padding: 16,
                        marginBottom: 16,
                        borderWidth: 1,
                        borderColor: '#F1F5F9',
                        flexDirection: 'row',
                        alignItems: 'flex-start',
                        gap: 12
                    }}>
                        <View style={{
                            width: 36,
                            height: 36,
                            borderRadius: 18,
                            backgroundColor: '#EFF6FF',
                            alignItems: 'center',
                            justifyContent: 'center',
                            marginTop: 2
                        }}>
                            <Ionicons name="location" size={19} color="#0284C7" />
                        </View>

                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Text style={{ fontSize: 14, fontWeight: '800', color: '#0A192F' }}>
                                    Delivery Address
                                </Text>
                                <TouchableOpacity onPress={() => navigation.navigate('AddressPage')}>
                                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#0284C7' }}>Edit</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0F172A', marginTop: 4 }}>
                                Muhammad Sani Isyaku
                            </Text>
                            <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 2 }}>
                                No. 12, Gashua Road, Gashua, Yobe State, Nigeria
                            </Text>
                            <Text style={{ fontSize: 11.5, color: '#64748B', marginTop: 1 }}>
                                +234 810 123 4567
                            </Text>
                        </View>
                    </View>
                )}

                {/* Payment Method Selector */}
                {cart.length > 0 && (
                    <View style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={{ fontSize: 15, fontWeight: '800', color: '#0A192F' }}>
                                Payment Method
                            </Text>
                            <TouchableOpacity>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0284C7' }}>See all</Text>
                            </TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
                            {PAYMENT_METHODS.map(m => {
                                const isSelected = selectedPayment === m.id;
                                return (
                                    <TouchableOpacity
                                        key={m.id}
                                        onPress={() => setSelectedPayment(m.id)}
                                        style={{
                                            width: 105,
                                            backgroundColor: isSelected ? '#F0F9FF' : 'white',
                                            borderRadius: 18,
                                            paddingVertical: 14,
                                            paddingHorizontal: 8,
                                            alignItems: 'center',
                                            borderWidth: 1.5,
                                            borderColor: isSelected ? '#0284C7' : '#E2E8F0',
                                            position: 'relative'
                                        }}
                                    >
                                        {isSelected && (
                                            <View style={{
                                                position: 'absolute',
                                                top: 6,
                                                right: 6,
                                                width: 16,
                                                height: 16,
                                                borderRadius: 8,
                                                backgroundColor: '#0284C7',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                <Ionicons name="checkmark" size={10} color="white" />
                                            </View>
                                        )}

                                        <Ionicons name={m.icon} size={24} color={m.color} style={{ marginBottom: 6 }} />
                                        <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: isSelected ? '900' : '700', color: '#0A192F', textAlign: 'center' }}>
                                            {m.name}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}

                {/* Main CTA Proceed to Checkout */}
                {cart.length > 0 && (
                    <View style={{ gap: 8 }}>
                        <TouchableOpacity
                            activeOpacity={0.9}
                            onPress={handleProceedToCheckout}
                            style={{
                                backgroundColor: '#F59E0B',
                                borderRadius: 20,
                                paddingVertical: 16,
                                flexDirection: 'row',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 8,
                                shadowColor: '#F59E0B',
                                shadowOffset: { width: 0, height: 6 },
                                shadowOpacity: 0.3,
                                shadowRadius: 12,
                                elevation: 4
                            }}
                        >
                            <Ionicons name="lock-closed" size={18} color="#0A192F" />
                            <Text style={{ color: '#0A192F', fontSize: 16, fontWeight: '900', letterSpacing: 0.2 }}>
                                Proceed to Checkout
                            </Text>
                            <Ionicons name="arrow-forward" size={18} color="#0A192F" />
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: 4 }}>
                            <Ionicons name="shield-checkmark" size={14} color="#64748B" />
                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>
                                Your payment information is secure
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
};

const styles = StyleSheet.create({});
