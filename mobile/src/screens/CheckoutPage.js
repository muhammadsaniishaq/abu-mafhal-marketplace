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
    Animated,
    FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
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
const MUTED       = '#94A3B8';
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
        routeAddress?.id || (initialAddrs.find(a => a.is_default)?.id || initialAddrs[0]?.id || null)
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
    const [streetInputExpanded, setStreetInputExpanded]   = useState(false);
    const [customStreetAddress, setCustomStreetAddress]   = useState('');

    // Step 2: Payment Gateways
    const [paymentMethod, setPaymentMethod]               = useState('Paystack');
    const [pssDurationMonths, setPssDurationMonths]       = useState(3); // 1, 2, 3, 6, 10, 12
    const [pssFrequency, setPssFrequency]                 = useState('monthly'); // 'daily' | '2_days' | '3_days' | '5_days' | 'weekly' | 'monthly'
    const [pssDurationModalOpen, setPssDurationModalOpen]   = useState(false);
    const [pssFrequencyModalOpen, setPssFrequencyModalOpen] = useState(false);
    const [pssScheduleExpanded, setPssScheduleExpanded]   = useState(false);

    // Step 3: Review & Options
    const [couponCode, setCouponCode]           = useState('');
    const [appliedCoupon, setAppliedCoupon]     = useState(null);
    const [validatingCoupon, setValidatingCoupon] = useState(false);
    const [discountAmount, setDiscountAmount]   = useState(0);
    const [orderNote, setOrderNote]             = useState('');
    const [agreedToTerms, setAgreedToTerms]     = useState(false);
    const [showItemsAccordion, setShowItemsAccordion] = useState(true);

    // Vendor store location resolution cache state
    const [storesLoaded, setStoresLoaded] = useState(0);

    // Fetch and cache real vendor stores whenever cart updates
    useEffect(() => {
        if (Array.isArray(cart) && cart.length > 0) {
            const vendorIds = [...new Set(cart.map(i => i.vendor_id || i.vendorId).filter(Boolean))];
            if (vendorIds.length > 0) {
                ShippingCalculationEngine.fetchAndCacheStores(vendorIds).then(() => {
                    setStoresLoaded(prev => prev + 1);
                });
            }
        }
    }, [cart]);

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

    // Resolve active customer address directly from saved shipping addresses
    const selectedAddrObj = useMemo(() => {
        const found = addresses.find(a => a.id === selectedAddressId && a.id !== 'lga_dest');
        if (found) return found;
        if (routeAddress) return routeAddress;
        const defaultAddr = addresses.find(a => a.is_default);
        if (defaultAddr) return defaultAddr;
        if (addresses.length > 0) return addresses[0];
        if (profile?.address) {
            return {
                id: 'profile_default_addr',
                title: 'Default Address',
                address: profile.address,
                city: profile.city || profile.lga || '',
                lga: profile.lga || profile.city || '',
                state: profile.state || 'Yobe',
                phone: profile.phone || profile.phone_number || '',
                is_default: true
            };
        }
        return null;
    }, [addresses, selectedAddressId, routeAddress, profile]);

    // Instant Synchronous Shipping Calculation (0ms latency, zero delay)
    const shippingCalculation = useMemo(() => {
        const selectedAddr = selectedAddrObj;
        if (!selectedAddr || !cart.length) return null;

        return ShippingCalculationEngine.calculateMultiVendorShippingInstant({
            cartItems: cart,
            customerAddress: selectedAddr,
            deliveryMethodCode: selectedDeliveryMethod || 'standard',
            adminSettings: settings?.shipping_settings || settings,
            shippingMethods: deliveryMethods,
            storesCache: ShippingCalculationEngine.IN_MEMORY_STORES_CACHE
        });
    }, [selectedAddrObj, selectedDeliveryMethod, cart, settings, deliveryMethods, storesLoaded]);

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

    // Base total before BNPL surcharge
    const baseTotal = useMemo(() => {
        return Math.max(0, initialTotal + shippingFee + taxAmount - discountAmount);
    }, [initialTotal, shippingFee, taxAmount, discountAmount]);

    // Pay Small Small (BNPL) 5% Surcharge
    const pssSurcharge = useMemo(() => {
        if (paymentMethod !== 'pay_small_small') return 0;
        return Math.round(baseTotal * 0.05);
    }, [paymentMethod, baseTotal]);

    const finalTotal = useMemo(() => {
        return baseTotal + pssSurcharge;
    }, [baseTotal, pssSurcharge]);

    // Enhanced Pay Small Small Installment Engine
    const pssPlanDetails = useMemo(() => {
        const durationDaysMap = {
            1: 30,
            2: 60,
            3: 90,
            6: 180,
            10: 300,
            12: 360
        };
        const totalDays = durationDaysMap[pssDurationMonths] || 90;

        const frequencyDaysMap = {
            'daily': 1,
            '2_days': 2,
            '3_days': 3,
            '5_days': 5,
            'weekly': 7,
            'monthly': 30
        };
        const intervalDays = frequencyDaysMap[pssFrequency] || 30;

        let installmentsCount = Math.max(1, Math.floor(totalDays / intervalDays));
        if (pssDurationMonths === 1 && pssFrequency === 'monthly') {
            installmentsCount = 2; // 50% today, 50% in 30 days
        }

        const downPayment = Math.ceil(finalTotal / installmentsCount);
        const remainingBalance = Math.max(0, finalTotal - downPayment);
        const subsequentCount = Math.max(1, installmentsCount - 1);
        const baseRecurringAmount = Math.floor(remainingBalance / subsequentCount);

        const schedule = [];
        const baseTime = Date.now();

        schedule.push({
            installment_number: 1,
            amount: downPayment,
            due_date: new Date(baseTime).toISOString(),
            label: 'Due Today (Down Payment)',
            status: 'due_today'
        });

        let allocatedSum = downPayment;
        for (let i = 1; i < installmentsCount; i++) {
            const dueDate = new Date(baseTime + i * intervalDays * 24 * 60 * 60 * 1000);
            const isLast = (i === installmentsCount - 1);
            const amount = isLast ? (finalTotal - allocatedSum) : baseRecurringAmount;
            allocatedSum += amount;

            schedule.push({
                installment_number: i + 1,
                amount,
                due_date: dueDate.toISOString(),
                label: `Installment #${i + 1}`,
                status: 'pending'
            });
        }

        return {
            totalAmount: finalTotal,
            baseTotal,
            surcharge: pssSurcharge,
            durationMonths: pssDurationMonths,
            frequency: pssFrequency,
            intervalDays,
            totalDays,
            installmentsCount,
            downPayment,
            recurringAmount: baseRecurringAmount,
            remainingBalance,
            schedule
        };
    }, [finalTotal, baseTotal, pssSurcharge, pssDurationMonths, pssFrequency]);

    const dueTodayAmount = useMemo(() => {
        if (paymentMethod === 'pod') return 0;
        if (paymentMethod === 'pay_small_small') return pssPlanDetails.downPayment;
        return finalTotal;
    }, [paymentMethod, pssPlanDetails, finalTotal]);

    // Check if wallet balance is sufficient
    const walletBalance = Number(profile?.wallet_balance || 0);
    const isWalletInsufficient = paymentMethod === 'Wallet' && walletBalance < finalTotal;

    // Load initial data
    useEffect(() => {
        loadInitialData();
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadInitialData();
        }, [])
    );

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
                supabase.from('addresses').select('*').eq('user_id', currentUser.id).order('is_default', { ascending: false }),
                AsyncStorage.getItem(CHECKOUT_STORAGE_KEY),
                supabase.from('shipping_methods').select('*').eq('is_active', true).order('sort_order', { ascending: true })
            ]);

            if (profileRes.status === 'fulfilled' && profileRes.value?.data) setProfile(profileRes.value.data);

            // Resilient Address Loading: Merge Supabase and AsyncStorage cache
            const idMap = new Map();
            if (addrRes.status === 'fulfilled' && Array.isArray(addrRes.value?.data)) {
                addrRes.value.data.forEach(item => {
                    if (item && item.id) idMap.set(item.id, item);
                });
            }

            try {
                const localRaw = await AsyncStorage.getItem(`@user_addresses_${currentUser.id}`);
                if (localRaw) {
                    const parsed = JSON.parse(localRaw);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(item => {
                            if (item && item.id && !idMap.has(item.id)) {
                                idMap.set(item.id, item);
                            }
                        });
                    }
                }
            } catch (e) {
                console.log('Local address load error in checkout:', e);
            }

            let loadedAddresses = Array.from(idMap.values());

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
                if (defaultAddr && (!selectedAddressId || selectedAddressId === 'lga_dest' || !loadedAddresses.some(a => a.id === selectedAddressId))) {
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
                    installment_plan: paymentMethod === 'pay_small_small' ? pssPlanDetails : null,
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
                // If BNPL, cache rich plan locally for zero-latency in PaySmallSmallPage
                if (paymentMethod === 'pay_small_small') {
                    try {
                        const newPlanItem = {
                            id: order_id,
                            orderNumber: order_id.slice(0, 8).toUpperCase(),
                            createdAt: new Date().toISOString(),
                            totalAmount: finalTotal,
                            baseTotal: pssPlanDetails.baseTotal,
                            surcharge: pssPlanDetails.surcharge,
                            paidAmount: pssPlanDetails.downPayment,
                            remainingAmount: pssPlanDetails.remainingBalance,
                            planType: `${pssPlanDetails.durationMonths}_months_${pssPlanDetails.frequency}`,
                            durationMonths: pssPlanDetails.durationMonths,
                            frequency: pssPlanDetails.frequency,
                            installmentsCount: pssPlanDetails.installmentsCount,
                            installmentsPaid: 1,
                            isCompleted: false,
                            schedule: pssPlanDetails.schedule,
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
                                Down payment of {formatCurrency(pssPlanDetails.downPayment)} recorded. Remaining {pssPlanDetails.installmentsCount - 1} installments ({formatCurrency(pssPlanDetails.recurringAmount)} each) can be tracked easily in Pay Small Small.
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
                            <View style={{ flex: 1, marginRight: 8 }}>
                                <Text style={s.sectionTitle}>Delivery Address</Text>
                                <Text style={s.sectionSub} numberOfLines={1}>Choose your destination for accurate live calculation</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => navigation.navigate('AddressPage')}
                                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                                style={[s.manageBtnPill, { flexShrink: 0 }]}
                                activeOpacity={0.7}
                            >
                                <Ionicons name="add-circle-outline" size={14} color={GOLD} />
                                <Text style={s.manageLink}>Add Address</Text>
                            </TouchableOpacity>
                        </View>

                        {/* ── Direct Saved Shipping Addresses List ── */}
                        {addresses.length > 0 ? (
                            <View style={{ marginBottom: 10 }}>
                                {addresses.map((addr) => {
                                    const isSelected = (selectedAddrObj?.id === addr.id) || (selectedAddressId === addr.id);
                                    return (
                                        <CheckoutAddressCard
                                            key={addr.id || addr.address}
                                            address={addr}
                                            selected={isSelected}
                                            onSelect={() => {
                                                setSelectedAddressId(addr.id);
                                            }}
                                        />
                                    );
                                })}

                                <TouchableOpacity
                                    style={s.addNewAddressRow}
                                    onPress={() => navigation.navigate('AddressPage')}
                                    activeOpacity={0.7}
                                >
                                    <View style={s.addPlusCircle}>
                                        <Ionicons name="add" size={14} color="#B45309" />
                                    </View>
                                    <Text style={s.addNewAddressTxt}>Add Another Delivery Address</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <View style={s.emptyBox}>
                                <View style={s.emptyIconCircle}>
                                    <Ionicons name="location-outline" size={28} color={GOLD} />
                                </View>
                                <Text style={s.emptyTitle}>No Shipping Address Found</Text>
                                <Text style={s.emptySub}>
                                    Add your delivery address to get live shipping calculations and proceed to payment.
                                </Text>
                                <TouchableOpacity
                                    style={s.addAddressBtn}
                                    onPress={() => navigation.navigate('AddressPage')}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="add" size={16} color={NAVY} />
                                    <Text style={s.addAddressBtnTxt}>Add Delivery Address</Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {/* ── Live Shipping Intelligence Card (Real Calculation Feedback) ── */}
                        {selectedAddrObj && shippingCalculation && (
                            <View style={s.shippingInfoCard}>
                                <View style={s.shippingInfoTop}>
                                    <View style={s.shippingInfoLeft}>
                                        <View style={s.shippingInfoIconBox}>
                                            <Ionicons name="compass-outline" size={18} color={GOLD} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                <Text style={s.shippingRouteTitle} numberOfLines={1}>
                                                    {shippingCalculation.ruleSummary || 'Direct Dispatch Route'}
                                                </Text>
                                                {shippingCalculation.totalDistanceKm ? (
                                                    <View style={s.shippingKmBadge}>
                                                        <Text style={s.shippingKmBadgeTxt}>~{shippingCalculation.totalDistanceKm} km</Text>
                                                    </View>
                                                ) : null}
                                            </View>
                                            <Text style={s.shippingRouteSub} numberOfLines={1}>
                                                {selectedAddrObj.lga || selectedAddrObj.city ? `${selectedAddrObj.lga || selectedAddrObj.city} LGA, ` : ''}
                                                {selectedAddrObj.state || 'Nigeria'}
                                                {shippingCalculation.estimatedDeliveryDays ? ` • ${shippingCalculation.estimatedDeliveryDays}` : ''}
                                                {shippingCalculation.vendorBreakdown?.length > 1 ? ` • ${shippingCalculation.vendorBreakdown.length} packages` : ''}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={s.shippingFeeTag}>
                                        <Text style={s.shippingFeeTagTxt}>
                                            {selectedDeliveryMethod === 'pickup' ? 'FREE' : isShippingFree ? 'FREE' : formatCurrency(shippingFee)}
                                        </Text>
                                    </View>
                                </View>
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

                        {/* ── PAY SMALL SMALL (BNPL) ADVANCED PLAN SELECTOR ── */}
                        {paymentMethod === 'pay_small_small' && (
                            <View style={s.pssBox}>
                                <View style={s.pssHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="calendar" size={16} color={GOLD} />
                                        <Text style={s.pssHeaderTitle}>Pay Small Small Installment Plan</Text>
                                    </View>
                                    <View style={s.pssSurchargePill}>
                                        <Text style={s.pssSurchargePillTxt}>+5% FINANCING FEE</Text>
                                    </View>
                                </View>
                                
                                <Text style={s.pssSectionSubtitle}>
                                    Configure your custom duration and installment payment frequency:
                                </Text>

                                {/* 1. DURATION DROPDOWN */}
                                <View style={s.pssFieldGroup}>
                                    <Text style={s.pssFieldLabel}>Installment Duration (Tenor)</Text>
                                    <TouchableOpacity 
                                        style={s.pssDropdown}
                                        onPress={() => setPssDurationModalOpen(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Ionicons name="time-outline" size={16} color={GOLD} />
                                            <Text style={s.pssDropdownTxt}>
                                                {pssDurationMonths} {pssDurationMonths === 1 ? 'Month (30 Days)' : pssDurationMonths === 12 ? 'Months (1 Year)' : `Months (${pssDurationMonths * 30} Days)`}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={15} color={SLATE} />
                                    </TouchableOpacity>
                                </View>

                                {/* 2. FREQUENCY DROPDOWN */}
                                <View style={s.pssFieldGroup}>
                                    <Text style={s.pssFieldLabel}>Payment Frequency</Text>
                                    <TouchableOpacity 
                                        style={s.pssDropdown}
                                        onPress={() => setPssFrequencyModalOpen(true)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Ionicons name="repeat-outline" size={16} color={GOLD} />
                                            <Text style={s.pssDropdownTxt}>
                                                {pssFrequency === 'daily' ? 'Daily (Every Day)' :
                                                 pssFrequency === '2_days' ? 'Every 2 Days' :
                                                 pssFrequency === '3_days' ? 'Every 3 Days' :
                                                 pssFrequency === '5_days' ? 'Every 5 Days' :
                                                 pssFrequency === 'weekly' ? 'Weekly (Every 7 Days)' : 'Monthly (Every 30 Days)'}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-down" size={15} color={SLATE} />
                                    </TouchableOpacity>
                                </View>

                                {/* 3. DYNAMIC METRICS SUMMARY */}
                                <View style={s.pssBreakdown}>
                                    <View style={s.pssBreakdownRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={[s.pssDot, { backgroundColor: EMERALD }]} />
                                            <Text style={s.pssBreakdownLabel}>Due Today (Down Payment):</Text>
                                        </View>
                                        <Text style={[s.pssBreakdownVal, { color: EMERALD, fontWeight: '800' }]}>
                                            {formatCurrency(pssPlanDetails.downPayment)}
                                        </Text>
                                    </View>

                                    <View style={s.pssBreakdownRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={[s.pssDot, { backgroundColor: GOLD }]} />
                                            <Text style={s.pssBreakdownLabel}>
                                                Recurring Installment ({pssPlanDetails.installmentsCount - 1} remaining):
                                            </Text>
                                        </View>
                                        <Text style={[s.pssBreakdownVal, { fontWeight: '800' }]}>
                                            {formatCurrency(pssPlanDetails.recurringAmount)}
                                        </Text>
                                    </View>

                                    <View style={s.pssBreakdownRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="layers-outline" size={13} color={SLATE} />
                                            <Text style={s.pssBreakdownLabel}>Total Installment Splits:</Text>
                                        </View>
                                        <Text style={s.pssBreakdownVal}>
                                            {pssPlanDetails.installmentsCount} payments
                                        </Text>
                                    </View>

                                    <View style={s.pssBreakdownRow}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="pricetag-outline" size={13} color={SLATE} />
                                            <Text style={s.pssBreakdownLabel}>Financing Fee (+5%):</Text>
                                        </View>
                                        <Text style={[s.pssBreakdownVal, { color: '#B45309' }]}>
                                            +{formatCurrency(pssSurcharge)}
                                        </Text>
                                    </View>
                                </View>

                                {/* 4. EXPANDABLE SCHEDULE PREVIEW */}
                                <TouchableOpacity 
                                    style={s.pssScheduleToggleBtn}
                                    onPress={() => setPssScheduleExpanded(!pssScheduleExpanded)}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="calendar-outline" size={14} color={NAVY} />
                                        <Text style={s.pssScheduleToggleTxt}>
                                            {pssScheduleExpanded ? 'Hide Payment Dates' : 'View Installment Dates Schedule'}
                                        </Text>
                                    </View>
                                    <Ionicons name={pssScheduleExpanded ? 'chevron-up' : 'chevron-down'} size={14} color={NAVY} />
                                </TouchableOpacity>

                                {pssScheduleExpanded && (
                                    <View style={s.pssScheduleBox}>
                                        <Text style={s.pssScheduleTitle}>Payment Schedule ({pssPlanDetails.installmentsCount} Splits):</Text>
                                        {pssPlanDetails.schedule.slice(0, 10).map((inst, i) => (
                                            <View key={i} style={s.pssScheduleRow}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <View style={[s.pssScheduleNumCircle, i === 0 && { backgroundColor: EMERALD }]}>
                                                        <Text style={s.pssScheduleNumTxt}>{inst.installment_number}</Text>
                                                    </View>
                                                    <View>
                                                        <Text style={s.pssScheduleLabel}>{inst.label}</Text>
                                                        <Text style={s.pssScheduleDate}>
                                                            {i === 0 ? 'Today (Down Payment)' : new Date(inst.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={[s.pssScheduleAmount, i === 0 && { color: EMERALD }]}>
                                                    {formatCurrency(inst.amount)}
                                                </Text>
                                            </View>
                                        ))}
                                        {pssPlanDetails.schedule.length > 10 && (
                                            <Text style={s.pssScheduleMoreTxt}>
                                                + Remaining {pssPlanDetails.schedule.length - 10} installments viewable in Profile
                                            </Text>
                                        )}
                                    </View>
                                )}

                                <View style={s.pssNoticeRow}>
                                    <Ionicons name="sparkles" size={13} color={GOLD} />
                                    <Text style={s.pssNoticeTxt}>
                                        Items will be dispatched promptly upon paying today's down payment. Remaining installments can be paid easily through your account profile.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Pay on Delivery (POD) Verified Callout */}
                        {paymentMethod === 'pod' && (
                            <View style={s.podBox}>
                                <View style={s.podHeader}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <Ionicons name="cash" size={18} color="#EA580C" />
                                        <Text style={s.podTitle}>Pay on Delivery (Cash / POS) Active</Text>
                                    </View>
                                    <View style={s.podZeroPill}>
                                        <Text style={s.podZeroPillTxt}>₦0 UPFRONT TODAY</Text>
                                    </View>
                                </View>
                                <Text style={s.podDesc}>
                                    Pay ₦0 today! You only pay the total of <Text style={{ fontWeight: '800', color: NAVY }}>{formatCurrency(finalTotal)}</Text> in Cash or with POS Card directly to the courier upon delivery at your doorstep.
                                </Text>
                                <View style={s.podFeatureRow}>
                                    <View style={s.podFeatureItem}>
                                        <Ionicons name="checkmark-circle" size={14} color={EMERALD} />
                                        <Text style={s.podFeatureTxt}>₦0 Upfront</Text>
                                    </View>
                                    <View style={s.podFeatureItem}>
                                        <Ionicons name="checkmark-circle" size={14} color={EMERALD} />
                                        <Text style={s.podFeatureTxt}>Inspect Before Paying</Text>
                                    </View>
                                    <View style={s.podFeatureItem}>
                                        <Ionicons name="checkmark-circle" size={14} color={EMERALD} />
                                        <Text style={s.podFeatureTxt}>Cash or POS on Delivery</Text>
                                    </View>
                                </View>
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
                                                ? `Pay Small Small (${pssPlanDetails.durationMonths} Mo • ${pssPlanDetails.frequency})`
                                                : paymentMethod === 'pod'
                                                ? 'Pay on Delivery (Cash / POS)'
                                                : paymentMethod}
                                        </Text>
                                        <View style={s.escrowSmallPill}>
                                            <Ionicons name="checkmark-circle" size={10} color={EMERALD} />
                                            <Text style={s.escrowSmallPillTxt}>Escrow</Text>
                                        </View>
                                    </View>
                                    {paymentMethod === 'pay_small_small' && (
                                        <Text style={s.recapSubTxt}>
                                            Due Today: {formatCurrency(pssPlanDetails.downPayment)} • Then {pssPlanDetails.installmentsCount - 1} splits of {formatCurrency(pssPlanDetails.recurringAmount)}
                                        </Text>
                                    )}
                                    {paymentMethod === 'pod' && (
                                        <Text style={[s.recapSubTxt, { color: '#EA580C', fontWeight: '700' }]}>
                                            ₦0 upfront • Pay full {formatCurrency(finalTotal)} on arrival (Cash/POS)
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

                            {/* Pay Small Small 5% Financing Surcharge */}
                            {paymentMethod === 'pay_small_small' && (
                                <View style={s.invoiceRow}>
                                    <View>
                                        <Text style={[s.invoiceLabel, { color: '#B45309' }]}>Pay Small Small Service Fee (+5%)</Text>
                                        <Text style={s.invoiceSubLabel}>BNPL financing for {pssPlanDetails.durationMonths} Mo ({pssPlanDetails.frequency}) plan</Text>
                                    </View>
                                    <Text style={[s.invoiceValue, { color: '#B45309', fontWeight: '800' }]}>+{formatCurrency(pssSurcharge)}</Text>
                                </View>
                            )}

                            <View style={s.invoiceDivider} />

                            {/* Final Total */}
                            <View style={s.finalRow}>
                                <View>
                                    <Text style={s.finalLabel}>Grand Total</Text>
                                    <Text style={s.finalSubLabel}>All taxes, fees & delivery included</Text>
                                </View>
                                <Text style={s.finalValue}>{formatCurrency(finalTotal)}</Text>
                            </View>

                            {/* Down Payment vs Due Today Callout in Invoice */}
                            {paymentMethod === 'pay_small_small' && (
                                <View style={{ backgroundColor: '#F0FDF4', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#BBF7D0' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534' }}>Due Today (Down Payment):</Text>
                                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#166534' }}>{formatCurrency(pssPlanDetails.downPayment)}</Text>
                                    </View>
                                    <Text style={{ fontSize: 10.5, color: '#15803D', marginTop: 2 }}>
                                        Remaining balance of {formatCurrency(pssPlanDetails.remainingBalance)} will be paid in {pssPlanDetails.installmentsCount - 1} installments ({formatCurrency(pssPlanDetails.recurringAmount)} per {pssPlanDetails.frequency === 'daily' ? 'day' : pssPlanDetails.frequency === 'weekly' ? 'week' : 'month'})
                                    </Text>
                                </View>
                            )}

                            {paymentMethod === 'pod' && (
                                <View style={{ backgroundColor: '#FFF7ED', padding: 10, borderRadius: 8, marginTop: 10, borderWidth: 1, borderColor: '#FED7AA' }}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#C2410C' }}>Due Today (Upfront):</Text>
                                        <Text style={{ fontSize: 14, fontWeight: '900', color: '#C2410C' }}>₦0</Text>
                                    </View>
                                    <Text style={{ fontSize: 10.5, color: '#9A3412', marginTop: 2 }}>
                                        Full order amount of {formatCurrency(finalTotal)} will be paid upon arrival (Cash or POS transfer).
                                    </Text>
                                </View>
                            )}
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
                <View style={s.footerInner}>
                    <View style={s.footerTotalBox}>
                        <Text style={s.footerTotalLabel}>
                            {paymentMethod === 'pod'
                                ? 'Due on Delivery'
                                : paymentMethod === 'pay_small_small'
                                ? 'Due Today (Down Payment)'
                                : 'Total to Pay'}
                        </Text>
                        <Text style={s.footerTotalVal}>
                            {paymentMethod === 'pod'
                                ? formatCurrency(finalTotal)
                                : paymentMethod === 'pay_small_small'
                                ? formatCurrency(pssPlanDetails.downPayment)
                                : formatCurrency(finalTotal)}
                        </Text>
                        {paymentMethod === 'pod' && (
                            <Text style={{ fontSize: 9.5, color: '#EA580C', fontWeight: '800' }}>₦0 upfront today</Text>
                        )}
                        {paymentMethod === 'pay_small_small' && (
                            <Text style={{ fontSize: 9.5, color: '#B45309', fontWeight: '700' }}>Total: {formatCurrency(finalTotal)} (+5%)</Text>
                        )}
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
                                                ? `Confirm & Pay ${formatCurrency(pssPlanDetails.downPayment)}`
                                                : paymentMethod === 'pod'
                                                ? 'Confirm Order (Pay on Delivery)'
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



            {/* ── PSS DURATION MODAL ───────────────────────────────────────── */}
            <Modal
                visible={pssDurationModalOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setPssDurationModalOpen(false)}
            >
                <TouchableOpacity 
                    style={s.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setPssDurationModalOpen(false)}
                >
                    <View style={s.pickerModalSheet}>
                        <View style={s.pickerModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="time" size={16} color={GOLD} />
                                <Text style={s.pickerModalTitle}>Select Installment Duration</Text>
                            </View>
                            <TouchableOpacity onPress={() => setPssDurationModalOpen(false)} style={s.modalCloseBtn}>
                                <Ionicons name="close-circle" size={22} color={SLATE} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 320 }}>
                            {[
                                { months: 1, label: '1 Month', sub: 'Pay in 30 days total' },
                                { months: 2, label: '2 Months', sub: 'Pay in 60 days total' },
                                { months: 3, label: '3 Months', sub: 'Pay in 90 days total' },
                                { months: 6, label: '6 Months', sub: 'Pay in 180 days total' },
                                { months: 10, label: '10 Months', sub: 'Pay in 300 days total' },
                                { months: 12, label: '12 Months (1 Year)', sub: 'Pay in 365 days total' },
                            ].map((opt) => {
                                const isSel = pssDurationMonths === opt.months;
                                return (
                                    <TouchableOpacity
                                        key={opt.months}
                                        style={[s.pickerOptionRow, isSel && s.pickerOptionRowSelected]}
                                        onPress={() => {
                                            setPssDurationMonths(opt.months);
                                            setPssDurationModalOpen(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View>
                                            <Text style={[s.pickerOptionText, isSel && s.pickerOptionTextSelected]}>
                                                {opt.label}
                                            </Text>
                                            <Text style={s.pickerOptionSub}>{opt.sub}</Text>
                                        </View>
                                        {isSel && <Ionicons name="checkmark-circle" size={20} color={EMERALD} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
            </Modal>

            {/* ── PSS FREQUENCY MODAL ──────────────────────────────────────── */}
            <Modal
                visible={pssFrequencyModalOpen}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setPssFrequencyModalOpen(false)}
            >
                <TouchableOpacity 
                    style={s.modalOverlay} 
                    activeOpacity={1} 
                    onPress={() => setPssFrequencyModalOpen(false)}
                >
                    <View style={s.pickerModalSheet}>
                        <View style={s.pickerModalHeader}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Ionicons name="repeat" size={16} color={GOLD} />
                                <Text style={s.pickerModalTitle}>Select Payment Frequency</Text>
                            </View>
                            <TouchableOpacity onPress={() => setPssFrequencyModalOpen(false)} style={s.modalCloseBtn}>
                                <Ionicons name="close-circle" size={22} color={SLATE} />
                            </TouchableOpacity>
                        </View>
                        <ScrollView style={{ maxHeight: 320 }}>
                            {[
                                { key: 'daily', label: 'Daily', sub: 'Pay a small portion every single day' },
                                { key: '2_days', label: 'Every 2 Days', sub: 'Pay once every 48 hours' },
                                { key: '3_days', label: 'Every 3 Days', sub: 'Pay once every 72 hours' },
                                { key: '5_days', label: 'Every 5 Days', sub: 'Pay once every 5 days' },
                                { key: 'weekly', label: 'Weekly', sub: 'Pay once every 7 days' },
                                { key: 'monthly', label: 'Monthly', sub: 'Pay once every 30 days' },
                            ].map((opt) => {
                                const isSel = pssFrequency === opt.key;
                                return (
                                    <TouchableOpacity
                                        key={opt.key}
                                        style={[s.pickerOptionRow, isSel && s.pickerOptionRowSelected]}
                                        onPress={() => {
                                            setPssFrequency(opt.key);
                                            setPssFrequencyModalOpen(false);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View>
                                            <Text style={[s.pickerOptionText, isSel && s.pickerOptionTextSelected]}>
                                                {opt.label}
                                            </Text>
                                            <Text style={s.pickerOptionSub}>{opt.sub}</Text>
                                        </View>
                                        {isSel && <Ionicons name="checkmark-circle" size={20} color={EMERALD} />}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                </TouchableOpacity>
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
        maxWidth: 540,
        width: '100%',
        alignSelf: 'center',
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
        maxWidth: 540,
        width: '100%',
        alignSelf: 'center',
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
        padding: 12,
        paddingBottom: 95,
        maxWidth: 540,
        width: '100%',
        alignSelf: 'center',
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
        fontSize: 11.5,
        fontWeight: '800',
        color: GOLD,
    },
    manageBtnPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#FFFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#FDE68A',
        flexShrink: 0,
    },
    addNewAddressRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        marginTop: 2,
        borderWidth: 1,
        borderColor: '#F3DE9C',
        borderStyle: 'dashed',
        borderRadius: 12,
        backgroundColor: '#FFFDF7',
    },
    addPlusCircle: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
    },
    addNewAddressTxt: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#B45309',
    },
    emptyIconCircle: {
        width: 46,
        height: 46,
        borderRadius: 23,
        backgroundColor: '#FEF9EE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 2,
        overflow: 'hidden',
        flexShrink: 0,
    },
    shippingInfoCard: {
        backgroundColor: '#0E1A2E',
        borderRadius: 12,
        padding: 10,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1E293B',
    },
    shippingInfoTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    shippingInfoLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1,
    },
    shippingInfoIconBox: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    shippingRouteTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#FFFFFF',
    },
    shippingKmBadge: {
        backgroundColor: '#1E293B',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4,
    },
    shippingKmBadgeTxt: {
        fontSize: 9,
        fontWeight: '700',
        color: '#D9A73A',
    },
    shippingRouteSub: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 1,
    },
    shippingFeeTag: {
        backgroundColor: '#D9A73A',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
    },
    shippingFeeTagTxt: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0E1A2E',
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
        backgroundColor: WHITE,
        borderTopWidth: 1,
        borderTopColor: BORDER,
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 8,
    },
    footerInner: {
        maxWidth: 540,
        width: '100%',
        height: 60,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
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
        marginBottom: 4,
    },
    pssHeaderTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
    },
    pssSurchargePill: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F59E0B',
    },
    pssSurchargePillTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#92400E',
        letterSpacing: 0.4,
    },
    pssSectionSubtitle: {
        fontSize: 11,
        color: SLATE,
        marginBottom: 10,
    },
    pssSubheaderLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: NAVY,
        marginTop: 6,
        marginBottom: 6,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    pssChipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 8,
    },
    pssChip: {
        backgroundColor: WHITE,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    pssChipActive: {
        backgroundColor: NAVY,
        borderColor: NAVY,
    },
    pssChipTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: SLATE_DARK,
    },
    pssChipTxtActive: {
        color: WHITE,
    },
    pssBreakdown: {
        backgroundColor: WHITE,
        borderRadius: 10,
        padding: 10,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#FDE68A',
        gap: 6,
    },
    pssBreakdownRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    pssDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
    },
    pssBreakdownLabel: {
        fontSize: 11,
        fontWeight: '600',
        color: SLATE_DARK,
    },
    pssBreakdownVal: {
        fontSize: 11.5,
        fontWeight: '700',
        color: NAVY,
    },
    pssScheduleToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 8,
        marginTop: 10,
    },
    pssScheduleToggleTxt: {
        fontSize: 11.5,
        fontWeight: '800',
        color: NAVY,
    },
    pssScheduleBox: {
        backgroundColor: WHITE,
        borderRadius: 8,
        padding: 10,
        marginTop: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    pssScheduleTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 4,
    },
    pssScheduleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 4,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F5F9',
    },
    pssScheduleNumCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#94A3B8',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pssScheduleNumTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: WHITE,
    },
    pssScheduleLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: NAVY,
    },
    pssScheduleDate: {
        fontSize: 9.5,
        color: SLATE,
    },
    pssScheduleAmount: {
        fontSize: 11.5,
        fontWeight: '800',
        color: NAVY,
    },
    pssScheduleMoreTxt: {
        fontSize: 10,
        color: SLATE,
        textAlign: 'center',
        marginTop: 4,
        fontStyle: 'italic',
    },
    pssNoticeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 10,
    },
    pssNoticeTxt: {
        fontSize: 10.5,
        color: '#92400E',
        flex: 1,
        lineHeight: 15,
    },
    // Pay on Delivery (POD) Styles
    podBox: {
        backgroundColor: '#FFF7ED',
        borderRadius: 14,
        padding: 14,
        marginTop: 6,
        marginBottom: 12,
        borderWidth: 1.5,
        borderColor: '#FB923C',
        shadowColor: '#EA580C',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 5,
        elevation: 2,
    },
    podHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    podTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#9A3412',
    },
    podZeroPill: {
        backgroundColor: '#FFEDD5',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: '#F97316',
    },
    podZeroPillTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#C2410C',
    },
    podDesc: {
        fontSize: 11.5,
        color: '#7C2D12',
        lineHeight: 17,
        marginBottom: 10,
    },
    podFeatureRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
        backgroundColor: WHITE,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#FED7AA',
    },
    podFeatureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    podFeatureTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: NAVY,
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
        maxWidth: 540,
        width: '100%',
        alignSelf: 'center',
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
    pssFieldGroup: {
        marginBottom: 8,
    },
    pssFieldLabel: {
        fontSize: 10.5,
        fontWeight: '700',
        color: SLATE_DARK,
        marginBottom: 4,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    pssDropdown: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: WHITE,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 10,
        height: 40,
    },
    pssDropdownTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY,
    },
    streetToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 6,
        paddingVertical: 4,
    },
    streetToggleTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: GOLD,
    },
    streetInputBox: {
        marginTop: 6,
    },
    streetInput: {
        backgroundColor: WHITE,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 8,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 11.5,
        color: NAVY,
    },
    pickerModalSheet: {
        backgroundColor: WHITE,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 16,
        maxWidth: 540,
        width: '100%',
        alignSelf: 'center',
    },
    pickerModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    pickerModalTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: NAVY,
    },
    pickerOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        paddingHorizontal: 8,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F5F9',
        borderRadius: 6,
    },
    pickerOptionRowSelected: {
        backgroundColor: '#F0FDF4',
    },
    pickerOptionText: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY,
    },
    pickerOptionTextSelected: {
        color: '#166534',
        fontWeight: '800',
    },
    pickerOptionSub: {
        fontSize: 10.5,
        color: SLATE,
        marginTop: 1,
    },
});

export default CheckoutPage;

