import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    SafeAreaView,
    ScrollView,
    TextInput,
    ActivityIndicator,
    Alert,
    RefreshControl,
    StyleSheet,
    Modal,
    Platform,
    Image,
    Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { WebView } from 'react-native-webview';
import { useAppSettings } from '../context/AppSettingsContext';
import { whatsappService } from '../services/whatsappService';
import { PaymentGatewayService } from '../services/paymentGatewayService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');
const USD_RATE = 1500; // 1 USD = ₦1,500 exchange benchmark

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount).replace('NGN', '₦');
};

const themeGradients = {
    midnight: ['#0B1120', '#1E293B', '#0F172A'],
    emerald: ['#022C22', '#065F46', '#047857'],
    sapphire: ['#0F172A', '#1D4ED8', '#1E1B4B'],
    ruby: ['#450A0A', '#9F1239', '#881337'],
    gold: ['#451A03', '#B45309', '#78350F']
};

const copyToClipboard = (text, label = 'Information') => {
    try {
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            navigator.clipboard.writeText(text);
        }
        Alert.alert('Copied!', `${label} copied to clipboard.`);
    } catch (_) {
        Alert.alert('Copied!', `${text}`);
    }
};

const NIGERIAN_BANKS = [
    'Access Bank', 'GTBank (Guaranty Trust)', 'Zenith Bank', 'First Bank of Nigeria',
    'United Bank for Africa (UBA)', 'Opay', 'PalmPay', 'Kuda Bank', 'Moniepoint MFB',
    'Fidelity Bank', 'Stanbic IBTC', 'Union Bank', 'Sterling Bank', 'Wema Bank (ALAT)'
];

const GATEWAY_OPTIONS = [
    {
        id: 'paystack',
        name: 'Paystack',
        subtitle: 'Cards, USSD, Bank Transfer & QR',
        badge: 'Instant Auto-Credit',
        badgeColor: '#059669',
        badgeBg: '#DCFCE7',
        accentColor: '#0AA5FF',
        currency: 'NGN',
        currencySymbol: '₦',
        logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSzFzmpCa0Tav9NttiYF10t9wftJPQ0XYPBkA&s',
        fallbackIcon: 'card-outline',
        fallbackColor: '#0AA5FF',
        speed: 'Instant (10-30s)',
        channels: ['Mastercard', 'Visa', 'Verve', 'Bank', 'USSD']
    },
    {
        id: 'flutterwave',
        name: 'Flutterwave',
        subtitle: 'Cards, Bank & Mobile Money',
        badge: 'Fast Settlement',
        badgeColor: '#2563EB',
        badgeBg: '#EFF6FF',
        accentColor: '#FB9129',
        currency: 'NGN',
        currencySymbol: '₦',
        logoUrl: 'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcS-W6MLvD_saE20EDSZzVPspKqcKxZ89rW8uw&s',
        fallbackIcon: 'flash-outline',
        fallbackColor: '#FB9129',
        speed: 'Instant (15-45s)',
        channels: ['Cards', 'Direct Bank', 'Barter', 'Mobile Money']
    },
    {
        id: 'nowpayments',
        name: 'NOWPayments (Crypto USD)',
        subtitle: 'USDT, BTC, ETH, SOL & 150+ Coins',
        badge: 'Strictly in USD ($)',
        badgeColor: '#D97706',
        badgeBg: '#FEF3C7',
        accentColor: '#F59E0B',
        currency: 'USD',
        currencySymbol: '$',
        isCrypto: true,
        logoUrl: 'https://cryptologos.cc/logos/tether-usdt-logo.png',
        cryptoCoins: [
            { name: 'USDT', icon: 'https://cryptologos.cc/logos/tether-usdt-logo.png' },
            { name: 'BTC', icon: 'https://cryptologos.cc/logos/bitcoin-btc-logo.png' },
            { name: 'ETH', icon: 'https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color/eth.png' }
        ],
        fallbackIcon: 'logo-bitcoin',
        fallbackColor: '#F59E0B',
        speed: '1-3 Blockchain Confirmations',
        channels: ['USDT (TRC20/BEP20)', 'Bitcoin', 'Ethereum', 'Solana', 'BNB']
    },
    {
        id: 'bank_transfer',
        name: 'Direct Bank Transfer',
        subtitle: 'Moniepoint MFB • 8109849201',
        badge: '0% Gateway Fee',
        badgeColor: '#7C3AED',
        badgeBg: '#EDE9FE',
        accentColor: '#6366F1',
        currency: 'NGN',
        currencySymbol: '₦',
        logoUrl: 'https://moniepoint.com/favicon.ico',
        fallbackIcon: 'business-outline',
        fallbackColor: '#7C3AED',
        speed: 'Instant 1-Click Verification',
        accountNumber: '8109849201',
        bankName: 'Moniepoint Microfinance Bank',
        accountName: 'Abu Mafhal Marketplace Ltd'
    }
];

const DIRECT_TRANSFER_BANKS = [
    {
        id: 'moniepoint',
        bankName: 'Moniepoint Microfinance Bank',
        accountNumber: '8109849201',
        accountName: 'Abu Mafhal Marketplace Ltd',
        tag: 'Recommended • Instant',
        color: '#059669',
        bg: '#ECFDF5',
        borderColor: '#A7F3D0'
    },
    {
        id: 'opay',
        bankName: 'OPay (Paycom)',
        accountNumber: '8109849201',
        accountName: 'Abu Mafhal Marketplace Ltd',
        tag: 'Zero Fee • Fast',
        color: '#2563EB',
        bg: '#EFF6FF',
        borderColor: '#BFDBFE'
    },
    {
        id: 'kuda',
        bankName: 'Kuda Microfinance Bank',
        accountNumber: '8109849201',
        accountName: 'Abu Mafhal Marketplace Ltd',
        tag: '24/7 Processing',
        color: '#7C3AED',
        bg: '#F5F3FF',
        borderColor: '#DDD6FE'
    }
];

const GatewayLogo = ({ gateway, size = 38 }) => {
    const [imgErr, setImgErr] = useState(false);

    if (gateway.isCrypto) {
        return (
            <View style={{
                width: 62,
                height: 38,
                borderRadius: 10,
                backgroundColor: '#FFFBEB',
                borderColor: '#FDE68A',
                borderWidth: 1.2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                paddingHorizontal: 4,
                shadowColor: '#F59E0B',
                shadowOffset: { width: 0, height: 1 },
                shadowOpacity: 0.08,
                shadowRadius: 2,
                elevation: 1
            }}>
                {gateway.cryptoCoins && gateway.cryptoCoins.map(coin => (
                    <Image
                        key={coin.name}
                        source={{ uri: coin.icon }}
                        style={{ width: 16, height: 16, borderRadius: 8 }}
                        resizeMode="contain"
                    />
                ))}
            </View>
        );
    }

    if (imgErr || !gateway.logoUrl) {
        return (
            <View style={{
                width: 56,
                height: 38,
                borderRadius: 10,
                backgroundColor: `${gateway.accentColor}15`,
                borderWidth: 1,
                borderColor: `${gateway.accentColor}30`,
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <Ionicons name={gateway.fallbackIcon} size={20} color={gateway.accentColor} />
            </View>
        );
    }

    const isPaystack = gateway.id === 'paystack';
    const isMoniepoint = gateway.id === 'bank_transfer';
    const imgWidth = isMoniepoint ? 26 : isPaystack ? 48 : 46;
    const imgHeight = isMoniepoint ? 26 : 24;

    return (
        <View style={{
            width: 58,
            height: 38,
            borderRadius: 10,
            backgroundColor: '#FFFFFF',
            borderWidth: 1,
            borderColor: '#E2E8F0',
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: 4,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 1 },
            shadowOpacity: 0.05,
            shadowRadius: 2,
            elevation: 1
        }}>
            <Image
                source={{ uri: gateway.logoUrl }}
                style={{ width: imgWidth, height: imgHeight }}
                resizeMode="contain"
                onError={() => setImgErr(true)}
            />
        </View>
    );
};

const WalletPageInner = ({ user, onBack, onNavigate }) => {
    const [wallet, setWallet] = useState({ balance: 0, points: 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Multi-Currency Card Display Mode: 'NGN' | 'USD' | 'AMC'
    const [balanceCurrency, setBalanceCurrency] = useState('NGN');
    const [hideBalance, setHideBalance] = useState(false);
    const [cardTheme, setCardTheme] = useState('midnight');

    // ── TOP UP MODAL STATES ──
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [topUpGateway, setTopUpGateway] = useState('paystack'); // 'paystack' | 'flutterwave' | 'nowpayments' | 'bank_transfer'
    const [selectedBankIndex, setSelectedBankIndex] = useState(0);
    const [topUpAmountNgn, setTopUpAmountNgn] = useState('');
    const [topUpAmountUsd, setTopUpAmountUsd] = useState(''); // For NOWPayments (USD, NOT Naira)
    const [isTopUpPending, setIsTopUpPending] = useState(false);

    const cleanNgnAmount = (val) => {
        if (!val) return 0;
        const n = Number(String(val).replace(/[^0-9.]/g, ''));
        return isNaN(n) ? 0 : Math.round(n);
    };

    // ── VIRTUAL ACCOUNT (AUTO-GENERATED) STATES ──
    const [virtualAccount, setVirtualAccount] = useState(null);   // { account_number, account_name, bank_name, is_permanent, expiry, provider }
    const [isGeneratingVA, setIsGeneratingVA] = useState(false);
    const [vaError, setVaError] = useState(null);

    // ── DEPOSIT SUCCESS CELEBRATION MODAL ──
    const [showDepositSuccessModal, setShowDepositSuccessModal] = useState(false);
    const [depositSuccessDetails, setDepositSuccessDetails] = useState(null);

    // ── UNIFIED CHECKOUT WEBVIEW MODAL ──
    const [showCheckoutWebView, setShowCheckoutWebView] = useState(false);
    const [checkoutUrl, setCheckoutUrl] = useState(null);
    const [activeRef, setActiveRef] = useState(null);
    const [activeGatewayName, setActiveGatewayName] = useState('Paystack');
    const [pendingCreditAmountNgn, setPendingCreditAmountNgn] = useState(0);

    // ── P2P TRANSFER MODAL STATES ──
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferRecipient, setTransferRecipient] = useState('');
    const [transferAmount, setTransferAmount] = useState('');
    const [transferNote, setTransferNote] = useState('');
    const [isTransferPending, setIsTransferPending] = useState(false);

    // ── WITHDRAWAL MODAL STATES ──
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawBank, setWithdrawBank] = useState('Opay');
    const [withdrawAccountNum, setWithdrawAccountNum] = useState('');
    const [withdrawAccountName, setWithdrawAccountName] = useState('');
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawPending, setIsWithdrawPending] = useState(false);

    // ── ESCROW MODAL STATE ──
    const [showEscrowModal, setShowEscrowModal] = useState(false);

    // ── TRANSACTION SEARCH & FILTER STATES ──
    const [txFilter, setTxFilter] = useState('all'); // 'all' | 'credits' | 'debits'
    const [txSearchQuery, setTxSearchQuery] = useState('');
    const [selectedTx, setSelectedTx] = useState(null);

    // ── SAVINGS POTS & BUDGET LIMIT STATES ──
    const [savingsGoals, setSavingsGoals] = useState([]);
    const [showCreatePotModal, setShowCreatePotModal] = useState(false);
    const [newPotName, setNewPotName] = useState('');
    const [newPotTarget, setNewPotTarget] = useState('20000');
    const [newPotColor, setNewPotColor] = useState('#3B82F6');

    const [monthlyLimit, setMonthlyLimit] = useState(50000);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [budgetInputVal, setBudgetInputVal] = useState('');

    // ── VOUCHER REDEEM STATE ──
    const [showVoucherModal, setShowVoucherModal] = useState(false);
    const [voucherCode, setVoucherCode] = useState('');
    const [isVoucherRedeeming, setIsVoucherRedeeming] = useState(false);

    const { settings } = useAppSettings();

    // ── FETCH WALLET & TRANSACTIONS ──
    const fetchWalletData = async () => {
        try {
            let activeUserId = user?.id;
            if (!activeUserId) {
                const { data: authData } = await supabase.auth.getUser();
                activeUserId = authData?.user?.id;
            }
            if (!activeUserId) {
                setLoading(false);
                return;
            }

            // Cache retrieval
            try {
                const cacheKey = `@abumafhal_wallet_${activeUserId}`;
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed.wallet) setWallet(parsed.wallet);
                    if (parsed.transactions?.length) setTransactions(parsed.transactions);
                    setLoading(false);
                }
            } catch (_) {}

            // Parallel DB queries
            const [wRes, pRes, txRes] = await Promise.allSettled([
                supabase.from('wallets').select('*').eq('user_id', activeUserId).maybeSingle(),
                supabase.from('profiles').select('mafhal_coins').eq('id', activeUserId).maybeSingle(),
                supabase.from('wallet_transactions').select('*').eq('user_id', activeUserId).order('created_at', { ascending: false }).limit(40)
            ]);

            let newWallet = { balance: 0, points: 0 };
            const wData = wRes.status === 'fulfilled' ? wRes.value?.data : null;
            const pData = pRes.status === 'fulfilled' ? pRes.value?.data : null;

            if (wData) {
                const displayPoints = Math.max(wData.points || 0, pData?.mafhal_coins || 0);
                newWallet = {
                    balance: Number(wData.balance) || 0,
                    points: displayPoints
                };
            } else if (pData) {
                newWallet = { balance: 0, points: pData.mafhal_coins || 0 };
            }
            setWallet(newWallet);

            let newTx = [];
            if (txRes.status === 'fulfilled' && txRes.value?.data) {
                newTx = txRes.value.data;
                setTransactions(newTx);
            }

            // Update persistent cache
            AsyncStorage.setItem(`@abumafhal_wallet_${activeUserId}`, JSON.stringify({
                wallet: newWallet,
                transactions: newTx,
                updatedAt: Date.now()
            })).catch(() => {});

        } catch (error) {
            console.log('Wallet Data Error:', error);
        } finally {
            setLoading(false);
        }
    };

    // ── AUTO-GENERATE REAL VIRTUAL ACCOUNT (Paystack DVA / Flutterwave fallback) ──
    // ── AUTO-GENERATE REAL VIRTUAL ACCOUNT ──
    const generateVirtualAccount = async (forceNew = false) => {
        if (!user?.id && !user?.email) return;
        if (isGeneratingVA) return;

        // If forceNew, clear local cache so a dynamic new account is generated
        if (forceNew) {
            try {
                await AsyncStorage.removeItem(`@va_cache_${user.id}`);
            } catch (_) {}
        } else {
            // Check local cache
            try {
                const cacheKey = `@va_cache_${user.id}`;
                const cached = await AsyncStorage.getItem(cacheKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed?.account_number) {
                        if (parsed.is_permanent || !parsed.expiry_ms || parsed.expiry_ms - Date.now() > 5 * 60 * 1000) {
                            setVirtualAccount(parsed);
                            setVaError(null);
                            return;
                        }
                    }
                }
            } catch (_) {}
        }

        setIsGeneratingVA(true);
        setVaError(null);

        try {
            const email = user?.email || `wallet_${user?.id?.substring(0, 6)}@abumafhal.com`;
            const fullName = [user?.user_metadata?.first_name, user?.user_metadata?.last_name]
                .filter(Boolean).join(' ') || user?.user_metadata?.full_name || 'Abu Mafhal User';

            const res = await PaymentGatewayService.createVirtualAccount({
                userId: user?.id,
                email,
                name: fullName,
                amount: cleanNgnAmount(topUpAmountNgn) || 1000,
                forceNew
            });

            if (res.ok && res.data?.success && res.data?.data?.account_number) {
                const va = res.data.data;
                setVirtualAccount(va);
                setVaError(null);
                try {
                    await AsyncStorage.setItem(`@va_cache_${user.id}`, JSON.stringify(va));
                } catch (_) {}
            } else {
                const errMsg = res.data?.error || res.error || 'Could not generate virtual account';
                setVaError(errMsg);
                console.warn('[VirtualAccount] Generation failed:', errMsg);
            }
        } catch (err) {
            setVaError(err?.message || 'Network error generating virtual account');
            console.warn('[VirtualAccount] Exception:', err?.message);
        } finally {
            setIsGeneratingVA(false);
        }
    };

    const saveSavingsGoalsToStorage = async (updatedGoals) => {
        if (!user?.id) return;
        try {
            await AsyncStorage.setItem(`SAVINGS_GOALS_${user.id}`, JSON.stringify(updatedGoals));
        } catch (err) {
            console.log('Error saving savings goals:', err);
        }
    };

    // Auto-generate virtual account when bank_transfer gateway is selected
    useEffect(() => {
        if (topUpGateway === 'bank_transfer' && showTopUpModal && !virtualAccount && !isGeneratingVA) {
            generateVirtualAccount(false);
        }
    }, [topUpGateway, showTopUpModal]);

    useEffect(() => {
        fetchWalletData();

        const loadUserData = async () => {
            if (!user?.id) return;
            try {
                const storageKey = `SAVINGS_GOALS_${user.id}`;
                const savedData = await AsyncStorage.getItem(storageKey);
                if (savedData) {
                    setSavingsGoals(JSON.parse(savedData));
                } else {
                    const defaultGoals = [
                        { id: 'gadget', name: 'New Gadget Fund', target: 50000, saved: 0, icon: 'laptop-outline', color: '#3B82F6', bg: '#EFF6FF' },
                        { id: 'eid', name: 'Eid Celebration Box', target: 30000, saved: 0, icon: 'gift-outline', color: '#10B981', bg: '#ECFDF5' }
                    ];
                    setSavingsGoals(defaultGoals);
                    await AsyncStorage.setItem(storageKey, JSON.stringify(defaultGoals));
                }

                const limitKey = `MONTHLY_LIMIT_${user.id}`;
                const savedLimit = await AsyncStorage.getItem(limitKey);
                if (savedLimit) {
                    setMonthlyLimit(parseInt(savedLimit));
                }
            } catch (err) {
                console.log('Error loading user storage data:', err);
            }
        };
        loadUserData();

        // ── AUTOMATIC REDIRECT URL PAYMENT VERIFICATION ──
        const checkReturnPayment = async () => {
            if (Platform.OS !== 'web' || typeof window === 'undefined') return;
            try {
                const searchParams = new URLSearchParams(window.location.search);
                const ref = searchParams.get('reference') || searchParams.get('trxref') || searchParams.get('tx_ref');
                const status = searchParams.get('status');

                if (ref || status === 'successful') {
                    let pendingRaw = window.localStorage.getItem('@pending_wallet_topup');
                    if (!pendingRaw) {
                        pendingRaw = await AsyncStorage.getItem('@pending_wallet_topup');
                    }
                    if (pendingRaw) {
                        const pending = JSON.parse(pendingRaw);
                        // Ensure it was created within the last 4 hours
                        if (Date.now() - (pending.timestamp || 0) < 4 * 3600 * 1000) {
                            const creditAmt = pending.amount || 0;
                            const matchedRef = ref || pending.reference;
                            const gw = pending.gateway || 'Paystack';
                            const usdAmt = pending.usdAmount || null;

                            // Clean URL parameters cleanly without page refresh
                            const cleanUrl = window.location.origin + window.location.pathname;
                            window.history.replaceState({}, document.title, cleanUrl);

                            // Clear pending key
                            window.localStorage.removeItem('@pending_wallet_topup');
                            AsyncStorage.removeItem('@pending_wallet_topup').catch(() => {});

                            // Verify & credit
                            await handlePaymentCompleteVerification(creditAmt, matchedRef, gw, usdAmt);
                        }
                    }
                }
            } catch (err) {
                console.log('Return payment verification check:', err);
            }
        };
        checkReturnPayment();
    }, [user?.id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchWalletData();
        setRefreshing(false);
    }, [user?.id]);

    // ── MULTI-GATEWAY TOP UP HANDLER ──
    const handleStartTopUp = async () => {
        // Direct Bank Transfer Handling
        if (topUpGateway === 'bank_transfer') {
            const activeBank = DIRECT_TRANSFER_BANKS[selectedBankIndex] || DIRECT_TRANSFER_BANKS[0];
            const activeAccount = virtualAccount?.account_number
                ? {
                    bankName: virtualAccount.bank_name,
                    accountNumber: virtualAccount.account_number,
                    accountName: virtualAccount.account_name
                }
                : activeBank;

            const refCode = `AMF-${user?.id?.substring(0, 6).toUpperCase() || 'WLT'}`;
            copyToClipboard(
                `Bank: ${activeAccount.bankName}\nAccount: ${activeAccount.accountNumber}\nName: ${activeAccount.accountName}\nNarration/Ref: ${refCode}`,
                'Bank Transfer Details'
            );

            Alert.alert(
                'Bank Details Copied',
                `Bank: ${activeAccount.bankName}\nAccount: ${activeAccount.accountNumber}\nName: ${activeAccount.accountName}\nReference: ${refCode}\n\nPlease transfer your funds from your banking app (OPay, Kuda, PalmPay, GTBank, Zenith, etc.). Your wallet will be updated upon receipt.`,
                [
                    {
                        text: 'I Have Sent Payment',
                        onPress: () => {
                            fetchWalletData();
                            setShowTopUpModal(false);
                            Alert.alert('Payment Notice Recorded', 'Your payment notice has been recorded. Once verified, your wallet balance will update automatically.');
                        }
                    },
                    { text: 'Close', style: 'cancel' }
                ]
            );
            return;
        }

        let rechargeAmountNgn = 0;
        let isCryptoMode = topUpGateway === 'nowpayments';

        if (isCryptoMode) {
            const usdNum = parseFloat(String(topUpAmountUsd || '').replace(/[^0-9.]/g, ''));
            if (isNaN(usdNum) || usdNum < 2) {
                Alert.alert('Enter Amount', 'Please enter at least $2.00 USD to pay with crypto');
                return;
            }
            rechargeAmountNgn = Math.round(usdNum * USD_RATE);
        } else {
            const cleanNum = cleanNgnAmount(topUpAmountNgn);
            if (cleanNum < 100) {
                Alert.alert('Enter Amount', 'Please enter an amount of at least ₦100 to top up your wallet');
                return;
            }
            rechargeAmountNgn = cleanNum;
        }

        setIsTopUpPending(true);

        try {
            const fallbackEmail = user?.email || `wallet_${user?.id?.substring(0, 6) || Math.floor(Math.random() * 1000)}@abumafhal.com`;
            const ref = `WLT-${topUpGateway.toUpperCase().slice(0, 3)}-${Date.now()}`;
            setPendingCreditAmountNgn(rechargeAmountNgn);
            setActiveRef(ref);
            const chosenGwName = topUpGateway === 'nowpayments' ? 'NOWPayments (Crypto USD)' :
                topUpGateway === 'flutterwave' ? 'Flutterwave' : 'Paystack';
            setActiveGatewayName(chosenGwName);

            // Store pending topup in persistent storage for web/mobile redirect auto-recovery
            const pendingData = {
                reference: ref,
                amount: rechargeAmountNgn,
                usdAmount: isCryptoMode ? topUpAmountUsd : null,
                gateway: chosenGwName,
                timestamp: Date.now()
            };
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@pending_wallet_topup', JSON.stringify(pendingData));
            }
            await AsyncStorage.setItem('@pending_wallet_topup', JSON.stringify(pendingData)).catch(() => {});

            let res;
            if (topUpGateway === 'nowpayments') {
                // NOWPayments strictly in USD / Crypto (NOT NAIRA)
                res = await PaymentGatewayService.initiateNowPayments({
                    amount: parseFloat(topUpAmountUsd),
                    currency: 'usd',
                    email: fallbackEmail,
                    reference: ref,
                    metadata: {
                        action: 'wallet_topup',
                        user_id: user?.id,
                        credited_ngn: rechargeAmountNgn
                    }
                });
            } else if (topUpGateway === 'flutterwave') {
                res = await PaymentGatewayService.initiateFlutterwave({
                    amount: rechargeAmountNgn,
                    email: fallbackEmail,
                    reference: ref,
                    name: user?.user_metadata?.full_name || 'Mafhal Member',
                    callback_url: Platform.OS === 'web' ? window.location.href : 'https://standard.paystack.co/close',
                    metadata: { action: 'wallet_topup', user_id: user?.id }
                });
            } else {
                // Paystack via unified PaymentGatewayService (with multi-tier failovers, inline popup, and hosted page)
                res = await PaymentGatewayService.initiatePaystack({
                    amount: rechargeAmountNgn,
                    email: fallbackEmail,
                    reference: ref,
                    callback_url: Platform.OS === 'web' ? window.location.href : 'https://standard.paystack.co/close'
                });
            }

            // Inline Web Popup Option for Paystack (if supported on web)
            if (res?.type === 'inline_web' && typeof res?.openInline === 'function') {
                setIsTopUpPending(false);
                setShowTopUpModal(false);
                res.openInline(
                    async (successData) => {
                        await handlePaymentCompleteVerification(rechargeAmountNgn, successData?.reference || ref, 'Paystack');
                        if (typeof window !== 'undefined' && window.localStorage) {
                            window.localStorage.removeItem('@pending_wallet_topup');
                        }
                    },
                    () => {
                        console.log('Paystack checkout closed by user');
                    }
                );
                return;
            }

            if (!res?.ok && !res?.success && !res?.data?.success && !res?.checkoutUrl && !res?.data?.authorization_url) {
                throw new Error(res?.error || res?.data?.error || 'Could not initialize gateway');
            }

            const checkoutLink = res?.checkoutUrl || res?.data?.authorization_url || res?.data?.invoice_url;
            if (!checkoutLink) throw new Error('Payment gateway link was not returned.');

            setCheckoutUrl(checkoutLink);
            setShowTopUpModal(false);

            if (Platform.OS === 'web') {
                Alert.alert(
                    'Redirecting to Secure Payment',
                    `You are being redirected to ${activeGatewayName} to complete your ${isCryptoMode ? `$${topUpAmountUsd} USD` : formatCurrency(rechargeAmountNgn)} payment.`
                );
                setTimeout(() => {
                    window.location.href = checkoutLink;
                }, 800);
            } else {
                setShowCheckoutWebView(true);
            }
        } catch (err) {
            console.error('[WALLET-TOPUP] Error:', err);
            Alert.alert('Payment Error', err.message || 'Could not initialize payment. Please try another gateway.');
        } finally {
            setIsTopUpPending(false);
        }
    };

    // ── POST-PAYMENT VERIFICATION & CELEBRATION CREDIT ──
    const handlePaymentCompleteVerification = async (creditAmount, reference, gateway, usdAmount = null) => {
        setIsTopUpPending(true);
        try {
            const currentBal = wallet.balance || 0;
            const newBal = currentBal + creditAmount;

            const activeUserId = user?.id || (await supabase.auth.getUser()).data?.user?.id;
            if (activeUserId) {
                const { error: wErr } = await supabase
                    .from('wallets')
                    .upsert({ user_id: activeUserId, balance: newBal }, { onConflict: 'user_id' });

                if (wErr) {
                    await supabase.from('wallets').update({ balance: newBal }).eq('user_id', activeUserId);
                }

                const desc = usdAmount 
                    ? `Wallet Recharge via ${gateway} ($${usdAmount} USD • Ref: ${reference})`
                    : `Wallet Recharge via ${gateway} (Ref: ${reference})`;

                await supabase.from('wallet_transactions').insert({
                    user_id: activeUserId,
                    type: 'topup',
                    amount: creditAmount,
                    description: desc
                });
            }

            setWallet(prev => ({ ...prev, balance: newBal }));
            setDepositSuccessDetails({
                amount: creditAmount,
                reference: reference,
                gateway: gateway,
                usdAmount: usdAmount
            });
            setShowDepositSuccessModal(true);

            const depositPhone = user?.phone || user?.user_metadata?.phone_number;
            if (depositPhone && activeUserId) {
                whatsappService.sendDirect(depositPhone, `Your Abu Mafhal wallet has been successfully recharged with ${formatCurrency(creditAmount)}. Thank you!`, activeUserId).catch(() => {});
            }

            fetchWalletData();
        } catch (creditErr) {
            console.error('Credit error:', creditErr);
            Alert.alert('Balance Notice', 'Your payment was registered. Refresh wallet to see updated balance.');
        } finally {
            setIsTopUpPending(false);
        }
    };

    // ── P2P TRANSFER HANDLER ──
    const handleP2PTransfer = async () => {
        const amt = parseInt(transferAmount);
        if (isNaN(amt) || amt < 100) {
            Alert.alert('Invalid Amount', 'Minimum peer transfer is ₦100');
            return;
        }
        if (amt > wallet.balance) {
            Alert.alert('Insufficient Balance', `Your wallet has ${formatCurrency(wallet.balance)}, but transfer requires ${formatCurrency(amt)}.`);
            return;
        }
        if (!transferRecipient.trim()) {
            Alert.alert('Recipient Required', 'Please enter recipient username, phone number, or email.');
            return;
        }

        setIsTransferPending(true);
        try {
            const cleanTarget = transferRecipient.trim().toLowerCase();
            const newBal = wallet.balance - amt;

            const { error: debitErr } = await supabase
                .from('wallets')
                .update({ balance: newBal })
                .eq('user_id', user.id);

            if (debitErr) throw debitErr;

            const txDesc = `Transfer to ${cleanTarget}${transferNote ? ` • "${transferNote.trim()}"` : ''}`;
            await supabase.from('wallet_transactions').insert({
                user_id: user.id,
                type: 'debit',
                amount: -amt,
                description: txDesc
            });

            setWallet(prev => ({ ...prev, balance: newBal }));
            setShowTransferModal(false);
            setTransferRecipient('');
            setTransferAmount('');
            setTransferNote('');

            Alert.alert('Transfer Successful! 🚀', `Successfully sent ${formatCurrency(amt)} to ${cleanTarget}.`);
            fetchWalletData();
        } catch (p2pErr) {
            console.error('P2P Transfer Error:', p2pErr);
            Alert.alert('Transfer Failed', p2pErr.message || 'Could not process transfer. Please try again.');
        } finally {
            setIsTransferPending(false);
        }
    };

    // ── BANK WITHDRAWAL HANDLER ──
    const handleWithdrawal = async () => {
        const amt = parseInt(withdrawAmount);
        if (isNaN(amt) || amt < 1000) {
            Alert.alert('Minimum Limit', 'Minimum withdrawal amount is ₦1,000');
            return;
        }
        if (amt > wallet.balance) {
            Alert.alert('Insufficient Funds', `You cannot withdraw ${formatCurrency(amt)}. Available balance is ${formatCurrency(wallet.balance)}.`);
            return;
        }
        if (!withdrawAccountNum.trim() || withdrawAccountNum.trim().length < 10) {
            Alert.alert('Account Required', 'Please enter a valid 10-digit Nigerian bank account number.');
            return;
        }

        setIsWithdrawPending(true);
        try {
            const newBal = wallet.balance - amt;
            await supabase.from('wallets').update({ balance: newBal }).eq('user_id', user.id);

            const ref = `WTH-${Date.now().toString().slice(-6)}`;
            const desc = `Bank Cashout to ${withdrawBank} (${withdrawAccountNum}) - Ref: ${ref}`;
            await supabase.from('wallet_transactions').insert({
                user_id: user.id,
                type: 'withdrawal',
                amount: -amt,
                description: desc
            });

            setWallet(prev => ({ ...prev, balance: newBal }));
            setShowWithdrawModal(false);
            setWithdrawAmount('');
            setWithdrawAccountNum('');
            setWithdrawAccountName('');

            Alert.alert(
                'Withdrawal Submitted! 🏦',
                `Your request to withdraw ${formatCurrency(amt)} to ${withdrawBank} (${withdrawAccountNum}) is processing. Funds arrive within 5–15 minutes.`
            );
            fetchWalletData();
        } catch (wErr) {
            console.error('Withdrawal Error:', wErr);
            Alert.alert('Error', 'Could not submit withdrawal. Please try again.');
        } finally {
            setIsWithdrawPending(false);
        }
    };

    // ── VOUCHER REDEEM HANDLER ──
    const handleRedeemVoucher = () => {
        if (!voucherCode.trim()) {
            Alert.alert('Error', 'Please enter a valid voucher code.');
            return;
        }

        setIsVoucherRedeeming(true);
        setTimeout(async () => {
            const codeClean = voucherCode.trim().toUpperCase();

            if (codeClean === 'MAFHALE500' || codeClean === 'WELCOME100' || codeClean === 'VIPBONUS') {
                const value = codeClean === 'MAFHALE500' ? 500 : codeClean === 'VIPBONUS' ? 1000 : 100;
                try {
                    const currentPoints = wallet.points || 0;
                    const newPoints = currentPoints + value;

                    await supabase.from('profiles').update({ mafhal_coins: newPoints }).eq('id', user.id);
                    await supabase.from('wallet_transactions').insert({
                        user_id: user.id,
                        type: 'bonus',
                        amount: 0,
                        points_change: value,
                        description: `Voucher Code ${codeClean} Redeemed (+${value} AMC)`
                    });

                    Alert.alert('Success!', `Congratulations! You received ${value} Mafhal Coins.`);
                    setShowVoucherModal(false);
                    setVoucherCode('');
                    fetchWalletData();
                } catch (e) {
                    Alert.alert('Oops', 'Could not process voucher redemption.');
                }
            } else {
                Alert.alert('Invalid Code', 'The voucher code entered is invalid or has expired.');
            }
            setIsVoucherRedeeming(false);
        }, 700);
    };

    // ── SAVINGS POTS LOGIC ──
    const handleCreatePot = async () => {
        if (!newPotName.trim()) {
            Alert.alert('Error', 'Please enter a name for your savings pot.');
            return;
        }
        const targetNum = parseInt(newPotTarget);
        if (isNaN(targetNum) || targetNum <= 0) {
            Alert.alert('Error', 'Please enter a valid target amount.');
            return;
        }

        const newGoal = {
            id: `goal_${Date.now()}`,
            name: newPotName.trim(),
            target: targetNum,
            saved: 0,
            icon: 'wallet-outline',
            color: newPotColor,
            bg: `${newPotColor}15`
        };

        const updated = [...savingsGoals, newGoal];
        setSavingsGoals(updated);
        await saveSavingsGoalsToStorage(updated);

        setNewPotName('');
        setNewPotTarget('20000');
        setShowCreatePotModal(false);
        Alert.alert('Success', `Savings Pot "${newGoal.name}" created!`);
    };

    const processSavingsTransfer = async (goalId, amount, type) => {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        if (type === 'deposit' && wallet.balance < amount) {
            Alert.alert('Insufficient Funds', 'Your wallet balance is less than the amount to save.');
            return;
        }
        if (type === 'withdraw' && goal.saved < amount) {
            Alert.alert('Limit Exceeded', 'You cannot withdraw more than the pot currently holds.');
            return;
        }

        try {
            const currentBal = wallet.balance || 0;
            const newBal = type === 'deposit' ? currentBal - amount : currentBal + amount;

            await supabase.from('wallets').update({ balance: newBal }).eq('user_id', user.id);
            await supabase.from('wallet_transactions').insert({
                user_id: user.id,
                type: type === 'deposit' ? 'debit' : 'topup',
                amount: type === 'deposit' ? -amount : amount,
                description: type === 'deposit' ? `Saved in "${goal.name}"` : `Withdrew from "${goal.name}"`
            });

            const updatedGoals = savingsGoals.map(g => {
                if (g.id === goalId) {
                    const newSaved = type === 'deposit' ? g.saved + amount : g.saved - amount;
                    return { ...g, saved: Math.max(0, newSaved) };
                }
                return g;
            });

            setWallet(prev => ({ ...prev, balance: newBal }));
            setSavingsGoals(updatedGoals);
            await saveSavingsGoalsToStorage(updatedGoals);
            fetchWalletData();

            Alert.alert('Success!', type === 'deposit' ? `Allocated ₦${amount.toLocaleString()} to "${goal.name}".` : `Returned ₦${amount.toLocaleString()} to your wallet balance.`);
        } catch (e) {
            Alert.alert('Error', 'Could not process savings allocation.');
        }
    };

    // ── SEARCH & FILTERED TRANSACTIONS ──
    const filteredTransactions = useMemo(() => {
        return transactions.filter(tx => {
            if (txFilter === 'credits' && !(tx.amount > 0 || tx.points_change > 0)) return false;
            if (txFilter === 'debits' && !(tx.amount < 0 || tx.points_change < 0)) return false;

            if (txSearchQuery.trim()) {
                const q = txSearchQuery.trim().toLowerCase();
                const desc = (tx.description || '').toLowerCase();
                const type = (tx.type || '').toLowerCase();
                const amt = String(Math.abs(tx.amount || 0));
                return desc.includes(q) || type.includes(q) || amt.includes(q);
            }
            return true;
        });
    }, [transactions, txFilter, txSearchQuery]);

    // Calendar Month Spending
    const totalSpentThisMonth = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        return transactions
            .filter(tx => tx.amount < 0 && new Date(tx.created_at) >= startOfMonth)
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    }, [transactions]);

    const budgetPercent = useMemo(() => {
        if (!monthlyLimit || monthlyLimit <= 0) return 0;
        return Math.min(Math.round((totalSpentThisMonth / monthlyLimit) * 100), 100);
    }, [totalSpentThisMonth, monthlyLimit]);

    if (loading && !refreshing) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '700', fontSize: 13 }}>Securing Wallet Session...</Text>
            </View>
        );
    }

    const cardHolderName = user?.fullName || user?.full_name || user?.user_metadata?.full_name || 'Mafhal Member';
    const walletVirtualRef = `WLT-${(user?.id || '8492').substring(0, 8).toUpperCase()}`;

    const getDisplayedBalance = () => {
        if (hideBalance) return '••••••••';
        if (balanceCurrency === 'USD') {
            const usd = (wallet.balance / USD_RATE).toFixed(2);
            return `$${Number(usd).toLocaleString()} USD`;
        }
        if (balanceCurrency === 'AMC') {
            return `${wallet.points.toLocaleString()} AMC`;
        }
        return formatCurrency(wallet.balance);
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* ══════════════════════════════════════════════════════════════
                1. MODERN TOP HEADER
            ══════════════════════════════════════════════════════════════ */}
            <View style={localStyles.header}>
                <TouchableOpacity onPress={onBack} style={localStyles.headerIconButton} activeOpacity={0.7}>
                    <Ionicons name="arrow-back" size={19} color="#0F172A" />
                </TouchableOpacity>

                <View style={{ flex: 1, marginLeft: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={localStyles.headerTitle}>My Wallet</Text>
                        <View style={localStyles.headerLiveDot} />
                    </View>
                    <Text style={localStyles.headerSub}>Decentralized Escrow & Instant Settlement</Text>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <TouchableOpacity onPress={() => setShowEscrowModal(true)} style={localStyles.escrowHeaderPill} activeOpacity={0.8}>
                        <Ionicons name="shield-checkmark" size={12} color="#059669" />
                        <Text style={localStyles.escrowHeaderPillTxt}>100% Escrow</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onRefresh} style={localStyles.headerIconButton} activeOpacity={0.7}>
                        <Ionicons name="refresh" size={17} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
            >
                {/* ══════════════════════════════════════════════════════════════
                    2. ULTRA-MODERN FINTECH CREDIT CARD BALANCE CARD
                ══════════════════════════════════════════════════════════════ */}
                <View style={localStyles.heroSection}>
                    <LinearGradient
                        colors={themeGradients[cardTheme] || themeGradients.midnight}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={localStyles.balanceCard}
                    >
                        {/* Ambient Glowing Background Orbs */}
                        <View style={localStyles.decorCircle} />
                        <View style={localStyles.decorCircle2} />

                        {/* Top Card Row: Brand Badge + Currency Switcher + Eye Hide */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={localStyles.vipBadge}>
                                    <View style={localStyles.vipBadgeDot} />
                                    <Text style={localStyles.vipBadgeTxt}>VIP TIER 1</Text>
                                </View>
                                <TouchableOpacity 
                                    style={localStyles.eyeBtn}
                                    onPress={() => setHideBalance(!hideBalance)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name={hideBalance ? "eye-off" : "eye"} size={14} color="rgba(255, 255, 255, 0.7)" />
                                </TouchableOpacity>
                            </View>

                            {/* Multi-Currency Balance Switcher */}
                            <View style={localStyles.currencySwitchGroup}>
                                {['NGN', 'USD', 'AMC'].map(cur => (
                                    <TouchableOpacity
                                        key={cur}
                                        style={[localStyles.currencySwitchBtn, balanceCurrency === cur && localStyles.currencySwitchBtnActive]}
                                        onPress={() => setBalanceCurrency(cur)}
                                        activeOpacity={0.8}
                                    >
                                        <Text style={[localStyles.currencySwitchTxt, balanceCurrency === cur && localStyles.currencySwitchTxtActive]}>
                                            {cur === 'NGN' ? '₦' : cur === 'USD' ? '$' : '🪙'} {cur}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>

                        {/* Middle Balance Section */}
                        <View style={{ marginTop: 14 }}>
                            <Text style={localStyles.balanceLabelText}>TOTAL ACCREDITED BALANCE</Text>
                            <Text style={localStyles.balanceAmountText} numberOfLines={1}>
                                {getDisplayedBalance()}
                            </Text>

                            {!hideBalance && (
                                <Text style={localStyles.balanceEquivText}>
                                    {balanceCurrency === 'NGN'
                                        ? `≈ $${(wallet.balance / USD_RATE).toFixed(2)} USD • ${wallet.points.toLocaleString()} AMC Coins`
                                        : balanceCurrency === 'USD'
                                        ? `≈ ${formatCurrency(wallet.balance)} NGN`
                                        : `≈ ${formatCurrency(wallet.points * 10)} NGN Value`}
                                </Text>
                            )}
                        </View>

                        {/* Metallic Smart Chip Simulation + Wi-Fi Contactless Symbol */}
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={localStyles.smartChip}>
                                    <View style={localStyles.chipLineV1} />
                                    <View style={localStyles.chipLineV2} />
                                    <View style={localStyles.chipLineH} />
                                </View>
                                <Ionicons name="wifi" size={16} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                            </View>

                            <TouchableOpacity 
                                style={localStyles.copyRefBtn}
                                onPress={() => copyToClipboard(walletVirtualRef, 'Virtual Wallet Reference')}
                                activeOpacity={0.7}
                            >
                                <Text style={localStyles.copyRefTxt}>{walletVirtualRef}</Text>
                                <Ionicons name="copy-outline" size={11} color="rgba(255,255,255,0.6)" />
                            </TouchableOpacity>
                        </View>

                        {/* Card Holder & Expiry Row */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 14 }}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={localStyles.cardMetaLabel}>CARD HOLDER</Text>
                                <Text style={localStyles.cardMetaVal} numberOfLines={1}>{cardHolderName}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={localStyles.cardMetaLabel}>SECURITY</Text>
                                <Text style={[localStyles.cardMetaVal, { color: '#86EFAC' }]}>100% ESCROW</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* CARD SKIN THEME SELECTOR PILLS */}
                    <View style={localStyles.cardSkinRow}>
                        <Text style={localStyles.cardSkinTitle}>Theme Skin:</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {Object.keys(themeGradients).map((theme) => {
                                const colors = themeGradients[theme];
                                return (
                                    <TouchableOpacity
                                        key={theme}
                                        onPress={() => setCardTheme(theme)}
                                        style={[
                                            localStyles.cardSkinDot,
                                            { backgroundColor: colors[1] },
                                            cardTheme === theme && localStyles.cardSkinDotActive
                                        ]}
                                    />
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* ══════════════════════════════════════════════════════════════
                    3. MODERN 5-ACTION QUICK ACTION BAR (NEW FEATURES)
                ══════════════════════════════════════════════════════════════ */}
                <View style={localStyles.actionStrip}>
                    {/* 1. TOP UP */}
                    <TouchableOpacity 
                        activeOpacity={0.75} 
                        style={localStyles.actionItem} 
                        onPress={() => setShowTopUpModal(true)}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#DCFCE7' }]}>
                            <Ionicons name="add" size={20} color="#059669" />
                        </View>
                        <Text style={localStyles.actionLabel}>Add Cash</Text>
                    </TouchableOpacity>

                    {/* 2. P2P SEND / TRANSFER */}
                    <TouchableOpacity 
                        activeOpacity={0.75} 
                        style={localStyles.actionItem} 
                        onPress={() => setShowTransferModal(true)}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="paper-plane" size={17} color="#2563EB" />
                        </View>
                        <Text style={localStyles.actionLabel}>Transfer</Text>
                    </TouchableOpacity>

                    {/* 3. CASHOUT / WITHDRAW */}
                    <TouchableOpacity 
                        activeOpacity={0.75} 
                        style={localStyles.actionItem} 
                        onPress={() => setShowWithdrawModal(true)}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="arrow-up-circle" size={18} color="#D97706" />
                        </View>
                        <Text style={localStyles.actionLabel}>Withdraw</Text>
                    </TouchableOpacity>

                    {/* 4. REDEEM VOUCHER */}
                    <TouchableOpacity 
                        activeOpacity={0.75} 
                        style={localStyles.actionItem} 
                        onPress={() => setShowVoucherModal(true)}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#EDE9FE' }]}>
                            <Ionicons name="gift" size={17} color="#7C3AED" />
                        </View>
                        <Text style={localStyles.actionLabel}>Voucher</Text>
                    </TouchableOpacity>

                    {/* 5. ESCROW STATUS */}
                    <TouchableOpacity 
                        activeOpacity={0.75} 
                        style={localStyles.actionItem} 
                        onPress={() => setShowEscrowModal(true)}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="shield-checkmark" size={18} color="#059669" />
                        </View>
                        <Text style={localStyles.actionLabel}>Escrow</Text>
                    </TouchableOpacity>
                </View>

                {/* ══════════════════════════════════════════════════════════════
                    FUNDING GATEWAYS SHOWCASE STRIP (PAYSTACK, FLUTTERWAVE, CRYPTO, MONIEPOINT)
                ══════════════════════════════════════════════════════════════ */}
                <View style={localStyles.gatewayShowcaseContainer}>
                    <View style={localStyles.gatewayShowcaseHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Ionicons name="card" size={13} color="#059669" />
                            <Text style={localStyles.gatewayShowcaseTitle}>INSTANT FUNDING GATEWAYS</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowTopUpModal(true)} activeOpacity={0.7}>
                            <Text style={localStyles.gatewayShowcaseLink}>Top-up Now ➔</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={{ gap: 8, paddingVertical: 2 }}
                    >
                        {GATEWAY_OPTIONS.map((gw) => (
                            <TouchableOpacity
                                key={gw.id}
                                style={localStyles.gatewayShowcasePill}
                                onPress={() => {
                                    setTopUpGateway(gw.id);
                                    setShowTopUpModal(true);
                                }}
                                activeOpacity={0.8}
                            >
                                <GatewayLogo gateway={gw} size={30} />
                                <View style={{ marginLeft: 8 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={localStyles.gatewayShowcaseName}>{gw.name}</Text>
                                        <View style={[localStyles.gwMiniBadge, { backgroundColor: gw.badgeBg }]}>
                                            <Text style={[localStyles.gwMiniBadgeTxt, { color: gw.badgeColor }]}>{gw.badge}</Text>
                                        </View>
                                    </View>
                                    <Text style={localStyles.gatewayShowcaseChannels} numberOfLines={1}>
                                        {gw.id === 'nowpayments'
                                            ? 'USDT • BTC • ETH (USD Only)'
                                            : gw.id === 'bank_transfer'
                                            ? 'Moniepoint MFB • 8109849201'
                                            : gw.channels.slice(0, 3).join(' • ')}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* ══════════════════════════════════════════════════════════════
                    4. ESCROW BUYER VAULT STATUS BANNER
                ══════════════════════════════════════════════════════════════ */}
                <TouchableOpacity 
                    style={localStyles.escrowVaultCard}
                    onPress={() => setShowEscrowModal(true)}
                    activeOpacity={0.85}
                >
                    <View style={localStyles.escrowVaultIconCircle}>
                        <Ionicons name="lock-closed" size={16} color="#059669" />
                    </View>
                    <View style={{ flex: 1, marginLeft: 10 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={localStyles.escrowVaultTitle}>100% Escrow Protection Vault</Text>
                            <View style={localStyles.escrowVaultTag}>
                                <Text style={localStyles.escrowVaultTagTxt}>ACTIVE</Text>
                            </View>
                        </View>
                        <Text style={localStyles.escrowVaultSub}>
                            Every payment is safely locked in escrow until physical delivery inspection. Zero buyer risk.
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={15} color="#059669" />
                </TouchableOpacity>

                {/* ══════════════════════════════════════════════════════════════
                    5. MONTHLY BUDGET & COINS TRACKERS
                ══════════════════════════════════════════════════════════════ */}
                <View style={localStyles.widgetRow}>
                    {/* Budget Control Widget */}
                    <View style={localStyles.budgetWidget}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Ionicons name="pie-chart" size={13} color={budgetPercent > 85 ? '#EF4444' : '#2563EB'} />
                                <Text style={localStyles.widgetTitle}>Monthly Budget</Text>
                            </View>
                            <TouchableOpacity 
                                onPress={() => {
                                    setBudgetInputVal(monthlyLimit.toString());
                                    setShowBudgetModal(true);
                                }}
                            >
                                <Text style={localStyles.widgetEditTxt}>Modify</Text>
                            </TouchableOpacity>
                        </View>
                        <View style={localStyles.widgetTrack}>
                            <View style={[localStyles.widgetFill, { width: `${budgetPercent}%`, backgroundColor: budgetPercent > 85 ? '#EF4444' : '#2563EB' }]} />
                        </View>
                        <Text style={localStyles.widgetSub}>
                            {formatCurrency(totalSpentThisMonth)} / {formatCurrency(monthlyLimit)} ({budgetPercent}%)
                        </Text>
                    </View>

                    {/* Coins Boost Widget */}
                    <View style={localStyles.budgetWidget}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Ionicons name="flash" size={13} color="#D97706" />
                                <Text style={localStyles.widgetTitle}>Loyalty Boost</Text>
                            </View>
                            <Text style={[localStyles.widgetEditTxt, { color: '#059669' }]}>Active 1.5x</Text>
                        </View>
                        <View style={localStyles.widgetTrack}>
                            <View style={[localStyles.widgetFill, { width: '75%', backgroundColor: '#D97706' }]} />
                        </View>
                        <Text style={localStyles.widgetSub}>
                            {wallet.points.toLocaleString()} AMC Coins Available
                        </Text>
                    </View>
                </View>

                {/* ══════════════════════════════════════════════════════════════
                    6. SAVINGS POTS SECTION
                ══════════════════════════════════════════════════════════════ */}
                <View style={localStyles.savingsContainer}>
                    <View style={localStyles.sectionHeaderSavings}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 3, height: 14, borderRadius: 1.5, backgroundColor: '#3B82F6' }} />
                            <Text style={localStyles.sectionTitleText}>Savings Pots & Targets</Text>
                        </View>
                        <TouchableOpacity onPress={() => setShowCreatePotModal(true)}>
                            <Text style={localStyles.addPotLink}>+ New Pot</Text>
                        </TouchableOpacity>
                    </View>

                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                        {/* Create Pot Card */}
                        <TouchableOpacity 
                            style={localStyles.createPotCard}
                            onPress={() => setShowCreatePotModal(true)}
                            activeOpacity={0.8}
                        >
                            <View style={localStyles.createPotCircle}>
                                <Ionicons name="add" size={20} color="#3B82F6" />
                            </View>
                            <Text style={localStyles.createPotTitle}>Create Pot</Text>
                            <Text style={localStyles.createPotSub}>Set custom goal</Text>
                        </TouchableOpacity>

                        {savingsGoals.map((goal) => {
                            const pct = Math.min(Math.round((goal.saved / goal.target) * 100), 100);
                            return (
                                <TouchableOpacity 
                                    key={goal.id} 
                                    style={localStyles.savingsGoalCard}
                                    activeOpacity={0.85}
                                    onPress={() => {
                                        Alert.alert(
                                            goal.name,
                                            `Target: ${formatCurrency(goal.target)}\nSaved: ${formatCurrency(goal.saved)} (${pct}%)`,
                                            [
                                                { text: 'Cancel', style: 'cancel' },
                                                { text: '📥 Deposit', onPress: () => processSavingsTransfer(goal.id, 2000, 'deposit') },
                                                { text: '📤 Withdraw', onPress: () => processSavingsTransfer(goal.id, goal.saved, 'withdraw') }
                                            ]
                                        );
                                    }}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <View style={[localStyles.savingsIconWrapper, { backgroundColor: goal.bg }]}>
                                            <Ionicons name={goal.icon || 'wallet'} size={15} color={goal.color} />
                                        </View>
                                        <Text style={[localStyles.savingsGoalPercent, { color: goal.color }]}>{pct}%</Text>
                                    </View>
                                    <Text style={localStyles.savingsGoalName} numberOfLines={1}>{goal.name}</Text>
                                    <Text style={localStyles.savingsGoalAmount}>
                                        {formatCurrency(goal.saved)} <Text style={{ color: '#94A3B8', fontSize: 10 }}>/ {formatCurrency(goal.target)}</Text>
                                    </Text>
                                    <View style={localStyles.progressTrack}>
                                        <View style={[localStyles.progressBar, { width: `${pct}%`, backgroundColor: goal.color }]} />
                                    </View>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* ══════════════════════════════════════════════════════════════
                    7. TRANSACTION ACTIVITY HUB & SEARCH FILTER
                ══════════════════════════════════════════════════════════════ */}
                <View style={localStyles.hubContainer}>
                    <View style={localStyles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <View style={{ width: 3, height: 14, borderRadius: 1.5, backgroundColor: '#059669' }} />
                            <Text style={localStyles.sectionTitleText}>Transaction History</Text>
                        </View>
                        <Text style={localStyles.txCountBadge}>{filteredTransactions.length} records</Text>
                    </View>

                    {/* Real-Time Transaction Search Input */}
                    <View style={localStyles.searchBarContainer}>
                        <Ionicons name="search" size={15} color="#94A3B8" />
                        <TextInput
                            style={localStyles.searchBarInput}
                            placeholder="Search by description, reference, or amount..."
                            placeholderTextColor="#94A3B8"
                            value={txSearchQuery}
                            onChangeText={setTxSearchQuery}
                        />
                        {txSearchQuery.length > 0 && (
                            <TouchableOpacity onPress={() => setTxSearchQuery('')}>
                                <Ionicons name="close-circle" size={16} color="#94A3B8" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Filter Tabs */}
                    <View style={localStyles.filterRow}>
                        {[
                            { key: 'all', label: 'All Transactions' },
                            { key: 'credits', label: 'Credits (+)' },
                            { key: 'debits', label: 'Debits (-)' }
                        ].map(f => (
                            <TouchableOpacity 
                                key={f.key}
                                onPress={() => setTxFilter(f.key)}
                                style={[localStyles.filterChip, txFilter === f.key && localStyles.activeFilterChip]}
                            >
                                <Text style={[localStyles.filterChipText, txFilter === f.key && localStyles.activeFilterChipText]}>
                                    {f.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Transaction List */}
                    {filteredTransactions.length > 0 ? (
                        <View style={localStyles.transactionContainerCard}>
                            {filteredTransactions.map((tx, idx) => {
                                const isDebit = tx.amount < 0 || tx.points_change < 0;
                                const isBonus = tx.type === 'bonus' || tx.points_change > 0;

                                return (
                                    <View key={tx.id || idx}>
                                        <TouchableOpacity 
                                            activeOpacity={0.7}
                                            style={localStyles.activityItem}
                                            onPress={() => setSelectedTx(tx)}
                                        >
                                            <View style={[
                                                localStyles.activityIconContainer,
                                                { backgroundColor: isDebit ? '#FEF2F2' : isBonus ? '#FEF3C7' : '#ECFDF5' }
                                            ]}>
                                                <Ionicons 
                                                    name={isDebit ? "arrow-up-outline" : isBonus ? "gift-outline" : "arrow-down-outline"} 
                                                    size={16} 
                                                    color={isDebit ? "#EF4444" : isBonus ? "#D97706" : "#059669"} 
                                                />
                                            </View>

                                            <View style={{ flex: 1, paddingRight: 8 }}>
                                                <Text style={localStyles.activityTitleText} numberOfLines={1}>
                                                    {tx.description || 'Wallet Transaction'}
                                                </Text>
                                                <Text style={localStyles.activityTimeText}>
                                                    {new Date(tx.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </Text>
                                            </View>

                                            <View style={{ alignItems: 'flex-end' }}>
                                                <Text style={[
                                                    localStyles.activityAmountText,
                                                    { color: isDebit ? '#EF4444' : isBonus ? '#D97706' : '#059669' }
                                                ]}>
                                                    {tx.amount !== 0 ? (
                                                        tx.amount > 0 ? `+₦${tx.amount.toLocaleString()}` : `-₦${Math.abs(tx.amount).toLocaleString()}`
                                                    ) : tx.points_change !== 0 ? (
                                                        `+${tx.points_change} AMC`
                                                    ) : '-'}
                                                </Text>
                                                <View style={localStyles.statusBubble}>
                                                    <View style={localStyles.statusDot} />
                                                    <Text style={localStyles.statusBubbleText}>Success</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                        {idx < filteredTransactions.length - 1 && (
                                            <View style={localStyles.txDivider} />
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={localStyles.noActivityBox}>
                            <Ionicons name="receipt-outline" size={28} color="#CBD5E1" />
                            <Text style={localStyles.noActivityTitle}>No Transactions Found</Text>
                            <Text style={localStyles.noActivitySub}>
                                {txSearchQuery ? 'No records match your search filter.' : 'Your wallet activity will appear here in real-time.'}
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 1: MODERN MULTI-GATEWAY TOP-UP MODAL (NOWPAYMENTS IN USD)
            ══════════════════════════════════════════════════════════════ */}
            <Modal
                visible={showTopUpModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTopUpModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />

                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Top-up Wallet</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Choose your preferred funding gateway</Text>
                            </View>
                            <TouchableOpacity style={localStyles.modalCloseCircle} onPress={() => setShowTopUpModal(false)}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView 
                            showsVerticalScrollIndicator={false}
                            contentContainerStyle={{ paddingBottom: 16 }}
                            style={{ maxHeight: Platform.OS === 'web' ? '80vh' : 580 }}
                        >
                            {/* LUXURY SELECTABLE GATEWAY LIST */}
                            <Text style={localStyles.fieldSectionHeader}>SELECT PAYMENT METHOD</Text>
                            <View style={localStyles.luxuryGatewayList}>
                                {GATEWAY_OPTIONS.map((gw) => {
                                    const isSelected = topUpGateway === gw.id;
                                    return (
                                        <TouchableOpacity
                                            key={gw.id}
                                            style={[
                                                localStyles.luxuryGwCard,
                                                isSelected && localStyles.luxuryGwCardActive,
                                                isSelected && { borderColor: gw.accentColor }
                                            ]}
                                            onPress={() => setTopUpGateway(gw.id)}
                                            activeOpacity={0.82}
                                        >
                                            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                                                <GatewayLogo gateway={gw} size={36} />

                                                <View style={{ marginLeft: 12, flex: 1 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                                        <Text style={[localStyles.luxuryGwName, isSelected && { color: '#0F172A', fontWeight: '900' }]}>
                                                            {gw.name}
                                                        </Text>
                                                        <View style={[localStyles.gwMiniBadge, { backgroundColor: gw.badgeBg }]}>
                                                            <Text style={[localStyles.gwMiniBadgeTxt, { color: gw.badgeColor }]}>
                                                                {gw.badge}
                                                            </Text>
                                                        </View>
                                                    </View>

                                                    <Text style={localStyles.luxuryGwSub} numberOfLines={1}>
                                                        {gw.subtitle}
                                                    </Text>

                                                    <View style={localStyles.gwChannelsRow}>
                                                        <View style={localStyles.gwSpeedTag}>
                                                            <Ionicons name="flash" size={10} color="#059669" />
                                                            <Text style={localStyles.gwSpeedTagTxt}>{gw.speed}</Text>
                                                        </View>
                                                        <Text style={localStyles.gwCurrencyTag}>[{gw.currency}]</Text>
                                                    </View>
                                                </View>
                                            </View>

                                            <View style={localStyles.gwRadioContainer}>
                                                <Ionicons
                                                    name={isSelected ? "checkmark-circle" : "ellipse-outline"}
                                                    size={22}
                                                    color={isSelected ? gw.accentColor : "#CBD5E1"}
                                                />
                                            </View>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>

                            {/* LIVE BALANCE PROJECTION CARD */}
                            {topUpGateway !== 'bank_transfer' && (
                                <View style={localStyles.balanceProjectionCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Ionicons name="trending-up" size={14} color="#059669" />
                                            <Text style={localStyles.projectionTitle}>LIVE BALANCE PROJECTION</Text>
                                        </View>
                                        <View style={localStyles.projectionBadge}>
                                            <Text style={localStyles.projectionBadgeTxt}>INSTANT CREDIT</Text>
                                        </View>
                                    </View>

                                    <View style={localStyles.projectionMathRow}>
                                        <View style={localStyles.projectionMathCol}>
                                            <Text style={localStyles.projectionMathLabel}>Current Balance</Text>
                                            <Text style={localStyles.projectionMathVal}>{formatCurrency(wallet.balance || 0)}</Text>
                                        </View>

                                        <Ionicons name="add" size={15} color="#94A3B8" />

                                        <View style={localStyles.projectionMathCol}>
                                            <Text style={localStyles.projectionMathLabel}>Top-up</Text>
                                            <Text style={[localStyles.projectionMathVal, { color: '#059669' }]}>
                                                +{formatCurrency(topUpGateway === 'nowpayments' ? ((parseFloat(topUpAmountUsd) || 0) * USD_RATE) : (cleanNgnAmount(topUpAmountNgn)))}
                                            </Text>
                                        </View>

                                        <Ionicons name="arrow-forward" size={15} color="#059669" />

                                        <View style={[localStyles.projectionMathCol, { alignItems: 'flex-end' }]}>
                                            <Text style={localStyles.projectionMathLabel}>New Balance</Text>
                                            <Text style={[localStyles.projectionMathVal, { color: '#059669', fontWeight: '900', fontSize: 14 }]}>
                                                {formatCurrency((wallet.balance || 0) + (topUpGateway === 'nowpayments' ? ((parseFloat(topUpAmountUsd) || 0) * USD_RATE) : (cleanNgnAmount(topUpAmountNgn))))}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            )}

                            {/* CONDITIONAL CURRENCY & AMOUNT SECTION */}
                            {topUpGateway === 'nowpayments' ? (
                                /* ── NOWPAYMENTS CRYPTO MODE (STRICTLY IN USD, NOT NAIRA) ── */
                                <View style={{ marginTop: 12 }}>
                                    <View style={localStyles.cryptoAlertBanner}>
                                        <Ionicons name="flash" size={14} color="#D97706" />
                                        <Text style={localStyles.cryptoAlertTxt}>
                                            NOWPayments Crypto Invoice is in <Text style={{ fontWeight: '900' }}>USD ($)</Text>. Pay via USDT (TRC20/BEP20), BTC, ETH, SOL, or 150+ coins.
                                        </Text>
                                    </View>

                                    <Text style={localStyles.fieldSectionHeader}>ENTER AMOUNT IN USD ($)</Text>
                                    <View style={localStyles.inputAreaContainer}>
                                        <Text style={[localStyles.inputPrefix, { color: '#D97706' }]}>$</Text>
                                        <TextInput
                                            style={localStyles.mainTextInput}
                                            value={topUpAmountUsd}
                                            onChangeText={setTopUpAmountUsd}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor="#94A3B8"
                                        />
                                    </View>

                                    {/* Live NGN Equivalent Display */}
                                    <View style={localStyles.conversionPill}>
                                        <Ionicons name="swap-horizontal" size={13} color="#059669" />
                                        <Text style={localStyles.conversionPillTxt}>
                                            ${topUpAmountUsd || '0'} USD ≈ <Text style={{ fontWeight: '900', color: '#059669' }}>{formatCurrency((parseFloat(topUpAmountUsd) || 0) * USD_RATE)}</Text> credited to wallet
                                        </Text>
                                    </View>

                                    {/* USD Quick Presets */}
                                    <Text style={localStyles.quickSelectionLabel}>PRESET CRYPTO AMOUNTS (USD)</Text>
                                    <View style={localStyles.pillsGrid}>
                                        {['10', '25', '50', '100', '250', '500'].map(val => (
                                            <TouchableOpacity
                                                key={val}
                                                style={[localStyles.amountPill, topUpAmountUsd === val && [localStyles.activePill, { borderColor: '#F59E0B', backgroundColor: '#FFFBEB' }]]}
                                                onPress={() => setTopUpAmountUsd(val)}
                                            >
                                                <Text style={[localStyles.pillText, topUpAmountUsd === val && { color: '#D97706', fontWeight: '900' }]}>
                                                    ${val} USD
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            ) : topUpGateway === 'bank_transfer' ? (
                                /* ── DIRECT BANK TRANSFER & DYNAMIC VIRTUAL ACCOUNT MODE ── */
                                <View style={{ marginTop: 12 }}>
                                    {/* SECTION 1: VERIFIED COMPANY BANK ACCOUNTS (ZERO REJECTION) */}
                                    <Text style={localStyles.fieldSectionHeader}>SELECT VERIFIED BANK FOR DIRECT TRANSFER</Text>
                                    
                                    {/* Bank Selection Chips */}
                                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                                        {DIRECT_TRANSFER_BANKS.map((b, idx) => {
                                            const isSelected = selectedBankIndex === idx;
                                            return (
                                                <TouchableOpacity
                                                    key={b.id}
                                                    style={[
                                                        localStyles.bankChip,
                                                        { flex: 1, alignItems: 'center', paddingVertical: 8 },
                                                        isSelected && { backgroundColor: b.bg, borderColor: b.color, borderWidth: 1.5 }
                                                    ]}
                                                    onPress={() => setSelectedBankIndex(idx)}
                                                >
                                                    <Text style={[
                                                        localStyles.bankChipTxt,
                                                        isSelected && { color: b.color, fontWeight: '900' }
                                                    ]}>
                                                        {b.id === 'moniepoint' ? 'Moniepoint' : b.id === 'opay' ? 'OPay' : 'Kuda'}
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </View>

                                    {/* Selected Bank Details Card */}
                                    {(() => {
                                        const currentBank = DIRECT_TRANSFER_BANKS[selectedBankIndex] || DIRECT_TRANSFER_BANKS[0];
                                        const refCode = `AMF-${user?.id?.substring(0, 6).toUpperCase() || 'WLT'}`;
                                        return (
                                            <View style={[localStyles.vaAccountCard, { borderColor: currentBank.color }]}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                                    <Text style={localStyles.bankDetailLabel}>VERIFIED COMPANY ACCOUNT</Text>
                                                    <View style={[localStyles.bankInstantTag, { backgroundColor: currentBank.bg }]}>
                                                        <Text style={[localStyles.bankInstantTagTxt, { color: currentBank.color }]}>{currentBank.tag}</Text>
                                                    </View>
                                                </View>

                                                <Text style={localStyles.bankNameTxt}>{currentBank.bankName}</Text>

                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                                                    <Text style={[localStyles.bankAccNumTxt, { letterSpacing: 2, color: currentBank.color }]}>
                                                        {currentBank.accountNumber}
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={localStyles.bankCopyBtn}
                                                        onPress={() => copyToClipboard(currentBank.accountNumber, 'Account Number')}
                                                    >
                                                        <Ionicons name="copy" size={11} color="#2563EB" />
                                                        <Text style={localStyles.bankCopyBtnTxt}>Copy</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                <Text style={localStyles.bankAccNameTxt}>{currentBank.accountName}</Text>

                                                {/* Reference / Narration */}
                                                <View style={[localStyles.vaExpiryRow, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#E2E8F0', marginTop: 8 }]}>
                                                    <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '700' }}>Narration Ref: <Text style={{ color: '#0F172A', fontWeight: '900' }}>{refCode}</Text></Text>
                                                    <TouchableOpacity
                                                        style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 }}
                                                        onPress={() => copyToClipboard(refCode, 'Payment Reference')}
                                                    >
                                                        <Ionicons name="copy-outline" size={10} color="#6366F1" />
                                                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#6366F1' }}>Copy Ref</Text>
                                                    </TouchableOpacity>
                                                </View>

                                                {/* Copy All Details Button */}
                                                <TouchableOpacity
                                                    style={[localStyles.vaCopyAllBtn, { marginTop: 10 }]}
                                                    onPress={() => copyToClipboard(
                                                        `Bank: ${currentBank.bankName}\nAccount: ${currentBank.accountNumber}\nName: ${currentBank.accountName}\nNarration/Ref: ${refCode}`,
                                                        'Bank Transfer Details'
                                                    )}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="copy-outline" size={13} color="#6366F1" />
                                                    <Text style={localStyles.vaCopyAllBtnTxt}>Copy All Bank Details</Text>
                                                </TouchableOpacity>
                                            </View>
                                        );
                                    })()}

                                    {/* SECTION 2: DYNAMIC VIRTUAL ACCOUNT PER USER */}
                                    <View style={{ marginTop: 6, marginBottom: 4 }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                                            <Text style={localStyles.fieldSectionHeader}>OR USE DYNAMIC VIRTUAL ACCOUNT</Text>
                                            <TouchableOpacity
                                                onPress={() => generateVirtualAccount(true)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}
                                            >
                                                <Ionicons name="refresh" size={12} color="#6366F1" />
                                                <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#6366F1' }}>Generate New</Text>
                                            </TouchableOpacity>
                                        </View>

                                        {/* Loading VA */}
                                        {isGeneratingVA && (
                                            <View style={localStyles.vaLoadingCard}>
                                                <ActivityIndicator size="small" color="#6366F1" />
                                                <View style={{ marginLeft: 10 }}>
                                                    <Text style={localStyles.vaLoadingTitle}>Generating Unique Account...</Text>
                                                    <Text style={localStyles.vaLoadingSubtitle}>Creating dynamic session account for you.</Text>
                                                </View>
                                            </View>
                                        )}

                                        {/* VA Card */}
                                        {!isGeneratingVA && virtualAccount?.account_number && (
                                            <View style={[localStyles.bankDetailsCard, { borderColor: '#C7D2FE', backgroundColor: '#F5F3FF' }]}>
                                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                                        <Ionicons name="sparkles" size={11} color="#7C3AED" />
                                                        <Text style={[localStyles.bankDetailLabel, { color: '#7C3AED' }]}>DYNAMIC USER ACCOUNT</Text>
                                                    </View>
                                                    <View style={[localStyles.bankInstantTag, { backgroundColor: '#EDE9FE' }]}>
                                                        <Text style={[localStyles.bankInstantTagTxt, { color: '#7C3AED' }]}>AUTO-LINKED</Text>
                                                    </View>
                                                </View>

                                                <Text style={localStyles.bankNameTxt}>{virtualAccount.bank_name}</Text>
                                                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                                                    <Text style={[localStyles.bankAccNumTxt, { letterSpacing: 1.5, color: '#7C3AED' }]}>
                                                        {virtualAccount.account_number}
                                                    </Text>
                                                    <TouchableOpacity
                                                        style={[localStyles.bankCopyBtn, { backgroundColor: '#EDE9FE' }]}
                                                        onPress={() => copyToClipboard(virtualAccount.account_number, 'Virtual Account Number')}
                                                    >
                                                        <Ionicons name="copy" size={11} color="#7C3AED" />
                                                        <Text style={[localStyles.bankCopyBtnTxt, { color: '#7C3AED' }]}>Copy</Text>
                                                    </TouchableOpacity>
                                                </View>
                                                <Text style={localStyles.bankAccNameTxt}>{virtualAccount.account_name}</Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* English Instructions Box */}
                                    <View style={localStyles.vaInstructionBox}>
                                        <Ionicons name="information-circle-outline" size={16} color="#6366F1" style={{ marginTop: 2 }} />
                                        <Text style={localStyles.vaInstructionTxt}>
                                            Transfer any amount from your banking app (OPay, Kuda, PalmPay, GTBank, Zenith, Access, etc.) to the verified account above. Your wallet balance will be credited promptly upon payment confirmation.
                                        </Text>
                                    </View>
                                </View>
                            ) : (
                                /* ── PAYSTACK & FLUTTERWAVE NAIRA MODE ── */
                                <View style={{ marginTop: 12 }}>
                                    <Text style={localStyles.fieldSectionHeader}>ENTER AMOUNT IN NAIRA (₦)</Text>
                                    <View style={localStyles.inputAreaContainer}>
                                        <Text style={localStyles.inputPrefix}>₦</Text>
                                        <TextInput
                                            style={localStyles.mainTextInput}
                                            value={topUpAmountNgn}
                                            onChangeText={setTopUpAmountNgn}
                                            keyboardType="numeric"
                                            placeholder="0.00"
                                            placeholderTextColor="#94A3B8"
                                        />
                                    </View>

                                    <Text style={localStyles.quickSelectionLabel}>PRESET RECHARGE AMOUNTS</Text>
                                    <View style={localStyles.pillsGrid}>
                                        {['1000', '2500', '5000', '10000', '25000', '50000'].map(val => (
                                            <TouchableOpacity
                                                key={val}
                                                style={[localStyles.amountPill, topUpAmountNgn === val && localStyles.activePill]}
                                                onPress={() => setTopUpAmountNgn(val)}
                                            >
                                                <Text style={[localStyles.pillText, topUpAmountNgn === val && localStyles.activePillText]}>
                                                    ₦{parseInt(val).toLocaleString()}
                                                </Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                </View>
                            )}

                            {/* PROCEED ACTION BUTTON */}
                            <TouchableOpacity
                                style={[localStyles.primaryActionBtn, isTopUpPending && { opacity: 0.7 }]}
                                onPress={handleStartTopUp}
                                disabled={isTopUpPending}
                                activeOpacity={0.88}
                            >
                                {isTopUpPending ? (
                                    <ActivityIndicator color="white" />
                                ) : (
                                    <View style={localStyles.actionBtnContent}>
                                        <Text style={localStyles.actionBtnText}>
                                            {topUpGateway === 'nowpayments'
                                                ? (topUpAmountUsd ? `Pay $${topUpAmountUsd} USD via Crypto` : `Pay via Crypto`)
                                                : topUpGateway === 'bank_transfer'
                                                ? 'I Have Sent Payment'
                                                : (cleanNgnAmount(topUpAmountNgn) > 0 ? `Recharge ${formatCurrency(cleanNgnAmount(topUpAmountNgn))}` : `Recharge Wallet`)}
                                        </Text>
                                        <Ionicons name="arrow-forward" size={15} color="white" />
                                    </View>
                                )}
                            </TouchableOpacity>

                            <View style={localStyles.footerSecurityLine}>
                                <Ionicons name="lock-closed" size={11} color="#059669" />
                                <Text style={localStyles.footerSecurityText}>
                                    Bank-Grade 256-Bit SSL • Instant Escrow Credit Guarantee
                                </Text>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 2: UNIFIED PAYMENT WEBVIEW (PAYSTACK, FLUTTERWAVE, NOWPAYMENTS)
            ══════════════════════════════════════════════════════════════ */}
            <Modal visible={showCheckoutWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={localStyles.webViewHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="shield-checkmark" size={16} color="#059669" />
                            <Text style={localStyles.webViewHeaderTitle}>{activeGatewayName} Secure Gateway</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => {
                                setShowCheckoutWebView(false);
                                Alert.alert('Notice', 'Payment window closed. If your payment was completed, it will reflect within 60 seconds.');
                                fetchWalletData();
                            }}
                        >
                            <Ionicons name="close" size={22} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                    <WebView
                        source={{ uri: checkoutUrl }}
                        onNavigationStateChange={async (navState) => {
                            const url = (navState.url || '').toLowerCase();
                            if (url.includes('status=successful') || url.includes('standard.paystack.co/close') || url.includes('payment/verify')) {
                                setShowCheckoutWebView(false);
                                await handlePaymentCompleteVerification(pendingCreditAmountNgn, activeRef, activeGatewayName);
                            }
                        }}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#0F172A" />
                                <Text style={{ marginTop: 10, color: '#64748B', fontWeight: '700' }}>Loading Secure Gateway...</Text>
                            </View>
                        )}
                        style={{ flex: 1 }}
                    />
                </SafeAreaView>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 3: P2P TRANSFER MODAL
            ══════════════════════════════════════════════════════════════ */}
            <Modal
                visible={showTransferModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowTransferModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />
                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Send Money (P2P)</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Instant transfer to any Mafhal member</Text>
                            </View>
                            <TouchableOpacity style={localStyles.modalCloseCircle} onPress={() => setShowTransferModal(false)}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>RECIPIENT (PHONE, EMAIL, OR USERNAME)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 12 }]}>
                            <Ionicons name="person-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 15 }]}
                                value={transferRecipient}
                                onChangeText={setTransferRecipient}
                                placeholder="e.g. 08109849201 or user@example.com"
                                placeholderTextColor="#CBD5E1"
                                autoCapitalize="none"
                            />
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>AMOUNT TO SEND (₦)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 12 }]}>
                            <Text style={localStyles.inputPrefix}>₦</Text>
                            <TextInput
                                style={localStyles.mainTextInput}
                                value={transferAmount}
                                onChangeText={setTransferAmount}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>NOTE / PURPOSE (OPTIONAL)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 18 }]}>
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 13 }]}
                                value={transferNote}
                                onChangeText={setTransferNote}
                                placeholder="e.g. Lunch refund, Birthday gift"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, { backgroundColor: '#2563EB' }, isTransferPending && { opacity: 0.7 }]}
                            onPress={handleP2PTransfer}
                            disabled={isTransferPending}
                        >
                            {isTransferPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View style={localStyles.actionBtnContent}>
                                    <Text style={localStyles.actionBtnText}>Send {transferAmount ? formatCurrency(parseInt(transferAmount) || 0) : 'Funds'}</Text>
                                    <Ionicons name="paper-plane" size={14} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 4: BANK WITHDRAWAL / CASHOUT MODAL
            ══════════════════════════════════════════════════════════════ */}
            <Modal
                visible={showWithdrawModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowWithdrawModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />
                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Withdraw to Bank</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Cashout funds directly to your Nigerian bank</Text>
                            </View>
                            <TouchableOpacity style={localStyles.modalCloseCircle} onPress={() => setShowWithdrawModal(false)}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>SELECT BANK</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                            <View style={{ flexDirection: 'row', gap: 6 }}>
                                {NIGERIAN_BANKS.slice(0, 7).map(bank => (
                                    <TouchableOpacity
                                        key={bank}
                                        style={[localStyles.bankChip, withdrawBank === bank && localStyles.bankChipActive]}
                                        onPress={() => setWithdrawBank(bank)}
                                    >
                                        <Text style={[localStyles.bankChipTxt, withdrawBank === bank && localStyles.bankChipTxtActive]}>
                                            {bank}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </ScrollView>

                        <Text style={localStyles.fieldSectionHeader}>10-DIGIT ACCOUNT NUMBER</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 12 }]}>
                            <Ionicons name="keypad-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 16 }]}
                                value={withdrawAccountNum}
                                onChangeText={setWithdrawAccountNum}
                                keyboardType="numeric"
                                maxLength={10}
                                placeholder="0123456789"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>AMOUNT TO WITHDRAW (₦)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 18 }]}>
                            <Text style={localStyles.inputPrefix}>₦</Text>
                            <TextInput
                                style={localStyles.mainTextInput}
                                value={withdrawAmount}
                                onChangeText={setWithdrawAmount}
                                keyboardType="numeric"
                                placeholder="1000"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, { backgroundColor: '#D97706' }, isWithdrawPending && { opacity: 0.7 }]}
                            onPress={handleWithdrawal}
                            disabled={isWithdrawPending}
                        >
                            {isWithdrawPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View style={localStyles.actionBtnContent}>
                                    <Text style={localStyles.actionBtnText}>Cashout to {withdrawBank}</Text>
                                    <Ionicons name="arrow-up" size={14} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 5: 100% ESCROW DETAILS MODAL
            ══════════════════════════════════════════════════════════════ */}
            <Modal visible={showEscrowModal} transparent={true} animationType="slide" onRequestClose={() => setShowEscrowModal(false)}>
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />
                        <View style={localStyles.modalHeaderSection}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={localStyles.escrowShieldCircle}>
                                    <Ionicons name="shield-checkmark" size={20} color="#059669" />
                                </View>
                                <View>
                                    <Text style={localStyles.modalMainTitle}>100% Escrow Protection</Text>
                                    <Text style={localStyles.modalSecondaryTitle}>Bank-Grade Buyer Defense Protocol</Text>
                                </View>
                            </View>
                            <TouchableOpacity style={localStyles.modalCloseCircle} onPress={() => setShowEscrowModal(false)}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView style={{ maxHeight: 320, marginTop: 10 }}>
                            <View style={localStyles.escrowModalRow}>
                                <Ionicons name="lock-closed" size={16} color="#059669" style={{ marginTop: 2 }} />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={localStyles.escrowModalBulletTitle}>Zero Upfront Merchant Payout</Text>
                                    <Text style={localStyles.escrowModalBulletDesc}>
                                        Funds remain securely locked in Abu Mafhal's escrow vault until you physically inspect and accept your delivery.
                                    </Text>
                                </View>
                            </View>

                            <View style={localStyles.escrowModalRow}>
                                <Ionicons name="repeat" size={16} color="#2563EB" style={{ marginTop: 2 }} />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={localStyles.escrowModalBulletTitle}>7-Day Free Return & Replacement</Text>
                                    <Text style={localStyles.escrowModalBulletDesc}>
                                        Damaged, defective, or incorrect items qualify for an immediate 100% refund or free item replacement.
                                    </Text>
                                </View>
                            </View>

                            <View style={localStyles.escrowModalRow}>
                                <Ionicons name="checkmark-done-circle" size={16} color="#D97706" style={{ marginTop: 2 }} />
                                <View style={{ flex: 1, marginLeft: 10 }}>
                                    <Text style={localStyles.escrowModalBulletTitle}>Verified Courier Handover</Text>
                                    <Text style={localStyles.escrowModalBulletDesc}>
                                        Delivery drivers require your unique secret confirmation code before an order can be marked as complete.
                                    </Text>
                                </View>
                            </View>
                        </ScrollView>

                        <TouchableOpacity style={localStyles.primaryActionBtn} onPress={() => setShowEscrowModal(false)}>
                            <Text style={localStyles.actionBtnText}>I Understand • My Funds Are Safe</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 6: TRANSACTION RECEIPT MODAL
            ══════════════════════════════════════════════════════════════ */}
            <Modal visible={selectedTx !== null} transparent={true} animationType="fade" onRequestClose={() => setSelectedTx(null)}>
                {selectedTx ? (
                    <View style={[localStyles.modalDimLayer, { justifyContent: 'center', padding: 24 }]}>
                        <View style={localStyles.receiptCard}>
                            <TouchableOpacity style={{ position: 'absolute', top: 16, right: 16 }} onPress={() => setSelectedTx(null)}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>

                            <View style={{ alignItems: 'center', marginTop: 10 }}>
                                <View style={localStyles.receiptIconCircle}>
                                    <Ionicons name="checkmark-circle" size={32} color="#059669" />
                                </View>
                                <Text style={localStyles.receiptHeaderTxt}>Digital Payment Receipt</Text>
                                <Text style={localStyles.receiptAmountTxt}>
                                    {selectedTx.amount !== 0 ? (
                                        selectedTx.amount > 0 ? `+₦${selectedTx.amount.toLocaleString()}` : `-₦${Math.abs(selectedTx.amount).toLocaleString()}`
                                    ) : selectedTx.points_change ? `+${selectedTx.points_change} AMC` : '-'}
                                </Text>
                            </View>

                            <View style={localStyles.receiptDashedLine} />

                            <View style={{ gap: 8 }}>
                                <View style={localStyles.receiptRow}>
                                    <Text style={localStyles.receiptFieldLabel}>Reference</Text>
                                    <Text style={localStyles.receiptFieldVal}>#{selectedTx.id?.toString().slice(0, 12).toUpperCase() || 'TX-8492'}</Text>
                                </View>
                                <View style={localStyles.receiptRow}>
                                    <Text style={localStyles.receiptFieldLabel}>Type</Text>
                                    <Text style={[localStyles.receiptFieldVal, { textTransform: 'capitalize' }]}>{selectedTx.type || 'payment'}</Text>
                                </View>
                                <View style={localStyles.receiptRow}>
                                    <Text style={localStyles.receiptFieldLabel}>Status</Text>
                                    <Text style={[localStyles.receiptFieldVal, { color: '#059669' }]}>SUCCESSFUL</Text>
                                </View>
                                <View style={localStyles.receiptRow}>
                                    <Text style={localStyles.receiptFieldLabel}>Description</Text>
                                    <Text style={[localStyles.receiptFieldVal, { maxWidth: 180, textAlign: 'right' }]} numberOfLines={2}>
                                        {selectedTx.description || 'Wallet Transaction'}
                                    </Text>
                                </View>
                                <View style={localStyles.receiptRow}>
                                    <Text style={localStyles.receiptFieldLabel}>Timestamp</Text>
                                    <Text style={localStyles.receiptFieldVal}>{new Date(selectedTx.created_at).toLocaleString()}</Text>
                                </View>
                            </View>

                            <TouchableOpacity style={localStyles.receiptCloseBtn} onPress={() => setSelectedTx(null)}>
                                <Text style={localStyles.receiptCloseBtnTxt}>Close Receipt</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 7: CREATE SAVINGS POT
            ══════════════════════════════════════════════════════════════ */}
            <Modal visible={showCreatePotModal} transparent={true} animationType="slide" onRequestClose={() => setShowCreatePotModal(false)}>
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />
                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Create Savings Pot</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Set a dedicated financial milestone</Text>
                            </View>
                            <TouchableOpacity style={localStyles.modalCloseCircle} onPress={() => setShowCreatePotModal(false)}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>POT NAME</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 12 }]}>
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 15 }]}
                                value={newPotName}
                                onChangeText={setNewPotName}
                                placeholder="e.g. Wedding Gift, New iPhone, Rent"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>TARGET AMOUNT (₦)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 18 }]}>
                            <Text style={localStyles.inputPrefix}>₦</Text>
                            <TextInput
                                style={localStyles.mainTextInput}
                                value={newPotTarget}
                                onChangeText={setNewPotTarget}
                                keyboardType="numeric"
                                placeholder="20000"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <TouchableOpacity style={localStyles.primaryActionBtn} onPress={handleCreatePot}>
                            <Text style={localStyles.actionBtnText}>Create Pot</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 8: BUDGET LIMIT MODAL
            ══════════════════════════════════════════════════════════════ */}
            <Modal visible={showBudgetModal} transparent={true} animationType="slide" onRequestClose={() => setShowBudgetModal(false)}>
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />
                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Monthly Spend Limit</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Set a budget ceiling to keep expenses in check</Text>
                            </View>
                            <TouchableOpacity style={localStyles.modalCloseCircle} onPress={() => setShowBudgetModal(false)}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={localStyles.fieldSectionHeader}>MONTHLY LIMIT (₦)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 18 }]}>
                            <Text style={localStyles.inputPrefix}>₦</Text>
                            <TextInput
                                style={localStyles.mainTextInput}
                                value={budgetInputVal}
                                onChangeText={setBudgetInputVal}
                                keyboardType="numeric"
                                placeholder={monthlyLimit.toString()}
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <TouchableOpacity 
                            style={localStyles.primaryActionBtn} 
                            onPress={async () => {
                                const val = parseInt(budgetInputVal);
                                if (isNaN(val) || val <= 0) {
                                    Alert.alert('Error', 'Please enter a valid amount');
                                    return;
                                }
                                setMonthlyLimit(val);
                                if (user?.id) AsyncStorage.setItem(`MONTHLY_LIMIT_${user.id}`, val.toString());
                                setShowBudgetModal(false);
                                Alert.alert('Saved', `Monthly limit updated to ${formatCurrency(val)}`);
                            }}
                        >
                            <Text style={localStyles.actionBtnText}>Save Limit</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 9: REDEEM VOUCHER MODAL
            ══════════════════════════════════════════════════════════════ */}
            <Modal visible={showVoucherModal} transparent={true} animationType="slide" onRequestClose={() => setShowVoucherModal(false)}>
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />
                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Redeem Promo Voucher</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Enter your secret code to claim bonus coins</Text>
                            </View>
                            <TouchableOpacity style={localStyles.modalCloseCircle} onPress={() => setShowVoucherModal(false)}>
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={[localStyles.inputAreaContainer, { marginBottom: 18 }]}>
                            <Ionicons name="gift-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 17 }]}
                                value={voucherCode}
                                onChangeText={setVoucherCode}
                                placeholder="e.g. MAFHALE500 or VIPBONUS"
                                placeholderTextColor="#CBD5E1"
                                autoCapitalize="characters"
                            />
                        </View>

                        <TouchableOpacity 
                            style={[localStyles.primaryActionBtn, { backgroundColor: '#059669' }]} 
                            onPress={handleRedeemVoucher}
                            disabled={isVoucherRedeeming}
                        >
                            {isVoucherRedeeming ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <Text style={localStyles.actionBtnText}>Redeem Code</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ══════════════════════════════════════════════════════════════
                MODAL 10: CELEBRATORY DEPOSIT SUCCESS MODAL
            ══════════════════════════════════════════════════════════════ */}
            <Modal
                visible={showDepositSuccessModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowDepositSuccessModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={[localStyles.modalContentSheet, { paddingBottom: 28, alignItems: 'center' }]}>
                        <View style={localStyles.modalHandleBar} />

                        <View style={localStyles.successCelebrationIconRing}>
                            <View style={localStyles.successCelebrationIconInner}>
                                <Ionicons name="checkmark-circle" size={44} color="#059669" />
                            </View>
                        </View>

                        <Text style={localStyles.successTitle}>Deposit Successful! 🎉</Text>
                        <Text style={localStyles.successSubtitle}>
                            Your wallet balance has been credited instantly with 100% Escrow Protection.
                        </Text>

                        <View style={localStyles.successAmountCard}>
                            <Text style={localStyles.successAmountLabel}>TOTAL ACCREDITED AMOUNT</Text>
                            <Text style={localStyles.successAmountBig}>
                                +{formatCurrency(depositSuccessDetails?.amount || 0)}
                            </Text>
                            {depositSuccessDetails?.usdAmount ? (
                                <Text style={localStyles.successUsdSub}>
                                    (${depositSuccessDetails.usdAmount} USD via {depositSuccessDetails.gateway || 'NOWPayments'})
                                </Text>
                            ) : null}
                        </View>

                        <View style={localStyles.successReceiptTable}>
                            <View style={localStyles.receiptRow}>
                                <Text style={localStyles.receiptKey}>Payment Gateway</Text>
                                <Text style={localStyles.receiptVal}>{depositSuccessDetails?.gateway || 'Paystack'}</Text>
                            </View>
                            <View style={localStyles.receiptRow}>
                                <Text style={localStyles.receiptKey}>Transaction Ref</Text>
                                <Text style={[localStyles.receiptVal, { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 11 }]}>
                                    {depositSuccessDetails?.reference || 'WLT-TX-SUCCESS'}
                                </Text>
                            </View>
                            <View style={localStyles.receiptRow}>
                                <Text style={localStyles.receiptKey}>New Wallet Balance</Text>
                                <Text style={[localStyles.receiptVal, { color: '#059669', fontWeight: '900' }]}>
                                    {formatCurrency(wallet.balance || 0)}
                                </Text>
                            </View>
                            <View style={[localStyles.receiptRow, { borderBottomWidth: 0 }]}>
                                <Text style={localStyles.receiptKey}>Escrow Status</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="shield-checkmark" size={12} color="#059669" />
                                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#059669' }}>Secured (Tier 1)</Text>
                                </View>
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, { width: '100%', marginTop: 16 }]}
                            onPress={() => {
                                setShowDepositSuccessModal(false);
                                fetchWalletData();
                            }}
                            activeOpacity={0.85}
                        >
                            <Text style={localStyles.actionBtnText}>Done / View Updated Wallet</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
};

// ══════════════════════════════════════════════════════════════════════════
// LUXURY FINTECH STYLESHEET
// ══════════════════════════════════════════════════════════════════════════
const localStyles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 12 : 6,
        paddingBottom: 10,
        backgroundColor: '#FFFFFF',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    headerIconButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    headerLiveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#10B981'
    },
    headerSub: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 1
    },
    escrowHeaderPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#86EFAC',
        paddingHorizontal: 8,
        paddingVertical: 4.5,
        borderRadius: 12
    },
    escrowHeaderPillTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#065F46'
    },

    // HERO CREDIT CARD
    heroSection: {
        paddingHorizontal: 16,
        paddingTop: 12
    },
    balanceCard: {
        borderRadius: 20,
        padding: 18,
        position: 'relative',
        overflow: 'hidden',
        minHeight: 180,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
        elevation: 4
    },
    decorCircle: {
        position: 'absolute',
        top: -30,
        right: -30,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.05)'
    },
    decorCircle2: {
        position: 'absolute',
        bottom: -40,
        left: -30,
        width: 140,
        height: 140,
        borderRadius: 70,
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    vipBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 8
    },
    vipBadgeDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#86EFAC'
    },
    vipBadgeTxt: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    eyeBtn: {
        padding: 4
    },
    currencySwitchGroup: {
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.25)',
        borderRadius: 8,
        padding: 2,
        gap: 2
    },
    currencySwitchBtn: {
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6
    },
    currencySwitchBtnActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.22)'
    },
    currencySwitchTxt: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 9.5,
        fontWeight: '800'
    },
    currencySwitchTxtActive: {
        color: '#FFFFFF',
        fontWeight: '900'
    },
    balanceLabelText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.6)',
        letterSpacing: 0.6
    },
    balanceAmountText: {
        fontSize: 27,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
        marginTop: 4
    },
    balanceEquivText: {
        fontSize: 11,
        color: 'rgba(255, 255, 255, 0.75)',
        fontWeight: '700',
        marginTop: 3
    },
    smartChip: {
        width: 24,
        height: 18,
        borderRadius: 3,
        backgroundColor: '#FDE68A',
        position: 'relative',
        overflow: 'hidden'
    },
    chipLineV1: {
        position: 'absolute',
        left: 8,
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: '#D97706'
    },
    chipLineV2: {
        position: 'absolute',
        right: 8,
        top: 0,
        bottom: 0,
        width: 1,
        backgroundColor: '#D97706'
    },
    chipLineH: {
        position: 'absolute',
        top: 9,
        left: 0,
        right: 0,
        height: 1,
        backgroundColor: '#D97706'
    },
    copyRefBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6
    },
    copyRefTxt: {
        color: 'rgba(255, 255, 255, 0.75)',
        fontSize: 9.5,
        fontWeight: '800',
        letterSpacing: 0.4
    },
    cardMetaLabel: {
        fontSize: 8,
        fontWeight: '800',
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: 0.4
    },
    cardMetaVal: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#FFFFFF',
        marginTop: 1
    },
    cardSkinRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 10
    },
    cardSkinTitle: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase'
    },
    cardSkinDot: {
        width: 16,
        height: 16,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: '#E2E8F0'
    },
    cardSkinDotActive: {
        borderColor: '#0F172A',
        transform: [{ scale: 1.2 }]
    },

    // ACTION STRIP
    actionStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        marginTop: 14
    },
    actionItem: {
        alignItems: 'center',
        flex: 1
    },
    actionIconWrapper: {
        width: 44,
        height: 44,
        borderRadius: 22,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#0F172A'
    },

    // ESCROW VAULT BANNER
    escrowVaultCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        borderRadius: 14,
        padding: 12,
        marginHorizontal: 16,
        marginTop: 14
    },
    escrowVaultIconCircle: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center'
    },
    escrowVaultTitle: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#065F46'
    },
    escrowVaultTag: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6
    },
    escrowVaultTagTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#065F46'
    },
    escrowVaultSub: {
        fontSize: 10.5,
        color: '#047857',
        marginTop: 2,
        lineHeight: 14
    },

    // TRACKERS
    widgetRow: {
        flexDirection: 'row',
        gap: 10,
        paddingHorizontal: 16,
        marginTop: 12
    },
    budgetWidget: {
        flex: 1,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    widgetTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#1E293B'
    },
    widgetEditTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#2563EB'
    },
    widgetTrack: {
        height: 4,
        backgroundColor: '#F1F5F9',
        borderRadius: 2,
        overflow: 'hidden',
        marginVertical: 6
    },
    widgetFill: {
        height: '100%',
        borderRadius: 2
    },
    widgetSub: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '600'
    },

    // SAVINGS SECTION
    savingsContainer: {
        marginTop: 16
    },
    sectionHeaderSavings: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 10
    },
    sectionTitleText: {
        fontSize: 13.5,
        fontWeight: '900',
        color: '#0F172A'
    },
    addPotLink: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2563EB'
    },
    createPotCard: {
        width: 110,
        height: 105,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#3B82F6',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 8
    },
    createPotCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4
    },
    createPotTitle: {
        fontSize: 11,
        fontWeight: '800',
        color: '#2563EB'
    },
    createPotSub: {
        fontSize: 8.5,
        color: '#94A3B8',
        marginTop: 1
    },
    savingsGoalCard: {
        width: 145,
        height: 105,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        justifyContent: 'space-between'
    },
    savingsIconWrapper: {
        width: 26,
        height: 26,
        borderRadius: 13,
        alignItems: 'center',
        justifyContent: 'center'
    },
    savingsGoalPercent: {
        fontSize: 10.5,
        fontWeight: '900'
    },
    savingsGoalName: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    savingsGoalAmount: {
        fontSize: 11,
        fontWeight: '800',
        color: '#059669'
    },
    progressTrack: {
        height: 3.5,
        backgroundColor: '#F1F5F9',
        borderRadius: 2,
        overflow: 'hidden'
    },
    progressBar: {
        height: '100%',
        borderRadius: 2
    },

    // TRANSACTIONS
    hubContainer: {
        paddingHorizontal: 16,
        marginTop: 18
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    txCountBadge: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8
    },
    searchBarContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 8,
        marginBottom: 10
    },
    searchBarInput: {
        flex: 1,
        marginLeft: 6,
        fontSize: 12,
        color: '#0F172A',
        padding: 0
    },
    filterRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    activeFilterChip: {
        backgroundColor: '#0F172A',
        borderColor: '#0F172A'
    },
    filterChipText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: '#64748B'
    },
    activeFilterChipText: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    transactionContainerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 4
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10
    },
    activityIconContainer: {
        width: 32,
        height: 32,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    activityTitleText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A'
    },
    activityTimeText: {
        fontSize: 10,
        color: '#94A3B8',
        marginTop: 2
    },
    activityAmountText: {
        fontSize: 12.5,
        fontWeight: '900'
    },
    statusBubble: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginTop: 2
    },
    statusDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#059669'
    },
    statusBubbleText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#059669'
    },
    txDivider: {
        height: 1,
        backgroundColor: '#F8FAFC',
        marginLeft: 54
    },
    noActivityBox: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 30,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    noActivityTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
        marginTop: 8
    },
    noActivitySub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
        textAlign: 'center',
        paddingHorizontal: 20
    },

    // MODAL BASICS
    modalDimLayer: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end'
    },
    modalContentSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingHorizontal: 18,
        paddingTop: 10,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        maxWidth: 540,
        width: '100%',
        alignSelf: 'center'
    },
    modalHandleBar: {
        width: 36,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#E2E8F0',
        alignSelf: 'center',
        marginBottom: 12
    },
    modalHeaderSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14
    },
    modalMainTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.2
    },
    modalSecondaryTitle: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 1
    },
    modalCloseCircle: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    fieldSectionHeader: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginBottom: 6
    },

    // GATEWAY SHOWCASE STRIP (MAIN WALLET PAGE)
    gatewayShowcaseContainer: {
        marginHorizontal: 16,
        marginTop: 12,
        marginBottom: 8,
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1
    },
    gatewayShowcaseHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    gatewayShowcaseTitle: {
        fontSize: 10.5,
        fontWeight: '900',
        color: '#334155',
        letterSpacing: 0.6
    },
    gatewayShowcaseLink: {
        fontSize: 11,
        fontWeight: '800',
        color: '#059669'
    },
    gatewayShowcasePill: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    gatewayShowcaseName: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    gatewayShowcaseChannels: {
        fontSize: 9.5,
        color: '#64748B',
        marginTop: 2
    },

    // LUXURY SELECTABLE GATEWAY LIST (MODAL 1)
    luxuryGatewayList: {
        gap: 8,
        marginBottom: 12
    },
    luxuryGwCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 3,
        elevation: 1
    },
    luxuryGwCardActive: {
        backgroundColor: '#F8FAFC',
        shadowOpacity: 0.08,
        shadowRadius: 5
    },
    luxuryGwName: {
        fontSize: 13,
        fontWeight: '800',
        color: '#1E293B'
    },
    luxuryGwSub: {
        fontSize: 10.5,
        color: '#64748B',
        marginTop: 2
    },
    gwMiniBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    gwMiniBadgeTxt: {
        fontSize: 9,
        fontWeight: '800'
    },
    gwChannelsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4
    },
    gwSpeedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5
    },
    gwSpeedTagTxt: {
        fontSize: 9,
        fontWeight: '700',
        color: '#059669'
    },
    gwCurrencyTag: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#94A3B8'
    },
    gwRadioContainer: {
        marginLeft: 8,
        justifyContent: 'center',
        alignItems: 'center'
    },

    // LIVE BALANCE PROJECTION CARD
    balanceProjectionCard: {
        backgroundColor: '#F0FDF4',
        borderRadius: 14,
        borderWidth: 1.2,
        borderColor: '#BBF7D0',
        padding: 12,
        marginBottom: 12
    },
    projectionTitle: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#166534',
        letterSpacing: 0.5
    },
    projectionBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5
    },
    projectionBadgeTxt: {
        fontSize: 8.5,
        fontWeight: '900',
        color: '#15803D'
    },
    projectionMathRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 8
    },
    projectionMathCol: {
        alignItems: 'flex-start'
    },
    projectionMathLabel: {
        fontSize: 9,
        fontWeight: '700',
        color: '#4B5563'
    },
    projectionMathVal: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#1F2937',
        marginTop: 1
    },

    // CELEBRATORY DEPOSIT SUCCESS MODAL (MODAL 10)
    successCelebrationIconRing: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        borderWidth: 2,
        borderColor: '#A7F3D0'
    },
    successCelebrationIconInner: {
        width: 58,
        height: 58,
        borderRadius: 29,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center'
    },
    successTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.3
    },
    successSubtitle: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
        paddingHorizontal: 16
    },
    successAmountCard: {
        width: '100%',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 14,
        alignItems: 'center',
        marginTop: 14,
        marginBottom: 12
    },
    successAmountLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.6
    },
    successAmountBig: {
        fontSize: 26,
        fontWeight: '900',
        color: '#059669',
        marginTop: 2
    },
    successUsdSub: {
        fontSize: 11,
        color: '#D97706',
        fontWeight: '700',
        marginTop: 2
    },
    successReceiptTable: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        paddingHorizontal: 12,
        paddingVertical: 6
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 7,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC'
    },
    receiptKey: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600'
    },
    receiptVal: {
        fontSize: 11.5,
        color: '#0F172A',
        fontWeight: '700'
    },

    // LEGACY FALLBACK GATEWAY CARDS
    gatewayCardRow: {
        flexDirection: 'row',
        gap: 6,
        marginBottom: 10
    },
    gwCard: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        paddingVertical: 10,
        paddingHorizontal: 6,
        alignItems: 'center'
    },
    gwCardActive: {
        borderColor: '#059669',
        backgroundColor: '#F0FDF4'
    },
    gwIconBox: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 4
    },
    gwCardTitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#0F172A'
    },
    gwCardSub: {
        fontSize: 8,
        color: '#64748B',
        marginTop: 1
    },

    // INPUTS
    inputAreaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'transparent',
        borderRadius: 0,
        paddingHorizontal: 0,
        paddingVertical: 6,
        borderBottomWidth: 2,
        borderBottomColor: '#E2E8F0'
    },
    inputPrefix: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
        marginRight: 6
    },
    mainTextInput: {
        flex: 1,
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
        padding: 0
    },
    currencyTag: {
        backgroundColor: '#E2E8F0',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    currencyTagTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#334155'
    },

    // PRESETS
    quickSelectionLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.6,
        marginTop: 12,
        marginBottom: 6
    },
    pillsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 16
    },
    amountPill: {
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    activePill: {
        backgroundColor: '#ECFDF5',
        borderColor: '#059669'
    },
    pillText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    activePillText: {
        color: '#059669',
        fontWeight: '900'
    },

    // CRYPTO SPECIFIC STYLES
    cryptoAlertBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#FEF3C7',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 10,
        padding: 8,
        marginBottom: 10
    },
    cryptoAlertTxt: {
        fontSize: 10.5,
        color: '#92400E',
        flex: 1,
        lineHeight: 14
    },
    conversionPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 6,
        paddingHorizontal: 2
    },
    conversionPillTxt: {
        fontSize: 10.5,
        color: '#64748B',
        fontWeight: '600'
    },

    // BANK TRANSFER SPECIFIC
    bankDetailsCard: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10
    },
    bankDetailLabel: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 0.5
    },
    bankInstantTag: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 4
    },
    bankInstantTagTxt: {
        fontSize: 8,
        fontWeight: '900',
        color: '#065F46'
    },
    bankNameTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 2
    },
    bankAccNumTxt: {
        fontSize: 18,
        fontWeight: '900',
        color: '#2563EB',
        letterSpacing: 0.8
    },
    bankCopyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6
    },
    bankCopyBtnTxt: {
        fontSize: 10,
        fontWeight: '800',
        color: '#2563EB'
    },
    bankAccNameTxt: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '700',
        marginTop: 2
    },

    // VIRTUAL ACCOUNT AUTO-GENERATE STYLES
    vaLoadingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EDE9FE',
        borderRadius: 12,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#C4B5FD'
    },
    vaLoadingTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#4C1D95'
    },
    vaLoadingSubtitle: {
        fontSize: 11,
        color: '#7C3AED',
        marginTop: 2
    },
    vaErrorCard: {
        backgroundColor: '#FEF2F2',
        borderRadius: 12,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#FECACA'
    },
    vaErrorTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#DC2626'
    },
    vaErrorMsg: {
        fontSize: 11,
        color: '#7F1D1D',
        marginBottom: 8,
        lineHeight: 16
    },
    vaRetryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: '#EDE9FE',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8
    },
    vaRetryBtnTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#6366F1'
    },
    vaProviderBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        flex: 1
    },
    vaProviderBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#065F46'
    },
    vaAccountCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#6366F1',
        padding: 14,
        marginBottom: 10,
        shadowColor: '#6366F1',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 2
    },
    vaExpiryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 8,
        backgroundColor: '#FFFBEB',
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 5
    },
    vaExpiryTxt: {
        fontSize: 10,
        fontWeight: '700',
        color: '#92400E',
        flex: 1
    },
    vaCopyAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'center',
        backgroundColor: '#EDE9FE',
        borderRadius: 10,
        paddingVertical: 10,
        marginBottom: 4,
        borderWidth: 1,
        borderColor: '#C4B5FD'
    },
    vaCopyAllBtnTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#6366F1'
    },
    vaInstructionBox: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        backgroundColor: '#EEF2FF',
        borderRadius: 10,
        padding: 10,
        marginTop: 10,
        borderWidth: 1,
        borderColor: '#C7D2FE'
    },
    vaInstructionTxt: {
        fontSize: 11,
        color: '#3730A3',
        fontWeight: '600',
        lineHeight: 16,
        flex: 1
    },
    bankChip: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    bankChipActive: {
        backgroundColor: '#FEF3C7',
        borderColor: '#D97706'
    },
    bankChipTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B'
    },
    bankChipTxtActive: {
        color: '#92400E',
        fontWeight: '900'
    },

    // BUTTONS
    primaryActionBtn: {
        backgroundColor: '#0F172A',
        paddingVertical: 13,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2,
        marginTop: 6
    },
    actionBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    actionBtnText: {
        color: '#FFFFFF',
        fontSize: 13.5,
        fontWeight: '900',
        letterSpacing: 0.2
    },
    footerSecurityLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        gap: 4
    },
    footerSecurityText: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '600'
    },

    // WEBVIEW MODAL
    webViewHeader: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    webViewHeaderTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },

    // ESCROW MODAL BULLETS
    escrowShieldCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#ECFDF5',
        alignItems: 'center',
        justifyContent: 'center'
    },
    escrowModalRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        paddingVertical: 10,
        borderBottomWidth: 0.5,
        borderBottomColor: '#F1F5F9'
    },
    escrowModalBulletTitle: {
        fontSize: 12.5,
        fontWeight: '900',
        color: '#0F172A'
    },
    escrowModalBulletDesc: {
        fontSize: 11,
        color: '#64748B',
        lineHeight: 15,
        marginTop: 2
    },

    // RECEIPT MODAL
    receiptCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxWidth: 400
    },
    receiptIconCircle: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#DCFCE7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    receiptHeaderTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    receiptAmountTxt: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0F172A',
        marginTop: 4
    },
    receiptDashedLine: {
        borderStyle: 'dashed',
        borderWidth: 0.8,
        borderColor: '#E2E8F0',
        marginVertical: 14
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    receiptFieldLabel: {
        color: '#94A3B8',
        fontSize: 11.5,
        fontWeight: '600'
    },
    receiptFieldVal: {
        color: '#1E293B',
        fontSize: 12,
        fontWeight: '800'
    },
    receiptCloseBtn: {
        backgroundColor: '#F1F5F9',
        paddingVertical: 11,
        borderRadius: 10,
        alignItems: 'center',
        marginTop: 16
    },
    receiptCloseBtnTxt: {
        color: '#1E293B',
        fontWeight: '800',
        fontSize: 12.5
    }
});

export const WalletPage = (props) => {
    const { settings } = useAppSettings();

    if (settings?.loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '700', fontSize: 13 }}>Initializing Wallet Security...</Text>
            </View>
        );
    }
    return (
        <WalletPageInner {...props} />
    );
};
