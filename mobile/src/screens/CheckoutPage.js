import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    Alert,
    ActivityIndicator,
    TextInput,
    Image,
    StyleSheet,
    Platform,
    StatusBar,
    Modal,
    Dimensions,
    KeyboardAvoidingView,
    Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAppSettings, useBrandTheme } from '../context/AppSettingsContext';
import FlutterwaveCheckout from '../lib/flutterwave/FlutterwaveCheckout';
import CheckoutAddressCard from '../components/CheckoutAddressCard';
import { CheckoutAddressSkeleton } from '../components/CheckoutSkeleton';
import { whatsappService } from '../services/whatsappService';
import { ShippingCalculationEngine } from '../services/shippingService';
import { NIGERIA_DATA } from '../data/nigeriaData';
import { parsePrice, formatCurrency } from '../utils/helpers';

const { width } = Dimensions.get('window');
const CHECKOUT_STORAGE_KEY = '@checkout_progress_v3';

// ── Abu Mafhal Luxury Design Tokens ──────────────────────────────────────────
const NAVY        = '#0E1A2E';
const NAVY_LIGHT  = '#1E293B';
const GOLD        = '#D9A73A';
const GOLD_LIGHT  = '#FEF9EE';
const GOLD_BORDER = '#F3DE9C';
const EMERALD     = '#10B981';
const DANGER      = '#EF4444';
const SLATE       = '#64748B';
const SLATE_DARK  = '#0F172A';
const BORDER      = '#E2E8F0';
const BG          = '#F8FAFC';
const WHITE       = '#FFFFFF';

const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop';

const getItemImage = (item) => {
    if (!item) return FALLBACK_IMAGE;
    if (Array.isArray(item.images) && item.images[0]) return item.images[0];
    if (typeof item.images === 'string' && item.images.startsWith('http')) return item.images;
    if (item.image_url && item.image_url.startsWith('http')) return item.image_url;
    if (item.image && item.image.startsWith('http')) return item.image;
    if (item.thumbnail && item.thumbnail.startsWith('http')) return item.thumbnail;
    return FALLBACK_IMAGE;
};

export const CheckoutPageInner = ({ navigation, route, onClearCart, cartLines: propCartLines }) => {
    const routeCart = route?.params?.cart;
    const routeTotal = route?.params?.total;
    const routeAddress = route?.params?.selectedAddress;

    // Helper to get stored cart synchronously on mount/refresh
    const getInitialCart = () => {
        if (Array.isArray(routeCart) && routeCart.length > 0) return routeCart;
        if (Array.isArray(propCartLines) && propCartLines.length > 0) return propCartLines;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const raw = window.localStorage.getItem('@abumafhal_cart_v1');
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                }
            }
        } catch (_) {}
        return [];
    };

    const [cart, setCart] = useState(getInitialCart);

    // Dynamic cart synchronizer to prevent losing products on refresh or navigation
    useEffect(() => {
        if (cart.length === 0) {
            if (Array.isArray(propCartLines) && propCartLines.length > 0) {
                setCart(propCartLines);
                return;
            }
            AsyncStorage.getItem('@abumafhal_cart_v1').then(raw => {
                if (raw) {
                    try {
                        const parsed = JSON.parse(raw);
                        if (Array.isArray(parsed) && parsed.length > 0) setCart(parsed);
                    } catch (_) {}
                }
            }).catch(() => {});
        }
    }, [propCartLines]);

    useEffect(() => {
        if (Array.isArray(routeCart) && routeCart.length > 0) {
            setCart(routeCart);
        }
    }, [routeCart]);

    const initialTotal = useMemo(() => {
        return cart.reduce((sum, item) => {
            const price = parsePrice(item.price);
            const qty = parseInt(item.qty || item.quantity || 1, 10) || 1;
            return sum + (price * qty);
        }, 0);
    }, [cart]);

    const { settings } = useAppSettings();
    const { primary = NAVY, secondary = GOLD } = useBrandTheme();

    // Wizard Step: 1 = Shipping, 2 = Payment, 3 = Review & Confirm
    const [currentStep, setCurrentStep] = useState(1);

    // Reliable Back to Shop / Cart Navigation
    const handleBackToShop = useCallback(() => {
        try {
            if (navigation?.canGoBack && navigation.canGoBack()) {
                navigation.goBack();
                return;
            }
        } catch (_) {}
        if (navigation?.navigate) {
            navigation.navigate('Main', { screen: 'shop' });
        }
    }, [navigation]);

    const handleHeaderBack = useCallback(() => {
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        } else {
            handleBackToShop();
        }
    }, [currentStep, handleBackToShop]);

    // Data State (Immediately pre-populated if address passed or stored)
    const getInitialAddresses = () => {
        if (routeAddress) return [routeAddress];
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const storedUser = window.localStorage.getItem('@abumafhal_user_v1');
                const uId = storedUser ? JSON.parse(storedUser)?.id : null;
                if (uId) {
                    const localRaw = window.localStorage.getItem(`@user_addresses_${uId}`);
                    if (localRaw) {
                        const parsed = JSON.parse(localRaw);
                        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
                    }
                }
                const cachedLast = window.localStorage.getItem('@abumafhal_last_selected_address');
                if (cachedLast) {
                    const parsedLast = JSON.parse(cachedLast);
                    if (parsedLast && parsedLast.address) return [parsedLast];
                }
            }
        } catch (_) {}
        return [];
    };

    const initialAddrs = getInitialAddresses();
    const [loading, setLoading]                 = useState(!routeAddress && initialAddrs.length === 0);
    const [user, setUser]                       = useState(null);
    const [profile, setProfile]                 = useState(null);
    const [addresses, setAddresses]             = useState(initialAddrs);
    const [selectedAddressId, setSelectedAddressId] = useState(
        routeAddress?.id || (initialAddrs.find(a => a.is_default)?.id || initialAddrs[0]?.id || 'lga_dest')
    );

    // Step 1: LGA & Destination States
    const [quickDestination, setQuickDestination] = useState({
        state: 'Yobe',
        city: 'Bade',
        lga: 'Bade',
        address: 'Bade / Gashua, Yobe State'
    });
    const [lgaModalVisible, setLgaModalVisible]           = useState(false);
    const [lgaSearchQuery, setLgaSearchQuery]             = useState('');
    const [activeLgaStateFilter, setActiveLgaStateFilter] = useState('Yobe');

    // Step 2: Payment Gateways
    const [paymentMethod, setPaymentMethod] = useState('Paystack');
    const [pssPlan, setPssPlan]             = useState('3_months'); // '3_months' | '4_biweekly'

    // Step 3: Review & Options
    const [couponCode, setCouponCode]           = useState('');
    const [appliedCoupon, setAppliedCoupon]     = useState(null);
    const [validatingCoupon, setValidatingCoupon] = useState(false);
    const [discountAmount, setDiscountAmount]   = useState(0);
    const [orderNote, setOrderNote]             = useState('');
    const [agreedToTerms, setAgreedToTerms]     = useState(false);
    const [showItemsAccordion, setShowItemsAccordion] = useState(true);

    // UI & Action States
    const [isProcessing, setIsProcessing]         = useState(false);
    const [orderSuccess, setOrderSuccess]         = useState(false);
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [paymentLink, setPaymentLink]           = useState('');
    const [currentOrderId, setCurrentOrderId]     = useState(null);

    // Floating Toast Notification
    const [toastMessage, setToastMessage] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;

    const showToast = useCallback((msg) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 150, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(toastAnim, { toValue: 0, duration: 150, useNativeDriver: true })
        ]).start();
    }, [toastAnim]);

    // Available Payment Gateways
    const availableMethods = useMemo(() => {
        const walletBalance = Number(profile?.wallet_balance || 0);
        return [
            {
                id: 'Paystack',
                enabled: settings?.payment_methods?.paystack !== false,
                name: 'Paystack',
                sub: 'Cards, Bank Transfer & USSD',
                logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzFzmpCa0Tav9NttiYF10t9wftJPQ0XYPBkA&s',
                badge: 'Cards & Transfer',
                icon: 'card-outline'
            },
            {
                id: 'Flutterwave',
                enabled: settings?.payment_methods?.flutterwave !== false,
                name: 'Flutterwave',
                sub: 'Cards & Mobile Money',
                logo: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-W6MLvD_saE20EDSZzVPspKqcKxZ89rW8uw&s',
                badge: 'Mobile Money',
                icon: 'flash-outline'
            },
            {
                id: 'Wallet',
                enabled: settings?.payment_methods?.wallet !== false,
                name: 'Abu Mafhal Wallet',
                sub: `Balance: ₦${walletBalance.toLocaleString()}`,
                badge: walletBalance > 0 ? 'Instant Debit' : 'Top-up needed',
                icon: 'wallet-outline',
                balance: walletBalance
            },
            {
                id: 'pay_small_small',
                enabled: settings?.payment_methods?.pay_small_small !== false,
                name: 'Pay Small Small (BNPL)',
                sub: 'Pay 25% or 33% today, split the rest',
                badge: 'Flexible BNPL',
                icon: 'calendar-outline',
                accentColor: GOLD
            },
            {
                id: 'pod',
                enabled: settings?.payment_methods?.pod !== false,
                name: 'Pay on Delivery (POD)',
                sub: 'Cash or POS card upon arrival',
                badge: 'Cash / POS',
                icon: 'cash-outline',
                accentColor: '#F97316'
            },
            {
                id: 'Coinbase',
                enabled: settings?.payment_methods?.crypto !== false,
                name: 'Coinbase Crypto',
                sub: 'BTC, ETH, USDT & USDC',
                logo: 'https://media.licdn.com/dms/image/v2/D4E0BAQFBUuEd8VGK4w/company-logo_200_200/B4EZs3tEB3IQAI-/0/1766166118811/coinbase_logo?e=2147483647&v=beta&t=mPgscbzEhR9TBOuI9MM0BDNcbE4tvvbhF38KM3V1CAY',
                badge: 'Web3',
                icon: 'logo-bitcoin'
            }
        ].filter(m => m.enabled);
    }, [settings, profile]);

    useEffect(() => {
        if (!paymentMethod && availableMethods.length > 0) {
            setPaymentMethod(availableMethods[0].id);
        } else if (paymentMethod && !availableMethods.find(m => m.id === paymentMethod) && availableMethods.length > 0) {
            setPaymentMethod(availableMethods[0].id);
        }
    }, [availableMethods, paymentMethod]);

    // ── Delivery Methods & Instant Distance Engine ──────────────────────────
    const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState('standard');
    const [deliveryMethods, setDeliveryMethods] = useState([
        { code: 'standard', name: 'Standard Delivery', estimated_days: '2-4 Business Days', icon: 'bicycle-outline' },
        { code: 'express',  name: 'Express Priority',  estimated_days: '24-48 Hours',       icon: 'flash-outline' },
        { code: 'pickup',   name: 'Store Pickup',      estimated_days: 'Ready in 2 Hours',   icon: 'storefront-outline' }
    ]);

    // Resolve active customer address with resilient cascade (never null)
    const selectedAddrObj = useMemo(() => {
        const found = addresses.find(a => a.id === selectedAddressId);
        if (found) return found;
        if (routeAddress) return routeAddress;
        if (addresses.length > 0) return addresses[0];
        return {
            id: 'lga_dest',
            title: `${quickDestination.lga || 'Bade'} Delivery`,
            address: quickDestination.address || `${quickDestination.lga || 'Bade'}, ${quickDestination.state || 'Yobe'}`,
            city: quickDestination.city || quickDestination.lga || 'Bade',
            lga: quickDestination.lga || quickDestination.city || 'Bade',
            state: quickDestination.state || 'Yobe',
            phone: profile?.phone || user?.phone || ''
        };
    }, [addresses, selectedAddressId, routeAddress, quickDestination, profile, user]);

    // Instant Synchronous Shipping Calculation (0ms latency, zero delay)
    const shippingCalculation = useMemo(() => {
        const selectedAddr = selectedAddrObj;
        if (!selectedAddr || !cart.length) return null;

        return ShippingCalculationEngine.calculateMultiVendorShippingInstant({
            cartItems: cart,
            customerAddress: selectedAddr,
            deliveryMethodCode: selectedDeliveryMethod || 'standard',
            adminSettings: settings?.shipping_settings || settings,
            shippingMethods: deliveryMethods
        });
    }, [selectedAddrObj, selectedDeliveryMethod, cart, settings, deliveryMethods]);

    // Dynamic Shipping Fee (Instantly computed with zero delay)
    const shippingFee = useMemo(() => {
        if (selectedDeliveryMethod === 'pickup') return 0;
        if (shippingCalculation && typeof shippingCalculation.totalShippingFee === 'number') {
            return shippingCalculation.totalShippingFee;
        }
        const selectedAddr = selectedAddrObj;
        const allFreeShipping = cart.length > 0 && cart.every(item => item.free_shipping === true);
        if (allFreeShipping) return 0;
        if (selectedAddr?.state && settings?.shipping_fees?.[selectedAddr.state] !== undefined) {
            return Number(settings.shipping_fees[selectedAddr.state]);
        }
        return parseFloat(settings?.default_shipping_fee) || 1000;
    }, [shippingCalculation, selectedDeliveryMethod, selectedAddrObj, cart, settings]);

    // Tax calculation
    const taxAmount = useMemo(() => {
        if (settings?.tax_enabled === false) return 0;
        const rate = parseFloat(settings?.tax_rate) || 7.5;
        return Math.round(initialTotal * (rate / 100));
    }, [initialTotal, settings]);

    const taxRateLabel = (parseFloat(settings?.tax_rate) || 7.5).toFixed(1);
    const isTaxEnabled = settings?.tax_enabled !== false;
    const isShippingFree = selectedDeliveryMethod === 'pickup' || (shippingFee === 0 && cart.length > 0 && cart.every(item => item.free_shipping === true));

    // ── Local Government Area (LGA) Quick Selector Helpers ────────────────────
    const quickStates = ['Yobe', 'Jigawa', 'Borno', 'Kano', 'Bauchi', 'Gombe', 'Kaduna', 'Abuja', 'Lagos', 'All States'];

    const filteredLgaList = useMemo(() => {
        const query = (lgaSearchQuery || '').trim().toLowerCase();
        const stateFilter = activeLgaStateFilter;

        let results = [];

        NIGERIA_DATA.forEach(stateObj => {
            const matchesStateFilter = stateFilter === 'All States' || 
                stateObj.state.toLowerCase().includes(stateFilter.toLowerCase()) || 
                stateFilter.toLowerCase().includes(stateObj.state.toLowerCase());

            if (!matchesStateFilter) return;

            stateObj.lgas.forEach(lgaName => {
                if (query) {
                    const matchesLga = lgaName.toLowerCase().includes(query);
                    const matchesState = stateObj.state.toLowerCase().includes(query);
                    if (!matchesLga && !matchesState) return;
                }

                const tierInfo = ShippingCalculationEngine.resolveLgaTier(stateObj.state, lgaName, 'Yobe', 'Bade');
                results.push({
                    state: stateObj.state,
                    lga: lgaName,
                    tierBadge: tierInfo.tier === 'intra_lga' ? 'Local (Bade)' : tierInfo.tier === 'yobe_north' ? 'Yobe North' : tierInfo.tier === 'yobe_regional' ? 'Yobe Regional' : null,
                    standardFee: tierInfo.baseFee,
                    estimatedDays: tierInfo.estimatedDelivery
                });
            });
        });

        // Ensure Bade & Gashua appear first for Yobe
        if (stateFilter === 'Yobe' || !query) {
            results.sort((a, b) => {
                const aName = a.lga.toLowerCase();
                const bName = b.lga.toLowerCase();
                if (aName === 'bade' || aName === 'gashua') return -1;
                if (bName === 'bade' || bName === 'gashua') return 1;
                return 0;
            });
        }

        return results;
    }, [lgaSearchQuery, activeLgaStateFilter]);

    const handleSelectLga = (stateName, lgaName) => {
        setQuickDestination({
            state: stateName,
            city: lgaName,
            lga: lgaName,
            address: `${lgaName} LGA, ${stateName} State`
        });
        setSelectedAddressId('lga_dest');
        setLgaModalVisible(false);
        showToast(`Delivery location set to ${lgaName} LGA, ${stateName}`);
    };

    const finalTotal = useMemo(() => {
        return Math.max(0, initialTotal + shippingFee + taxAmount - discountAmount);
    }, [initialTotal, shippingFee, taxAmount, discountAmount]);

    // Check if wallet balance is sufficient
    const walletBalance = Number(profile?.wallet_balance || 0);
    const isWalletInsufficient = paymentMethod === 'Wallet' && walletBalance < finalTotal;

    // Load initial data
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

            const [profileRes, addrRes, savedProgress, methodsRes] = await Promise.allSettled([
                supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle(),
                supabase.from('addresses').select('*').eq('user_id', currentUser.id),
                AsyncStorage.getItem(CHECKOUT_STORAGE_KEY),
                supabase.from('shipping_methods').select('*').eq('is_active', true).order('sort_order', { ascending: true })
            ]);

            if (profileRes.status === 'fulfilled' && profileRes.value?.data) setProfile(profileRes.value.data);
            let loadedAddresses = [];
            if (addrRes.status === 'fulfilled' && addrRes.value?.data && addrRes.value.data.length > 0) {
                loadedAddresses = addrRes.value.data;
            } else {
                try {
                    const localRaw = await AsyncStorage.getItem(`@user_addresses_${currentUser.id}`);
                    if (localRaw) {
                        const parsed = JSON.parse(localRaw);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            loadedAddresses = parsed;
                        }
                    }
                } catch (e) {
                    console.log('Local address load error in checkout:', e);
                }
            }

            // Fallback to profile address if user has saved one in profile
            if (loadedAddresses.length === 0 && profileRes.status === 'fulfilled' && profileRes.value?.data?.address) {
                const prof = profileRes.value.data;
                loadedAddresses = [{
                    id: 'profile_default_addr',
                    title: 'Default Address',
                    address: prof.address,
                    city: prof.city || prof.lga || '',
                    lga: prof.lga || prof.city || '',
                    state: prof.state || '',
                    phone: prof.phone || prof.phone_number || '',
                    is_default: true
                }];
            }

            if (loadedAddresses.length > 0) {
                setAddresses(loadedAddresses);
                const defaultAddr = loadedAddresses.find(a => a.is_default) || loadedAddresses[0];
                if (defaultAddr && (!selectedAddressId || !loadedAddresses.some(a => a.id === selectedAddressId))) {
                    setSelectedAddressId(defaultAddr.id);
                }
            }
            if (methodsRes.status === 'fulfilled' && methodsRes.value?.data?.length > 0) {
                setDeliveryMethods(methodsRes.value.data);
            }

            if (savedProgress.status === 'fulfilled' && savedProgress.value) {
                const sp = JSON.parse(savedProgress.value);
                if (sp.step) setCurrentStep(sp.step);
                if (sp.addressId && loadedAddresses.some(a => a.id === sp.addressId)) setSelectedAddressId(sp.addressId);
                if (sp.paymentMethod) setPaymentMethod(sp.paymentMethod);
                if (sp.note) setOrderNote(sp.note);
            }
        } catch (error) {
            console.error('Error loading checkout data:', error);
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

    const triggerOrderWhatsApp = (orderId, totalAmount, payMethod) => {
        try {
            const addr = addresses.find(a => a.id === selectedAddressId);
            const customerPhone = addr?.phone || profile?.phone_number || profile?.phone || user?.phone;
            if (!customerPhone) return;

            const formattedId = orderId?.slice(0, 8).toUpperCase() || '';
            const formattedAmount = Number(totalAmount || 0).toLocaleString();

            const orderMsg = `Your order #${formattedId} has been placed successfully via ${payMethod}. Thank you for shopping with Abu Mafhal!`;
            whatsappService.sendDirect(customerPhone, orderMsg, user?.id).catch(e => console.log('Order WhatsApp Error:', e));

            const receiptMsg = `Payment confirmed for order #${formattedId}. Paid: ₦${formattedAmount} via ${payMethod}. We are dispatching your items.`;
            whatsappService.sendDirect(customerPhone, receiptMsg, user?.id).catch(e => console.log('Payment receipt WhatsApp Error:', e));
        } catch (err) {
            console.log('Error triggering WhatsApp from checkout:', err);
        }
    };

    const handleApplyCoupon = async () => {
        const code = couponCode.trim().toUpperCase();
        if (!code) return;
        setValidatingCoupon(true);
        try {
            const { data, error } = await supabase
                .from('coupons')
                .select('*')
                .eq('code', code)
                .eq('is_active', true)
                .maybeSingle();

            if (error || !data) {
                // Fallback test coupons
                if (code === 'WELCOME10') {
                    const discount = Math.round((initialTotal * 10) / 100);
                    setDiscountAmount(discount);
                    setAppliedCoupon({ code: 'WELCOME10', discount_type: 'percentage', discount_value: 10 });
                    showToast('✓ 10% Welcome discount applied!');
                    return;
                }
                Alert.alert('Invalid Coupon', `Voucher "${code}" is invalid or expired.`);
                setDiscountAmount(0);
                setAppliedCoupon(null);
                return;
            }

            if (data.min_order_amount && initialTotal < Number(data.min_order_amount)) {
                Alert.alert('Minimum Order Required', `This coupon requires a minimum subtotal of ₦${Number(data.min_order_amount).toLocaleString()}.`);
                return;
            }

            let discount = data.discount_type === 'percentage'
                ? Math.round((initialTotal * Number(data.discount_value)) / 100)
                : Number(data.discount_value);

            if (data.max_discount && discount > Number(data.max_discount)) {
                discount = Number(data.max_discount);
            }

            setDiscountAmount(discount);
            setAppliedCoupon(data);
            showToast(`✓ ₦${discount.toLocaleString()} discount applied!`);
        } catch (e) {
            console.log('Coupon Error:', e);
            Alert.alert('Coupon Error', 'Could not validate voucher code.');
        } finally {
            setValidatingCoupon(false);
        }
    };

    const handleRemoveCoupon = () => {
        setAppliedCoupon(null);
        setDiscountAmount(0);
        setCouponCode('');
        showToast('Voucher removed');
    };

    const handleFinalSubmit = async () => {
        if (!agreedToTerms) {
            Alert.alert('Terms & Conditions', 'Please check the box to agree to terms & conditions before completing payment.');
            return;
        }

        if (isWalletInsufficient) {
            Alert.alert(
                'Insufficient Wallet Balance',
                `Your wallet balance (₦${walletBalance.toLocaleString()}) is less than the order total (₦${finalTotal.toLocaleString()}). Please choose another payment method or top up your wallet.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Pay with Paystack', onPress: () => setPaymentMethod('Paystack') }
                ]
            );
            return;
        }

        setIsProcessing(true);
        try {
            const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
            const { data: { session } } = await supabase.auth.getSession();

            if (userError || !verifiedUser || !session) {
                Alert.alert('Session Expired', 'Please sign in again to continue checkout.');
                navigation.navigate('Auth');
                return;
            }

            // Call Edge Function 'initiate-payment'
            const { data, error: invokeError } = await supabase.functions.invoke('initiate-payment', {
                headers: {
                    Authorization: `Bearer ${session.access_token}`
                },
                body: {
                    items: cart,
                    address_id: selectedAddressId,
                    shipping_override: addresses.find(a => a.id === selectedAddressId) || null,
                    payment_method: paymentMethod,
                    installment_plan: paymentMethod === 'pay_small_small' ? pssPlan : null,
                    coupon_code: appliedCoupon?.code || null,
                    order_notes: orderNote,
                    delivery_method: selectedDeliveryMethod || 'standard',
                    shipping_fee: shippingFee,
                    shipping_snapshot: shippingCalculation?.snapshot || null
                }
            });

            if (invokeError) throw invokeError;
            if (!data) throw new Error("Checkout failed to initialize");

            const { order_id, checkout_url } = data;
            setCurrentOrderId(order_id);

            // Instant success (Wallet, Pay on Delivery, or Pay Small Small)
            if (checkout_url === 'success') {
                // If BNPL, cache initial plan locally for zero-latency in PaySmallSmallPage
                if (paymentMethod === 'pay_small_small') {
                    try {
                        const count = pssPlan === '4_biweekly' ? 4 : 3;
                        const down = Math.round(finalTotal / count);
                        const now = new Date();
                        const schedule = [];
                        schedule.push({
                            installment_number: 1,
                            amount: down,
                            due_date: now.toISOString(),
                            status: 'paid',
                            paid_at: now.toISOString()
                        });
                        for (let i = 2; i <= count; i++) {
                            const daysToAdd = pssPlan === '4_biweekly' ? (i - 1) * 14 : (i - 1) * 30;
                            const d = new Date(now.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
                            const instAmt = (i === count) ? (finalTotal - (down * (count - 1))) : down;
                            schedule.push({
                                installment_number: i,
                                amount: instAmt,
                                due_date: d.toISOString(),
                                status: 'pending',
                                paid_at: null
                            });
                        }
                        const newPlanItem = {
                            id: order_id,
                            orderNumber: order_id.slice(0, 8).toUpperCase(),
                            createdAt: now.toISOString(),
                            totalAmount: finalTotal,
                            paidAmount: down,
                            remainingAmount: finalTotal - down,
                            planType: pssPlan,
                            installmentsCount: count,
                            installmentsPaid: 1,
                            isCompleted: false,
                            schedule,
                            items: cart
                        };
                        const pssCacheKey = `@abumafhal_pss_plans_${verifiedUser.id}`;
                        const rawExisting = await AsyncStorage.getItem(pssCacheKey);
                        const existingList = rawExisting ? JSON.parse(rawExisting) : [];
                        await AsyncStorage.setItem(pssCacheKey, JSON.stringify([newPlanItem, ...existingList]));
                    } catch (e) {
                        console.log('Error caching PSS plan locally:', e);
                    }
                }

                setOrderSuccess(true);
                const payMethodLabel = paymentMethod === 'pay_small_small'
                    ? 'Pay Small Small (BNPL)'
                    : paymentMethod === 'pod'
                    ? 'Pay on Delivery (Cash/POS)'
                    : 'Wallet';
                triggerOrderWhatsApp(order_id, finalTotal, payMethodLabel);
                await clearProgress();
                if (onClearCart) onClearCart();
                return;
            }

            if (!checkout_url) throw new Error("Could not initialize payment gateway.");

            setPaymentLink(checkout_url);
            setShowPaymentModal(true);

        } catch (error) {
            let errorMsg = 'Something went wrong. Please try again.';
            if (error.context) {
                try {
                    const text = await error.context.text();
                    const body = JSON.parse(text);
                    if (body && body.error) errorMsg = String(body.error);
                } catch (e) {
                    errorMsg = error.message;
                }
            } else {
                errorMsg = error.message || 'Network error. Please try again.';
            }

            setIsProcessing(false);
            setTimeout(() => {
                Alert.alert('Checkout Failed', String(errorMsg).substring(0, 300));
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

    // ── SUCCESS SCREEN ────────────────────────────────────────────────────────
    if (orderSuccess) {
        return (
            <SafeAreaView style={s.successSafe}>
                <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
                <View style={s.successContainer}>
                    <View style={s.successIconBox}>
                        <Ionicons name="checkmark-circle" size={54} color={EMERALD} />
                    </View>
                    <Text style={s.successTitle}>Order Placed Successfully!</Text>
                    <Text style={s.successSub}>
                        Your order is confirmed and is now being packaged for dispatch.
                    </Text>

                    {currentOrderId && (
                        <View style={s.orderIdPill}>
                            <Text style={s.orderIdTxt}>ORDER #{currentOrderId.slice(0, 8).toUpperCase()}</Text>
                        </View>
                    )}

                    <View style={s.whatsAppBanner}>
                        <Ionicons name="logo-whatsapp" size={16} color="#15803D" />
                        <Text style={s.whatsAppBannerTxt}>
                            Receipt & live updates sent to your WhatsApp
                        </Text>
                    </View>

                    {/* Custom Notice for Pay Small Small or POD */}
                    {paymentMethod === 'pay_small_small' && (
                        <View style={s.successPssNotice}>
                            <Ionicons name="calendar-outline" size={16} color={GOLD} />
                            <Text style={s.successPssNoticeTxt}>
                                Down payment of {formatCurrency(pssPlan === '4_biweekly' ? Math.round(finalTotal / 4) : Math.round(finalTotal / 3))} recorded. You can manage remaining installments in Pay Small Small.
                            </Text>
                        </View>
                    )}

                    {paymentMethod === 'pod' && (
                        <View style={s.successPodNotice}>
                            <Ionicons name="cash-outline" size={16} color="#EA580C" />
                            <Text style={s.successPodNoticeTxt}>
                                Please have {formatCurrency(finalTotal)} in cash or POS card ready when our verified rider delivers your package.
                            </Text>
                        </View>
                    )}

                    <View style={s.successActionGroup}>
                        {paymentMethod === 'pay_small_small' && (
                            <TouchableOpacity
                                style={s.successPssBtn}
                                onPress={() => navigation.navigate('PaySmallSmall')}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="calendar-outline" size={16} color={NAVY} />
                                <Text style={s.successPssBtnTxt}>View BNPL Installment Ledger</Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={s.successPrimaryBtn}
                            onPress={() => navigation.navigate('Main', { screen: 'orders' })}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="receipt-outline" size={16} color={WHITE} />
                            <Text style={s.successPrimaryBtnTxt}>View My Orders</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => navigation.navigate('Main', { screen: 'home' })}
                            style={s.successSecondaryBtn}
                            activeOpacity={0.7}
                        >
                            <Text style={s.successSecondaryBtnTxt}>Return to Marketplace</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </SafeAreaView>
        );
    }

    // ── EMPTY BASKET STATE (Zero products or cleared basket) ──────────────────
    if (!loading && cart.length === 0) {
        return (
            <SafeAreaView style={s.successSafe}>
                <StatusBar barStyle="dark-content" backgroundColor={WHITE} />
                <View style={s.topBar}>
                    <TouchableOpacity
                        onPress={handleBackToShop}
                        style={s.backBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="chevron-back" size={20} color={NAVY} />
                    </TouchableOpacity>
                    <Text style={s.headerTitle}>Checkout</Text>
                    <View style={{ width: 36 }} />
                </View>

                <View style={s.emptyBasketWrapper}>
                    <View style={s.emptyBasketIconCircle}>
                        <Ionicons name="basket-outline" size={44} color={GOLD} />
                    </View>
                    <Text style={s.emptyBasketTitle}>Your Shopping Basket is Empty</Text>
                    <Text style={s.emptyBasketSub}>
                        You do not have any items in this checkout session. Please add items to your cart to proceed with order dispatch.
                    </Text>
                    <TouchableOpacity
                        style={s.emptyReturnBtn}
                        onPress={handleBackToShop}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="bag-handle-outline" size={16} color={WHITE} />
                        <Text style={s.emptyReturnBtnTxt}>Return to Shop</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <View style={s.container}>
            <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

            {/* ── COMPACT HEADER ────────────────────────────────────────────── */}
            <SafeAreaView style={s.headerSafe}>
                <View style={s.header}>
                    <TouchableOpacity
                        onPress={handleHeaderBack}
                        style={s.backBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        activeOpacity={0.7}
                    >
                        <Ionicons name={currentStep > 1 ? "arrow-back" : "chevron-back"} size={19} color={NAVY} />
                    </TouchableOpacity>

                    <View style={s.headerCenter}>
                        <Text style={s.headerTitle}>Checkout</Text>
                        <View style={s.secureBadge}>
                            <Ionicons name="shield-checkmark" size={10} color={EMERALD} />
                            <Text style={s.secureBadgeTxt}>ESCROW PROTECTED</Text>
                        </View>
                    </View>

                    {/* Step Counter Indicator */}
                    <View style={s.stepCounterPill}>
                        <Text style={s.stepCounterTxt}>{currentStep}/3</Text>
                    </View>
                </View>

                {/* ── COMPACT STEPPER BAR ────────────────────────────────────── */}
                <View style={s.stepperRow}>
                    {[
                        { id: 1, label: 'Shipping', icon: 'location' },
                        { id: 2, label: 'Payment',  icon: 'card' },
                        { id: 3, label: 'Review',   icon: 'checkmark-circle' }
                    ].map((step, idx) => {
                        const isActive = currentStep === step.id;
                        const isDone   = currentStep > step.id;
                        return (
                            <TouchableOpacity
                                key={step.id}
                                onPress={() => isDone && setCurrentStep(step.id)}
                                activeOpacity={isDone ? 0.7 : 1}
                                style={s.stepTab}
                            >
                                <View style={[
                                    s.stepCircle,
                                    isActive && s.stepCircleActive,
                                    isDone && s.stepCircleDone
                                ]}>
                                    {isDone ? (
                                        <Ionicons name="checkmark" size={11} color={WHITE} />
                                    ) : (
                                        <Ionicons
                                            name={step.icon}
                                            size={11}
                                            color={isActive ? WHITE : SLATE}
                                        />
                                    )}
                                </View>
                                <Text style={[
                                    s.stepLabel,
                                    isActive && s.stepLabelActive,
                                    isDone && s.stepLabelDone
                                ]}>
                                    {step.label}
                                </Text>
                                {idx < 2 && (
                                    <View style={[
                                        s.stepLine,
                                        isDone && s.stepLineDone
                                    ]} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </SafeAreaView>

            {/* ── MAIN SCROLLABLE CONTENT ───────────────────────────────────── */}
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={s.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {/* ══════════════════════════════════════════════════════════════
                    STEP 1: SHIPPING & DELIVERY
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 1 && (
                    <View>
                        {/* Section Header */}
                        <View style={s.sectionHeader}>
                            <View>
                                <Text style={s.sectionTitle}>Delivery Destination</Text>
                                <Text style={s.sectionSub}>Select your LGA & address for structured live pricing</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('AddressPage')}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                            >
                                <Text style={s.manageLink}>+ Manage Addresses</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Active LGA & Fulfillment Zone Card ── */}
                        <View style={s.lgaSelectCard}>
                            <View style={s.lgaSelectHeader}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="map" size={14} color={GOLD} />
                                    <Text style={s.lgaSelectTitle}>Local Government Area (LGA)</Text>
                                </View>
                                <TouchableOpacity 
                                    style={s.changeLgaBtn}
                                    onPress={() => setLgaModalVisible(true)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="swap-horizontal" size={13} color={GOLD} />
                                    <Text style={s.changeLgaBtnTxt}>Change LGA / State</Text>
                                </TouchableOpacity>
                            </View>

                            <TouchableOpacity 
                                style={s.lgaActiveRow}
                                onPress={() => setLgaModalVisible(true)}
                                activeOpacity={0.85}
                            >
                                <View style={s.lgaPinCircle}>
                                    <Ionicons name="location" size={17} color={NAVY} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                        <Text style={s.lgaActiveState}>{selectedAddrObj?.state || quickDestination.state || 'Yobe State'}</Text>
                                        <View style={s.lgaBadge}>
                                            <Text style={s.lgaBadgeTxt}>{selectedAddrObj?.lga || selectedAddrObj?.city || quickDestination.lga || 'Bade'} LGA</Text>
                                        </View>
                                    </View>
                                    <Text style={s.lgaActiveRoute} numberOfLines={1}>
                                        {shippingCalculation?.ruleSummary || 'Intra-LGA Local Delivery (Bade / Gashua)'}
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={16} color={SLATE} />
                            </TouchableOpacity>
                        </View>

                        {/* Addresses List */}
                        {loading ? (
                            <View style={{ gap: 8 }}>
                                <CheckoutAddressSkeleton />
                                <CheckoutAddressSkeleton />
                            </View>
                        ) : addresses.length === 0 ? (
                            <View style={s.emptyBox}>
                                <Ionicons name="home-outline" size={28} color={GOLD} />
                                <Text style={s.emptyTitle}>LGA Selected: {selectedAddrObj?.lga || quickDestination.lga} LGA</Text>
                                <Text style={s.emptySub}>Add full street details or proceed directly with this Local Government.</Text>
                                <TouchableOpacity
                                    style={s.addAddressBtn}
                                    onPress={() => navigation.navigate('AddressPage')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add" size={15} color={NAVY} />
                                    <Text style={s.addAddressBtnTxt}>Save Complete Street Address</Text>
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
                                    style={s.addAnotherCompact}
                                    onPress={() => navigation.navigate('AddressPage')}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="add-circle-outline" size={16} color={GOLD} />
                                    <Text style={s.addAnotherTxt}>Add or edit another address</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── DELIVERY SPEED & METHOD ───────────────────────── */}
                        <View style={{ marginTop: 16 }}>
                            <View style={s.methodHeaderRow}>
                                <Text style={s.methodHeaderTitle}>Shipping Speed & Method</Text>
                            </View>

                            {deliveryMethods.map((method) => {
                                const isSelected = selectedDeliveryMethod === method.code;
                                const isPickup   = method.code === 'pickup';
                                const isExpress  = method.code === 'express';

                                let methodCostLabel = '';
                                if (isPickup) {
                                    methodCostLabel = 'FREE';
                                } else {
                                    const mCalc = ShippingCalculationEngine.calculateMultiVendorShippingInstant({
                                        cartItems: cart,
                                        customerAddress: selectedAddrObj,
                                        deliveryMethodCode: method.code,
                                        adminSettings: settings?.shipping_settings || settings,
                                        shippingMethods: deliveryMethods
                                    });
                                    if (mCalc?.totalShippingFee && mCalc.totalShippingFee > 0) {
                                        methodCostLabel = formatCurrency(mCalc.totalShippingFee);
                                    } else {
                                        const defaultFee = isExpress ? 2500 : 800;
                                        methodCostLabel = formatCurrency(defaultFee);
                                    }
                                }

                                return (
                                    <TouchableOpacity
                                        key={method.code}
                                        onPress={() => setSelectedDeliveryMethod(method.code)}
                                        activeOpacity={0.8}
                                        style={[
                                            s.methodCard,
                                            isSelected && s.methodCardSelected
                                        ]}
                                    >
                                        <View style={[
                                            s.methodIconWrap,
                                            isSelected && s.methodIconWrapSelected
                                        ]}>
                                            <Ionicons
                                                name={method.icon || (isPickup ? 'storefront-outline' : isExpress ? 'flash-outline' : 'bicycle-outline')}
                                                size={16}
                                                color={isSelected ? GOLD : SLATE}
                                            />
                                        </View>

                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                                <Text style={[s.methodName, isSelected && s.methodNameSelected]}>
                                                    {method.name}
                                                </Text>
                                                {methodCostLabel ? (
                                                    <Text style={[
                                                        s.methodPrice,
                                                        methodCostLabel === 'FREE' && { color: EMERALD }
                                                    ]}>
                                                        {methodCostLabel}
                                                    </Text>
                                                ) : null}
                                            </View>
                                            <Text style={s.methodSub}>{method.estimated_days || 'Fast delivery'}</Text>
                                        </View>

                                        <View style={[s.radioCircle, isSelected && s.radioCircleSelected]}>
                                            {isSelected && <View style={s.radioDot} />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Multi-Vendor Packages Breakdown (if order is multi-store) */}
                        {shippingCalculation?.vendorGroups?.length > 1 && (
                            <View style={s.multiVendorCard}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                                    <Ionicons name="cube-outline" size={14} color={GOLD} />
                                    <Text style={s.multiVendorTitle}>
                                        Multi-Merchant Package Breakdown ({shippingCalculation.vendorGroups.length} Stores)
                                    </Text>
                                </View>
                                <Text style={s.multiVendorSub}>
                                    Items ship from independent merchant dispatch locations across Nigeria.
                                </Text>

                                {shippingCalculation.vendorGroups.map((vg, idx) => (
                                    <View key={idx} style={[s.vendorPkgRow, idx > 0 && s.vendorPkgDivider]}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={s.vendorPkgName} numberOfLines={1}>{vg.vendorName}</Text>
                                            <Text style={s.vendorPkgMeta}>{vg.itemCount} items • ~{vg.distanceKm} km transit</Text>
                                        </View>
                                        <Text style={[s.vendorPkgFee, vg.isFreeShipping && { color: EMERALD }]}>
                                            {vg.isFreeShipping ? 'FREE' : formatCurrency(vg.finalShippingFee)}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Fulfillment Guarantee Trust Badge */}
                        <View style={s.trustBadgeRow}>
                            <Ionicons name="shield-checkmark" size={15} color={GOLD} />
                            <Text style={s.trustBadgeTxt}>
                                {shippingCalculation?.totalDistanceKm
                                    ? `Total road route: ~${shippingCalculation.totalDistanceKm} km across Nigeria.`
                                    : 'Trackable dispatch & escrow protection on all shipments.'}
                            </Text>
                        </View>
                    </View>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 2: PAYMENT METHOD
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 2 && (
                    <View>
                        <View style={s.sectionHeader}>
                            <View>
                                <Text style={s.sectionTitle}>Payment Gateway</Text>
                                <Text style={s.sectionSub}>Choose how you would like to complete payment</Text>
                            </View>
                        </View>

                        {/* Payment Cards */}
                        {availableMethods.map((method) => {
                            const isSelected = paymentMethod === method.id;
                            const isWallet = method.id === 'Wallet';

                            return (
                                <TouchableOpacity
                                    key={method.id}
                                    onPress={() => setPaymentMethod(method.id)}
                                    activeOpacity={0.8}
                                    style={[
                                        s.payCard,
                                        isSelected && s.payCardSelected
                                    ]}
                                >
                                    {/* Icon / Brand Logo */}
                                    <View style={[
                                        s.payIconBox,
                                        isSelected && s.payIconBoxSelected,
                                        method.accentColor && isSelected && { borderColor: method.accentColor }
                                    ]}>
                                        {isWallet ? (
                                            <Ionicons name="wallet-outline" size={20} color={GOLD} />
                                        ) : method.logo ? (
                                            <Image
                                                source={{ uri: method.logo }}
                                                style={{ width: 22, height: 22 }}
                                                resizeMode="contain"
                                            />
                                        ) : (
                                            <Ionicons name={method.icon || 'card-outline'} size={20} color={method.accentColor || NAVY} />
                                        )}
                                    </View>

                                    {/* Details */}
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={[s.payTitle, isSelected && s.payTitleSelected]}>
                                                {method.name}
                                            </Text>
                                            {method.badge ? (
                                                <View style={[
                                                    s.payBadge,
                                                    method.accentColor ? { backgroundColor: method.accentColor === GOLD ? '#FEF9EC' : '#FFF7ED' } : null,
                                                    isWallet && isWalletInsufficient && s.payBadgeDanger
                                                ]}>
                                                    <Text style={[
                                                        s.payBadgeTxt,
                                                        method.accentColor ? { color: method.accentColor } : null,
                                                        isWallet && isWalletInsufficient && s.payBadgeDangerTxt
                                                    ]}>
                                                        {isWallet && isWalletInsufficient ? 'Insufficient' : method.badge}
                                                    </Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={s.paySub}>{method.sub}</Text>
                                    </View>

                                    {/* Radio */}
                                    <View style={[s.radioCircle, isSelected && s.radioCircleSelected, isSelected && method.accentColor && { borderColor: method.accentColor }]}>
                                        {isSelected && <View style={[s.radioDot, method.accentColor && { backgroundColor: method.accentColor }]} />}
                                    </View>
                                </TouchableOpacity>
                            );
                        })}

                        {/* Pay Small Small (BNPL) Interactive Plan Selector */}
                        {paymentMethod === 'pay_small_small' && (
                            <View style={s.pssBox}>
                                <View style={s.pssHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="calendar-outline" size={16} color={GOLD} />
                                        <Text style={s.pssHeaderTitle}>Select Installment Schedule</Text>
                                    </View>
                                    <View style={s.pssZeroFeePill}>
                                        <Text style={s.pssZeroFeeTxt}>0% INTEREST</Text>
                                    </View>
                                </View>

                                <View style={s.pssPlanOptions}>
                                    <TouchableOpacity
                                        style={[s.pssPlanBtn, pssPlan === '3_months' && s.pssPlanBtnActive]}
                                        onPress={() => setPssPlan('3_months')}
                                        activeOpacity={0.8}
                                    >
                                        <View style={s.pssPlanBtnTop}>
                                            <Text style={[s.pssPlanBtnTitle, pssPlan === '3_months' && s.pssPlanBtnTitleActive]}>
                                                3 Months
                                            </Text>
                                            <Text style={[s.pssPlanBtnSub, pssPlan === '3_months' && s.pssPlanBtnSubActive]}>
                                                3 Monthly Splits
                                            </Text>
                                        </View>
                                        <Text style={[s.pssPlanDownVal, pssPlan === '3_months' && s.pssPlanDownValActive]}>
                                            {formatCurrency(Math.round(finalTotal / 3))} /mo
                                        </Text>
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        style={[s.pssPlanBtn, pssPlan === '4_biweekly' && s.pssPlanBtnActive]}
                                        onPress={() => setPssPlan('4_biweekly')}
                                        activeOpacity={0.8}
                                    >
                                        <View style={s.pssPlanBtnTop}>
                                            <Text style={[s.pssPlanBtnTitle, pssPlan === '4_biweekly' && s.pssPlanBtnTitleActive]}>
                                                4 Bi-Weekly
                                            </Text>
                                            <Text style={[s.pssPlanBtnSub, pssPlan === '4_biweekly' && s.pssPlanBtnSubActive]}>
                                                Every 14 Days
                                            </Text>
                                        </View>
                                        <Text style={[s.pssPlanDownVal, pssPlan === '4_biweekly' && s.pssPlanDownValActive]}>
                                            {formatCurrency(Math.round(finalTotal / 4))} /2wks
                                        </Text>
                                    </TouchableOpacity>
                                </View>

                                {/* Dynamic Installment Schedule Breakdown */}
                                <View style={s.pssBreakdown}>
                                    <View style={s.pssBreakdownRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={[s.pssDot, { backgroundColor: EMERALD }]} />
                                            <Text style={s.pssBreakdownLabel}>Due Today (Down Payment):</Text>
                                        </View>
                                        <Text style={[s.pssBreakdownVal, { color: EMERALD }]}>
                                            {formatCurrency(pssPlan === '4_biweekly' ? Math.round(finalTotal / 4) : Math.round(finalTotal / 3))}
                                        </Text>
                                    </View>

                                    <View style={s.pssBreakdownRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={[s.pssDot, { backgroundColor: GOLD }]} />
                                            <Text style={s.pssBreakdownLabel}>
                                                {pssPlan === '4_biweekly' ? '3 Later Splits (Every 14 days):' : '2 Later Splits (Every 30 days):'}
                                            </Text>
                                        </View>
                                        <Text style={s.pssBreakdownVal}>
                                            {formatCurrency(pssPlan === '4_biweekly' ? Math.round(finalTotal / 4) : Math.round(finalTotal / 3))} each
                                        </Text>
                                    </View>
                                </View>

                                <View style={s.pssNoticeRow}>
                                    <Ionicons name="sparkles" size={13} color={GOLD} />
                                    <Text style={s.pssNoticeTxt}>
                                        Order is dispatched immediately upon paying down payment today. Clear balance easily in your Profile.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Pay on Delivery (POD) Verified Callout */}
                        {paymentMethod === 'pod' && (
                            <View style={s.podBox}>
                                <View style={s.podHeader}>
                                    <Ionicons name="shield-checkmark" size={16} color="#EA580C" />
                                    <Text style={s.podTitle}>Pay on Delivery (Cash / POS)</Text>
                                </View>
                                <Text style={s.podDesc}>
                                    Pay <Text style={{ fontWeight: '800' }}>{formatCurrency(finalTotal)}</Text> in cash or via POS bank debit card when your package is delivered to your doorstep. Please ensure your contact phone number is accessible for delivery verification.
                                </Text>
                            </View>
                        )}

                        {/* Insufficient Wallet Balance Alert Callout */}
                        {isWalletInsufficient && (
                            <View style={s.walletWarningBox}>
                                <Ionicons name="warning-outline" size={16} color={DANGER} />
                                <View style={{ flex: 1, marginLeft: 8 }}>
                                    <Text style={s.walletWarningTitle}>Wallet balance is insufficient</Text>
                                    <Text style={s.walletWarningSub}>
                                        Total required is {formatCurrency(finalTotal)}, but your wallet has {formatCurrency(walletBalance)}. Please select Paystack or Flutterwave.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Buyer Protection Trust Callout */}
                        <View style={s.escrowCallout}>
                            <View style={s.escrowIconBox}>
                                <Ionicons name="lock-closed" size={16} color={GOLD} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.escrowTitle}>Abu Mafhal Escrow Protection</Text>
                                <Text style={s.escrowSub}>
                                    Your funds are securely held in escrow until you receive and verify your ordered items. Zero risk to buyers.
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* ══════════════════════════════════════════════════════════════
                    STEP 3: REVIEW & CONFIRM
                ══════════════════════════════════════════════════════════════ */}
                {currentStep === 3 && (
                    <View>
                        <View style={s.sectionHeader}>
                            <View>
                                <Text style={s.sectionTitle}>Order Review</Text>
                                <Text style={s.sectionSub}>Final verification before completing payment</Text>
                            </View>
                        </View>

                        {/* Quick Recap: Address & Payment */}
                        <View style={s.recapContainer}>
                            {/* Destination Mini Card */}
                            <View style={s.recapCard}>
                                <View style={s.recapHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="location-sharp" size={14} color={GOLD} />
                                        <Text style={s.recapTitle}>Delivery Destination</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => setCurrentStep(1)}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text style={s.recapEditTxt}>Change</Text>
                                    </TouchableOpacity>
                                </View>

                                {selectedAddrObj ? (
                                    <View style={{ marginTop: 2 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={s.recapMainTxt}>{selectedAddrObj.title || 'Home'}</Text>
                                            {(selectedAddrObj.city || selectedAddrObj.lga) ? (
                                                <View style={s.lgaPill}>
                                                    <Text style={s.lgaPillTxt}>{selectedAddrObj.city || selectedAddrObj.lga} LGA</Text>
                                                </View>
                                            ) : null}
                                        </View>
                                        <Text style={s.recapSubTxt} numberOfLines={2}>{selectedAddrObj.address}</Text>
                                        {selectedAddrObj.phone ? (
                                            <Text style={s.recapPhoneTxt}>Phone: {selectedAddrObj.phone}</Text>
                                        ) : null}
                                    </View>
                                ) : (
                                    <Text style={s.recapSubTxt}>No address selected</Text>
                                )}
                            </View>

                            {/* Payment Method Mini Card */}
                            <View style={s.recapCard}>
                                <View style={s.recapHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="card-outline" size={14} color={GOLD} />
                                        <Text style={s.recapTitle}>Payment Gateway</Text>
                                    </View>
                                    <TouchableOpacity 
                                        onPress={() => setCurrentStep(2)}
                                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                    >
                                        <Text style={s.recapEditTxt}>Change</Text>
                                    </TouchableOpacity>
                                </View>
                                <View style={{ marginTop: 3 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Text style={s.recapMainTxt}>
                                            {paymentMethod === 'pay_small_small'
                                                ? `Pay Small Small (${pssPlan === '4_biweekly' ? '4 Bi-Weekly' : '3 Months'})`
                                                : paymentMethod === 'pod'
                                                ? 'Pay on Delivery (POD)'
                                                : paymentMethod}
                                        </Text>
                                        <View style={s.escrowSmallPill}>
                                            <Ionicons name="checkmark-circle" size={10} color={EMERALD} />
                                            <Text style={s.escrowSmallPillTxt}>Escrow</Text>
                                        </View>
                                    </View>
                                    {paymentMethod === 'pay_small_small' && (
                                        <Text style={s.recapSubTxt}>
                                            Due Today: {formatCurrency(pssPlan === '4_biweekly' ? Math.round(finalTotal / 4) : Math.round(finalTotal / 3))}
                                        </Text>
                                    )}
                                    {paymentMethod === 'pod' && (
                                        <Text style={s.recapSubTxt}>
                                            Cash or POS card on arrival
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </View>

                        {/* Interactive Expandable Items Preview Accordion */}
                        <View style={s.accordionCard}>
                            <TouchableOpacity
                                onPress={() => setShowItemsAccordion(!showItemsAccordion)}
                                activeOpacity={0.7}
                                style={s.accordionHeader}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="basket-outline" size={15} color={NAVY} />
                                    <Text style={s.accordionTitle}>Purchased Items ({cart.length})</Text>
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={s.accordionToggleTxt}>
                                        {showItemsAccordion ? 'Collapse' : 'Expand'}
                                    </Text>
                                    <Ionicons
                                        name={showItemsAccordion ? "chevron-up" : "chevron-down"}
                                        size={14}
                                        color={SLATE}
                                    />
                                </View>
                            </TouchableOpacity>

                            {showItemsAccordion && (
                                <View style={s.accordionBody}>
                                    {cart.map((item, idx) => {
                                        const price = parsePrice(item.price);
                                        const qty = parseInt(item.qty || item.quantity || 1, 10) || 1;
                                        const lineTotal = price * qty;
                                        const img = getItemImage(item);

                                        return (
                                            <View key={item.id || idx} style={[s.itemMiniRow, idx > 0 && s.itemMiniDivider]}>
                                                <Image source={{ uri: img }} style={s.itemMiniImg} resizeMode="cover" />
                                                <View style={{ flex: 1, marginLeft: 10 }}>
                                                    <Text style={s.itemMiniTitle} numberOfLines={1}>
                                                        {item.name || 'Item'}
                                                    </Text>
                                                    <Text style={s.itemMiniQty}>
                                                        Qty: {qty} × {formatCurrency(price)}
                                                    </Text>
                                                </View>
                                                <Text style={s.itemMiniTotal}>{formatCurrency(lineTotal)}</Text>
                                            </View>
                                        );
                                    })}
                                </View>
                            )}
                        </View>

                        {/* Compact Coupon Code */}
                        {settings?.enable_coupons !== false && (
                            <View style={s.couponWrap}>
                                <Text style={s.smallLabel}>Voucher Code</Text>
                                <View style={s.couponRow}>
                                    <TextInput
                                        style={s.couponInput}
                                        placeholder="Enter voucher code"
                                        placeholderTextColor="#94A3B8"
                                        value={couponCode}
                                        onChangeText={setCouponCode}
                                        autoCapitalize="characters"
                                        editable={!appliedCoupon}
                                    />
                                    {appliedCoupon ? (
                                        <TouchableOpacity
                                            style={s.couponRemoveBtn}
                                            onPress={handleRemoveCoupon}
                                            activeOpacity={0.7}
                                        >
                                            <Ionicons name="close" size={16} color={DANGER} />
                                        </TouchableOpacity>
                                    ) : (
                                        <TouchableOpacity
                                            style={[s.couponApplyBtn, (!couponCode.trim() || validatingCoupon) && s.couponApplyBtnDisabled]}
                                            onPress={handleApplyCoupon}
                                            disabled={!couponCode.trim() || validatingCoupon}
                                            activeOpacity={0.8}
                                        >
                                            {validatingCoupon ? (
                                                <ActivityIndicator size="small" color={WHITE} />
                                            ) : (
                                                <Text style={s.couponApplyBtnTxt}>Apply</Text>
                                            )}
                                        </TouchableOpacity>
                                    )}
                                </View>
                                {appliedCoupon && (
                                    <Text style={s.couponSuccessTxt}>
                                        Applied: {appliedCoupon.code} (-{formatCurrency(discountAmount)})
                                    </Text>
                                )}
                            </View>
                        )}

                        {/* Order Notes (Optional) */}
                        <View style={s.notesWrap}>
                            <Text style={s.smallLabel}>Delivery Instructions (Optional)</Text>
                            <TextInput
                                style={s.notesInput}
                                placeholder="E.g. Call before arrival, leave at reception..."
                                placeholderTextColor="#94A3B8"
                                value={orderNote}
                                onChangeText={setOrderNote}
                                multiline
                                numberOfLines={2}
                            />
                        </View>

                        {/* Terms & Conditions Acceptance */}
                        <TouchableOpacity
                            style={s.termsRow}
                            onPress={() => setAgreedToTerms(!agreedToTerms)}
                            activeOpacity={0.7}
                        >
                            <View style={[s.termsCheckbox, agreedToTerms && s.termsCheckboxActive]}>
                                {agreedToTerms && <Ionicons name="checkmark" size={13} color={WHITE} />}
                            </View>
                            <Text style={s.termsTxt}>
                                I agree to Abu Mafhal's <Text style={s.termsLink}>Escrow Purchase Terms</Text> & Buyer Protection policy.
                            </Text>
                        </TouchableOpacity>

                        {/* Order Cost Breakdown Invoice Summary */}
                        <View style={s.invoiceCard}>
                            <Text style={s.invoiceTitle}>Payment Summary</Text>

                            {/* Subtotal */}
                            <View style={s.invoiceRow}>
                                <Text style={s.invoiceLabel}>Items Subtotal ({cart.length})</Text>
                                <Text style={s.invoiceValue}>{formatCurrency(initialTotal)}</Text>
                            </View>

                            {/* Shipping Fee */}
                            <View style={s.invoiceRow}>
                                <View>
                                    <Text style={s.invoiceLabel}>
                                        Shipping ({deliveryMethods.find(m => m.code === selectedDeliveryMethod)?.name || 'Delivery'})
                                    </Text>
                                    <Text style={s.invoiceSubLabel}>
                                        {shippingCalculation?.vendorBreakdown?.length > 1
                                            ? `${shippingCalculation.vendorBreakdown.length} vendor packages combined`
                                            : 'Single store direct dispatch'}
                                        {shippingCalculation?.totalDistanceKm ? ` • ~${shippingCalculation.totalDistanceKm} km` : ''}
                                    </Text>
                                </View>
                                {isShippingFree ? (
                                    <View style={s.freeBadge}>
                                        <Text style={s.freeBadgeTxt}>FREE</Text>
                                    </View>
                                ) : (
                                    <Text style={s.invoiceValue}>{formatCurrency(shippingFee)}</Text>
                                )}
                            </View>

                            {/* Tax/VAT */}
                            {isTaxEnabled && (
                                <View style={s.invoiceRow}>
                                    <Text style={s.invoiceLabel}>VAT ({taxRateLabel}%)</Text>
                                    <Text style={s.invoiceValue}>{formatCurrency(taxAmount)}</Text>
                                </View>
                            )}

                            {/* Voucher Discount */}
                            {discountAmount > 0 && (
                                <View style={s.invoiceRow}>
                                    <Text style={[s.invoiceLabel, { color: EMERALD }]}>
                                        Voucher Savings ({appliedCoupon?.code})
                                    </Text>
                                    <Text style={[s.invoiceValue, { color: EMERALD }]}>
                                        -{formatCurrency(discountAmount)}
                                    </Text>
                                </View>
                            )}

                            <View style={s.invoiceDivider} />

                            {/* Final Total */}
                            <View style={s.finalRow}>
                                <View>
                                    <Text style={s.finalLabel}>Grand Total</Text>
                                    <Text style={s.finalSubLabel}>All taxes & delivery included</Text>
                                </View>
                                <Text style={s.finalValue}>{formatCurrency(finalTotal)}</Text>
                            </View>
                        </View>

                        {/* WhatsApp Dispatch Notice */}
                        <View style={s.whatsAppNotice}>
                            <Ionicons name="logo-whatsapp" size={14} color="#15803D" />
                            <Text style={s.whatsAppNoticeTxt}>
                                Order invoice & live dispatch tracking will be sent to: <Text style={{ fontWeight: '800' }}>{selectedAddrObj?.phone || user?.phone || 'Your Phone'}</Text>
                            </Text>
                        </View>
                    </View>
                )}
            </ScrollView>

            {/* ── STICKY COMPACT BOTTOM ACTION BAR ──────────────────────────── */}
            <View style={s.footerBar}>
                <View style={s.footerTotalBox}>
                    <Text style={s.footerTotalLabel}>
                        {currentStep === 3 && paymentMethod === 'pay_small_small' ? 'Due Today (Down Payment)' : 'Total to Pay'}
                    </Text>
                    <Text style={s.footerTotalVal}>
                        {currentStep === 3 && paymentMethod === 'pay_small_small'
                            ? formatCurrency(pssPlan === '4_biweekly' ? Math.round(finalTotal / 4) : Math.round(finalTotal / 3))
                            : formatCurrency(finalTotal)}
                    </Text>
                </View>

                <View style={s.footerBtnsRow}>
                    {currentStep > 1 ? (
                        <TouchableOpacity
                            style={s.btnBack}
                            onPress={() => setCurrentStep(currentStep - 1)}
                            activeOpacity={0.7}
                            disabled={isProcessing}
                        >
                            <Text style={s.btnBackTxt}>Back</Text>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={s.btnBack}
                            onPress={handleBackToShop}
                            activeOpacity={0.7}
                            disabled={isProcessing}
                        >
                            <Text style={s.btnBackTxt}>← Shop</Text>
                        </TouchableOpacity>
                    )}

                    <TouchableOpacity
                        style={[
                            s.btnNext,
                            isProcessing && { opacity: 0.7 },
                            currentStep === 3 && !agreedToTerms && { opacity: 0.6 }
                        ]}
                        onPress={currentStep === 3 ? handleFinalSubmit : validateAndNext}
                        disabled={isProcessing}
                        activeOpacity={0.8}
                    >
                        {isProcessing ? (
                            <ActivityIndicator size="small" color={WHITE} />
                        ) : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={s.btnNextTxt}>
                                    {currentStep === 3
                                        ? paymentMethod === 'pay_small_small'
                                            ? 'Confirm & Split Payment'
                                            : paymentMethod === 'pod'
                                            ? 'Confirm Order (POD)'
                                            : 'Confirm & Pay'
                                        : 'Continue'}
                                </Text>
                                <Ionicons
                                    name={currentStep === 3 ? "shield-checkmark" : "arrow-forward"}
                                    size={14}
                                    color={WHITE}
                                />
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </View>

            {/* ── FLOATING TOAST NOTIFICATION ───────────────────────────────── */}
            <Animated.View
                pointerEvents="none"
                style={[
                    s.toastBox,
                    {
                        opacity: toastAnim,
                        transform: [{
                            translateY: toastAnim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [20, 0]
                            })
                        }]
                    }
                ]}
            >
                <Text style={s.toastTxt}>{toastMessage}</Text>
            </Animated.View>

            {/* ── PROCESSING MODAL ─────────────────────────────────────────── */}
            <Modal transparent visible={isProcessing} animationType="fade">
                <View style={s.loadingOverlay}>
                    <View style={s.loadingBox}>
                        <ActivityIndicator size="large" color={GOLD} />
                        <Text style={s.loadingTitle}>Processing Escrow Order</Text>
                        <Text style={s.loadingSub}>Please wait, securing transaction...</Text>
                    </View>
                </View>
            </Modal>

            {/* ── LGA QUICK SELECTOR MODAL ───────────────────────────────────── */}
            <Modal
                visible={lgaModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setLgaModalVisible(false)}
            >
                <KeyboardAvoidingView 
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    style={s.modalOverlay}
                >
                    <View style={s.lgaModalContainer}>
                        {/* Modal Header */}
                        <View style={s.lgaModalHeader}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons name="location" size={17} color={GOLD} />
                                    <Text style={s.lgaModalTitle}>Select Local Government (LGA)</Text>
                                </View>
                                <Text style={s.lgaModalSub}>Choose LGA & State to calculate exact shipping fees</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => setLgaModalVisible(false)}
                                style={s.modalCloseBtn}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close-circle" size={24} color={SLATE} />
                            </TouchableOpacity>
                        </View>

                        {/* Search Input */}
                        <View style={s.lgaSearchWrap}>
                            <Ionicons name="search" size={16} color={SLATE} />
                            <TextInput
                                style={s.lgaSearchInput}
                                placeholder="Search LGA or Town (e.g. Bade, Gashua, Damaturu, Kano)..."
                                placeholderTextColor={MUTED}
                                value={lgaSearchQuery}
                                onChangeText={setLgaSearchQuery}
                                clearButtonMode="while-editing"
                            />
                            {lgaSearchQuery.length > 0 && (
                                <TouchableOpacity onPress={() => setLgaSearchQuery('')}>
                                    <Ionicons name="close" size={16} color={SLATE} />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* State Filter Chips */}
                        <View style={s.stateTabsWrapper}>
                            <ScrollView 
                                horizontal 
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 16, gap: 6 }}
                            >
                                {['Yobe', 'Jigawa', 'Borno', 'Kano', 'Bauchi', 'Gombe', 'Kaduna', 'Katsina', 'FCT Abuja', 'Lagos'].map((stateName) => {
                                    const isSelected = activeLgaStateFilter === stateName;
                                    return (
                                        <TouchableOpacity
                                            key={stateName}
                                            style={[s.stateTabBtn, isSelected && s.stateTabBtnActive]}
                                            onPress={() => setActiveLgaStateFilter(isSelected ? null : stateName)}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[s.stateTabBtnTxt, isSelected && s.stateTabBtnTxtActive]}>
                                                {stateName}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>

                        {/* LGA List */}
                        <FlatList
                            data={filteredLgaList}
                            keyExtractor={(item, index) => `${item.state}-${item.lga}-${index}`}
                            keyboardShouldPersistTaps="handled"
                            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                            initialNumToRender={15}
                            maxToRenderPerBatch={20}
                            renderItem={({ item }) => {
                                const isCurrent = (selectedAddrObj?.lga?.toLowerCase() === item.lga.toLowerCase() ||
                                                   quickDestination?.lga?.toLowerCase() === item.lga.toLowerCase()) &&
                                                  (selectedAddrObj?.state?.toLowerCase() === item.state.toLowerCase() ||
                                                   quickDestination?.state?.toLowerCase() === item.state.toLowerCase());
                                return (
                                    <TouchableOpacity
                                        style={[s.lgaItemRow, isCurrent && s.lgaItemRowSelected]}
                                        onPress={() => handleSelectLga(item.state, item.lga)}
                                        activeOpacity={0.7}
                                    >
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <Text style={[s.lgaItemName, isCurrent && s.lgaItemNameSelected]}>
                                                    {item.lga} LGA
                                                </Text>
                                                {item.tierBadge && (
                                                    <View style={s.lgaTierBadge}>
                                                        <Text style={s.lgaTierBadgeTxt}>{item.tierBadge}</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={s.lgaItemState}>{item.state} State • {item.estimatedDays || '1-3 days'}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end', gap: 2 }}>
                                            <Text style={s.lgaItemFee}>From ₦{Number(item.standardFee || 800).toLocaleString()}</Text>
                                            {isCurrent ? (
                                                <Ionicons name="checkmark-circle" size={18} color={EMERALD} />
                                            ) : (
                                                <Ionicons name="chevron-forward" size={16} color={BORDER} />
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                );
                            }}
                            ListEmptyComponent={
                                <View style={{ padding: 24, alignItems: 'center' }}>
                                    <Ionicons name="search-outline" size={32} color={MUTED} />
                                    <Text style={{ fontSize: 13, color: SLATE, marginTop: 8 }}>
                                        No LGA found matching "{lgaSearchQuery}"
                                    </Text>
                                </View>
                            }
                        />
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ── PAYMENT MODAL (WEBVIEW) ──────────────────────────────────── */}
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
                        Alert.alert('Payment Incomplete', 'The transaction was cancelled or incomplete. Please try again.');
                    }
                }}
            />
        </View>
    );
};

export const CheckoutPage = (props) => (
    <CheckoutPageInner {...props} onClearCart={props.onClearCart} />
);

// ── COMPACT, ERGONOMIC & LUXURY STYLESHEET ───────────────────────────────────
const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG,
    },
    headerSafe: {
        backgroundColor: WHITE,
        borderBottomWidth: 1,
        borderBottomColor: BORDER,
        paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0,
    },
    header: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
    },
    backBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerCenter: {
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: -0.3,
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 1,
    },
    secureBadgeTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: EMERALD,
        letterSpacing: 0.4,
    },
    stepCounterPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
    },
    stepCounterTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: SLATE_DARK,
    },

    // Stepper
    stepperRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#FAFBFD',
        borderTopWidth: 0.5,
        borderTopColor: '#F1F5F9',
    },
    stepTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1,
    },
    stepCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: WHITE,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepCircleActive: {
        backgroundColor: NAVY,
        borderColor: NAVY,
    },
    stepCircleDone: {
        backgroundColor: EMERALD,
        borderColor: EMERALD,
    },
    stepLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: SLATE,
    },
    stepLabelActive: {
        color: NAVY,
        fontWeight: '900',
    },
    stepLabelDone: {
        color: '#0F172A',
    },
    stepLine: {
        flex: 1,
        height: 2,
        backgroundColor: '#E2E8F0',
        marginHorizontal: 4,
        borderRadius: 1,
    },
    stepLineDone: {
        backgroundColor: EMERALD,
    },

    // Scroll
    scrollContent: {
        padding: 14,
        paddingBottom: 90,
    },

    // Section Headers
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: -0.2,
    },
    sectionSub: {
        fontSize: 11.5,
        color: SLATE,
        marginTop: 1,
    },
    manageLink: {
        fontSize: 12,
        fontWeight: '800',
        color: GOLD,
    },

    // Empty Box
    emptyBox: {
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 18,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER,
    },
    emptyTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
        marginTop: 8,
    },
    emptySub: {
        fontSize: 11,
        color: SLATE,
        textAlign: 'center',
        marginTop: 2,
        marginBottom: 12,
    },
    addAddressBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: GOLD,
        paddingHorizontal: 14,
        height: 38,
        borderRadius: 8,
        justifyContent: 'center',
    },
    addAddressBtnTxt: {
        fontSize: 12,
        fontWeight: '900',
        color: NAVY,
    },
    addAnotherCompact: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        marginTop: 4,
    },
    addAnotherTxt: {
        fontSize: 11.5,
        fontWeight: '700',
        color: GOLD,
    },

    // Delivery Methods
    methodHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    methodHeaderTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
    },
    routingBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    routingTxt: {
        fontSize: 10,
        fontWeight: '700',
        color: GOLD,
    },
    methodCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 10,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: BORDER,
    },
    methodCardSelected: {
        borderColor: GOLD,
        backgroundColor: GOLD_LIGHT,
    },
    methodIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    methodIconWrapSelected: {
        backgroundColor: '#FEF3C7',
    },
    methodName: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY,
    },
    methodNameSelected: {
        fontWeight: '900',
        color: NAVY,
    },
    methodPrice: {
        fontSize: 12,
        fontWeight: '900',
        color: NAVY,
    },
    methodSub: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 1,
    },

    // Radio
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        marginLeft: 8,
    },
    radioCircleSelected: {
        borderColor: GOLD,
    },
    radioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: GOLD,
    },

    // Multi Vendor Breakdown
    multiVendorCard: {
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 10,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    multiVendorTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: NAVY,
    },
    multiVendorSub: {
        fontSize: 10,
        color: SLATE,
        marginBottom: 6,
    },
    vendorPkgRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
    },
    vendorPkgDivider: {
        borderTopWidth: 0.5,
        borderTopColor: '#F1F5F9',
    },
    vendorPkgName: {
        fontSize: 11,
        fontWeight: '700',
        color: SLATE_DARK,
    },
    vendorPkgMeta: {
        fontSize: 9.5,
        color: SLATE,
    },
    vendorPkgFee: {
        fontSize: 11,
        fontWeight: '800',
        color: NAVY,
    },
    trustBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FAFBFD',
        padding: 9,
        borderRadius: 8,
        marginTop: 8,
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
    },
    trustBadgeTxt: {
        fontSize: 10.5,
        color: SLATE_DARK,
        fontWeight: '600',
        flex: 1,
    },

    // Step 2: Payment
    payCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: BORDER,
    },
    payCardSelected: {
        borderColor: GOLD,
        backgroundColor: GOLD_LIGHT,
    },
    payIconBox: {
        width: 36,
        height: 36,
        borderRadius: 9,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 0.5,
        borderColor: '#E2E8F0',
    },
    payIconBoxSelected: {
        backgroundColor: '#FEF3C7',
        borderColor: GOLD_BORDER,
    },
    payTitle: {
        fontSize: 13,
        fontWeight: '700',
        color: SLATE_DARK,
    },
    payTitleSelected: {
        fontWeight: '900',
        color: NAVY,
    },
    payBadge: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    payBadgeTxt: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#2563EB',
    },
    payBadgeDanger: {
        backgroundColor: '#FEF2F2',
    },
    payBadgeDangerTxt: {
        color: DANGER,
    },
    paySub: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 2,
    },
    walletWarningBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#FEF2F2',
        borderRadius: 10,
        padding: 10,
        marginTop: 4,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    walletWarningTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: DANGER,
    },
    walletWarningSub: {
        fontSize: 10,
        color: '#991B1B',
        marginTop: 2,
        lineHeight: 14,
    },
    escrowCallout: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
        borderWidth: 1,
        borderColor: BORDER,
    },
    escrowIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2,
    },
    escrowTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
    },
    escrowSub: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 2,
        lineHeight: 15,
    },

    // Step 3: Review
    recapContainer: {
        gap: 8,
        marginBottom: 12,
    },
    recapCard: {
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 11,
        borderWidth: 1,
        borderColor: BORDER,
    },
    recapHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 4,
    },
    recapTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: NAVY,
    },
    recapEditTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: GOLD,
    },
    recapMainTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: SLATE_DARK,
    },
    recapSubTxt: {
        fontSize: 11,
        color: SLATE,
        marginTop: 1,
        lineHeight: 15,
    },
    recapPhoneTxt: {
        fontSize: 10.5,
        color: '#475569',
        marginTop: 2,
        fontWeight: '600',
    },
    lgaPill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 3,
    },
    lgaPillTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: '#92400E',
    },
    escrowSmallPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        marginLeft: 8,
    },
    escrowSmallPillTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: EMERALD,
    },

    // Items Accordion
    accordionCard: {
        backgroundColor: WHITE,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: BORDER,
        marginBottom: 12,
        overflow: 'hidden',
    },
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 11,
        backgroundColor: '#FAFBFD',
    },
    accordionTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
    },
    accordionToggleTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: SLATE,
    },
    accordionBody: {
        paddingHorizontal: 11,
        paddingBottom: 6,
    },
    itemMiniRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7,
    },
    itemMiniDivider: {
        borderTopWidth: 0.5,
        borderTopColor: '#F1F5F9',
    },
    itemMiniImg: {
        width: 36,
        height: 36,
        borderRadius: 6,
        backgroundColor: '#F1F5F9',
    },
    itemMiniTitle: {
        fontSize: 11.5,
        fontWeight: '700',
        color: SLATE_DARK,
    },
    itemMiniQty: {
        fontSize: 10,
        color: SLATE,
        marginTop: 1,
    },
    itemMiniTotal: {
        fontSize: 11.5,
        fontWeight: '800',
        color: NAVY,
    },

    // Coupon & Notes
    smallLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: SLATE_DARK,
        marginBottom: 6,
    },
    couponWrap: {
        marginBottom: 6,
    },
    couponRow: {
        flexDirection: 'row',
        gap: 8,
    },
    couponInput: {
        flex: 1,
        height: 40,
        backgroundColor: WHITE,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        paddingHorizontal: 10,
        fontSize: 12,
        fontWeight: '700',
        color: NAVY,
    },
    couponBtn: {
        backgroundColor: GOLD,
        paddingHorizontal: 14,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    couponBtnApplied: {
        backgroundColor: DANGER,
    },
    couponBtnTxt: {
        fontSize: 11.5,
        fontWeight: '900',
        color: NAVY,
    },
    notesInput: {
        backgroundColor: WHITE,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BORDER,
        paddingHorizontal: 10,
        paddingVertical: 6,
        height: 52,
        fontSize: 11.5,
        color: NAVY,
        textAlignVertical: 'top',
    },

    // Terms
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        marginBottom: 14,
    },
    termsCheckbox: {
        width: 18,
        height: 18,
        borderRadius: 4,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        backgroundColor: WHITE,
    },
    termsCheckboxActive: {
        backgroundColor: GOLD,
        borderColor: GOLD,
    },
    termsTxt: {
        fontSize: 10.5,
        color: SLATE,
        flex: 1,
        lineHeight: 14,
    },

    // Detailed Invoice
    invoiceCard: {
        backgroundColor: WHITE,
        borderRadius: 14,
        padding: 13,
        borderWidth: 1,
        borderColor: BORDER,
    },
    invoiceHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
    },
    invoiceTitle: {
        fontSize: 12.5,
        fontWeight: '900',
        color: NAVY,
    },
    invoiceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 4,
    },
    invoiceLabel: {
        fontSize: 11.5,
        color: SLATE,
        fontWeight: '500',
    },
    invoiceSubLabel: {
        fontSize: 9.5,
        color: '#94A3B8',
        marginTop: 1,
    },
    invoiceValue: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
    },
    freeBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    freeBadgeTxt: {
        fontSize: 10,
        fontWeight: '900',
        color: '#16A34A',
    },
    invoiceDivider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 8,
    },
    finalRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 2,
    },
    finalLabel: {
        fontSize: 13.5,
        fontWeight: '900',
        color: NAVY,
    },
    finalSubLabel: {
        fontSize: 9.5,
        color: SLATE,
    },
    finalValue: {
        fontSize: 17,
        fontWeight: '900',
        color: NAVY,
    },
    whatsAppNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F0FDF4',
        padding: 9,
        borderRadius: 8,
        marginTop: 10,
        borderWidth: 0.5,
        borderColor: '#BBF7D0',
    },
    whatsAppNoticeTxt: {
        fontSize: 10,
        color: '#166534',
        flex: 1,
    },

    // Sticky Bottom Bar
    footerBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 60,
        backgroundColor: WHITE,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 8,
    },
    footerTotalBox: {
        justifyContent: 'center',
    },
    footerTotalLabel: {
        fontSize: 9.5,
        color: SLATE,
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    footerTotalVal: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY,
    },
    footerBtnsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    btnBack: {
        height: 42,
        paddingHorizontal: 14,
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    btnBackTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
    },
    btnNext: {
        height: 42,
        paddingHorizontal: 18,
        backgroundColor: NAVY,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        elevation: 3,
    },
    btnNextTxt: {
        fontSize: 12.5,
        fontWeight: '900',
        color: WHITE,
    },

    // Toast
    toastBox: {
        position: 'absolute',
        top: 60,
        alignSelf: 'center',
        backgroundColor: NAVY,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 5,
        zIndex: 999,
    },
    toastTxt: {
        fontSize: 11.5,
        fontWeight: '700',
        color: WHITE,
    },

    // Loading Modal
    loadingOverlay: {
        flex: 1,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    loadingBox: {
        backgroundColor: WHITE,
        paddingHorizontal: 28,
        paddingVertical: 22,
        borderRadius: 18,
        alignItems: 'center',
        width: '80%',
    },
    loadingTitle: {
        marginTop: 14,
        fontSize: 14,
        fontWeight: '900',
        color: NAVY,
    },
    loadingSub: {
        marginTop: 4,
        fontSize: 11,
        color: SLATE,
        textAlign: 'center',
    },

    // Success Screen
    successSafe: {
        flex: 1,
        backgroundColor: WHITE,
    },
    successContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
    },
    successIconBox: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    successTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: NAVY,
        textAlign: 'center',
    },
    successSub: {
        fontSize: 12.5,
        color: SLATE,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
        paddingHorizontal: 10,
    },
    orderIdPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 8,
        marginTop: 14,
    },
    orderIdTxt: {
        fontSize: 11,
        fontWeight: '900',
        color: NAVY,
        letterSpacing: 0.5,
    },
    whatsAppBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#DCFCE7',
    },
    whatsAppBannerTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#15803D',
    },
    successActionGroup: {
        width: '100%',
        marginTop: 28,
        gap: 10,
    },
    successPrimaryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: NAVY,
        height: 46,
        borderRadius: 12,
    },
    successPrimaryBtnTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: WHITE,
    },
    successSecondaryBtn: {
        alignItems: 'center',
        justifyContent: 'center',
        height: 40,
    },
    successSecondaryBtnTxt: {
        fontSize: 12.5,
        fontWeight: '700',
        color: SLATE,
    },
    // Pay Small Small (BNPL) Styles
    pssBox: {
        backgroundColor: '#FFFDF9',
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: GOLD,
    },
    pssHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    pssHeaderTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY,
    },
    pssZeroFeePill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 0.5,
        borderColor: GOLD,
    },
    pssZeroFeeTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: '#B45309',
    },
    pssPlanOptions: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10,
    },
    pssPlanBtn: {
        flex: 1,
        backgroundColor: WHITE,
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: BORDER,
    },
    pssPlanBtnActive: {
        borderColor: GOLD,
        backgroundColor: '#FEF9EC',
    },
    pssPlanBtnTop: {
        marginBottom: 4,
    },
    pssPlanBtnTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: SLATE_DARK,
    },
    pssPlanBtnTitleActive: {
        color: NAVY,
    },
    pssPlanBtnSub: {
        fontSize: 10,
        color: SLATE,
        marginTop: 1,
    },
    pssPlanBtnSubActive: {
        color: '#92400E',
        fontWeight: '600',
    },
    pssPlanDownVal: {
        fontSize: 13,
        fontWeight: '900',
        color: SLATE_DARK,
        marginTop: 2,
    },
    pssPlanDownValActive: {
        color: GOLD,
    },
    pssBreakdown: {
        backgroundColor: WHITE,
        borderRadius: 8,
        padding: 9,
        borderWidth: 1,
        borderColor: '#F3E8CB',
        gap: 6,
    },
    pssBreakdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pssDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
    },
    pssBreakdownLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: SLATE_DARK,
    },
    pssBreakdownVal: {
        fontSize: 11.5,
        fontWeight: '800',
        color: NAVY,
    },
    pssNoticeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 8,
    },
    pssNoticeTxt: {
        fontSize: 10,
        color: SLATE_DARK,
        flex: 1,
        lineHeight: 14,
    },
    // Pay on Delivery (POD) Styles
    podBox: {
        backgroundColor: '#FFF7ED',
        borderRadius: 12,
        padding: 12,
        marginTop: 4,
        marginBottom: 10,
        borderWidth: 1.5,
        borderColor: '#F97316',
    },
    podHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    podTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#9A3412',
    },
    podDesc: {
        fontSize: 11,
        color: '#7C2D12',
        lineHeight: 16,
    },
    // Success Screen Notices
    successPssNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF9EC',
        borderRadius: 10,
        padding: 10,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#F3E8CB',
        width: '100%',
    },
    successPssNoticeTxt: {
        fontSize: 11,
        color: '#92400E',
        flex: 1,
        lineHeight: 15,
        fontWeight: '600',
    },
    successPodNotice: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFF7ED',
        borderRadius: 10,
        padding: 10,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#FFEDD5',
        width: '100%',
    },
    successPodNoticeTxt: {
        fontSize: 11,
        color: '#9A3412',
        flex: 1,
        lineHeight: 15,
        fontWeight: '600',
    },
    successPssBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#FEF3C7',
        height: 44,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: GOLD,
    },
    successPssBtnTxt: {
        fontSize: 12.5,
        fontWeight: '800',
        color: NAVY,
    },
    // Additional Form Component Helpers
    notesWrap: {
        marginTop: 10,
    },
    termsLink: {
        color: GOLD,
        fontWeight: '800',
    },
    couponApplyBtn: {
        backgroundColor: NAVY,
        paddingHorizontal: 14,
        height: 40,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    couponApplyBtnDisabled: {
        opacity: 0.6,
    },
    couponApplyBtnTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: WHITE,
    },
    couponRemoveBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    couponSuccessTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: EMERALD,
        marginTop: 4,
    },
    // Empty Basket Screen
    emptyBasketWrapper: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 28,
        paddingBottom: 60,
    },
    emptyBasketIconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: GOLD_LIGHT,
        borderWidth: 1.5,
        borderColor: GOLD_BORDER,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    emptyBasketTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: NAVY,
        textAlign: 'center',
        marginBottom: 8,
    },
    emptyBasketSub: {
        fontSize: 13,
        color: SLATE,
        textAlign: 'center',
        lineHeight: 19,
        marginBottom: 24,
    },
    emptyReturnBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: NAVY,
        paddingHorizontal: 22,
        paddingVertical: 12,
        borderRadius: 12,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3,
    },
    emptyReturnBtnTxt: {
        fontSize: 13.5,
        fontWeight: '800',
        color: WHITE,
    },
    // ── LGA Quick Selector & Modal Styles ──
    lgaSelectCard: {
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 12,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
    },
    lgaSelectHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
        paddingBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    lgaSelectTitle: {
        fontSize: 11.5,
        fontWeight: '700',
        color: NAVY,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    changeLgaBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    changeLgaBtnTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#B45309',
    },
    lgaActiveRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 8,
    },
    lgaPinCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    lgaActiveState: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
    },
    lgaBadge: {
        backgroundColor: '#E0E7FF',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    lgaBadgeTxt: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#3730A3',
    },
    lgaActiveRoute: {
        fontSize: 11,
        color: SLATE,
        marginTop: 2,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    lgaModalContainer: {
        backgroundColor: WHITE,
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        maxHeight: '85%',
        paddingTop: 16,
    },
    lgaModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    lgaModalTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: NAVY,
    },
    lgaModalSub: {
        fontSize: 11,
        color: SLATE,
        marginTop: 2,
    },
    modalCloseBtn: {
        padding: 4,
    },
    lgaSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 10,
        marginHorizontal: 16,
        marginVertical: 10,
        paddingHorizontal: 10,
        height: 40,
        gap: 8,
    },
    lgaSearchInput: {
        flex: 1,
        fontSize: 12.5,
        color: NAVY,
        paddingVertical: 0,
    },
    stateTabsWrapper: {
        marginBottom: 8,
    },
    stateTabBtn: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    stateTabBtnActive: {
        backgroundColor: NAVY,
        borderColor: NAVY,
    },
    stateTabBtnTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: SLATE,
    },
    stateTabBtnTxtActive: {
        color: WHITE,
    },
    lgaItemRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    lgaItemRowSelected: {
        backgroundColor: '#F0FDF4',
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    lgaItemName: {
        fontSize: 13,
        fontWeight: '700',
        color: NAVY,
    },
    lgaItemNameSelected: {
        color: '#166534',
    },
    lgaTierBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    lgaTierBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#92400E',
    },
    lgaItemState: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 2,
    },
    lgaItemFee: {
        fontSize: 12,
        fontWeight: '800',
        color: NAVY,
    },
});
