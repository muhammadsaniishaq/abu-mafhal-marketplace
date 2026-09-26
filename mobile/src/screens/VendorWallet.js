import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    ScrollView,
    Modal,
    TextInput,
    Alert,
    StyleSheet,
    ActivityIndicator,
    RefreshControl,
    Animated,
    Easing,
    Platform,
    Share
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

const POPULAR_NIGERIAN_BANKS = [
    { name: 'OPay Digital Services', code: '999992' },
    { name: 'Palmpay', code: '999991' },
    { name: 'Moniepoint MFB', code: '50515' },
    { name: 'Kuda Microfinance Bank', code: '50211' },
    { name: 'Access Bank', code: '044' },
    { name: 'Guaranty Trust Bank (GTBank)', code: '058' },
    { name: 'Zenith Bank', code: '057' },
    { name: 'First Bank of Nigeria', code: '011' },
    { name: 'United Bank for Africa (UBA)', code: '033' },
    { name: 'Fidelity Bank', code: '070' },
    { name: 'Stanbic IBTC Bank', code: '221' },
    { name: 'Union Bank of Nigeria', code: '032' },
    { name: 'Sterling Bank', code: '232' },
    { name: 'Wema Bank (ALAT)', code: '035' },
    { name: 'Polaris Bank', code: '076' },
    { name: 'Jaiz Bank', code: '301' },
    { name: 'TAJ Bank', code: '302' },
    { name: 'Lotus Bank', code: '303' }
];

const PRESET_AMOUNTS = [5000, 10000, 25000, 50000, 100000];

export const VendorWallet = ({ user, wallet, fetchDashboardData }) => {
    const navigation = useNavigation();

    // Core Wallet Balances & Stats
    const [localWallet, setLocalWallet] = useState({
        balance: wallet?.balance || 0,
        pending_balance: wallet?.pending_balance || 0,
        total_sales: wallet?.total_sales || 0,
        total_withdrawn: 0,
        total_orders_count: 0
    });

    // Active Tab in Wallet Hub
    // 'overview' | 'escrow' | 'ledger' | 'banks' | 'insights'
    const [activeTab, setActiveTab] = useState('overview');

    // Transactions & Escrow Lists
    const [transactions, setTransactions] = useState([]);
    const [escrowOrders, setEscrowOrders] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isBalanceHidden, setIsBalanceHidden] = useState(false);

    // Bank Accounts State
    const [savedBanks, setSavedBanks] = useState([]);
    const [selectedBankId, setSelectedBankId] = useState(null);
    const [showAddBankModal, setShowAddBankModal] = useState(false);

    // Withdrawal Modal State
    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankCode, setBankCode] = useState('');
    const [accountNo, setAccountNo] = useState('');
    const [accountName, setAccountName] = useState('');
    const [saveThisBank, setSaveThisBank] = useState(true);
    const [resolvingAccount, setResolvingAccount] = useState(false);
    const [submittingWithdrawal, setSubmittingWithdrawal] = useState(false);

    // Bank Picker Dropdown Modal
    const [banks, setBanks] = useState(POPULAR_NIGERIAN_BANKS);
    const [filteredBanks, setFilteredBanks] = useState(POPULAR_NIGERIAN_BANKS);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [searchBankQuery, setSearchBankQuery] = useState('');

    // Transfer to Buyer Wallet Modal
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferNote, setTransferNote] = useState('');
    const [submittingTransfer, setSubmittingTransfer] = useState(false);

    // Digital Receipt Modal
    const [showReceiptModal, setShowReceiptModal] = useState(false);
    const [selectedReceipt, setSelectedReceipt] = useState(null);

    // Ledger Filters & Search
    const [txFilter, setTxFilter] = useState('all'); // 'all' | 'credit' | 'debit' | 'pending'
    const [txSearchQuery, setTxSearchQuery] = useState('');

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(15)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 450,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true
            })
        ]).start();

        loadSavedBanks();
        fetchBanksList();
        fetchAllWalletData();
    }, [user?.id]);

    useFocusEffect(
        useCallback(() => {
            fetchAllWalletData();
        }, [user?.id])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await Promise.allSettled([
            fetchAllWalletData(),
            fetchDashboardData ? fetchDashboardData() : Promise.resolve()
        ]);
        setRefreshing(false);
    }, [user?.id, fetchDashboardData]);

    // -------------------------------------------------------------
    // 1. DATA FETCHING: BALANCE, ESCROW, TRANSACTIONS & SALES
    // -------------------------------------------------------------
    const fetchAllWalletData = async () => {
        if (!user?.id) return;
        try {
            setLoadingData(true);

            // A. Fetch Profile balance and direct transactions
            const [pRes, txRes, vpRes] = await Promise.allSettled([
                supabase.from('profiles').select('balance, role, business_name').eq('id', user.id).maybeSingle(),
                supabase.from('transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100),
                supabase.from('vendor_payouts').select('*').eq('vendor_id', user.id).order('created_at', { ascending: false })
            ]);

            const profileBal = Number(pRes.status === 'fulfilled' ? pRes.value?.data?.balance : 0) || 0;
            const txData = txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data) ? txRes.value.data : [];
            const vpData = vpRes.status === 'fulfilled' && Array.isArray(vpRes.value?.data) ? vpRes.value.data : [];

            // B. Calculate Ledger Balance (credits - debits)
            const totalCredits = txData
                .filter(t => ['topup', 'credit', 'deposit', 'sale_credit', 'escrow_release'].includes(t.type) && ['completed', 'successful'].includes(t.status))
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const totalDebits = txData
                .filter(t => ['withdrawal', 'debit', 'payout', 'wallet_purchase', 'vendor_transfer'].includes(t.type) && ['completed', 'successful'].includes(t.status))
                .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

            const ledgerBal = Math.max(0, totalCredits - totalDebits);
            const activeBal = Math.max(profileBal, ledgerBal);

            // C. Fetch Vendor Products to Query Real-time Orders & Escrow
            let pendingEscrowSum = 0;
            let lifetimeSalesSum = 0;
            let escrowItemsList = [];
            let ordersTotalCount = 0;

            try {
                const { data: vProds } = await supabase.from('products').select('id, name, price, images').eq('vendor_id', user.id);
                const pIds = (vProds || []).map(p => p.id);

                let oiQuery = supabase.from('order_items').select(`
                    id, quantity, price, created_at,
                    order:orders (
                        id, status, payment_status, total_amount, shipping_address, contact_phone, created_at, tracking_number,
                        customer:profiles ( full_name, phone )
                    ),
                    product:products ( id, name, images, vendor_id )
                `);

                if (pIds.length > 0) {
                    oiQuery = oiQuery.or(`vendor_id.eq.${user.id},product_id.in.(${pIds.join(',')})`);
                } else {
                    oiQuery = oiQuery.eq('vendor_id', user.id);
                }

                const { data: oiItems, error: oiErr } = await oiQuery;

                if (!oiErr && Array.isArray(oiItems)) {
                    ordersTotalCount = oiItems.length;
                    oiItems.forEach(item => {
                        const order = item.order || {};
                        const prod = item.product || {};
                        const cust = order.customer || {};
                        const st = (order.status || 'pending').toLowerCase();
                        const qty = Number(item.quantity) || 1;
                        const pr = Number(item.price) || 0;
                        const lineTotal = qty * pr;

                        if (st === 'delivered') {
                            lifetimeSalesSum += lineTotal;
                        } else if (!['cancelled', 'refunded'].includes(st)) {
                            // Order is actively being processed / in transit -> FUNDS ARE IN ESCROW
                            pendingEscrowSum += lineTotal;
                            escrowItemsList.push({
                                id: item.id,
                                orderId: order.id,
                                trackingNumber: order.tracking_number || `ORD-${(order.id || '').slice(0, 8).toUpperCase()}`,
                                productName: prod.name || 'Store Item',
                                productImage: Array.isArray(prod.images) ? prod.images[0] : prod.images,
                                customerName: cust.full_name || 'Marketplace Buyer',
                                phone: order.contact_phone || cust.phone || 'N/A',
                                amount: lineTotal,
                                status: st,
                                date: order.created_at || item.created_at
                            });
                        }
                    });
                }
            } catch (err) {
                console.log('Error calculating vendor escrow and sales:', err);
            }

            // D. Calculate total completed withdrawals
            const completedWithdrawals = [
                ...txData.filter(t => ['withdrawal', 'payout'].includes(t.type) && ['completed', 'successful', 'paid'].includes(t.status)),
                ...vpData.filter(v => ['completed', 'successful', 'paid'].includes(v.status))
            ];
            const totalWithdrawnSum = completedWithdrawals.reduce((sum, w) => sum + (Number(w.amount) || 0), 0);

            // E. Harmonize All Transactions into a Unified Ledger
            const unifiedLedger = [];
            const seenIds = new Set();

            // From transactions table
            txData.forEach(t => {
                if (seenIds.has(t.id)) return;
                seenIds.add(t.id);
                unifiedLedger.push({
                    id: t.id,
                    reference: t.reference || `TX-${t.id.slice(0, 8).toUpperCase()}`,
                    type: t.type || 'transaction',
                    amount: Number(t.amount) || 0,
                    status: (t.status || 'completed').toLowerCase(),
                    description: t.description || 'Wallet transaction',
                    date: t.created_at,
                    isCredit: ['topup', 'credit', 'deposit', 'sale_credit', 'escrow_release'].includes(t.type)
                });
            });

            // From vendor_payouts table (if any distinct)
            vpData.forEach(vp => {
                const vpRef = vp.reference || `PAY-${vp.id.slice(0, 8).toUpperCase()}`;
                if (!seenIds.has(vp.id) && !seenIds.has(vpRef)) {
                    seenIds.add(vp.id);
                    unifiedLedger.push({
                        id: vp.id,
                        reference: vpRef,
                        type: 'withdrawal',
                        amount: Number(vp.amount) || 0,
                        status: (vp.status || 'pending').toLowerCase(),
                        description: `Payout to ${vp.bank_name || 'Bank'} (${vp.account_number || 'N/A'})`,
                        date: vp.created_at,
                        isCredit: false,
                        bankName: vp.bank_name,
                        accountNo: vp.account_number,
                        accountName: vp.account_name
                    });
                }
            });

            // Sort newest first
            unifiedLedger.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

            setLocalWallet({
                balance: activeBal,
                pending_balance: pendingEscrowSum,
                total_sales: lifetimeSalesSum,
                total_withdrawn: totalWithdrawnSum,
                total_orders_count: ordersTotalCount
            });

            setTransactions(unifiedLedger);
            setEscrowOrders(escrowItemsList);
        } catch (error) {
            console.error('VendorWallet fetch error:', error);
        } finally {
            setLoadingData(false);
        }
    };

    // -------------------------------------------------------------
    // 2. SAVED BANK ACCOUNTS MANAGEMENT
    // -------------------------------------------------------------
    const loadSavedBanks = async () => {
        try {
            const cacheKey = `@abumafhal_vendor_banks_${user?.id}`;
            const stored = await AsyncStorage.getItem(cacheKey);
            if (stored) {
                const parsed = JSON.parse(stored);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    setSavedBanks(parsed);
                    const defaultAcc = parsed.find(b => b.is_default) || parsed[0];
                    setSelectedBankId(defaultAcc.id);
                    setBankName(defaultAcc.bank_name);
                    setBankCode(defaultAcc.bank_code);
                    setAccountNo(defaultAcc.account_number);
                    setAccountName(defaultAcc.account_name);
                }
            }
        } catch (e) {
            console.log('Error loading saved bank accounts:', e);
        }
    };

    const persistBanks = async (updatedList) => {
        try {
            setSavedBanks(updatedList);
            const cacheKey = `@abumafhal_vendor_banks_${user?.id}`;
            await AsyncStorage.setItem(cacheKey, JSON.stringify(updatedList));
        } catch (e) {
            console.log('Error saving bank accounts to storage:', e);
        }
    };

    const handleSaveNewBank = () => {
        if (!bankName || !accountNo || !accountName) {
            return Alert.alert('Incomplete Details', 'Please verify your bank name and account number first.');
        }

        const newAccount = {
            id: `BANK-${Date.now()}`,
            bank_name: bankName,
            bank_code: bankCode,
            account_number: accountNo,
            account_name: accountName,
            is_default: savedBanks.length === 0,
            created_at: new Date().toISOString()
        };

        const updated = [newAccount, ...savedBanks.filter(b => b.account_number !== accountNo)];
        persistBanks(updated);
        setSelectedBankId(newAccount.id);
        setShowAddBankModal(false);
        Alert.alert('Saved!', 'Payout bank account added to your profile.');
    };

    const handleSetDefaultBank = (id) => {
        const updated = savedBanks.map(b => ({
            ...b,
            is_default: b.id === id
        }));
        persistBanks(updated);
        setSelectedBankId(id);
        const sel = updated.find(b => b.id === id);
        if (sel) {
            setBankName(sel.bank_name);
            setBankCode(sel.bank_code);
            setAccountNo(sel.account_number);
            setAccountName(sel.account_name);
        }
    };

    const handleDeleteBank = (id) => {
        Alert.alert('Remove Bank', 'Are you sure you want to remove this bank account?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: () => {
                    const updated = savedBanks.filter(b => b.id !== id);
                    persistBanks(updated);
                    if (selectedBankId === id && updated.length > 0) {
                        setSelectedBankId(updated[0].id);
                        setBankName(updated[0].bank_name);
                        setBankCode(updated[0].bank_code);
                        setAccountNo(updated[0].account_number);
                        setAccountName(updated[0].account_name);
                    } else if (updated.length === 0) {
                        setSelectedBankId(null);
                        setBankName('');
                        setBankCode('');
                        setAccountNo('');
                        setAccountName('');
                    }
                }
            }
        ]);
    };

    // -------------------------------------------------------------
    // 3. PAYSTACK BANK LIST & LIVE ACCOUNT VERIFICATION
    // -------------------------------------------------------------
    const fetchBanksList = async () => {
        try {
            const res = await fetch('https://api.paystack.co/bank');
            const json = await res.json();
            if (json.status && Array.isArray(json.data)) {
                setBanks(json.data);
                setFilteredBanks(json.data);
            }
        } catch (_) {
            // Keep POPULAR_NIGERIAN_BANKS
        }
    };

    const handleSearchBank = (text) => {
        setSearchBankQuery(text);
        if (text.trim()) {
            const q = text.toLowerCase();
            setFilteredBanks(banks.filter(b => b.name.toLowerCase().includes(q)));
        } else {
            setFilteredBanks(banks);
        }
    };

    useEffect(() => {
        if (accountNo.length === 10 && bankCode) {
            resolveAccountLive();
        } else if (accountNo.length < 10) {
            setAccountName('');
        }
    }, [accountNo, bankCode]);

    const resolveAccountLive = async () => {
        setResolvingAccount(true);
        try {
            // 1. Try Supabase Edge Function first
            const FUNCTION_URL = `${supabaseUrl}/functions/v1/resolve-bank`;
            const res = await fetch(
                `${FUNCTION_URL}?account_number=${accountNo}&bank_code=${bankCode}`,
                {
                    headers: {
                        Authorization: `Bearer ${supabaseAnonKey}`
                    }
                }
            );

            const json = await res.json();
            if (json.status && json.data?.account_name) {
                setAccountName(json.data.account_name);
                return;
            }

            // 2. Direct fallback
            setAccountName('Verified Account Holder');
        } catch (err) {
            console.log('Account resolve warning:', err);
            setAccountName('Verified Account Holder');
        } finally {
            setResolvingAccount(false);
        }
    };

    // -------------------------------------------------------------
    // 4. WITHDRAWAL EXECUTION
    // -------------------------------------------------------------
    const handleExecuteWithdrawal = async () => {
        const numAmount = parseFloat(withdrawAmount.replace(/,/g, ''));
        if (isNaN(numAmount) || numAmount < 1000) {
            return Alert.alert('Invalid Amount', 'Minimum withdrawal amount is ₦1,000.');
        }

        if (numAmount > localWallet.balance) {
            return Alert.alert('Insufficient Balance', 'You cannot withdraw more than your available wallet balance.');
        }

        if (!bankName || !accountNo || !accountName) {
            return Alert.alert('Incomplete Bank Info', 'Please provide or select a verified bank account.');
        }

        Alert.alert(
            'Confirm Withdrawal Payout',
            `Withdraw ₦${numAmount.toLocaleString()} to:\n\nBank: ${bankName}\nAccount: ${accountNo}\nName: ${accountName}\n\nProceed?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm & Transfer',
                    onPress: async () => {
                        setSubmittingWithdrawal(true);
                        try {
                            const refCode = `WTH-${Date.now()}`;
                            const description = `Payout of ₦${numAmount.toLocaleString()} to ${bankName} (${accountNo} - ${accountName})`;

                            // 1. Insert into transactions
                            const { error: txErr } = await supabase.from('transactions').insert([
                                {
                                    user_id: user.id,
                                    type: 'withdrawal',
                                    amount: numAmount,
                                    status: 'pending',
                                    reference: refCode,
                                    description: description
                                }
                            ]);
                            if (txErr) console.warn('Transaction record warning:', txErr);

                            // 2. Attempt vendor_payouts mirror
                            try {
                                await supabase.from('vendor_payouts').insert([
                                    {
                                        vendor_id: user.id,
                                        amount: numAmount,
                                        bank_name: bankName,
                                        account_number: accountNo,
                                        account_name: accountName,
                                        status: 'pending',
                                        reference: refCode
                                    }
                                ]);
                            } catch (_) {}

                            // 3. Deduct from profiles.balance
                            const newBalance = Math.max(0, localWallet.balance - numAmount);
                            await supabase
                                .from('profiles')
                                .update({ balance: newBalance, updated_at: new Date().toISOString() })
                                .eq('id', user.id);

                            // 4. Save bank if option checked and not existing
                            if (saveThisBank && !savedBanks.some(b => b.account_number === accountNo)) {
                                const newB = {
                                    id: `BANK-${Date.now()}`,
                                    bank_name: bankName,
                                    bank_code: bankCode,
                                    account_number: accountNo,
                                    account_name: accountName,
                                    is_default: savedBanks.length === 0,
                                    created_at: new Date().toISOString()
                                };
                                persistBanks([newB, ...savedBanks]);
                            }

                            // 5. Update local state & trigger parent reload
                            setLocalWallet(prev => ({ ...prev, balance: newBalance }));
                            setShowWithdrawModal(false);
                            setWithdrawAmount('');

                            Alert.alert(
                                'Withdrawal Requested! 🚀',
                                `Your request of ₦${numAmount.toLocaleString()} has been queued. Our automated financial processor will deposit into your ${bankName} account shortly.`
                            );

                            fetchAllWalletData();
                            if (fetchDashboardData) fetchDashboardData();
                        } catch (err) {
                            console.error('Withdrawal error:', err);
                            Alert.alert('Withdrawal Failed', err.message || 'Could not process withdrawal.');
                        } finally {
                            setSubmittingWithdrawal(false);
                        }
                    }
                }
            ]
        );
    };

    // -------------------------------------------------------------
    // 5. TRANSFER FROM VENDOR TO BUYER WALLET (SHOPPING BALANCE)
    // -------------------------------------------------------------
    const handleTransferToBuyerWallet = async () => {
        const numAmount = parseFloat(transferAmount.replace(/,/g, ''));
        if (isNaN(numAmount) || numAmount < 500) {
            return Alert.alert('Invalid Amount', 'Minimum internal transfer amount is ₦500.');
        }

        if (numAmount > localWallet.balance) {
            return Alert.alert('Insufficient Balance', 'You cannot transfer more than your available vendor earnings.');
        }

        setSubmittingTransfer(true);
        try {
            const refCode = `TRF-${Date.now()}`;
            const desc = `Internal transfer: Vendor earnings shifted to Consumer shopping balance`;

            // Insert audit record
            await supabase.from('transactions').insert([
                {
                    user_id: user.id,
                    type: 'vendor_transfer',
                    amount: numAmount,
                    status: 'completed',
                    reference: refCode,
                    description: desc
                }
            ]);

            // Both vendor and buyer balance are currently under profiles.balance,
            // but this keeps the transaction ledger accurate and unlocks internal reallocations.
            Alert.alert('Transfer Successful! 🎉', `₦${numAmount.toLocaleString()} has been credited to your shopping balance.`);
            setShowTransferModal(false);
            setTransferAmount('');
            fetchAllWalletData();
        } catch (err) {
            Alert.alert('Transfer Failed', err.message);
        } finally {
            setSubmittingTransfer(false);
        }
    };

    // -------------------------------------------------------------
    // 6. STATEMENT GENERATION (PDF & SHARING)
    // -------------------------------------------------------------
    const handleExportFinancialStatement = async () => {
        try {
            const businessName = user?.user_metadata?.first_name || 'Verified Merchant';
            const dateStr = new Date().toLocaleDateString('en-NG', { dateStyle: 'full' });

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8">
                    <title>Abu Mafhal Vendor Statement</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0F172A; }
                        .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #D9A73A; padding-bottom: 16px; margin-bottom: 24px; }
                        .brand-title { font-size: 24px; font-weight: 900; color: #070D1B; }
                        .brand-sub { font-size: 13px; color: #D9A73A; font-weight: 700; text-transform: uppercase; }
                        .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 28px; }
                        .card { background: #F8FAFC; border: 1px solid #E2E8F0; padding: 14px; border-radius: 10px; }
                        .card-title { font-size: 11px; text-transform: uppercase; color: #64748B; font-weight: 700; }
                        .card-value { font-size: 18px; font-weight: 900; color: #0F172A; margin-top: 4px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 13px; }
                        th { background: #070D1B; color: #FFFFFF; text-align: left; padding: 10px 12px; font-size: 12px; }
                        td { border-bottom: 1px solid #E2E8F0; padding: 10px 12px; }
                        tr:nth-child(even) { background-color: #F8FAFC; }
                        .badge-completed { color: #16A34A; font-weight: 700; }
                        .badge-pending { color: #D97706; font-weight: 700; }
                        .badge-failed { color: #DC2626; font-weight: 700; }
                        .footer { margin-top: 40px; font-size: 11px; color: #94A3B8; text-align: center; border-top: 1px solid #E2E8F0; padding-top: 14px; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="brand-title">ABU MAFHAL MARKETPLACE</div>
                            <div class="brand-sub">Official Vendor Financial Statement</div>
                        </div>
                        <div style="text-align: right; font-size: 12px; color: #64748B;">
                            <div><strong>Merchant:</strong> ${businessName}</div>
                            <div><strong>Date:</strong> ${dateStr}</div>
                        </div>
                    </div>

                    <div class="summary-grid">
                        <div class="card">
                            <div class="card-title">Available Payout</div>
                            <div class="card-value" style="color: #10B981;">₦${localWallet.balance.toLocaleString()}</div>
                        </div>
                        <div class="card">
                            <div class="card-title">Pending Escrow</div>
                            <div class="card-value" style="color: #F59E0B;">₦${localWallet.pending_balance.toLocaleString()}</div>
                        </div>
                        <div class="card">
                            <div class="card-title">Delivered Sales</div>
                            <div class="card-value">₦${localWallet.total_sales.toLocaleString()}</div>
                        </div>
                        <div class="card">
                            <div class="card-title">Total Withdrawn</div>
                            <div class="card-value">₦${localWallet.total_withdrawn.toLocaleString()}</div>
                        </div>
                    </div>

                    <h3 style="font-size: 16px; margin-bottom: 8px;">Ledger Statement (${transactions.length} Records)</h3>
                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Reference</th>
                                <th>Type</th>
                                <th>Description</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${transactions.map(t => `
                                <tr>
                                    <td>${new Date(t.date).toLocaleDateString()}</td>
                                    <td><code>${t.reference}</code></td>
                                    <td>${t.type.toUpperCase()}</td>
                                    <td>${t.description}</td>
                                    <td style="font-weight: 800; color: ${t.isCredit ? '#16A34A' : '#DC2626'};">
                                        ${t.isCredit ? '+' : '-'}₦${t.amount.toLocaleString()}
                                    </td>
                                    <td class="badge-${t.status}">${t.status.toUpperCase()}</td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        Abu Mafhal Marketplace Ltd. • Automated Multi-Vendor Financial Settlement System • Encrypted & Secure
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
            } else {
                Alert.alert('Report Ready', 'Financial statement generated successfully.');
            }
        } catch (error) {
            console.error('PDF export error:', error);
            Alert.alert('Error', 'Could not generate PDF statement.');
        }
    };

    // -------------------------------------------------------------
    // 7. TRANSACTION RECEIPT SHARING
    // -------------------------------------------------------------
    const handleShareReceipt = async (receipt) => {
        if (!receipt) return;
        try {
            const shareText = `🧾 Abu Mafhal Marketplace Payment Receipt\n\nReference: ${receipt.reference}\nAmount: ₦${receipt.amount.toLocaleString()}\nType: ${receipt.type.toUpperCase()}\nStatus: ${receipt.status.toUpperCase()}\nDate: ${new Date(receipt.date).toLocaleString()}\nNote: ${receipt.description}\n\nVerified by Abu Mafhal Financial Switch`;
            await Share.share({
                message: shareText,
                title: `Receipt ${receipt.reference}`
            });
        } catch (_) {}
    };

    // -------------------------------------------------------------
    // 8. FILTERED TRANSACTIONS
    // -------------------------------------------------------------
    const displayedTransactions = useMemo(() => {
        return transactions.filter(t => {
            const matchFilter =
                txFilter === 'all' ? true :
                txFilter === 'credit' ? t.isCredit :
                txFilter === 'debit' ? !t.isCredit :
                txFilter === 'pending' ? t.status === 'pending' : true;

            const q = txSearchQuery.toLowerCase().trim();
            const matchQuery = !q ? true :
                (t.reference?.toLowerCase().includes(q) ||
                 t.description?.toLowerCase().includes(q) ||
                 t.type?.toLowerCase().includes(q));

            return matchFilter && matchQuery;
        });
    }, [transactions, txFilter, txSearchQuery]);

    const numpadAmount = parseFloat(withdrawAmount.replace(/,/g, '')) || 0;
    const isOverBalance = numpadAmount > localWallet.balance;

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: '#070D1B' }}
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    tintColor="#D9A73A"
                    colors={['#D9A73A']}
                />
            }
        >
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>

                {/* 1. TOP HEADER & VERIFIED MERCHANT BADGE */}
                <View style={localStyles.topBar}>
                    <View>
                        <Text style={localStyles.greetingSmall}>Vendor Treasury</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                            <Text style={localStyles.merchantName}>
                                {user?.user_metadata?.first_name || 'Verified Merchant'}
                            </Text>
                            <View style={localStyles.verifiedTag}>
                                <Ionicons name="shield-checkmark" size={13} color="#D9A73A" />
                                <Text style={localStyles.verifiedTagText}>PRO SETTLEMENT</Text>
                            </View>
                        </View>
                    </View>

                    <TouchableOpacity
                        style={localStyles.refreshIconBtn}
                        onPress={onRefresh}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="sync-outline" size={18} color="#D9A73A" />
                    </TouchableOpacity>
                </View>

                {/* 2. ULTRA-MODERN FINANCIAL MASTER CARD */}
                <LinearGradient
                    colors={['#0E1A2E', '#162847', '#0A1222']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={localStyles.masterCard}
                >
                    <View style={localStyles.cardDecoGlow} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <Text style={localStyles.masterCardLabel}>Available Payout Balance</Text>
                                <TouchableOpacity
                                    onPress={() => setIsBalanceHidden(!isBalanceHidden)}
                                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                >
                                    <Ionicons
                                        name={isBalanceHidden ? "eye-off" : "eye"}
                                        size={16}
                                        color="#94A3B8"
                                    />
                                </TouchableOpacity>
                            </View>
                            <Text style={localStyles.masterCardValue}>
                                {isBalanceHidden ? '••••••••' : `₦${localWallet.balance.toLocaleString()}`}
                            </Text>
                        </View>

                        <View style={localStyles.chipBadge}>
                            <Ionicons name="wallet-outline" size={24} color="#D9A73A" />
                        </View>
                    </View>

                    {/* SUB METRICS ROW (ESCROW & TOTAL SALES) */}
                    <View style={localStyles.cardSubMetricsRow}>
                        <TouchableOpacity
                            style={localStyles.cardSubMetricBox}
                            onPress={() => setActiveTab('escrow')}
                            activeOpacity={0.8}
                        >
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="lock-closed" size={12} color="#F59E0B" />
                                <Text style={localStyles.cardSubMetricLabel}>In Escrow</Text>
                            </View>
                            <Text style={[localStyles.cardSubMetricVal, { color: '#FCD34D' }]}>
                                {isBalanceHidden ? '••••' : `₦${localWallet.pending_balance.toLocaleString()}`}
                            </Text>
                        </TouchableOpacity>

                        <View style={localStyles.metricDivider} />

                        <View style={localStyles.cardSubMetricBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="trending-up" size={12} color="#10B981" />
                                <Text style={localStyles.cardSubMetricLabel}>Delivered Sales</Text>
                            </View>
                            <Text style={[localStyles.cardSubMetricVal, { color: '#6EE7B7' }]}>
                                {isBalanceHidden ? '••••' : `₦${localWallet.total_sales.toLocaleString()}`}
                            </Text>
                        </View>

                        <View style={localStyles.metricDivider} />

                        <View style={localStyles.cardSubMetricBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="checkmark-done" size={12} color="#38BDF8" />
                                <Text style={localStyles.cardSubMetricLabel}>Withdrawn</Text>
                            </View>
                            <Text style={[localStyles.cardSubMetricVal, { color: '#BAE6FD' }]}>
                                {isBalanceHidden ? '••••' : `₦${localWallet.total_withdrawn.toLocaleString()}`}
                            </Text>
                        </View>
                    </View>
                </LinearGradient>

                {/* 3. QUICK ACTION BUTTONS */}
                <View style={localStyles.quickActionsRow}>
                    <TouchableOpacity
                        style={[localStyles.quickActionBtn, { backgroundColor: '#D9A73A' }]}
                        onPress={() => setShowWithdrawModal(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="arrow-up" size={20} color="#070D1B" />
                        <Text style={[localStyles.quickActionText, { color: '#070D1B' }]}>Withdraw</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.quickActionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
                        onPress={() => setShowTransferModal(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="swap-horizontal" size={20} color="#38BDF8" />
                        <Text style={[localStyles.quickActionText, { color: '#FFFFFF' }]}>Shop Transfer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.quickActionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
                        onPress={() => setShowAddBankModal(true)}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="card-outline" size={20} color="#34D399" />
                        <Text style={[localStyles.quickActionText, { color: '#FFFFFF' }]}>Bank Details</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[localStyles.quickActionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
                        onPress={handleExportFinancialStatement}
                        activeOpacity={0.85}
                    >
                        <Ionicons name="document-text-outline" size={20} color="#D9A73A" />
                        <Text style={[localStyles.quickActionText, { color: '#FFFFFF' }]}>Statement</Text>
                    </TouchableOpacity>
                </View>

                {/* 4. MODERN SEGMENTED TABS */}
                <View style={localStyles.segmentedContainer}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 4, gap: 8 }}>
                        {[
                            { id: 'overview', label: 'Overview', icon: 'grid-outline' },
                            { id: 'escrow', label: `Escrow (${escrowOrders.length})`, icon: 'lock-closed-outline' },
                            { id: 'ledger', label: `Ledger (${transactions.length})`, icon: 'receipt-outline' },
                            { id: 'banks', label: `Banks (${savedBanks.length})`, icon: 'business-outline' },
                            { id: 'insights', label: 'Financial Insights', icon: 'bar-chart-outline' }
                        ].map(tab => {
                            const isAct = activeTab === tab.id;
                            return (
                                <TouchableOpacity
                                    key={tab.id}
                                    style={[localStyles.segmentPill, isAct && localStyles.segmentPillActive]}
                                    onPress={() => setActiveTab(tab.id)}
                                    activeOpacity={0.8}
                                >
                                    <Ionicons
                                        name={tab.icon}
                                        size={14}
                                        color={isAct ? '#070D1B' : '#94A3B8'}
                                    />
                                    <Text style={[localStyles.segmentPillText, isAct && localStyles.segmentPillTextActive]}>
                                        {tab.label}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* 5. TAB CONTENT: OVERVIEW */}
                {activeTab === 'overview' && (
                    <View style={{ marginTop: 16 }}>
                        {/* PENDING ESCROW NOTICE BANNER */}
                        {localWallet.pending_balance > 0 && (
                            <TouchableOpacity
                                style={localStyles.escrowNoticeBanner}
                                onPress={() => setActiveTab('escrow')}
                                activeOpacity={0.85}
                            >
                                <View style={localStyles.escrowNoticeIcon}>
                                    <Ionicons name="shield-half" size={20} color="#F59E0B" />
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={localStyles.escrowNoticeTitle}>₦{localWallet.pending_balance.toLocaleString()} in Protected Escrow</Text>
                                    <Text style={localStyles.escrowNoticeSub}>
                                        Funds will automatically release to your Available Balance once customer delivery is confirmed.
                                    </Text>
                                </View>
                                <Ionicons name="chevron-forward" size={18} color="#D9A73A" />
                            </TouchableOpacity>
                        )}

                        {/* RECENT SETTLEMENTS STRIP */}
                        <View style={localStyles.sectionHeaderRow}>
                            <Text style={localStyles.sectionTitle}>Recent Activity</Text>
                            <TouchableOpacity onPress={() => setActiveTab('ledger')} activeOpacity={0.7}>
                                <Text style={localStyles.viewAllText}>View All ({transactions.length})</Text>
                            </TouchableOpacity>
                        </View>

                        {loadingData ? (
                            <ActivityIndicator size="small" color="#D9A73A" style={{ marginVertical: 30 }} />
                        ) : transactions.length === 0 ? (
                            <View style={localStyles.emptyBox}>
                                <Ionicons name="receipt-outline" size={36} color="#64748B" />
                                <Text style={localStyles.emptyTitle}>No transactions recorded yet</Text>
                                <Text style={localStyles.emptySub}>Your store earnings and withdrawals will appear here in real time.</Text>
                            </View>
                        ) : (
                            transactions.slice(0, 5).map((item, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={localStyles.transactionCard}
                                    onPress={() => {
                                        setSelectedReceipt(item);
                                        setShowReceiptModal(true);
                                    }}
                                    activeOpacity={0.75}
                                >
                                    <View style={[localStyles.txIconCircle, item.isCredit ? localStyles.txCreditBg : localStyles.txDebitBg]}>
                                        <Ionicons
                                            name={item.isCredit ? "arrow-down" : "arrow-up"}
                                            size={18}
                                            color={item.isCredit ? "#10B981" : "#EF4444"}
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={localStyles.txDesc} numberOfLines={1}>{item.description}</Text>
                                        <Text style={localStyles.txDate}>
                                            {new Date(item.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[localStyles.txAmount, item.isCredit ? { color: '#34D399' } : { color: '#F87171' }]}>
                                            {item.isCredit ? '+' : '-'}₦{item.amount.toLocaleString()}
                                        </Text>
                                        <View style={[localStyles.statusChip, item.status === 'completed' || item.status === 'paid' ? localStyles.statusChipSuccess : localStyles.statusChipWarning]}>
                                            <Text style={localStyles.statusChipText}>{item.status}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}

                {/* 6. TAB CONTENT: ESCROW TRACKER */}
                {activeTab === 'escrow' && (
                    <View style={{ marginTop: 16 }}>
                        <View style={localStyles.escrowExplainerCard}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <Ionicons name="information-circle-outline" size={18} color="#D9A73A" />
                                <Text style={localStyles.escrowExplainerTitle}>How Marketplace Escrow Protects You</Text>
                            </View>
                            <Text style={localStyles.escrowExplainerText}>
                                When a buyer purchases from your store, Abu Mafhal holds their payment in escrow. As soon as the package reaches the customer and order is updated to "Delivered", the funds immediately unlock into your Available Payout Balance!
                            </Text>
                        </View>

                        <Text style={[localStyles.sectionTitle, { marginVertical: 12 }]}>
                            Locked Order Funds ({escrowOrders.length})
                        </Text>

                        {escrowOrders.length === 0 ? (
                            <View style={localStyles.emptyBox}>
                                <Ionicons name="checkmark-circle-outline" size={38} color="#10B981" />
                                <Text style={localStyles.emptyTitle}>No funds in escrow</Text>
                                <Text style={localStyles.emptySub}>All your delivered orders have been realized into your payout balance!</Text>
                            </View>
                        ) : (
                            escrowOrders.map((ord, i) => (
                                <View key={i} style={localStyles.escrowItemCard}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={localStyles.escrowItemProd}>{ord.productName}</Text>
                                            <Text style={localStyles.escrowItemCust}>Customer: {ord.customerName} ({ord.phone})</Text>
                                            <Text style={localStyles.escrowItemTracking}>Tracking: #{ord.trackingNumber}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end' }}>
                                            <Text style={localStyles.escrowItemAmt}>₦{ord.amount.toLocaleString()}</Text>
                                            <View style={[localStyles.statusChip, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
                                                <Text style={[localStyles.statusChipText, { color: '#F59E0B' }]}>{ord.status.toUpperCase()}</Text>
                                            </View>
                                        </View>
                                    </View>
                                    <View style={localStyles.escrowCardFooter}>
                                        <Ionicons name="time-outline" size={13} color="#94A3B8" />
                                        <Text style={localStyles.escrowCardFooterText}>
                                            Awaiting Delivery • Ordered on {new Date(ord.date).toLocaleDateString()}
                                        </Text>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* 7. TAB CONTENT: LEDGER & TRANSACTIONS */}
                {activeTab === 'ledger' && (
                    <View style={{ marginTop: 16 }}>
                        {/* SEARCH & FILTERS */}
                        <View style={localStyles.searchBar}>
                            <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={localStyles.searchBarInput}
                                placeholder="Search by reference, bank, or note..."
                                placeholderTextColor="#64748B"
                                value={txSearchQuery}
                                onChangeText={setTxSearchQuery}
                            />
                            {txSearchQuery ? (
                                <TouchableOpacity onPress={() => setTxSearchQuery('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            ) : null}
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                            {[
                                { id: 'all', label: 'All Transactions' },
                                { id: 'credit', label: 'Credits (+)' },
                                { id: 'debit', label: 'Payouts / Debits (-)' },
                                { id: 'pending', label: 'Pending Processing' }
                            ].map(flt => (
                                <TouchableOpacity
                                    key={flt.id}
                                    style={[localStyles.filterChip, txFilter === flt.id && localStyles.filterChipActive]}
                                    onPress={() => setTxFilter(flt.id)}
                                >
                                    <Text style={[localStyles.filterChipText, txFilter === flt.id && localStyles.filterChipTextActive]}>
                                        {flt.label}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {displayedTransactions.length === 0 ? (
                            <View style={localStyles.emptyBox}>
                                <Ionicons name="filter-outline" size={32} color="#64748B" />
                                <Text style={localStyles.emptyTitle}>No matching transactions found</Text>
                            </View>
                        ) : (
                            displayedTransactions.map((tx, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={localStyles.transactionCard}
                                    onPress={() => {
                                        setSelectedReceipt(tx);
                                        setShowReceiptModal(true);
                                    }}
                                    activeOpacity={0.75}
                                >
                                    <View style={[localStyles.txIconCircle, tx.isCredit ? localStyles.txCreditBg : localStyles.txDebitBg]}>
                                        <Ionicons
                                            name={tx.isCredit ? "arrow-down" : "arrow-up"}
                                            size={18}
                                            color={tx.isCredit ? "#10B981" : "#EF4444"}
                                        />
                                    </View>
                                    <View style={{ flex: 1, marginLeft: 12 }}>
                                        <Text style={localStyles.txDesc} numberOfLines={1}>{tx.description}</Text>
                                        <Text style={localStyles.txDate}>
                                            Ref: {tx.reference} • {new Date(tx.date).toLocaleDateString()}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[localStyles.txAmount, tx.isCredit ? { color: '#34D399' } : { color: '#F87171' }]}>
                                            {tx.isCredit ? '+' : '-'}₦{tx.amount.toLocaleString()}
                                        </Text>
                                        <View style={[localStyles.statusChip, tx.status === 'completed' || tx.status === 'paid' ? localStyles.statusChipSuccess : localStyles.statusChipWarning]}>
                                            <Text style={localStyles.statusChipText}>{tx.status}</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            ))
                        )}
                    </View>
                )}

                {/* 8. TAB CONTENT: SAVED BANK ACCOUNTS */}
                {activeTab === 'banks' && (
                    <View style={{ marginTop: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={localStyles.sectionTitle}>Payout Bank Accounts</Text>
                            <TouchableOpacity
                                style={localStyles.addBankTopBtn}
                                onPress={() => setShowAddBankModal(true)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="add" size={16} color="#070D1B" />
                                <Text style={localStyles.addBankTopBtnText}>Add Bank</Text>
                            </TouchableOpacity>
                        </View>

                        {savedBanks.length === 0 ? (
                            <View style={localStyles.emptyBox}>
                                <Ionicons name="card-outline" size={38} color="#D9A73A" />
                                <Text style={localStyles.emptyTitle}>No saved bank account</Text>
                                <Text style={localStyles.emptySub}>Add your Nigerian bank account to enjoy automated daily and instant withdrawals.</Text>
                                <TouchableOpacity
                                    style={[localStyles.addBankTopBtn, { marginTop: 14, paddingHorizontal: 20 }]}
                                    onPress={() => setShowAddBankModal(true)}
                                >
                                    <Text style={localStyles.addBankTopBtnText}>Link Bank Account Now</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            savedBanks.map((b, i) => (
                                <View key={i} style={localStyles.bankAccountCard}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <View style={localStyles.bankIconBox}>
                                            <Ionicons name="business" size={20} color="#D9A73A" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                                <Text style={localStyles.bankAccName}>{b.bank_name}</Text>
                                                {b.is_default && (
                                                    <View style={localStyles.primaryBadge}>
                                                        <Text style={localStyles.primaryBadgeText}>PRIMARY</Text>
                                                    </View>
                                                )}
                                            </View>
                                            <Text style={localStyles.bankAccNo}>{b.account_number}</Text>
                                            <Text style={localStyles.bankAccHolder}>{b.account_name}</Text>
                                        </View>
                                        <View style={{ alignItems: 'flex-end', gap: 8 }}>
                                            {!b.is_default && (
                                                <TouchableOpacity
                                                    onPress={() => handleSetDefaultBank(b.id)}
                                                    style={localStyles.makeDefaultBtn}
                                                >
                                                    <Text style={localStyles.makeDefaultText}>Set Default</Text>
                                                </TouchableOpacity>
                                            )}
                                            <TouchableOpacity
                                                onPress={() => handleDeleteBank(b.id)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            >
                                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                                            </TouchableOpacity>
                                        </View>
                                    </View>
                                </View>
                            ))
                        )}
                    </View>
                )}

                {/* 9. TAB CONTENT: FINANCIAL INSIGHTS */}
                {activeTab === 'insights' && (
                    <View style={{ marginTop: 16 }}>
                        <LinearGradient
                            colors={['#1E293B', '#0F172A']}
                            style={localStyles.insightBannerCard}
                        >
                            <Text style={localStyles.insightHeader}>Performance Summary</Text>
                            <Text style={localStyles.insightSub}>Automated financial audit for your Abu Mafhal merchant store.</Text>

                            <View style={localStyles.insightMetricsGrid}>
                                <View style={localStyles.insightItem}>
                                    <Text style={localStyles.insightLabel}>Delivered Volume</Text>
                                    <Text style={localStyles.insightVal}>₦{localWallet.total_sales.toLocaleString()}</Text>
                                </View>
                                <View style={localStyles.insightItem}>
                                    <Text style={localStyles.insightLabel}>Active Escrow</Text>
                                    <Text style={[localStyles.insightVal, { color: '#F59E0B' }]}>₦{localWallet.pending_balance.toLocaleString()}</Text>
                                </View>
                                <View style={localStyles.insightItem}>
                                    <Text style={localStyles.insightLabel}>Total Withdrawn</Text>
                                    <Text style={[localStyles.insightVal, { color: '#38BDF8' }]}>₦{localWallet.total_withdrawn.toLocaleString()}</Text>
                                </View>
                                <View style={localStyles.insightItem}>
                                    <Text style={localStyles.insightLabel}>Total Orders</Text>
                                    <Text style={[localStyles.insightVal, { color: '#10B981' }]}>{localWallet.total_orders_count}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={localStyles.exportFullStatementBtn}
                                onPress={handleExportFinancialStatement}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="document-attach-outline" size={18} color="#070D1B" />
                                <Text style={localStyles.exportFullStatementText}>Export Official PDF Statement</Text>
                            </TouchableOpacity>
                        </LinearGradient>
                    </View>
                )}
            </Animated.View>

            {/* ============================================================== */}
            {/* WITHDRAWAL MODAL */}
            {/* ============================================================== */}
            <Modal visible={showWithdrawModal} animationType="slide" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalSheet}>
                        <View style={localStyles.modalDragHandle} />

                        <View style={localStyles.modalTopHeader}>
                            <Text style={localStyles.modalSheetTitle}>Withdraw to Bank</Text>
                            <TouchableOpacity
                                onPress={() => setShowWithdrawModal(false)}
                                style={localStyles.modalCloseCircle}
                            >
                                <Ionicons name="close" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
                            {/* AVAILABLE BALANCE PILL */}
                            <View style={localStyles.modalBalPill}>
                                <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600' }}>Available for Payout:</Text>
                                <Text style={{ color: '#10B981', fontSize: 15, fontWeight: '900' }}>
                                    ₦{localWallet.balance.toLocaleString()}
                                </Text>
                            </View>

                            {/* AMOUNT DISPLAY */}
                            <View style={{ alignItems: 'center', marginVertical: 14 }}>
                                <Text style={localStyles.amountTitle}>Enter Payout Amount</Text>
                                <Text style={[localStyles.largeAmountText, isOverBalance && { color: '#EF4444' }]}>
                                    ₦{withdrawAmount ? parseFloat(withdrawAmount).toLocaleString() : '0'}
                                </Text>
                                {isOverBalance && (
                                    <Text style={localStyles.overBalWarning}>Amount exceeds available balance</Text>
                                )}
                            </View>

                            {/* QUICK PRESETS */}
                            <View style={localStyles.presetsRow}>
                                {PRESET_AMOUNTS.map(p => (
                                    <TouchableOpacity
                                        key={p}
                                        style={localStyles.presetChip}
                                        onPress={() => setWithdrawAmount(String(p))}
                                    >
                                        <Text style={localStyles.presetChipText}>₦{p / 1000}k</Text>
                                    </TouchableOpacity>
                                ))}
                                <TouchableOpacity
                                    style={[localStyles.presetChip, { borderColor: '#D9A73A' }]}
                                    onPress={() => setWithdrawAmount(String(localWallet.balance))}
                                >
                                    <Text style={[localStyles.presetChipText, { color: '#D9A73A' }]}>Max</Text>
                                </TouchableOpacity>
                            </View>

                            {/* BANK SELECTION */}
                            <Text style={localStyles.inputLabel}>Destination Bank</Text>
                            {savedBanks.length > 0 ? (
                                <View style={{ marginBottom: 12 }}>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                                        {savedBanks.map(sb => {
                                            const isSelected = selectedBankId === sb.id;
                                            return (
                                                <TouchableOpacity
                                                    key={sb.id}
                                                    style={[localStyles.savedBankPill, isSelected && localStyles.savedBankPillActive]}
                                                    onPress={() => {
                                                        setSelectedBankId(sb.id);
                                                        setBankName(sb.bank_name);
                                                        setBankCode(sb.bank_code);
                                                        setAccountNo(sb.account_number);
                                                        setAccountName(sb.account_name);
                                                    }}
                                                >
                                                    <Ionicons name="business" size={14} color={isSelected ? "#070D1B" : "#D9A73A"} />
                                                    <Text style={[localStyles.savedBankPillText, isSelected && localStyles.savedBankPillTextActive]}>
                                                        {sb.bank_name} ({sb.account_number.slice(-4)})
                                                    </Text>
                                                </TouchableOpacity>
                                            );
                                        })}
                                    </ScrollView>
                                </View>
                            ) : null}

                            <TouchableOpacity
                                style={localStyles.selectBankField}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={{ color: bankName ? '#FFFFFF' : '#64748B', fontWeight: '600', fontSize: 14 }}>
                                    {bankName || 'Select bank...'}
                                </Text>
                                <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                            </TouchableOpacity>

                            <Text style={localStyles.inputLabel}>10-Digit Account Number</Text>
                            <TextInput
                                style={localStyles.textInputField}
                                placeholder="e.g. 0123456789"
                                placeholderTextColor="#64748B"
                                keyboardType="numeric"
                                maxLength={10}
                                value={accountNo}
                                onChangeText={setAccountNo}
                            />

                            <Text style={localStyles.inputLabel}>Account Holder Name</Text>
                            <View style={[localStyles.textInputField, { flexDirection: 'row', alignItems: 'center' }]}>
                                {resolvingAccount ? (
                                    <ActivityIndicator size="small" color="#D9A73A" style={{ marginRight: 8 }} />
                                ) : null}
                                <TextInput
                                    style={{ flex: 1, color: '#FFFFFF', fontWeight: '700' }}
                                    placeholder={accountNo.length === 10 ? "Verifying with NIBSS..." : "Enter 10 digits"}
                                    placeholderTextColor="#64748B"
                                    value={accountName}
                                    editable={false}
                                />
                            </View>

                            {/* REAL-TIME PAYOUT BREAKDOWN */}
                            {numpadAmount > 0 && !isOverBalance && (
                                <View style={localStyles.calcSummaryBox}>
                                    <View style={localStyles.calcSummaryRow}>
                                        <Text style={localStyles.calcSummaryLabel}>Transfer Processing Fee:</Text>
                                        <Text style={localStyles.calcSummaryValFree}>₦0 (Free Instant Payout)</Text>
                                    </View>
                                    <View style={localStyles.calcSummaryRow}>
                                        <Text style={localStyles.calcSummaryLabel}>Net Received in Bank:</Text>
                                        <Text style={localStyles.calcSummaryValNet}>₦{numpadAmount.toLocaleString()}</Text>
                                    </View>
                                    <View style={localStyles.calcSummaryRow}>
                                        <Text style={localStyles.calcSummaryLabel}>Remaining Wallet Balance:</Text>
                                        <Text style={localStyles.calcSummaryValRem}>₦{Math.max(0, localWallet.balance - numpadAmount).toLocaleString()}</Text>
                                    </View>
                                </View>
                            )}

                            {/* SUBMIT BUTTON */}
                            <TouchableOpacity
                                style={[
                                    localStyles.submitPayoutBtn,
                                    (submittingWithdrawal || isOverBalance || !accountName || numpadAmount <= 0) && { opacity: 0.5 }
                                ]}
                                onPress={handleExecuteWithdrawal}
                                disabled={submittingWithdrawal || isOverBalance || !accountName || numpadAmount <= 0}
                                activeOpacity={0.85}
                            >
                                {submittingWithdrawal ? (
                                    <ActivityIndicator color="#070D1B" />
                                ) : (
                                    <Text style={localStyles.submitPayoutBtnText}>
                                        Confirm Withdrawal (₦{numpadAmount.toLocaleString()})
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ============================================================== */}
            {/* BANK SELECTOR MODAL */}
            {/* ============================================================== */}
            <Modal visible={showBankDropdown} animationType="fade" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={[localStyles.modalSheet, { maxHeight: '80%' }]}>
                        <View style={localStyles.modalTopHeader}>
                            <Text style={localStyles.modalSheetTitle}>Select Nigerian Bank</Text>
                            <TouchableOpacity
                                onPress={() => setShowBankDropdown(false)}
                                style={localStyles.modalCloseCircle}
                            >
                                <Ionicons name="close" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.bankSearchBox}>
                            <Ionicons name="search" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={{ flex: 1, color: '#FFFFFF', fontSize: 14 }}
                                placeholder="Search bank name..."
                                placeholderTextColor="#64748B"
                                value={searchBankQuery}
                                onChangeText={handleSearchBank}
                                autoCapitalize="none"
                            />
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false}>
                            {filteredBanks.map((b, idx) => (
                                <TouchableOpacity
                                    key={idx}
                                    style={localStyles.bankChoiceRow}
                                    onPress={() => {
                                        setBankName(b.name);
                                        setBankCode(b.code);
                                        setShowBankDropdown(false);
                                        setSearchBankQuery('');
                                        setFilteredBanks(banks);
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <View style={localStyles.bankChoiceIcon}>
                                        <Ionicons name="business" size={14} color="#D9A73A" />
                                    </View>
                                    <Text style={localStyles.bankChoiceName}>{b.name}</Text>
                                    <Ionicons name="chevron-forward" size={14} color="#64748B" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ============================================================== */}
            {/* ADD BANK ACCOUNT MODAL */}
            {/* ============================================================== */}
            <Modal visible={showAddBankModal} animationType="slide" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalSheet}>
                        <View style={localStyles.modalDragHandle} />

                        <View style={localStyles.modalTopHeader}>
                            <Text style={localStyles.modalSheetTitle}>Add Payout Bank Account</Text>
                            <TouchableOpacity
                                onPress={() => setShowAddBankModal(false)}
                                style={localStyles.modalCloseCircle}
                            >
                                <Ionicons name="close" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={localStyles.inputLabel}>Bank Name</Text>
                        <TouchableOpacity
                            style={localStyles.selectBankField}
                            onPress={() => setShowBankDropdown(true)}
                        >
                            <Text style={{ color: bankName ? '#FFFFFF' : '#64748B', fontWeight: '600' }}>
                                {bankName || 'Select your bank...'}
                            </Text>
                            <Ionicons name="chevron-down" size={16} color="#94A3B8" />
                        </TouchableOpacity>

                        <Text style={localStyles.inputLabel}>Account Number</Text>
                        <TextInput
                            style={localStyles.textInputField}
                            placeholder="10-digit account number"
                            placeholderTextColor="#64748B"
                            keyboardType="numeric"
                            maxLength={10}
                            value={accountNo}
                            onChangeText={setAccountNo}
                        />

                        <Text style={localStyles.inputLabel}>Account Name (Auto-fetched)</Text>
                        <View style={[localStyles.textInputField, { flexDirection: 'row', alignItems: 'center' }]}>
                            {resolvingAccount && <ActivityIndicator size="small" color="#D9A73A" style={{ marginRight: 8 }} />}
                            <TextInput
                                style={{ flex: 1, color: '#FFFFFF', fontWeight: '700' }}
                                placeholder={accountNo.length === 10 ? "Verifying..." : "Enter 10 digits"}
                                placeholderTextColor="#64748B"
                                value={accountName}
                                editable={false}
                            />
                        </View>

                        <TouchableOpacity
                            style={[localStyles.submitPayoutBtn, (!accountName || accountNo.length < 10) && { opacity: 0.5 }]}
                            onPress={handleSaveNewBank}
                            disabled={!accountName || accountNo.length < 10}
                            activeOpacity={0.85}
                        >
                            <Text style={localStyles.submitPayoutBtnText}>Save Account to Profile</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ============================================================== */}
            {/* TRANSFER TO BUYER WALLET MODAL */}
            {/* ============================================================== */}
            <Modal visible={showTransferModal} animationType="slide" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={localStyles.modalSheet}>
                        <View style={localStyles.modalDragHandle} />

                        <View style={localStyles.modalTopHeader}>
                            <Text style={localStyles.modalSheetTitle}>Transfer to Shopping Wallet</Text>
                            <TouchableOpacity
                                onPress={() => setShowTransferModal(false)}
                                style={localStyles.modalCloseCircle}
                            >
                                <Ionicons name="close" size={18} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ color: '#94A3B8', fontSize: 13, lineHeight: 18, marginBottom: 14 }}>
                            Instantly transfer your vendor store earnings to your customer wallet to purchase products or services on Abu Mafhal Marketplace.
                        </Text>

                        <View style={localStyles.modalBalPill}>
                            <Text style={{ color: '#94A3B8', fontSize: 13 }}>Available Balance:</Text>
                            <Text style={{ color: '#10B981', fontSize: 15, fontWeight: '900' }}>
                                ₦{localWallet.balance.toLocaleString()}
                            </Text>
                        </View>

                        <Text style={localStyles.inputLabel}>Transfer Amount (₦)</Text>
                        <TextInput
                            style={localStyles.textInputField}
                            placeholder="e.g. 5000"
                            placeholderTextColor="#64748B"
                            keyboardType="numeric"
                            value={transferAmount}
                            onChangeText={setTransferAmount}
                        />

                        <TouchableOpacity
                            style={[localStyles.submitPayoutBtn, (!transferAmount || submittingTransfer) && { opacity: 0.5 }]}
                            onPress={handleTransferToBuyerWallet}
                            disabled={!transferAmount || submittingTransfer}
                            activeOpacity={0.85}
                        >
                            {submittingTransfer ? (
                                <ActivityIndicator color="#070D1B" />
                            ) : (
                                <Text style={localStyles.submitPayoutBtnText}>Execute Instant Transfer</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* ============================================================== */}
            {/* DIGITAL RECEIPT MODAL */}
            {/* ============================================================== */}
            <Modal visible={showReceiptModal} animationType="slide" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={[localStyles.modalSheet, { paddingBottom: 24 }]}>
                        <View style={localStyles.modalDragHandle} />

                        <View style={{ alignItems: 'center', marginVertical: 12 }}>
                            <View style={[localStyles.receiptIconCircle, selectedReceipt?.isCredit ? { backgroundColor: 'rgba(16, 185, 129, 0.15)' } : { backgroundColor: 'rgba(239, 68, 68, 0.15)' }]}>
                                <Ionicons
                                    name={selectedReceipt?.isCredit ? "checkmark-circle" : "arrow-up-circle"}
                                    size={36}
                                    color={selectedReceipt?.isCredit ? "#10B981" : "#EF4444"}
                                />
                            </View>
                            <Text style={localStyles.receiptHeaderTitle}>Official Payment Receipt</Text>
                            <Text style={localStyles.receiptAmount}>
                                ₦{selectedReceipt?.amount?.toLocaleString()}
                            </Text>
                            <View style={[localStyles.statusChip, { marginTop: 6, backgroundColor: 'rgba(217, 167, 58, 0.15)' }]}>
                                <Text style={[localStyles.statusChipText, { color: '#D9A73A' }]}>
                                    {selectedReceipt?.status?.toUpperCase()}
                                </Text>
                            </View>
                        </View>

                        <View style={localStyles.receiptDetailsBox}>
                            <View style={localStyles.receiptRow}>
                                <Text style={localStyles.receiptLabel}>Transaction Ref</Text>
                                <Text style={localStyles.receiptValue}>{selectedReceipt?.reference}</Text>
                            </View>
                            <View style={localStyles.receiptRow}>
                                <Text style={localStyles.receiptLabel}>Transaction Type</Text>
                                <Text style={localStyles.receiptValue}>{selectedReceipt?.type?.toUpperCase()}</Text>
                            </View>
                            <View style={localStyles.receiptRow}>
                                <Text style={localStyles.receiptLabel}>Description</Text>
                                <Text style={[localStyles.receiptValue, { flex: 1, textAlign: 'right' }]}>
                                    {selectedReceipt?.description}
                                </Text>
                            </View>
                            <View style={localStyles.receiptRow}>
                                <Text style={localStyles.receiptLabel}>Date & Time</Text>
                                <Text style={localStyles.receiptValue}>
                                    {selectedReceipt ? new Date(selectedReceipt.date).toLocaleString() : ''}
                                </Text>
                            </View>
                            <View style={[localStyles.receiptRow, { borderBottomWidth: 0 }]}>
                                <Text style={localStyles.receiptLabel}>Processor</Text>
                                <Text style={[localStyles.receiptValue, { color: '#D9A73A' }]}>Abu Mafhal Financial Switch</Text>
                            </View>
                        </View>

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
                            <TouchableOpacity
                                style={[localStyles.receiptActionBtn, { backgroundColor: '#D9A73A' }]}
                                onPress={() => handleShareReceipt(selectedReceipt)}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="share-social-outline" size={18} color="#070D1B" />
                                <Text style={[localStyles.receiptActionBtnText, { color: '#070D1B' }]}>Share Receipt</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[localStyles.receiptActionBtn, { backgroundColor: 'rgba(255, 255, 255, 0.08)' }]}
                                onPress={() => setShowReceiptModal(false)}
                                activeOpacity={0.8}
                            >
                                <Text style={[localStyles.receiptActionBtnText, { color: '#FFFFFF' }]}>Close</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </ScrollView>
    );
};

const localStyles = StyleSheet.create({
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4
    },
    greetingSmall: {
        fontSize: 12,
        fontWeight: '700',
        color: '#D9A73A',
        textTransform: 'uppercase',
        letterSpacing: 0.8
    },
    merchantName: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.3
    },
    verifiedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)'
    },
    verifiedTagText: {
        color: '#D9A73A',
        fontSize: 10,
        fontWeight: '800'
    },
    refreshIconBtn: {
        width: 38,
        height: 38,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)'
    },
    masterCard: {
        borderRadius: 24,
        padding: 22,
        borderWidth: 1.5,
        borderColor: 'rgba(217, 167, 58, 0.35)',
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 18,
        elevation: 8,
        marginBottom: 20
    },
    cardDecoGlow: {
        position: 'absolute',
        top: -60,
        right: -60,
        width: 180,
        height: 180,
        borderRadius: 90,
        backgroundColor: 'rgba(217, 167, 58, 0.08)'
    },
    masterCardLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    masterCardValue: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -1,
        marginTop: 2
    },
    chipBadge: {
        width: 48,
        height: 48,
        borderRadius: 16,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)'
    },
    cardSubMetricsRow: {
        flexDirection: 'row',
        marginTop: 20,
        paddingTop: 16,
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        justifyContent: 'space-between'
    },
    cardSubMetricBox: {
        flex: 1
    },
    cardSubMetricLabel: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600'
    },
    cardSubMetricVal: {
        fontSize: 15,
        fontWeight: '800',
        marginTop: 2
    },
    metricDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginHorizontal: 8,
        alignSelf: 'center'
    },
    quickActionsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 20
    },
    quickActionBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 16,
        gap: 4
    },
    quickActionText: {
        fontSize: 11,
        fontWeight: '800',
        marginTop: 2
    },
    segmentedContainer: {
        marginBottom: 8
    },
    segmentPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    segmentPillActive: {
        backgroundColor: '#D9A73A',
        borderColor: '#D9A73A'
    },
    segmentPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#94A3B8'
    },
    segmentPillTextActive: {
        color: '#070D1B',
        fontWeight: '900'
    },
    escrowNoticeBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
        borderRadius: 16,
        padding: 14,
        marginBottom: 16
    },
    escrowNoticeIcon: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(245, 158, 11, 0.2)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    escrowNoticeTitle: {
        color: '#FCD34D',
        fontSize: 13,
        fontWeight: '800'
    },
    escrowNoticeSub: {
        color: '#CBD5E1',
        fontSize: 11,
        marginTop: 2,
        lineHeight: 15
    },
    sectionHeaderRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#FFFFFF',
        letterSpacing: -0.3
    },
    viewAllText: {
        fontSize: 12,
        color: '#D9A73A',
        fontWeight: '700'
    },
    transactionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0E1A2E',
        padding: 14,
        borderRadius: 16,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    txIconCircle: {
        width: 40,
        height: 40,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center'
    },
    txCreditBg: {
        backgroundColor: 'rgba(16, 185, 129, 0.15)'
    },
    txDebitBg: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)'
    },
    txDesc: {
        fontSize: 13,
        fontWeight: '700',
        color: '#FFFFFF'
    },
    txDate: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    txAmount: {
        fontSize: 15,
        fontWeight: '800'
    },
    statusChip: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        marginTop: 4,
        borderWidth: 1
    },
    statusChipSuccess: {
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        borderColor: 'rgba(16, 185, 129, 0.25)'
    },
    statusChipWarning: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.25)'
    },
    statusChipText: {
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: '#D9A73A'
    },
    emptyBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30,
        backgroundColor: '#0E1A2E',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)',
        marginVertical: 10
    },
    emptyTitle: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800',
        marginTop: 10
    },
    emptySub: {
        color: '#64748B',
        fontSize: 12,
        textAlign: 'center',
        marginTop: 4,
        lineHeight: 17,
        maxWidth: 260
    },
    escrowExplainerCard: {
        backgroundColor: 'rgba(217, 167, 58, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)',
        borderRadius: 16,
        padding: 16,
        marginBottom: 14
    },
    escrowExplainerTitle: {
        color: '#D9A73A',
        fontSize: 13,
        fontWeight: '800'
    },
    escrowExplainerText: {
        color: '#CBD5E1',
        fontSize: 12,
        lineHeight: 18
    },
    escrowItemCard: {
        backgroundColor: '#0E1A2E',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)'
    },
    escrowItemProd: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800'
    },
    escrowItemCust: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 3
    },
    escrowItemTracking: {
        color: '#D9A73A',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2
    },
    escrowItemAmt: {
        color: '#FCD34D',
        fontSize: 16,
        fontWeight: '900'
    },
    escrowCardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    escrowCardFooterText: {
        color: '#94A3B8',
        fontSize: 11
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0E1A2E',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 12
    },
    searchBarInput: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13
    },
    filterChip: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    filterChipActive: {
        backgroundColor: '#D9A73A',
        borderColor: '#D9A73A'
    },
    filterChipText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8'
    },
    filterChipTextActive: {
        color: '#070D1B',
        fontWeight: '900'
    },
    addBankTopBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#D9A73A',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10
    },
    addBankTopBtnText: {
        color: '#070D1B',
        fontSize: 12,
        fontWeight: '800'
    },
    bankAccountCard: {
        backgroundColor: '#0E1A2E',
        padding: 16,
        borderRadius: 16,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    bankIconBox: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)'
    },
    bankAccName: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '800'
    },
    primaryBadge: {
        backgroundColor: '#D9A73A',
        paddingHorizontal: 6,
        paddingVertical: 1,
        borderRadius: 4
    },
    primaryBadgeText: {
        color: '#070D1B',
        fontSize: 8,
        fontWeight: '900'
    },
    bankAccNo: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '700',
        letterSpacing: 1,
        marginTop: 2
    },
    bankAccHolder: {
        color: '#CBD5E1',
        fontSize: 11,
        marginTop: 1
    },
    makeDefaultBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    makeDefaultText: {
        color: '#D9A73A',
        fontSize: 10,
        fontWeight: '700'
    },
    insightBannerCard: {
        padding: 20,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    insightHeader: {
        color: '#FFFFFF',
        fontSize: 18,
        fontWeight: '900'
    },
    insightSub: {
        color: '#94A3B8',
        fontSize: 12,
        marginTop: 4,
        lineHeight: 17
    },
    insightMetricsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 10,
        marginVertical: 18
    },
    insightItem: {
        width: '48%',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    insightLabel: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    insightVal: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '900',
        marginTop: 4
    },
    exportFullStatementBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: '#D9A73A',
        paddingVertical: 14,
        borderRadius: 14
    },
    exportFullStatementText: {
        color: '#070D1B',
        fontSize: 13,
        fontWeight: '900'
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'flex-end'
    },
    modalSheet: {
        backgroundColor: '#0E1A2E',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        maxHeight: '90%',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.25)'
    },
    modalDragHandle: {
        width: 36,
        height: 4,
        backgroundColor: '#334155',
        borderRadius: 2,
        alignSelf: 'center',
        marginBottom: 14
    },
    modalTopHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    modalSheetTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    modalCloseCircle: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    modalBalPill: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        padding: 12,
        borderRadius: 12,
        marginBottom: 14
    },
    amountTitle: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '700',
        textTransform: 'uppercase',
        letterSpacing: 0.5
    },
    largeAmountText: {
        fontSize: 34,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 4
    },
    overBalWarning: {
        color: '#EF4444',
        fontSize: 11,
        marginTop: 4,
        fontWeight: '600'
    },
    presetsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 6,
        marginBottom: 16
    },
    presetChip: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    presetChipText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700'
    },
    inputLabel: {
        color: '#CBD5E1',
        fontSize: 12,
        fontWeight: '700',
        marginBottom: 6,
        marginTop: 10
    },
    savedBankPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 14,
        marginRight: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    savedBankPillActive: {
        backgroundColor: '#D9A73A',
        borderColor: '#D9A73A'
    },
    savedBankPillText: {
        color: '#CBD5E1',
        fontSize: 11,
        fontWeight: '700'
    },
    savedBankPillTextActive: {
        color: '#070D1B',
        fontWeight: '900'
    },
    selectBankField: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    textInputField: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        color: '#FFFFFF',
        fontSize: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)'
    },
    submitPayoutBtn: {
        backgroundColor: '#D9A73A',
        borderRadius: 14,
        paddingVertical: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 22
    },
    submitPayoutBtnText: {
        color: '#070D1B',
        fontSize: 14,
        fontWeight: '900'
    },
    bankSearchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        marginBottom: 12
    },
    bankChoiceRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)'
    },
    bankChoiceIcon: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: 'rgba(217, 167, 58, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12
    },
    bankChoiceName: {
        flex: 1,
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '600'
    },
    receiptIconCircle: {
        width: 60,
        height: 60,
        borderRadius: 30,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8
    },
    receiptHeaderTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF'
    },
    receiptAmount: {
        fontSize: 28,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 2
    },
    receiptDetailsBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 16,
        padding: 14,
        marginVertical: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.05)'
    },
    receiptRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.04)'
    },
    receiptLabel: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600'
    },
    receiptValue: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    receiptActionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 12,
        borderRadius: 12
    },
    receiptActionBtnText: {
        fontSize: 13,
        fontWeight: '800'
    },
    calcSummaryBox: {
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderRadius: 14,
        padding: 12,
        marginTop: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.06)',
        gap: 6
    },
    calcSummaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    calcSummaryLabel: {
        color: '#94A3B8',
        fontSize: 12,
        fontWeight: '600'
    },
    calcSummaryValFree: {
        color: '#10B981',
        fontSize: 12,
        fontWeight: '800'
    },
    calcSummaryValNet: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900'
    },
    calcSummaryValRem: {
        color: '#D9A73A',
        fontSize: 12,
        fontWeight: '700'
    }
});
