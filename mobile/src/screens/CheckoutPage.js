import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator, TextInput, Image, StyleSheet, Platform, StatusBar, Modal, Dimensions, KeyboardAvoidingView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { styles as themeStyles } from '../styles/theme';
import { useAppSettings, useBrandTheme } from '../context/AppSettingsContext';
import FlutterwaveCheckout from '../lib/flutterwave/FlutterwaveCheckout';
import CheckoutAddressCard from '../components/CheckoutAddressCard';
import { CheckoutAddressSkeleton, CheckoutSummarySkeleton } from '../components/CheckoutSkeleton';
import { whatsappService } from '../services/whatsappService';

const { width, height } = Dimensions.get('window');
const CHECKOUT_STORAGE_KEY = '@checkout_progress_v3';

import { parsePrice, formatCurrency } from '../utils/helpers';

export const CheckoutPageInner = ({ navigation, route, onClearCart }) => {
    const { cart = [], total: initialTotalParam = 0 } = route.params || {};

    const initialTotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const price = parsePrice(item.price);
            const qty = parseInt(item.qty || item.quantity || 1) || 1;
            return sum + (price * qty);
        }, 0);
    }, [cart]);

    const { settings } = useAppSettings();
    const { primary, secondary, primaryBg, onPrimary } = useBrandTheme();

    // Wizard State
    const [currentStep, setCurrentStep] = useState(1);

    // Data State
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [addresses, setAddresses] = useState([]);
    const [selectedAddressId, setSelectedAddressId] = useState(null);

    const availableMethods = useMemo(() => {
        return [
            { id: 'Paystack', enabled: settings?.payment_methods?.paystack !== false, name: 'Paystack', sub: 'Cards, Transfer, USSD, Bank', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzFzmpCa0Tav9NttiYF10t9wftJPQ0XYPBkA&s', recommended: true, icon: 'card-outline' },
            { id: 'Flutterwave', enabled: settings?.payment_methods?.flutterwave !== false, name: 'Flutterwave', sub: 'Cards, Bank, Mobile Money', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-W6MLvD_saE20EDSZzVPspKqcKxZ89rW8uw&s', icon: 'flash' },
            { id: 'Coinbase', enabled: settings?.payment_methods?.crypto !== false, name: 'Coinbase Crypto', sub: 'BTC, ETH, USDT, USDC', logo: 'https://media.licdn.com/dms/image/v2/D4E0BAQFBUuEd8VGK4w/company-logo_200_200/B4EZs3tEB3IQAI-/0/1766166118811/coinbase_logo?e=2147483647&v=beta&t=mPgscbzEhR9TBOuI9MM0BDNcbE4tvvbhF38KM3V1CAY', icon: 'logo-bitcoin' },
            { id: 'Wallet', enabled: settings?.payment_methods?.wallet !== false, name: 'My Wallet', sub: `Balance: \u20A6${(profile?.wallet_balance || 0).toLocaleString()}`, icon: 'wallet' }
        ].filter(m => m.enabled);
    }, [settings, profile]);

    // Step 2 State
    const [paymentMethod, setPaymentMethod] = useState('');

    useEffect(() => {
        if (!paymentMethod && availableMethods.length > 0) {
            setPaymentMethod(availableMethods[0].id);
        } else if (paymentMethod && !availableMethods.find(m => m.id === paymentMethod) && availableMethods.length > 0) {
            setPaymentMethod(availableMethods[0].id);
        }
    }, [availableMethods, paymentMethod]);

    // Step 3 State
    const [couponCode, setCouponCode] = useState('');
    const [appliedCoupon, setAppliedCoupon] = useState(null);
    const [validatingCoupon, setValidatingCoupon] = useState(false);
    const [discountAmount, setDiscountAmount] = useState(0);
    const [orderNote, setOrderNote] = useState('');
    const [agreedToTerms, setAgreedToTerms] = useState(false);

    // UI State
    const [isProcessing, setIsProcessing] = useState(false);
    const [orderSuccess, setOrderSuccess] = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentLink, setPaymentLink] = useState('');
    const [currentOrderId, setCurrentOrderId] = useState(null);

    const triggerOrderWhatsApp = (orderId, totalAmount, payMethod) => {
        try {
            const addr = addresses.find(a => a.id === selectedAddressId);
            const customerPhone = addr?.phone || profile?.phone_number || profile?.phone || user?.phone;
            if (!customerPhone) return;

            const formattedId = orderId?.slice(0, 8).toUpperCase() || '';
            const formattedAmount = totalAmount?.toLocaleString() || '';

            const orderMsg = `Your order #${formattedId} has been placed successfully via ${payMethod}. Thank you for shopping with Abu Mafhal!`;
            whatsappService.sendDirect(customerPhone, orderMsg, user?.id).catch(e => console.log('Order WhatsApp Error:', e));

            const receiptMsg = `Payment confirmed for order #${formattedId}. Paid: ₦${formattedAmount} via ${payMethod}. We are processing your request.`;
            whatsappService.sendDirect(customerPhone, receiptMsg, user?.id).catch(e => console.log('Payment receipt WhatsApp Error:', e));
        } catch (err) {
            console.log('Error triggering WhatsApp from checkout:', err);
        }
    };

    // ── Dynamic Shipping Fee ─────────────────────────────────────────────────
    const shippingFee = useMemo(() => {
        const selectedAddr = addresses.find(a => a.id === selectedAddressId);
        // If all items in cart have free_shipping, it's free
        const allFreeShipping = cart.length > 0 && cart.every(item => item.free_shipping === true);
        if (allFreeShipping) return 0;
        // Check admin-set free nationwide shipping
        if (settings?.free_nationwide_shipping) return 0;
        // Per-state lookup from admin settings
        if (selectedAddr?.state && settings?.shipping_fees) {
            const fee = settings.shipping_fees[selectedAddr.state];
            if (fee !== undefined) return fee;
        }
        // Fallback
        return parseFloat(settings?.default_shipping_fee) || 3000;
    }, [selectedAddressId, addresses, cart, settings]);

    // ── Tax Amount ───────────────────────────────────────────────────────────
    const taxAmount = useMemo(() => {
        if (settings?.tax_enabled === false) return 0;
        const rate = parseFloat(settings?.tax_rate) || 7.5;
        return Math.round(initialTotal * (rate / 100));
    }, [initialTotal, settings]);

    const taxRateLabel = (parseFloat(settings?.tax_rate) || 7.5).toFixed(1);
    const isTaxEnabled = settings?.tax_enabled !== false;

    // ── Is shipping waived ───────────────────────────────────────────────────
    const isShippingFree = shippingFee === 0;

    const finalTotal = useMemo(() => {
        return Math.max(0, initialTotal + shippingFee + taxAmount - discountAmount);
    }, [initialTotal, shippingFee, taxAmount, discountAmount]);

    useEffect(() => {
        loadInitialData();
    }, []);

    useEffect(() => {
        saveProgress();
    }, [currentStep, selectedAddressId, paymentMethod, orderNote]);

    const loadInitialData = async () => {
        try {
            setLoading(true);
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (!currentUser) {
                navigation.navigate('Auth');
                return;
            }
            setUser(currentUser);

            const [profileRes, addrRes, savedProgress] = await Promise.all([
                supabase.from('profiles').select('*').eq('id', currentUser.id).single(),
                supabase.from('addresses').select('*').eq('user_id', currentUser.id),
                AsyncStorage.getItem(CHECKOUT_STORAGE_KEY)
            ]);

            if (profileRes.data) setProfile(profileRes.data);
            if (addrRes.data) {
                setAddresses(addrRes.data);
                const defaultAddr = addrRes.data.find(a => a.is_default);
                if (defaultAddr) setSelectedAddressId(defaultAddr.id);
            }

            if (savedProgress) {
                const sp = JSON.parse(savedProgress);
                if (sp.step) setCurrentStep(sp.step);
                if (sp.addressId) setSelectedAddressId(sp.addressId);
                if (sp.paymentMethod) setPaymentMethod(sp.paymentMethod);
                if (sp.note) setOrderNote(sp.note);
            }
        } catch (error) {
            console.error('Error loading data:', error);
        } finally {
            setLoading(false);
        }
    };

    const saveProgress = async () => {
        try {
            const stateToSave = {
                step: currentStep,
                addressId: selectedAddressId,
                paymentMethod,
                note: orderNote
            };
            await AsyncStorage.setItem(CHECKOUT_STORAGE_KEY, JSON.stringify(stateToSave));
        } catch (e) {
            console.error('Error saving progress:', e);
        }
    };

    const clearProgress = async () => {
        await AsyncStorage.removeItem(CHECKOUT_STORAGE_KEY);
    };

    const handleApplyCoupon = async () => {
        if (!couponCode) return;
        setValidatingCoupon(true);
        try {
            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', couponCode.toUpperCase())
                .eq('is_active', true)
                .single();

            if (error || !data) {
                Alert.alert('Invalid Coupon', 'This promo code does not exist or has expired.');
                setDiscountAmount(0);
                setAppliedCoupon(null);
                return;
            }

            let discount = data.discount_type === 'percentage'
                ? (initialTotal * data.discount_value) / 100
                : data.discount_value;

            setDiscountAmount(discount);
            setAppliedCoupon(data);
            Alert.alert('Success', `\u20A6${discount.toLocaleString()} discount applied!`);
        } catch (e) {
            console.log('Coupon Error:', e);
        } finally {
            setValidatingCoupon(false);
        }
    };

    const handleFinalSubmit = async () => {
        if (!agreedToTerms) {
            Alert.alert('Terms & Conditions', 'Please agree to the terms and conditions to proceed.');
            return;
        }

        setIsProcessing(true);
        try {
            // Ensure session is fresh and get token by using getUser() which refreshes if needed
            const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
            const { data: { session } } = await supabase.auth.getSession();

            if (userError || !verifiedUser || !session) {
                Alert.alert('Session Expired', 'Your session has expired or is invalid. Please login again.');
                navigation.navigate('Auth');
                return;
            }

            // Unified Checkout Step: Create Order & Initiate Payment in one call
            const { data, error: invokeError } = await supabase.functions.invoke('initiate-payment', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                },
                body: {
                    items: cart,
                    address_id: selectedAddressId,
                    payment_method: paymentMethod,
                    coupon_code: appliedCoupon?.code || null,
                    order_notes: orderNote
                }
            });

            if (invokeError) throw invokeError;
            if (!data) throw new Error("Checkout failed to initialize");

            const { order_id, checkout_url } = data;
            setCurrentOrderId(order_id);

            // Handle immediate success (Wallet)
            if (checkout_url === 'success') {
                setOrderSuccess(true);
                triggerOrderWhatsApp(order_id, finalTotal, 'Wallet');
                await clearProgress();
                if (onClearCart) onClearCart();
                return;
            }

            // Handle provider-specific initiation (Webview)
            if (!checkout_url) throw new Error("Could not initialize payment. Please try again.");

            setPaymentLink(checkout_url);
            setShowPaymentModal(true);

        } catch (error) {
            let errorMsg = 'Something went wrong. Please try again.';

            if (error.context) {
                try {
                    const text = await error.context.text();
                    try {
                        const body = JSON.parse(text);
                        if (body && body.error) {
                            errorMsg = String(body.error);
                            if (body.details) {
                                const details = typeof body.details === 'string' ? body.details : JSON.stringify(body.details);
                                errorMsg += '\n\n' + details;
                            }
                        } else {
                            errorMsg = String(text).substring(0, 300);
                        }
                    } catch (e) {
                        errorMsg = String(text).substring(0, 300) || error.message;
                    }
                } catch (pe) {
                    errorMsg = error.message;
                }
            } else {
                errorMsg = error.message || 'Network error. Please try again.';
            }

            // Ensure errorMsg is a string and not too long
            const safeMsg = String(errorMsg).substring(0, 500);

            // 1. DISMISS MODAL FIRST to avoid race condition crash
            setIsProcessing(false);

            // 2. WAIT for modal to definitely close before showing Alert
            setTimeout(() => {
                Alert.alert('Checkout Failed', safeMsg);
            }, 500);

        } finally {
            setIsProcessing(false);
        }
    };

    const validateAndNext = () => {
        if (currentStep === 1) {
            if (!selectedAddressId) {
                Alert.alert('Address Required', 'Please select or add a shipping address.');
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            if (!paymentMethod) {
                Alert.alert('Payment Required', 'Please select a payment method.');
                return;
            }
            setCurrentStep(3);
        }
    };

    if (orderSuccess) {
        return (
            <View style={localStyles.successScreen}>
                <View style={localStyles.successIcon}>
                    <Ionicons name="checkmark-circle" size={100} color="#10B981" />
                </View>
                <Text style={localStyles.successTitle}>Order Successful!</Text>
                <Text style={localStyles.successSub}>Your order has been placed and is being processed.</Text>
                <TouchableOpacity
                    style={localStyles.primaryBtn}
                    onPress={() => navigation.navigate('Main', { screen: 'orders' })}
                >
                    <Text style={localStyles.primaryBtnText}>Check Order Status</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Main', { screen: 'home' })}
                    style={{ marginTop: 20 }}
                >
                    <Text style={{ color: '#64748B', fontWeight: '700' }}>Back to Home</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={localStyles.container}>
            <StatusBar barStyle="dark-content" />

            <SafeAreaView style={localStyles.headerSafe}>
                <View style={localStyles.header}>
                    <TouchableOpacity onPress={() => currentStep > 1 ? setCurrentStep(currentStep - 1) : navigation.goBack()} style={localStyles.backBtn}>
                        <Ionicons name={currentStep > 1 ? "arrow-back" : "close"} size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <View style={localStyles.headerTitleContainer}>
                        <Text style={localStyles.headerTitle}>Checkout</Text>
                        <View style={localStyles.secureBadge}>
                            <Ionicons name="lock-closed" size={12} color="#10B981" />
                            <Text style={localStyles.secureText}>SECURE</Text>
                        </View>
                    </View>
                    <View style={{ width: 44 }} />
                </View>

                <View style={localStyles.stepper}>
                    <View style={localStyles.stepperLine}>
                        <View style={[localStyles.stepperProgress, { width: `${((currentStep - 1) / 2) * 100}%` }]} />
                    </View>
                    {[
                        { id: 1, label: 'Shipping', icon: 'location' },
                        { id: 2, label: 'Payment', icon: 'card' },
                        { id: 3, label: 'Confirm', icon: 'checkmark-circle' }
                    ].map((step) => (
                        <View key={step.id} style={localStyles.stepItem}>
                            <View style={[
                                localStyles.stepCircle,
                                currentStep >= step.id && localStyles.stepCircleActive,
                                currentStep > step.id && localStyles.stepCircleDone
                            ]}>
                                {currentStep > step.id ? (
                                    <Ionicons name="checkmark" size={18} color="white" />
                                ) : (
                                    <Ionicons name={step.icon} size={17} color={currentStep >= step.id ? 'white' : '#94A3B8'} />
                                )}
                            </View>
                            <Text style={[
                                localStyles.stepLabel,
                                currentStep >= step.id && localStyles.stepLabelActive
                            ]}>{step.label}</Text>
                        </View>
                    ))}
                </View>
            </SafeAreaView>

            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
                showsVerticalScrollIndicator={false}
            >
                {currentStep === 1 && (
                    <View>
                        <View style={localStyles.sectionHeader}>
                            <View>
                                <Text style={localStyles.sectionTitle}>Shipping</Text>
                                <Text style={localStyles.sectionSub}>Where should we send your order?</Text>
                            </View>
                            <TouchableOpacity onPress={() => navigation.navigate('AddressPage')}>
                                <Text style={localStyles.manageText}>Manage</Text>
                            </TouchableOpacity>
                        </View>

                        {loading ? (
                            <View>
                                <CheckoutAddressSkeleton />
                                <CheckoutAddressSkeleton />
                            </View>
                        ) : addresses.length === 0 ? (
                            <View style={localStyles.emptyAddress}>
                                <View style={localStyles.emptyCircle}>
                                    <Ionicons name="location-outline" size={40} color="#CBD5E1" />
                                </View>
                                <Text style={localStyles.emptyTitle}>No saved addresses found</Text>
                                <Text style={localStyles.emptySub}>Please add a shipping address to continue</Text>
                                <TouchableOpacity
                                    style={localStyles.secondaryBtn}
                                    onPress={() => navigation.navigate('AddressPage')}
                                >
                                    <Text style={localStyles.secondaryBtnText}>Add New Address</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View>
                                {addresses.map(addr => (
                                    <CheckoutAddressCard
                                        key={addr.id}
                                        address={addr}
                                        selected={selectedAddressId === addr.id}
                                        onSelect={() => setSelectedAddressId(addr.id)}
                                    />
                                ))}
                                <TouchableOpacity
                                    style={localStyles.addAnother}
                                    onPress={() => navigation.navigate('AddressPage')}
                                >
                                    <Ionicons name="add-circle" size={24} color="#6366F1" />
                                    <Text style={localStyles.addAnotherText}>Use another address</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        <View style={localStyles.infoCard}>
                            <View style={[localStyles.summaryIconBox, { backgroundColor: '#EEF2FF' }]}>
                                <Ionicons name="time" size={20} color="#6366F1" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={localStyles.infoTitle}>Fast Delivery</Text>
                                <Text style={localStyles.infoSub}>Estimated arrival in 2–4 business days</Text>
                            </View>
                        </View>
                    </View>
                )}

                {currentStep === 2 && (
                    <View>
                        <Text style={localStyles.sectionTitle}>Payment</Text>
                        <Text style={localStyles.sectionSub}>Select your preferred payment method</Text>

                        {availableMethods.map(method => (
                            <TouchableOpacity
                                key={method.id}
                                style={[localStyles.paymentCard, paymentMethod === method.id && localStyles.paymentCardActive]}
                                onPress={() => setPaymentMethod(method.id)}
                            >
                                <View style={localStyles.paymentContent}>
                                    <View style={localStyles.paymentIcon}>
                                        {method.id === 'Wallet' ? (
                                            <Ionicons name="wallet" size={24} color="#6366F1" />
                                        ) : (
                                            <Image
                                                source={{ uri: method.logo }}
                                                style={{ width: 32, height: 32 }}
                                                resizeMode="contain"
                                            />
                                        )}
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 16 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                            <Text style={localStyles.paymentName}>{method.name}</Text>
                                            {method.recommended && (
                                                <View style={localStyles.recBadge}>
                                                    <Text style={localStyles.recText}>Save 5%</Text>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={localStyles.paymentSub}>{method.sub}</Text>
                                    </View>
                                    <View style={[localStyles.radio, paymentMethod === method.id && localStyles.radioActive]}>
                                        {paymentMethod === method.id && <View style={localStyles.radioInner} />}
                                    </View>
                                </View>
                            </TouchableOpacity>
                        ))}

                        <View style={localStyles.secureNotice}>
                            <Ionicons name="shield-checkmark" size={18} color="#6366F1" />
                            <Text style={localStyles.secureNoticeText}>100% Secure Checkout</Text>
                        </View>
                    </View>
                )}

                {currentStep === 3 && (
                    <View>
                        <Text style={localStyles.sectionTitle}>Review & Confirm</Text>
                        <Text style={localStyles.sectionSub}>Final check before secure payment</Text>

                        {/* Delivery Address Summary */}
                        <View style={localStyles.summaryCard}>
                            <View style={localStyles.summaryHeader}>
                                <View style={localStyles.summaryIconBox}>
                                    <Ionicons name="location" size={20} color="#6366F1" />
                                </View>
                                <Text style={localStyles.summaryTitle}>Shipping Address</Text>
                                <TouchableOpacity onPress={() => setCurrentStep(1)}>
                                    <Text style={localStyles.editText}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={localStyles.summaryBody}>
                                {addresses.find(a => a.id === selectedAddressId) ? (
                                    <>
                                        <Text style={localStyles.summaryMainText}>{addresses.find(a => a.id === selectedAddressId).title}</Text>
                                        <Text style={localStyles.summarySubText}>{addresses.find(a => a.id === selectedAddressId).address}</Text>
                                        <Text style={localStyles.summarySubText}>{addresses.find(a => a.id === selectedAddressId).phone}</Text>
                                    </>
                                ) : <Text style={localStyles.summarySubText}>No address selected</Text>}
                            </View>
                        </View>

                        {/* Payment Method Summary */}
                        <View style={localStyles.summaryCard}>
                            <View style={localStyles.summaryHeader}>
                                <View style={localStyles.summaryIconBox}>
                                    <Ionicons name="shield-checkmark" size={20} color="#6366F1" />
                                </View>
                                <Text style={localStyles.summaryTitle}>Payment Method</Text>
                                <TouchableOpacity onPress={() => setCurrentStep(2)}>
                                    <Text style={localStyles.editText}>Edit</Text>
                                </TouchableOpacity>
                            </View>
                            <View style={[localStyles.summaryBody, { flexDirection: 'row', alignItems: 'center' }]}>
                                {(() => {
                                    const method = [
                                        { id: 'Paystack', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzFzmpCa0Tav9NttiYF10t9wftJPQ0XYPBkA&s' },
                                        { id: 'Flutterwave', logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-W6MLvD_saE20EDSZzVPspKqcKxZ89rW8uw&s' },
                                        { id: 'Coinbase', logo: 'https://media.licdn.com/dms/image/v2/D4E0BAQFBUuEd8VGK4w/company-logo_200_200/B4EZs3tEB3IQAI-/0/1766166118811/coinbase_logo?e=2147483647&v=beta&t=mPgscbzEhR9TBOuI9MM0BDNcbE4tvvbhF38KM3V1CAY' },
                                        { id: 'Wallet', icon: 'wallet' }
                                    ].find(m => m.id === paymentMethod);

                                    return (
                                        <>
                                            <View style={[localStyles.summaryIconBox, { backgroundColor: '#F8FAFC', marginRight: 16 }]}>
                                                {method?.icon ? (
                                                    <Ionicons name={method.icon} size={20} color="#0F172A" />
                                                ) : (
                                                    <Image source={{ uri: method?.logo }} style={{ width: 24, height: 24 }} resizeMode="contain" />
                                                )}
                                            </View>
                                            <View>
                                                <Text style={localStyles.summaryMainText}>{paymentMethod}</Text>
                                                <Text style={localStyles.summarySubText}>Secured transaction</Text>
                                            </View>
                                        </>
                                    );
                                })()}
                            </View>
                        </View>

                        {/* Items Preview */}
                        <View style={localStyles.itemsPreviewCard}>
                            <View style={localStyles.itemsPreviewHeader}>
                                <Text style={localStyles.itemsPreviewTitle}>Order Summary</Text>
                                <Text style={localStyles.itemsPreviewTitle}>{cart.length} ITEMS</Text>
                            </View>
                            {cart.slice(0, 3).map((item, idx) => (
                                <View key={idx} style={localStyles.itemTinyRow}>
                                    <Text style={localStyles.itemTinyName} numberOfLines={1}>
                                        {item.qty || item.quantity || 1}x {item.name}
                                    </Text>
                                    <Text style={localStyles.itemTinyPrice}>
                                        {formatCurrency(parsePrice(item.price) * (item.qty || item.quantity || 1))}
                                    </Text>
                                </View>
                            ))}
                            {cart.length > 3 && (
                                <Text style={localStyles.moreItemsText}>+ {cart.length - 3} more items</Text>
                            )}
                        </View>

                        {/* Coupon Section */}
                        {settings?.enable_coupons !== false && (
                            <View style={localStyles.couponOuter}>
                                <Text style={localStyles.labelSmall}>Have a coupon?</Text>
                                <View style={localStyles.couponRow}>
                                    <TextInput
                                        style={localStyles.couponInput}
                                        placeholder="Enter promo code"
                                        value={couponCode}
                                        onChangeText={setCouponCode}
                                        autoCapitalize="characters"
                                        placeholderTextColor="#94A3B8"
                                        editable={!appliedCoupon}
                                    />
                                    <TouchableOpacity
                                        style={[localStyles.couponBtn, appliedCoupon && localStyles.couponBtnApplied]}
                                        onPress={appliedCoupon ? () => { setAppliedCoupon(null); setDiscountAmount(0); setCouponCode(''); } : handleApplyCoupon}
                                        disabled={validatingCoupon}
                                    >
                                        {validatingCoupon ? <ActivityIndicator size="small" color="white" /> : (
                                            <Text style={localStyles.couponBtnText}>{appliedCoupon ? 'Remove' : 'Apply'}</Text>
                                        )}
                                    </TouchableOpacity>
                                </View>
                            </View>
                        )}

                        {/* Notes Section */}
                        <View style={localStyles.noteContainer}>
                            <Text style={localStyles.labelSmall}>Special Instructions</Text>
                            <TextInput
                                style={localStyles.noteInput}
                                placeholder="Add a note to your order (optional)"
                                multiline
                                numberOfLines={4}
                                value={orderNote}
                                onChangeText={setOrderNote}
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        {/* Terms Section */}
                        <TouchableOpacity
                            style={localStyles.termsRow}
                            onPress={() => setAgreedToTerms(!agreedToTerms)}
                            activeOpacity={0.7}
                        >
                            <View style={[localStyles.checkbox, agreedToTerms && localStyles.checkboxActive]}>
                                {agreedToTerms && <Ionicons name="checkmark" size={16} color="white" />}
                            </View>
                            <Text style={localStyles.termsText}>
                                I agree to the <Text style={{ color: '#6366F1', fontWeight: '800' }}>Terms & Conditions</Text>
                            </Text>
                        </TouchableOpacity>

                        {/* Cost Box (The Invoice) */}
                        <View style={localStyles.invoiceCard}>
                            <View style={localStyles.invoiceHeader}>
                                <View style={localStyles.invoiceIconBox}>
                                    <Ionicons name="receipt" size={20} color="#6366F1" />
                                </View>
                                <View>
                                    <Text style={localStyles.invoiceTitle}>Payment Summary</Text>
                                    <Text style={localStyles.invoiceSub}>Detailed breakdown of your order</Text>
                                </View>
                            </View>

                            <View style={localStyles.invoiceTable}>
                                <View style={localStyles.invoiceRow}>
                                    <Text style={localStyles.invoiceLabel}>Items Subtotal</Text>
                                    <Text style={localStyles.invoiceValue}>{formatCurrency(initialTotal)}</Text>
                                </View>
                                <View style={localStyles.invoiceRow}>
                                    <Text style={localStyles.invoiceLabel}>Shipping & Delivery</Text>
                                    {isShippingFree ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={{ backgroundColor: '#DCFCE7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#16A34A' }}>FREE 🎉</Text>
                                            </View>
                                        </View>
                                    ) : (
                                        <Text style={localStyles.invoiceValue}>{formatCurrency(shippingFee)}</Text>
                                    )}
                                </View>
                                {isTaxEnabled && (
                                    <View style={localStyles.invoiceRow}>
                                        <Text style={localStyles.invoiceLabel}>VAT ({taxRateLabel}%)</Text>
                                        <Text style={localStyles.invoiceValue}>{formatCurrency(taxAmount)}</Text>
                                    </View>
                                )}
                                {discountAmount > 0 && (
                                    <View style={localStyles.invoiceRow}>
                                        <Text style={[localStyles.invoiceLabel, { color: '#10B981' }]}>Promotional Discount</Text>
                                        <Text style={[localStyles.invoiceValue, { color: '#10B981' }]}>-{formatCurrency(discountAmount)}</Text>
                                    </View>
                                )}
                            </View>

                            <View style={localStyles.invoiceDivider} />

                            <View style={localStyles.finalTotalRow}>
                                <View>
                                    <Text style={localStyles.finalTotalLabel}>Grand Total</Text>
                                    <Text style={localStyles.finalTotalSub}>All taxes & fees included</Text>
                                </View>
                                <Text style={localStyles.finalTotalValue}>{formatCurrency(finalTotal)}</Text>
                            </View>
                        </View>
                    </View>
                )}
            </ScrollView>

            <View style={localStyles.footerActions}>
                {currentStep > 1 && (
                    <TouchableOpacity
                        style={localStyles.btnSecondary}
                        onPress={() => setCurrentStep(currentStep - 1)}
                    >
                        <Text style={localStyles.btnSecondaryText}>Back</Text>
                    </TouchableOpacity>
                )}
                <TouchableOpacity
                    style={[localStyles.btnPrimary, { flex: 1, backgroundColor: primary, shadowColor: primary }]}
                    onPress={currentStep === 3 ? handleFinalSubmit : validateAndNext}
                    disabled={isProcessing}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <>
                            <Text style={localStyles.btnPrimaryText}>
                                {currentStep === 3 ? 'Confirm & Pay' : 'Continue'}
                            </Text>
                            <Ionicons name="arrow-forward" size={20} color="white" style={{ marginLeft: 8 }} />
                        </>
                    )}
                </TouchableOpacity>
            </View>

            <Modal transparent visible={isProcessing} animationType="fade">
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                    <View style={{ backgroundColor: 'white', padding: 30, borderRadius: 24, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#0F172A" />
                        <Text style={{ marginTop: 20, fontSize: 16, fontWeight: '700', color: '#0F172A' }}>Processing...</Text>
                        <Text style={{ marginTop: 8, fontSize: 13, color: '#64748B' }}>Please do not close this window</Text>
                    </View>
                </View>
            </Modal>

            <FlutterwaveCheckout
                visible={showPaymentModal}
                link={paymentLink}
                onAbort={() => setShowPaymentModal(false)}
                onRedirect={(data) => {
                    setShowPaymentModal(false);
                    if (data.status === 'successful' || data.status === 'completed' || data.status === 'success') {
                        setOrderSuccess(true);
                        triggerOrderWhatsApp(currentOrderId, finalTotal, paymentMethod || 'Online Payment');
                        if (onClearCart) onClearCart();
                    } else {
                        Alert.alert('Payment Incomplete', 'The transaction was not successful or was cancelled.');
                    }
                }}
            />
        </View>
    );
};

export const CheckoutPage = (props) => (
    <CheckoutPageInner {...props} onClearCart={props.onClearCart} />
);

const localStyles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8F9FE' },
    headerSafe: { backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#F1F5F9', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
    header: { height: 70, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16 },
    backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 22, backgroundColor: '#F1F5FE' },
    headerTitleContainer: { alignItems: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    secureBadge: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
    secureText: { fontSize: 10, fontWeight: '900', color: '#6366F1', marginLeft: 6 },
    stepper: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 24, paddingVertical: 20, position: 'relative' },
    stepperLine: { position: 'absolute', top: 36, left: 60, right: 60, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2 },
    stepperProgress: { height: '100%', backgroundColor: '#6366F1', borderRadius: 2 },
    stepItem: { alignItems: 'center', zIndex: 1, width: 70 },
    stepCircle: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 },
    stepCircleActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    stepCircleDone: { backgroundColor: '#10B981', borderColor: '#10B981' },
    stepLabel: { fontSize: 11, fontWeight: '700', color: '#94A3B8', marginTop: 8 },
    stepLabelActive: { color: '#6366F1' },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
    sectionTitle: { fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 8 },
    sectionSub: { fontSize: 14, color: '#64748B', marginBottom: 24, lineHeight: 20 },
    manageText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
    addAnother: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 20, borderStyle: 'dashed', borderWidth: 2, borderColor: '#CBD5E1', marginTop: 12 },
    addAnotherText: { marginLeft: 10, color: '#64748B', fontWeight: '700' },
    infoCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EEF2FF', padding: 18, borderRadius: 20, marginTop: 24 },
    infoTitle: { fontSize: 15, fontWeight: '700', color: '#4F46E5' },
    infoSub: { fontSize: 12, color: '#6366F1', marginTop: 4 },
    paymentCard: { backgroundColor: 'white', borderRadius: 20, padding: 16, marginBottom: 12, borderWidth: 2, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
    paymentCardActive: { borderColor: '#6366F1', backgroundColor: '#F5F7FF' },
    paymentContent: { flexDirection: 'row', alignItems: 'center' },
    paymentIcon: { width: 48, height: 48, borderRadius: 14, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
    paymentName: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    paymentSub: { fontSize: 12, color: '#64748B', marginTop: 4 },
    radio: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    radioActive: { borderColor: '#6366F1' },
    radioInner: { width: 12, height: 12, borderRadius: 6, backgroundColor: '#6366F1' },
    recBadge: { backgroundColor: '#EEF2FF', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginLeft: 8 },
    recText: { fontSize: 10, fontWeight: '800', color: '#6366F1' },
    secureNotice: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24 },
    secureNoticeText: { fontSize: 13, color: '#94A3B8', marginLeft: 10, fontWeight: '600' },
    summaryCard: { backgroundColor: 'white', borderRadius: 24, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#0F172A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.03, shadowRadius: 12, elevation: 3 },
    summaryHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    summaryIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    summaryTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', flex: 1 },
    editText: { color: '#6366F1', fontWeight: '700', fontSize: 14 },
    summaryMainText: { fontSize: 15, fontWeight: '700', color: '#0F172A' },
    summarySubText: { fontSize: 13, color: '#64748B', marginTop: 4, lineHeight: 18 },
    itemsPreviewCard: { backgroundColor: '#F8FAFC', borderRadius: 20, padding: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    itemsPreviewHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
    itemsPreviewTitle: { fontSize: 14, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 1 },
    itemTinyRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
    itemTinyName: { fontSize: 14, fontWeight: '600', color: '#334155', flex: 1, marginRight: 12 },
    itemTinyPrice: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    moreItemsText: { fontSize: 12, color: '#94A3B8', fontWeight: '700', marginTop: 6 },
    couponOuter: { marginBottom: 24 },
    labelSmall: { fontSize: 13, fontWeight: '800', color: '#64748B', marginBottom: 10, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    couponRow: { flexDirection: 'row', gap: 12 },
    couponInput: { flex: 1, height: 56, backgroundColor: 'white', borderRadius: 16, paddingHorizontal: 18, borderWidth: 1.5, borderColor: '#E2E8F0', fontWeight: '700', color: '#0F172A' },
    couponBtn: { width: 100, height: 56, backgroundColor: '#0F172A', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
    couponBtnApplied: { backgroundColor: '#EF4444' },
    couponBtnText: { color: 'white', fontWeight: '800', fontSize: 14 },
    noteContainer: { marginBottom: 24 },
    noteInput: { backgroundColor: 'white', borderRadius: 16, padding: 18, borderWidth: 1.5, borderColor: '#E2E8F0', minHeight: 100, textAlignVertical: 'top', color: '#0F172A', fontSize: 15 },
    termsRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 30 },
    checkbox: { width: 24, height: 24, borderRadius: 8, borderWidth: 2, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', marginRight: 14 },
    checkboxActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
    termsText: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    invoiceCard: { backgroundColor: 'white', borderRadius: 28, padding: 24, marginBottom: 20, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 },
    invoiceHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 24 },
    invoiceIconBox: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F5F7FF', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    invoiceTitle: { fontSize: 16, fontWeight: '800', color: '#0F172A', textTransform: 'uppercase', letterSpacing: 1 },
    invoiceSub: { fontSize: 12, color: '#64748B', marginTop: 2 },
    invoiceTable: { marginTop: 8 },
    invoiceRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
    invoiceLabel: { fontSize: 14, color: '#64748B', fontWeight: '600' },
    invoiceValue: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    invoiceDivider: { height: 1.5, backgroundColor: '#F1F5F9', marginVertical: 20, borderStyle: 'dashed' },
    finalTotalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    finalTotalLabel: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    finalTotalSub: { fontSize: 11, color: '#94A3B8', marginTop: 4 },
    finalTotalValue: { fontSize: 28, fontWeight: '900', color: '#6366F1' },
    footerActions: { backgroundColor: 'white', padding: 20, paddingBottom: Platform.OS === 'ios' ? 40 : 20, flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#F1F5F9', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 20 },
    btnPrimary: { height: 64, borderRadius: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 8, elevation: 4 },
    btnPrimaryText: { color: 'white', fontSize: 16, fontWeight: '800' },
    btnSecondary: { height: 64, paddingHorizontal: 28, backgroundColor: '#F1F5F9', borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
    btnSecondaryText: { color: '#0F172A', fontSize: 16, fontWeight: '800' }
});
