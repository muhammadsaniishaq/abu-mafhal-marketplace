import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    SafeAreaView,
    StatusBar,
    ActivityIndicator,
    Alert,
    RefreshControl,
    Modal,
    TextInput,
    Platform,
    Image,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { useAppSettings } from '../context/AppSettingsContext';
import { paySmallSmallService } from '../services/paySmallSmallService';
import { PaymentGatewayService } from '../services/paymentGatewayService';
import FlutterwaveCheckout from '../lib/flutterwave/FlutterwaveCheckout';

const { width } = Dimensions.get('window');
const FALLBACK_IMAGE = 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=200&auto=format&fit=crop';

// Luxury Abu Mafhal Palette
const NAVY = '#0E1A2E';
const NAVY_LIGHT = '#1E293B';
const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FEF9EC';
const GOLD_BORDER = '#F3E8CB';
const EMERALD = '#10B981';
const EMERALD_BG = '#ECFDF5';
const AMBER = '#F59E0B';
const AMBER_BG = '#FFFBEB';
const SLATE_DARK = '#334155';
const SLATE_MUTED = '#64748B';
const SLATE_LIGHT = '#F8FAFC';
const BORDER = '#E2E8F0';
const WHITE = '#FFFFFF';

const formatCurrency = (val) => {
    return `₦${Number(val || 0).toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;
};

export const PaySmallSmallPage = ({ navigation, route, onBack, user: initialUser }) => {
    const [user, setUser] = useState(initialUser || null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activeTab, setActiveTab] = useState('active'); // 'active' | 'history' | 'info'
    const [plans, setPlans] = useState([]);
    const [walletBalance, setWalletBalance] = useState(0);

    // Payment Modal State
    const [selectedPlan, setSelectedPlan] = useState(null);
    const [paymentModalVisible, setPaymentModalVisible] = useState(false);
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet'); // 'wallet' | 'paystack' | 'flutterwave' | 'nowpayments'
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

    // External Gateway Modal State (WebView on Mobile)
    const [gatewayModalVisible, setGatewayModalVisible] = useState(false);
    const [gatewayCheckoutLink, setGatewayCheckoutLink] = useState('');
    const [activeGatewayTxRef, setActiveGatewayTxRef] = useState('');
    const [activeGatewayName, setActiveGatewayName] = useState('Paystack');
    const [isVerifyingGatewayPayment, setIsVerifyingGatewayPayment] = useState(false);

    const storageKey = useMemo(() => {
        return user?.id ? `@abumafhal_pss_plans_${user.id}` : '@abumafhal_pss_plans_guest';
    }, [user?.id]);

    // Fetch user if not provided
    useEffect(() => {
        const checkUser = async () => {
            if (!user) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                if (currentUser) setUser(currentUser);
            }
        };
        checkUser();
    }, []);

    // Load BNPL plans and user wallet balance
    const loadData = useCallback(async () => {
        try {
            setLoading(true);
            let activeUserId = user?.id;
            if (!activeUserId) {
                const { data: { user: currentUser } } = await supabase.auth.getUser();
                activeUserId = currentUser?.id;
            }

            // 1. Load cached plans first for instantaneous rendering
            let cachedPlans = [];
            try {
                const cached = await AsyncStorage.getItem(storageKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) {
                        cachedPlans = parsed;
                        setPlans(parsed);
                    }
                }
            } catch (_) {}

            if (!activeUserId) {
                setLoading(false);
                return;
            }

            // 2. Fetch Wallet Balance
            const { data: walletData } = await supabase
                .from('wallets')
                .select('balance')
                .eq('user_id', activeUserId)
                .maybeSingle();
            if (walletData) setWalletBalance(Number(walletData.balance || 0));

            // 3. Fetch BNPL Orders from Supabase joining order_items and products
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*, order_items(*, product:products(*))')
                .eq('user_id', activeUserId)
                .or('payment_method.ilike.%pay_small_small%,payment_method.ilike.%pss%,payment_status.ilike.%pss%,payment_status.ilike.%installment%')
                .order('created_at', { ascending: false });

            let fetchedPlans = [];
            if (orders && orders.length > 0) {
                fetchedPlans = orders.map(order => {
                    const rawPlan = order.installment_plan || order.shipping_details?.installment_plan || order.metadata?.installment_plan;
                    const total = Number(order.total_amount || 0);

                    // Parse plan or construct from order if structure not populated
                    let schedule = rawPlan?.schedule;
                    if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
                        const count = rawPlan?.installmentsCount || 3;
                        const down = Math.round(total / count);
                        const inst2 = Math.round(total / count);
                        const inst3 = total - down - inst2;
                        const created = new Date(order.created_at || Date.now());

                        const d1 = new Date(created);
                        const d2 = new Date(created.getTime() + 30 * 24 * 60 * 60 * 1000);
                        const d3 = new Date(created.getTime() + 60 * 24 * 60 * 60 * 1000);

                        schedule = [
                            { installment_number: 1, amount: down, due_date: d1.toISOString(), status: 'paid', paid_at: d1.toISOString() },
                            { installment_number: 2, amount: inst2, due_date: d2.toISOString(), status: 'pending', paid_at: null },
                            { installment_number: 3, amount: inst3, due_date: d3.toISOString(), status: 'pending', paid_at: null }
                        ];
                    }

                    const paidCount = schedule.filter(s => s.status === 'paid').length;
                    const paidAmount = schedule.reduce((sum, s) => s.status === 'paid' ? sum + Number(s.amount || 0) : sum, 0);
                    const remainingAmount = Math.max(0, total - paidAmount);
                    const isCompleted = remainingAmount <= 0 || paidCount === schedule.length;

                    // Parse rich products from order_items with joined products
                    let parsedItems = [];
                    if (Array.isArray(order.order_items) && order.order_items.length > 0) {
                        parsedItems = order.order_items.map(oi => {
                            const p = oi.product || {};
                            const prodImg = (Array.isArray(p.images) && p.images[0]) || p.image_url || oi.image || FALLBACK_IMAGE;
                            return {
                                id: oi.product_id || oi.id,
                                name: p.name || oi.name || 'Financed Product',
                                image: prodImg,
                                price: Number(oi.price || p.price || 0),
                                quantity: Number(oi.quantity || 1),
                                brand: p.brand || '',
                                category: p.category || '',
                                condition: p.condition || 'Brand New',
                                variant: oi.variant || oi.selected_variant || null
                            };
                        });
                    } else if (Array.isArray(order.items) && order.items.length > 0) {
                        parsedItems = order.items.map(it => ({
                            id: it.id || it.product_id,
                            name: it.name || it.title || 'Financed Product',
                            image: (Array.isArray(it.images) && it.images[0]) || it.image || FALLBACK_IMAGE,
                            price: Number(it.price || 0),
                            quantity: Number(it.quantity || 1),
                            brand: it.brand || '',
                            category: it.category || '',
                            condition: it.condition || 'Brand New',
                            variant: it.variant || it.selected_variant || null
                        }));
                    } else if (Array.isArray(rawPlan?.items) && rawPlan.items.length > 0) {
                        parsedItems = rawPlan.items.map(it => ({
                            ...it,
                            image: (Array.isArray(it.images) && it.images[0]) || it.image || FALLBACK_IMAGE
                        }));
                    }

                    const shipping = (order.shipping_details && typeof order.shipping_details === 'object') ? order.shipping_details : {};

                    return {
                        id: order.id,
                        orderNumber: (order.tracking_number || order.payment_reference || order.id).slice(0, 8).toUpperCase(),
                        trackingNumber: order.tracking_number || (order.id ? order.id.slice(0, 10).toUpperCase() : ''),
                        createdAt: order.created_at,
                        totalAmount: total,
                        paidAmount,
                        remainingAmount,
                        planType: rawPlan?.plan_type || rawPlan?.planType || '3_months',
                        installmentsCount: schedule.length,
                        installmentsPaid: paidCount,
                        isCompleted,
                        schedule,
                        items: parsedItems,
                        shippingDetails: shipping,
                        deliveryAddress: shipping.address || shipping.shipping_address || '',
                        deliveryCity: shipping.city || shipping.lga || '',
                        deliveryState: shipping.state || 'Yobe',
                        recipientName: shipping.fullName || shipping.name || '',
                        recipientPhone: shipping.phone || shipping.phoneNumber || ''
                    };
                });
            }

            // 4. Merge cached plans & live cloud plans
            const planMap = new Map();
            if (Array.isArray(cachedPlans)) {
                cachedPlans.forEach(p => {
                    if (p && (p.id || p.orderNumber)) {
                        planMap.set(p.id || p.orderNumber, p);
                    }
                });
            }
            fetchedPlans.forEach(p => {
                if (p && (p.id || p.orderNumber)) {
                    planMap.set(p.id || p.orderNumber, p);
                }
            });

            const mergedPlans = Array.from(planMap.values()).sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
            setPlans(mergedPlans);
            if (mergedPlans.length > 0) {
                await AsyncStorage.setItem(storageKey, JSON.stringify(mergedPlans));
            }

            // 5. Automated Check & Send WhatsApp + Email Reminders for Due/Overdue Installments
            try {
                let userEmail = user?.email;
                let userPhone = user?.phone || user?.user_metadata?.phone;
                let userName = user?.user_metadata?.full_name || user?.user_metadata?.name;

                if (!userEmail || !userPhone || !userName) {
                    const { data: prof } = await supabase
                        .from('profiles')
                        .select('email, phone, phone_number, full_name')
                        .eq('id', activeUserId)
                        .maybeSingle();
                    if (prof) {
                        userEmail = userEmail || prof.email;
                        userPhone = userPhone || prof.phone || prof.phone_number;
                        userName = userName || prof.full_name;
                    }
                }

                await paySmallSmallService.checkAndSendInstallmentReminders({
                    userId: activeUserId,
                    userEmail,
                    userPhone,
                    userName,
                    plans: mergedPlans
                });
            } catch (reminderErr) {
                console.log('[PaySmallSmallPage] Automated reminder check note:', reminderErr.message);
            }
        } catch (err) {
            console.log('Error loading Pay Small Small data:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [user?.id, storageKey]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const onRefresh = () => {
        setRefreshing(true);
        loadData();
    };

    // Derived Financial & Overdue Metrics via paySmallSmallService
    const ledgerMetrics = useMemo(() => {
        return paySmallSmallService.calculateLedgerMetrics(plans);
    }, [plans]);

    const activePlans = ledgerMetrics.activePlans;
    const completedPlans = ledgerMetrics.completedPlans;
    const totalOutstanding = ledgerMetrics.totalOutstanding;
    const totalOverdue = ledgerMetrics.totalOverdue;
    const overdueInstallmentsCount = ledgerMetrics.overdueInstallmentsCount;
    const hasOverdue = ledgerMetrics.hasOverdue;
    const nextDueInfo = ledgerMetrics.nextDueInfo;

    // Handle Paying Next Installment
    const handleOpenPayment = (plan) => {
        const nextInst = plan.schedule.find(s => s.status !== 'paid');
        if (!nextInst) {
            Alert.alert('All Clear', 'All installments for this plan are already completed!');
            return;
        }
        setSelectedPlan({ ...plan, targetInstallment: nextInst });
        setSelectedPaymentMethod('wallet');
        setPaymentModalVisible(true);
    };

    // Deep-link / route parameter listener: auto-focus targeted order BNPL plan
    useEffect(() => {
        const targetId = route?.params?.orderId || route?.params?.planId;
        if (targetId && plans.length > 0 && !loading) {
            const matched = plans.find(p => 
                p.id === targetId || 
                p.orderNumber === targetId || 
                (typeof targetId === 'string' && targetId.length >= 8 && p.orderNumber === targetId.slice(0, 8).toUpperCase())
            );
            if (matched) {
                if (matched.isCompleted) {
                    setActiveTab('history');
                } else {
                    setActiveTab('active');
                    handleOpenPayment(matched);
                }
            }
        }
    }, [route?.params?.orderId, route?.params?.planId, plans, loading]);

    // Finalize Installment Payment upon verified gateway payment or wallet debit
    const finalizeInstallmentPayment = useCallback(async ({ targetPlan, installmentToPay, methodUsed, paymentRef }) => {
        const instAmount = Number(installmentToPay.amount);
        const activeUserId = user?.id;

        const updatedSchedule = targetPlan.schedule.map(s => {
            if (s.installment_number === installmentToPay.installment_number) {
                return {
                    ...s,
                    status: 'paid',
                    paid_at: new Date().toISOString()
                };
            }
            return s;
        });

        const newPaidAmount = updatedSchedule.reduce((sum, s) => s.status === 'paid' ? sum + Number(s.amount || 0) : sum, 0);
        const newRemaining = Math.max(0, targetPlan.totalAmount - newPaidAmount);
        const isCompleted = newRemaining <= 0;

        const updatedPlan = {
            ...targetPlan,
            schedule: updatedSchedule,
            paidAmount: newPaidAmount,
            remainingAmount: newRemaining,
            installmentsPaid: targetPlan.installmentsPaid + 1,
            isCompleted
        };

        // 1. Persist to Supabase orders table
        if (targetPlan.id) {
            try {
                const planUpdateObj = {
                    plan_type: targetPlan.planType,
                    total_amount: targetPlan.totalAmount,
                    paid_amount: newPaidAmount,
                    paidAmount: newPaidAmount,
                    remaining_balance: newRemaining,
                    remainingAmount: newRemaining,
                    installments_paid: updatedPlan.installmentsPaid,
                    installmentsPaid: updatedPlan.installmentsPaid,
                    schedule: updatedSchedule
                };

                const { data: existingOrd } = await supabase
                    .from('orders')
                    .select('shipping_details')
                    .eq('id', targetPlan.id)
                    .maybeSingle();

                const currentShipping = (existingOrd && existingOrd.shipping_details && typeof existingOrd.shipping_details === 'object')
                    ? existingOrd.shipping_details
                    : {};

                await supabase.from('orders').update({
                    installment_plan: planUpdateObj,
                    shipping_details: {
                        ...currentShipping,
                        installment_plan: {
                            ...targetPlan,
                            remainingAmount: newRemaining,
                            installmentsPaid: updatedPlan.installmentsPaid,
                            schedule: updatedSchedule,
                            isCompleted
                        }
                    },
                    payment_status: isCompleted ? 'pss_completed' : 'pss_active'
                }).eq('id', targetPlan.id);
            } catch (dbErr) {
                console.warn('[PaySmallSmallPage] Order update notice:', dbErr.message);
            }
        }

        // 2. Record Completed Transaction in Supabase
        if (activeUserId) {
            try {
                await PaymentGatewayService.recordTransaction({
                    userId: activeUserId,
                    amount: instAmount,
                    reference: paymentRef || PaymentGatewayService.generateRef('PSS'),
                    gateway: methodUsed,
                    type: 'pss_installment_payment',
                    description: `Pay Small Small Installment #${installmentToPay.installment_number} of ${formatCurrency(instAmount)} via ${methodUsed} (Order #${targetPlan.orderNumber})`
                });
            } catch (_) {}
        }

        // 3. Update local plans state and storage cache
        setPlans(prev => {
            const next = prev.map(p => (p.id === targetPlan.id || p.orderNumber === targetPlan.orderNumber) ? updatedPlan : p);
            AsyncStorage.setItem(storageKey, JSON.stringify(next)).catch(() => {});
            return next;
        });

        setPaymentModalVisible(false);
        setGatewayModalVisible(false);
        setGatewayCheckoutLink('');
        setSelectedPlan(null);

        Alert.alert(
            'Installment Paid Successfully! 🎉',
            `Your installment #${installmentToPay.installment_number} of ${formatCurrency(instAmount)} via ${methodUsed} has been confirmed.\n\nRemaining Balance: ${formatCurrency(newRemaining)}`,
            [{ text: 'OK', onPress: () => loadData() }]
        );
    }, [user?.id, storageKey, loadData]);

    // Detect return from external payment gateway (Paystack / Flutterwave / NOWPayments) on Web
    useEffect(() => {
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const checkPssWebReturn = async () => {
                try {
                    const params = new URLSearchParams(window.location.search);
                    const ref = params.get('reference') || params.get('trxref') || params.get('tx_ref');
                    const status = (params.get('status') || '').toLowerCase();

                    if (ref && (ref.startsWith('PSS-') || ref.includes('INST') || ref.includes('PSS'))) {
                        window.history.replaceState({}, document.title, window.location.pathname);
                        if (status === 'cancelled' || status === 'failed') {
                            Alert.alert('Payment Cancelled', 'Your installment payment transaction was cancelled. No funds were deducted.');
                            return;
                        }

                        let pendingInst = null;
                        try {
                            const raw = window.localStorage.getItem('@abumafhal_pending_pss_installment');
                            if (raw) pendingInst = JSON.parse(raw);
                        } catch (_) {}

                        if (pendingInst && pendingInst.targetPlan && pendingInst.installmentToPay) {
                            setIsVerifyingGatewayPayment(true);
                            const verifyRes = await PaymentGatewayService.verifyPayment({
                                reference: ref,
                                gateway: pendingInst.gatewayTitle || 'Paystack',
                                amount: pendingInst.instAmount,
                                userId: user?.id,
                                action: 'pss_installment_payment'
                            });
                            setIsVerifyingGatewayPayment(false);

                            if (verifyRes.success) {
                                try {
                                    window.localStorage.removeItem('@abumafhal_pending_pss_installment');
                                } catch (_) {}
                                await finalizeInstallmentPayment({
                                    targetPlan: pendingInst.targetPlan,
                                    installmentToPay: pendingInst.installmentToPay,
                                    methodUsed: pendingInst.gatewayTitle || 'Paystack',
                                    paymentRef: ref
                                });
                            } else {
                                Alert.alert('Payment Incomplete', verifyRes.error || 'Your installment payment was not confirmed by the gateway.');
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[PaySmallSmallPage] Web return check note:', e.message);
                }
            };
            checkPssWebReturn();
        }
    }, [user?.id, finalizeInstallmentPayment]);

    const handleConfirmPayment = async () => {
        if (!selectedPlan || !selectedPlan.targetInstallment) return;

        const installmentToPay = selectedPlan.targetInstallment;
        const instAmount = Number(installmentToPay.amount);
        const activeUserId = user?.id;

        // Option 1: Abu Mafhal Wallet
        if (selectedPaymentMethod === 'wallet') {
            if (walletBalance < instAmount) {
                Alert.alert(
                    'Insufficient Wallet Balance',
                    `Your wallet balance is ${formatCurrency(walletBalance)}, which is less than the required installment of ${formatCurrency(instAmount)}. Please choose Paystack, Flutterwave, or NOWPayments (Crypto).`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Pay with Paystack', onPress: () => setSelectedPaymentMethod('paystack') },
                        { text: 'Pay with Crypto', onPress: () => setSelectedPaymentMethod('nowpayments') }
                    ]
                );
                return;
            }

            setIsSubmittingPayment(true);
            try {
                const newWalletBal = Math.max(0, walletBalance - instAmount);
                if (activeUserId) {
                    try {
                        await supabase.from('profiles').update({ wallet_balance: newWalletBal }).eq('id', activeUserId);
                        await supabase.from('wallets').update({ balance: newWalletBal }).eq('user_id', activeUserId);
                    } catch (_) {}
                    setWalletBalance(newWalletBal);
                }

                await finalizeInstallmentPayment({
                    targetPlan: selectedPlan,
                    installmentToPay,
                    methodUsed: 'Abu Mafhal Wallet',
                    paymentRef: PaymentGatewayService.generateRef('PSS-WLT')
                });
            } catch (err) {
                console.error('[PaySmallSmallPage] Wallet payment error:', err);
                Alert.alert('Payment Error', 'Unable to debit wallet for installment payment. Please try again.');
            } finally {
                setIsSubmittingPayment(false);
            }
            return;
        }

        // Option 2, 3, 4: Real Online Gateways (Paystack, Flutterwave, NOWPayments Crypto)
        setIsSubmittingPayment(true);
        try {
            const prefix = selectedPaymentMethod === 'flutterwave' ? 'PSS-FLW' : (selectedPaymentMethod === 'nowpayments' ? 'PSS-CRYPTO' : 'PSS-PSTK');
            const instRef = PaymentGatewayService.generateRef(prefix);
            const gatewayName = selectedPaymentMethod === 'flutterwave' ? 'Flutterwave' : (selectedPaymentMethod === 'nowpayments' ? 'NOWPayments' : 'Paystack');

            setActiveGatewayName(gatewayName);
            setActiveGatewayTxRef(instRef);

            const initRes = await PaymentGatewayService.initiate({
                gateway: gatewayName,
                amount: instAmount,
                email: user?.email || user?.user_metadata?.email || 'customer@abumafhal.com',
                phone: selectedPlan.recipientPhone || user?.phone || '',
                name: selectedPlan.recipientName || user?.user_metadata?.full_name || user?.full_name || 'Customer',
                reference: instRef,
                metadata: {
                    is_pss_installment: true,
                    order_id: selectedPlan.id,
                    order_number: selectedPlan.orderNumber,
                    installment_number: installmentToPay.installment_number,
                    amount: instAmount
                }
            });

            // Modern Web Pop-up if supported (Paystack Inline on Web)
            if (initRes?.type === 'inline_web' && typeof initRes.openInline === 'function') {
                setIsSubmittingPayment(false);
                setPaymentModalVisible(false);
                initRes.openInline(
                    async (callbackData) => {
                        setIsVerifyingGatewayPayment(true);
                        const vRes = await PaymentGatewayService.verifyPayment({
                            reference: callbackData?.reference || instRef,
                            gateway: gatewayName,
                            amount: instAmount,
                            userId: activeUserId,
                            action: 'pss_installment_payment'
                        });
                        setIsVerifyingGatewayPayment(false);

                        if (vRes.success) {
                            await finalizeInstallmentPayment({
                                targetPlan: selectedPlan,
                                installmentToPay,
                                methodUsed: gatewayName,
                                paymentRef: callbackData?.reference || instRef
                            });
                        } else {
                            Alert.alert('Payment Incomplete', vRes.error || 'Your installment payment was not confirmed by the gateway.');
                        }
                    },
                    () => {
                        Alert.alert('Payment Cancelled', 'Installment payment window closed without completing payment.');
                    }
                );
                return;
            }

            if (!initRes?.success || !initRes?.checkoutUrl) {
                throw new Error(`Could not initialize ${gatewayName} installment payment gateway.`);
            }

            // Web: Redirect to official secure hosted checkout
            const isHttp = typeof initRes.checkoutUrl === 'string' && (initRes.checkoutUrl.startsWith('http://') || initRes.checkoutUrl.startsWith('https://'));
            if (Platform.OS === 'web' && typeof window !== 'undefined' && isHttp) {
                const pendingInstallmentPayload = {
                    targetPlan: selectedPlan,
                    installmentToPay,
                    gatewayTitle: gatewayName,
                    instRef,
                    instAmount,
                    timestamp: Date.now()
                };
                try {
                    window.localStorage.setItem('@abumafhal_pending_pss_installment', JSON.stringify(pendingInstallmentPayload));
                    await AsyncStorage.setItem('@abumafhal_pending_pss_installment', JSON.stringify(pendingInstallmentPayload));
                } catch (_) {}
                setIsSubmittingPayment(false);
                window.location.href = initRes.checkoutUrl;
                return;
            }

            // Mobile: Launch in-app secure WebView modal
            setIsSubmittingPayment(false);
            setPaymentModalVisible(false);
            setGatewayCheckoutLink(initRes.checkoutUrl);
            setGatewayModalVisible(true);

        } catch (error) {
            console.error('[PaySmallSmallPage] Gateway initiation error:', error);
            setIsSubmittingPayment(false);
            Alert.alert('Payment Notice', error?.message || 'Payment initiation failed. Please try another payment method.');
        }
    };

    const handleGoBack = () => {
        if (typeof onBack === 'function') {
            onBack();
        } else if (navigation?.canGoBack && navigation.canGoBack()) {
            navigation.goBack();
        } else if (navigation?.navigate) {
            navigation.navigate('Main', { screen: 'profile' });
        }
    };

    return (
        <SafeAreaView style={s.safeArea}>
            <StatusBar barStyle="dark-content" backgroundColor={WHITE} />

            {/* ── TOP LUXURY APP BAR ── */}
            <View style={s.topBar}>
                <TouchableOpacity
                    onPress={handleGoBack}
                    style={s.topBarBtn}
                    activeOpacity={0.7}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                    <Ionicons name="chevron-back" size={20} color={NAVY} />
                </TouchableOpacity>

                <View style={s.topBarCenter}>
                    <Text style={s.topBarTitle}>Pay Small Small</Text>
                    <View style={s.bnplBadge}>
                        <Ionicons name="shield-checkmark" size={10} color={GOLD} />
                        <Text style={s.bnplBadgeTxt}>0% INTEREST BNPL</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={onRefresh}
                    style={s.topBarBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="refresh-outline" size={18} color={NAVY} />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={s.container}
                contentContainerStyle={s.contentContainer}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />
                }
            >
                {/* ── KPI EXECUTIVE LEDGER CARDS ── */}
                <View style={s.kpiCard}>
                    <View style={s.kpiHeaderRow}>
                        <View>
                            <Text style={s.kpiSmallLabel}>OUTSTANDING BNPL LEDGER</Text>
                            <Text style={s.kpiBalanceVal}>{formatCurrency(totalOutstanding)}</Text>
                            {hasOverdue && (
                                <View style={s.kpiOverduePill}>
                                    <Ionicons name="warning" size={10} color="#EF4444" />
                                    <Text style={s.kpiOverduePillTxt}>
                                        {formatCurrency(totalOverdue)} OVERDUE ({overdueInstallmentsCount})
                                    </Text>
                                </View>
                            )}
                        </View>
                        <View style={s.activeBadge}>
                            <View style={s.activeDot} />
                            <Text style={s.activeBadgeTxt}>
                                {activePlans.length} {activePlans.length === 1 ? 'Active Plan' : 'Active Plans'}
                            </Text>
                        </View>
                    </View>

                    <View style={s.kpiDivider} />

                    <View style={s.kpiMetricsRow}>
                        <View style={s.kpiMetricItem}>
                            <Text style={s.kpiMetricSub}>Next Payment Due</Text>
                            <Text style={s.kpiMetricMain}>
                                {nextDueInfo ? nextDueInfo.dateStr : 'No Due Dates'}
                            </Text>
                            {nextDueInfo && (
                                <Text style={[
                                    s.kpiMetricNotice,
                                    (nextDueInfo.isOverdue || nextDueInfo.daysRemaining <= 3) ? s.kpiNoticeUrgent : null
                                ]}>
                                    {nextDueInfo.isOverdue
                                        ? `⚠️ Overdue by ${Math.abs(nextDueInfo.daysRemaining)}d (${formatCurrency(nextDueInfo.amount)})`
                                        : nextDueInfo.daysRemaining > 0
                                        ? `In ${nextDueInfo.daysRemaining} days (${formatCurrency(nextDueInfo.amount)})`
                                        : `Due Today! (${formatCurrency(nextDueInfo.amount)})`}
                                </Text>
                            )}
                        </View>

                        <View style={s.kpiMetricDivider} />

                        <View style={s.kpiMetricItem}>
                            <Text style={s.kpiMetricSub}>Wallet Balance</Text>
                            <Text style={s.kpiMetricMain}>{formatCurrency(walletBalance)}</Text>
                            <TouchableOpacity
                                onPress={() => navigation?.navigate ? navigation.navigate('Main', { screen: 'wallet' }) : null}
                                activeOpacity={0.7}
                            >
                                <Text style={s.kpiTopUpLink}>Top-up Wallet →</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* ── OVERDUE DEBT ALERT BANNER ── */}
                {hasOverdue && (
                    <View style={s.overdueAlertCard}>
                        <View style={s.overdueAlertTop}>
                            <View style={s.overdueAlertIconBox}>
                                <Ionicons name="warning" size={20} color="#DC2626" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.overdueAlertTitle}>OVERDUE INSTALLMENT BALANCE DETECTED</Text>
                                <Text style={s.overdueAlertSub}>
                                    You have {overdueInstallmentsCount} overdue payment{overdueInstallmentsCount > 1 ? 's' : ''} totaling <Text style={{ fontWeight: '800', color: '#DC2626' }}>{formatCurrency(totalOverdue)}</Text>.
                                </Text>
                            </View>
                        </View>
                        <Text style={s.overdueAlertDesc}>
                            Please settle your overdue installment today to keep your 0% interest credit rating active, avoid service holds, and receive future orders without delay.
                        </Text>
                        <TouchableOpacity
                            style={s.overduePayBtn}
                            onPress={() => {
                                const planWithOverdue = activePlans.find(p => p.schedule.some(inst => inst.status !== 'paid' && new Date(inst.due_date) < new Date()));
                                if (planWithOverdue) {
                                    handleOpenPayment(planWithOverdue);
                                }
                            }}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="card-outline" size={16} color={WHITE} />
                            <Text style={s.overduePayBtnTxt}>Settle Overdue Balance ({formatCurrency(totalOverdue)}) →</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── TABS SELECTOR ── */}
                <View style={s.tabsRow}>
                    <TouchableOpacity
                        style={[s.tabItem, activeTab === 'active' && s.tabItemActive]}
                        onPress={() => setActiveTab('active')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="time-outline"
                            size={15}
                            color={activeTab === 'active' ? GOLD : SLATE_MUTED}
                        />
                        <Text style={[s.tabTxt, activeTab === 'active' && s.tabTxtActive]}>
                            Active ({activePlans.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.tabItem, activeTab === 'history' && s.tabItemActive]}
                        onPress={() => setActiveTab('history')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="checkmark-done-circle-outline"
                            size={15}
                            color={activeTab === 'history' ? GOLD : SLATE_MUTED}
                        />
                        <Text style={[s.tabTxt, activeTab === 'history' && s.tabTxtActive]}>
                            Completed ({completedPlans.length})
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[s.tabItem, activeTab === 'info' && s.tabItemActive]}
                        onPress={() => setActiveTab('info')}
                        activeOpacity={0.8}
                    >
                        <Ionicons
                            name="information-circle-outline"
                            size={15}
                            color={activeTab === 'info' ? GOLD : SLATE_MUTED}
                        />
                        <Text style={[s.tabTxt, activeTab === 'info' && s.tabTxtActive]}>
                            How It Works
                        </Text>
                    </TouchableOpacity>
                </View>

                {/* ── LOADING SPINNER ── */}
                {loading && !refreshing && (
                    <View style={s.loadingBox}>
                        <ActivityIndicator size="small" color={GOLD} />
                        <Text style={s.loadingTxt}>Synchronizing your BNPL plans...</Text>
                    </View>
                )}

                {/* ── TAB 1: ACTIVE PLANS ── */}
                {!loading && activeTab === 'active' && (
                    <View>
                        {activePlans.length === 0 ? (
                            <View style={s.emptyBox}>
                                <View style={s.emptyIconCircle}>
                                    <Ionicons name="calendar-outline" size={32} color={GOLD} />
                                </View>
                                <Text style={s.emptyTitle}>No Active Installment Plans</Text>
                                <Text style={s.emptySub}>
                                    You have no active Pay Small Small plans right now. Choose "Pay Small Small" at checkout to split your payments with 0% interest.
                                </Text>
                                <TouchableOpacity
                                    style={s.emptyBtn}
                                    onPress={() => navigation?.navigate ? navigation.navigate('Main', { screen: 'shop' }) : null}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons name="bag-handle-outline" size={16} color={WHITE} />
                                    <Text style={s.emptyBtnTxt}>Shop & Split Payments</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            activePlans.map((plan) => {
                                const percentPaid = Math.round((plan.paidAmount / (plan.totalAmount || 1)) * 100);
                                const nextPending = plan.schedule.find(s => s.status !== 'paid');

                                return (
                                    <View key={plan.id} style={s.planCard}>
                                        {/* Plan Header */}
                                        <View style={s.planCardTop}>
                                            <View>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                    <Text style={s.planOrderNum}>ORDER #{plan.orderNumber}</Text>
                                                    <View style={s.planTypePill}>
                                                        <Text style={s.planTypePillTxt}>
                                                            {plan.planType === '4_biweekly' ? '4 Bi-Weekly' : '3 Months'}
                                                        </Text>
                                                    </View>
                                                </View>
                                                <Text style={s.planDate}>
                                                    Started {new Date(plan.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                </Text>
                                            </View>

                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={s.planTotalVal}>{formatCurrency(plan.totalAmount)}</Text>
                                                <Text style={s.planRemainVal}>Remaining: {formatCurrency(plan.remainingAmount)}</Text>
                                            </View>
                                        </View>

                                        {/* Progress Bar */}
                                        <View style={s.progressSection}>
                                            <View style={s.progressTrack}>
                                                <View style={[s.progressFill, { width: `${percentPaid}%` }]} />
                                            </View>
                                            <View style={s.progressLabels}>
                                                <Text style={s.progressLabelTxt}>{percentPaid}% Paid</Text>
                                                <Text style={s.progressLabelTxt}>
                                                    {plan.installmentsPaid} of {plan.installmentsCount} Installments
                                                </Text>
                                            </View>
                                        </View>

                                        {/* ── PRODUCTS IN THIS PLAN ── */}
                                        {Array.isArray(plan.items) && plan.items.length > 0 && (
                                            <View style={s.planProductsWrap}>
                                                <View style={s.planProductsHeader}>
                                                    <Ionicons name="bag-handle" size={13} color={GOLD} />
                                                    <Text style={s.planProductsHeaderTxt}>
                                                        {plan.items.length === 1 ? 'PRODUCT IN THIS PLAN' : `PRODUCTS IN THIS PLAN (${plan.items.length})`}
                                                    </Text>
                                                </View>

                                                {plan.items.map((item, itemIdx) => (
                                                    <View key={item.id || itemIdx} style={s.productItemCard}>
                                                        <Image
                                                            source={{ uri: item.image || FALLBACK_IMAGE }}
                                                            style={s.productItemThumb}
                                                            resizeMode="cover"
                                                        />
                                                        <View style={s.productItemInfo}>
                                                            <Text style={s.productItemName} numberOfLines={2}>
                                                                {item.name}
                                                            </Text>

                                                            <View style={s.productItemMetaRow}>
                                                                {item.brand ? (
                                                                    <View style={s.brandBadge}>
                                                                        <Text style={s.brandBadgeTxt}>{item.brand}</Text>
                                                                    </View>
                                                                ) : null}
                                                                <View style={s.conditionBadge}>
                                                                    <Text style={s.conditionBadgeTxt}>{item.condition || 'Brand New'}</Text>
                                                                </View>
                                                                {item.variant ? (
                                                                    <Text style={s.variantBadgeTxt}>
                                                                        • {typeof item.variant === 'string' ? item.variant : item.variant.title || item.variant.name}
                                                                    </Text>
                                                                ) : null}
                                                            </View>

                                                            <View style={s.productItemPriceRow}>
                                                                <Text style={s.productItemPrice}>
                                                                    {formatCurrency(item.price)}
                                                                    <Text style={s.productItemQty}> × {item.quantity || 1}</Text>
                                                                </Text>
                                                                <Text style={s.productItemSubtotal}>
                                                                    {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                ))}

                                                {(plan.deliveryAddress || plan.deliveryCity) && (
                                                    <View style={s.planDeliveryBox}>
                                                        <Ionicons name="location-outline" size={12} color={SLATE_MUTED} />
                                                        <Text style={s.planDeliveryTxt} numberOfLines={1}>
                                                            Ship to: <Text style={{ fontWeight: '600', color: NAVY }}>{plan.recipientName || 'Customer'}</Text> • {[plan.deliveryAddress, plan.deliveryCity, plan.deliveryState].filter(Boolean).join(', ')}
                                                        </Text>
                                                    </View>
                                                )}
                                            </View>
                                        )}

                                        {/* Installment Milestone Timeline */}
                                        <View style={s.milestoneList}>
                                            {plan.schedule.map((inst, idx) => {
                                                const isPaid = inst.status === 'paid';
                                                const isCurrentTarget = nextPending && nextPending.installment_number === inst.installment_number;
                                                const dueDateObj = new Date(inst.due_date);
                                                const isOverdue = !isPaid && dueDateObj < new Date();
                                                const daysOverdue = isOverdue ? Math.ceil((new Date().getTime() - dueDateObj.getTime()) / (1000 * 60 * 60 * 24)) : 0;
                                                const formattedDate = dueDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                                                return (
                                                    <View key={inst.installment_number} style={s.milestoneItem}>
                                                        <View style={[
                                                            s.milestoneDot,
                                                            isPaid && s.milestoneDotPaid,
                                                            isOverdue ? s.milestoneDotOverdue : (isCurrentTarget && s.milestoneDotCurrent)
                                                        ]}>
                                                            {isPaid ? (
                                                                <Ionicons name="checkmark" size={11} color={WHITE} />
                                                            ) : isOverdue ? (
                                                                <Ionicons name="warning" size={11} color="#DC2626" />
                                                            ) : (
                                                                <Text style={[
                                                                    s.milestoneNum,
                                                                    isCurrentTarget && s.milestoneNumCurrent
                                                                ]}>
                                                                    {inst.installment_number}
                                                                </Text>
                                                            )}
                                                        </View>

                                                        <View style={s.milestoneDetails}>
                                                            <View style={s.milestoneRow}>
                                                                <Text style={[s.milestoneTitle, isPaid && s.milestoneTitlePaid, isOverdue && { color: '#991B1B', fontWeight: '700' }]}>
                                                                    {inst.installment_number === 1 ? 'Down Payment (Initial)' : `Installment ${inst.installment_number}`}
                                                                </Text>
                                                                <Text style={[s.milestoneAmount, isPaid && s.milestoneAmountPaid, isOverdue && { color: '#DC2626' }]}>
                                                                    {formatCurrency(inst.amount)}
                                                                </Text>
                                                            </View>
                                                            <View style={s.milestoneRow}>
                                                                <Text style={[s.milestoneDate, isOverdue && { color: '#DC2626', fontWeight: '600' }]}>
                                                                    {isPaid ? `Paid ✓` : isOverdue ? `⚠️ Overdue (${daysOverdue}d ago)` : `Due: ${formattedDate}`}
                                                                </Text>
                                                                <Text style={[
                                                                    s.milestoneStatus,
                                                                    isPaid ? s.statusPaid : isOverdue ? s.statusOverdue : isCurrentTarget ? s.statusCurrent : s.statusUpcoming
                                                                ]}>
                                                                    {isPaid ? 'COMPLETED' : isOverdue ? 'OVERDUE' : isCurrentTarget ? 'DUE NEXT' : 'UPCOMING'}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>

                                        {/* Action Bar */}
                                        {nextPending && (
                                            (() => {
                                                const nextDueObj = new Date(nextPending.due_date);
                                                const nextIsOverdue = nextDueObj < new Date();
                                                return (
                                                    <View style={s.planActionRow}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={[s.nextDuePrompt, nextIsOverdue && { color: '#DC2626', fontWeight: '700' }]}>
                                                                {nextIsOverdue ? '⚠️ Overdue Payment' : 'Next Installment'}
                                                            </Text>
                                                            <Text style={[s.nextDuePromptVal, nextIsOverdue && { color: '#DC2626' }]}>
                                                                {formatCurrency(nextPending.amount)}
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            style={[s.payInstBtn, nextIsOverdue && { backgroundColor: '#DC2626' }]}
                                                            onPress={() => handleOpenPayment(plan)}
                                                            activeOpacity={0.8}
                                                        >
                                                            <Ionicons name="card-outline" size={15} color={WHITE} />
                                                            <Text style={s.payInstBtnTxt}>{nextIsOverdue ? 'Settle Overdue' : 'Pay Now'}</Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })()
                                        )}
                                    </View>
                                );
                            })
                        )}
                    </View>
                )}

                {/* ── TAB 2: COMPLETED PLANS ── */}
                {!loading && activeTab === 'history' && (
                    <View>
                        {completedPlans.length === 0 ? (
                            <View style={s.emptyBox}>
                                <View style={s.emptyIconCircle}>
                                    <Ionicons name="checkmark-done-circle-outline" size={32} color={EMERALD} />
                                </View>
                                <Text style={s.emptyTitle}>No Completed Plans Yet</Text>
                                <Text style={s.emptySub}>
                                    When you finish paying all installments on a Pay Small Small order, it will appear here as fully settled.
                                </Text>
                            </View>
                        ) : (
                            completedPlans.map((plan) => (
                                <View key={plan.id} style={[s.planCard, s.planCardCompleted]}>
                                    <View style={s.planCardTop}>
                                        <View>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={s.planOrderNum}>ORDER #{plan.orderNumber}</Text>
                                                <View style={s.settledBadge}>
                                                    <Ionicons name="checkmark-circle" size={11} color={EMERALD} />
                                                    <Text style={s.settledBadgeTxt}>FULLY SETTLED</Text>
                                                </View>
                                            </View>
                                            <Text style={s.planDate}>
                                                Total settled: {formatCurrency(plan.totalAmount)}
                                            </Text>
                                        </View>
                                        <Ionicons name="shield-checkmark" size={24} color={EMERALD} />
                                    </View>

                                    {/* Products in this Settled Plan */}
                                    {Array.isArray(plan.items) && plan.items.length > 0 && (
                                        <View style={[s.planProductsWrap, { marginTop: 10 }]}>
                                            {plan.items.map((item, itemIdx) => (
                                                <View key={item.id || itemIdx} style={s.productItemCard}>
                                                    <Image
                                                        source={{ uri: item.image || FALLBACK_IMAGE }}
                                                        style={s.productItemThumb}
                                                        resizeMode="cover"
                                                    />
                                                    <View style={s.productItemInfo}>
                                                        <Text style={s.productItemName} numberOfLines={2}>
                                                            {item.name}
                                                        </Text>
                                                        <View style={s.productItemPriceRow}>
                                                            <Text style={s.productItemPrice}>
                                                                {formatCurrency(item.price)}
                                                                <Text style={s.productItemQty}> × {item.quantity || 1}</Text>
                                                            </Text>
                                                            <Text style={s.productItemSubtotal}>
                                                                {formatCurrency(Number(item.price || 0) * Number(item.quantity || 1))}
                                                            </Text>
                                                        </View>
                                                    </View>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* ── TAB 3: HOW IT WORKS & BNPL POLICIES ── */}
                {!loading && activeTab === 'info' && (
                    <View style={s.infoCard}>
                        <View style={s.infoHeader}>
                            <Ionicons name="sparkles" size={18} color={GOLD} />
                            <Text style={s.infoHeaderTitle}>How Abu Mafhal BNPL Works</Text>
                        </View>

                        <View style={s.infoStep}>
                            <View style={s.infoStepNum}>
                                <Text style={s.infoStepNumTxt}>1</Text>
                            </View>
                            <View style={s.infoStepContent}>
                                <Text style={s.infoStepHeading}>Select Pay Small Small</Text>
                                <Text style={s.infoStepDesc}>
                                    Choose your preferred installment structure at checkout: 3 Monthly installments or 4 Bi-weekly installments.
                                </Text>
                            </View>
                        </View>

                        <View style={s.infoStep}>
                            <View style={s.infoStepNum}>
                                <Text style={s.infoStepNumTxt}>2</Text>
                            </View>
                            <View style={s.infoStepContent}>
                                <Text style={s.infoStepHeading}>Pay Initial Down Payment</Text>
                                <Text style={s.infoStepDesc}>
                                    Pay just 25% or 33.3% today to immediately confirm and dispatch your order. No waiting!
                                </Text>
                            </View>
                        </View>

                        <View style={s.infoStep}>
                            <View style={s.infoStepNum}>
                                <Text style={s.infoStepNumTxt}>3</Text>
                            </View>
                            <View style={s.infoStepContent}>
                                <Text style={s.infoStepHeading}>Flexible, Zero-Interest Repayment</Text>
                                <Text style={s.infoStepDesc}>
                                    Pay the remaining balance in scheduled installments using your Mafhal Wallet or bank card. 0% interest, no hidden charges.
                                </Text>
                            </View>
                        </View>

                        <View style={s.guaranteeCallout}>
                            <Ionicons name="lock-closed" size={16} color={GOLD} />
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.guaranteeTitle}>Abu Mafhal Escrow Protection</Text>
                                <Text style={s.guaranteeSub}>
                                    All BNPL transactions are backed by buyer protection. Goods are inspected and tracked directly to your doorstep.
                                </Text>
                            </View>
                        </View>
                    </View>
                )}

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ── REPAYMENT MODAL ── */}
            <Modal
                visible={paymentModalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setPaymentModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.modalSheet}>
                        <View style={s.modalHeader}>
                            <View>
                                <Text style={s.modalTitle}>Pay Next Installment</Text>
                                <Text style={s.modalSub}>
                                    Order #{selectedPlan?.orderNumber} • Installment #{selectedPlan?.targetInstallment?.installment_number}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => setPaymentModalVisible(false)}
                                style={s.modalCloseBtn}
                            >
                                <Ionicons name="close" size={18} color={NAVY} />
                            </TouchableOpacity>
                        </View>

                        <View style={s.modalAmountBox}>
                            <Text style={s.modalAmountLabel}>INSTALLMENT DUE</Text>
                            <Text style={s.modalAmountVal}>
                                {formatCurrency(selectedPlan?.targetInstallment?.amount)}
                            </Text>
                        </View>

                        <Text style={s.methodSelectTitle}>Select Payment Method</Text>

                        {/* Option 1: Wallet */}
                        <TouchableOpacity
                            style={[
                                s.methodChoice,
                                selectedPaymentMethod === 'wallet' && s.methodChoiceActive
                            ]}
                            onPress={() => setSelectedPaymentMethod('wallet')}
                            activeOpacity={0.8}
                        >
                            <View style={s.methodIconCircle}>
                                <Ionicons name="wallet-outline" size={18} color={GOLD} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.methodChoiceName}>Abu Mafhal Wallet</Text>
                                <Text style={s.methodChoiceSub}>
                                    Available: {formatCurrency(walletBalance)}
                                    {walletBalance < Number(selectedPlan?.targetInstallment?.amount || 0) ? ' (Insufficient)' : ' (Instant Debit)'}
                                </Text>
                            </View>
                            <View style={[
                                s.methodRadio,
                                selectedPaymentMethod === 'wallet' && s.methodRadioActive
                            ]}>
                                {selectedPaymentMethod === 'wallet' && <View style={s.methodRadioDot} />}
                            </View>
                        </TouchableOpacity>

                        {/* Option 2: Paystack (Cards, Bank Transfer, USSD) */}
                        <TouchableOpacity
                            style={[
                                s.methodChoice,
                                selectedPaymentMethod === 'paystack' && s.methodChoiceActive
                            ]}
                            onPress={() => setSelectedPaymentMethod('paystack')}
                            activeOpacity={0.8}
                        >
                            <View style={[s.methodIconCircle, { backgroundColor: '#ECFDF5' }]}>
                                <Ionicons name="card-outline" size={18} color={EMERALD} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.methodChoiceName}>Paystack (Cards, Bank & USSD)</Text>
                                <Text style={s.methodChoiceSub}>ATM Debit Card, Direct Transfer, USSD</Text>
                            </View>
                            <View style={[
                                s.methodRadio,
                                selectedPaymentMethod === 'paystack' && s.methodRadioActive
                            ]}>
                                {selectedPaymentMethod === 'paystack' && <View style={s.methodRadioDot} />}
                            </View>
                        </TouchableOpacity>

                        {/* Option 3: Flutterwave (Cards & Mobile Money) */}
                        <TouchableOpacity
                            style={[
                                s.methodChoice,
                                selectedPaymentMethod === 'flutterwave' && s.methodChoiceActive
                            ]}
                            onPress={() => setSelectedPaymentMethod('flutterwave')}
                            activeOpacity={0.8}
                        >
                            <View style={[s.methodIconCircle, { backgroundColor: '#FFFBEB' }]}>
                                <Ionicons name="flash-outline" size={18} color="#D97706" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.methodChoiceName}>Flutterwave (Cards & Mobile Money)</Text>
                                <Text style={s.methodChoiceSub}>Barter, Cards & Direct Bank Transfer</Text>
                            </View>
                            <View style={[
                                s.methodRadio,
                                selectedPaymentMethod === 'flutterwave' && s.methodRadioActive
                            ]}>
                                {selectedPaymentMethod === 'flutterwave' && <View style={s.methodRadioDot} />}
                            </View>
                        </TouchableOpacity>

                        {/* Option 4: NOWPayments (Crypto - Bitcoin, USDT, ETH) */}
                        <TouchableOpacity
                            style={[
                                s.methodChoice,
                                selectedPaymentMethod === 'nowpayments' && s.methodChoiceActive
                            ]}
                            onPress={() => setSelectedPaymentMethod('nowpayments')}
                            activeOpacity={0.8}
                        >
                            <View style={[s.methodIconCircle, { backgroundColor: '#F5F3FF' }]}>
                                <Ionicons name="logo-bitcoin" size={18} color="#7C3AED" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.methodChoiceName}>NOWPayments (Crypto)</Text>
                                <Text style={s.methodChoiceSub}>USDT (TRC20/BEP20), BTC, ETH & 150+ Coins</Text>
                            </View>
                            <View style={[
                                s.methodRadio,
                                selectedPaymentMethod === 'nowpayments' && s.methodRadioActive
                            ]}>
                                {selectedPaymentMethod === 'nowpayments' && <View style={s.methodRadioDot} />}
                            </View>
                        </TouchableOpacity>

                        {/* Submit Button */}
                        <TouchableOpacity
                            style={[s.modalConfirmBtn, isSubmittingPayment && { opacity: 0.7 }]}
                            onPress={handleConfirmPayment}
                            disabled={isSubmittingPayment}
                            activeOpacity={0.8}
                        >
                            {isSubmittingPayment ? (
                                <ActivityIndicator size="small" color={WHITE} />
                            ) : (
                                <>
                                    <Ionicons name="lock-closed" size={15} color={WHITE} />
                                    <Text style={s.modalConfirmBtnTxt}>
                                        Pay {formatCurrency(selectedPlan?.targetInstallment?.amount)} Now
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── EXTERNAL GATEWAY MODAL (MOBILE WEBVIEW) ── */}
            <FlutterwaveCheckout
                visible={gatewayModalVisible}
                link={gatewayCheckoutLink}
                onAbort={() => {
                    setGatewayModalVisible(false);
                    setGatewayCheckoutLink('');
                }}
                onRedirect={async (data) => {
                    setGatewayModalVisible(false);
                    setGatewayCheckoutLink('');
                    if (selectedPlan && selectedPlan.targetInstallment) {
                        setIsVerifyingGatewayPayment(true);
                        const verifyRes = await PaymentGatewayService.verifyPayment({
                            reference: data?.reference || data?.tx_ref || activeGatewayTxRef,
                            gateway: activeGatewayName,
                            amount: Number(selectedPlan.targetInstallment.amount),
                            userId: user?.id,
                            action: 'pss_installment_payment'
                        });
                        setIsVerifyingGatewayPayment(false);

                        if (verifyRes.success) {
                            await finalizeInstallmentPayment({
                                targetPlan: selectedPlan,
                                installmentToPay: selectedPlan.targetInstallment,
                                methodUsed: activeGatewayName,
                                paymentRef: data?.reference || data?.tx_ref || activeGatewayTxRef
                            });
                        } else {
                            Alert.alert(
                                'Payment Incomplete',
                                verifyRes.error || 'Your installment payment could not be confirmed by the payment gateway.'
                            );
                        }
                    }
                }}
            />

            {/* ── VERIFYING OVERLAY ── */}
            <Modal transparent visible={isVerifyingGatewayPayment} animationType="fade">
                <View style={s.modalBackdrop}>
                    <View style={[s.modalSheet, { alignItems: 'center', paddingVertical: 32 }]}>
                        <ActivityIndicator size="large" color={GOLD} />
                        <Text style={[s.modalTitle, { marginTop: 14 }]}>Verifying Payment...</Text>
                        <Text style={[s.modalSub, { textAlign: 'center', marginTop: 4 }]}>
                            Confirming installment with {activeGatewayName}. Please wait...
                        </Text>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

const s = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    topBar: {
        height: 52,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        backgroundColor: WHITE,
        borderBottomWidth: 1,
        borderBottomColor: BORDER
    },
    topBarBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: SLATE_LIGHT,
        alignItems: 'center',
        justifyContent: 'center'
    },
    topBarCenter: {
        alignItems: 'center'
    },
    topBarTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: NAVY,
        letterSpacing: -0.2
    },
    bnplBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 1
    },
    bnplBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '700',
        color: GOLD,
        letterSpacing: 0.5
    },
    container: {
        flex: 1
    },
    contentContainer: {
        padding: 14
    },
    // KPI Executive Ledger Card
    kpiCard: {
        backgroundColor: NAVY,
        borderRadius: 14,
        padding: 16,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
        marginBottom: 14
    },
    kpiHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    kpiSmallLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: GOLD,
        letterSpacing: 0.8
    },
    kpiBalanceVal: {
        fontSize: 24,
        fontWeight: '800',
        color: WHITE,
        marginTop: 2,
        letterSpacing: -0.5
    },
    kpiOverduePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.4)',
        marginTop: 5,
        alignSelf: 'flex-start'
    },
    kpiOverduePillTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#F87171',
        letterSpacing: 0.3
    },
    // Overdue Alert Banner
    overdueAlertCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1.5,
        borderColor: '#FCA5A5',
        marginBottom: 14,
        shadowColor: '#DC2626',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3
    },
    overdueAlertTop: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 8
    },
    overdueAlertIconBox: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center'
    },
    overdueAlertTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#991B1B',
        letterSpacing: 0.5
    },
    overdueAlertSub: {
        fontSize: 12.5,
        color: '#7F1D1D',
        marginTop: 2
    },
    overdueAlertDesc: {
        fontSize: 11.5,
        color: '#B91C1C',
        lineHeight: 16,
        marginBottom: 12
    },
    overduePayBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#DC2626',
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8
    },
    overduePayBtnTxt: {
        fontSize: 12.5,
        fontWeight: '800',
        color: WHITE,
        letterSpacing: 0.3
    },
    activeBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)'
    },
    activeDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: GOLD
    },
    activeBadgeTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: GOLD
    },
    kpiDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginVertical: 12
    },
    kpiMetricsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    kpiMetricItem: {
        flex: 1
    },
    kpiMetricDivider: {
        width: 1,
        height: 36,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        marginHorizontal: 12
    },
    kpiMetricSub: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '500'
    },
    kpiMetricMain: {
        fontSize: 13.5,
        fontWeight: '700',
        color: WHITE,
        marginTop: 2
    },
    kpiMetricNotice: {
        fontSize: 10.5,
        color: GOLD,
        marginTop: 2,
        fontWeight: '600'
    },
    kpiNoticeUrgent: {
        color: '#F87171'
    },
    kpiTopUpLink: {
        fontSize: 11,
        color: GOLD,
        fontWeight: '700',
        marginTop: 2
    },
    // Tabs Row
    tabsRow: {
        flexDirection: 'row',
        backgroundColor: WHITE,
        borderRadius: 10,
        padding: 3,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: BORDER
    },
    tabItem: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 7,
        borderRadius: 7
    },
    tabItemActive: {
        backgroundColor: GOLD_LIGHT,
        borderWidth: 1,
        borderColor: GOLD_BORDER
    },
    tabTxt: {
        fontSize: 12,
        fontWeight: '600',
        color: SLATE_MUTED
    },
    tabTxtActive: {
        color: NAVY,
        fontWeight: '700'
    },
    loadingBox: {
        alignItems: 'center',
        paddingVertical: 32
    },
    loadingTxt: {
        fontSize: 12.5,
        color: SLATE_MUTED,
        marginTop: 8
    },
    // Empty Box
    emptyBox: {
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: BORDER
    },
    emptyIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: GOLD_LIGHT,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12
    },
    emptyTitle: {
        fontSize: 15,
        fontWeight: '700',
        color: NAVY,
        marginBottom: 6
    },
    emptySub: {
        fontSize: 12.5,
        color: SLATE_MUTED,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16
    },
    emptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: NAVY,
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderRadius: 8
    },
    emptyBtnTxt: {
        fontSize: 12.5,
        fontWeight: '700',
        color: WHITE
    },
    // Plan Card
    planCard: {
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: BORDER,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 2
    },
    planCardCompleted: {
        borderColor: '#A7F3D0',
        backgroundColor: '#F0FDF4'
    },
    planCardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    planOrderNum: {
        fontSize: 13,
        fontWeight: '700',
        color: NAVY
    },
    planTypePill: {
        backgroundColor: GOLD_LIGHT,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1,
        borderColor: GOLD_BORDER
    },
    planTypePillTxt: {
        fontSize: 10,
        fontWeight: '700',
        color: GOLD
    },
    planDate: {
        fontSize: 11,
        color: SLATE_MUTED,
        marginTop: 2
    },
    planTotalVal: {
        fontSize: 15,
        fontWeight: '800',
        color: NAVY
    },
    planRemainVal: {
        fontSize: 11,
        color: AMBER,
        fontWeight: '600',
        marginTop: 1
    },
    // Progress Section
    progressSection: {
        marginVertical: 12
    },
    progressTrack: {
        height: 6,
        borderRadius: 3,
        backgroundColor: SLATE_LIGHT,
        overflow: 'hidden'
    },
    progressFill: {
        height: 6,
        borderRadius: 3,
        backgroundColor: GOLD
    },
    progressLabels: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 4
    },
    progressLabelTxt: {
        fontSize: 10.5,
        color: SLATE_MUTED,
        fontWeight: '600'
    },
    // Milestone Timeline
    milestoneList: {
        borderTopWidth: 1,
        borderTopColor: BORDER,
        paddingTop: 10
    },
    milestoneItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 7
    },
    milestoneDot: {
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: SLATE_LIGHT,
        borderWidth: 1,
        borderColor: BORDER,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    milestoneDotPaid: {
        backgroundColor: EMERALD,
        borderColor: EMERALD
    },
    milestoneDotOverdue: {
        backgroundColor: '#FEF2F2',
        borderColor: '#DC2626'
    },
    milestoneDotCurrent: {
        backgroundColor: GOLD_LIGHT,
        borderColor: GOLD
    },
    milestoneNum: {
        fontSize: 10.5,
        fontWeight: '700',
        color: SLATE_MUTED
    },
    milestoneNumCurrent: {
        color: GOLD
    },
    milestoneDetails: {
        flex: 1
    },
    milestoneRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    milestoneTitle: {
        fontSize: 12,
        fontWeight: '600',
        color: NAVY
    },
    milestoneTitlePaid: {
        color: SLATE_MUTED
    },
    milestoneAmount: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY
    },
    milestoneAmountPaid: {
        color: SLATE_MUTED,
        textDecorationLine: 'line-through'
    },
    milestoneDate: {
        fontSize: 10.5,
        color: SLATE_MUTED,
        marginTop: 1
    },
    milestoneStatus: {
        fontSize: 9.5,
        fontWeight: '700',
        marginTop: 1
    },
    statusPaid: {
        color: EMERALD
    },
    statusOverdue: {
        color: '#DC2626',
        fontWeight: '800'
    },
    statusCurrent: {
        color: GOLD
    },
    statusUpcoming: {
        color: SLATE_MUTED
    },
    // Action Row
    planActionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: BORDER
    },
    nextDuePrompt: {
        fontSize: 10.5,
        color: SLATE_MUTED,
        fontWeight: '500'
    },
    nextDuePromptVal: {
        fontSize: 14,
        fontWeight: '800',
        color: NAVY
    },
    payInstBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: NAVY,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 8
    },
    payInstBtnTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: WHITE
    },
    // Settled Badge
    settledBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4
    },
    settledBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '700',
        color: EMERALD
    },
    // Product Items in Plan
    planProductsWrap: {
        backgroundColor: SLATE_LIGHT,
        borderRadius: 10,
        padding: 10,
        marginVertical: 10,
        borderWidth: 1,
        borderColor: '#EDF2F7'
    },
    planProductsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 8
    },
    planProductsHeaderTxt: {
        fontSize: 10.5,
        fontWeight: '700',
        color: SLATE_MUTED,
        letterSpacing: 0.5
    },
    productItemCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: WHITE,
        borderRadius: 8,
        padding: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: BORDER
    },
    productItemThumb: {
        width: 52,
        height: 52,
        borderRadius: 6,
        backgroundColor: SLATE_LIGHT,
        marginRight: 10
    },
    productItemInfo: {
        flex: 1
    },
    productItemName: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY,
        lineHeight: 16
    },
    productItemMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 5,
        marginTop: 3,
        marginBottom: 3
    },
    brandBadge: {
        backgroundColor: '#EEF2F6',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    brandBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '600',
        color: SLATE_DARK
    },
    conditionBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4
    },
    conditionBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '600',
        color: EMERALD
    },
    variantBadgeTxt: {
        fontSize: 10,
        color: SLATE_MUTED
    },
    productItemPriceRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 2
    },
    productItemPrice: {
        fontSize: 11.5,
        fontWeight: '600',
        color: SLATE_MUTED
    },
    productItemQty: {
        fontSize: 11,
        color: SLATE_MUTED
    },
    productItemSubtotal: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY
    },
    planDeliveryBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: WHITE,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 6,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    planDeliveryTxt: {
        fontSize: 10.5,
        color: SLATE_MUTED,
        flex: 1
    },
    // Info Tab
    infoCard: {
        backgroundColor: WHITE,
        borderRadius: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: BORDER
    },
    infoHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16
    },
    infoHeaderTitle: {
        fontSize: 14,
        fontWeight: '700',
        color: NAVY
    },
    infoStep: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    infoStepNum: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: GOLD_LIGHT,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        marginTop: 1
    },
    infoStepNumTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: GOLD
    },
    infoStepContent: {
        flex: 1
    },
    infoStepHeading: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY,
        marginBottom: 2
    },
    infoStepDesc: {
        fontSize: 11.5,
        color: SLATE_MUTED,
        lineHeight: 16
    },
    guaranteeCallout: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: GOLD_LIGHT,
        borderRadius: 10,
        padding: 12,
        borderWidth: 1,
        borderColor: GOLD_BORDER,
        marginTop: 6
    },
    guaranteeTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY
    },
    guaranteeSub: {
        fontSize: 11,
        color: SLATE_DARK,
        lineHeight: 15,
        marginTop: 2
    },
    // Modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end'
    },
    modalSheet: {
        backgroundColor: WHITE,
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        padding: 18,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: NAVY
    },
    modalSub: {
        fontSize: 11.5,
        color: SLATE_MUTED,
        marginTop: 1
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: SLATE_LIGHT,
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalAmountBox: {
        backgroundColor: GOLD_LIGHT,
        borderRadius: 10,
        padding: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: GOLD_BORDER,
        marginBottom: 14
    },
    modalAmountLabel: {
        fontSize: 10,
        fontWeight: '700',
        color: GOLD,
        letterSpacing: 0.5
    },
    modalAmountVal: {
        fontSize: 22,
        fontWeight: '800',
        color: NAVY,
        marginTop: 2
    },
    methodSelectTitle: {
        fontSize: 12,
        fontWeight: '700',
        color: NAVY,
        marginBottom: 8
    },
    methodChoice: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 11,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BORDER,
        backgroundColor: WHITE,
        marginBottom: 8
    },
    methodChoiceActive: {
        borderColor: GOLD,
        backgroundColor: GOLD_LIGHT
    },
    methodIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: SLATE_LIGHT,
        alignItems: 'center',
        justifyContent: 'center'
    },
    methodChoiceName: {
        fontSize: 12.5,
        fontWeight: '700',
        color: NAVY
    },
    methodChoiceSub: {
        fontSize: 11,
        color: SLATE_MUTED,
        marginTop: 1
    },
    methodRadio: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: BORDER,
        alignItems: 'center',
        justifyContent: 'center'
    },
    methodRadioActive: {
        borderColor: GOLD
    },
    methodRadioDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: GOLD
    },
    modalConfirmBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: NAVY,
        paddingVertical: 12,
        borderRadius: 10,
        marginTop: 10
    },
    modalConfirmBtnTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: WHITE
    }
});

export default PaySmallSmallPage;
