import React, { useState, useMemo, useRef, useCallback } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, Image, StatusBar,
    Platform, Alert, StyleSheet, TextInput, Animated, Dimensions
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { parsePrice } from '../utils/helpers';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

// ─── Luxury Color Palette ─────────────────────────────────────────────────────
const NAVY        = '#0A192F';
const NAVY_LIGHT  = '#112240';
const GOLD        = '#D9A73A';
const GOLD_LIGHT  = 'rgba(217, 167, 58, 0.14)';
const GOLD_BORDER = 'rgba(217, 167, 58, 0.32)';
const BG          = '#F4F7FC';
const WHITE       = '#FFFFFF';
const SLATE       = '#64748B';
const SLATE_DARK  = '#0F172A';
const BORDER      = '#E2E8F0';
const EMERALD     = '#10B981';
const DANGER      = '#EF4444';

const FREE_SHIPPING_THRESHOLD = 50000; // ₦50,000 threshold for free delivery
const STANDARD_DELIVERY_FEE   = 2500;

const PAYMENT_METHODS = [
    { id: 'Paystack',    name: 'Paystack',        icon: 'card-outline',     sub: 'Card, Bank & USSD',  color: '#00C3F8' },
    { id: 'Flutterwave', name: 'Flutterwave',     icon: 'flash-outline',    sub: 'Bank & Transfers',   color: '#F5A623' },
    { id: 'Wallet',      name: 'Abu Mafhal Wallet',icon: 'wallet-outline',   sub: 'Instant Balance',    color: '#10B981' },
    { id: 'Crypto',      name: 'Crypto (USDT/BTC)',icon: 'logo-bitcoin',    sub: 'Web3 & Coins',       color: '#8B5CF6' },
    { id: 'pod',         name: 'Pay on Delivery', icon: 'bicycle-outline',  sub: 'Cash on Arrival',    color: '#F97316' },
];

const PROMO_CODES = {
    'WELCOME10': { type: 'percent', value: 10, max: 10000, desc: '10% Welcome Discount' },
    'ABU5':      { type: 'percent', value: 5,  max: 5000,  desc: '5% Platform Discount' },
    'FREESHIP':  { type: 'shipping',value: 2500, max: 2500,desc: 'Free Shipping Voucher' },
    'SPECIAL2026':{ type: 'fixed',  value: 3000, max: 3000, desc: '₦3,000 Exclusive Voucher' },
};

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400&auto=format&fit=crop';

const getItemImage = (item) => {
    if (!item) return FALLBACK_IMAGE;
    if (Array.isArray(item.images) && item.images[0]) return item.images[0];
    if (typeof item.images === 'string' && item.images.startsWith('http')) return item.images;
    if (item.image_url && item.image_url.startsWith('http')) return item.image_url;
    if (item.image && item.image.startsWith('http')) return item.image;
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

    // ── States ────────────────────────────────────────────────────────────────
    const [selectedPayment, setSelectedPayment] = useState('Paystack');
    const [promoInput, setPromoInput]           = useState('');
    const [appliedPromo, setAppliedPromo]       = useState(null);
    const [promoError, setPromoError]           = useState('');
    const [promoApplying, setPromoApplying]     = useState(false);
    const [itemToRemove, setItemToRemove]       = useState(null);

    // Toast feedback state
    const [toastMessage, setToastMessage] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = useCallback((msg) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 180, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true })
        ]).start();
    }, [toastAnim]);

    // ── Financial Calculations ────────────────────────────────────────────────
    const subtotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const price = parsePrice(item.price);
            const qty = parseInt(item.qty || item.quantity || 1, 10) || 1;
            return sum + (price * qty);
        }, 0);
    }, [cart]);

    const isFreeShippingByValue = subtotal >= FREE_SHIPPING_THRESHOLD;
    const isFreeShippingByPromo = appliedPromo?.code === 'FREESHIP';
    const isFreeShipping = isFreeShippingByValue || isFreeShippingByPromo;

    const deliveryFee = cart.length === 0 ? 0 : (isFreeShipping ? 0 : STANDARD_DELIVERY_FEE);

    const discount = useMemo(() => {
        if (!appliedPromo || cart.length === 0) return 0;
        const config = appliedPromo.config;
        if (config.type === 'percent') {
            const raw = Math.floor(subtotal * (config.value / 100));
            return Math.min(config.max, raw);
        }
        if (config.type === 'fixed') {
            return Math.min(subtotal, config.value);
        }
        if (config.type === 'shipping') {
            return STANDARD_DELIVERY_FEE;
        }
        return 0;
    }, [appliedPromo, subtotal, cart.length]);

    const total = Math.max(0, subtotal + deliveryFee - (appliedPromo?.config?.type === 'shipping' ? 0 : discount));

    const freeShippingProgress = Math.min(1, Math.max(0, subtotal / FREE_SHIPPING_THRESHOLD));
    const amountNeededForFreeShip = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);

    // ── Quantity & Removal Handlers ───────────────────────────────────────────
    const handleQtyChange = (item, change) => {
        const currentQty = parseInt(item.qty || item.quantity || 1, 10) || 1;
        if (currentQty === 1 && change === -1) {
            // Confirm removal if stepping below 1
            promptRemoveItem(item);
            return;
        }
        if (onUpdateQty) {
            onUpdateQty(item.id, change);
            showToast(change > 0 ? `Added one more ${item.name || ''}` : `Updated quantity`);
        }
    };

    const promptRemoveItem = (item) => {
        if (Platform.OS === 'web') {
            const confirmed = typeof window !== 'undefined' ? window.confirm(`Remove "${item.name || 'this item'}" from your cart?`) : true;
            if (confirmed && onRemove) {
                onRemove(item.id);
                showToast('Item removed from cart');
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
                            showToast('Item removed from cart');
                        }
                    }
                ]
            );
        }
    };

    const handleClearCart = () => {
        if (Platform.OS === 'web') {
            const confirmed = typeof window !== 'undefined' ? window.confirm('Are you sure you want to clear your entire cart?') : true;
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

    // ── Promo Code Handler ────────────────────────────────────────────────────
    const handleApplyPromo = (codeToApply) => {
        const target = (codeToApply || promoInput).trim().toUpperCase();
        setPromoError('');
        if (!target) {
            setPromoError('Please enter a voucher or promo code.');
            return;
        }

        setPromoApplying(true);
        setTimeout(() => {
            setPromoApplying(false);
            if (PROMO_CODES[target]) {
                setAppliedPromo({ code: target, config: PROMO_CODES[target] });
                setPromoInput('');
                setPromoError('');
                showToast(`✓ Voucher ${target} applied!`);
            } else {
                setPromoError(`Code "${target}" is invalid or has expired.`);
            }
        }, 350);
    };

    const handleRemovePromo = () => {
        setAppliedPromo(null);
        setPromoError('');
        showToast('Promo code removed');
    };

    // ── Checkout Action ───────────────────────────────────────────────────────
    const handleProceedToCheckout = async () => {
        if (cart.length === 0) {
            Alert.alert('Empty Cart', 'Please add items to your cart before proceeding to checkout.');
            return;
        }

        try {
            const { data: { user: authUser } } = await supabase.auth.getUser();
            if (!authUser && !user) {
                Alert.alert(
                    'Login Required',
                    'Please log in to finalize your purchase and track delivery.',
                    [
                        { text: 'Cancel', style: 'cancel' },
                        {
                            text: 'Login',
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
                paymentMethod: selectedPayment
            });
        } catch (e) {
            console.error('Checkout transition error:', e);
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

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <View style={s.container}>
            <StatusBar backgroundColor={NAVY} barStyle="light-content" />

            {/* ── 1. MODERN TOP BAR ────────────────────────────────────────── */}
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
                        style={s.headerIconBtn}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="arrow-back" size={20} color={WHITE} />
                    </TouchableOpacity>

                    {/* Brand Emblem & Title */}
                    <View style={s.headerTitleBox}>
                        <View style={s.logoEmblem}>
                            <Image source={AM_LOGO} style={s.logoImg} resizeMode="contain" />
                        </View>
                        <View>
                            <Text style={s.headerBrandTxt}>
                                Abu <Text style={{ color: GOLD }}>Mafhal</Text> Cart
                            </Text>
                            <Text style={s.headerSubtitleTxt}>
                                {cart.length === 0 ? 'Empty' : `${cart.length} ${cart.length === 1 ? 'item' : 'items'} in basket`}
                            </Text>
                        </View>
                    </View>

                    {/* Clear Cart Action Button */}
                    {cart.length > 0 ? (
                        <TouchableOpacity
                            onPress={handleClearCart}
                            style={s.clearBtn}
                            activeOpacity={0.75}
                        >
                            <Ionicons name="trash-outline" size={15} color={DANGER} />
                            <Text style={s.clearBtnTxt}>Clear</Text>
                        </TouchableOpacity>
                    ) : (
                        <View style={{ width: 38 }} />
                    )}
                </View>

                {/* ── FREE SHIPPING PROGRESS BAR (GAMIFIED) ── */}
                {cart.length > 0 && (
                    <View style={s.freeShipBanner}>
                        <View style={s.freeShipTopRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons
                                    name={isFreeShipping ? "checkmark-circle" : "bicycle-outline"}
                                    size={15}
                                    color={isFreeShipping ? EMERALD : GOLD}
                                />
                                <Text style={s.freeShipLabel}>
                                    {isFreeShipping ? (
                                        <Text style={{ color: EMERALD, fontWeight: '800' }}>
                                            🎉 You unlocked FREE SHIPPING!
                                        </Text>
                                    ) : (
                                        <Text style={{ color: WHITE }}>
                                            Add <Text style={{ color: GOLD, fontWeight: '800' }}>{formatNaira(amountNeededForFreeShip)}</Text> for <Text style={{ fontWeight: '800' }}>FREE SHIPPING</Text>
                                        </Text>
                                    )}
                                </Text>
                            </View>
                            <Text style={s.freeShipGoal}>{formatNaira(FREE_SHIPPING_THRESHOLD)}</Text>
                        </View>

                        {/* Progress track */}
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
                {/* EMPTY CART STATE */}
                {cart.length === 0 ? (
                    <View style={s.emptyBox}>
                        <View style={s.emptyIconCircle}>
                            <LinearGradient
                                colors={['rgba(217, 167, 58, 0.22)', 'rgba(217, 167, 58, 0.05)']}
                                style={s.emptyGradCircle}
                            >
                                <Ionicons name="cart-outline" size={54} color={GOLD} />
                            </LinearGradient>
                        </View>

                        <Text style={s.emptyTitle}>Your Basket is Empty</Text>
                        <Text style={s.emptySub}>
                            Explore Abu Mafhal Marketplace's top deals and discover authentic products at verified prices.
                        </Text>

                        <View style={s.emptyBtnStack}>
                            <TouchableOpacity
                                onPress={onBack || (() => navigation.navigate('Shop'))}
                                style={s.emptyPrimaryBtn}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={[GOLD, '#C4922A']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={s.emptyPrimaryBtnGrad}
                                >
                                    <Ionicons name="sparkles" size={17} color={NAVY} />
                                    <Text style={s.emptyPrimaryBtnTxt}>Start Shopping Now</Text>
                                    <Ionicons name="arrow-forward" size={17} color={NAVY} />
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => navigation.navigate('Main', { screen: 'home' })}
                                style={s.emptySecondaryBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="home-outline" size={15} color={NAVY} />
                                <Text style={s.emptySecondaryBtnTxt}>Explore Home Page</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : (
                    <>
                        {/* SECTION HEADER */}
                        <View style={s.sectionHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={s.sectionAccent} />
                                <Text style={s.sectionTitle}>Cart Items</Text>
                                <View style={s.countPill}>
                                    <Text style={s.countPillTxt}>{cart.length}</Text>
                                </View>
                            </View>
                            <Text style={s.currencyNotice}>All prices in NGN (₦)</Text>
                        </View>

                        {/* LIST OF CART ITEMS */}
                        <View style={{ gap: 12, marginBottom: 20 }}>
                            {cart.map((item, index) => {
                                const price = parsePrice(item.price);
                                const qty = parseInt(item.qty || item.quantity || 1, 10) || 1;
                                const itemTotal = price * qty;
                                const imgUri = getItemImage(item);
                                const vendor = item.vendor_name || item.brand || item.vendor?.store_name || 'Verified Merchant';

                                return (
                                    <View key={item.id || index} style={s.itemCard}>
                                        {/* Product Image */}
                                        <View style={s.itemImgBox}>
                                            <Image source={{ uri: imgUri }} style={s.itemImg} resizeMode="cover" />
                                            {qty > 1 && (
                                                <View style={s.itemQtyBadge}>
                                                    <Text style={s.itemQtyBadgeTxt}>×{qty}</Text>
                                                </View>
                                            )}
                                        </View>

                                        {/* Item Info Details */}
                                        <View style={s.itemInfo}>
                                            {/* Store / Brand Tag */}
                                            <View style={s.storeBadge}>
                                                <Ionicons name="storefront-outline" size={10} color={GOLD} />
                                                <Text numberOfLines={1} style={s.storeBadgeTxt}>
                                                    {vendor}
                                                </Text>
                                            </View>

                                            {/* Item Name */}
                                            <Text numberOfLines={2} style={s.itemTitle}>
                                                {item.name || 'Marketplace Product'}
                                            </Text>

                                            {/* Variant Attributes (Size, Storage, Color) */}
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

                                            {/* Unit & Line Total */}
                                            <View style={s.priceRow}>
                                                <Text style={s.itemPrice}>{formatNaira(price)}</Text>
                                                {item.compare_at_price && Number(item.compare_at_price) > price && (
                                                    <Text style={s.itemOldPrice}>{formatNaira(item.compare_at_price)}</Text>
                                                )}
                                            </View>
                                        </View>

                                        {/* Stepper Controls & Delete */}
                                        <View style={s.itemActionsCol}>
                                            {/* Delete Trash Button */}
                                            <TouchableOpacity
                                                onPress={() => promptRemoveItem(item)}
                                                style={s.deleteBtn}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#94A3B8" />
                                            </TouchableOpacity>

                                            {/* Tactile Stepper */}
                                            <View style={s.stepper}>
                                                <TouchableOpacity
                                                    onPress={() => handleQtyChange(item, -1)}
                                                    style={s.stepperBtn}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons
                                                        name={qty === 1 ? "trash-outline" : "remove"}
                                                        size={qty === 1 ? 13 : 14}
                                                        color={qty === 1 ? DANGER : NAVY}
                                                    />
                                                </TouchableOpacity>

                                                <Text style={s.stepperValue}>{qty}</Text>

                                                <TouchableOpacity
                                                    onPress={() => handleQtyChange(item, 1)}
                                                    style={[s.stepperBtn, s.stepperBtnPlus]}
                                                    activeOpacity={0.7}
                                                >
                                                    <Ionicons name="add" size={14} color={WHITE} />
                                                </TouchableOpacity>
                                            </View>

                                            {/* Line total under stepper */}
                                            <Text style={s.lineTotalTxt}>{formatNaira(itemTotal)}</Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* ── 3. PROMO & VOUCHER CODE SECTION ──────────────── */}
                        <View style={s.promoCard}>
                            <View style={s.promoHeaderRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="pricetag-outline" size={16} color={GOLD} />
                                    <Text style={s.promoCardTitle}>Vouchers & Promo Codes</Text>
                                </View>
                                {appliedPromo && (
                                    <TouchableOpacity onPress={handleRemovePromo} style={s.promoRemoveBtn}>
                                        <Text style={s.promoRemoveBtnTxt}>Remove</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {appliedPromo ? (
                                <View style={s.promoAppliedBox}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Ionicons name="checkmark-circle" size={20} color={EMERALD} />
                                        <View>
                                            <Text style={s.promoAppliedCode}>{appliedPromo.code}</Text>
                                            <Text style={s.promoAppliedDesc}>{appliedPromo.config.desc}</Text>
                                        </View>
                                    </View>
                                    <Text style={s.promoAppliedSavings}>
                                        -{formatNaira(discount)}
                                    </Text>
                                </View>
                            ) : (
                                <>
                                    <View style={s.promoInputRow}>
                                        <TextInput
                                            placeholder="Enter discount or voucher code"
                                            placeholderTextColor="#94A3B8"
                                            style={s.promoInput}
                                            value={promoInput}
                                            onChangeText={(t) => { setPromoInput(t); setPromoError(''); }}
                                            autoCapitalize="characters"
                                            returnKeyType="done"
                                        />
                                        <TouchableOpacity
                                            onPress={() => handleApplyPromo()}
                                            disabled={promoApplying || !promoInput.trim()}
                                            style={[s.promoApplyBtn, (!promoInput.trim() || promoApplying) && s.promoApplyBtnDisabled]}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={s.promoApplyBtnTxt}>
                                                {promoApplying ? 'Applying…' : 'Apply'}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {promoError ? (
                                        <Text style={s.promoErrorTxt}>⚠️ {promoError}</Text>
                                    ) : null}

                                    {/* Quick Suggestion Chips */}
                                    <View style={s.chipsRow}>
                                        <Text style={s.chipsHint}>Available:</Text>
                                        {['WELCOME10', 'ABU5', 'FREESHIP'].map((code) => (
                                            <TouchableOpacity
                                                key={code}
                                                onPress={() => handleApplyPromo(code)}
                                                style={s.chipPill}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="flash" size={9} color={GOLD} />
                                                <Text style={s.chipPillTxt}>{code}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </>
                            )}
                        </View>

                        {/* ── 4. DELIVERY ADDRESS SUMMARY ──────────────────── */}
                        <View style={s.addressCard}>
                            <View style={s.addressIconWrap}>
                                <Ionicons name="location" size={18} color="#0284C7" />
                            </View>

                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={s.addressTitle}>Delivery Destination</Text>
                                    <TouchableOpacity
                                        onPress={() => navigation.navigate('AddressPage')}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Text style={s.addressEditTxt}>Change</Text>
                                    </TouchableOpacity>
                                </View>

                                <Text style={s.addressRecipient}>
                                    {user?.full_name || user?.fullName || user?.email?.split('@')[0] || 'Default Shipping Address'}
                                </Text>
                                <Text style={s.addressDetail} numberOfLines={2}>
                                    {user?.address || 'Set your primary home or office delivery address in account settings'}
                                </Text>
                                {user?.phone && (
                                    <Text style={s.addressPhone}>📞 {user.phone}</Text>
                                )}
                            </View>
                        </View>

                        {/* ── 5. PAYMENT METHOD SELECTOR ───────────────────── */}
                        <View style={{ marginBottom: 18 }}>
                            <View style={s.paymentHeaderRow}>
                                <Text style={s.paymentTitle}>Payment Gateway</Text>
                                <View style={s.paymentBadge}>
                                    <Ionicons name="shield-checkmark" size={11} color={EMERALD} />
                                    <Text style={s.paymentBadgeTxt}>100% Encrypted</Text>
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
                                                <View style={s.payCheckPill}>
                                                    <Ionicons name="checkmark" size={10} color={WHITE} />
                                                </View>
                                            )}
                                            <View style={[s.payIconWrap, { backgroundColor: isSelected ? 'rgba(10, 25, 47, 0.08)' : '#F8FAFC' }]}>
                                                <Ionicons name={m.icon} size={20} color={m.color} />
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

                        {/* ── 6. DETAILED ORDER BREAKDOWN ──────────────────── */}
                        <View style={s.summaryCard}>
                            <Text style={s.summaryCardTitle}>Price Breakdown</Text>

                            {/* Subtotal */}
                            <View style={s.breakdownRow}>
                                <Text style={s.breakdownLabel}>
                                    Items Subtotal ({cart.length} {cart.length === 1 ? 'item' : 'items'})
                                </Text>
                                <Text style={s.breakdownVal}>{formatNaira(subtotal)}</Text>
                            </View>

                            {/* Delivery */}
                            <View style={s.breakdownRow}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={s.breakdownLabel}>Estimated Delivery</Text>
                                    {isFreeShipping && (
                                        <View style={s.freePill}><Text style={s.freePillTxt}>FREE</Text></View>
                                    )}
                                </View>
                                <Text style={[s.breakdownVal, isFreeShipping && { color: EMERALD, fontWeight: '900' }]}>
                                    {isFreeShipping ? '₦0' : formatNaira(deliveryFee)}
                                </Text>
                            </View>

                            {/* Discount */}
                            {discount > 0 && (
                                <View style={s.breakdownRow}>
                                    <Text style={[s.breakdownLabel, { color: EMERALD }]}>
                                        Coupon Savings ({appliedPromo?.code || 'Promo'})
                                    </Text>
                                    <Text style={[s.breakdownVal, { color: EMERALD }]}>
                                        -{formatNaira(discount)}
                                    </Text>
                                </View>
                            )}

                            {/* Divider */}
                            <View style={s.summaryDivider} />

                            {/* Grand Total */}
                            <View style={s.grandTotalRow}>
                                <View>
                                    <Text style={s.grandTotalLabel}>Grand Total</Text>
                                    <Text style={s.grandTotalHint}>VAT & Buyer Protection included</Text>
                                </View>
                                <Text style={s.grandTotalVal}>{formatNaira(total)}</Text>
                            </View>
                        </View>

                        {/* Security Assurance */}
                        <View style={s.securityNotice}>
                            <Ionicons name="lock-closed" size={13} color={SLATE} />
                            <Text style={s.securityNoticeTxt}>
                                Abu Mafhal Escrow Protection: Funds released only after delivery confirmation.
                            </Text>
                        </View>
                    </>
                )}
            </ScrollView>

            {/* ── 3. FIXED BOTTOM CHECKOUT BAR (MOBILE-FIRST) ─────────────── */}
            {cart.length > 0 && (
                <View style={s.bottomBar}>
                    <View style={s.bottomTotalBox}>
                        <Text style={s.bottomTotalLabel}>Total Payable</Text>
                        <Text style={s.bottomTotalAmount}>{formatNaira(total)}</Text>
                        <Text style={s.bottomDeliveryTag}>
                            {isFreeShipping ? '✓ Free Shipping' : '+ ₦2,500 Delivery'}
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
                            <Ionicons name="lock-closed" size={17} color={NAVY} />
                            <Text style={s.checkoutBtnTxt}>Checkout</Text>
                            <Ionicons name="arrow-forward" size={17} color={NAVY} />
                        </LinearGradient>
                    </TouchableOpacity>
                </View>
            )}

            {/* ── 4. FLOATING TOAST NOTIFICATION ─────────────────────────── */}
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

// ─── STYLESHEET ───────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
    },

    // Header
    header: {
        paddingTop: Platform.OS === 'android' ? 44 : 52,
        paddingBottom: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: GOLD_BORDER,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
        zIndex: 10,
    },
    headerRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    headerIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    headerTitleBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 9,
    },
    logoEmblem: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: 'rgba(217, 167, 58, 0.18)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: GOLD_BORDER,
    },
    logoImg: {
        width: 22,
        height: 22,
    },
    headerBrandTxt: {
        color: WHITE,
        fontSize: 16,
        fontWeight: '900',
        letterSpacing: -0.2,
    },
    headerSubtitleTxt: {
        color: '#94A3B8',
        fontSize: 10.5,
        fontWeight: '600',
        marginTop: 1,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    clearBtnTxt: {
        color: DANGER,
        fontSize: 11,
        fontWeight: '800',
    },

    // Free Shipping Progress
    freeShipBanner: {
        marginTop: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    freeShipTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    freeShipLabel: {
        fontSize: 11,
        fontWeight: '700',
    },
    freeShipGoal: {
        color: '#94A3B8',
        fontSize: 10,
        fontWeight: '700',
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

    // Scroll container
    scrollContent: {
        paddingHorizontal: 16,
        paddingTop: 16,
    },

    // Section Header
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
        paddingHorizontal: 2,
    },
    sectionAccent: {
        width: 3.5,
        height: 15,
        borderRadius: 2,
        backgroundColor: GOLD,
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: -0.2,
    },
    countPill: {
        backgroundColor: GOLD_LIGHT,
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
    },
    countPillTxt: {
        fontSize: 10,
        fontWeight: '900',
        color: NAVY,
    },
    currencyNotice: {
        fontSize: 11,
        color: SLATE,
        fontWeight: '600',
    },

    // Item Card
    itemCard: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 13,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 1.5,
    },
    itemImgBox: {
        width: 78,
        height: 78,
        borderRadius: 15,
        backgroundColor: '#F8FAFC',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#EEF2F6',
        position: 'relative',
    },
    itemImg: {
        width: '100%',
        height: '100%',
    },
    itemQtyBadge: {
        position: 'absolute',
        bottom: 4,
        right: 4,
        backgroundColor: NAVY,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 6,
    },
    itemQtyBadgeTxt: {
        color: WHITE,
        fontSize: 9,
        fontWeight: '900',
    },
    itemInfo: {
        flex: 1,
        marginLeft: 12,
        paddingRight: 6,
    },
    storeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginBottom: 2,
    },
    storeBadgeTxt: {
        fontSize: 10,
        color: GOLD,
        fontWeight: '800',
        letterSpacing: 0.2,
    },
    itemTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: SLATE_DARK,
        lineHeight: 18,
    },
    variantPill: {
        alignSelf: 'flex-start',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
    },
    variantPillTxt: {
        fontSize: 10,
        color: SLATE,
        fontWeight: '700',
    },
    priceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 5,
    },
    itemPrice: {
        fontSize: 14.5,
        fontWeight: '900',
        color: NAVY,
    },
    itemOldPrice: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
        textDecorationLine: 'line-through',
    },
    itemActionsCol: {
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        gap: 8,
    },
    deleteBtn: {
        padding: 4,
    },
    stepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 11,
        borderWidth: 1,
        borderColor: BORDER,
        padding: 2,
    },
    stepperBtn: {
        width: 24,
        height: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: WHITE,
    },
    stepperBtnPlus: {
        backgroundColor: NAVY,
    },
    stepperValue: {
        fontSize: 12,
        fontWeight: '900',
        color: NAVY,
        minWidth: 20,
        textAlign: 'center',
        paddingHorizontal: 4,
    },
    lineTotalTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: SLATE,
    },

    // Promo code card
    promoCard: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER,
    },
    promoHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    promoCardTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: NAVY,
    },
    promoRemoveBtn: {
        paddingVertical: 2,
        paddingHorizontal: 6,
    },
    promoRemoveBtnTxt: {
        color: DANGER,
        fontSize: 11,
        fontWeight: '800',
    },
    promoInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    promoInput: {
        flex: 1,
        height: 42,
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY,
        borderWidth: 1,
        borderColor: BORDER,
    },
    promoApplyBtn: {
        height: 42,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: NAVY,
        alignItems: 'center',
        justifyContent: 'center',
    },
    promoApplyBtnDisabled: {
        opacity: 0.45,
    },
    promoApplyBtnTxt: {
        color: GOLD,
        fontSize: 12.5,
        fontWeight: '800',
    },
    promoErrorTxt: {
        color: DANGER,
        fontSize: 11,
        fontWeight: '700',
        marginTop: 6,
    },
    chipsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 10,
    },
    chipsHint: {
        fontSize: 10.5,
        color: SLATE,
        fontWeight: '700',
    },
    chipPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: GOLD_LIGHT,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
    },
    chipPillTxt: {
        fontSize: 10,
        fontWeight: '900',
        color: NAVY,
    },
    promoAppliedBox: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    promoAppliedCode: {
        fontSize: 13,
        fontWeight: '900',
        color: EMERALD,
    },
    promoAppliedDesc: {
        fontSize: 10.5,
        color: SLATE,
        fontWeight: '600',
        marginTop: 1,
    },
    promoAppliedSavings: {
        fontSize: 13.5,
        fontWeight: '900',
        color: EMERALD,
    },

    // Address card
    addressCard: {
        backgroundColor: WHITE,
        borderRadius: 20,
        padding: 15,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
    },
    addressIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 11,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    addressTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
    },
    addressEditTxt: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0284C7',
    },
    addressRecipient: {
        fontSize: 12.5,
        fontWeight: '700',
        color: SLATE_DARK,
        marginTop: 3,
    },
    addressDetail: {
        fontSize: 11.5,
        color: SLATE,
        marginTop: 2,
        lineHeight: 16,
    },
    addressPhone: {
        fontSize: 11,
        color: SLATE,
        marginTop: 2,
        fontWeight: '600',
    },

    // Payment methods
    paymentHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 2,
    },
    paymentTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY,
    },
    paymentBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    paymentBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: EMERALD,
    },
    payCard: {
        width: 120,
        backgroundColor: WHITE,
        borderRadius: 16,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderWidth: 1.5,
        borderColor: BORDER,
        alignItems: 'center',
        position: 'relative',
    },
    payCardSelected: {
        borderColor: GOLD,
        backgroundColor: '#FFFDF9',
    },
    payCheckPill: {
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
        width: 36,
        height: 36,
        borderRadius: 11,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    payName: {
        fontSize: 11,
        fontWeight: '700',
        color: SLATE_DARK,
        textAlign: 'center',
    },
    payNameSelected: {
        fontWeight: '900',
        color: NAVY,
    },
    paySub: {
        fontSize: 9,
        color: SLATE,
        marginTop: 1,
        textAlign: 'center',
    },

    // Order Summary Card
    summaryCard: {
        backgroundColor: WHITE,
        borderRadius: 22,
        padding: 16,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER,
    },
    summaryCardTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 12,
    },
    breakdownRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 9,
    },
    breakdownLabel: {
        fontSize: 12.5,
        color: SLATE,
        fontWeight: '600',
    },
    breakdownVal: {
        fontSize: 13,
        fontWeight: '800',
        color: SLATE_DARK,
    },
    freePill: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 5,
    },
    freePillTxt: {
        color: EMERALD,
        fontSize: 9.5,
        fontWeight: '900',
    },
    summaryDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 10,
    },
    grandTotalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    grandTotalLabel: {
        fontSize: 15,
        fontWeight: '900',
        color: NAVY,
    },
    grandTotalHint: {
        fontSize: 10,
        color: SLATE,
        marginTop: 1,
    },
    grandTotalVal: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY,
    },

    // Security notice
    securityNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 12,
        paddingHorizontal: 12,
    },
    securityNoticeTxt: {
        fontSize: 10.5,
        color: SLATE,
        fontWeight: '600',
        textAlign: 'center',
    },

    // Fixed Bottom Bar
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: WHITE,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: Platform.OS === 'ios' ? 32 : 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 8,
    },
    bottomTotalBox: {
        flex: 1,
        paddingRight: 12,
    },
    bottomTotalLabel: {
        fontSize: 10.5,
        color: SLATE,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    bottomTotalAmount: {
        fontSize: 19,
        fontWeight: '900',
        color: NAVY,
        marginTop: 1,
    },
    bottomDeliveryTag: {
        fontSize: 10,
        fontWeight: '700',
        color: EMERALD,
        marginTop: 1,
    },
    checkoutBtn: {
        borderRadius: 16,
        overflow: 'hidden',
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    checkoutBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 22,
        paddingVertical: 14,
    },
    checkoutBtnTxt: {
        color: NAVY,
        fontSize: 15,
        fontWeight: '900',
        letterSpacing: 0.2,
    },

    // Empty Box
    emptyBox: {
        backgroundColor: WHITE,
        borderRadius: 24,
        padding: 32,
        alignItems: 'center',
        marginTop: 20,
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.04,
        shadowRadius: 12,
        elevation: 2,
    },
    emptyIconCircle: {
        marginBottom: 16,
    },
    emptyGradCircle: {
        width: 100,
        height: 100,
        borderRadius: 50,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
        borderColor: GOLD_BORDER,
    },
    emptyTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: -0.3,
        marginBottom: 6,
    },
    emptySub: {
        fontSize: 13,
        color: SLATE,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 24,
        maxWidth: 280,
    },
    emptyBtnStack: {
        width: '100%',
        gap: 10,
    },
    emptyPrimaryBtn: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    emptyPrimaryBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 14,
    },
    emptyPrimaryBtnTxt: {
        color: NAVY,
        fontSize: 14.5,
        fontWeight: '900',
    },
    emptySecondaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 13,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER,
    },
    emptySecondaryBtnTxt: {
        color: NAVY,
        fontSize: 13.5,
        fontWeight: '800',
    },

    // Floating Toast
    toast: {
        position: 'absolute',
        top: Platform.OS === 'android' ? 50 : 60,
        alignSelf: 'center',
        backgroundColor: NAVY,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 20,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 6,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
        zIndex: 999,
    },
    toastTxt: {
        color: WHITE,
        fontSize: 12,
        fontWeight: '800',
    },
});
