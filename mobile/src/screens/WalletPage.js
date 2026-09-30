/**
 * WalletPage.js — Abu Mafhal Marketplace
 * Ultra-Modern Luxury VIP Wallet in Deep Navy & Metallic Gold
 * Seamless performance, rock-solid database ledger, complete transaction receipt details
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, RefreshControl, StyleSheet,
    Modal, Platform, Dimensions, StatusBar, KeyboardAvoidingView
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { WebView } from 'react-native-webview';
import { PaymentGatewayService } from '../services/paymentGatewayService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width: W } = Dimensions.get('window');

// ─── Formatting & Helpers ─────────────────────────────────────────────────────
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

// ─── Blocked / Dummy Accounts Filter ──────────────────────────────────────────
const BLOCKED_ACCOUNTS = new Set(['9187255635', '9282617835', '0000000000', '1111111111']);
const isValidVirtualAccount = (acc) => {
    if (!acc) return false;
    const s = String(acc).trim();
    if (s.length < 10) return false;
    if (BLOCKED_ACCOUNTS.has(s)) return false;
    if (/^(\d)\1{9,}$/.test(s)) return false;
    if (s.startsWith('980')) return false;
    return true;
};

// ─── Supported Gateways ───────────────────────────────────────────────────────
const GATEWAYS = [
    {
        id: 'bank_transfer',
        name: 'Dedicated Bank Transfer',
        subtitle: 'Direct NUBAN Transfer · Instant Auto-Credit',
        badge: '0% FEE · INSTANT',
        badgeColor: '#D4AF37',
        badgeBg: 'rgba(212, 175, 55, 0.12)',
        icon: 'business-outline',
        iconColor: '#D4AF37',
        iconBg: 'rgba(212, 175, 55, 0.15)',
    },
    {
        id: 'paystack',
        name: 'Paystack Checkout',
        subtitle: 'Cards · Bank Transfer · USSD · Apple Pay',
        badge: 'AUTO-VERIFY',
        badgeColor: '#38BDF8',
        badgeBg: 'rgba(56, 189, 248, 0.12)',
        icon: 'card-outline',
        iconColor: '#38BDF8',
        iconBg: 'rgba(56, 189, 248, 0.15)',
    },
    {
        id: 'flutterwave',
        name: 'Flutterwave Africa',
        subtitle: 'Cards · Direct Bank · Mobile Money',
        badge: 'PAN-AFRICA',
        badgeColor: '#F59E0B',
        badgeBg: 'rgba(245, 158, 11, 0.12)',
        icon: 'flash-outline',
        iconColor: '#F59E0B',
        iconBg: 'rgba(245, 158, 11, 0.15)',
    },
    {
        id: 'nowpayments',
        name: 'Crypto Top-Up',
        subtitle: 'USDT (TRC20) · BTC · ETH · SOL · BNB',
        badge: 'WEB3 CRYPTO',
        badgeColor: '#A855F7',
        badgeBg: 'rgba(168, 85, 247, 0.12)',
        icon: 'logo-bitcoin',
        iconColor: '#A855F7',
        iconBg: 'rgba(168, 85, 247, 0.15)',
    },
];

// ─── Transaction Item Icon ────────────────────────────────────────────────────
const TxIcon = ({ type }) => {
    const isCredit = type === 'topup' || type === 'credit' || type === 'deposit';
    return (
        <View style={[S.txIconCircle, { backgroundColor: isCredit ? 'rgba(212, 175, 55, 0.15)' : 'rgba(239, 68, 68, 0.15)' }]}>
            <Ionicons
                name={isCredit ? 'arrow-down-left' : 'arrow-up-right'}
                size={18}
                color={isCredit ? '#D4AF37' : '#EF4444'}
            />
        </View>
    );
};

// ─── Main Wallet Component ────────────────────────────────────────────────────
export const WalletPage = ({ user, onBack }) => {
    const [wallet, setWallet] = useState({ balance: 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [hideBalance, setHideBalance] = useState(false);
    const [syncing, setSyncing] = useState(false);

    // Dedicated Virtual Account state
    const [virtualAcc, setVirtualAcc] = useState(null);

    // BVN Form state (only shown if user has no account yet)
    const [bvnInput, setBvnInput] = useState('');
    const [bvnLegalName, setBvnLegalName] = useState('');
    const [bvnPhone, setBvnPhone] = useState('');
    const [bvnVerifying, setBvnVerifying] = useState(false);
    const [vaError, setVaError] = useState('');

    // Top-up modal state
    const [showTopUp, setShowTopUp] = useState(false);
    const [gateway, setGateway] = useState('bank_transfer');
    const [amountNgn, setAmountNgn] = useState('');
    const [topUpPending, setTopUpPending] = useState(false);

    // WebView for external payment (mobile)
    const [showWebView, setShowWebView] = useState(false);
    const [checkoutUrl, setCheckoutUrl] = useState('');
    const [activeGwName, setActiveGwName] = useState('');

    // Filter for transaction list
    const [txFilter, setTxFilter] = useState('all'); // 'all' | 'credit' | 'debit'

    // Selected Transaction for Full Details Modal
    const [selectedTx, setSelectedTx] = useState(null);

    // Success popup modal
    const [showSuccess, setShowSuccess] = useState(false);
    const [successDetails, setSuccessDetails] = useState(null);

    // Manual Reference Verification Modal state
    const [showManualVerifyModal, setShowManualVerifyModal] = useState(false);
    const [manualRefInput, setManualRefInput] = useState('');
    const [manualVerifying, setManualVerifying] = useState(false);
    const [manualVerifyError, setManualVerifyError] = useState('');

    // Resolve User ID securely
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

    // ── Fetch Wallet Data (Guaranteed instant cache & valid columns) ───────────
    const fetchWallet = useCallback(async () => {
        try {
            const uid = await resolveUserId();
            if (!uid) {
                setLoading(false);
                return;
            }

            // Load local cache first for instant smooth display (prevents 0 flash on refresh)
            try {
                const cached = await AsyncStorage.getItem(`@amf_wallet_${uid}`);
                if (cached) {
                    const c = JSON.parse(cached);
                    if (c?.wallet) setWallet(c.wallet);
                    if (Array.isArray(c?.transactions)) setTransactions(c.transactions);
                    if (c?.virtualAcc) setVirtualAcc(c.virtualAcc);
                }
            } catch (_) {}

            // Query authoritative database profile & transactions
            const [pRes, txRes] = await Promise.allSettled([
                supabase.from('profiles')
                    .select('id, balance, email, full_name, phone, custom_id')
                    .eq('id', uid)
                    .maybeSingle(),
                supabase.from('transactions')
                    .select('*')
                    .eq('user_id', uid)
                    .order('created_at', { ascending: false })
                    .limit(60)
            ]);

            const pData = pRes.status === 'fulfilled' ? pRes.value?.data : null;
            const txData = txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data)
                ? txRes.value.data
                : [];

            if (pData) {
                const dbBal = Number(pData.balance || 0);

                // Reconcile with verified ledger balance
                const credits = txData
                    .filter(t => (t.type === 'topup' || t.type === 'credit' || t.type === 'deposit') && (t.status === 'completed' || t.status === 'successful'))
                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                const debits = txData
                    .filter(t => (t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase') && (t.status === 'completed' || t.status === 'successful'))
                    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

                const ledgerBal = Math.max(0, credits - debits);
                const finalBal = Math.max(dbBal, ledgerBal);
                const updatedWallet = { balance: finalBal };

                setWallet(updatedWallet);
                setTransactions(txData);

                // Dedicated virtual account
                let currentVa = null;
                if (pData.custom_id) {
                    try {
                        const parsed = typeof pData.custom_id === 'string'
                            ? JSON.parse(pData.custom_id)
                            : pData.custom_id;
                        if (parsed?.account_number && isValidVirtualAccount(parsed.account_number)) {
                            currentVa = parsed;
                            setVirtualAcc(parsed);
                        } else {
                            setVirtualAcc(null);
                        }
                    } catch (_) {
                        setVirtualAcc(null);
                    }
                } else {
                    setVirtualAcc(null);
                }

                // Update persistent local cache
                AsyncStorage.setItem(`@amf_wallet_${uid}`, JSON.stringify({
                    wallet: updatedWallet,
                    transactions: txData,
                    virtualAcc: currentVa,
                    at: Date.now()
                })).catch(() => {});
            }
        } catch (err) {
            console.warn('[Wallet] fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [resolveUserId]);

    // Initial mount load
    useEffect(() => {
        fetchWallet();
    }, [fetchWallet]);

    // Pull-to-refresh
    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchWallet();
    }, [fetchWallet]);

    // ── Generate Dedicated Virtual Account with Valid BVN (One-time) ───────────
    const handleVerifyBvnAndGenerate = async () => {
        const cleanBvn = String(bvnInput || '').trim().replace(/[^0-9]/g, '');
        if (cleanBvn.length !== 11 || /^(\d)\1{10}$/.test(cleanBvn)) {
            Alert.alert('Invalid BVN', 'Please enter a valid 11-digit BVN number.');
            return;
        }

        const nameToUse = (bvnLegalName.trim() || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '').trim();
        if (!nameToUse) {
            Alert.alert('Legal Name Required', 'Please enter your full legal name exactly as it appears on your BVN.');
            return;
        }

        setBvnVerifying(true);
        setVaError('');

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
                if (uid) {
                    await AsyncStorage.setItem(`@amf_va_${uid}`, JSON.stringify(va)).catch(() => {});
                    await supabase.from('profiles').update({ custom_id: JSON.stringify(va) }).eq('id', uid).catch(() => {});
                }
                Alert.alert(
                    'Account Activated! 🎉',
                    `Your dedicated account at ${va.bank_name} is ready!\n\nAccount Number: ${va.account_number}\nAccount Name: ${va.account_name}\n\nAny funds transferred to this account will credit your wallet instantly.`
                );
                await fetchWallet();
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

    // ── Check & Sync Bank Deposits (Strict Deduplication, Zero Phantom Additions) ─
    const handleBankSync = async () => {
        setSyncing(true);
        try {
            const uid = await resolveUserId();
            const sync = await PaymentGatewayService.syncFlutterwaveDeposits({
                userId: uid,
                email: user?.email,
                phone: user?.phone || user?.user_metadata?.phone_number
            });

            if (sync?.success && sync?.totalNewAmount > 0 && Array.isArray(sync?.newTxIds) && sync.newTxIds.length > 0) {
                setSuccessDetails({
                    amount: sync.totalNewAmount,
                    reference: sync.uncreditedTxs?.[0]?.flw_ref || `FLW-${sync.newTxIds[0]}`,
                    gateway: 'Flutterwave MFB / Bank Transfer'
                });
                setShowSuccess(true);
                await fetchWallet();
            } else {
                await fetchWallet();
                Alert.alert(
                    'Deposit Check Complete',
                    'No new incoming transfer detected. If you just sent money, please allow 1–2 minutes for interbank settlement, or tap "Verify Ref" if you have a Session ID.'
                );
            }
        } catch (e) {
            Alert.alert('Sync Error', 'Could not check bank deposits. Please check your connection.');
        } finally {
            setSyncing(false);
        }
    };

    // ── Manual Reference / Session ID Verification (1-Click Instant Verify) ─────
    const handleManualVerify = async () => {
        const cleanRef = manualRefInput.trim();
        if (!cleanRef) {
            setManualVerifyError('Please enter a valid Transaction Reference or Session ID.');
            return;
        }
        setManualVerifying(true);
        setManualVerifyError('');
        try {
            const uid = await resolveUserId();
            const res = await PaymentGatewayService.syncFlutterwaveDeposits({
                userId: uid,
                email: user?.email,
                phone: user?.phone || user?.user_metadata?.phone_number,
                reference: cleanRef
            });

            if (res?.success && res?.totalNewAmount > 0) {
                setShowManualVerifyModal(false);
                setManualRefInput('');
                setSuccessDetails({
                    amount: res.totalNewAmount,
                    reference: cleanRef,
                    gateway: 'Flutterwave / Bank Transfer'
                });
                setShowSuccess(true);
                await fetchWallet();
            } else if (res?.message?.includes('already credited')) {
                setManualVerifyError('This transaction has already been credited to your wallet.');
                await fetchWallet();
            } else {
                setManualVerifyError('Transaction not found yet. Interbank settlement can take 1–3 minutes. Please ensure the reference is correct and retry shortly.');
                await fetchWallet();
            }
        } catch (err) {
            setManualVerifyError(err.message || 'Verification failed. Please check your network connection.');
        } finally {
            setManualVerifying(false);
        }
    };

    // ── Initiate Top-Up ────────────────────────────────────────────────────────
    const handleTopUp = async () => {
        if (gateway === 'bank_transfer') {
            if (isValidVirtualAccount(virtualAcc?.account_number)) {
                const details = `Bank: ${virtualAcc.bank_name}\nAccount: ${virtualAcc.account_number}\nName: ${virtualAcc.account_name}`;
                copyText(details, 'Bank Details');
                Alert.alert('Transfer Details Copied 📋', `${details}\n\nTransfer from any Nigerian bank (OPay, Kuda, PalmPay, GTBank, Zenith, Access). Your wallet credits automatically in 30–60 seconds.`);
            }
            setShowTopUp(false);
            return;
        }

        const ngnAmt = cleanNum(amountNgn);
        if (ngnAmt < 100) {
            Alert.alert('Invalid Amount', 'Minimum top-up is ₦100');
            return;
        }

        setTopUpPending(true);
        try {
            const uid = await resolveUserId();
            const gwObj = GATEWAYS.find(g => g.id === gateway);
            const gwTitle = gwObj ? gwObj.name : gateway;
            setActiveGwName(gwTitle);

            const res = await PaymentGatewayService.initiate({
                gateway,
                amount: ngnAmt,
                email: user?.email || 'customer@abumafhal.com',
                phone: user?.phone || user?.user_metadata?.phone_number || '',
                name: user?.user_metadata?.full_name || 'Abu Mafhal User',
                metadata: {
                    action: 'wallet_topup',
                    user_id: uid,
                    credited_ngn: ngnAmt
                }
            });

            const link = res?.checkoutUrl || res?.data?.authorization_url || res?.data?.invoice_url;
            if (!link) throw new Error('Gateway did not return a payment link.');

            setCheckoutUrl(link);
            setShowTopUp(false);

            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.location.href = link;
            } else {
                setShowWebView(true);
            }
        } catch (e) {
            Alert.alert('Payment Error', e.message || 'Could not start payment. Try another gateway.');
        } finally {
            setTopUpPending(false);
        }
    };

    // Filter transactions
    const filteredTransactions = useMemo(() => {
        if (txFilter === 'all') return transactions;
        if (txFilter === 'credit') {
            return transactions.filter(t => t.type === 'topup' || t.type === 'credit' || t.type === 'deposit');
        }
        if (txFilter === 'debit') {
            return transactions.filter(t => t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment' || t.type === 'wallet_purchase');
        }
        return transactions;
    }, [transactions, txFilter]);

    return (
        <View style={S.container}>
            <StatusBar barStyle="light-content" backgroundColor="#071324" />

            {/* ─── Top App Bar ────────────────────────────────────────────── */}
            <View style={S.topBar}>
                <TouchableOpacity
                    onPress={onBack}
                    style={S.backBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={20} color="#D4AF37" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <Text style={S.topBarTitle}>My Wallet</Text>
                    <View style={S.liveBadge}>
                        <View style={S.liveDot} />
                        <Text style={S.liveText}>SECURE ESCROW LEDGER</Text>
                    </View>
                </View>

                <TouchableOpacity
                    onPress={handleBankSync}
                    disabled={syncing}
                    style={S.syncIconBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="sync"
                        size={18}
                        color="#D4AF37"
                        style={syncing ? { transform: [{ rotate: '45deg' }] } : {}}
                    />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={S.scroll}
                contentContainerStyle={S.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        colors={['#D4AF37']}
                        tintColor="#D4AF37"
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Hero Balance Card (Navy & Gold VIP) ───────────────────── */}
                <LinearGradient
                    colors={['#0A192F', '#0F274B', '#162E56']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={S.heroCard}
                >
                    <View style={S.heroTopRow}>
                        <View style={S.heroBadgeWrap}>
                            <Ionicons name="wallet-outline" size={14} color="#D4AF37" />
                            <Text style={S.heroLabel}>AVAILABLE BALANCE</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setHideBalance(!hideBalance)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            style={S.eyeBtn}
                        >
                            <Ionicons
                                name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                                size={18}
                                color="#D4AF37"
                            />
                        </TouchableOpacity>
                    </View>

                    <Text style={S.heroBalanceText}>
                        {hideBalance ? '••••••••' : fmt(wallet.balance)}
                    </Text>

                    <View style={S.heroActionsRow}>
                        <TouchableOpacity
                            onPress={() => setShowTopUp(true)}
                            style={S.topUpPrimaryBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="add-circle" size={17} color="#071324" />
                            <Text style={S.topUpPrimaryBtnTxt}>Add Money</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleBankSync}
                            disabled={syncing}
                            style={S.syncFrostedBtn}
                            activeOpacity={0.85}
                        >
                            {syncing ? (
                                <ActivityIndicator size="small" color="#D4AF37" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={15} color="#D4AF37" />
                                    <Text style={S.syncFrostedBtnTxt}>Sync Deposit</Text>
                                </>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={() => { setManualVerifyError(''); setShowManualVerifyModal(true); }}
                            style={S.verifyRefBtn}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="search" size={15} color="#D4AF37" />
                            <Text style={S.verifyRefBtnTxt}>Verify Ref</Text>
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* ─── Dedicated Bank Card (Virtual Account) ──────────────────── */}
                <View style={S.section}>
                    <View style={S.sectionHeaderRow}>
                        <Text style={S.sectionTitle}>Permanent Dedicated NUBAN</Text>
                        <View style={S.goldTag}>
                            <Ionicons name="shield-checkmark" size={11} color="#D4AF37" />
                            <Text style={S.goldTagTxt}>VERIFIED DEDICATED</Text>
                        </View>
                    </View>

                    {isValidVirtualAccount(virtualAcc?.account_number) ? (
                        <>
                        {/* LUXURY ATM CARD VIEW IN NAVY & GOLD */}
                        <LinearGradient
                            colors={['#081426', '#0E223D', '#163156']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={S.atmCard}
                        >
                            <View style={S.atmTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={S.atmChip} />
                                    <Ionicons name="wifi" size={16} color="#D4AF37" style={{ transform: [{ rotate: '90deg' }] }} />
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={S.atmBankName}>{virtualAcc.bank_name ? `${virtualAcc.bank_name} / Moniepoint` : 'Flutterwave MFB / Moniepoint'}</Text>
                                    <View style={S.atmVerifiedBadge}>
                                        <Ionicons name="checkmark-circle" size={11} color="#D4AF37" />
                                        <Text style={S.atmVerifiedTxt}>0% FEE · INSTANT AUTO-CREDIT</Text>
                                    </View>
                                </View>
                            </View>

                            <View style={S.atmMiddle}>
                                <Text style={S.atmNumber}>
                                    {String(virtualAcc.account_number).replace(/(\d{4})(\d{3})(\d{3})/, '$1  $2  $3')}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => copyText(virtualAcc.account_number, 'Account Number')}
                                    style={S.atmCopyBtn}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="copy-outline" size={14} color="#071324" />
                                    <Text style={S.atmCopyBtnTxt}>Copy</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={S.atmBottom}>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.atmHolderLabel}>ACCOUNT HOLDER</Text>
                                    <Text style={S.atmHolderName} numberOfLines={1}>
                                        {virtualAcc.account_name || user?.user_metadata?.full_name || 'Verified Member'}
                                    </Text>
                                </View>
                                <View style={S.atmAutoBadge}>
                                    <Ionicons name="flash" size={12} color="#D4AF37" />
                                    <Text style={S.atmAutoTxt}>Instant Credit</Text>
                                </View>
                            </View>
                        </LinearGradient>

                        {/* Modern Step-by-Step Transfer Guide */}
                        <View style={S.bankTipBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
                                <View style={S.bankTipIconWrap}>
                                    <Ionicons name="bulb-outline" size={16} color="#D4AF37" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.bankTipTitle}>How to Deposit via Bank App:</Text>
                                    <Text style={S.bankTipTxt}>
                                        • Bank: <Text style={{ fontWeight: '800', color: '#071324' }}>Flutterwave MFB</Text> (or <Text style={{ fontWeight: '800', color: '#071324' }}>Moniepoint MFB</Text>){'\n'}
                                        • Account: <Text style={{ fontWeight: '800', color: '#071324' }}>{virtualAcc.account_number}</Text>{'\n'}
                                        • Name: <Text style={{ fontWeight: '800', color: '#071324' }}>{virtualAcc.account_name || 'Abu Mafhal'}</Text>{'\n'}
                                        • Transfer from any bank (OPay, Kuda, PalmPay, GTB, etc.). Zero fee & instant credit!
                                    </Text>
                                </View>
                            </View>
                        </View>
                        </>
                    ) : (
                        /* ONE-TIME BVN ACTIVATION CARD */
                        <View style={S.bvnCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <View style={S.bvnIconWrap}>
                                    <Ionicons name="shield-checkmark" size={20} color="#D4AF37" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.bvnCardTitle}>Activate Dedicated Bank Account</Text>
                                    <Text style={S.bvnCardSub}>Enter your BVN once to generate a permanent NUBAN</Text>
                                </View>
                            </View>

                            <View style={S.bvnNotice}>
                                <Ionicons name="information-circle" size={15} color="#D4AF37" />
                                <Text style={S.bvnNoticeTxt}>
                                    Per CBN regulations, BVN verification is required once to generate your dedicated Wema / Flutterwave account with automatic instant crediting.
                                </Text>
                            </View>

                            {vaError ? (
                                <View style={S.errorBox}>
                                    <Ionicons name="alert-circle" size={15} color="#EF4444" />
                                    <Text style={S.errorTxt}>{vaError}</Text>
                                </View>
                            ) : null}

                            <View style={{ marginTop: 12 }}>
                                <Text style={S.inputHeader}>Full Legal Name (as on BVN)</Text>
                                <TextInput
                                    style={S.modernInput}
                                    placeholder="Enter your full legal name"
                                    placeholderTextColor="#94A3B8"
                                    value={bvnLegalName}
                                    onChangeText={setBvnLegalName}
                                />

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, marginBottom: 4 }}>
                                    <Text style={S.inputHeader}>11-Digit BVN</Text>
                                    <Text style={S.dialTip}>Dial *565*0#</Text>
                                </View>
                                <TextInput
                                    style={[S.modernInput, { letterSpacing: 2, fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' }]}
                                    placeholder="11-digit BVN"
                                    placeholderTextColor="#64748B"
                                    keyboardType="numeric"
                                    maxLength={11}
                                    value={bvnInput}
                                    onChangeText={(t) => setBvnInput(t.replace(/[^0-9]/g, ''))}
                                />

                                <Text style={[S.inputHeader, { marginTop: 10 }]}>Phone Number</Text>
                                <TextInput
                                    style={S.modernInput}
                                    placeholder={user?.phone || '08012345678'}
                                    placeholderTextColor="#94A3B8"
                                    keyboardType="phone-pad"
                                    value={bvnPhone}
                                    onChangeText={setBvnPhone}
                                />

                                <TouchableOpacity
                                    onPress={handleVerifyBvnAndGenerate}
                                    disabled={bvnVerifying}
                                    style={[S.activateBtn, bvnVerifying && { opacity: 0.7 }]}
                                    activeOpacity={0.85}
                                >
                                    {bvnVerifying ? (
                                        <ActivityIndicator color="#071324" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="shield-checkmark" size={17} color="#071324" />
                                            <Text style={S.activateBtnTxt}>Verify BVN & Issue Account</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* ─── Transactions History ─────────────────────────────────── */}
                <View style={[S.section, { marginBottom: 40 }]}>
                    <View style={S.txHeaderRow}>
                        <Text style={S.sectionTitle}>Recent Transactions</Text>
                        <View style={S.filterTabs}>
                            {['all', 'credit', 'debit'].map((tab) => (
                                <TouchableOpacity
                                    key={tab}
                                    onPress={() => setTxFilter(tab)}
                                    style={[S.filterTab, txFilter === tab && S.filterTabActive]}
                                >
                                    <Text style={[S.filterTabTxt, txFilter === tab && S.filterTabTxtActive]}>
                                        {tab === 'all' ? 'All' : tab === 'credit' ? 'Deposits' : 'Debits'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>

                    {filteredTransactions.length > 0 ? (
                        <View style={S.txListCard}>
                            {filteredTransactions.map((tx, idx) => {
                                const isCredit = tx.type === 'topup' || tx.type === 'credit' || tx.type === 'deposit';
                                const isLast = idx === filteredTransactions.length - 1;
                                return (
                                    <TouchableOpacity
                                        key={tx.id || idx}
                                        onPress={() => setSelectedTx(tx)}
                                        activeOpacity={0.7}
                                        style={[S.txRow, !isLast && S.txRowBorder]}
                                    >
                                        <TxIcon type={tx.type} />
                                        <View style={S.txInfo}>
                                            <Text style={S.txTitle} numberOfLines={1}>
                                                {tx.description || (isCredit ? 'Bank Deposit' : 'Order Payment')}
                                            </Text>
                                            <Text style={S.txDate}>
                                                {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                }) : 'Recent'}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[S.txAmount, { color: isCredit ? '#10B981' : '#EF4444' }]}>
                                                {isCredit ? '+' : '-'}{fmt(tx.amount)}
                                            </Text>
                                            <View style={[S.statusPill, { backgroundColor: tx.status === 'completed' ? 'rgba(16, 185, 129, 0.12)' : 'rgba(245, 158, 11, 0.12)' }]}>
                                                <Text style={[S.statusTxt, { color: tx.status === 'completed' ? '#059669' : '#D97706' }]}>
                                                    {tx.status || 'completed'}
                                                </Text>
                                            </View>
                                        </View>
                                        <Ionicons name="chevron-forward" size={16} color="#64748B" style={{ marginLeft: 4 }} />
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={S.emptyTxCard}>
                            <Ionicons name="receipt-outline" size={36} color="#94A3B8" />
                            <Text style={S.emptyTxTitle}>No transactions yet</Text>
                            <Text style={S.emptyTxSub}>Your incoming deposits and order receipts will appear here automatically.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* ─── FULL TRANSACTION DETAILS / RECEIPT MODAL (NAVY & GOLD) ───── */}
            <Modal
                visible={!!selectedTx}
                transparent
                animationType="slide"
                onRequestClose={() => setSelectedTx(null)}
            >
                <View style={S.modalOverlay}>
                    <View style={S.receiptModalCard}>
                        {/* Receipt Top Header */}
                        <View style={S.receiptHeader}>
                            <View style={S.receiptIconCircle}>
                                <Ionicons
                                    name={selectedTx?.type === 'topup' || selectedTx?.type === 'credit' || selectedTx?.type === 'deposit' ? 'checkmark-circle' : 'receipt'}
                                    size={36}
                                    color="#D4AF37"
                                />
                            </View>
                            <Text style={S.receiptTitle}>Transaction Receipt</Text>
                            <Text style={S.receiptSub}>Official Ledger Audit Details</Text>

                            <Text style={[S.receiptAmount, { color: (selectedTx?.type === 'topup' || selectedTx?.type === 'credit' || selectedTx?.type === 'deposit') ? '#D4AF37' : '#F1F5F9' }]}>
                                {(selectedTx?.type === 'topup' || selectedTx?.type === 'credit' || selectedTx?.type === 'deposit') ? '+' : '-'}{fmt(selectedTx?.amount || 0)}
                            </Text>

                            <View style={S.receiptStatusBadge}>
                                <View style={S.receiptStatusDot} />
                                <Text style={S.receiptStatusTxt}>
                                    {(selectedTx?.status || 'COMPLETED').toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        {/* Receipt Detail Rows */}
                        <View style={S.receiptDetailsBox}>
                            <View style={S.receiptRow}>
                                <Text style={S.receiptLabel}>Reference ID</Text>
                                <TouchableOpacity
                                    onPress={() => copyText(selectedTx?.reference || selectedTx?.id || '', 'Reference')}
                                    style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                >
                                    <Text style={S.receiptValGold} numberOfLines={1}>
                                        {selectedTx?.reference || selectedTx?.id || 'N/A'}
                                    </Text>
                                    <Ionicons name="copy-outline" size={13} color="#D4AF37" />
                                </TouchableOpacity>
                            </View>

                            <View style={S.receiptRow}>
                                <Text style={S.receiptLabel}>Transaction Type</Text>
                                <Text style={S.receiptVal}>
                                    {selectedTx?.type === 'topup' || selectedTx?.type === 'deposit' || selectedTx?.type === 'credit'
                                        ? 'Dedicated Bank Deposit'
                                        : selectedTx?.type === 'wallet_payment'
                                        ? 'Order Escrow Payment'
                                        : (selectedTx?.type || 'Transfer')}
                                </Text>
                            </View>

                            <View style={S.receiptRow}>
                                <Text style={S.receiptLabel}>Channel / Gateway</Text>
                                <Text style={S.receiptVal}>
                                    {selectedTx?.reference?.startsWith('FLW')
                                        ? 'Flutterwave MFB'
                                        : selectedTx?.reference?.startsWith('ORD')
                                        ? 'Escrow Purchase'
                                        : 'Abu Mafhal Wallet'}
                                </Text>
                            </View>

                            <View style={S.receiptRow}>
                                <Text style={S.receiptLabel}>Date & Time</Text>
                                <Text style={S.receiptVal}>
                                    {selectedTx?.created_at
                                        ? new Date(selectedTx.created_at).toLocaleString('en-GB', {
                                            day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit'
                                        })
                                        : 'Recent'}
                                </Text>
                            </View>

                            <View style={[S.receiptRow, { borderBottomWidth: 0 }]}>
                                <Text style={S.receiptLabel}>Narration</Text>
                                <Text style={[S.receiptVal, { flex: 1.5, textAlign: 'right' }]} numberOfLines={2}>
                                    {selectedTx?.description || 'Abu Mafhal Wallet Transaction'}
                                </Text>
                            </View>
                        </View>

                        {/* Security Footer Note */}
                        <View style={S.receiptSecBox}>
                            <Ionicons name="shield-checkmark" size={14} color="#D4AF37" />
                            <Text style={S.receiptSecTxt}>
                                Verified ledger transaction secured with 256-bit bank-grade encryption.
                            </Text>
                        </View>

                        {/* Action Buttons */}
                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                            <TouchableOpacity
                                onPress={() => copyText(
                                    `Transaction Receipt\nAmount: ${fmt(selectedTx?.amount)}\nRef: ${selectedTx?.reference}\nDate: ${selectedTx?.created_at}\nStatus: ${selectedTx?.status}`,
                                    'Receipt'
                                )}
                                style={S.receiptSecBtn}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="copy-outline" size={15} color="#D4AF37" />
                                <Text style={S.receiptSecBtnTxt}>Copy Details</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setSelectedTx(null)}
                                style={S.receiptCloseBtn}
                                activeOpacity={0.85}
                            >
                                <Text style={S.receiptCloseBtnTxt}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* ─── Top-Up Modal (Bottom Sheet Style) ───────────────────────── */}
            <Modal
                visible={showTopUp}
                transparent
                animationType="slide"
                onRequestClose={() => setShowTopUp(false)}
            >
                <View style={S.modalOverlay}>
                    <View style={S.modalCard}>
                        <View style={S.modalHeader}>
                            <Text style={S.modalTitle}>Add Money to Wallet</Text>
                            <TouchableOpacity onPress={() => setShowTopUp(false)} style={S.modalCloseBtn}>
                                <Ionicons name="close" size={20} color="#D4AF37" />
                            </TouchableOpacity>
                        </View>

                        {/* Amount Input */}
                        <Text style={S.inputHeader}>Enter Amount (₦)</Text>
                        <TextInput
                            style={[S.modernInput, { fontSize: 20, fontWeight: '800', color: '#D4AF37' }]}
                            placeholder="₦0.00"
                            placeholderTextColor="#64748B"
                            keyboardType="numeric"
                            value={amountNgn}
                            onChangeText={setAmountNgn}
                        />

                        {/* Quick Presets */}
                        <View style={S.presetRow}>
                            {[1000, 2000, 5000, 10000, 20000].map(v => (
                                <TouchableOpacity
                                    key={v}
                                    onPress={() => setAmountNgn(String(v))}
                                    style={S.presetChip}
                                >
                                    <Text style={S.presetChipTxt}>+{fmt(v)}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        {/* Gateways List */}
                        <Text style={[S.inputHeader, { marginTop: 14 }]}>Select Payment Channel</Text>
                        <View style={{ gap: 8, marginTop: 4 }}>
                            {GATEWAYS.map(gw => (
                                <TouchableOpacity
                                    key={gw.id}
                                    onPress={() => setGateway(gw.id)}
                                    style={[S.gwItem, gateway === gw.id && S.gwItemActive]}
                                    activeOpacity={0.8}
                                >
                                    <View style={[S.gwItemIcon, { backgroundColor: gw.iconBg }]}>
                                        <Ionicons name={gw.icon} size={20} color={gw.iconColor} />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={S.gwItemName}>{gw.name}</Text>
                                        <Text style={S.gwItemSub}>{gw.subtitle}</Text>
                                    </View>
                                    <View style={[S.radioCircle, gateway === gw.id && S.radioCircleActive]}>
                                        {gateway === gw.id && <View style={S.radioInner} />}
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            onPress={handleTopUp}
                            disabled={topUpPending}
                            style={[S.modalPayBtn, topUpPending && { opacity: 0.7 }]}
                            activeOpacity={0.85}
                        >
                            {topUpPending ? (
                                <ActivityIndicator color="#071324" size="small" />
                            ) : (
                                <Text style={S.modalPayBtnTxt}>
                                    {gateway === 'bank_transfer'
                                        ? 'View Bank Transfer Details'
                                        : `Pay ${amountNgn ? fmt(cleanNum(amountNgn)) : ''}`}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ─── Success Deposit Modal (Navy & Gold VIP) ─────────────────── */}
            <Modal
                visible={showSuccess}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSuccess(false)}
            >
                <View style={S.modalOverlay}>
                    <View style={[S.modalCard, { alignItems: 'center', paddingVertical: 28 }]}>
                        <View style={S.successIconWrap}>
                            <Ionicons name="checkmark-circle" size={56} color="#D4AF37" />
                        </View>
                        <Text style={S.successTitle}>Deposit Successful!</Text>
                        <Text style={S.successAmount}>{fmt(successDetails?.amount || 0)}</Text>
                        <Text style={S.successSub}>
                            Has been credited directly to your Abu Mafhal wallet balance.
                        </Text>
                        <TouchableOpacity
                            onPress={() => setShowSuccess(false)}
                            style={[S.modalPayBtn, { width: '100%', marginTop: 20 }]}
                        >
                            <Text style={S.modalPayBtnTxt}>Done</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ─── Manual Verify by Reference Modal (1-Click Instant Verify) ─ */}
            <Modal
                visible={showManualVerifyModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowManualVerifyModal(false)}
            >
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={S.modalOverlay}
                >
                    <View style={S.modalCard}>
                        <View style={S.modalTopRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(212, 175, 55, 0.15)', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="search" size={18} color="#D4AF37" />
                                </View>
                                <View>
                                    <Text style={S.modalTitle}>Verify Transfer</Text>
                                    <Text style={{ fontSize: 11, color: '#64748B' }}>Instant verification via bank ref</Text>
                                </View>
                            </View>
                            <TouchableOpacity
                                onPress={() => setShowManualVerifyModal(false)}
                                style={S.modalClose}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={[S.inputHeader, { marginTop: 14 }]}>Transaction Reference / Session ID</Text>
                        <TextInput
                            value={manualRefInput}
                            onChangeText={(t) => { setManualRefInput(t); setManualVerifyError(''); }}
                            placeholder="e.g. 090405260930010240 or AMF-VA..."
                            placeholderTextColor="#94A3B8"
                            style={S.modernInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />

                        {manualVerifyError ? (
                            <View style={[S.errorBox, { marginTop: 10 }]}>
                                <Ionicons name="alert-circle" size={16} color="#EF4444" />
                                <Text style={S.errorTxt}>{manualVerifyError}</Text>
                            </View>
                        ) : null}

                        <View style={{ marginTop: 12, padding: 12, borderRadius: 12, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <Text style={{ fontSize: 11.5, color: '#475569', lineHeight: 17 }}>
                                💡 <Text style={{ fontWeight: '700' }}>Where to find your reference:</Text> Check your bank debit alert or transfer receipt for the <Text style={{ fontWeight: '700' }}>Session ID</Text> or <Text style={{ fontWeight: '700' }}>Reference</Text>.
                            </Text>
                        </View>

                        <TouchableOpacity
                            onPress={handleManualVerify}
                            disabled={manualVerifying}
                            style={[S.modalPayBtn, { marginTop: 16 }, manualVerifying && { opacity: 0.7 }]}
                            activeOpacity={0.85}
                        >
                            {manualVerifying ? (
                                <ActivityIndicator color="#071324" size="small" />
                            ) : (
                                <Text style={S.modalPayBtnTxt}>Verify & Credit Wallet</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </Modal>

            {/* ─── External Checkout WebView (Mobile Native) ───────────────── */}
            {Platform.OS !== 'web' && (
                <Modal visible={showWebView} transparent={false} animationType="slide" onRequestClose={() => setShowWebView(false)}>
                    <View style={{ flex: 1, backgroundColor: '#071324' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 45, gap: 12 }}>
                            <TouchableOpacity onPress={() => setShowWebView(false)} style={{ padding: 6 }}>
                                <Ionicons name="close" size={24} color="#D4AF37" />
                            </TouchableOpacity>
                            <Text style={{ color: '#D4AF37', fontWeight: '800', fontSize: 16, flex: 1 }}>{activeGwName} Checkout</Text>
                        </View>
                        {checkoutUrl ? (
                            <WebView
                                source={{ uri: checkoutUrl }}
                                style={{ flex: 1 }}
                                onNavigationStateChange={(nav) => {
                                    if (nav.url && (nav.url.includes('status=successful') || nav.url.includes('status=success') || nav.url.includes('payment/callback'))) {
                                        setShowWebView(false);
                                        fetchWallet();
                                        Alert.alert('Payment Completed! 🎉', 'Your wallet has been updated.');
                                    }
                                }}
                            />
                        ) : null}
                    </View>
                </Modal>
            )}
        </View>
    );
};

// ─── Stylesheet (Royal Midnight Navy & Luxury Metallic Gold) ──────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'ios' ? 50 : 16,
        paddingBottom: 16,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 0.3,
    },
    liveBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 2,
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D4AF37',
    },
    liveText: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#D4AF37',
        letterSpacing: 0.8,
    },
    syncIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },

    // Hero Balance Card
    heroCard: {
        borderRadius: 24,
        padding: 22,
        marginBottom: 20,
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.45)',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 16,
        elevation: 8,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroBadgeWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    heroLabel: {
        fontSize: 10,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 1,
    },
    eyeBtn: {
        padding: 6,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    heroBalanceText: {
        fontSize: 36,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
        marginVertical: 14,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    heroActionsRow: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 4,
    },
    topUpPrimaryBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 13,
        borderRadius: 14,
        backgroundColor: '#D4AF37',
        shadowColor: '#D4AF37',
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    topUpPrimaryBtnTxt: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#071324',
    },
    syncFrostedBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 13,
        borderRadius: 14,
        backgroundColor: 'rgba(212, 175, 55, 0.1)',
        borderWidth: 1.5,
        borderColor: 'rgba(212, 175, 55, 0.4)',
    },
    syncFrostedBtnTxt: {
        fontSize: 13,
        fontWeight: '800',
        color: '#D4AF37',
    },

    // Section
    section: {
        marginBottom: 22,
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 0.2,
    },
    goldTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    goldTagTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.5,
    },

    // ATM Card
    atmCard: {
        borderRadius: 22,
        padding: 20,
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        shadowColor: '#D4AF37',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
        elevation: 6,
    },
    atmTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    atmChip: {
        width: 34,
        height: 25,
        borderRadius: 6,
        backgroundColor: '#D4AF37',
        borderWidth: 1,
        borderColor: '#FEF3C7',
    },
    atmBankName: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.5,
    },
    atmVerifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    atmVerifiedTxt: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#FCD34D',
        letterSpacing: 0.5,
    },
    atmMiddle: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginVertical: 10,
    },
    atmNumber: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        letterSpacing: 1.5,
    },
    atmCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#D4AF37',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    atmCopyBtnTxt: {
        fontSize: 11,
        fontWeight: '900',
        color: '#071324',
    },
    atmBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.2)',
    },
    atmHolderLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.8,
    },
    atmHolderName: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2,
    },
    atmAutoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    atmAutoTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#D4AF37',
    },

    // BVN Card
    bvnCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 20,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2,
    },
    bvnIconWrap: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    bvnCardTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
    },
    bvnCardSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    bvnNotice: {
        flexDirection: 'row',
        gap: 8,
        backgroundColor: 'rgba(212, 175, 55, 0.08)',
        padding: 12,
        borderRadius: 12,
        marginTop: 10,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.25)',
    },
    bvnNoticeTxt: {
        fontSize: 11,
        color: '#FCD34D',
        lineHeight: 16,
        flex: 1,
        fontWeight: '500',
    },
    errorBox: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        padding: 10,
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    errorTxt: {
        fontSize: 11.5,
        color: '#EF4444',
        flex: 1,
        fontWeight: '600',
    },
    inputHeader: {
        fontSize: 10.5,
        fontWeight: '800',
        color: '#D4AF37',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    dialTip: {
        fontSize: 11,
        fontWeight: '800',
        color: '#F59E0B',
    },
    modernInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 13,
        color: '#0F172A',
    },
    activateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#D4AF37',
        paddingVertical: 13,
        borderRadius: 14,
        marginTop: 14,
    },
    activateBtnTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: '#071324',
    },

    // Transactions Section
    txHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    filterTabs: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        padding: 3,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    filterTab: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    filterTabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOpacity: 0.06,
        shadowRadius: 4,
        elevation: 2,
    },
    filterTabTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    filterTabTxtActive: {
        color: '#0F172A',
        fontWeight: '900',
    },
    txListCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 2,
    },
    txRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        gap: 12,
    },
    txRowBorder: {
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    txIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    txInfo: {
        flex: 1,
    },
    txTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    txDate: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2,
    },
    txAmount: {
        fontSize: 13.5,
        fontWeight: '900',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 2,
    },
    statusTxt: {
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
    },
    emptyTxCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 32,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyTxTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 8,
    },
    emptyTxSub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
    },

    // Modal Overlays
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 22,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A',
    },
    modalCloseBtn: {
        padding: 4,
    },
    presetRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 8,
    },
    presetChip: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    presetChipTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
    },
    gwItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        backgroundColor: '#FFFFFF',
    },
    gwItemActive: {
        borderColor: '#D4AF37',
        backgroundColor: '#FFFBEB',
    },
    gwItemIcon: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    gwItemName: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0F172A',
    },
    gwItemSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    radioCircle: {
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 2,
        borderColor: '#64748B',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleActive: {
        borderColor: '#D4AF37',
    },
    radioInner: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#D4AF37',
    },
    modalPayBtn: {
        backgroundColor: '#D4AF37',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
    },
    modalPayBtnTxt: {
        fontSize: 14,
        fontWeight: '900',
        color: '#071324',
    },

    // Success Modal
    successIconWrap: {
        marginBottom: 8,
    },
    successTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    successAmount: {
        fontSize: 28,
        fontWeight: '900',
        color: '#D4AF37',
        marginVertical: 8,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    successSub: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        paddingHorizontal: 20,
    },

    // ── Receipt Modal Styles ───────────────────────────────
    receiptModalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 22,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        maxHeight: '92%',
    },
    receiptHeader: {
        alignItems: 'center',
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    receiptIconCircle: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#FEF3C7',
        borderWidth: 1.5,
        borderColor: '#D4AF37',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
    },
    receiptTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
    },
    receiptSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1,
    },
    receiptAmount: {
        fontSize: 32,
        fontWeight: '900',
        marginVertical: 8,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    },
    receiptStatusBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.3)',
    },
    receiptStatusDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#D4AF37',
    },
    receiptStatusTxt: {
        fontSize: 10,
        fontWeight: '900',
        color: '#D4AF37',
        letterSpacing: 0.8,
    },
    receiptDetailsBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 4,
        marginTop: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 11,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
    },
    receiptLabel: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    receiptVal: {
        fontSize: 12.5,
        color: '#0F172A',
        fontWeight: '700',
    },
    receiptValGold: {
        fontSize: 12.5,
        color: '#B45309',
        fontWeight: '900',
        maxWidth: W * 0.45,
    },
    receiptSecBox: {
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        backgroundColor: '#FEF9E7',
        padding: 10,
        borderRadius: 10,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#FDE68A',
    },
    receiptSecTxt: {
        fontSize: 11,
        color: '#92400E',
        flex: 1,
        lineHeight: 15,
        fontWeight: '500',
    },
    receiptSecBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#F1F5F9',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    receiptSecBtnTxt: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#0F172A',
    },
    receiptCloseBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#071324',
    },
    receiptCloseBtnTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: '#D4AF37',
    },
    verifyRefBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(212, 175, 55, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(212, 175, 55, 0.35)',
    },
    verifyRefBtnTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#D4AF37',
    },
    bankTipBox: {
        marginTop: 10,
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    bankTipIconWrap: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(212, 175, 55, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 1,
    },
    bankTipTitle: {
        fontSize: 12,
        fontWeight: '800',
        color: '#071324',
        marginBottom: 3,
    },
    bankTipTxt: {
        fontSize: 11.5,
        color: '#475569',
        lineHeight: 17,
    },
});

export default WalletPage;
