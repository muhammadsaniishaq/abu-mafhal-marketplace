import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Image, StatusBar,
    Platform, Alert, StyleSheet, TextInput, Animated, Dimensions,
    ActivityIndicator
} from 'react-native';
import { useNavigation, useIsFocused } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { parsePrice } from '../utils/helpers';
import { useAppSettings } from '../context/AppSettingsContext';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

// ─── Luxury Brand Colors ───────────────────────────────────────────────────────
const NAVY        = '#0E1A2E';
const NAVY_LIGHT  = '#1A2942';
const GOLD        = '#D9A73A';
const GOLD_LIGHT  = 'rgba(217, 167, 58, 0.12)';
const BG          = '#F8FAFC';
const WHITE       = '#FFFFFF';
const SLATE       = '#64748B';
const SLATE_DARK  = '#0F172A';
const BORDER      = '#E2E8F0';
const EMERALD     = '#10B981';
const DANGER      = '#EF4444';

// Real Checkout Payment Gateways supported on Abu Mafhal
const PAYMENT_METHODS = [
    { id: 'Paystack',    name: 'Paystack',        icon: 'card-outline',     sub: 'Card, Transfer & USSD', color: '#00C3F8' },
    { id: 'Flutterwave', name: 'Flutterwave',     icon: 'flash-outline',    sub: 'Cards & Mobile Money',  color: '#F5A623' },
    { id: 'Wallet',      name: 'Abu Mafhal Wallet',icon: 'wallet-outline',   sub: 'Instant Escrow Debit',  color: '#10B981' },
    { id: 'pod',         name: 'Pay on Delivery', icon: 'bicycle-outline',  sub: 'Cash on Arrival',       color: '#F97316' },
];

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop';

const getItemImage = (item) => {
    if (!item) return FALLBACK_IMAGE;
    if (Array.isArray(item.images) && item.images[0]) return item.images[0];
    if (typeof item.images === 'string' && item.images.startsWith('http')) return item.images;
    if (item.image_url && item.image_url.startsWith('http')) return item.image_url;
    if (item.image && item.image.startsWith('http')) return item.image;
    if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
    return FALLBACK_IMAGE;
};

export const CartPage = ({
    cart = [],
    user = null,
    onUpdateQty,
    onRemove,
    onBack,
    onClear
}) => {
    const navigation = useNavigation();
    const isFocused = useIsFocused();
    const { settings } = useAppSettings();

    // ── Live Shipping Rules from App Settings ─────────────────────────────────
    const shippingSettings = settings?.shipping_settings || {};
    const freeShippingThreshold = Number(shippingSettings.free_shipping_threshold || 50000);
    const baseShippingFee = Number(shippingSettings.base_fee || 1500) + Number(shippingSettings.handling_fee || 0);
    const isFreeNationwide = Boolean(shippingSettings.free_nationwide_shipping);

    // ── States ────────────────────────────────────────────────────────────────
    const [selectedPayment, setSelectedPayment] = useState('Paystack');
    const [promoInput, setPromoInput]           = useState('');
    const [appliedPromo, setAppliedPromo]       = useState(null);
    const [promoError, setPromoError]           = useState('');
    const [promoApplying, setPromoApplying]     = useState(false);
    const [activeCoupons, setActiveCoupons]     = useState([]);

    // Live Customer Address
    const [customerAddress, setCustomerAddress] = useState(null);
    const [loadingAddress, setLoadingAddress]   = useState(true);

    // Floating Toast Notification
    const [toastMessage, setToastMessage] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = useCallback((msg) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 160, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(toastAnim, { toValue: 0, duration: 180, useNativeDriver: true })
        ]).start();
    }, [toastAnim]);

    // ── Fetch Customer Address & Live Active Coupons ──────────────────────────
    useEffect(() => {
        if (isFocused) {
            loadLiveAddress();
            loadActiveCoupons();
        }
    }, [isFocused, user]);

    const loadLiveAddress = async () => {
        setLoadingAddress(true);
        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            const currentUid = authUser?.id || user?.id;

            // 1. Try local storage first (instant & reliable)
            if (currentUid) {
                const localRaw = await AsyncStorage.getItem(`@user_addresses_${currentUid}`);
                if (localRaw) {
                    const parsed = JSON.parse(localRaw);
                    if (Array.isArray(parsed) && parsed.length > 0) {
                        const def = parsed.find(a => a.is_default) || parsed[0];
                        if (def) {
                            setCustomerAddress(def);
                            setLoadingAddress(false);
                            return;
                        }
                    }
                }
            }

            // 2. Query Supabase addresses table
            if (currentUid) {
                const { data: sbAddrs, error } = await supabase
                    .from('addresses')
                    .select('*')
                    .eq('user_id', currentUid)
                    .order('is_default', { ascending: false });

                if (!error && Array.isArray(sbAddrs) && sbAddrs.length > 0) {
                    setCustomerAddress(sbAddrs[0]);
                    setLoadingAddress(false);
                    return;
                }
            }

            // 3. Fallback to profile address
            if (currentUid) {
                const { data: prof } = await supabase
                    .from('profiles')
                    .select('address, state, phone, phone_number, full_name')
                    .eq('id', currentUid)
                    .maybeSingle();

                if (prof && prof.address) {
                    setCustomerAddress({
                        title: 'Home',
                        address: prof.address,
                        city: '',
                        state: prof.state || '',
                        phone: prof.phone || prof.phone_number || '',
                        is_default: true
                    });
                }
            }
        } catch (e) {
            console.log('Error loading customer address in cart:', e);
        } finally {
            setLoadingAddress(false);
        }
    };

    const loadActiveCoupons = async () => {
        try {
            const { data, error } = await supabase
                .from('coupons')
                .select('code, discount_type, discount_value, min_order_amount, description')
                .eq('is_active', true)
                .limit(4);

            if (!error && Array.isArray(data) && data.length > 0) {
                setActiveCoupons(data);
            }
        } catch (e) {
            console.log('Active coupons fetch note:', e?.message);
        }
    };

    // ── Financial Calculations ────────────────────────────────────────────────
    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const price = parsePrice(item.price);
            const qty = parseInt(item.qty || item.quantity || 1, 10) || 1;
            return sum + (price * qty);
        }, 0);
    }, [cart]);

    const allFreeShippingProducts = cart.length > 0 && cart.every(i => i.free_shipping === true);
    const isFreeShippingByThreshold = subtotal >= freeShippingThreshold && freeShippingThreshold > 0;
    const isFreeShipping = isFreeNationwide || allFreeShippingProducts || isFreeShippingByThreshold || (appliedPromo?.discount_type === 'shipping');

    const deliveryFee = cart.length === 0 ? 0 : (isFreeShipping ? 0 : baseShippingFee);

    const discount = useMemo(() => {
        if (!appliedPromo || cart.length === 0) return 0;
        if (appliedPromo.discount_type === 'percentage') {
            const calculated = Math.floor((subtotal * Number(appliedPromo.discount_value)) / 100);
            if (appliedPromo.max_discount) {
                return Math.min(Number(appliedPromo.max_discount), calculated);
            }
            return calculated;
        }
        if (appliedPromo.discount_type === 'fixed') {
            return Math.min(subtotal, Number(appliedPromo.discount_value));
        }
        if (appliedPromo.discount_type === 'shipping') {
            return baseShippingFee;
        }
        return 0;
    }, [appliedPromo, subtotal, cart.length, baseShippingFee]);

    const total = Math.max(0, subtotal + deliveryFee - (appliedPromo?.discount_type === 'shipping' ? 0 : discount));

    const freeShippingProgress = freeShippingThreshold > 0 ? Math.min(1, Math.max(0, subtotal / freeShippingThreshold)) : 1;
    const amountNeededForFreeShip = Math.max(0, freeShippingThreshold - subtotal);

    // ── Group Cart Items by Merchant / Store ──────────────────────────────────
    const groupedCart = useMemo(() => {
        const groups = {};
        cart.forEach(item => {
            const vendorKey = item.vendor_id || item.vendorId || 'admin_store';
            const vendorName = item.vendor_name || item.vendor?.store_name || item.brand || 'Abu Mafhal Direct';
            if (!groups[vendorKey]) {
                groups[vendorKey] = {
                    vendorId: vendorKey,
                    vendorName,
                    items: []
                };
            }
            groups[vendorKey].items.push(item);
        });
        return Object.values(groups);
    }, [cart]);

    // ── Quantity & Removal Handlers ───────────────────────────────────────────
    const handleQtyChange = (item, change) => {
        const currentQty = parseInt(item.qty || item.quantity || 1, 10) || 1;
        if (currentQty === 1 && change === -1) {
            promptRemoveItem(item);
            return;
        }
        if (onUpdateQty) {
            onUpdateQty(item.id, change);
            showToast(change > 0 ? `Added one more ${item.name || 'item'}` : 'Quantity updated');
        }
    };

    const promptRemoveItem = (item) => {
        if (Platform.OS === 'web') {
            const confirmed = typeof window !== 'undefined' ? window.confirm(`Remove "${item.name || 'this item'}" from your cart?`) : true;
            if (confirmed && onRemove) {
                onRemove(item.id);
                showToast('Item removed from basket');
            }
        } else {
            Alert.alert(
                'Remove Item',
                `Are you sure you want to remove "${item.name || 'this item'}" from your cart?`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    {
                        text: 'Remove',
                        style: 'destructive',
                        onPress: () => {
                            if (onRemove) onRemove(item.id);
                            showToast('Item removed from basket');
                        }
                    }
                ]
            );
        }
    };

    const handleClearCart = () => {
        if (Platform.OS === 'web') {
            const confirmed = typeof window !== 'undefined' ? window.confirm('Clear all items from your cart?') : true;
            if (confirmed && onClear) {
                onClear();
                setAppliedPromo(null);
                showToast('Cart cleared');
            }
        } else {
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
                            setAppliedPromo(null);
                            showToast('Cart cleared');
                        }
                    }
                ]
            );
        }
    };

    // ── Live Coupon Validation (Supabase Database + Smart Verification) ───────
    const handleApplyPromo = async (codeOverride) => {
        const code = (codeOverride || promoInput).trim().toUpperCase();
        setPromoError('');
        if (!code) {
            setPromoError('Please enter a voucher code.');
            return;
        }

        setPromoApplying(true);
        try {
            // 1. Query live Supabase coupons table
            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', code)
                .eq('is_active', true)
                .maybeSingle();

            if (!error && data) {
                // Check expiration
                if (data.expires_at && new Date(data.expires_at) < new Date()) {
                    setPromoError(`Voucher "${code}" has expired.`);
                    return;
                }
                // Check minimum order amount
                if (data.min_order_amount && subtotal < Number(data.min_order_amount)) {
                    setPromoError(`Requires minimum order of ${formatNaira(data.min_order_amount)}.`);
                    return;
                }

                setAppliedPromo(data);
                setPromoInput('');
                setPromoError('');
                showToast(`✓ Voucher ${code} applied successfully!`);
                return;
            }

            // 2. Platform Fallback Codes (for offline testing or welcome promo)
            if (code === 'WELCOME10') {
                setAppliedPromo({
                    code: 'WELCOME10',
                    discount_type: 'percentage',
                    discount_value: 10,
                    max_discount: 10000,
                    description: '10% Welcome Discount'
                });
                setPromoInput('');
                setPromoError('');
                showToast('✓ Welcome voucher applied!');
            } else if (code === 'FREESHIP') {
                setAppliedPromo({
                    code: 'FREESHIP',
                    discount_type: 'shipping',
                    discount_value: baseShippingFee,
                    description: 'Free Shipping Voucher'
                });
                setPromoInput('');
                setPromoError('');
                showToast('✓ Free delivery voucher applied!');
            } else {
                setPromoError(`Promo code "${code}" is invalid or expired.`);
            }
        } catch (err) {
            console.error('Coupon validation error:', err);
            setPromoError('Could not validate coupon. Please try again.');
        } finally {
            setPromoApplying(false);
        }
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoError('');
        showToast('Promo code removed');
    };

    // ── Checkout Action ───────────────────────────────────────────────────────
    const handleProceedToCheckout = async () => {
        if (cart.length === 0) {
            Alert.alert('Empty Basket', 'Please add items to your cart before proceeding to checkout.');
            return;
        }

        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser && !user) {
                Alert.alert(
                    'Authentication Required',
                    'Please sign in to proceed with checkout and receive live order updates.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Sign In',
                            onPress: () => navigation.navigate('Auth', { redirectTo: 'CheckoutPage' })
                        }
                    ]
                );
                return;
            }

            navigation.navigate('CheckoutPage', {
                cart,
                total,
                subtotal,
                deliveryFee,
                discount,
                promoCode: appliedPromo?.code || null,
                paymentMethod: selectedPayment,
                selectedAddress: customerAddress || null
            });
        } catch (e) {
            console.error('Checkout navigation error:', e);
            navigation.navigate('CheckoutPage', {
                cart,
                total,
                subtotal,
                deliveryFee,
                discount,
                paymentMethod: selectedPayment
            });
        }
    };

    const formatNaira = (amount) => {
        return '₦' + Number(amount || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 });
    };

    return (
        <View style={s.container}>
            <StatusBar backgroundColor={NAVY} barStyle="light-content" />

            {/* ── 1. LUXURY TOP APP BAR ────────────────────────────────────── */}
            <LinearGradient
                colors={[NAVY, NAVY_LIGHT]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.header}
            >
                <View style={s.headerRow}>
                    {/* Back Button */}
                    <TouchableOpacity
                        onPress={onBack || (() => navigation.goBack())}
                        style={s.headerBackBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color={WHITE} />
                    </TouchableOpacity>

                    {/* Logo Emblem & Brand Title */}
                    <View style={s.headerCenter}>
                        <View style={s.logoCircle}>
                            <Image source={AM_LOGO} style={s.logoImg} resizeMode="contain" />
                        </View>
                        <View>
                            <Text style={s.headerTitle}>
                                Abu <Text style={{ color: GOLD }}>Mafhal</Text> Cart
                            </Text>
                            <Text style={s.headerSub}>
                                {cart.length === 0 ? 'Empty basket' : `${cart.length} ${cart.length === 1 ? 'item' : 'items'} ready for dispatch`}
                            </Text>
                        </View>
                    </View>

                    {/* Clear Cart Button */}
                    {cart.length > 0 ? (
                        <TouchableOpacity
                            onPress={handleClearCart}
                            style={s.clearBtn}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="trash-outline" size={14} color={DANGER} />
                            <Text style={s.clearBtnTxt}>Clear</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 40 }} />
                    )}
                </View>

                {/* ── DYNAMIC FREE SHIPPING PROGRESS BAR ── */}
                {cart.length > 0 && freeShippingThreshold > 0 && (
                    <View style={s.freeShipBanner}>
                        <View style={s.freeShipTop}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                <Ionicons
                                    name={isFreeShipping ? "checkmark-circle" : "bicycle-outline"}
                                    size={15}
                                    color={isFreeShipping ? EMERALD : GOLD}
                                />
                                <Text style={s.freeShipText} numberOfLines={1}>
                                    {isFreeShipping ? (
                                        <Text style={{ color: EMERALD, fontWeight: '800' }}>
                                            🎉 You unlocked FREE DELIVERY nationwide!
                                        </Text>
                                    ) : (
                                        <Text style={{ color: WHITE }}>
                                            Add <Text style={{ color: GOLD, fontWeight: '800' }}>{formatNaira(amountNeededForFreeShip)}</Text> for <Text style={{ fontWeight: '800' }}>FREE SHIPPING</Text>
                                        </Text>
                                    )}
                                </Text>
                            </View>
                            <Text style={s.freeShipGoal}>{formatNaira(freeShippingThreshold)}</Text>
                        </View>

                        {/* Progress Track */}
                        <View style={s.progressTrack}>
                            <View style={[
                                s.progressBar,
                                {
                                    width: `${Math.round(freeShippingProgress * 100)}%`,
                                    backgroundColor: isFreeShipping ? EMERALD : GOLD
                                }
                            ]} />
                        </View>
                    </View>
                )}
            </LinearGradient>

            {/* ── 2. SCROLLABLE CART CONTENT ───────────────────────────────── */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={[
                    s.scrollContent,
                    cart.length > 0 && { paddingBottom: 130 }
                ]}
            >
                {/* EMPTY BASKET STATE */}
                {cart.length === 0 ? (
                    <View style={s.emptyBox}>
                        <View style={s.emptyIconCircle}>
                            <Ionicons name="cart-outline" size={48} color={GOLD} />
                        </View>
                        <Text style={s.emptyTitle}>Your Basket is Empty</Text>
                        <Text style={s.emptySub}>
                            Explore Abu Mafhal Marketplace's verified catalog and discover authentic products at verified market prices.
                        </Text>
                        <TouchableOpacity
                            onPress={onBack || (() => navigation.navigate('Shop'))}
                            style={s.emptyBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="bag-handle" size={17} color={NAVY} />
                            <Text style={s.emptyBtnTxt}>Start Shopping Now</Text>
                            <Ionicons name="arrow-forward" size={16} color={NAVY} />
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* ── GROUPED MERCHANT PACKAGES ── */}
                        <View style={s.sectionHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={s.sectionAccent} />
                                <Text style={s.sectionTitle}>Cart Items</Text>
                                <View style={s.countPill}>
                                    <Text style={s.countPillTxt}>{cart.length}</Text>
                                </View>
                            </View>
                            <Text style={s.sectionSub}>All prices in NGN (₦)</Text>
                        </View>

                        {groupedCart.map((group, gIdx) => (
                            <View key={group.vendorId || gIdx} style={s.vendorGroupCard}>
                                {/* Vendor / Dispatch Point Header */}
                                <View style={s.vendorHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                                        <Ionicons name="storefront" size={15} color={GOLD} />
                                        <Text style={s.vendorName} numberOfLines={1}>
                                            {group.vendorName}
                                        </Text>
                                        <View style={s.verifiedBadge}>
                                            <Ionicons name="shield-checkmark" size={10} color="#1D4ED8" />
                                            <Text style={s.verifiedBadgeTxt}>Verified Merchant</Text>
                                        </View>
                                    </View>
                                    <Text style={s.vendorItemCount}>
                                        {group.items.length} {group.items.length === 1 ? 'item' : 'items'}
                                    </Text>
                                </View>

                                {/* Items in this Merchant Group */}
                                {group.items.map((item, idx) => {
                                    const price = parsePrice(item.price);
                                    const qty = parseInt(item.qty || item.quantity || 1, 10) || 1;
                                    const itemTotal = price * qty;
                                    const imgUri = getItemImage(item);

                                    return (
                                        <View 
                                            key={item.id || idx} 
                                            style={[
                                                s.itemRow, 
                                                idx > 0 && s.itemRowDivider
                                            ]}
                                        >
                                            {/* Product Image */}
                                            <View style={s.itemImgBox}>
                                                <Image source={{ uri: imgUri }} style={s.itemImg} resizeMode="cover" />
                                                {qty > 1 && (
                                                    <View style={s.qtyTag}>
                                                        <Text style={s.qtyTagTxt}>×{qty}</Text>
                                                    </View>
                                                )}
                                            </View>

                                            {/* Item Info */}
                                            <View style={s.itemDetails}>
                                                <Text numberOfLines={2} style={s.itemTitle}>
                                                    {item.name || 'Marketplace Item'}
                                                </Text>

                                                {/* Variant Attributes (Size, Color, ROM) */}
                                                {(item.selectedVariant || item.selectedSize || item.selectedColor || item.storage) && (
                                                    <View style={s.variantPill}>
                                                        <Text style={s.variantPillTxt}>
                                                            {[
                                                                item.selectedVariant?.name,
                                                                item.selectedSize ? `Size: ${item.selectedSize}` : null,
                                                                item.selectedColor ? `Color: ${item.selectedColor}` : null,
                                                                item.storage ? `ROM: ${item.storage}` : null
                                                            ].filter(Boolean).join(' • ')}
                                                        </Text>
                                                    </View>
                                                )}

                                                {/* Unit Price */}
                                                <View style={s.priceBox}>
                                                    <Text style={s.itemPrice}>{formatNaira(price)}</Text>
                                                    {item.compare_at_price && Number(item.compare_at_price) > price && (
                                                        <Text style={s.itemOldPrice}>{formatNaira(item.compare_at_price)}</Text>
                                                    )}
                                                </View>
                                            </View>

                                            {/* Stepper Controls & Delete */}
                                            <View style={s.itemActions}>
                                                <TouchableOpacity
                                                    onPress={() => promptRemoveItem(item)}
                                                    style={s.deleteBtn}
                                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="trash-outline" size={15} color="#94A3B8" />
                                                </TouchableOpacity>

                                                <View style={s.stepper}>
                                                    <TouchableOpacity
                                                        onPress={() => handleQtyChange(item, -1)}
                                                        style={s.stepperBtn}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Ionicons
                                                            name={qty === 1 ? "trash-outline" : "remove"}
                                                            size={qty === 1 ? 12 : 13}
                                                            color={qty === 1 ? DANGER : NAVY}
                                                        />
                                                    </TouchableOpacity>

                                                    <Text style={s.stepperValue}>{qty}</Text>

                                                    <TouchableOpacity
                                                        onPress={() => handleQtyChange(item, 1)}
                                                        style={[s.stepperBtn, s.stepperBtnAdd]}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Ionicons name="add" size={13} color={WHITE} />
                                                    </TouchableOpacity>
                                                </View>

                                                <Text style={s.lineTotal}>{formatNaira(itemTotal)}</Text>
                                            </View>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}

                        {/* ── 3. LIVE DELIVERY DESTINATION SUMMARY ─────────────── */}
                        <View style={s.addressCard}>
                            <View style={s.addressIconBox}>
                                <Ionicons name="location-sharp" size={18} color="#2563EB" />
                            </View>

                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={s.addressCardTitle}>Delivery Destination</Text>
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('AddressPage')}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={s.addressChangeTxt}>Change</Text>
                                    </TouchableOpacity>
                                </View>

                                {loadingAddress ? (
                                    <ActivityIndicator size="small" color={NAVY} style={{ alignSelf: 'flex-start', marginTop: 6 }} />
                                ) : customerAddress ? (
                                    <>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
                                            <Text style={s.addressRecipient}>{customerAddress.title || 'Home'}</Text>
                                            {customerAddress.city ? (
                                                <View style={s.lgaPill}>
                                                    <Text style={s.lgaPillTxt}>{customerAddress.city} LGA</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={s.addressText} numberOfLines={2}>
                                            {customerAddress.address}
                                        </Text>
                                        <Text style={s.addressRegion}>
                                            {customerAddress.state ? `${customerAddress.state} State` : 'Nigeria'}
                                            {customerAddress.phone ? ` • ${customerAddress.phone}` : ''}
                                        </Text>
                                    </>
                                ) : (
                                    <View style={{ marginTop: 4 }}>
                                        <Text style={s.noAddressTxt}>No saved shipping address selected yet.</Text>
                                        <TouchableOpacity 
                                            onPress={() => navigation.navigate('AddressPage')}
                                            style={{ marginTop: 4 }}
                                        >
                                            <Text style={{ color: GOLD, fontWeight: '800', fontSize: 12 }}>
                                                + Add Delivery Address & LGA
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                )}
                            </View>
                        </View>

                        {/* ── 4. LIVE COUPON & VOUCHER CODE ───────────────────── */}
                        <View style={s.couponCard}>
                            <View style={s.couponHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="pricetag" size={15} color={GOLD} />
                                    <Text style={s.couponTitle}>Vouchers & Promo Discounts</Text>
                                </View>
                                {appliedPromo && (
                                    <TouchableOpacity onPress={handleRemovePromo}>
                                        <Text style={s.couponRemoveTxt}>Remove</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {appliedPromo ? (
                                <View style={s.couponAppliedBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="checkmark-circle" size={20} color={EMERALD} />
                                        <View>
                                            <Text style={s.couponAppliedCode}>{appliedPromo.code}</Text>
                                            <Text style={s.couponAppliedDesc}>
                                                {appliedPromo.description || `${appliedPromo.discount_value}${appliedPromo.discount_type === 'percentage' ? '%' : '₦'} Discount Applied`}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text style={s.couponSavingsVal}>-{formatNaira(discount)}</Text>
                                </View>
                            ) : (
                                <>
                                    <View style={s.couponInputRow}>
                                        <TextInput
                                            placeholder="Enter discount or voucher code"
                                            placeholderTextColor="#94A3B8"
                                            style={s.couponInput}
                                            value={promoInput}
                                            onChangeText={(t) => { setPromoInput(t); setPromoError(''); }}
                                            autoCapitalize="characters"
                                            returnKeyType="done"
                                        />
                                        <TouchableOpacity
                                            onPress={() => handleApplyPromo()}
                                            disabled={promoApplying || !promoInput.trim()}
                                            style={[s.couponApplyBtn, (!promoInput.trim() || promoApplying) && { opacity: 0.6 }]}
                                            activeOpacity={0.8}
                                        >
                                            {promoApplying ? (
                                                <ActivityIndicator size="small" color={NAVY} />
                                            ) : (
                                                <Text style={s.couponApplyBtnTxt}>Apply</Text>
                                            )}
                                        </TouchableOpacity>
                                    </View>

                                    {promoError ? (
                                        <Text style={s.couponErrorTxt}>⚠️ {promoError}</Text>
                                    ) : null}

                                    {/* Active Available Coupons from Live DB */}
                                    {activeCoupons.length > 0 && (
                                        <View style={s.activeCouponsRow}>
                                            <Text style={s.activeCouponsHint}>Available:</Text>
                                            {activeCoupons.map((c) => (
                                                <TouchableOpacity
                                                    key={c.code}
                                                    onPress={() => handleApplyPromo(c.code)}
                                                    style={s.activeCouponChip}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="flash" size={9} color={GOLD} />
                                                    <Text style={s.activeCouponChipTxt}>{c.code}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </>
                            )}
                        </View>

                        {/* ── 5. PAYMENT GATEWAY PREFERENCE ───────────────────── */}
                        <View style={{ marginBottom: 16 }}>
                            <View style={s.payHeader}>
                                <Text style={s.payHeaderTitle}>Preferred Payment Method</Text>
                                <View style={s.secureBadge}>
                                    <Ionicons name="shield-checkmark" size={11} color={EMERALD} />
                                    <Text style={s.secureBadgeTxt}>Escrow Protected</Text>
                                </View>
                            </View>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 10, paddingVertical: 2 }}
                            >
                                {PAYMENT_METHODS.map((m) => {
                                    const isSelected = selectedPayment === m.id;
                                    return (
                                        <TouchableOpacity
                                            key={m.id}
                                            onPress={() => setSelectedPayment(m.id)}
                                            activeOpacity={0.8}
                                            style={[s.payCard, isSelected && s.payCardSelected]}
                                        >
                                            {isSelected && (
                                                <View style={s.payCheckDot}>
                                                    <Ionicons name="checkmark" size={9} color={WHITE} />
                                                </View>
                                            )}
                                            <View style={[s.payIconWrap, { backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC' }]}>
                                                <Ionicons name={m.icon} size={18} color={m.color} />
                                            </View>
                                            <Text numberOfLines={1} style={[s.payName, isSelected && s.payNameSelected]}>
                                                {m.name}
                                            </Text>
                                            <Text numberOfLines={1} style={s.paySub}>{m.sub}</Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* ── 6. DETAILED PRICE BREAKDOWN ─────────────────────── */}
                        <View style={s.summaryCard}>
                            <Text style={s.summaryTitle}>Order Summary</Text>

                            {/* Subtotal */}
                            <View style={s.summaryRow}>
                                <Text style={s.summaryLabel}>
                                    Items Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                                </Text>
                                <Text style={s.summaryValue}>{formatNaira(subtotal)}</Text>
                            </View>

                            {/* Delivery */}
                            <View style={s.summaryRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={s.summaryLabel}>Estimated Delivery</Text>
                                    {isFreeShipping && (
                                        <View style={s.freePill}><Text style={s.freePillTxt}>FREE</Text></View>
                                    )}
                                </View>
                                <Text style={[s.summaryValue, isFreeShipping && { color: EMERALD, fontWeight: '800' }]}>
                                    {isFreeShipping ? '₦0' : formatNaira(deliveryFee)}
                                </Text>
                            </View>

                            {/* Coupon Savings */}
                            {discount > 0 && (
                                <View style={s.summaryRow}>
                                    <Text style={[s.summaryLabel, { color: EMERALD }]}>
                                        Voucher Discount ({appliedPromo?.code})
                                    </Text>
                                    <Text style={[s.summaryValue, { color: EMERALD }]}>
                                        -{formatNaira(discount)}
                                    </Text>
                                </View>
                            )}

                            <View style={s.summaryDivider} />

                            {/* Grand Total */}
                            <View style={s.grandTotalRow}>
                                <View>
                                    <Text style={s.grandTotalTitle}>Grand Total</Text>
                                    <Text style={s.grandTotalSub}>Escrow protection & dispatch included</Text>
                                </View>
                                <Text style={s.grandTotalValue}>{formatNaira(total)}</Text>
                            </View>
                        </View>

                        {/* Security Assurance */}
                        <View style={s.securityBanner}>
                            <Ionicons name="lock-closed" size={13} color={SLATE} />
                            <Text style={s.securityBannerTxt}>
                                Abu Mafhal Escrow Protection: Funds released to sellers only after verified delivery confirmation.
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* ── 3. FIXED BOTTOM CHECKOUT ACTION BAR ───────────────────────── */}
            {cart.length > 0 && (
                <View style={s.bottomBar}>
                    <View style={s.bottomInfoBox}>
                        <Text style={s.bottomPayableLabel}>Total Payable</Text>
                        <Text style={s.bottomPayableAmount}>{formatNaira(total)}</Text>
                        <Text style={s.bottomDeliveryNote}>
                            {isFreeShipping ? '✓ Free Delivery' : `+ ${formatNaira(deliveryFee)} Est. Delivery`}
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={handleProceedToCheckout}
                        style={s.checkoutBtn}
                        activeOpacity={0.88}
                    >
                        <LinearGradient
                            colors={[GOLD, '#C4922A']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.checkoutBtnGrad}
                        >
                            <Ionicons name="lock-closed" size={16} color={NAVY} />
                            <Text style={s.checkoutBtnTxt}>Proceed to Checkout</Text>
                            <Ionicons name="arrow-forward" size={16} color={NAVY} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── 4. FLOATING TOAST FEEDBACK ───────────────────────────────── */}
            <Animated.View
                pointerEvents="none"
                style={[
                    s.toast,
                    {
                        opacity: toastAnim,
                        transform: [{
                            translateY: toastAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-20, 0]
                            })
                        }]
                    }
                ]}
            >
                <Ionicons name="checkmark-circle" size={16} color={GOLD} />
                <Text style={s.toastTxt}>{toastMessage}</Text>
            </Animated.View>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
    },
    // Top Bar
    header: {
        paddingTop: Platform.OS === 'android' ? 12 : 6,
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomLeftRadius: 20,
        borderBottomRightRadius: 20,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    headerBackBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    logoCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: WHITE,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 4,
    },
    logoImg: {
        width: 24,
        height: 24,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: WHITE,
        letterSpacing: 0.3,
    },
    headerSub: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.7)',
        marginTop: 1,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8,
    },
    clearBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FCA5A5',
    },

    // Free Shipping Banner
    freeShipBanner: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        padding: 10,
        marginTop: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    freeShipTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    freeShipText: {
        fontSize: 11.5,
        fontWeight: '600',
    },
    freeShipGoal: {
        fontSize: 11,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.7)',
        marginLeft: 8,
    },
    progressTrack: {
        height: 5,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 3,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        borderRadius: 3,
    },

    scrollContent: {
        padding: 14,
    },

    // Empty Basket
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        paddingHorizontal: 20,
    },
    emptyIconCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 12.5,
        color: SLATE,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20,
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: GOLD,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 12,
    },
    emptyBtnTxt: {
        fontSize: 13.5,
        fontWeight: '900',
        color: NAVY,
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
        paddingHorizontal: 2,
    },
    sectionAccent: {
        width: 4,
        height: 14,
        backgroundColor: GOLD,
        borderRadius: 2,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '800',
        color: NAVY,
    },
    countPill: {
        backgroundColor: NAVY,
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 6,
    },
    countPillTxt: {
        fontSize: 10.5,
        fontWeight: '800',
        color: GOLD,
    },
    sectionSub: {
        fontSize: 11,
        color: SLATE,
        fontWeight: '500',
    },

    // Vendor Group Card
    vendorGroupCard: {
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.04,
        shadowRadius: 5,
        elevation: 1,
    },
    vendorHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 8,
        marginBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    vendorName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY,
    },
    verifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    verifiedBadgeTxt: {
        fontSize: 9,
        fontWeight: '700',
        color: '#1D4ED8',
    },
    vendorItemCount: {
        fontSize: 10.5,
        color: SLATE,
        fontWeight: '600',
    },

    // Item Row
    itemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
    },
    itemRowDivider: {
        borderTopWidth: 1,
        borderTopColor: '#F8FAFC',
        paddingTop: 10,
    },
    itemImgBox: {
        width: 64,
        height: 64,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        overflow: 'hidden',
        position: 'relative',
    },
    itemImg: {
        width: '100%',
        height: '100%',
    },
    qtyTag: {
        position: 'absolute',
        top: 2,
        right: 2,
        backgroundColor: 'rgba(14, 26, 46, 0.85)',
        paddingHorizontal: 4,
        paddingVertical: 1,
        borderRadius: 4,
    },
    qtyTagTxt: {
        color: WHITE,
        fontSize: 8.5,
        fontWeight: '800',
    },
    itemDetails: {
        flex: 1,
        marginHorizontal: 10,
    },
    itemTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: SLATE_DARK,
        lineHeight: 17,
        marginBottom: 3,
    },
    variantPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
        alignSelf: 'flex-start',
        marginBottom: 4,
    },
    variantPillTxt: {
        fontSize: 9.5,
        fontWeight: '600',
        color: SLATE,
    },
    priceBox: {
        flexDirection: 'row',
        alignItems: 'baseline',
        gap: 6,
    },
    itemPrice: {
        fontSize: 13,
        fontWeight: '900',
        color: NAVY,
    },
    itemOldPrice: {
        fontSize: 10.5,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },

    // Stepper Controls
    itemActions: {
        alignItems: 'flex-end',
        gap: 4,
    },
    deleteBtn: {
        padding: 2,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    stepperBtn: {
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F1F5F9',
    },
    stepperBtnAdd: {
        backgroundColor: NAVY,
    },
    stepperValue: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
        paddingHorizontal: 8,
        minWidth: 20,
        textAlign: 'center',
    },
    lineTotal: {
        fontSize: 11,
        fontWeight: '800',
        color: SLATE,
        marginTop: 2,
    },

    // Address Card
    addressCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },
    addressIconBox: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    addressCardTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
    },
    addressChangeTxt: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#2563EB',
    },
    addressRecipient: {
        fontSize: 12,
        fontWeight: '700',
        color: SLATE_DARK,
    },
    lgaPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    lgaPillTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#92400E',
    },
    addressText: {
        fontSize: 12,
        color: '#475569',
        marginTop: 2,
        lineHeight: 16,
    },
    addressRegion: {
        fontSize: 11,
        color: SLATE,
        marginTop: 2,
        fontWeight: '500',
    },
    noAddressTxt: {
        fontSize: 11.5,
        color: SLATE,
    },

    // Coupon Card
    couponCard: {
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER,
    },
    couponHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    couponTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY,
    },
    couponRemoveTxt: {
        fontSize: 11.5,
        fontWeight: '700',
        color: DANGER,
    },
    couponInputRow: {
        flexDirection: 'row',
        gap: 8,
    },
    couponInput: {
        flex: 1,
        height: 40,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY,
    },
    couponApplyBtn: {
        backgroundColor: GOLD,
        paddingHorizontal: 14,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    couponApplyBtnTxt: {
        fontSize: 12,
        fontWeight: '900',
        color: NAVY,
    },
    couponErrorTxt: {
        fontSize: 10.5,
        color: DANGER,
        marginTop: 5,
        fontWeight: '600',
    },
    couponAppliedBox: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#ECFDF5',
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#A7F3D0',
    },
    couponAppliedCode: {
        fontSize: 13,
        fontWeight: '900',
        color: '#065F46',
    },
    couponAppliedDesc: {
        fontSize: 10.5,
        color: '#047857',
        marginTop: 1,
    },
    couponSavingsVal: {
        fontSize: 13,
        fontWeight: '900',
        color: EMERALD,
    },
    activeCouponsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 8,
        flexWrap: 'wrap',
    },
    activeCouponsHint: {
        fontSize: 10.5,
        color: SLATE,
        fontWeight: '600',
    },
    activeCouponChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 0.5,
        borderColor: '#FDE68A',
    },
    activeCouponChipTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#B45309',
    },

    // Payment Methods
    payHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingHorizontal: 2,
    },
    payHeaderTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    secureBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '700',
        color: '#059669',
    },
    payCard: {
        width: 135,
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 10,
        borderWidth: 1.5,
        borderColor: BORDER,
        position: 'relative',
    },
    payCardSelected: {
        borderColor: GOLD,
        backgroundColor: '#FFFDF7',
    },
    payCheckDot: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 16,
        height: 16,
        borderRadius: 8,
        backgroundColor: GOLD,
        alignItems: 'center',
        justifyContent: 'center',
    },
    payIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    payName: {
        fontSize: 12,
        fontWeight: '700',
        color: SLATE_DARK,
        marginBottom: 2,
    },
    payNameSelected: {
        color: NAVY,
        fontWeight: '800',
    },
    paySub: {
        fontSize: 9.5,
        color: SLATE,
    },

    // Price Breakdown Summary
    summaryCard: {
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 10,
    },
    summaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    summaryLabel: {
        fontSize: 12,
        color: '#475569',
    },
    summaryValue: {
        fontSize: 12.5,
        fontWeight: '700',
        color: SLATE_DARK,
    },
    freePill: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    freePillTxt: {
        fontSize: 9,
        fontWeight: '900',
        color: '#166534',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 10,
    },
    grandTotalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    grandTotalTitle: {
        fontSize: 14.5,
        fontWeight: '900',
        color: NAVY,
    },
    grandTotalSub: {
        fontSize: 10,
        color: SLATE,
        marginTop: 1,
    },
    grandTotalValue: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY,
    },

    // Security Notice
    securityBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 4,
        marginBottom: 20,
    },
    securityBannerTxt: {
        fontSize: 10.5,
        color: SLATE,
        flex: 1,
        lineHeight: 15,
    },

    // Sticky Bottom Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: WHITE,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        paddingBottom: Platform.OS === 'ios' ? 24 : 12,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 8,
        elevation: 8,
    },
    bottomInfoBox: {
        flex: 1,
    },
    bottomPayableLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: SLATE,
        textTransform: 'uppercase',
    },
    bottomPayableAmount: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
    },
    bottomDeliveryNote: {
        fontSize: 10,
        color: EMERALD,
        fontWeight: '700',
    },
    checkoutBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    checkoutBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 18,
        paddingVertical: 12,
    },
    checkoutBtnTxt: {
        fontSize: 13.5,
        fontWeight: '900',
        color: NAVY,
    },

    // Floating Toast
    toast: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: NAVY,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        elevation: 8,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 8,
        zIndex: 999,
    },
    toastTxt: {
        color: WHITE,
        fontSize: 12,
        fontWeight: '700',
    },
});

export default CartPage;
