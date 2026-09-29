/**
 * WalletPage.js — Abu Mafhal Marketplace
 * Premium Wallet Screen — Clean Rewrite
 * Tables used: profiles (balance, mafhal_coins), transactions
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, RefreshControl, StyleSheet,
    Modal, Platform, Image, Dimensions, Animated
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { WebView } from 'react-native-webview';
import { useAppSettings } from '../context/AppSettingsContext';
import { PaymentGatewayService } from '../services/paymentGatewayService';
import { whatsappService } from '../services/whatsappService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');
const USD_RATE = 1500;

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
    new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' })
        .format(n || 0)
        .replace('NGN', '₦');

const cleanNum = (v) => {
    const n = Number(String(v || '').replace(/[^0-9.]/g, ''));
    return isNaN(n) ? 0 : Math.round(n);
};

const copyText = (text, label = 'Info') => {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
    } catch (_) {}
    Alert.alert('Copied! 📋', `${label} copied to clipboard.`);
};

// ─── Constants ────────────────────────────────────────────────────────────────
const CARD_THEMES = {
    midnight: { gradient: ['#0B1120', '#1E293B', '#0F172A'], accent: '#D9A73A' },
    emerald:  { gradient: ['#022C22', '#065F46', '#047857'], accent: '#34D399' },
    sapphire: { gradient: ['#0F172A', '#1D4ED8', '#1E1B4B'], accent: '#93C5FD' },
    ruby:     { gradient: ['#450A0A', '#9F1239', '#881337'], accent: '#FCA5A5' },
    gold:     { gradient: ['#451A03', '#B45309', '#78350F'], accent: '#FCD34D' },
};

const GATEWAYS = [
    {
        id: 'paystack',
        name: 'Paystack Checkout',
        subtitle: 'Debit/Credit Cards · USSD · Bank Transfer · Apple Pay',
        badge: 'AUTO-VERIFY',
        badgeColor: '#0284C7',
        badgeBg: '#F0F9FF',
        badgeBorder: '#BAE6FD',
        color: '#0284C7',
        speed: 'Instant (10-30s)',
        logo: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzFzmpCa0Tav9NttiYF10t9wftJPQ0XYPBkA&s' },
        channels: ['Debit Card', 'USSD', 'Bank', 'Apple Pay']
    },
    {
        id: 'flutterwave',
        name: 'Flutterwave Africa',
        subtitle: 'Cards · Direct Bank · Mobile Money · Pan-Africa',
        badge: 'PAN-AFRICA',
        badgeColor: '#D97706',
        badgeBg: '#FFFBEB',
        badgeBorder: '#FDE68A',
        color: '#D97706',
        speed: 'Instant (15-45s)',
        logo: { uri: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-W6MLvD_saE20EDSZzVPspKqcKxZ89rW8uw&s' },
        channels: ['Mastercard', 'Visa', 'Mobile Money', 'Bank']
    },
    {
        id: 'nowpayments',
        name: 'NOWPayments Crypto',
        subtitle: 'USDT · BTC · ETH · SOL · BNB · 150+ Cryptos',
        badge: 'WEB3 CRYPTO',
        badgeColor: '#2563EB',
        badgeBg: '#EFF6FF',
        badgeBorder: '#BFDBFE',
        color: '#2563EB',
        isCrypto: true,
        speed: '1-3 Confirmations',
        logo: { uri: 'https://cdn.brandfetch.io/id_rL36n5a/w/400/h/400/logo.png' },
        channels: ['USDT (TRC20)', 'Bitcoin', 'Ethereum', 'Solana', 'BNB']
    },
    {
        id: 'bank_transfer',
        name: 'Dedicated Bank Account',
        subtitle: 'Permanent Personal NUBAN · Paystack / Wema Verified',
        badge: '0% FEE · NUBAN',
        badgeColor: '#059669',
        badgeBg: '#ECFDF5',
        badgeBorder: '#A7F3D0',
        color: '#059669',
        speed: 'Auto-Credit in 30-60s',
        logo: { uri: 'https://cdn-icons-png.flaticon.com/512/2830/2830284.png' },
        channels: ['OPay', 'Kuda', 'PalmPay', 'GTBank', 'Zenith', 'Access']
    },
];

const NIGERIAN_BANKS = [
    'Access Bank', 'GTBank', 'Zenith Bank', 'First Bank', 'UBA',
    'Opay', 'PalmPay', 'Kuda Bank', 'Moniepoint MFB', 'Fidelity Bank',
    'Stanbic IBTC', 'Union Bank', 'Sterling Bank', 'Wema Bank (ALAT)'
];

// ─── Sub-components ───────────────────────────────────────────────────────────
const Row = ({ children, style }) => (
    <View style={[{ flexDirection: 'row', alignItems: 'center' }, style]}>{children}</View>
);

const Pill = ({ label, color, bg }) => (
    <View style={{ backgroundColor: bg || `${color}20`, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 }}>
        <Text style={{ fontSize: 9, fontWeight: '800', color, letterSpacing: 0.5 }}>{label}</Text>
    </View>
);

const ActionBtn = ({ icon, label, onPress, color = '#0F172A', disabled }) => (
    <TouchableOpacity
        onPress={onPress}
        disabled={disabled}
        style={[S.actionBtn, disabled && { opacity: 0.45 }]}
        activeOpacity={0.7}
    >
        <View style={[S.actionIcon, { backgroundColor: `${color}18` }]}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={[S.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
);

const TxIcon = ({ type }) => {
    const map = {
        topup: { icon: 'arrow-down-circle', color: '#10B981' },
        credit: { icon: 'arrow-down-circle', color: '#10B981' },
        deposit: { icon: 'arrow-down-circle', color: '#10B981' },
        transfer_in: { icon: 'swap-horizontal', color: '#3B82F6' },
        debit: { icon: 'arrow-up-circle', color: '#EF4444' },
        withdrawal: { icon: 'arrow-up-circle', color: '#EF4444' },
        wallet_payment: { icon: 'cart', color: '#F59E0B' },
        wallet_purchase: { icon: 'cart', color: '#F59E0B' },
    };
    const { icon, color } = map[type] || { icon: 'ellipse-outline', color: '#64748B' };
    return (
        <View style={{ width: 38, height: 38, borderRadius: 12, backgroundColor: `${color}18`, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
    );
};

const ModernInput = ({
    icon,
    iconColor = '#2563EB',
    iconBg = '#EFF6FF',
    label,
    rightLabel,
    rightAction,
    value,
    onChangeText,
    placeholder,
    keyboardType = 'default',
    maxLength,
    style,
    inputStyle,
    autoCapitalize = 'none',
    helperText
}) => {
    const [focused, setFocused] = useState(false);
    return (
        <View style={[{ marginBottom: 12 }, style]}>
            {(label || rightLabel) && (
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    {label && <Text style={S.inputLabel}>{label}</Text>}
                    {rightLabel && (
                        rightAction ? (
                            <TouchableOpacity onPress={rightAction} activeOpacity={0.7}>
                                <Text style={{ fontSize: 11, color: '#0284C7', fontWeight: '800' }}>{rightLabel}</Text>
                            </TouchableOpacity>
                        ) : (
                            <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '700' }}>{rightLabel}</Text>
                        )
                    )}
                </View>
            )}
            <View style={[
                S.modernInputBox,
                focused && S.modernInputBoxFocused
            ]}>
                {icon && (
                    <View style={[S.inputIconBadge, { backgroundColor: iconBg }]}>
                        <Ionicons name={icon} size={18} color={iconColor} />
                    </View>
                )}
                <TextInput
                    style={[S.modernTextInput, inputStyle, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                    value={value}
                    onChangeText={onChangeText}
                    placeholder={placeholder}
                    placeholderTextColor="#94A3B8"
                    keyboardType={keyboardType}
                    maxLength={maxLength}
                    autoCapitalize={autoCapitalize}
                    onFocus={() => setFocused(true)}
                    onBlur={() => setFocused(false)}
                />
            </View>
            {helperText && <Text style={{ fontSize: 11, color: '#64748B', marginTop: 4, marginLeft: 2 }}>{helperText}</Text>}
        </View>
    );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const WalletPageInner = ({ user, onBack }) => {
    const { settings } = useAppSettings();

    // ── Core state ──
    const [wallet, setWallet]             = useState({ balance: 0, points: 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading]           = useState(true);
    const [refreshing, setRefreshing]     = useState(false);
    const [notLoggedIn, setNotLoggedIn]   = useState(false);

    // ── Card display ──
    const [cardTheme, setCardTheme]         = useState('midnight');
    const [hideBalance, setHideBalance]     = useState(false);
    const [balCurrency, setBalCurrency]     = useState('NGN'); // 'NGN' | 'USD' | 'AMC'

    // ── Top-up modal ──
    const [showTopUp, setShowTopUp]         = useState(false);
    const [gateway, setGateway]             = useState('paystack');
    const [amountNgn, setAmountNgn]         = useState('');
    const [amountUsd, setAmountUsd]         = useState('');
    const [topUpPending, setTopUpPending]   = useState(false);

    // ── Virtual account & Paystack BVN verification ──
    const [virtualAcc, setVirtualAcc]       = useState(null);
    const [vaLoading, setVaLoading]         = useState(false);
    const [vaError, setVaError]             = useState(null);
    const [bvnInput, setBvnInput]           = useState('');
    const [bvnLegalName, setBvnLegalName]   = useState('');
    const [bvnPhone, setBvnPhone]           = useState('');
    const [bvnVerifying, setBvnVerifying]   = useState(false);
    const [showBvnForm, setShowBvnForm]     = useState(false);

    // ── WebView checkout ──
    const [showWebView, setShowWebView]     = useState(false);
    const [checkoutUrl, setCheckoutUrl]     = useState(null);
    const [activeRef, setActiveRef]         = useState(null);
    const [activeGwName, setActiveGwName]   = useState('Paystack');
    const [pendingAmt, setPendingAmt]       = useState(0);

    // ── Success modal ──
    const [showSuccess, setShowSuccess]     = useState(false);
    const [successDetails, setSuccessDetails] = useState(null);

    // ── P2P Transfer ──
    const [showTransfer, setShowTransfer]   = useState(false);
    const [recipient, setRecipient]         = useState('');
    const [transferAmt, setTransferAmt]     = useState('');
    const [transferNote, setTransferNote]   = useState('');
    const [transferPending, setTransferPending] = useState(false);

    // ── Bank sync ──
    const [syncing, setSyncing]             = useState(false);

    // ── Escrow ──
    const [showEscrow, setShowEscrow]       = useState(false);

    // ── Tx filters ──
    const [txFilter, setTxFilter]           = useState('all');
    const [txSearch, setTxSearch]           = useState('');
    const [selectedTx, setSelectedTx]       = useState(null);

    // ── Savings pots ──
    const [pots, setPots]                   = useState([]);
    const [showCreatePot, setShowCreatePot] = useState(false);
    const [potName, setPotName]             = useState('');
    const [potTarget, setPotTarget]         = useState('');
    const [potColor, setPotColor]           = useState('#3B82F6');

    // ── Budget ──
    const [monthlyLimit, setMonthlyLimit]   = useState(0);
    const [showBudget, setShowBudget]       = useState(false);
    const [budgetInput, setBudgetInput]     = useState('');

    // ── Voucher ──
    const [showVoucher, setShowVoucher]     = useState(false);
    const [voucherCode, setVoucherCode]     = useState('');
    const [voucherPending, setVoucherPending] = useState(false);

    // ── Animation ──
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(fadeAnim, { toValue: 1, duration: 500, useNativeDriver: true }).start();
    }, []);

    // ── Resolve user ID ──
    const resolveUserId = useCallback(async () => {
        if (user?.id) return user.id;
        try {
            const { data } = await supabase.auth.getUser();
            if (data?.user?.id) return data.user.id;
        } catch (_) {}
        try {
            const raw = await AsyncStorage.getItem('@abumafhal_user_v1');
            if (raw) {
                const p = JSON.parse(raw);
                if (p?.id) return p.id;
            }
        } catch (_) {}
        return null;
    }, [user?.id]);

    // ── Fetch wallet data ──────────────────────────────────────────────────────
    const fetchWallet = useCallback(async () => {
        try {
            const uid = await resolveUserId();
            if (!uid) { setNotLoggedIn(true); setLoading(false); return; }
            setNotLoggedIn(false);

            // Load cache first for instant render (skip if cached with old mockup 1600)
            try {
                const cached = await AsyncStorage.getItem(`@amf_wallet_${uid}`);
                if (cached) {
                    const c = JSON.parse(cached);
                    if (c.wallet && c.wallet.balance !== 1600 && c.wallet.balance !== 800) {
                        setWallet(c.wallet);
                    }
                    if (c.transactions?.length) setTransactions(c.transactions);
                    setLoading(false);
                }
            } catch (_) {}

            // Parallel fetch
            const [pRes, txRes] = await Promise.allSettled([
                supabase.from('profiles')
                    .select('id, balance, mafhal_coins, email, full_name, phone, custom_id')
                    .eq('id', uid).maybeSingle(),
                supabase.from('transactions')
                    .select('*').eq('user_id', uid)
                    .order('created_at', { ascending: false }).limit(60)
            ]);

            const pData = pRes.status === 'fulfilled' ? pRes.value?.data : null;
            const txData = txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data)
                ? txRes.value.data : [];

            // Authoritative true balance from Supabase database (no mockup inflation)
            const dbBal = Number(pData?.balance ?? 0);
            const coins = Number(pData?.mafhal_coins ?? 0);

            const newWallet = { balance: dbBal, points: coins };
            setWallet(newWallet);
            setTransactions(txData);

            // Check if profile has permanent dedicated virtual account saved
            if (pData?.custom_id) {
                try {
                    const parsed = typeof pData.custom_id === 'string' ? JSON.parse(pData.custom_id) : pData.custom_id;
                    if (parsed?.account_number && !parsed.account_number.startsWith('980')) {
                        setVirtualAcc(parsed);
                        setShowBvnForm(false);
                        AsyncStorage.setItem(`@amf_va_${uid}`, JSON.stringify(parsed)).catch(() => {});
                    }
                } catch (_) {}
            }

            // Cache clean wallet state
            AsyncStorage.setItem(`@amf_wallet_${uid}`, JSON.stringify({
                wallet: newWallet, transactions: txData, at: Date.now()
            })).catch(() => {});

        } catch (e) {
            console.error('[Wallet] fetchWallet:', e);
        } finally {
            setLoading(false);
        }
    }, [resolveUserId, user]);

    useEffect(() => {
        fetchWallet();

        // Load savings pots
        const loadPots = async () => {
            const uid = await resolveUserId();
            if (!uid) return;
            try {
                const raw = await AsyncStorage.getItem(`@amf_pots_${uid}`);
                if (raw) {
                    setPots(JSON.parse(raw));
                } else {
                    setPots([]);
                }
            } catch (_) {}

            try {
                const lim = await AsyncStorage.getItem(`@amf_limit_${uid}`);
                if (lim) setMonthlyLimit(parseInt(lim) || 0);
            } catch (_) {}
        };
        loadPots();

        // Web: Check return payment after redirect
        if (Platform.OS === 'web' && typeof window !== 'undefined') {
            const checkReturn = async () => {
                try {
                    const sp = new URLSearchParams(window.location.search);
                    const ref = sp.get('reference') || sp.get('trxref') || sp.get('tx_ref');
                    const status = sp.get('status');
                    if (ref || status === 'successful') {
                        const raw = window.localStorage.getItem('@amf_pending_topup')
                            || await AsyncStorage.getItem('@amf_pending_topup').catch(() => null);
                        if (raw) {
                            const p = JSON.parse(raw);
                            if (Date.now() - (p.timestamp || 0) < 4 * 3600 * 1000) {
                                window.history.replaceState({}, '', window.location.origin + window.location.pathname);
                                window.localStorage.removeItem('@amf_pending_topup');
                                AsyncStorage.removeItem('@amf_pending_topup').catch(() => {});
                                await creditWallet(p.amount, ref || p.reference, p.gateway, p.usdAmount);
                            }
                        }
                    }
                } catch (_) {}
            };
            checkReturn();
        }
    }, [user?.id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        const uid = await resolveUserId();
        if (uid) await AsyncStorage.removeItem(`@amf_wallet_${uid}`).catch(() => {});
        await fetchWallet();
        setRefreshing(false);
    }, [fetchWallet, resolveUserId]);

    // ── Load virtual account ───────────────────────────────────────────────────
    // Strictly read-only: Only loads if user ALREADY has a verified account.
    // Never calls gateway to auto-generate without user providing BVN first!
    const loadVirtualAccount = useCallback(async () => {
        const uid = await resolveUserId();
        if (!uid) return;

        // 1. Check local device storage
        try {
            const cacheKey = `@amf_va_${uid}`;
            const cached = await AsyncStorage.getItem(cacheKey);
            if (cached) {
                const p = JSON.parse(cached);
                if (p?.account_number && !p.account_number.startsWith('980')) {
                    setVirtualAcc(p);
                    setShowBvnForm(false);
                    return;
                }
            }
        } catch (_) {}

        // 2. Check Supabase profile custom_id
        setVaLoading(true); setVaError(null);
        try {
            const { data: p } = await supabase.from('profiles').select('custom_id').eq('id', uid).maybeSingle();
            if (p?.custom_id) {
                const parsed = typeof p.custom_id === 'string' ? JSON.parse(p.custom_id) : p.custom_id;
                if (parsed?.account_number && !parsed.account_number.startsWith('980')) {
                    setVirtualAcc(parsed);
                    setShowBvnForm(false);
                    AsyncStorage.setItem(`@amf_va_${uid}`, JSON.stringify(parsed)).catch(() => {});
                    return;
                }
            }
        } catch (e) {
            console.log('[Wallet] loadVirtualAccount check notice:', e?.message);
        } finally {
            setVaLoading(false);
        }
    }, [resolveUserId]);

    useEffect(() => {
        if ((user?.id || user?.email) && !virtualAcc) {
            loadVirtualAccount();
        }
    }, [user?.id, user?.email, virtualAcc, loadVirtualAccount]);

    // ── Credit wallet (post-payment) ───────────────────────────────────────────
    const creditWallet = useCallback(async (amount, reference, gwName, usdAmt = null) => {
        setTopUpPending(true);
        try {
            const uid = await resolveUserId();
            if (!uid) return;

            const newBal = wallet.balance + amount;
            await supabase.from('profiles').update({ balance: newBal }).eq('id', uid);
            await supabase.from('transactions').insert({
                user_id: uid, type: 'topup', amount, status: 'completed',
                reference, description: usdAmt
                    ? `Wallet Recharge via ${gwName} ($${usdAmt} USD • Ref: ${reference})`
                    : `Wallet Recharge via ${gwName} (Ref: ${reference})`
            });

            setWallet(p => ({ ...p, balance: newBal }));
            setSuccessDetails({ amount, reference, gateway: gwName, usdAmount: usdAmt });
            setShowSuccess(true);

            const phone = user?.phone || user?.user_metadata?.phone_number;
            if (phone) {
                whatsappService.sendDirect(phone,
                    `Your Abu Mafhal wallet was recharged with ${fmt(amount)}. Thank you! 🎉`, uid
                ).catch(() => {});
            }
            fetchWallet();
        } catch (e) {
            Alert.alert('Notice', 'Payment received. Refresh wallet to see updated balance.');
        } finally {
            setTopUpPending(false);
        }
    }, [wallet.balance, resolveUserId, fetchWallet, user]);

    // ── Paystack BVN Verification & Dedicated Account Generation ─────────────
    const handleVerifyBvnAndGenerateAccount = async () => {
        const cleanBvn = String(bvnInput || '').trim().replace(/[^0-9]/g, '');
        if (cleanBvn.length !== 11) {
            Alert.alert('Invalid BVN', 'Please enter your 11-digit Bank Verification Number.');
            return;
        }
        const nameToUse = (bvnLegalName.trim() || [user?.user_metadata?.first_name, user?.user_metadata?.last_name].filter(Boolean).join(' ') || user?.user_metadata?.full_name || '').trim();
        if (!nameToUse) {
            Alert.alert('Legal Name Required', 'Please enter your full legal name as registered on your BVN.');
            return;
        }

        setBvnVerifying(true);
        setVaError(null);
        try {
            const uid = await resolveUserId();
            const email = user?.email || `wallet_${String(uid || 'usr').substring(0, 6)}@abumafhal.com`;
            const phone = bvnPhone.trim() || user?.phone || user?.user_metadata?.phone_number || '';

            const res = await PaymentGatewayService.getConstantVirtualAccount({
                userId: uid,
                email,
                name: nameToUse,
                phone,
                bvn: cleanBvn,
                forceRefresh: true
            });

            if (res?.ok && res?.data?.success && res?.data?.data?.account_number) {
                const va = res.data.data;
                setVirtualAcc(va);
                setShowBvnForm(false);
                if (uid) {
                    AsyncStorage.setItem(`@amf_va_${uid}`, JSON.stringify(va)).catch(() => {});
                    supabase.from('profiles').update({ custom_id: JSON.stringify(va) }).eq('id', uid).catch(() => {});
                }
                Alert.alert('An Kafa Asusunka! 🎉', `An kafa asusunka na din-din-din a ${va.bank_name}!\n\nLambar Asusu: ${va.account_number}\nSunan Asusu: ${va.account_name}\n\nKowanne kudi da ka tura wannan asusun zai shiga wallet dinka nan take.`);
            } else {
                const errMsg = res?.data?.error || res?.error || 'Verification failed. Please check your BVN and legal name.';
                setVaError(errMsg);
                Alert.alert('Verification Notice', errMsg);
            }
        } catch (err) {
            setVaError(err?.message || 'Error communicating with verification service');
            Alert.alert('Error', err?.message || 'Verification could not be completed.');
        } finally {
            setBvnVerifying(false);
        }
    };
    const handleVerifyBvn = handleVerifyBvnAndGenerateAccount;

    // ── Handle Top-Up ──────────────────────────────────────────────────────────
    const handleTopUp = async () => {
        // Bank transfer: copy account details or open BVN form
        if (gateway === 'bank_transfer') {
            if (virtualAcc?.account_number && !virtualAcc.account_number.startsWith('980')) {
                const details = `Bank: ${virtualAcc.bank_name}\nAccount: ${virtualAcc.account_number}\nName: ${virtualAcc.account_name}`;
                copyText(details, 'Bank Details');
                Alert.alert('Transfer Details Copied 📋', `${details}\n\nTransfer from any Nigerian bank (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Your wallet credits automatically in 30–60 seconds.`);
            } else {
                setShowBvnForm(true);
            }
            return;
        }

        let ngnAmt = 0;
        if (gateway === 'nowpayments') {
            const usd = parseFloat(String(amountUsd || '').replace(/[^0-9.]/g, ''));
            if (isNaN(usd) || usd < 2) { Alert.alert('Enter Amount', 'Minimum is $2.00 USD'); return; }
            ngnAmt = Math.round(usd * USD_RATE);
        } else {
            ngnAmt = cleanNum(amountNgn);
            if (ngnAmt < 100) { Alert.alert('Enter Amount', 'Minimum top-up is ₦100'); return; }
        }

        setTopUpPending(true);
        try {
            const fallbackEmail = user?.email || `wallet_${user?.id?.substring(0, 6) || Date.now()}@abumafhal.com`;
            const ref = `WLT-${gateway.slice(0, 3).toUpperCase()}-${Date.now()}`;
            setPendingAmt(ngnAmt); setActiveRef(ref);
            const gwLabel = gateway === 'nowpayments' ? 'NOWPayments (Crypto)'
                : gateway === 'flutterwave' ? 'Flutterwave' : 'Paystack';
            setActiveGwName(gwLabel);

            // Persist for redirect recovery
            const pending = { reference: ref, amount: ngnAmt, usdAmount: gateway === 'nowpayments' ? amountUsd : null, gateway: gwLabel, timestamp: Date.now() };
            if (typeof window !== 'undefined' && window.localStorage) window.localStorage.setItem('@amf_pending_topup', JSON.stringify(pending));
            await AsyncStorage.setItem('@amf_pending_topup', JSON.stringify(pending)).catch(() => {});

            let res;
            if (gateway === 'nowpayments') {
                res = await PaymentGatewayService.initiateNowPayments({
                    amount: parseFloat(amountUsd), currency: 'usd',
                    email: fallbackEmail, reference: ref,
                    metadata: { action: 'wallet_topup', user_id: user?.id, credited_ngn: ngnAmt }
                });
            } else if (gateway === 'flutterwave') {
                res = await PaymentGatewayService.initiateFlutterwave({
                    amount: ngnAmt, email: fallbackEmail, reference: ref,
                    name: user?.user_metadata?.full_name || 'Mafhal Member',
                    callback_url: Platform.OS === 'web' ? window.location.href : 'https://standard.paystack.co/close',
                    metadata: { action: 'wallet_topup', user_id: user?.id }
                });
            } else {
                res = await PaymentGatewayService.initiatePaystack({
                    amount: ngnAmt, email: fallbackEmail, reference: ref,
                    callback_url: Platform.OS === 'web' ? window.location.href : 'https://standard.paystack.co/close'
                });
            }

            // Inline popup (Paystack web)
            if (res?.type === 'inline_web' && typeof res?.openInline === 'function') {
                setTopUpPending(false); setShowTopUp(false);
                res.openInline(
                    async (d) => {
                        if (typeof window !== 'undefined') window.localStorage.removeItem('@amf_pending_topup');
                        await creditWallet(ngnAmt, d?.reference || ref, 'Paystack');
                    },
                    () => {}
                );
                return;
            }

            if (!res?.ok && !res?.success && !res?.data?.success && !res?.checkoutUrl && !res?.data?.authorization_url) {
                throw new Error(res?.error || res?.data?.error || 'Could not initialize gateway');
            }

            const link = res?.checkoutUrl || res?.data?.authorization_url || res?.data?.invoice_url;
            if (!link) throw new Error('Gateway did not return a payment link.');

            setCheckoutUrl(link); setShowTopUp(false);
            if (Platform.OS === 'web') {
                setTimeout(() => { window.location.href = link; }, 600);
            } else {
                setShowWebView(true);
            }
        } catch (e) {
            Alert.alert('Payment Error', e.message || 'Could not start payment. Try another gateway.');
        } finally {
            setTopUpPending(false);
        }
    };

    // ── Handle manual bank sync ────────────────────────────────────────────────
    const handleBankSync = async () => {
        setSyncing(true);
        try {
            const uid = await resolveUserId();
            const sync = await PaymentGatewayService.syncFlutterwaveDeposits({
                userId: uid, email: user?.email, phone: user?.phone || user?.user_metadata?.phone_number
            });
            if (sync?.success && sync?.totalNewAmount > 0) {
                const newBal = wallet.balance + sync.totalNewAmount;
                await supabase.from('profiles').update({ balance: newBal }).eq('id', uid);
                const ref = sync.uncreditedTxs?.[0]?.flw_ref || `FLW-${Date.now()}`;
                await supabase.from('transactions').insert({
                    user_id: uid, type: 'topup', amount: sync.totalNewAmount,
                    status: 'completed', reference: ref,
                    description: `Bank Transfer Deposit via Flutterwave MFB`
                });
                setWallet(p => ({ ...p, balance: newBal }));
                setSuccessDetails({ amount: sync.totalNewAmount, reference: ref, gateway: 'Flutterwave MFB' });
                setShowSuccess(true);
                fetchWallet();
            } else {
                const { data: p } = await supabase.from('profiles').select('balance').eq('id', uid).maybeSingle();
                const dbBal = Number(p?.balance ?? wallet.balance);
                if (dbBal !== wallet.balance) {
                    setWallet(prev => ({ ...prev, balance: dbBal }));
                    Alert.alert('Balance Synced ✅', `Your wallet: ${fmt(dbBal)}`);
                } else {
                    Alert.alert('No New Deposits', 'No uncredited bank transfers found. Bank transfers reflect in 30–90s. Try again shortly.');
                }
            }
        } catch (e) {
            Alert.alert('Sync Error', 'Could not check bank deposits. Check internet connection.');
        } finally {
            setSyncing(false);
        }
    };

    // ── P2P Transfer ───────────────────────────────────────────────────────────
    const handleP2P = async () => {
        const amt = parseInt(transferAmt);
        if (isNaN(amt) || amt < 100) { Alert.alert('Invalid', 'Minimum transfer is ₦100'); return; }
        if (amt > wallet.balance) { Alert.alert('Insufficient Balance', `You have ${fmt(wallet.balance)}`); return; }
        if (!recipient.trim()) { Alert.alert('Recipient Required', 'Enter username, phone or email'); return; }

        setTransferPending(true);
        try {
            const uid = await resolveUserId();
            const newBal = wallet.balance - amt;

            // Debit sender
            const { error: de } = await supabase.from('profiles').update({ balance: newBal }).eq('id', uid);
            if (de) throw de;

            // Find & credit recipient
            const target = recipient.trim().toLowerCase();
            const { data: matches } = await supabase.from('profiles')
                .select('id, full_name, email, phone, balance')
                .or(`email.ilike.%${target}%,phone.ilike.%${target}%,username.ilike.%${target}%`);

            const recip = matches?.[0];
            const txRef = `TRF-${Date.now()}`;

            if (recip) {
                const recBal = Number(recip.balance || 0) + amt;
                await supabase.from('profiles').update({ balance: recBal }).eq('id', recip.id);
                await supabase.from('transactions').insert({
                    user_id: recip.id, type: 'transfer_in', amount: amt, status: 'completed',
                    reference: txRef,
                    description: `Transfer from ${user?.user_metadata?.full_name || user?.email || 'Mafhal Member'}`
                });
            }

            // Record debit
            await supabase.from('transactions').insert({
                user_id: uid, type: 'debit', amount: -amt, status: 'completed',
                reference: txRef,
                description: `Transfer to ${recip?.full_name || target}${transferNote ? ` • "${transferNote.trim()}"` : ''}`
            });

            setWallet(p => ({ ...p, balance: newBal }));
            setShowTransfer(false);
            setRecipient(''); setTransferAmt(''); setTransferNote('');
            Alert.alert('Transfer Successful! 🚀', `Sent ${fmt(amt)} to ${recip?.full_name || target}`);
            fetchWallet();
        } catch (e) {
            Alert.alert('Transfer Failed', e.message || 'Could not process. Try again.');
        } finally {
            setTransferPending(false);
        }
    };

    // ── Voucher redeem ─────────────────────────────────────────────────────────
    const handleVoucher = async () => {
        if (!voucherCode.trim()) { Alert.alert('Error', 'Enter a voucher code'); return; }
        setVoucherPending(true);
        try {
            const code = voucherCode.trim().toUpperCase();
            const { data: coupon } = await supabase.from('coupons')
                .select('*').eq('code', code).eq('is_active', true).maybeSingle();
            if (coupon) {
                const desc = coupon.discount_type === 'percentage'
                    ? `${coupon.discount_value}% off` : `₦${Number(coupon.discount_value).toLocaleString()} off`;
                Alert.alert('Voucher Valid ✅', `"${code}" gives ${desc}! Apply it at checkout or in your cart.`);
                setShowVoucher(false); setVoucherCode('');
            } else {
                Alert.alert('Invalid Code', 'This voucher is invalid or has expired.');
            }
        } catch (_) {
            Alert.alert('Error', 'Could not validate code. Check connection and try again.');
        } finally {
            setVoucherPending(false);
        }
    };

    // ── Savings pots ───────────────────────────────────────────────────────────
    const savePots = async (updated) => {
        setPots(updated);
        const uid = await resolveUserId();
        if (uid) await AsyncStorage.setItem(`@amf_pots_${uid}`, JSON.stringify(updated)).catch(() => {});
    };

    const handleCreatePot = async () => {
        if (!potName.trim()) { Alert.alert('Error', 'Enter a pot name'); return; }
        const t = parseInt(potTarget);
        if (isNaN(t) || t <= 0) { Alert.alert('Error', 'Enter a valid target amount'); return; }
        const pot = { id: `pot_${Date.now()}`, name: potName.trim(), target: t, saved: 0, color: potColor, icon: 'wallet-outline' };
        await savePots([...pots, pot]);
        setPotName(''); setPotTarget(''); setShowCreatePot(false);
        Alert.alert('Savings Pot Created 🎯', `"${pot.name}" is ready!`);
    };

    const handlePotTransfer = async (potId, amount, dir) => {
        const pot = pots.find(p => p.id === potId);
        if (!pot) return;
        if (dir === 'in' && wallet.balance < amount) { Alert.alert('Insufficient Balance'); return; }
        if (dir === 'out' && pot.saved < amount) { Alert.alert('Not Enough in Pot'); return; }

        const uid = await resolveUserId();
        const newBal = dir === 'in' ? wallet.balance - amount : wallet.balance + amount;

        // Update profile balance
        await supabase.from('profiles').update({ balance: newBal }).eq('id', uid);
        // Record transaction
        await supabase.from('transactions').insert({
            user_id: uid,
            type: dir === 'in' ? 'debit' : 'topup',
            amount: dir === 'in' ? -amount : amount,
            status: 'completed',
            reference: `POT-${Date.now()}`,
            description: dir === 'in' ? `Saved ₦${amount.toLocaleString()} in "${pot.name}"` : `Withdrew ₦${amount.toLocaleString()} from "${pot.name}"`
        });

        const updated = pots.map(p => p.id === potId
            ? { ...p, saved: Math.max(0, p.saved + (dir === 'in' ? amount : -amount)) }
            : p);
        await savePots(updated);
        setWallet(p => ({ ...p, balance: newBal }));
        Alert.alert('Done ✅', dir === 'in'
            ? `₦${amount.toLocaleString()} allocated to "${pot.name}"`
            : `₦${amount.toLocaleString()} returned to wallet`);
        fetchWallet();
    };

    // ── Derived values ─────────────────────────────────────────────────────────
    const filteredTx = useMemo(() => {
        return transactions.filter(tx => {
            const isCredit = tx.amount > 0;
            if (txFilter === 'credits' && !isCredit) return false;
            if (txFilter === 'debits'  && isCredit)  return false;
            if (txSearch.trim()) {
                const q = txSearch.toLowerCase();
                return (tx.description || '').toLowerCase().includes(q)
                    || (tx.type || '').toLowerCase().includes(q)
                    || String(Math.abs(tx.amount || 0)).includes(q);
            }
            return true;
        });
    }, [transactions, txFilter, txSearch]);

    const spentThisMonth = useMemo(() => {
        const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        return transactions
            .filter(t => t.amount < 0 && new Date(t.created_at) >= start)
            .reduce((s, t) => s + Math.abs(t.amount), 0);
    }, [transactions]);

    const budgetPct = monthlyLimit > 0 ? Math.min((spentThisMonth / monthlyLimit) * 100, 100) : 0;

    const displayBalance = useMemo(() => {
        if (balCurrency === 'USD') return `$${(wallet.balance / USD_RATE).toFixed(2)}`;
        if (balCurrency === 'AMC') return `${wallet.points.toLocaleString()} AMC`;
        return fmt(wallet.balance);
    }, [wallet, balCurrency]);

    const theme = CARD_THEMES[cardTheme] || CARD_THEMES.midnight;

    // ── Loading / Not-logged-in ────────────────────────────────────────────────
    if (loading && !refreshing) {
        return (
            <View style={S.center}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={S.loadTxt}>Securing Wallet…</Text>
            </View>
        );
    }

    if (notLoggedIn) {
        return (
            <View style={S.center}>
                <Ionicons name="lock-closed" size={48} color="#64748B" />
                <Text style={[S.loadTxt, { marginTop: 14, fontSize: 16 }]}>Sign in to access your wallet</Text>
                <TouchableOpacity onPress={onBack} style={S.backBtnFull}>
                    <Text style={{ color: 'white', fontWeight: '800' }}>Go Back</Text>
                </TouchableOpacity>
            </View>
        );
    }

    // ── MAIN RENDER ────────────────────────────────────────────────────────────
    return (
        <Animated.View style={[S.root, { opacity: fadeAnim }]}>
            {/* ── Header ── */}
            <View style={S.header}>
                <TouchableOpacity onPress={onBack} style={S.backBtn}>
                    <Ionicons name="arrow-back" size={22} color="#0F172A" />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                    <Text style={S.headerTitle}>My Wallet</Text>
                    <Text style={S.headerSub}>Abu Mafhal • Secure Escrow</Text>
                </View>
                <TouchableOpacity onPress={onRefresh} style={S.backBtn}>
                    <Ionicons name={refreshing ? 'sync' : 'refresh'} size={20} color="#0F172A" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={{ flex: 1, backgroundColor: '#F8FAFC' }}
                contentContainerStyle={S.scroll}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
                showsVerticalScrollIndicator={false}
            >
                {/* ── Wallet Card ── */}
                <LinearGradient colors={theme.gradient} style={S.card} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                    {/* Card top row */}
                    <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                        <View>
                            <Text style={S.cardLabel}>Available Balance</Text>
                            <TouchableOpacity onPress={() => setHideBalance(p => !p)} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <Text style={S.cardBalance}>
                                    {hideBalance ? '••••••' : displayBalance}
                                </Text>
                                <Ionicons name={hideBalance ? 'eye-off' : 'eye'} size={16} color="rgba(255,255,255,0.6)" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                            {/* Theme switcher */}
                            <Row style={{ gap: 5 }}>
                                {Object.keys(CARD_THEMES).map(t => (
                                    <TouchableOpacity key={t} onPress={() => setCardTheme(t)}
                                        style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: CARD_THEMES[t].gradient[1], borderWidth: cardTheme === t ? 2 : 0, borderColor: 'white' }} />
                                ))}
                            </Row>
                            {/* Currency switcher */}
                            <Row style={{ gap: 4 }}>
                                {['NGN', 'USD', 'AMC'].map(c => (
                                    <TouchableOpacity key={c} onPress={() => setBalCurrency(c)}
                                        style={[S.currBtn, { backgroundColor: balCurrency === c ? theme.accent : 'rgba(255,255,255,0.12)' }]}>
                                        <Text style={[S.currBtnTxt, { color: balCurrency === c ? '#000' : '#fff' }]}>{c}</Text>
                                    </TouchableOpacity>
                                ))}
                            </Row>
                        </View>
                    </Row>

                    {/* Escrow & Coins row */}
                    <Row style={{ gap: 8, marginTop: 6 }}>
                        <TouchableOpacity onPress={() => setShowEscrow(true)}
                            style={[S.cardChip, { borderColor: `${theme.accent}60` }]}>
                            <Ionicons name="shield-checkmark" size={12} color={theme.accent} />
                            <Text style={[S.cardChipTxt, { color: theme.accent }]}>100% Escrow</Text>
                        </TouchableOpacity>
                        {wallet.points > 0 && (
                            <View style={[S.cardChip, { borderColor: 'rgba(255,215,0,0.4)' }]}>
                                <Ionicons name="star" size={12} color="#FCD34D" />
                                <Text style={[S.cardChipTxt, { color: '#FCD34D' }]}>{wallet.points.toLocaleString()} AMC Coins</Text>
                            </View>
                        )}
                    </Row>

                    {/* Budget bar */}
                    <View style={{ marginTop: 14 }}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 4 }}>
                            <Text style={S.cardMicro}>Monthly Budget</Text>
                            <Text style={S.cardMicro}>{fmt(spentThisMonth)} / {fmt(monthlyLimit)}</Text>
                        </Row>
                        <View style={{ height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' }}>
                            <View style={{ width: `${budgetPct}%`, height: 4, borderRadius: 2, backgroundColor: budgetPct > 85 ? '#EF4444' : theme.accent }} />
                        </View>
                    </View>
                </LinearGradient>

                {/* ── Action Buttons ── */}
                <View style={S.actionsRow}>
                    <ActionBtn icon="add-circle-outline"   label="Top Up"    onPress={() => setShowTopUp(true)}    color="#10B981" />
                    <ActionBtn icon="swap-horizontal"      label="Transfer"  onPress={() => setShowTransfer(true)} color="#3B82F6" />
                    <ActionBtn icon="sync-outline"         label="Sync Bank" onPress={handleBankSync}              color="#F59E0B" disabled={syncing} />
                    <ActionBtn icon="ticket-outline"       label="Voucher"   onPress={() => setShowVoucher(true)}  color="#8B5CF6" />
                    <ActionBtn icon="shield-checkmark-outline" label="Escrow" onPress={() => setShowEscrow(true)}  color="#0EA5E9" />
                </View>

                {/* ── Dedicated Virtual Bank Account (Prominent on Main Screen) ── */}
                <View style={S.section}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                        <Row style={{ gap: 6 }}>
                            <Ionicons name="business" size={18} color="#059669" />
                            <Text style={S.sectionTitle}>Dedicated Bank Account</Text>
                        </Row>
                        <Pill label="0% FEE · PERSONAL NUBAN" color="#059669" bg="#ECFDF5" />
                    </Row>

                    {vaLoading ? (
                        <View style={S.vaLoadingBox}>
                            <ActivityIndicator color="#059669" size="small" />
                            <Text style={S.vaLoadingTxt}>Retrieving your dedicated personal NUBAN…</Text>
                        </View>
                    ) : virtualAcc?.account_number && !showBvnForm ? (
                        <View>
                            <LinearGradient
                                colors={['#071324', '#0F274B', '#1E3E6E']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={S.vaAtmCard}
                            >
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <View style={S.atmChip}>
                                            <View style={S.atmChipInner} />
                                        </View>
                                        <Ionicons name="wifi" size={16} color="#FCD34D" style={{ transform: [{ rotate: '90deg' }] }} />
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={S.atmBankName}>{virtualAcc.bank_name || 'WEMA BANK'}</Text>
                                        <View style={S.atmVerifiedBadge}>
                                            <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                                            <Text style={S.atmVerifiedTxt}>PAYSTACK VERIFIED</Text>
                                        </View>
                                    </View>
                                </View>

                                <Text style={S.atmAccLabel}>DEDICATED NUBAN ACCOUNT</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
                                    <Text style={S.atmAccNum}>
                                        {String(virtualAcc.account_number).replace(/(\d{4})(\d{3})(\d{3})/, '$1  $2  $3')}
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => copyText(virtualAcc.account_number, 'Account Number')}
                                        style={S.atmCopyBtn}
                                        activeOpacity={0.8}
                                    >
                                        <Ionicons name="copy-outline" size={14} color="#071324" />
                                        <Text style={S.atmCopyBtnTxt}>Copy</Text>
                                    </TouchableOpacity>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                    <View style={{ flex: 1, marginRight: 8 }}>
                                        <Text style={S.atmHolderLabel}>ACCOUNT HOLDER</Text>
                                        <Text style={S.atmHolderName} numberOfLines={1}>{virtualAcc.account_name || user?.user_metadata?.full_name || 'Abu Mafhal User'}</Text>
                                    </View>
                                    <Text style={S.atmSettlementTxt}>Instant Auto-Credit</Text>
                                </View>
                            </LinearGradient>

                            <View style={S.vaNoticeBox}>
                                <Ionicons name="flash" size={16} color="#059669" />
                                <Text style={S.vaNoticeTxt}>
                                    Transfer from any Nigerian bank (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Your wallet credits automatically in 30–60 seconds with 0% fee.
                                </Text>
                            </View>

                            <View style={{ marginTop: 10 }}>
                                <TouchableOpacity onPress={handleBankSync} disabled={syncing} style={[S.syncBtn, { width: '100%', opacity: syncing ? 0.6 : 1 }]}>
                                    {syncing ? (
                                        <ActivityIndicator size="small" color="white" />
                                    ) : (
                                        <>
                                            <Ionicons name="sync" size={15} color="white" />
                                            <Text style={S.syncBtnTxt}>Check & Sync Deposits</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={S.bvnCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                <View style={S.bvnIconCircle}>
                                    <Ionicons name="shield-checkmark" size={20} color="#059669" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.bvnTitle}>Generate Dedicated Bank Account</Text>
                                    <Text style={S.bvnSub}>Verify your BVN once to receive a permanent personal NUBAN</Text>
                                </View>
                            </View>

                            <View style={S.bvnCbnNote}>
                                <Ionicons name="information-circle" size={16} color="#0284C7" />
                                <Text style={S.bvnCbnNoteTxt}>
                                    Per CBN regulations, BVN verification is required to generate your personal Wema/Paystack dedicated account for instant automated wallet funding.
                                </Text>
                            </View>

                            {vaError && (
                                <View style={S.bvnErrorBox}>
                                    <Ionicons name="alert-circle" size={16} color="#EF4444" />
                                    <Text style={S.bvnErrorTxt}>{vaError}</Text>
                                </View>
                            )}

                            <View style={{ marginTop: 10 }}>
                                <ModernInput
                                    icon="person-outline"
                                    iconColor="#059669"
                                    iconBg="#ECFDF5"
                                    label="Legal Full Name (As on BVN)"
                                    value={bvnLegalName}
                                    onChangeText={setBvnLegalName}
                                    placeholder="Legal full name"
                                />

                                <ModernInput
                                    icon="key-outline"
                                    iconColor="#0284C7"
                                    iconBg="#F0F9FF"
                                    label="Bank Verification Number (BVN)"
                                    rightLabel="Dial *565*0#"
                                    value={bvnInput}
                                    onChangeText={(t) => setBvnInput(t.replace(/[^0-9]/g, '').slice(0, 11))}
                                    keyboardType="numeric"
                                    maxLength={11}
                                    placeholder="11-digit BVN"
                                    inputStyle={{ fontSize: 16, letterSpacing: 2, fontWeight: '700' }}
                                />

                                <ModernInput
                                    icon="call-outline"
                                    iconColor="#8B5CF6"
                                    iconBg="#F5F3FF"
                                    label="Registered Phone Number"
                                    value={bvnPhone}
                                    onChangeText={setBvnPhone}
                                    keyboardType="phone-pad"
                                    placeholder="Phone number"
                                />
                            </View>

                            <View style={S.bvnSecurityBadge}>
                                <Ionicons name="lock-closed" size={13} color="#059669" />
                                <Text style={S.bvnSecurityTxt}>256-Bit SSL Encrypted • Powered by Paystack & NIBSS</Text>
                            </View>

                            <TouchableOpacity
                                onPress={handleVerifyBvn}
                                disabled={bvnVerifying}
                                style={[S.primaryBtn, { backgroundColor: '#059669', marginTop: 14, opacity: bvnVerifying ? 0.7 : 1 }]}
                            >
                                {bvnVerifying ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <>
                                        <Ionicons name="shield-checkmark" size={18} color="white" />
                                        <Text style={S.primaryBtnTxt}>Verify BVN & Generate Account</Text>
                                    </>
                                )}
                            </TouchableOpacity>

                            {/* Alternative Direct Transfer (No BVN Required) */}
                            <View style={S.directBankWrap}>
                                <Row style={{ justifyContent: 'space-between', marginBottom: 6 }}>
                                    <Row style={{ gap: 6 }}>
                                        <Ionicons name="business" size={14} color="#0284C7" />
                                        <Text style={S.directBankTitle}>Direct Bank Deposit (No BVN Required)</Text>
                                    </Row>
                                    <Pill label="MANUAL TRANSFER" color="#0284C7" bg="#F0F9FF" />
                                </Row>
                                <Text style={S.directBankSub}>Transfer to Abu Mafhal corporate account and send receipt for instant crediting:</Text>
                                <View style={S.directBankDetailsBox}>
                                    <View style={S.directBankRow}>
                                        <Text style={S.directBankLabel}>Bank:</Text>
                                        <Text style={S.directBankVal}>Moniepoint MFB</Text>
                                    </View>
                                    <View style={S.directBankRow}>
                                        <Text style={S.directBankLabel}>Account No:</Text>
                                        <Row style={{ gap: 8 }}>
                                            <Text style={[S.directBankVal, { fontSize: 16, fontWeight: '900', letterSpacing: 1 }]}>8148810243</Text>
                                            <TouchableOpacity onPress={() => copyText('8148810243', 'Moniepoint Account')} style={S.miniCopyBtn}>
                                                <Ionicons name="copy-outline" size={12} color="#0284C7" />
                                                <Text style={{ fontSize: 10, fontWeight: '800', color: '#0284C7' }}>Copy</Text>
                                            </TouchableOpacity>
                                        </Row>
                                    </View>
                                    <View style={S.directBankRow}>
                                        <Text style={S.directBankLabel}>Account Name:</Text>
                                        <Text style={S.directBankVal}>Abu Mafhal Marketplace</Text>
                                    </View>
                                </View>
                            </View>

                            {virtualAcc?.account_number && (
                                <TouchableOpacity onPress={() => setShowBvnForm(false)} style={{ marginTop: 10, alignItems: 'center', padding: 6 }}>
                                    <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>Cancel and view existing account</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    )}
                </View>

                {/* ── Official Payment & Top-Up Gateways Showcase ── */}
                <View style={S.section}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                        <Row style={{ gap: 6 }}>
                            <Ionicons name="card" size={18} color="#0F172A" />
                            <Text style={S.sectionTitle}>Add Funds / Gateways</Text>
                        </Row>
                        <Pill label="4 CHANNELS" color="#2563EB" bg="#EFF6FF" />
                    </Row>

                    <View style={{ gap: 10 }}>
                        {GATEWAYS.map(gw => (
                            <TouchableOpacity
                                key={gw.id}
                                onPress={() => {
                                    setGateway(gw.id);
                                    if (gw.id === 'bank_transfer') {
                                        if (virtualAcc?.account_number) {
                                            setShowTopUp(true);
                                        } else {
                                            setShowBvnForm(true);
                                        }
                                    } else {
                                        setShowTopUp(true);
                                    }
                                }}
                                style={S.modernGwCard}
                                activeOpacity={0.8}
                            >
                                <View style={S.gwLogoWrap}>
                                    <Image source={gw.logo} style={S.gwLogoImg} resizeMode="contain" />
                                </View>
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                        <Text style={S.modernGwTitle}>{gw.name}</Text>
                                        <View style={[S.gwBadge, { backgroundColor: gw.badgeBg, borderColor: gw.badgeBorder }]}>
                                            <Text style={[S.gwBadgeTxt, { color: gw.badgeColor }]}>{gw.badge}</Text>
                                        </View>
                                    </View>
                                    <Text style={S.modernGwSub} numberOfLines={1}>{gw.subtitle}</Text>
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                        {gw.channels.slice(0, 3).map((ch, idx) => (
                                            <View key={idx} style={S.gwChip}>
                                                <Text style={S.gwChipTxt}>{ch}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Budget Tracker ── */}
                <TouchableOpacity style={S.section} onPress={() => setShowBudget(true)} activeOpacity={0.8}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={S.sectionTitle}>📊 Monthly Budget</Text>
                        <Text style={{ fontSize: 11, color: budgetPct > 85 ? '#EF4444' : '#10B981', fontWeight: '700' }}>
                            {Math.round(budgetPct)}% used • Tap to edit
                        </Text>
                    </Row>
                    <View style={{ height: 8, borderRadius: 4, backgroundColor: '#E2E8F0' }}>
                        <View style={{ width: `${budgetPct}%`, height: 8, borderRadius: 4, backgroundColor: budgetPct > 85 ? '#EF4444' : '#10B981' }} />
                    </View>
                    <Row style={{ justifyContent: 'space-between', marginTop: 6 }}>
                        <Text style={S.sectionSub}>Spent: {fmt(spentThisMonth)}</Text>
                        <Text style={S.sectionSub}>Limit: {fmt(monthlyLimit)}</Text>
                    </Row>
                </TouchableOpacity>

                {/* ── Savings Pots ── */}
                <View style={S.section}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 12 }}>
                        <Text style={S.sectionTitle}>🏦 Savings Pots</Text>
                        <TouchableOpacity onPress={() => setShowCreatePot(true)} style={S.pillBtn}>
                            <Ionicons name="add" size={14} color="#10B981" />
                            <Text style={[S.pillBtnTxt, { color: '#10B981' }]}>New Pot</Text>
                        </TouchableOpacity>
                    </Row>
                    {pots.map(pot => {
                        const pct = pot.target > 0 ? Math.min((pot.saved / pot.target) * 100, 100) : 0;
                        return (
                            <View key={pot.id} style={[S.potCard, { borderLeftColor: pot.color }]}>
                                <Row style={{ justifyContent: 'space-between', marginBottom: 8 }}>
                                    <Row style={{ gap: 10 }}>
                                        <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${pot.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name={pot.icon || 'wallet-outline'} size={18} color={pot.color} />
                                        </View>
                                        <View>
                                            <Text style={S.potName}>{pot.name}</Text>
                                            <Text style={S.potSub}>{fmt(pot.saved)} / {fmt(pot.target)}</Text>
                                        </View>
                                    </Row>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: pot.color }}>{Math.round(pct)}%</Text>
                                </Row>
                                <View style={{ height: 6, borderRadius: 3, backgroundColor: `${pot.color}20`, marginBottom: 8 }}>
                                    <View style={{ width: `${pct}%`, height: 6, borderRadius: 3, backgroundColor: pot.color }} />
                                </View>
                                <Row style={{ gap: 8 }}>
                                    <TouchableOpacity onPress={() => {
                                        Alert.prompt
                                            ? Alert.prompt('Save to Pot', `How much to save in "${pot.name}"? (NGN)`, (v) => {
                                                const a = parseInt(v); if (a > 0) handlePotTransfer(pot.id, a, 'in');
                                            }, 'plain-text', '', 'numeric')
                                            : Alert.alert('Pot Deposit', 'Enter amount in app console');
                                    }} style={[S.potBtn, { backgroundColor: `${pot.color}18` }]}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: pot.color }}>+ Add</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity onPress={() => {
                                        if (pot.saved <= 0) { Alert.alert('Empty Pot'); return; }
                                        handlePotTransfer(pot.id, pot.saved, 'out');
                                    }} style={[S.potBtn, { backgroundColor: '#FEF2F2' }]}>
                                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#EF4444' }}>Withdraw All</Text>
                                    </TouchableOpacity>
                                </Row>
                            </View>
                        );
                    })}
                </View>

                {/* ── Transaction History ── */}
                <View style={S.section}>
                    <Row style={{ justifyContent: 'space-between', marginBottom: 10 }}>
                        <Text style={S.sectionTitle}>📄 Transactions</Text>
                        <Row style={{ gap: 6 }}>
                            {['all', 'credits', 'debits'].map(f => (
                                <TouchableOpacity key={f} onPress={() => setTxFilter(f)}
                                    style={[S.filterBtn, txFilter === f && S.filterBtnActive]}>
                                    <Text style={[S.filterBtnTxt, txFilter === f && { color: 'white' }]}>
                                        {f.charAt(0).toUpperCase() + f.slice(1)}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </Row>
                    </Row>

                    {/* Search */}
                    <View style={S.searchBox}>
                        <Ionicons name="search" size={15} color="#94A3B8" />
                        <TextInput
                            style={[S.searchInput, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                            placeholder="Search transactions…"
                            placeholderTextColor="#94A3B8"
                            value={txSearch}
                            onChangeText={setTxSearch}
                        />
                        {txSearch.length > 0 && (
                            <TouchableOpacity onPress={() => setTxSearch('')}>
                                <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {filteredTx.length === 0 ? (
                        <View style={S.emptyTx}>
                            <Ionicons name="receipt-outline" size={40} color="#CBD5E1" />
                            <Text style={S.emptyTxTxt}>No transactions yet</Text>
                        </View>
                    ) : (
                        filteredTx.map((tx, i) => {
                            const isCredit = tx.amount > 0;
                            const amt = Math.abs(tx.amount || 0);
                            const date = tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
                            return (
                                <TouchableOpacity key={tx.id || i} onPress={() => setSelectedTx(tx)}
                                    style={[S.txRow, i === filteredTx.length - 1 && { borderBottomWidth: 0 }]}
                                    activeOpacity={0.75}>
                                    <TxIcon type={tx.type} />
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={S.txDesc} numberOfLines={1}>
                                            {tx.description || tx.type || 'Transaction'}
                                        </Text>
                                        <Text style={S.txDate}>{date}</Text>
                                    </View>
                                    <Text style={[S.txAmt, { color: isCredit ? '#10B981' : '#EF4444' }]}>
                                        {isCredit ? '+' : '-'}{fmt(amt)}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>

                <View style={{ height: 40 }} />
            </ScrollView>

            {/* ══════════════════════════════════════════════════════════════════
                MODALS
            ══════════════════════════════════════════════════════════════════ */}

            {/* ── Top-Up Modal ── */}
            <Modal visible={showTopUp} transparent animationType="slide" onRequestClose={() => setShowTopUp(false)}>
                <View style={S.modalBg}>
                    <View style={S.modalSheet}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                            <Text style={S.modalTitle}>Top Up Wallet</Text>
                            <TouchableOpacity onPress={() => setShowTopUp(false)} style={S.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </Row>

                        {/* Modern Gateway selector with official brand logos */}
                        <View style={{ gap: 8 }}>
                            {GATEWAYS.map(gw => {
                                const isSelected = gateway === gw.id;
                                return (
                                    <TouchableOpacity
                                        key={gw.id}
                                        onPress={() => {
                                            setGateway(gw.id);
                                            if (gw.id === 'bank_transfer' && !virtualAcc && !vaLoading) {
                                                loadVirtualAccount();
                                            }
                                        }}
                                        style={[
                                            S.modernGwCard,
                                            isSelected && {
                                                borderColor: gw.color,
                                                backgroundColor: '#FFFFFF',
                                                shadowColor: gw.color,
                                                shadowOpacity: 0.14,
                                                shadowRadius: 8,
                                                elevation: 3
                                            }
                                        ]}
                                        activeOpacity={0.8}
                                    >
                                        {isSelected && <View style={[S.gwAccentLine, { backgroundColor: gw.color }]} />}
                                        <View style={S.gwLogoWrap}>
                                            <Image source={gw.logo} style={S.gwLogoImg} resizeMode="contain" />
                                        </View>
                                        <View style={{ flex: 1, marginLeft: 10 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                                <Text style={[S.modernGwTitle, isSelected && { color: '#0F172A', fontWeight: '900' }]}>{gw.name}</Text>
                                                <View style={[S.gwBadge, { backgroundColor: gw.badgeBg, borderColor: gw.badgeBorder }]}>
                                                    <Text style={[S.gwBadgeTxt, { color: gw.badgeColor }]}>{gw.badge}</Text>
                                                </View>
                                            </View>
                                            <Text style={S.modernGwSub} numberOfLines={1}>{gw.subtitle}</Text>
                                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                                                {gw.channels.slice(0, 3).map((ch, idx) => (
                                                    <View key={idx} style={S.gwChip}>
                                                        <Text style={S.gwChipTxt}>{ch}</Text>
                                                    </View>
                                                ))}
                                            </View>
                                        </View>
                                        <View style={[S.gwRadio, isSelected && { borderColor: gw.color, backgroundColor: gw.color }]}>
                                            {isSelected && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                        </View>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>

                        {/* Amount input for Paystack, Flutterwave, and NOWPayments */}
                        {gateway !== 'bank_transfer' && (
                            <View style={{ marginTop: 14 }}>
                                {gateway === 'nowpayments' ? (
                                    <>
                                        <ModernInput
                                            icon="logo-usd"
                                            iconColor="#2563EB"
                                            iconBg="#EFF6FF"
                                            label={`Amount (USD) — ₦${USD_RATE.toLocaleString()}/$`}
                                            value={amountUsd}
                                            onChangeText={setAmountUsd}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            inputStyle={{ fontSize: 20, fontWeight: '900', color: '#1E293B' }}
                                        />
                                        {amountUsd && !isNaN(parseFloat(amountUsd)) && (
                                            <Text style={S.convertHint}>= {fmt(Math.round(parseFloat(amountUsd) * USD_RATE))} will credit to wallet</Text>
                                        )}
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                                            {[5, 10, 20, 50, 100, 250].map(v => (
                                                <TouchableOpacity
                                                    key={v}
                                                    onPress={() => setAmountUsd(String(v))}
                                                    style={[S.quickBtn, parseFloat(amountUsd) === v && S.quickBtnActive]}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[S.quickBtnTxt, parseFloat(amountUsd) === v && S.quickBtnTxtActive]}>${v}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                                            {['USDT (TRC20)', 'Bitcoin (BTC)', 'Ethereum (ETH)', 'Solana (SOL)', 'BNB'].map((c, i) => (
                                                <View key={i} style={S.coinTag}>
                                                    <Ionicons name="logo-bitcoin" size={11} color="#2563EB" />
                                                    <Text style={S.coinTagTxt}>{c}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    </>
                                ) : (
                                    <>
                                        <ModernInput
                                            icon="cash-outline"
                                            iconColor="#10B981"
                                            iconBg="#ECFDF5"
                                            label="Amount to Top Up (NGN)"
                                            value={amountNgn}
                                            onChangeText={setAmountNgn}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            inputStyle={{ fontSize: 20, fontWeight: '900', color: '#1E293B' }}
                                        />
                                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10, marginTop: -4 }}>
                                            {[1000, 2000, 5000, 10000, 20000, 50000].map(v => (
                                                <TouchableOpacity
                                                    key={v}
                                                    onPress={() => setAmountNgn(String(v))}
                                                    style={[S.quickBtn, cleanNum(amountNgn) === v && S.quickBtnActive]}
                                                    activeOpacity={0.7}
                                                >
                                                    <Text style={[S.quickBtnTxt, cleanNum(amountNgn) === v && S.quickBtnTxtActive]}>+₦{v.toLocaleString()}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    </>
                                )}
                            </View>
                        )}

                        {/* Bank transfer: show virtual account or Paystack BVN verification form */}
                        {gateway === 'bank_transfer' && (
                            <View style={{ marginTop: 12 }}>
                                {vaLoading ? (
                                    <View style={S.vaLoadingBox}>
                                        <ActivityIndicator color="#059669" size="large" />
                                        <Text style={S.vaLoadingTxt}>Checking your dedicated virtual account…</Text>
                                    </View>
                                ) : virtualAcc?.account_number && !showBvnForm ? (
                                    /* LUXURY ATM CARD FOR ACTIVE DEDICATED ACCOUNT */
                                    <View>
                                        <LinearGradient
                                            colors={['#071324', '#0F274B', '#1E3E6E']}
                                            start={{ x: 0, y: 0 }}
                                            end={{ x: 1, y: 1 }}
                                            style={S.vaAtmCard}
                                        >
                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                                    <View style={S.atmChip}>
                                                        <View style={S.atmChipInner} />
                                                    </View>
                                                    <Ionicons name="wifi" size={16} color="#FCD34D" style={{ transform: [{ rotate: '90deg' }] }} />
                                                </View>
                                                <View style={{ alignItems: 'flex-end' }}>
                                                    <Text style={S.atmBankName}>{virtualAcc.bank_name || 'WEMA BANK'}</Text>
                                                    <View style={S.atmVerifiedBadge}>
                                                        <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                                                        <Text style={S.atmVerifiedTxt}>PAYSTACK VERIFIED</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <Text style={S.atmAccLabel}>DEDICATED NUBAN ACCOUNT</Text>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginVertical: 4 }}>
                                                <Text style={S.atmAccNum}>
                                                    {String(virtualAcc.account_number).replace(/(\d{4})(\d{3})(\d{3})/, '$1  $2  $3')}
                                                </Text>
                                                <TouchableOpacity
                                                    onPress={() => copyText(virtualAcc.account_number, 'Account Number')}
                                                    style={S.atmCopyBtn}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="copy-outline" size={14} color="#071324" />
                                                    <Text style={S.atmCopyBtnTxt}>Copy</Text>
                                                </TouchableOpacity>
                                            </View>

                                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderColor: 'rgba(255,255,255,0.1)' }}>
                                                <View style={{ flex: 1, marginRight: 8 }}>
                                                    <Text style={S.atmHolderLabel}>ACCOUNT HOLDER</Text>
                                                    <Text style={S.atmHolderName} numberOfLines={1}>{virtualAcc.account_name || 'Abu Mafhal User'}</Text>
                                                </View>
                                                <Text style={S.atmSettlementTxt}>Instant Auto-Credit</Text>
                                            </View>
                                        </LinearGradient>

                                        <View style={S.vaNoticeBox}>
                                            <Ionicons name="flash" size={16} color="#059669" />
                                            <Text style={S.vaNoticeTxt}>
                                                Transfer from any Nigerian bank (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Your wallet credits automatically in 30–60 seconds with 0% fee.
                                            </Text>
                                        </View>

                                        <View style={{ marginTop: 10 }}>
                                            <TouchableOpacity onPress={handleBankSync} disabled={syncing} style={[S.syncBtn, { width: '100%', opacity: syncing ? 0.6 : 1 }]}>
                                                {syncing ? (
                                                    <ActivityIndicator size="small" color="white" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="sync" size={15} color="white" />
                                                        <Text style={S.syncBtnTxt}>Check & Sync Deposits</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                ) : (
                                    /* PAYSTACK BVN VERIFICATION & DEDICATED VIRTUAL ACCOUNT ACTIVATION FORM */
                                    <View style={S.bvnCard}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                            <View style={S.bvnIconCircle}>
                                                <Ionicons name="shield-checkmark" size={20} color="#059669" />
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={S.bvnTitle}>Generate Dedicated Bank Account</Text>
                                                <Text style={S.bvnSub}>Verify your BVN once to receive a permanent NUBAN</Text>
                                            </View>
                                        </View>

                                        <View style={S.bvnCbnNote}>
                                            <Ionicons name="information-circle" size={16} color="#0284C7" />
                                            <Text style={S.bvnCbnNoteTxt}>
                                                Per CBN regulations, BVN verification is required to generate your personal Wema/Paystack dedicated account for instant automated wallet funding.
                                            </Text>
                                        </View>

                                        {vaError && (
                                            <View style={S.bvnErrorBox}>
                                                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                                                <Text style={S.bvnErrorTxt}>{vaError}</Text>
                                            </View>
                                        )}

                                        <View style={{ marginTop: 10 }}>
                                            <ModernInput
                                                icon="person-outline"
                                                iconColor="#059669"
                                                iconBg="#ECFDF5"
                                                label="Legal Full Name (As on BVN)"
                                                value={bvnLegalName}
                                                onChangeText={setBvnLegalName}
                                                placeholder="Legal full name"
                                            />

                                            <ModernInput
                                                icon="key-outline"
                                                iconColor="#0284C7"
                                                iconBg="#F0F9FF"
                                                label="Bank Verification Number (BVN)"
                                                rightLabel="Dial *565*0#"
                                                value={bvnInput}
                                                onChangeText={t => setBvnInput(t.replace(/[^0-9]/g, '').slice(0, 11))}
                                                keyboardType="numeric"
                                                maxLength={11}
                                                placeholder="11-digit BVN"
                                                inputStyle={{ fontSize: 16, letterSpacing: 2, fontWeight: '700' }}
                                            />

                                            <ModernInput
                                                icon="call-outline"
                                                iconColor="#8B5CF6"
                                                iconBg="#F5F3FF"
                                                label="Registered Phone Number"
                                                value={bvnPhone}
                                                onChangeText={setBvnPhone}
                                                keyboardType="phone-pad"
                                                placeholder="Phone number"
                                            />
                                        </View>

                                        <View style={S.bvnSecurityBadge}>
                                            <Ionicons name="lock-closed" size={13} color="#059669" />
                                            <Text style={S.bvnSecurityTxt}>
                                                256-Bit SSL Encrypted • Powered by Paystack & NIBSS
                                            </Text>
                                        </View>

                                        <TouchableOpacity
                                            onPress={handleVerifyBvnAndGenerateAccount}
                                            disabled={bvnVerifying}
                                            style={[S.primaryBtn, { backgroundColor: '#059669', marginTop: 14, opacity: bvnVerifying ? 0.7 : 1 }]}
                                        >
                                            {bvnVerifying ? (
                                                <ActivityIndicator color="white" />
                                            ) : (
                                                <>
                                                    <Ionicons name="shield-checkmark" size={18} color="white" />
                                                    <Text style={S.primaryBtnTxt}>Verify BVN & Generate Account</Text>
                                                </>
                                            )}
                                        </TouchableOpacity>

                                        {virtualAcc && (
                                            <TouchableOpacity onPress={() => setShowBvnForm(false)} style={{ marginTop: 10, alignItems: 'center', padding: 6 }}>
                                                <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700' }}>Cancel and view existing account</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                )}
                            </View>
                        )}

                        {gateway !== 'bank_transfer' && (
                            <TouchableOpacity
                                onPress={handleTopUp}
                                disabled={topUpPending}
                                style={[S.primaryBtn, { opacity: topUpPending ? 0.7 : 1, marginTop: 16 }]}
                            >
                                {topUpPending
                                    ? <ActivityIndicator color="white" />
                                    : <Text style={S.primaryBtnTxt}>
                                        {gateway === 'nowpayments'
                                            ? (amountUsd ? `Pay $${amountUsd} with Crypto` : 'Enter USD Amount')
                                            : (amountNgn ? `Top Up ${fmt(cleanNum(amountNgn))}` : 'Enter Top-Up Amount')}
                                    </Text>}
                            </TouchableOpacity>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── Checkout WebView (Mobile only) ── */}
            {Platform.OS !== 'web' && (
                <Modal visible={showWebView} transparent={false} animationType="slide" onRequestClose={() => setShowWebView(false)}>
                    <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 50, gap: 12 }}>
                            <TouchableOpacity onPress={() => {
                                Alert.alert('Cancel Payment?', 'Are you sure you want to leave the payment screen?', [
                                    { text: 'Stay', style: 'cancel' },
                                    { text: 'Leave', style: 'destructive', onPress: () => setShowWebView(false) }
                                ]);
                            }} style={{ padding: 6 }}>
                                <Ionicons name="close" size={22} color="white" />
                            </TouchableOpacity>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 15, flex: 1 }}>{activeGwName} Checkout</Text>
                        </View>
                        {checkoutUrl && (
                            <WebView
                                source={{ uri: checkoutUrl }}
                                style={{ flex: 1 }}
                                onNavigationStateChange={async (nav) => {
                                    const url = nav.url || '';
                                    if (url.includes('paystack.co/close') || url.includes('success') || url.includes('callback') || url.includes('reference=')) {
                                        setShowWebView(false);
                                        if (activeRef && pendingAmt > 0) {
                                            await creditWallet(pendingAmt, activeRef, activeGwName);
                                        }
                                        if (typeof window !== 'undefined') window.localStorage.removeItem('@amf_pending_topup');
                                        AsyncStorage.removeItem('@amf_pending_topup').catch(() => {});
                                    }
                                }}
                            />
                        )}
                    </View>
                </Modal>
            )}

            {/* ── Success Modal ── */}
            <Modal visible={showSuccess} transparent animationType="fade" onRequestClose={() => setShowSuccess(false)}>
                <View style={[S.modalBg, { justifyContent: 'center', paddingHorizontal: 24 }]}>
                    <View style={[S.modalSheet, { alignItems: 'center', paddingVertical: 32 }]}>
                        <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Ionicons name="checkmark-circle" size={44} color="#10B981" />
                        </View>
                        <Text style={[S.modalTitle, { textAlign: 'center', marginBottom: 8 }]}>Payment Successful! 🎉</Text>
                        {successDetails && (
                            <>
                                <Text style={{ fontSize: 28, fontWeight: '900', color: '#0F172A', marginBottom: 4 }}>
                                    {fmt(successDetails.amount)}
                                </Text>
                                {successDetails.usdAmount && (
                                    <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 4 }}>= ${successDetails.usdAmount} USD</Text>
                                )}
                                <Text style={{ color: '#64748B', fontSize: 13, marginBottom: 4 }}>via {successDetails.gateway}</Text>
                                <Text style={{ color: '#94A3B8', fontSize: 11 }}>Ref: {successDetails.reference}</Text>
                            </>
                        )}
                        <Text style={{ fontSize: 13, color: '#10B981', fontWeight: '700', marginTop: 12 }}>
                            Your wallet balance has been updated ✅
                        </Text>
                        <TouchableOpacity onPress={() => setShowSuccess(false)} style={[S.primaryBtn, { marginTop: 20, width: '100%' }]}>
                            <Text style={S.primaryBtnTxt}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── P2P Transfer Modal ── */}
            <Modal visible={showTransfer} transparent animationType="slide" onRequestClose={() => setShowTransfer(false)}>
                <View style={S.modalBg}>
                    <View style={S.modalSheet}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                            <Text style={S.modalTitle}>Send Money 💸</Text>
                            <TouchableOpacity onPress={() => setShowTransfer(false)} style={S.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </Row>

                        <ModernInput
                            icon="person-outline"
                            iconColor="#2563EB"
                            iconBg="#EFF6FF"
                            label="Recipient"
                            value={recipient}
                            onChangeText={setRecipient}
                            placeholder="Username, phone or email"
                            autoCapitalize="none"
                        />

                        <ModernInput
                            icon="cash-outline"
                            iconColor="#10B981"
                            iconBg="#ECFDF5"
                            label="Amount (NGN)"
                            value={transferAmt}
                            onChangeText={setTransferAmt}
                            keyboardType="numeric"
                            placeholder="0.00"
                            inputStyle={{ fontSize: 16, fontWeight: '800' }}
                        />

                        {/* Quick Presets for Transfer */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12, marginTop: -4 }}>
                            {['500', '1000', '2000', '5000', '10000'].map((preset) => (
                                <TouchableOpacity
                                    key={preset}
                                    onPress={() => setTransferAmt(preset)}
                                    style={[S.quickBtn, transferAmt === preset && S.quickBtnActive]}
                                >
                                    <Text style={[S.quickBtnTxt, transferAmt === preset && S.quickBtnTxtActive]}>
                                        ₦{Number(preset).toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <ModernInput
                            icon="chatbox-ellipses-outline"
                            iconColor="#64748B"
                            iconBg="#F1F5F9"
                            label="Note (optional)"
                            value={transferNote}
                            onChangeText={setTransferNote}
                            placeholder="What is this for?"
                        />

                        <View style={[S.infoBox, { marginTop: 4, marginBottom: 10 }]}>
                            <Ionicons name="information-circle" size={16} color="#3B82F6" />
                            <Text style={{ fontSize: 12, color: '#1D4ED8', flex: 1 }}>
                                Available: {fmt(wallet.balance)} • Min transfer: ₦100
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleP2P}
                            disabled={transferPending}
                            style={[S.primaryBtn, { marginTop: 6, opacity: transferPending ? 0.7 : 1 }]}
                        >
                            {transferPending
                                ? <ActivityIndicator color="white" />
                                : <Text style={S.primaryBtnTxt}>Send {transferAmt ? fmt(parseInt(transferAmt) || 0) : 'Money'}</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Voucher Modal ── */}
            <Modal visible={showVoucher} transparent animationType="slide" onRequestClose={() => setShowVoucher(false)}>
                <View style={S.modalBg}>
                    <View style={S.modalSheet}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                            <Text style={S.modalTitle}>Redeem Voucher 🎟️</Text>
                            <TouchableOpacity onPress={() => setShowVoucher(false)} style={S.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </Row>

                        <View style={[S.infoBox, { marginBottom: 14 }]}>
                            <Ionicons name="ticket-outline" size={16} color="#8B5CF6" />
                            <Text style={{ flex: 1, fontSize: 12, color: '#6D28D9' }}>
                                Enter your voucher or discount promo code to claim credits or discount vouchers.
                            </Text>
                        </View>

                        <ModernInput
                            icon="gift-outline"
                            iconColor="#8B5CF6"
                            iconBg="#F5F3FF"
                            label="Voucher / Promo Code"
                            value={voucherCode}
                            onChangeText={setVoucherCode}
                            placeholder="ENTER CODE"
                            autoCapitalize="characters"
                            inputStyle={{ textTransform: 'uppercase', letterSpacing: 2, fontWeight: '800' }}
                        />

                        <TouchableOpacity
                            onPress={handleVoucher}
                            disabled={voucherPending}
                            style={[S.primaryBtn, { marginTop: 14, backgroundColor: '#8B5CF6', opacity: voucherPending ? 0.7 : 1 }]}
                        >
                            {voucherPending
                                ? <ActivityIndicator color="white" />
                                : <Text style={S.primaryBtnTxt}>Verify & Apply Code</Text>}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Budget Modal ── */}
            <Modal visible={showBudget} transparent animationType="slide" onRequestClose={() => setShowBudget(false)}>
                <View style={S.modalBg}>
                    <View style={S.modalSheet}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                            <Text style={S.modalTitle}>Set Monthly Budget 📊</Text>
                            <TouchableOpacity onPress={() => setShowBudget(false)} style={S.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </Row>
                        
                        <ModernInput
                            icon="speedometer-outline"
                            iconColor="#D97706"
                            iconBg="#FEF3C7"
                            label="Budget Limit (NGN)"
                            value={budgetInput}
                            onChangeText={setBudgetInput}
                            keyboardType="numeric"
                            placeholder={String(monthlyLimit || '50000')}
                            inputStyle={{ fontSize: 16, fontWeight: '800' }}
                            helperText="Track your spending and receive smart warning alerts when nearing limit."
                        />

                        {/* Quick Presets for Budget */}
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
                            {['20000', '50000', '100000', '250000', '500000'].map((preset) => (
                                <TouchableOpacity
                                    key={preset}
                                    onPress={() => setBudgetInput(preset)}
                                    style={[S.quickBtn, budgetInput === preset && S.quickBtnActive]}
                                >
                                    <Text style={[S.quickBtnTxt, budgetInput === preset && S.quickBtnTxtActive]}>
                                        ₦{Number(preset).toLocaleString()}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={async () => {
                                const v = parseInt(budgetInput);
                                if (isNaN(v) || v <= 0) { Alert.alert('Invalid', 'Enter a valid limit'); return; }
                                setMonthlyLimit(v);
                                setBudgetInput('');
                                setShowBudget(false);
                                const uid = await resolveUserId();
                                if (uid) await AsyncStorage.setItem(`@amf_limit_${uid}`, String(v)).catch(() => {});
                                Alert.alert('Budget Set ✅', `Monthly limit set to ${fmt(v)}`);
                            }}
                            style={[S.primaryBtn, { marginTop: 4 }]}
                        >
                            <Text style={S.primaryBtnTxt}>Save Budget Limit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Create Savings Pot Modal ── */}
            <Modal visible={showCreatePot} transparent animationType="slide" onRequestClose={() => setShowCreatePot(false)}>
                <View style={S.modalBg}>
                    <View style={S.modalSheet}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                            <Text style={S.modalTitle}>New Savings Pot 🏦</Text>
                            <TouchableOpacity onPress={() => setShowCreatePot(false)} style={S.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </Row>

                        <ModernInput
                            icon="bookmark-outline"
                            iconColor="#2563EB"
                            iconBg="#EFF6FF"
                            label="Pot Name"
                            value={potName}
                            onChangeText={setPotName}
                            placeholder="e.g. Eid Shopping, New Laptop, Rent"
                        />

                        <ModernInput
                            icon="trophy-outline"
                            iconColor="#10B981"
                            iconBg="#ECFDF5"
                            label="Target Amount (NGN)"
                            value={potTarget}
                            onChangeText={setPotTarget}
                            keyboardType="numeric"
                            placeholder="e.g. 100,000"
                            inputStyle={{ fontSize: 16, fontWeight: '800' }}
                        />

                        <Text style={[S.inputLabel, { marginTop: 4, marginBottom: 8 }]}>Theme Color</Text>
                        <Row style={{ gap: 10, marginBottom: 20 }}>
                            {['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#0F172A'].map(c => (
                                <TouchableOpacity key={c} onPress={() => setPotColor(c)}
                                    style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: c, borderWidth: potColor === c ? 3 : 0, borderColor: '#0F172A' }} />
                            ))}
                        </Row>

                        <TouchableOpacity onPress={handleCreatePot} style={[S.primaryBtn, { marginTop: 4 }]}>
                            <Text style={S.primaryBtnTxt}>Create Savings Pot</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ── Transaction Detail Modal ── */}
            <Modal visible={!!selectedTx} transparent animationType="slide" onRequestClose={() => setSelectedTx(null)}>
                <View style={S.modalBg}>
                    <View style={S.modalSheet}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                            <Text style={S.modalTitle}>Transaction Detail</Text>
                            <TouchableOpacity onPress={() => setSelectedTx(null)} style={S.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </Row>
                        {selectedTx && (
                            <>
                                <View style={{ alignItems: 'center', marginBottom: 20 }}>
                                    <TxIcon type={selectedTx.type} />
                                    <Text style={[S.txAmt, { fontSize: 28, marginTop: 12, color: selectedTx.amount > 0 ? '#10B981' : '#EF4444' }]}>
                                        {selectedTx.amount > 0 ? '+' : '-'}{fmt(Math.abs(selectedTx.amount || 0))}
                                    </Text>
                                    <Text style={[S.txDate, { marginTop: 4, fontSize: 13 }]}>
                                        {selectedTx.status?.toUpperCase() || 'COMPLETED'}
                                    </Text>
                                </View>
                                {[
                                    ['Type', selectedTx.type],
                                    ['Description', selectedTx.description],
                                    ['Reference', selectedTx.reference],
                                    ['Date', selectedTx.created_at ? new Date(selectedTx.created_at).toLocaleString('en-NG') : '—'],
                                ].map(([k, v]) => v ? (
                                    <View key={k} style={S.detailRow}>
                                        <Text style={S.detailKey}>{k}</Text>
                                        <Text style={S.detailVal} numberOfLines={2}>{String(v)}</Text>
                                    </View>
                                ) : null)}
                                <TouchableOpacity
                                    onPress={() => copyText(`${selectedTx.type} • ${fmt(Math.abs(selectedTx.amount || 0))} • ${selectedTx.reference || ''}`, 'Transaction details')}
                                    style={[S.primaryBtn, { marginTop: 20, backgroundColor: '#F1F5F9' }]}>
                                    <Row style={{ gap: 8 }}>
                                        <Ionicons name="copy-outline" size={16} color="#0F172A" />
                                        <Text style={[S.primaryBtnTxt, { color: '#0F172A' }]}>Copy Details</Text>
                                    </Row>
                                </TouchableOpacity>
                            </>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── Escrow Modal ── */}
            <Modal visible={showEscrow} transparent animationType="slide" onRequestClose={() => setShowEscrow(false)}>
                <View style={S.modalBg}>
                    <View style={S.modalSheet}>
                        <Row style={{ justifyContent: 'space-between', marginBottom: 18 }}>
                            <Text style={S.modalTitle}>🛡️ Escrow Protection</Text>
                            <TouchableOpacity onPress={() => setShowEscrow(false)} style={S.closeBtn}>
                                <Ionicons name="close" size={20} color="#0F172A" />
                            </TouchableOpacity>
                        </Row>

                        <View style={{ backgroundColor: '#ECFDF5', borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#86EFAC' }}>
                            <Row style={{ gap: 10, marginBottom: 10 }}>
                                <Ionicons name="shield-checkmark" size={28} color="#10B981" />
                                <View>
                                    <Text style={{ fontSize: 15, fontWeight: '900', color: '#065F46' }}>100% Escrow Vault</Text>
                                    <Text style={{ fontSize: 12, color: '#059669' }}>Every order is fully protected</Text>
                                </View>
                            </Row>
                            <Text style={{ fontSize: 13, color: '#065F46', lineHeight: 20 }}>
                                When you pay for an order, your money is locked in Abu Mafhal's secure escrow vault. The vendor only receives payment after you confirm delivery.
                            </Text>
                        </View>

                        {[
                            { icon: 'lock-closed', color: '#3B82F6', title: 'Payment Locked', desc: 'Funds held securely until delivery confirmation' },
                            { icon: 'cube', color: '#F59E0B', title: 'Order Delivered', desc: 'Vendor ships — driver delivers to your doorstep' },
                            { icon: 'checkmark-circle', color: '#10B981', title: 'You Confirm', desc: 'Vendor gets paid only after your approval' },
                            { icon: 'refresh-circle', color: '#EF4444', title: 'Dispute Protection', desc: 'Full refund if order is not as described' },
                        ].map((item, i) => (
                            <Row key={i} style={{ gap: 12, marginBottom: 14, alignItems: 'flex-start' }}>
                                <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: `${item.color}18`, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name={item.icon} size={18} color={item.color} />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>{item.title}</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>{item.desc}</Text>
                                </View>
                            </Row>
                        ))}

                        <TouchableOpacity onPress={() => setShowEscrow(false)} style={[S.primaryBtn, { backgroundColor: '#10B981' }]}>
                            <Text style={S.primaryBtnTxt}>Got It — Shop Safely 🛡️</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </Animated.View>
    );
};

// ─── Wrapper (export) ─────────────────────────────────────────────────────────
export const WalletPage = ({ user, onBack, onNavigate }) => (
    <WalletPageInner user={user} onBack={onBack} onNavigate={onNavigate} />
);

export default WalletPage;

// ─── Styles ───────────────────────────────────────────────────────────────────
const S = StyleSheet.create({
    root:          { flex: 1, backgroundColor: '#F8FAFC' },
    center:        { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' },
    loadTxt:       { marginTop: 10, color: '#64748B', fontWeight: '700', fontSize: 13 },
    scroll:        { paddingBottom: 20 },

    // Header
    header:        { flexDirection: 'row', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 54 : 20, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0', gap: 12 },
    backBtn:       { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    backBtnFull:   { marginTop: 20, backgroundColor: '#0F172A', paddingHorizontal: 32, paddingVertical: 14, borderRadius: 14 },
    headerTitle:   { fontSize: 17, fontWeight: '900', color: '#0F172A' },
    headerSub:     { fontSize: 11, color: '#64748B', fontWeight: '600' },

    // Card
    card:          { margin: 16, borderRadius: 22, padding: 22, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
    cardLabel:     { fontSize: 11, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 4 },
    cardBalance:   { fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: -0.5 },
    cardChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20, borderWidth: 1 },
    cardChipTxt:   { fontSize: 11, fontWeight: '700' },
    cardMicro:     { fontSize: 10, color: 'rgba(255,255,255,0.55)', fontWeight: '600' },
    currBtn:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    currBtnTxt:    { fontSize: 9.5, fontWeight: '800' },

    // Actions
    actionsRow:    { flexDirection: 'row', justifyContent: 'space-around', backgroundColor: '#FFFFFF', paddingVertical: 16, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    actionBtn:     { alignItems: 'center', gap: 6, flex: 1 },
    actionIcon:    { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
    actionLabel:   { fontSize: 10, fontWeight: '800', letterSpacing: 0.2 },

    // Section
    section:       { margin: 16, marginBottom: 0, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#E2E8F0' },
    sectionTitle:  { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    sectionSub:    { fontSize: 11, color: '#64748B', fontWeight: '600' },
    pillBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, borderWidth: 1, borderColor: '#10B981' },
    pillBtnTxt:    { fontSize: 11, fontWeight: '700' },

    // Savings pot
    potCard:       { borderLeftWidth: 4, backgroundColor: '#F8FAFC', borderRadius: 12, padding: 12, marginBottom: 10 },
    potName:       { fontSize: 13, fontWeight: '800', color: '#0F172A' },
    potSub:        { fontSize: 11, color: '#64748B', fontWeight: '600', marginTop: 1 },
    potBtn:        { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },

    // Transactions
    txRow:         { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    txDesc:        { fontSize: 13, fontWeight: '700', color: '#0F172A' },
    txDate:        { fontSize: 11, color: '#94A3B8', fontWeight: '600', marginTop: 2 },
    txAmt:         { fontSize: 14, fontWeight: '900' },
    emptyTx:       { alignItems: 'center', paddingVertical: 32, gap: 10 },
    emptyTxTxt:    { fontSize: 14, color: '#94A3B8', fontWeight: '700' },

    // Filters
    filterBtn:     { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: '#F1F5F9' },
    filterBtnActive:{ backgroundColor: '#0F172A' },
    filterBtnTxt:  { fontSize: 10, fontWeight: '800', color: '#64748B' },
    searchBox:     { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F8FAFC', borderRadius: 10, paddingHorizontal: 12, height: 38, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 10 },
    searchInput:   { flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '600' },

    // Modals
    modalBg:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
    modalSheet:    { backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 22, maxHeight: '92%' },
    modalTitle:    { fontSize: 17, fontWeight: '900', color: '#0F172A' },
    closeBtn:      { width: 34, height: 34, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    // Gateway card
    gwCard:        { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 12, marginBottom: 8 },
    gwIcon:        { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    gwName:        { fontSize: 13, fontWeight: '800' },
    gwSub:         { fontSize: 11, color: '#64748B', marginTop: 2 },
    gwSpeed:       { fontSize: 10, color: '#94A3B8', fontWeight: '600', marginTop: 2 },

    // Input
    inputLabel:    { fontSize: 11, fontWeight: '800', color: '#374151', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
    amtInput:      { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 14, fontSize: 20, fontWeight: '900', color: '#0F172A', backgroundColor: '#F8FAFC' },
    textInput:     { borderWidth: 1.5, borderColor: '#E2E8F0', borderRadius: 12, padding: 13, fontSize: 14, fontWeight: '600', color: '#0F172A', backgroundColor: '#F8FAFC' },
    convertHint:   { fontSize: 12, color: '#10B981', fontWeight: '700', marginTop: 4, marginBottom: 8 },
    quickBtn:      { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    quickBtnActive:{ backgroundColor: '#0F172A', borderColor: '#0F172A' },
    quickBtnTxt:   { fontSize: 12, fontWeight: '700', color: '#374151' },
    quickBtnTxtActive: { color: '#FFFFFF', fontWeight: '900' },

    // Modern Capsule Input ("rawani a ciki")
    modernInputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingHorizontal: 10,
        height: 52,
        shadowColor: '#000',
        shadowOpacity: 0.03,
        shadowRadius: 5,
        shadowOffset: { width: 0, height: 2 },
        elevation: 1,
    },
    modernInputBoxFocused: {
        borderColor: '#2563EB',
        backgroundColor: '#FFFFFF',
        shadowOpacity: 0.1,
        shadowRadius: 8,
        shadowColor: '#2563EB',
        elevation: 2,
    },
    inputIconBadge: {
        width: 36,
        height: 36,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
    },
    modernTextInput: {
        flex: 1,
        fontSize: 14.5,
        fontWeight: '700',
        color: '#0F172A',
        height: '100%',
    },

    // Direct Corporate Bank Account Styles
    directBankWrap: {
        marginTop: 14,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    directBankTitle: { fontSize: 12.5, fontWeight: '800', color: '#0369A1' },
    directBankSub:   { fontSize: 11, color: '#64748B', marginTop: 2, marginBottom: 8 },
    directBankDetailsBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    directBankRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    directBankLabel: { fontSize: 11.5, color: '#64748B', fontWeight: '600' },
    directBankVal:   { fontSize: 12, fontWeight: '800', color: '#0F172A' },
    miniCopyBtn:     { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#E0F2FE', paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6 },
    whatsappHelpBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#86EFAC',
        borderRadius: 10,
        paddingVertical: 9,
        marginTop: 8,
    },
    whatsappHelpTxt: { fontSize: 11.5, fontWeight: '800', color: '#15803D' },

    // Virtual account
    vaBox:         { backgroundColor: '#F0F9FF', borderRadius: 14, padding: 14, marginTop: 8, borderWidth: 1, borderColor: '#BAE6FD' },
    vaLabel:       { fontSize: 9, fontWeight: '800', color: '#0284C7', letterSpacing: 1, marginBottom: 10 },
    vaDetail:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderColor: '#E0F2FE' },
    vaKey:         { fontSize: 12, color: '#64748B', fontWeight: '600' },
    vaVal:         { fontSize: 13, fontWeight: '800', color: '#0F172A', textAlign: 'right', flex: 1, marginLeft: 10 },
    syncBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#6366F1', borderRadius: 10, paddingVertical: 10, justifyContent: 'center', marginTop: 12 },
    syncBtnTxt:    { color: 'white', fontWeight: '800', fontSize: 13 },
    retryBtn:      { borderRadius: 10, borderWidth: 1.5, borderColor: '#6366F1', paddingVertical: 10, alignItems: 'center' },

    // Buttons
    primaryBtn:    { backgroundColor: '#0F172A', borderRadius: 14, paddingVertical: 15, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 },
    primaryBtnTxt: { color: 'white', fontWeight: '900', fontSize: 15 },

    // Info box
    infoBox:       { flexDirection: 'row', gap: 8, backgroundColor: '#EFF6FF', padding: 11, borderRadius: 10, alignItems: 'flex-start' },

    // Modern Gateway card styles
    modernGwCard:  { flexDirection: 'row', alignItems: 'center', borderRadius: 16, borderWidth: 1.5, borderColor: '#E2E8F0', padding: 12, backgroundColor: '#FAFAFA', position: 'relative', overflow: 'hidden' },
    gwAccentLine:  { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    gwLogoWrap:    { width: 44, height: 44, borderRadius: 12, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center', padding: 4, overflow: 'hidden' },
    gwLogoImg:     { width: 34, height: 34 },
    modernGwTitle: { fontSize: 13, fontWeight: '800', color: '#1E293B' },
    modernGwSub:   { fontSize: 11, color: '#64748B', marginTop: 1 },
    gwBadge:       { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, borderWidth: 1 },
    gwBadgeTxt:    { fontSize: 8.5, fontWeight: '800', letterSpacing: 0.5 },
    gwChip:        { backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    gwChipTxt:     { fontSize: 9.5, color: '#475569', fontWeight: '700' },
    gwRadio:       { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' },

    // Crypto Coin Tags
    coinTag:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#EFF6FF', borderWidth: 1, borderColor: '#BFDBFE', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    coinTagTxt:    { fontSize: 10.5, fontWeight: '700', color: '#1D4ED8' },

    // Virtual Account Loading
    vaLoadingBox:  { padding: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F0FDF4', borderRadius: 16, borderWidth: 1, borderColor: '#BBF7D0' },
    vaLoadingTxt:  { fontSize: 13, fontWeight: '700', color: '#166534', marginTop: 8 },

    // Luxury ATM Card
    vaAtmCard:     { borderRadius: 18, padding: 18, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 12, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
    atmChip:       { width: 30, height: 22, borderRadius: 5, backgroundColor: '#D97706', padding: 2, justifyContent: 'center' },
    atmChipInner:  { width: '100%', height: '100%', borderRadius: 3, borderWidth: 1, borderColor: '#FDE68A', borderStyle: 'dashed' },
    atmBankName:   { fontSize: 14, fontWeight: '900', color: '#F8FAFC', letterSpacing: 1 },
    atmVerifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(16,185,129,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginTop: 2 },
    atmVerifiedTxt:{ fontSize: 8.5, fontWeight: '800', color: '#34D399', letterSpacing: 0.5 },
    atmAccLabel:   { fontSize: 9.5, color: 'rgba(255,255,255,0.6)', fontWeight: '700', letterSpacing: 1, marginTop: 8 },
    atmAccNum:     { fontSize: 22, fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 },
    atmCopyBtn:    { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FCD34D', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
    atmCopyBtnTxt: { fontSize: 11, fontWeight: '900', color: '#0F172A' },
    atmHolderLabel:{ fontSize: 8.5, color: 'rgba(255,255,255,0.55)', fontWeight: '700', letterSpacing: 0.5 },
    atmHolderName: { fontSize: 12, fontWeight: '800', color: '#F1F5F9', marginTop: 1 },
    atmSettlementTxt:{ fontSize: 10.5, fontWeight: '700', color: '#34D399' },

    // Virtual Account Notice & Action Buttons
    vaNoticeBox:   { flexDirection: 'row', gap: 8, alignItems: 'center', backgroundColor: '#ECFDF5', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#A7F3D0', marginTop: 10 },
    vaNoticeTxt:   { fontSize: 11.5, color: '#065F46', fontWeight: '600', flex: 1, lineHeight: 16 },
    reverifyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, backgroundColor: '#F0F9FF', borderWidth: 1, borderColor: '#BAE6FD', justifyContent: 'center' },
    reverifyBtnTxt:{ fontSize: 12, fontWeight: '700', color: '#0284C7' },

    // BVN Verification Form
    bvnCard:       { backgroundColor: '#FFFFFF', borderRadius: 18, padding: 16, borderWidth: 1.5, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    bvnIconCircle: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#ECFDF5', alignItems: 'center', justifyContent: 'center' },
    bvnTitle:      { fontSize: 14, fontWeight: '900', color: '#0F172A' },
    bvnSub:        { fontSize: 11, color: '#64748B', marginTop: 1 },
    bvnCbnNote:    { flexDirection: 'row', gap: 8, backgroundColor: '#F0F9FF', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#BAE6FD', marginTop: 4 },
    bvnCbnNoteTxt: { fontSize: 11, color: '#0369A1', lineHeight: 15, flex: 1, fontWeight: '500' },
    bvnErrorBox:   { flexDirection: 'row', gap: 8, backgroundColor: '#FEF2F2', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA', marginTop: 8 },
    bvnErrorTxt:   { fontSize: 11.5, color: '#B91C1C', fontWeight: '600', flex: 1 },
    bvnSecurityBadge: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center', marginTop: 10 },
    bvnSecurityTxt:{ fontSize: 10.5, color: '#059669', fontWeight: '700' },

    // Transaction detail
    detailRow:     { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    detailKey:     { fontSize: 12, color: '#64748B', fontWeight: '600', flex: 1 },
    detailVal:     { fontSize: 12, fontWeight: '700', color: '#0F172A', flex: 2, textAlign: 'right' },
});
