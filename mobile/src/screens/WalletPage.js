/**
 * WalletPage.js — Abu Mafhal Marketplace
 * Ultra-Modern, Clean & Smooth Luxury Wallet
 * No clutter, fast performance, rock-solid database syncing
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
    View, Text, TouchableOpacity, ScrollView, TextInput,
    ActivityIndicator, Alert, RefreshControl, StyleSheet,
    Modal, Platform, Dimensions, Animated, StatusBar
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
        badgeColor: '#059669',
        badgeBg: '#ECFDF5',
        icon: 'business-outline',
        iconColor: '#059669',
        iconBg: '#ECFDF5',
    },
    {
        id: 'paystack',
        name: 'Paystack Checkout',
        subtitle: 'Cards · Bank Transfer · USSD · Apple Pay',
        badge: 'AUTO-VERIFY',
        badgeColor: '#0284C7',
        badgeBg: '#F0F9FF',
        icon: 'card-outline',
        iconColor: '#0284C7',
        iconBg: '#F0F9FF',
    },
    {
        id: 'flutterwave',
        name: 'Flutterwave Africa',
        subtitle: 'Cards · Direct Bank · Mobile Money',
        badge: 'PAN-AFRICA',
        badgeColor: '#D97706',
        badgeBg: '#FFFBEB',
        icon: 'flash-outline',
        iconColor: '#D97706',
        iconBg: '#FFFBEB',
    },
    {
        id: 'nowpayments',
        name: 'Crypto Top-Up',
        subtitle: 'USDT (TRC20) · BTC · ETH · SOL · BNB',
        badge: 'WEB3 CRYPTO',
        badgeColor: '#8B5CF6',
        badgeBg: '#F5F3FF',
        icon: 'logo-bitcoin',
        iconColor: '#8B5CF6',
        iconBg: '#F5F3FF',
    },
];

// ─── Transaction Item Icon ────────────────────────────────────────────────────
const TxIcon = ({ type }) => {
    const isCredit = type === 'topup' || type === 'credit' || type === 'deposit';
    return (
        <View style={[S.txIconCircle, { backgroundColor: isCredit ? '#ECFDF5' : '#FEF2F2' }]}>
            <Ionicons
                name={isCredit ? 'arrow-down-left' : 'arrow-up-right'}
                size={18}
                color={isCredit ? '#059669' : '#DC2626'}
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
    const [vaLoading, setVaLoading] = useState(false);

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
    const [amountUsd, setAmountUsd] = useState('');
    const [topUpPending, setTopUpPending] = useState(false);

    // WebView for external payment (mobile)
    const [showWebView, setShowWebView] = useState(false);
    const [checkoutUrl, setCheckoutUrl] = useState('');
    const [activeGwName, setActiveGwName] = useState('');

    // Filter for transaction list
    const [txFilter, setTxFilter] = useState('all'); // 'all' | 'credit' | 'debit'

    // Success popup modal
    const [showSuccess, setShowSuccess] = useState(false);
    const [successDetails, setSuccessDetails] = useState(null);

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

    // ── Fetch Wallet Data (Guaranteed valid columns only) ───────────────────────
    const fetchWallet = useCallback(async () => {
        try {
            const uid = await resolveUserId();
            if (!uid) {
                setLoading(false);
                return;
            }

            // Load local cache first for instant smooth display
            try {
                const cached = await AsyncStorage.getItem(`@amf_wallet_${uid}`);
                if (cached) {
                    const c = JSON.parse(cached);
                    if (c?.wallet) setWallet(c.wallet);
                    if (Array.isArray(c?.transactions)) setTransactions(c.transactions);
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
                    .limit(50)
            ]);

            const pData = pRes.status === 'fulfilled' ? pRes.value?.data : null;
            const txData = txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data)
                ? txRes.value.data
                : [];

            if (pData) {
                const dbBal = Number(pData.balance || 0);
                const updatedWallet = { balance: dbBal };
                setWallet(updatedWallet);
                setTransactions(txData);

                // Update persistent local cache
                AsyncStorage.setItem(`@amf_wallet_${uid}`, JSON.stringify({
                    wallet: updatedWallet,
                    transactions: txData,
                    at: Date.now()
                })).catch(() => {});

                // Parse dedicated virtual account
                if (pData.custom_id) {
                    try {
                        const parsed = typeof pData.custom_id === 'string'
                            ? JSON.parse(pData.custom_id)
                            : pData.custom_id;
                        if (parsed?.account_number && isValidVirtualAccount(parsed.account_number)) {
                            setVirtualAcc(parsed);
                            AsyncStorage.setItem(`@amf_va_${uid}`, JSON.stringify(parsed)).catch(() => {});
                        } else {
                            // Invalid or dummy account: wipe cleanly
                            setVirtualAcc(null);
                            AsyncStorage.removeItem(`@amf_va_${uid}`).catch(() => {});
                            supabase.from('profiles').update({ custom_id: null }).eq('id', uid).catch(() => {});
                        }
                    } catch (_) {
                        setVirtualAcc(null);
                    }
                } else {
                    setVirtualAcc(null);
                    AsyncStorage.removeItem(`@amf_va_${uid}`).catch(() => {});
                }
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
            Alert.alert('Invalid BVN', 'Da fatan a shigar da ingantacciyar lambar BVN mai lamba 11 daidai.');
            return;
        }

        const nameToUse = (bvnLegalName.trim() || user?.user_metadata?.full_name || user?.email?.split('@')[0] || '').trim();
        if (!nameToUse) {
            Alert.alert('Legal Name Required', 'Da fatan a sanya cikakken sunanka kamar yadda yake a jikin BVN.');
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
                    'An Kafa Asusunka! 🎉',
                    `An kafa asusunka na din-din-din a ${va.bank_name}!\n\nLambar Asusu: ${va.account_number}\nSunan Asusu: ${va.account_name}\n\nKowanne kudi da ka tura wannan asusun zai shiga wallet dinka nan take.`
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

    // ── Check & Sync Bank Deposits ─────────────────────────────────────────────
    const handleBankSync = async () => {
        setSyncing(true);
        try {
            const uid = await resolveUserId();
            const sync = await PaymentGatewayService.syncFlutterwaveDeposits({
                userId: uid,
                email: user?.email,
                phone: user?.phone || user?.user_metadata?.phone_number
            });

            if (sync?.success && sync?.totalNewAmount > 0) {
                setSuccessDetails({
                    amount: sync.totalNewAmount,
                    reference: sync.uncreditedTxs?.[0]?.flw_ref || `FLW-${Date.now()}`,
                    gateway: 'Flutterwave MFB'
                });
                setShowSuccess(true);
                await fetchWallet();
            } else {
                await fetchWallet();
                Alert.alert(
                    'Deposit Check Complete',
                    'Babu sabon transfer da ya shigo a yanzu. Idan yanzu ka tura kudin, da fatan a jira dakika 30-60 kafin banki ya kammala aikawa.'
                );
            }
        } catch (e) {
            Alert.alert('Sync Error', 'Could not check bank deposits. Please check your connection.');
        } finally {
            setSyncing(false);
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
            return transactions.filter(t => t.type === 'withdrawal' || t.type === 'debit' || t.type === 'wallet_payment');
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
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={{ alignItems: 'center' }}>
                    <Text style={S.topBarTitle}>My Wallet</Text>
                    <View style={S.liveBadge}>
                        <View style={S.liveDot} />
                        <Text style={S.liveText}>SECURE LEDGER</Text>
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
                        color="#10B981"
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
                        colors={['#10B981']}
                        tintColor="#10B981"
                    />
                }
                showsVerticalScrollIndicator={false}
            >
                {/* ─── Hero Balance Card ────────────────────────────────────── */}
                <LinearGradient
                    colors={['#071324', '#0F274B', '#1E3E6E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={S.heroCard}
                >
                    <View style={S.heroTopRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="wallet-outline" size={16} color="#94A3B8" />
                            <Text style={S.heroLabel}>AVAILABLE BALANCE</Text>
                        </View>
                        <TouchableOpacity
                            onPress={() => setHideBalance(!hideBalance)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons
                                name={hideBalance ? 'eye-off-outline' : 'eye-outline'}
                                size={18}
                                color="#94A3B8"
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
                            <Ionicons name="add-circle" size={18} color="#071324" />
                            <Text style={S.topUpPrimaryBtnTxt}>Add Money</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleBankSync}
                            disabled={syncing}
                            style={S.syncFrostedBtn}
                            activeOpacity={0.85}
                        >
                            {syncing ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={16} color="#FFFFFF" />
                                    <Text style={S.syncFrostedBtnTxt}>Sync Deposit</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </LinearGradient>

                {/* ─── Dedicated Bank Card (Virtual Account) ──────────────────── */}
                <View style={S.section}>
                    <Text style={S.sectionTitle}>Permanent Dedicated NUBAN</Text>

                    {isValidVirtualAccount(virtualAcc?.account_number) ? (
                        /* LUXURY ATM CARD VIEW */
                        <LinearGradient
                            colors={['#0F172A', '#1E293B', '#334155']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={S.atmCard}
                        >
                            <View style={S.atmTop}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <View style={S.atmChip} />
                                    <Ionicons name="wifi" size={16} color="#94A3B8" style={{ transform: [{ rotate: '90deg' }] }} />
                                </View>
                                <View style={{ alignItems: 'flex-end' }}>
                                    <Text style={S.atmBankName}>{virtualAcc.bank_name || 'Flutterwave MFB'}</Text>
                                    <View style={S.atmVerifiedBadge}>
                                        <Ionicons name="checkmark-circle" size={11} color="#10B981" />
                                        <Text style={S.atmVerifiedTxt}>VERIFIED DEDICATED</Text>
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
                                    <Ionicons name="copy-outline" size={14} color="#0F172A" />
                                    <Text style={S.atmCopyBtnTxt}>Copy</Text>
                                </TouchableOpacity>
                            </View>

                            <View style={S.atmBottom}>
                                <View>
                                    <Text style={S.atmHolderLabel}>ACCOUNT HOLDER</Text>
                                    <Text style={S.atmHolderName} numberOfLines={1}>
                                        {virtualAcc.account_name || user?.user_metadata?.full_name || 'Verified Member'}
                                    </Text>
                                </View>
                                <View style={S.atmAutoBadge}>
                                    <Ionicons name="flash" size={12} color="#10B981" />
                                    <Text style={S.atmAutoTxt}>0% Fee · Instant</Text>
                                </View>
                            </View>
                        </LinearGradient>
                    ) : (
                        /* ONE-TIME BVN ACTIVATION CARD */
                        <View style={S.bvnCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                                <View style={S.bvnIconWrap}>
                                    <Ionicons name="shield-checkmark" size={20} color="#059669" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={S.bvnCardTitle}>Activate Dedicated Bank Account</Text>
                                    <Text style={S.bvnCardSub}>Enter your BVN once to generate a permanent NUBAN</Text>
                                </View>
                            </View>

                            <View style={S.bvnNotice}>
                                <Ionicons name="information-circle" size={15} color="#0284C7" />
                                <Text style={S.bvnNoticeTxt}>
                                    Per CBN regulations, BVN verification is required once to generate your dedicated Wema / Flutterwave account with automatic instant crediting.
                                </Text>
                            </View>

                            {vaError ? (
                                <View style={S.errorBox}>
                                    <Ionicons name="alert-circle" size={15} color="#DC2626" />
                                    <Text style={S.errorTxt}>{vaError}</Text>
                                </View>
                            ) : null}

                            <View style={{ marginTop: 12 }}>
                                <Text style={S.inputHeader}>Full Legal Name (as on BVN)</Text>
                                <TextInput
                                    style={S.modernInput}
                                    placeholder="Enter your registered legal full name"
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
                                    placeholderTextColor="#94A3B8"
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
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <>
                                            <Ionicons name="shield-checkmark" size={17} color="#FFFFFF" />
                                            <Text style={S.activateBtnTxt}>Verify BVN & Generate Account</Text>
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
                                    <View key={tx.id || idx} style={[S.txRow, !isLast && S.txRowBorder]}>
                                        <TxIcon type={tx.type} />
                                        <View style={S.txInfo}>
                                            <Text style={S.txTitle} numberOfLines={1}>
                                                {tx.description || (isCredit ? 'Bank Deposit' : 'Payment')}
                                            </Text>
                                            <Text style={S.txDate}>
                                                {tx.created_at ? new Date(tx.created_at).toLocaleDateString('en-GB', {
                                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                                                }) : 'Recent'}
                                            </Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={[S.txAmount, { color: isCredit ? '#059669' : '#0F172A' }]}>
                                                {isCredit ? '+' : '-'}{fmt(tx.amount)}
                                            </Text>
                                            <View style={[S.statusPill, { backgroundColor: tx.status === 'completed' ? '#ECFDF5' : '#FFFBEB' }]}>
                                                <Text style={[S.statusTxt, { color: tx.status === 'completed' ? '#059669' : '#D97706' }]}>
                                                    {tx.status || 'completed'}
                                                </Text>
                                            </View>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={S.emptyTxCard}>
                            <Ionicons name="receipt-outline" size={36} color="#CBD5E1" />
                            <Text style={S.emptyTxTitle}>No transactions yet</Text>
                            <Text style={S.emptyTxSub}>Your deposits and payment receipts will show here.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

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
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {/* Amount Input */}
                        <Text style={S.inputHeader}>Enter Amount (₦)</Text>
                        <TextInput
                            style={[S.modernInput, { fontSize: 20, fontWeight: '800', color: '#0F172A' }]}
                            placeholder="₦0.00"
                            placeholderTextColor="#94A3B8"
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
                                <ActivityIndicator color="#FFFFFF" size="small" />
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

            {/* ─── Success Deposit Modal ───────────────────────────────────── */}
            <Modal
                visible={showSuccess}
                transparent
                animationType="fade"
                onRequestClose={() => setShowSuccess(false)}
            >
                <View style={S.modalOverlay}>
                    <View style={[S.modalCard, { alignItems: 'center', paddingVertical: 28 }]}>
                        <View style={S.successIconWrap}>
                            <Ionicons name="checkmark-circle" size={54} color="#059669" />
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

            {/* ─── External Checkout WebView (Mobile Native) ───────────────── */}
            {Platform.OS !== 'web' && (
                <Modal visible={showWebView} transparent={false} animationType="slide" onRequestClose={() => setShowWebView(false)}>
                    <View style={{ flex: 1, backgroundColor: '#071324' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', padding: 14, paddingTop: 45, gap: 12 }}>
                            <TouchableOpacity onPress={() => setShowWebView(false)} style={{ padding: 6 }}>
                                <Ionicons name="close" size={24} color="#FFFFFF" />
                            </TouchableOpacity>
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 16, flex: 1 }}>{activeGwName} Checkout</Text>
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

// ─── Stylesheet ───────────────────────────────────────────────────────────────
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
        backgroundColor: '#071324',
    },
    backBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBarTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
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
        backgroundColor: '#10B981',
    },
    liveText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.8,
    },
    syncIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(16,185,129,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    scroll: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
    },

    // Hero Card
    heroCard: {
        borderRadius: 24,
        padding: 20,
        marginBottom: 18,
        shadowColor: '#071324',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 14,
        elevation: 6,
    },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    heroLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 1,
    },
    heroBalanceText: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
        marginVertical: 14,
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
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: '#10B981',
    },
    topUpPrimaryBtnTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: '#071324',
    },
    syncFrostedBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.15)',
    },
    syncFrostedBtnTxt: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
    },

    // Section
    section: {
        marginBottom: 20,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 10,
        letterSpacing: 0.2,
    },

    // ATM Card
    atmCard: {
        borderRadius: 20,
        padding: 20,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 4,
    },
    atmTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    atmChip: {
        width: 32,
        height: 24,
        borderRadius: 5,
        backgroundColor: '#FCD34D',
    },
    atmBankName: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    atmVerifiedBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 2,
    },
    atmVerifiedTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: '#10B981',
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
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
    },
    atmCopyBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0F172A',
    },
    atmBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
        marginTop: 14,
        paddingTop: 12,
        borderTopWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    atmHolderLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.8,
    },
    atmHolderName: {
        fontSize: 13,
        fontWeight: '800',
        color: '#FFFFFF',
        marginTop: 2,
        maxWidth: W * 0.5,
    },
    atmAutoBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(16,185,129,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
    },
    atmAutoTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#10B981',
    },

    // BVN Card
    bvnCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOpacity: 0.04,
        shadowRadius: 8,
        elevation: 2,
    },
    bvnIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
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
        backgroundColor: '#F0F9FF',
        padding: 10,
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#BAE6FD',
    },
    bvnNoticeTxt: {
        fontSize: 11,
        color: '#0369A1',
        lineHeight: 16,
        flex: 1,
        fontWeight: '500',
    },
    errorBox: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: '#FEF2F2',
        padding: 10,
        borderRadius: 12,
        marginTop: 8,
        borderWidth: 1,
        borderColor: '#FECACA',
    },
    errorTxt: {
        fontSize: 11.5,
        color: '#B91C1C',
        flex: 1,
        fontWeight: '600',
    },
    inputHeader: {
        fontSize: 11,
        fontWeight: '800',
        color: '#475569',
        marginBottom: 4,
        textTransform: 'uppercase',
    },
    dialTip: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0284C7',
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
        backgroundColor: '#059669',
        paddingVertical: 13,
        borderRadius: 14,
        marginTop: 14,
    },
    activateBtnTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
    },

    // Transactions
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
    },
    filterTab: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    filterTabActive: {
        backgroundColor: '#FFFFFF',
        shadowColor: '#000',
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1,
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
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
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
        color: '#94A3B8',
        marginTop: 2,
    },
    txAmount: {
        fontSize: 13.5,
        fontWeight: '900',
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
        color: '#475569',
        marginTop: 8,
    },
    emptyTxSub: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 4,
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(15,23,42,0.7)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 22,
        maxHeight: '90%',
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
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
    },
    presetChipTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#334155',
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
        borderColor: '#10B981',
        backgroundColor: '#F0FDF4',
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
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioCircleActive: {
        borderColor: '#10B981',
    },
    radioInner: {
        width: 9,
        height: 9,
        borderRadius: 4.5,
        backgroundColor: '#10B981',
    },
    modalPayBtn: {
        backgroundColor: '#10B981',
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
        color: '#0F172A',
    },
    successAmount: {
        fontSize: 28,
        fontWeight: '900',
        color: '#059669',
        marginVertical: 8,
    },
    successSub: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        paddingHorizontal: 20,
    },
});

export default WalletPage;
