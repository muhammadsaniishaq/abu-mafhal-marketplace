import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, TouchableOpacity, ScrollView, Modal, TextInput, Alert, StyleSheet, ActivityIndicator, RefreshControl, Animated, Easing } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { styles } from '../styles/theme';
import { supabase, supabaseUrl, supabaseAnonKey } from '../lib/supabase';

export const VendorWallet = ({ user, wallet, fetchDashboardData }) => {
    const navigation = useNavigation();

    // Own wallet state — always fetched fresh from DB
    const [localWallet, setLocalWallet] = useState(wallet || {});

    const fetchWalletDirect = async () => {
        try {
            // 1. Get wallet row
            const { data: walletData, error: walletErr } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
            // 2. Get vendor orders to calculate pending amount (non‑delivered, non‑cancelled)
            const { data: ordersData, error: ordersErr } = await supabase.rpc('get_vendor_dashboard_orders', { p_vendor_id: user.id });
            let pendingSum = 0;
            if (ordersData) {
                ordersData.forEach(o => {
                    const status = (o.status || '').toLowerCase();
                    if (!['delivered', 'cancelled', 'refunded'].includes(status)) {
                        pendingSum += Number(o.amount) || 0;
                    }
                });
            }
            if (walletErr) console.log('Wallet fetch error:', walletErr.message);
            if (ordersErr) console.log('Orders fetch error for pending:', ordersErr.message);
            const merged = {
                balance: 0,
                ...(walletData || {}),
                pending_balance: pendingSum,
            };
            setLocalWallet(merged);
        } catch (e) {
            console.log('Wallet/Orders fetch error:', e);
        }
    };

    const [showWithdrawModal, setShowWithdrawModal] = useState(false);
    const [amount, setAmount] = useState('');
    const [bankName, setBankName] = useState('');
    const [bankCode, setBankCode] = useState('');
    const [accountNo, setAccountNo] = useState('');
    const [accountName, setAccountName] = useState('');

    const [banks, setBanks] = useState([]);
    const [filteredBanks, setFilteredBanks] = useState([]);
    const [showBankDropdown, setShowBankDropdown] = useState(false);
    const [searchBankQuery, setSearchBankQuery] = useState('');
    const [resolvingAccount, setResolvingAccount] = useState(false);

    const [loading, setLoading] = useState(false);
    const [withdrawals, setWithdrawals] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [filter, setFilter] = useState('All'); // 'All', 'pending', 'completed', 'rejected'
    const [isBalanceHidden, setIsBalanceHidden] = useState(false);

    const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);

    // Animations
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(20)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 500,
                easing: Easing.out(Easing.ease),
                useNativeDriver: true,
            })
        ]).start();

        fetchWithdrawalHistory();
        fetchBanks();
        fetchWalletDirect(); // Always load fresh balance from DB
    }, []);

    // Refresh wallet when screen gains focus (e.g., after admin updates order)
    useFocusEffect(
        React.useCallback(() => {
            fetchWalletDirect();
        }, [])
    );

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchWalletDirect();
        if (fetchDashboardData) await fetchDashboardData();
        await fetchWithdrawalHistory();
        setRefreshing(false);
    }, [fetchDashboardData]);

    const fetchBanks = async () => {
        try {
            const res = await fetch('https://api.paystack.co/bank');
            const json = await res.json();
            if (json.status) {
                setBanks(json.data);
                setFilteredBanks(json.data);
            }
        } catch (error) {
            console.log('Error fetching banks:', error);
        }
    };

    useEffect(() => {
        if (accountNo.length === 10 && bankCode) {
            resolveAccount();
        } else {
            setAccountName('');
        }
    }, [accountNo, bankCode]);

    const resolveAccount = async () => {
        setResolvingAccount(true);
        try {
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

            if (json.status) {
                setAccountName(json.data.account_name);
            } else {
                setAccountName('');
                Alert.alert('Verification Failed', json.message || 'Could not verify account.');
            }
        } catch (error) {
            console.log('Error resolving account:', error);
            Alert.alert('Error', 'Failed to verify account details.');
        } finally {
            setResolvingAccount(false);
        }
    };

    const handleDebugCredit = async () => {
        try {
            setLoading(true);
            const { data: vendorData, error: sessionErr } = await supabase.auth.getUser();
            if (sessionErr || !vendorData?.user) throw new Error('Not logged in');

            const { data: dOrders, error: oErr } = await supabase.rpc('get_vendor_dashboard_orders', { p_vendor_id: vendorData.user.id });

            // Find the first delivered order
            const dOrder = dOrders?.find(o => (o.status || '').toLowerCase() === 'delivered');

            if (oErr || !dOrder) {
                Alert.alert('No Delivered Orders', 'Could not find any delivered order for your products to test.');
                return;
            }
            const orderId = dOrder.id;
            const { data, error } = await supabase.rpc('debug_credit_vendors_on_delivery', { p_order_id: orderId });
            if (error) {
                Alert.alert('RPC FAILED', error.message + '\n\nOrder: ' + orderId);
                console.log('RPC FAILED:', error);
            } else {
                const logStr = data?.logs ? JSON.stringify(data.logs, null, 2) : 'No logs generated';
                console.log('TRACE LOGS:', logStr);
                Alert.alert('TRACE COMPLETE', logStr);
                await fetchWalletDirect();
                if (typeof fetchDashboardData === 'function') await fetchDashboardData();
            }
        } catch (e) {
            Alert.alert('CRASH', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSearchBank = (text) => {
        setSearchBankQuery(text);
        if (text) {
            setFilteredBanks(banks.filter(b => b.name.toLowerCase().includes(text.toLowerCase())));
        } else {
            setFilteredBanks(banks);
        }
    };

    const fetchWithdrawalHistory = async () => {
        setLoadingHistory(true);
        try {
            const { data, error } = await supabase
                .from('vendor_payouts')
                .select('*')
                .eq('vendor_id', user.id)
                .order('created_at', { ascending: false });
            if (data) setWithdrawals(data);
        } catch (err) {
            console.log('Error fetching withdrawals:', err);
        } finally {
            setLoadingHistory(false);
        }
    };

    const handleExportHistory = async () => {
        if (withdrawals.length === 0) return Alert.alert('Notice', 'No withdrawals to export.');

        try {
            const htmlContent = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica', sans-serif; padding: 20px; }
                            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
                            th, td { border: 1px solid #E2E8F0; padding: 12px; text-align: left; }
                            th { background-color: #F8FAFC; color: #475569; }
                            .paid { color: #16A34A; } .pending { color: #D97706; } .rejected { color: #EF4444; }
                        </style>
                    </head>
                    <body>
                        <h2>Withdrawal History Report</h2>
                        <p>Generated on: ${new Date().toLocaleString()}</p>
                        <table>
                            <tr><th>Date</th><th>Amount (N)</th><th>Bank</th><th>Account No</th><th>Status</th></tr>
                            ${withdrawals.map(w => `
                                <tr>
                                    <td>${new Date(w.created_at).toLocaleDateString()}</td>
                                    <td>${w.amount}</td>
                                    <td>${w.bank_name || 'N/A'}</td>
                                    <td>${w.account_number || 'N/A'}</td>
                                    <td class="${w.status}">${w.status.toUpperCase()}</td>
                                </tr>
                            `).join('')}
                        </table>
                    </body>
                </html>
            `;
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert('Error', 'Failed to generate report.');
            console.log(error);
        }
    };

    const handleWithdraw = async () => {
        const reqAmount = parseFloat(amount.replace(/,/g, ''));
        if (isNaN(reqAmount) || reqAmount <= 0) {
            return Alert.alert('Invalid Amount', 'Please enter a valid amount.');
        }
        if (reqAmount > (localWallet?.balance || 0)) {
            return Alert.alert('Insufficient Balance', 'You cannot withdraw more than your available balance.');
        }
        if (!bankName || !accountNo || !accountName) {
            return Alert.alert('Incomplete Details', 'Please enter your full bank details.');
        }

        Alert.alert('Confirm Withdrawal', `Are you sure you want to withdraw ₦${reqAmount.toLocaleString()}?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Confirm',
                onPress: async () => {
                    setLoading(true);
                    try {
                        const { error: withdrawErr } = await supabase.from('vendor_payouts').insert([
                            {
                                vendor_id: user.id,
                                amount: reqAmount,
                                bank_name: bankName,
                                account_number: accountNo,
                                account_name: accountName,
                                status: 'pending'
                            }
                        ]);
                        if (withdrawErr) throw withdrawErr;

                        const newBalance = (localWallet?.balance || 0) - reqAmount;
                        const { error: walletErr } = await supabase
                            .from('wallets')
                            .update({ balance: newBalance })
                            .eq('user_id', user.id);
                        if (walletErr) throw walletErr;
                        setLocalWallet(prev => ({ ...prev, balance: newBalance }));

                        Alert.alert('Success', 'Withdrawal request submitted successfully.');
                        setShowWithdrawModal(false);
                        setAmount('');
                        if (fetchDashboardData) fetchDashboardData();
                        fetchWithdrawalHistory();
                    } catch (err) {
                        console.error('Withdrawal error:', err);
                        Alert.alert('Error', err.message || 'Failed to process withdrawal.');
                    } finally {
                        setLoading(false);
                    }
                }
            }
        ]);
    };

    const parsedAmount = parseFloat(amount.replace(/,/g, '')) || 0;
    const isExceeding = parsedAmount > (localWallet?.balance || 0);

    const displayedWithdrawals = withdrawals.filter(w => filter === 'All' ? true : w.status === filter);

    const currentHour = new Date().getHours();
    const greeting = currentHour < 12 ? 'Good Morning' : currentHour < 18 ? 'Good Afternoon' : 'Good Evening';
    const pendingWithdrawal = withdrawals.find(w => w.status === 'pending');
    const rejectedWithdrawal = withdrawals.find(w => w.status === 'rejected');

    return (
        <ScrollView
            style={{ flex: 1, backgroundColor: '#F8FAFC' }}
            contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3B82F6" colors={['#3B82F6']} />}
        >
            <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                {/* DYNAMIC GREETING */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <View>
                        <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>{greeting},</Text>
                        <Text style={{ fontSize: 20, color: '#0F172A', fontWeight: '800' }}>{user?.user_metadata?.first_name || 'Vendor'}</Text>
                    </View>
                    <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="person" size={20} color="#94A3B8" />
                    </View>
                </View>

                {/* NOTIFICATION BANNER */}
                {pendingWithdrawal ? (
                    <View style={localStyles.alertBanner}>
                        <Ionicons name="time" size={20} color="#D97706" />
                        <Text style={localStyles.alertBannerText}>You have a pending withdrawal of ₦{pendingWithdrawal.amount.toLocaleString()}.</Text>
                    </View>
                ) : rejectedWithdrawal ? (
                    <View style={[localStyles.alertBanner, { backgroundColor: '#FEF2F2', borderColor: '#FEE2E2' }]}>
                        <Ionicons name="alert-circle" size={20} color="#EF4444" />
                        <Text style={[localStyles.alertBannerText, { color: '#B91C1C' }]}>A recent withdrawal was rejected. Please check history.</Text>
                    </View>
                ) : null}

                {/* PREMIUM BALANCE CARD */}
                <View style={[localStyles.glassCard, { backgroundColor: '#0F172A', marginBottom: 20, position: 'relative', overflow: 'hidden' }]}>
                    {/* Decorative Abstract Circles */}
                    <View style={localStyles.cardDecoCircle1} />
                    <View style={localStyles.cardDecoCircle2} />

                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                <Text style={[localStyles.cardLabel, { color: '#94A3B8' }]}>Available Balance</Text>
                                <TouchableOpacity onPress={() => setIsBalanceHidden(!isBalanceHidden)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                                    <Ionicons name={isBalanceHidden ? "eye-off" : "eye"} size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            </View>
                            <Text style={[localStyles.cardBalance, { color: 'white' }]}>
                                {isBalanceHidden ? '****' : `₦${(localWallet?.balance || 0).toLocaleString()}`}
                            </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Ionicons name="card" size={28} color="rgba(255,255,255,0.4)" />
                        </View>
                    </View>
                </View>

                {/* QUICK ACTION GRID */}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24, paddingHorizontal: 4 }}>
                    <TouchableOpacity style={localStyles.actionBtn} onPress={() => setShowWithdrawModal(true)}>
                        <View style={[localStyles.actionIconBg, { backgroundColor: '#DBEAFE' }]}>
                            <Ionicons name="arrow-down" size={22} color="#2563EB" />
                        </View>
                        <Text style={localStyles.actionLabel}>Withdraw</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={localStyles.actionBtn} onPress={() => setShowAnalyticsModal(true)}>
                        <View style={[localStyles.actionIconBg, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="bar-chart" size={22} color="#10B981" />
                        </View>
                        <Text style={localStyles.actionLabel}>Analytics</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={localStyles.actionBtn} onPress={handleExportHistory}>
                        <View style={[localStyles.actionIconBg, { backgroundColor: '#FEF3C7' }]}>
                            <Ionicons name="download" size={22} color="#D97706" />
                        </View>
                        <Text style={localStyles.actionLabel}>Export</Text>
                    </TouchableOpacity>

                    <TouchableOpacity style={localStyles.actionBtn} onPress={() => navigation.navigate('ChatScreen')}>
                        <View style={[localStyles.actionIconBg, { backgroundColor: '#F3E8FF' }]}>
                            <Ionicons name="headset" size={22} color="#9333EA" />
                        </View>
                        <Text style={localStyles.actionLabel}>Support</Text>
                    </TouchableOpacity>
                </View>

                {/* ESCROW CARD */}
                <View style={[localStyles.glassCard, { backgroundColor: '#F59E0B' }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                                <Ionicons name="lock-closed" size={14} color="#FEF3C7" />
                                <Text style={[localStyles.cardLabel, { color: '#FEF3C7' }]}>Pending Escrow</Text>
                            </View>
                            <Text style={[localStyles.cardBalance, { color: 'white', fontSize: 28 }]}>
                                ₦{(localWallet?.pending_balance || 0).toLocaleString()}
                            </Text>
                            <Text style={[localStyles.cardSubtext, { color: '#FDE68A' }]}>From active unfulfilled orders</Text>
                        </View>
                        <View style={localStyles.iconCircle}>
                            <Ionicons name="time" size={24} color="white" />
                        </View>
                    </View>
                </View>

                {/* QUICK STATS */}
                <View style={{ flexDirection: 'row', gap: 12, marginTop: 16 }}>
                    <View style={localStyles.statCard}>
                        <View style={[localStyles.statIconBg, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="trending-up" size={18} color="#10B981" />
                        </View>
                        <View>
                            <Text style={localStyles.statLabel}>Lifetime Withdrawals</Text>
                            <Text style={localStyles.statValue}>
                                ₦{withdrawals.filter(w => w.status === 'completed').reduce((sum, w) => sum + w.amount, 0).toLocaleString()}
                            </Text>
                        </View>
                    </View>
                    <View style={localStyles.statCard}>
                        <View style={[localStyles.statIconBg, { backgroundColor: '#F1F5F9' }]}>
                            <Ionicons name="swap-horizontal" size={18} color="#64748B" />
                        </View>
                        <View>
                            <Text style={localStyles.statLabel}>Recent Status</Text>
                            <Text style={[localStyles.statValue, { color: withdrawals[0]?.status === 'pending' ? '#F59E0B' : '#0F172A' }]}>
                                {withdrawals[0] ? (withdrawals[0].status.charAt(0).toUpperCase() + withdrawals[0].status.slice(1)) : 'No Activity'}
                            </Text>
                        </View>
                    </View>
                </View>

                {/* HISTORY SECTION */}
                <View style={{ marginTop: 32 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                        <Text style={localStyles.sectionTitle}>Withdrawal History</Text>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: 8, backgroundColor: '#F1F5F9', borderRadius: 8 }} onPress={handleExportHistory}>
                            <Ionicons name="download-outline" size={16} color="#3B82F6" />
                            <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: '600' }}>Export</Text>
                        </TouchableOpacity>
                    </View>

                    {/* HISTORY FILTERS */}
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                        {['All', 'pending', 'completed', 'rejected'].map((f) => (
                            <TouchableOpacity
                                key={f}
                                onPress={() => setFilter(f)}
                                style={[localStyles.filterChip, filter === f && localStyles.filterChipActive]}
                            >
                                <Text style={[localStyles.filterText, filter === f && localStyles.filterTextActive]}>
                                    {f.charAt(0).toUpperCase() + f.slice(1)}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>

                    {loadingHistory ? (
                        <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 40 }} />
                    ) : displayedWithdrawals.length === 0 ? (
                        <View style={localStyles.emptyState}>
                            <View style={localStyles.emptyIconBg}>
                                <Ionicons name="receipt-outline" size={32} color="#94A3B8" />
                            </View>
                            <Text style={localStyles.emptyStateText}>No {filter !== 'All' ? filter : ''} withdrawals found</Text>
                        </View>
                    ) : (
                        displayedWithdrawals.map((item, idx) => (
                            <Animated.View key={idx} style={[localStyles.historyItem, { opacity: fadeAnim }]}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                                    <View style={[
                                        localStyles.statusIcon,
                                        item.status === 'paid' ? { backgroundColor: '#DCFCE7' } :
                                            item.status === 'rejected' ? { backgroundColor: '#FEE2E2' } :
                                                { backgroundColor: '#FEF3C7' }
                                    ]}>
                                        <Ionicons
                                            name={item.status === 'paid' ? "checkmark-done" : item.status === 'rejected' ? "close" : "time"}
                                            size={20}
                                            color={item.status === 'paid' ? "#16A34A" : item.status === 'rejected' ? "#EF4444" : "#D97706"}
                                        />
                                    </View>
                                    <View>
                                        <Text style={localStyles.historyAmount}>₦{item.amount?.toLocaleString()}</Text>
                                        <Text style={localStyles.historyDate}>{new Date(item.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</Text>
                                    </View>
                                </View>
                                <View style={[
                                    localStyles.statusBadge,
                                    item.status === 'paid' ? { backgroundColor: '#ECFDF5' } :
                                        item.status === 'rejected' ? { backgroundColor: '#FEF2F2' } :
                                            { backgroundColor: '#FFFBEB' }
                                ]}>
                                    <Text style={[
                                        localStyles.statusText,
                                        item.status === 'paid' ? { color: '#10B981' } :
                                            item.status === 'rejected' ? { color: '#EF4444' } :
                                                { color: '#F59E0B' }
                                    ]}>
                                        {item.status}
                                    </Text>
                                </View>
                            </Animated.View>
                        ))
                    )}
                </View>
            </Animated.View>

            {/* WITHDRAW MODAL */}
            <Modal visible={showWithdrawModal} animationType="slide" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={[localStyles.modalContent, { maxHeight: '90%' }]}>
                        <View style={localStyles.modalHeader}>
                            <Text style={localStyles.modalTitle}>Request Withdrawal</Text>
                            <TouchableOpacity onPress={() => setShowWithdrawModal(false)} style={localStyles.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            <View style={localStyles.balanceStrip}>
                                <Text style={{ fontSize: 13, color: '#64748B' }}>Available Balance</Text>
                                <Text style={{ fontWeight: '800', color: '#10B981', fontSize: 16 }}>₦{(wallet?.balance || 0).toLocaleString()}</Text>
                            </View>

                            {/* CUSTOM AMOUNT INPUT (PIN-STYLE) */}
                            <View style={{ alignItems: 'center', marginVertical: 16 }}>
                                <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 1 }}>Amount to withdraw</Text>
                                <Text style={[localStyles.numpadDisplay, isExceeding && { color: '#EF4444' }]}>
                                    ₦{amount ? parseFloat(amount).toLocaleString() : '0'}
                                </Text>
                                {isExceeding && (
                                    <Text style={localStyles.errorText}>
                                        <Ionicons name="alert-circle" size={12} color="#EF4444" /> Amount exceeds available balance
                                    </Text>
                                )}
                            </View>

                            {/* CUSTOM NUMPAD */}
                            <View style={localStyles.numpadContainer}>
                                {['1', '2', '3', '4', '5', '6', '7', '8', '9', '00', '0', '⌫'].map((key) => (
                                    <TouchableOpacity
                                        key={key}
                                        style={localStyles.numKey}
                                        onPress={() => {
                                            if (key === '⌫') {
                                                setAmount(prev => prev.slice(0, -1));
                                            } else {
                                                if (amount.length > 8) return; // Prevent excessively large input
                                                if (amount === '0' && key !== '0' && key !== '00') setAmount(key);
                                                else if (amount === '0' && (key === '0' || key === '00')) return;
                                                else setAmount(prev => prev + key);
                                            }
                                        }}
                                        activeOpacity={0.6}
                                    >
                                        {key === '⌫' ? (
                                            <Ionicons name="backspace-outline" size={24} color="#0F172A" />
                                        ) : (
                                            <Text style={localStyles.numKeyText}>{key}</Text>
                                        )}
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={localStyles.label}>Bank Name</Text>
                            <TouchableOpacity
                                style={[localStyles.input, { justifyContent: 'space-between', flexDirection: 'row', alignItems: 'center' }]}
                                onPress={() => setShowBankDropdown(true)}
                                activeOpacity={0.7}
                            >
                                <Text style={{ color: bankName ? '#0F172A' : '#94A3B8', fontWeight: '600' }}>{bankName || 'Select your bank'}</Text>
                                <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                            </TouchableOpacity>

                            <Text style={localStyles.label}>Account Number</Text>
                            <TextInput
                                style={localStyles.input}
                                placeholder="10 digit account number"
                                placeholderTextColor="#94A3B8"
                                keyboardType="numeric"
                                maxLength={10}
                                value={accountNo}
                                onChangeText={setAccountNo}
                            />

                            <Text style={localStyles.label}>Account Name (Auto-fetched)</Text>
                            <View style={[localStyles.input, { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderColor: 'transparent' }]}>
                                {resolvingAccount ? (
                                    <ActivityIndicator size="small" color="#3B82F6" style={{ marginRight: 10 }} />
                                ) : null}
                                <TextInput
                                    style={{ flex: 1, color: '#0F172A', fontWeight: '700' }}
                                    placeholder={accountNo.length === 10 && !resolvingAccount ? "Account name not found" : "Enter account number first"}
                                    placeholderTextColor="#94A3B8"
                                    value={accountName}
                                    editable={false}
                                />
                            </View>

                            <TouchableOpacity
                                style={[localStyles.submitBtn, { opacity: (loading || isExceeding || !accountName) ? 0.5 : 1 }]}
                                onPress={handleWithdraw}
                                disabled={loading || isExceeding || !accountName}
                                activeOpacity={0.8}
                            >
                                {loading ? <ActivityIndicator color="white" /> : <Text style={localStyles.submitBtnText}>Submit Request</Text>}
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* BANK SELECTION MODAL */}
            <Modal visible={showBankDropdown} animationType="fade" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={[localStyles.modalContent, { maxHeight: '85%' }]}>
                        <View style={localStyles.modalHeader}>
                            <Text style={localStyles.modalTitle}>Select Bank</Text>
                            <TouchableOpacity onPress={() => setShowBankDropdown(false)} style={localStyles.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <View style={localStyles.searchContainer}>
                            <Ionicons name="search" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={localStyles.searchInput}
                                placeholder="Search banks..."
                                placeholderTextColor="#94A3B8"
                                value={searchBankQuery}
                                onChangeText={handleSearchBank}
                                autoCapitalize="none"
                            />
                        </View>
                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                            {filteredBanks.map((bank, index) => (
                                <TouchableOpacity
                                    key={index}
                                    style={localStyles.bankItem}
                                    onPress={() => {
                                        setBankName(bank.name);
                                        setBankCode(bank.code);
                                        setShowBankDropdown(false);
                                        setSearchBankQuery('');
                                        setFilteredBanks(banks);
                                    }}
                                >
                                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                                        <Ionicons name="business" size={14} color="#64748B" />
                                    </View>
                                    <Text style={localStyles.bankItemText}>{bank.name}</Text>
                                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ANALYTICS MODAL */}
            <Modal visible={showAnalyticsModal} animationType="slide" transparent={true}>
                <View style={localStyles.modalOverlay}>
                    <View style={[localStyles.modalContent, { maxHeight: '85%' }]}>
                        <View style={localStyles.modalHeader}>
                            <Text style={localStyles.modalTitle}>Analytics & Insights</Text>
                            <TouchableOpacity onPress={() => setShowAnalyticsModal(false)} style={localStyles.closeBtn}>
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        {(() => {
                            const completedWithdrawals = withdrawals.filter(w => w.status === 'paid');
                            const pendingWithdrawals = withdrawals.filter(w => w.status === 'pending');
                            const totalWithdrawn = completedWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
                            const pendingAmount = pendingWithdrawals.reduce((sum, w) => sum + (w.amount || 0), 0);
                            const successRate = withdrawals.length > 0 ? Math.round((completedWithdrawals.length / withdrawals.length) * 100) : 0;
                            const largestWithdrawal = withdrawals.length > 0 ? Math.max(...withdrawals.map(w => w.amount || 0)) : 0;

                            return (
                                <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
                                    {/* Summary Banner */}
                                    <View style={{ backgroundColor: '#0F172A', padding: 24, borderRadius: 24, marginBottom: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 20, elevation: 8, position: 'relative', overflow: 'hidden' }}>
                                        <View style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                                            <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                                                <Ionicons name="wallet" size={16} color="#DBEAFE" />
                                            </View>
                                            <Text style={{ color: '#94A3B8', fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 }}>Total Withdrawn</Text>
                                        </View>
                                        <Text style={{ color: 'white', fontSize: 36, fontWeight: '900', letterSpacing: -1 }}>₦{totalWithdrawn.toLocaleString()}</Text>
                                    </View>

                                    {/* Analytics Grid */}
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                                        {/* Pending */}
                                        <View style={[localStyles.statCard, { width: '48%', marginBottom: 0 }]}>
                                            <View style={[localStyles.statIconBg, { backgroundColor: '#FFFBEB' }]}>
                                                <Ionicons name="time" size={18} color="#D97706" />
                                            </View>
                                            <Text style={localStyles.statLabel}>Pending</Text>
                                            <Text style={[localStyles.statValue, { fontSize: 18, color: '#B45309' }]}>₦{pendingAmount.toLocaleString()}</Text>
                                        </View>

                                        {/* Success Rate */}
                                        <View style={[localStyles.statCard, { width: '48%', marginBottom: 0 }]}>
                                            <View style={[localStyles.statIconBg, { backgroundColor: '#ECFDF5' }]}>
                                                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                                            </View>
                                            <Text style={localStyles.statLabel}>Success Rate</Text>
                                            <Text style={[localStyles.statValue, { fontSize: 18, color: '#047857' }]}>{successRate}%</Text>
                                        </View>

                                        {/* Transactions */}
                                        <View style={[localStyles.statCard, { width: '48%' }]}>
                                            <View style={[localStyles.statIconBg, { backgroundColor: '#EFF6FF' }]}>
                                                <Ionicons name="list" size={18} color="#3B82F6" />
                                            </View>
                                            <Text style={localStyles.statLabel}>Transactions</Text>
                                            <Text style={[localStyles.statValue, { fontSize: 18, color: '#1D4ED8' }]}>{withdrawals.length}</Text>
                                        </View>

                                        {/* Largest */}
                                        <View style={[localStyles.statCard, { width: '48%' }]}>
                                            <View style={[localStyles.statIconBg, { backgroundColor: '#F3E8FF' }]}>
                                                <Ionicons name="trending-up" size={18} color="#9333EA" />
                                            </View>
                                            <Text style={localStyles.statLabel}>Largest Single</Text>
                                            <Text style={[localStyles.statValue, { fontSize: 18, color: '#7E22CE' }]}>₦{largestWithdrawal.toLocaleString()}</Text>
                                        </View>
                                    </View>

                                    <View style={{ marginTop: 24, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                        <Ionicons name="information-circle" size={24} color="#64748B" />
                                        <Text style={{ flex: 1, color: '#475569', fontSize: 13, lineHeight: 20 }}>These insights are based on your lifetime withdrawal history on the platform.</Text>
                                    </View>
                                </ScrollView>
                            );
                        })()}
                    </View>
                </View>
            </Modal>


        </ScrollView >
    );
};

const localStyles = StyleSheet.create({
    glassCard: {
        padding: 24,
        borderRadius: 20,
        overflow: 'hidden',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.1,
        shadowRadius: 15,
        elevation: 5,
    },
    cardLabel: { fontSize: 13, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
    cardBalance: { fontSize: 34, fontWeight: '900', marginVertical: 4, letterSpacing: -1 },
    cardSubtext: { fontSize: 12, fontWeight: '500' },
    primaryBtn: { backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 30, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
    primaryBtnText: { color: 'white', fontWeight: '700', fontSize: 14 },
    iconCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
    helperText: { fontSize: 12, color: '#64748B', marginTop: 12, textAlign: 'center', paddingHorizontal: 20, lineHeight: 18, fontStyle: 'italic' },

    alertBanner: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FEF3C7', gap: 8 },
    alertBannerText: { flex: 1, fontSize: 13, color: '#B45309', fontWeight: '500' },

    cardDecoCircle1: { position: 'absolute', right: -30, top: -40, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.05)' },
    cardDecoCircle2: { position: 'absolute', right: 40, bottom: -60, width: 160, height: 160, borderRadius: 80, backgroundColor: 'rgba(255,255,255,0.03)' },

    actionBtn: { alignItems: 'center', width: '22%' },
    actionIconBg: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 8, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
    actionLabel: { fontSize: 12, color: '#475569', fontWeight: '600' },

    sectionTitle: { fontSize: 18, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#E2E8F0' },
    filterChipActive: { backgroundColor: '#3B82F6', borderColor: '#3B82F6' },
    filterText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    filterTextActive: { color: 'white' },

    emptyState: { alignItems: 'center', padding: 32, backgroundColor: 'white', borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9', marginTop: 20 },
    emptyIconBg: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    emptyStateText: { color: '#64748B', fontSize: 14, fontWeight: '500' },

    statCard: { flex: 1, backgroundColor: 'white', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.02, shadowRadius: 4, elevation: 1 },
    statIconBg: { width: 32, height: 32, borderRadius: 8, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
    statLabel: { fontSize: 12, color: '#64748B', fontWeight: '500', marginBottom: 4 },
    statValue: { fontSize: 16, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },

    historyItem: { backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 8, elevation: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    statusIcon: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    historyAmount: { fontSize: 16, fontWeight: '800', color: '#0F172A', marginBottom: 2 },
    historyDate: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },

    modalOverlay: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: 40 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 },
    modalTitle: { fontSize: 20, fontWeight: '800', color: '#0F172A', letterSpacing: -0.5 },
    closeBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    balanceStrip: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' },

    label: { fontSize: 13, fontWeight: '700', color: '#475569', marginBottom: 8, marginTop: 16 },
    input: { backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#E2E8F0', fontSize: 15, fontWeight: '600', color: '#0F172A', shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.02, shadowRadius: 2, elevation: 1 },
    errorText: { color: '#EF4444', fontSize: 12, marginTop: 8, fontWeight: '600' },

    numpadDisplay: { fontSize: 40, fontWeight: '900', color: '#0F172A', letterSpacing: -1 },
    numpadContainer: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12, marginBottom: 24, paddingHorizontal: 10 },
    numKey: { width: '30%', height: 60, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    numKeyText: { fontSize: 24, fontWeight: '700', color: '#0F172A' },

    submitBtn: { backgroundColor: '#3B82F6', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 32, shadowColor: "#3B82F6", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    submitBtnText: { color: 'white', fontSize: 16, fontWeight: '800' },

    searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9' },
    searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, color: '#0F172A', fontWeight: '500' },
    bankItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderColor: '#F8FAFC' },
    bankItemText: { flex: 1, fontSize: 15, fontWeight: '600', color: '#334155' }
});
