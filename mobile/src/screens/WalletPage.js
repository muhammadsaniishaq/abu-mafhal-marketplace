import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl, StyleSheet, Modal, Platform, Image, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { supabase } from '../lib/supabase';
import { WebView } from 'react-native-webview';
import { useAppSettings } from '../context/AppSettingsContext';
import { whatsappService } from '../services/whatsappService';
import AsyncStorage from '@react-native-async-storage/async-storage';

const { width } = Dimensions.get('window');

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount).replace('NGN', '₦');
};

const themeGradients = {
    midnight: ['#0F172A', '#1E293B', '#0F172A'],
    indigo: ['#1E1B4B', '#3730A3', '#1E1B4B'],
    emerald: ['#064E3B', '#065F46', '#064E3B'],
    ruby: ['#450A0A', '#991B1B', '#450A0A']
};

const WalletPageInner = ({ user, onBack, onNavigate }) => {
    const [wallet, setWallet] = useState({ balance: 0, points: 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [topUpAmount, setTopUpAmount] = useState('1000');
    const [isTopUpPending, setIsTopUpPending] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // Dynamic Filter State
    const [txFilter, setTxFilter] = useState('all'); 

    // Premium Interactive Decorations & Features States
    const [hideBalance, setHideBalance] = useState(false);
    const [cardTheme, setCardTheme] = useState('midnight');
    const [savingsGoals, setSavingsGoals] = useState([]);

    // Custom Savings Pot Creation State
    const [showCreatePotModal, setShowCreatePotModal] = useState(false);
    const [newPotName, setNewPotName] = useState('');
    const [newPotTarget, setNewPotTarget] = useState('10000');
    const [newPotColor, setNewPotColor] = useState('#3B82F6');

    // Custom Amount Savings Allocation State
    const [showCustomAmountModal, setShowCustomAmountModal] = useState(false);
    const [customAmountType, setCustomAmountType] = useState('deposit');
    const [customAmountGoalId, setCustomAmountGoalId] = useState('');
    const [customAmountVal, setCustomAmountVal] = useState('');

    // Spending Control Monthly Limit State
    const [monthlyLimit, setMonthlyLimit] = useState(50000);
    const [showBudgetModal, setShowBudgetModal] = useState(false);
    const [budgetInputVal, setBudgetInputVal] = useState('');

    // Voucher Redeem Modal State
    const [showVoucherModal, setShowVoucherModal] = useState(false);
    const [voucherCode, setVoucherCode] = useState('');
    const [isVoucherRedeeming, setIsVoucherRedeeming] = useState(false);

    // Selected Transaction Modal State (Receipt details)
    const [selectedTx, setSelectedTx] = useState(null);

    // Paystack Checkout states
    const [showPaystackWebView, setShowPaystackWebView] = useState(false);
    const [currentRef, setCurrentRef] = useState(null);
    const [checkoutUrl, setCheckoutUrl] = useState(null);

    const { settings } = useAppSettings();

    const fetchWalletData = async () => {
        if (!user) return;
        try {
            const [wRes, pRes] = await Promise.all([
                supabase.from('wallets').select('*').eq('user_id', user.id).maybeSingle(),
                supabase.from('profiles').select('mafhal_coins').eq('id', user.id).single()
            ]);

            if (wRes.data) {
                const displayPoints = Math.max(wRes.data.points || 0, pRes.data?.mafhal_coins || 0);
                setWallet({
                    balance: wRes.data.balance || 0,
                    points: displayPoints
                });
            } else {
                setWallet({ balance: 0, points: pRes.data?.mafhal_coins || 0 });
            }

            const { data: txData } = await supabase
                .from('wallet_transactions')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(25);

            if (txData) setTransactions(txData);

        } catch (error) {
            console.log("Wallet Data Error:", error);
        } finally {
            setLoading(false);
        }
    };

    // Helper to save savings goals to AsyncStorage
    const saveSavingsGoalsToStorage = async (updatedGoals) => {
        if (!user?.id) return;
        try {
            const storageKey = `SAVINGS_GOALS_${user.id}`;
            await AsyncStorage.setItem(storageKey, JSON.stringify(updatedGoals));
        } catch (err) {
            console.log('Error saving savings goals:', err);
        }
    };

    useEffect(() => {
        fetchWalletData();
        
        // Load persistent savings goals and budget limit
        const loadUserData = async () => {
            if (!user?.id) return;
            try {
                // 1. Load savings goals
                const storageKey = `SAVINGS_GOALS_${user.id}`;
                const savedData = await AsyncStorage.getItem(storageKey);
                if (savedData) {
                    setSavingsGoals(JSON.parse(savedData));
                } else {
                    const defaultGoals = [
                        { id: 'gadget', name: 'New Gadget Fund', target: 50000, saved: 0, icon: 'laptop-outline', color: '#3B82F6', bg: '#EFF6FF' },
                        { id: 'birthday', name: "Hajiya's Birthday", target: 15000, saved: 0, icon: 'gift-outline', color: '#EC4899', bg: '#FDF2F8' }
                    ];
                    setSavingsGoals(defaultGoals);
                    await AsyncStorage.setItem(storageKey, JSON.stringify(defaultGoals));
                }

                // 2. Load monthly spending budget limit
                const limitKey = `MONTHLY_LIMIT_${user.id}`;
                const savedLimit = await AsyncStorage.getItem(limitKey);
                if (savedLimit) {
                    setMonthlyLimit(parseInt(savedLimit));
                } else {
                    setMonthlyLimit(50000);
                    await AsyncStorage.setItem(limitKey, '50000');
                }
            } catch (err) {
                console.log('Error loading user storage data:', err);
            }
        };
        loadUserData();
    }, [user?.id]);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchWalletData();
        setRefreshing(false);
    }, [user?.id]);

    const handleTopUp = () => {
        const amountNum = parseInt(topUpAmount);

        if (isNaN(amountNum) || amountNum < 100) {
            Alert.alert('Invalid Amount', 'Minimum top-up is ₦100');
            return;
        }

        setIsTopUpPending(true);

        setTimeout(async () => {
            setShowTopUpModal(false);

            try {
                const fallbackEmail = user?.email || `wallet_${user?.id?.substring(0, 6) || Math.floor(Math.random() * 1000)}@abumafhal.com`;
                const ref = `WALLET-${user?.id?.slice(0, 4) || 'GUEST'}-${Date.now()}`;

                const { data, error } = await supabase.functions.invoke('initiate-paystack-payment', {
                    body: {
                        amount: amountNum,
                        email: fallbackEmail,
                        reference: ref,
                        callback_url: Platform.OS === 'web' ? window.location.href : 'https://standard.paystack.co/close'
                    }
                });

                if (error) throw error;
                if (!data?.success) throw new Error(data?.error || 'Failed to initialize payment');

                setCurrentRef(ref);
                setCheckoutUrl(data.authorization_url);

                if (Platform.OS === 'web') {
                    Alert.alert('Redirecting...', 'You are being redirected to Paystack to complete your payment.');
                    setTimeout(() => {
                        window.location.href = data.authorization_url;
                    }, 1000);
                } else {
                    setShowPaystackWebView(true);
                }
            } catch (err) {
                console.error('[DEBUG-PAYSTACK] Init Error:', err);
                Alert.alert('Payment Error', 'Could not initialize payment. Please try again.');
            } finally {
                setIsTopUpPending(false);
            }
        }, 200);
    };

    // Voucher Redemption Logic
    const handleRedeemVoucher = () => {
        if (!voucherCode.trim()) {
            Alert.alert('Error', 'Please enter a valid voucher code.');
            return;
        }

        setIsVoucherRedeeming(true);

        setTimeout(async () => {
            const codeClean = voucherCode.trim().toUpperCase();

            // Mock Promo Codes for demonstration
            if (codeClean === 'MAFHALE500' || codeClean === 'WELCOME100') {
                const value = codeClean === 'MAFHALE500' ? 500 : 100;
                
                try {
                    // Fetch existing points
                    const currentPoints = wallet.points;
                    const newPoints = currentPoints + value;

                    // Update Supabase profiles table
                    const { error } = await supabase
                        .from('profiles')
                        .update({ mafhal_coins: newPoints })
                        .eq('id', user.id);

                    if (error) throw error;

                    // Insert custom transaction row
                    await supabase.from('wallet_transactions').insert({
                        user_id: user.id,
                        type: 'bonus',
                        amount: 0,
                        points_change: value,
                        description: `Voucher Code ${codeClean} Redeemed`
                    });

                    Alert.alert('Success!', `Congratulations! You have successfully redeemed ${value} Mafhal Coins.`);
                    setShowVoucherModal(false);
                    setVoucherCode('');
                    fetchWalletData();
                } catch (e) {
                    console.log('Voucher Redeem Error:', e);
                    Alert.alert('Oops', 'Could not process code redemption. Try again.');
                }
            } else {
                Alert.alert('Invalid Code', 'The voucher code entered is invalid or has expired.');
            }

            setIsVoucherRedeeming(false);
        }, 800);
    };

    // Fully Live & Persistent Savings Goals Logic
    const handleSavingsPress = (goalId) => {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        const pct = Math.min(Math.round((goal.saved / goal.target) * 100), 100);
        Alert.alert(
            goal.name,
            `Target: ${formatCurrency(goal.target)}\nSaved: ${formatCurrency(goal.saved)} (${pct}% Achieved)`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: '📥 Add Savings', onPress: () => promptAddSavings(goalId) },
                { text: '📤 Withdraw to Wallet', onPress: () => promptWithdrawSavings(goalId) },
                { 
                    text: '🗑️ Delete Pot', 
                    style: 'destructive', 
                    onPress: () => confirmDeletePot(goalId) 
                }
            ]
        );
    };

    const promptAddSavings = (goalId) => {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        Alert.alert(
            'Add Savings',
            `Select amount to move from wallet to "${goal.name}":`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: '₦1,000', onPress: () => processSavingsTransfer(goalId, 1000, 'deposit') },
                { text: '₦5,000', onPress: () => processSavingsTransfer(goalId, 5000, 'deposit') },
                { text: '₦10,000', onPress: () => processSavingsTransfer(goalId, 10000, 'deposit') },
                { 
                    text: 'Custom Amount', 
                    onPress: () => {
                        setCustomAmountGoalId(goalId);
                        setCustomAmountType('deposit');
                        setCustomAmountVal('');
                        setShowCustomAmountModal(true);
                    } 
                }
            ]
        );
    };

    const promptWithdrawSavings = (goalId) => {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        if (goal.saved <= 0) {
            Alert.alert('No Funds', 'This savings pot has no funds to withdraw.');
            return;
        }

        Alert.alert(
            'Withdraw Savings',
            `Select amount to return to your main wallet balance:`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: '₦1,000', onPress: () => {
                    if (goal.saved < 1000) { Alert.alert('Error', 'Insufficient funds in pot.'); return; }
                    processSavingsTransfer(goalId, 1000, 'withdraw');
                }},
                { text: '₦5,000', onPress: () => {
                    if (goal.saved < 5000) { Alert.alert('Error', 'Insufficient funds in pot.'); return; }
                    processSavingsTransfer(goalId, 5000, 'withdraw');
                }},
                { text: 'Withdraw All', onPress: () => processSavingsTransfer(goalId, goal.saved, 'withdraw') },
                { 
                    text: 'Custom Amount', 
                    onPress: () => {
                        setCustomAmountGoalId(goalId);
                        setCustomAmountType('withdraw');
                        setCustomAmountVal('');
                        setShowCustomAmountModal(true);
                    } 
                }
            ]
        );
    };

    const confirmDeletePot = (goalId) => {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        Alert.alert(
            'Delete Savings Pot',
            `Are you sure you want to delete "${goal.name}"? If there are any saved funds (₦${goal.saved.toLocaleString()}), they will be refunded to your main wallet balance.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', 
                    style: 'destructive', 
                    onPress: () => deleteSavingsPot(goalId) 
                }
            ]
        );
    };

    const deleteSavingsPot = async (goalId) => {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        try {
            // Refund any saved funds to wallet in database
            if (goal.saved > 0) {
                const { data: walletData, error: walletError } = await supabase
                    .from('wallets')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (walletError) throw walletError;

                const newBalance = (walletData?.balance || wallet.balance) + goal.saved;

                // Update wallets table
                await supabase.from('wallets').update({ balance: newBalance }).eq('user_id', user.id);

                // Insert transaction log
                await supabase.from('wallet_transactions').insert({
                    user_id: user.id,
                    type: 'topup',
                    amount: goal.saved,
                    description: `Refunded from deleted pot "${goal.name}"`
                });

                setWallet(prev => ({ ...prev, balance: newBalance }));
            }

            // Remove pot from local state
            const updatedGoals = savingsGoals.filter(g => g.id !== goalId);
            setSavingsGoals(updatedGoals);
            await saveSavingsGoalsToStorage(updatedGoals);

            fetchWalletData();
            Alert.alert('Success', `Savings Pot "${goal.name}" deleted successfully.`);
        } catch (err) {
            console.log('Delete Pot Error:', err);
            Alert.alert('Error', 'Could not delete savings pot. Try again.');
        }
    };

    const processSavingsTransfer = async (goalId, amount, type = 'deposit') => {
        const goal = savingsGoals.find(g => g.id === goalId);
        if (!goal) return;

        if (type === 'deposit' && wallet.balance < amount) {
            Alert.alert('Insufficient Balance', 'Please top up your wallet first.');
            return;
        }

        try {
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();

            if (walletError) throw walletError;

            const currentBalance = walletData?.balance || wallet.balance;
            const newBalance = type === 'deposit' ? currentBalance - amount : currentBalance + amount;

            // Update wallets table
            const { error: updateError } = await supabase
                .from('wallets')
                .update({ balance: newBalance })
                .eq('user_id', user.id);

            if (updateError) throw updateError;

            // Log transaction in wallet_transactions table
            const txType = type === 'deposit' ? 'debit' : 'topup';
            const txAmount = type === 'deposit' ? -amount : amount;
            const txDesc = type === 'deposit' 
                ? `Saved for "${goal.name}"` 
                : `Withdrew from "${goal.name}"`;

            await supabase.from('wallet_transactions').insert({
                user_id: user.id,
                type: txType,
                amount: txAmount,
                description: txDesc
            });

            // Update local state variables
            const updatedGoals = savingsGoals.map(g => {
                if (g.id === goalId) {
                    const newSaved = type === 'deposit' ? g.saved + amount : g.saved - amount;
                    return { ...g, saved: Math.max(0, newSaved) };
                }
                return g;
            });

            setWallet(prev => ({ ...prev, balance: newBalance }));
            setSavingsGoals(updatedGoals);
            await saveSavingsGoalsToStorage(updatedGoals);
            
            // Reload transaction history list
            fetchWalletData();

            Alert.alert(
                'Success!', 
                type === 'deposit' 
                    ? `Allocated ₦${amount.toLocaleString()} to your "${goal.name}" savings goal.`
                    : `Returned ₦${amount.toLocaleString()} from "${goal.name}" to your wallet balance.`
            );
        } catch (e) {
            console.log('Savings Allocation Error:', e);
            Alert.alert('Error', 'Could not process savings allocation. Please try again.');
        }
    };

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

        const colorPresets = [
            { color: '#3B82F6', bg: '#EFF6FF', icon: 'wallet-outline' },
            { color: '#10B981', bg: '#ECFDF5', icon: 'cart-outline' },
            { color: '#EC4899', bg: '#FDF2F8', icon: 'gift-outline' },
            { color: '#F59E0B', bg: '#FFFBEB', icon: 'airplane-outline' }
        ];

        const selectedPreset = colorPresets.find(p => p.color === newPotColor) || colorPresets[0];

        const newGoal = {
            id: `goal_${Date.now()}`,
            name: newPotName.trim(),
            target: targetNum,
            saved: 0,
            icon: selectedPreset.icon,
            color: selectedPreset.color,
            bg: selectedPreset.bg
        };

        const updatedGoals = [...savingsGoals, newGoal];
        setSavingsGoals(updatedGoals);
        await saveSavingsGoalsToStorage(updatedGoals);

        // Reset inputs and close
        setNewPotName('');
        setNewPotTarget('10000');
        setShowCreatePotModal(false);
        Alert.alert('Success', `Savings Pot "${newGoal.name}" created successfully!`);
    };

    const handleCustomAmountSubmit = () => {
        const amountNum = parseInt(customAmountVal);
        if (isNaN(amountNum) || amountNum <= 0) {
            Alert.alert('Error', 'Please enter a valid amount.');
            return;
        }

        if (customAmountType === 'deposit') {
            processSavingsTransfer(customAmountGoalId, amountNum, 'deposit');
        } else {
            const goal = savingsGoals.find(g => g.id === customAmountGoalId);
            if (!goal || goal.saved < amountNum) {
                Alert.alert('Error', 'Insufficient funds in pot.');
                return;
            }
            processSavingsTransfer(customAmountGoalId, amountNum, 'withdraw');
        }

        setShowCustomAmountModal(false);
        setCustomAmountVal('');
    };

    const getTxIcon = (type, description) => {
        const desc = description?.toLowerCase() || '';
        if (type === 'topup') return { name: 'arrow-down-circle-outline', color: '#10B981', bg: '#E8F5E9' };
        if (desc.includes('checkin') || desc.includes('check-in')) return { name: 'calendar-outline', color: '#F59E0B', bg: '#FEF3C7' };
        if (desc.includes('refer') || desc.includes('voucher')) return { name: 'gift-outline', color: '#8B5CF6', bg: '#F5F3FF' };
        if (type === 'debit' || type === 'withdrawal' || type === 'payment') return { name: 'arrow-up-circle-outline', color: '#EF4444', bg: '#FEE2E2' };
        return { name: 'swap-horizontal-outline', color: '#64748B', bg: '#F1F5F9' };
    };

    const QuickAmount = ({ value }) => (
        <TouchableOpacity
            style={[localStyles.amountPill, topUpAmount === value.toString() && localStyles.activePill]}
            onPress={() => setTopUpAmount(value.toString())}
        >
            <Text style={[localStyles.pillText, topUpAmount === value.toString() && localStyles.activePillText]}>
                ₦{value.toLocaleString()}
            </Text>
        </TouchableOpacity>
    );

    // Apply Filter logic
    const filteredTransactions = transactions.filter(tx => {
        if (txFilter === 'credits') return tx.amount > 0 || tx.points_change > 0;
        if (txFilter === 'debits') return tx.amount < 0 || tx.points_change < 0;
        return true;
    });

    // Dynamic Calendar Month Spending Logic
    const totalSpentThisMonth = useMemo(() => {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        
        return transactions
            .filter(tx => {
                if (tx.amount >= 0) return false;
                const txDate = new Date(tx.created_at);
                return txDate >= startOfMonth;
            })
            .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);
    }, [transactions]);

    const budgetPercent = useMemo(() => {
        if (!monthlyLimit || monthlyLimit <= 0) return 0;
        return Math.min(Math.round((totalSpentThisMonth / monthlyLimit) * 100), 100);
    }, [totalSpentThisMonth, monthlyLimit]);

    const handleSaveBudgetLimit = async () => {
        const amt = parseInt(budgetInputVal);
        if (isNaN(amt) || amt <= 0) {
            Alert.alert('Error', 'Please enter a valid monthly budget limit.');
            return;
        }
        try {
            setMonthlyLimit(amt);
            if (user?.id) {
                const limitKey = `MONTHLY_LIMIT_${user.id}`;
                await AsyncStorage.setItem(limitKey, amt.toString());
            }
            setShowBudgetModal(false);
            setBudgetInputVal('');
            Alert.alert('Success', `Monthly spend budget limit updated to ${formatCurrency(amt)}`);
        } catch (e) {
            console.log('Error saving budget limit:', e);
            Alert.alert('Error', 'Could not save budget limit.');
        }
    };

    if (loading && !refreshing) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#0F172A" />
            </View>
        );
    }

    const amcLogo = require('../../assets/am_logo.png');
    const cardHolderName = user?.fullName || user?.full_name || user?.user_metadata?.full_name || 'Mafhal Member';

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* THIN COMPACT HEADER - ADJUSTED TOP PADDING FOR STATUS BAR CLEARANCE */}
            <View style={localStyles.header}>
                <TouchableOpacity onPress={onBack} style={localStyles.headerIconButton}>
                    <Ionicons name="arrow-back" size={18} color="#0F172A" />
                </TouchableOpacity>
                <Text style={localStyles.headerTitle}>My Wallet</Text>
                <TouchableOpacity onPress={onRefresh} style={localStyles.headerIconButton}>
                    <Ionicons name="refresh" size={16} color="#0F172A" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 30 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
            >
                {/* ADVANCED SLIM CREDIT-CARD BALANCE CARD */}
                <View style={localStyles.heroSection}>
                    <LinearGradient
                        colors={themeGradients[cardTheme] || themeGradients.midnight}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={localStyles.balanceCard}
                    >
                        {/* Decorative background shapes */}
                        <View style={localStyles.decorCircle} />
                        <View style={localStyles.decorCircle2} />

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                                    <Ionicons name="card-outline" size={11} color="rgba(255, 255, 255, 0.4)" />
                                    <Text style={localStyles.balanceLabelText}>ACCOUNT BALANCE</Text>
                                    <TouchableOpacity style={{ paddingHorizontal: 4, paddingVertical: 2 }} onPress={() => setHideBalance(!hideBalance)}>
                                        <Ionicons name={hideBalance ? "eye-off" : "eye"} size={12} color="rgba(255, 255, 255, 0.5)" />
                                    </TouchableOpacity>
                                </View>
                                <Text style={localStyles.balanceAmountText}>
                                    {hideBalance ? "₦ ••••••••" : formatCurrency(wallet.balance)}
                                </Text>
                                
                                {/* Metallic Chip Layout */}
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
                                    <View style={{
                                        width: 22,
                                        height: 16,
                                        borderRadius: 3,
                                        backgroundColor: '#E2E8F0',
                                        opacity: 0.8,
                                        position: 'relative',
                                        overflow: 'hidden'
                                    }}>
                                        <View style={{ width: 1, height: '100%', backgroundColor: '#94A3B8', position: 'absolute', left: 7 }} />
                                        <View style={{ width: 1, height: '100%', backgroundColor: '#94A3B8', position: 'absolute', left: 14 }} />
                                        <View style={{ height: 1, width: '100%', backgroundColor: '#94A3B8', position: 'absolute', top: 8 }} />
                                    </View>
                                    <Ionicons name="wifi" size={14} color="rgba(255,255,255,0.4)" style={{ transform: [{ rotate: '90deg' }] }} />
                                </View>
                            </View>

                            <View style={{ alignItems: 'flex-end', gap: 12 }}>
                                <View style={localStyles.secureBadge}>
                                    <Ionicons name="shield-checkmark" size={10} color="#10B981" />
                                    <Text style={{ color: '#10B981', fontSize: 8, fontWeight: '900', letterSpacing: 0.5 }}>SECURE GATEWAY</Text>
                                </View>
                                
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255, 255, 255, 0.06)', paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 }}>
                                    <Image source={amcLogo} style={{ width: 12, height: 12, borderRadius: 6 }} />
                                    <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '800' }}>
                                        {wallet.points.toLocaleString()} AMC
                                    </Text>
                                </View>
                            </View>
                        </View>

                        {/* Card Footer Holder Info */}
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 18 }}>
                            <View style={{ flex: 1, marginRight: 10 }}>
                                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>CARD HOLDER</Text>
                                <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', marginTop: 1 }} numberOfLines={1}>{cardHolderName}</Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                                <Text style={{ color: 'rgba(255,255,255,0.3)', fontSize: 7.5, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>EXPIRES</Text>
                                <Text style={{ color: 'white', fontSize: 11, fontWeight: '700', marginTop: 1 }}>12/30</Text>
                            </View>
                        </View>
                    </LinearGradient>

                    {/* CARD SKIN CUSTOMIZER */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}>
                        <Text style={{ fontSize: 9, fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Card Style:</Text>
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {Object.keys(themeGradients).map((theme) => {
                                const colors = themeGradients[theme];
                                return (
                                    <TouchableOpacity
                                        key={theme}
                                        onPress={() => setCardTheme(theme)}
                                        style={{
                                            width: 14,
                                            height: 14,
                                            borderRadius: 7,
                                            backgroundColor: colors[1],
                                            borderWidth: 1.5,
                                            borderColor: cardTheme === theme ? '#0F172A' : '#E2E8F0',
                                            justifyContent: 'center',
                                            alignItems: 'center'
                                        }}
                                    />
                                );
                            })}
                        </View>
                    </View>
                </View>

                {/* NEOBANK QUICK ACTIONS STRIP */}
                <View style={localStyles.actionStrip}>
                    <TouchableOpacity 
                        activeOpacity={0.7} 
                        style={localStyles.actionItem} 
                        onPress={() => setShowTopUpModal(true)}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="add" size={18} color="#3B82F6" />
                        </View>
                        <Text style={localStyles.actionLabel}>Add Cash</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        activeOpacity={0.7} 
                        style={localStyles.actionItem} 
                        onPress={() => Alert.alert('Transfer', 'Coming Soon: Secure peer-to-peer wallet transfers between Mafhal members.')}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#F5F3FF' }]}>
                            <Ionicons name="paper-plane-outline" size={16} color="#8B5CF6" />
                        </View>
                        <Text style={localStyles.actionLabel}>Transfer</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        activeOpacity={0.7} 
                        style={localStyles.actionItem} 
                        onPress={() => setShowVoucherModal(true)}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#ECFDF5' }]}>
                            <Ionicons name="gift-outline" size={16} color="#10B981" />
                        </View>
                        <Text style={localStyles.actionLabel}>Voucher</Text>
                    </TouchableOpacity>

                    <TouchableOpacity 
                        activeOpacity={0.7} 
                        style={localStyles.actionItem} 
                        onPress={() => {
                            if (onNavigate) {
                                onNavigate('support');
                            } else {
                                Alert.alert('Support', 'Contact Support Center for transaction disputes.');
                            }
                        }}
                    >
                        <View style={[localStyles.actionIconWrapper, { backgroundColor: '#FFFBEB' }]}>
                            <Ionicons name="help-circle-outline" size={18} color="#F59E0B" />
                        </View>
                        <Text style={localStyles.actionLabel}>Dispute</Text>
                    </TouchableOpacity>
                </View>

                {/* DALLY COINS CAP TRACKER WIDGET */}
                <View style={localStyles.goalContainer}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="flash" size={12} color="#F59E0B" />
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#1E293B' }}>Daily Coins Multiplier</Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#10B981', fontWeight: '800' }}>Active (1.5x Boost)</Text>
                    </View>
                    <View style={{ height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden' }}>
                        <View style={{ width: '68%', height: '100%', backgroundColor: '#F59E0B', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 9.5, color: '#94A3B8', marginTop: 4, fontWeight: '600' }}>
                        You earned 68% of today's maximum loyalty coins limit. Keep shopping to lock in more.
                    </Text>
                </View>

                {/* MONTHLY BUDGET CONTROL WIDGET */}
                <View style={[localStyles.goalContainer, { marginTop: 10 }]}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="pie-chart" size={12} color={budgetPercent > 85 ? '#EF4444' : '#3B82F6'} />
                            <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#1E293B' }}>Monthly Budget Control</Text>
                        </View>
                        <TouchableOpacity 
                            onPress={() => {
                                setBudgetInputVal(monthlyLimit.toString());
                                setShowBudgetModal(true);
                            }}
                            style={{ backgroundColor: '#F8FAFC', paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' }}
                        >
                            <Text style={{ fontSize: 9, color: '#3B82F6', fontWeight: '800' }}>Modify Limit</Text>
                        </TouchableOpacity>
                    </View>
                    <View style={{ height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, overflow: 'hidden', marginVertical: 4 }}>
                        <View style={{ width: `${budgetPercent}%`, height: '100%', backgroundColor: budgetPercent > 85 ? '#EF4444' : budgetPercent > 60 ? '#F59E0B' : '#3B82F6', borderRadius: 2 }} />
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 2 }}>
                        <Text style={{ fontSize: 9.5, color: '#94A3B8', fontWeight: '600' }}>
                            Spent {formatCurrency(totalSpentThisMonth)} of {formatCurrency(monthlyLimit)} ({budgetPercent}%)
                        </Text>
                        {budgetPercent > 85 ? (
                            <Text style={{ fontSize: 9.5, color: '#EF4444', fontWeight: '800' }}>⚠️ Near Limit</Text>
                        ) : (
                            <Text style={{ fontSize: 9.5, color: '#10B981', fontWeight: '800' }}>Safe Zone</Text>
                        )}
                    </View>
                </View>

                {/* SAVINGS GOALS SECTION (NEW PREMIUM FEATURE) */}
                <View style={localStyles.savingsContainer}>
                    <View style={localStyles.sectionHeaderSavings}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 3, height: 12, borderRadius: 1.5, backgroundColor: '#EC4899', marginRight: 5 }} />
                            <Text style={localStyles.sectionTitleText}>Savings Pots & Goals</Text>
                        </View>
                    </View>

                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false} 
                        contentContainerStyle={{ paddingLeft: 16, paddingRight: 16, gap: 10, flexDirection: 'row', alignItems: 'center' }}
                    >
                        {/* CREATE POT CARD */}
                        <TouchableOpacity 
                            activeOpacity={0.8} 
                            style={[localStyles.savingsGoalCard, { borderStyle: 'dashed', borderColor: '#EC4899', borderWidth: 1.5, justifyContent: 'center', alignItems: 'center', backgroundColor: 'transparent' }]}
                            onPress={() => setShowCreatePotModal(true)}
                        >
                            <View style={{
                                width: 32,
                                height: 32,
                                borderRadius: 16,
                                backgroundColor: '#FDF2F8',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginBottom: 6
                            }}>
                                <Ionicons name="add" size={18} color="#EC4899" />
                            </View>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#EC4899' }}>Create Pot</Text>
                            <Text style={{ fontSize: 8.5, color: '#94A3B8', marginTop: 1, fontWeight: '600' }}>Add new goal</Text>
                        </TouchableOpacity>

                        {savingsGoals.map((goal) => {
                            const pct = Math.min(Math.round((goal.saved / goal.target) * 100), 100);
                            return (
                                <TouchableOpacity 
                                    activeOpacity={0.95}
                                    key={goal.id} 
                                    style={localStyles.savingsGoalCard}
                                    onPress={() => handleSavingsPress(goal.id)}
                                >
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <View style={[localStyles.savingsIconWrapper, { backgroundColor: goal.bg }]}>
                                            <Ionicons name={goal.icon} size={15} color={goal.color} />
                                        </View>
                                        <View style={localStyles.addSavingsBtn}>
                                            <Ionicons name="chevron-forward" size={10} color="#FFFFFF" />
                                        </View>
                                    </View>
                                    <Text style={localStyles.savingsGoalName} numberOfLines={1}>{goal.name}</Text>
                                    <Text style={localStyles.savingsGoalAmount}>
                                        {formatCurrency(goal.saved)} <Text style={{ color: '#94A3B8', fontWeight: '500' }}>/ {formatCurrency(goal.target)}</Text>
                                    </Text>
                                    <View style={localStyles.progressTrack}>
                                        <View style={[localStyles.progressBar, { width: `${pct}%`, backgroundColor: goal.color }]} />
                                    </View>
                                    <Text style={[localStyles.savingsGoalPercent, { color: goal.color }]}>{pct}% Achieved</Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>
                </View>

                {/* COMPACT ACTIVITY HUB */}
                <View style={localStyles.hubContainer}>
                    <View style={localStyles.sectionHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 3, height: 12, borderRadius: 1.5, backgroundColor: '#3B82F6', marginRight: 5 }} />
                            <Text style={localStyles.sectionTitleText}>Financial Activity</Text>
                        </View>
                        <TouchableOpacity activeOpacity={0.6} onPress={onRefresh}>
                            <Text style={localStyles.viewAllLink}>Refresh</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Filter Tab Chips Row */}
                    <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                        <TouchableOpacity 
                            onPress={() => setTxFilter('all')}
                            style={[localStyles.filterChip, txFilter === 'all' && localStyles.activeFilterChip]}
                        >
                            <Text style={[localStyles.filterChipText, txFilter === 'all' && localStyles.activeFilterChipText]}>All Transactions</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setTxFilter('credits')}
                            style={[localStyles.filterChip, txFilter === 'credits' && localStyles.activeFilterChip]}
                        >
                            <Text style={[localStyles.filterChipText, txFilter === 'credits' && localStyles.activeFilterChipText]}>Credits</Text>
                        </TouchableOpacity>
                        <TouchableOpacity 
                            onPress={() => setTxFilter('debits')}
                            style={[localStyles.filterChip, txFilter === 'debits' && localStyles.activeFilterChip]}
                        >
                            <Text style={[localStyles.filterChipText, txFilter === 'debits' && localStyles.activeFilterChipText]}>Debits</Text>
                        </TouchableOpacity>
                    </View>

                    {filteredTransactions.length > 0 ? (
                        <View style={localStyles.transactionContainerCard}>
                            {filteredTransactions.map((tx, idx) => {
                                const icon = getTxIcon(tx.type, tx.description);
                                const isDebit = tx.amount < 0 || tx.points_change < 0;
                                
                                return (
                                    <View key={tx.id}>
                                        <TouchableOpacity 
                                            activeOpacity={0.7}
                                            style={localStyles.activityItem}
                                            onPress={() => setSelectedTx(tx)}
                                        >
                                            <View style={[localStyles.activityIconContainer, { backgroundColor: icon.bg }]}>
                                                <Ionicons name={icon.name} size={14} color={icon.color} />
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
                                                    { color: isDebit ? '#EF4444' : tx.points_change > 0 ? '#F59E0B' : '#10B981' }
                                                ]}>
                                                    {tx.amount !== 0 ? (
                                                        tx.amount > 0 ? `+₦${tx.amount.toLocaleString()}` : `-₦${Math.abs(tx.amount).toLocaleString()}`
                                                    ) : tx.points_change !== 0 ? (
                                                        tx.points_change > 0 ? `+${tx.points_change} AMC` : `-${Math.abs(tx.points_change)} AMC`
                                                    ) : '-'}
                                                </Text>

                                                <View style={localStyles.statusBubble}>
                                                    <View style={localStyles.statusDot} />
                                                    <Text style={localStyles.statusBubbleText}>Success</Text>
                                                </View>
                                            </View>
                                        </TouchableOpacity>
                                        {idx < filteredTransactions.length - 1 && (
                                            <View style={{ height: 1, backgroundColor: '#F8FAFC', marginLeft: 48 }} />
                                        )}
                                    </View>
                                );
                            })}
                        </View>
                    ) : (
                        <View style={localStyles.noActivityBox}>
                            <View style={localStyles.noActivityIconCircle}>
                                <Ionicons name="receipt-outline" size={20} color="#CBD5E1" />
                            </View>
                            <Text style={localStyles.noActivityTitle}>Awaiting Activity</Text>
                            <Text style={localStyles.noActivitySub}>No transactions match the selected filter query.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* TOP UP FUNDS MODAL */}
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
                                <Text style={localStyles.modalSecondaryTitle}>Select payment recharge amount</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.modalCloseCircle}
                                onPress={() => setShowTopUpModal(false)}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.inputAreaContainer}>
                            <Text style={localStyles.inputPrefix}>₦</Text>
                            <TextInput
                                style={localStyles.mainTextInput}
                                value={topUpAmount}
                                onChangeText={setTopUpAmount}
                                keyboardType="numeric"
                                placeholder="0"
                                autoFocus={true}
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <Text style={localStyles.quickSelectionLabel}>PRESET RECHARGES</Text>
                        <View style={localStyles.pillsGrid}>
                            <QuickAmount value={1000} />
                            <QuickAmount value={2500} />
                            <QuickAmount value={5000} />
                            <QuickAmount value={10000} />
                        </View>

                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, isTopUpPending && { opacity: 0.7 }]}
                            onPress={handleTopUp}
                            disabled={isTopUpPending}
                            activeOpacity={0.9}
                        >
                            {isTopUpPending ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View style={localStyles.actionBtnContent}>
                                    <Text style={localStyles.actionBtnText}>Recharge Wallet</Text>
                                    <Ionicons name="arrow-forward" size={14} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={localStyles.footerSecurityLine}>
                            <Ionicons name="lock-closed" size={10} color="#94A3B8" />
                            <Text style={localStyles.footerSecurityText}>Processed securely via Paystack Payment API</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* VOUCHER REDEEM MODAL (NEW DYNAMIC FEATURE) */}
            <Modal
                visible={showVoucherModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowVoucherModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />

                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Redeem Voucher</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Enter coin promo voucher code</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.modalCloseCircle}
                                onPress={() => setShowVoucherModal(false)}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <View style={localStyles.inputAreaContainer}>
                            <Ionicons name="gift-outline" size={18} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 18, fontWeight: '700' }]}
                                value={voucherCode}
                                onChangeText={setVoucherCode}
                                placeholder="e.g. MAFHALE500"
                                placeholderTextColor="#CBD5E1"
                                autoCapitalize="characters"
                                autoFocus={true}
                            />
                        </View>

                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, { marginTop: 20, backgroundColor: '#10B981' }, isVoucherRedeeming && { opacity: 0.7 }]}
                            onPress={handleRedeemVoucher}
                            disabled={isVoucherRedeeming}
                            activeOpacity={0.9}
                        >
                            {isVoucherRedeeming ? (
                                <ActivityIndicator color="white" />
                            ) : (
                                <View style={localStyles.actionBtnContent}>
                                    <Text style={localStyles.actionBtnText}>Redeem Code</Text>
                                    <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={localStyles.footerSecurityLine}>
                            <Ionicons name="information-circle-outline" size={12} color="#94A3B8" />
                            <Text style={localStyles.footerSecurityText}>Codes are single-use credentials only</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* TRANSACTION DETAILS RECEIPT MODAL (NEW DYNAMIC FEATURE) */}
            <Modal
                visible={selectedTx !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setSelectedTx(null)}
            >
                {selectedTx ? (
                    <View style={[localStyles.modalDimLayer, { justifyContent: 'center', padding: 24 }]}>
                        <View style={{
                            backgroundColor: 'white',
                            borderRadius: 24,
                            padding: 20,
                            width: '100%',
                            position: 'relative'
                        }}>
                            <TouchableOpacity
                                style={{ position: 'absolute', top: 16, right: 16 }}
                                onPress={() => setSelectedTx(null)}
                            >
                                <Ionicons name="close" size={20} color="#64748B" />
                            </TouchableOpacity>

                            <View style={{ alignItems: 'center', marginTop: 10 }}>
                                <View style={{
                                    width: 50,
                                    height: 50,
                                    borderRadius: 25,
                                    backgroundColor: '#E8F5E9',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 12
                                }}>
                                    <Ionicons name="checkmark-circle" size={32} color="#10B981" />
                                </View>
                                <Text style={{ fontSize: 13, fontWeight: '750', color: '#64748B', textTransform: 'uppercase' }}>Transaction Receipt</Text>
                                
                                <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', marginTop: 6 }}>
                                    {selectedTx.amount !== 0 ? (
                                        selectedTx.amount > 0 ? `+₦${selectedTx.amount.toLocaleString()}` : `-₦${Math.abs(selectedTx.amount).toLocaleString()}`
                                    ) : selectedTx.points_change !== 0 ? (
                                        selectedTx.points_change > 0 ? `+${selectedTx.points_change} AMC` : `-${Math.abs(selectedTx.points_change)} AMC`
                                    ) : '-'}
                                </Text>
                            </View>

                            {/* Receipt Details Dashed Line styling */}
                            <View style={{ borderStyle: 'dashed', borderWidth: 0.8, borderColor: '#E2E8F0', marginVertical: 18 }} />

                            <View style={{ gap: 10 }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Reference</Text>
                                    <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700' }}>
                                        #{selectedTx.id?.toString().slice(0, 12).toUpperCase() || 'TX-948194'}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Type</Text>
                                    <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700', textTransform: 'capitalize' }}>
                                        {selectedTx.type || 'payment'}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Status</Text>
                                    <Text style={{ color: '#10B981', fontSize: 12, fontWeight: '800' }}>SUCCESSFUL</Text>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Description</Text>
                                    <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700', maxWidth: 160, textAlign: 'right' }} numberOfLines={2}>
                                        {selectedTx.description || 'Wallet Top-up'}
                                    </Text>
                                </View>

                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '600' }}>Timestamp</Text>
                                    <Text style={{ color: '#1E293B', fontSize: 12, fontWeight: '700' }}>
                                        {new Date(selectedTx.created_at).toLocaleString()}
                                    </Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={{
                                    backgroundColor: '#F1F5F9',
                                    paddingVertical: 12,
                                    borderRadius: 10,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginTop: 20
                                }}
                                onPress={() => setSelectedTx(null)}
                            >
                                <Text style={{ color: '#1E293B', fontWeight: '800', fontSize: 13 }}>Close Receipt</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : null}
            </Modal>

            {/* CREATE SAVINGS POT MODAL (NEW LIVE FEATURE) */}
            <Modal
                visible={showCreatePotModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCreatePotModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />

                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Create Savings Pot</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Set up a new savings goal pot</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.modalCloseCircle}
                                onPress={() => setShowCreatePotModal(false)}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>POT NAME</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 12 }]}>
                            <Ionicons name="pricetag-outline" size={16} color="#94A3B8" style={{ marginRight: 8 }} />
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 15, fontWeight: '700' }]}
                                value={newPotName}
                                onChangeText={setNewPotName}
                                placeholder="e.g. Hajiya's Wedding, School Fees"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>TARGET AMOUNT (₦)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 16 }]}>
                            <Text style={[localStyles.inputPrefix, { fontSize: 16 }]}>₦</Text>
                            <TextInput
                                style={[localStyles.mainTextInput, { fontSize: 15, fontWeight: '700' }]}
                                value={newPotTarget}
                                onChangeText={setNewPotTarget}
                                keyboardType="numeric"
                                placeholder="10000"
                                placeholderTextColor="#CBD5E1"
                            />
                        </View>

                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>SELECT COLOR SCHEME</Text>
                        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
                            {[
                                { color: '#3B82F6', label: 'Blue' },
                                { color: '#10B981', label: 'Green' },
                                { color: '#EC4899', label: 'Pink' },
                                { color: '#F59E0B', label: 'Gold' }
                            ].map((preset) => (
                                <TouchableOpacity
                                    key={preset.color}
                                    style={{
                                        paddingHorizontal: 10,
                                        paddingVertical: 6,
                                        borderRadius: 8,
                                        backgroundColor: preset.color,
                                        borderWidth: 2,
                                        borderColor: newPotColor === preset.color ? '#000000' : 'transparent',
                                        alignItems: 'center',
                                        justifyContent: 'center'
                                    }}
                                    onPress={() => setNewPotColor(preset.color)}
                                >
                                    <Text style={{ color: 'white', fontSize: 10.5, fontWeight: '800' }}>{preset.label}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, { backgroundColor: '#EC4899' }]}
                            onPress={handleCreatePot}
                            activeOpacity={0.9}
                        >
                            <View style={localStyles.actionBtnContent}>
                                <Text style={localStyles.actionBtnText}>Create Savings Pot</Text>
                                <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* CUSTOM AMOUNT ALLOCATION MODAL (NEW LIVE FEATURE) */}
            <Modal
                visible={showCustomAmountModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowCustomAmountModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />

                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>
                                    {customAmountType === 'deposit' ? 'Add Custom Savings' : 'Withdraw Custom Savings'}
                                </Text>
                                <Text style={localStyles.modalSecondaryTitle}>
                                    {customAmountType === 'deposit' ? 'Transfer funds into savings pot' : 'Move savings back to wallet'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.modalCloseCircle}
                                onPress={() => {
                                    setShowCustomAmountModal(false);
                                    setCustomAmountVal('');
                                }}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>ENTER AMOUNT (₦)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 20 }]}>
                            <Text style={localStyles.inputPrefix}>₦</Text>
                            <TextInput
                                style={localStyles.mainTextInput}
                                value={customAmountVal}
                                onChangeText={setCustomAmountVal}
                                keyboardType="numeric"
                                placeholder="0"
                                placeholderTextColor="#CBD5E1"
                                autoFocus={true}
                            />
                        </View>

                        <TouchableOpacity
                            style={localStyles.primaryActionBtn}
                            onPress={handleCustomAmountSubmit}
                            activeOpacity={0.9}
                        >
                            <View style={localStyles.actionBtnContent}>
                                <Text style={localStyles.actionBtnText}>
                                    {customAmountType === 'deposit' ? 'Transfer to Pot' : 'Withdraw to Wallet'}
                                </Text>
                                <Ionicons name="arrow-forward" size={14} color="white" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* MONTHLY BUDGET LIMIT MODAL */}
            <Modal
                visible={showBudgetModal}
                transparent={true}
                animationType="slide"
                onRequestClose={() => setShowBudgetModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />

                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Set Monthly Spend Limit</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Define a budget threshold to control spending</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.modalCloseCircle}
                                onPress={() => {
                                    setShowBudgetModal(false);
                                    setBudgetInputVal('');
                                }}
                            >
                                <Ionicons name="close" size={18} color="#64748B" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#94A3B8', marginBottom: 6, textTransform: 'uppercase' }}>MONTHLY LIMIT (₦)</Text>
                        <View style={[localStyles.inputAreaContainer, { marginBottom: 20 }]}>
                            <Text style={localStyles.inputPrefix}>₦</Text>
                            <TextInput
                                style={localStyles.mainTextInput}
                                value={budgetInputVal}
                                onChangeText={setBudgetInputVal}
                                keyboardType="numeric"
                                placeholder={monthlyLimit.toString()}
                                placeholderTextColor="#CBD5E1"
                                autoFocus={true}
                            />
                        </View>

                        <TouchableOpacity
                            style={[localStyles.primaryActionBtn, { backgroundColor: '#3B82F6' }]}
                            onPress={handleSaveBudgetLimit}
                            activeOpacity={0.9}
                        >
                            <View style={localStyles.actionBtnContent}>
                                <Text style={localStyles.actionBtnText}>Save Budget Limit</Text>
                                <Ionicons name="checkmark-circle-outline" size={16} color="white" />
                            </View>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>

            {/* Paystack WebView Checkout */}
            <Modal visible={showPaystackWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A' }}>Secure Checkout</Text>
                        <TouchableOpacity onPress={() => {
                            setShowPaystackWebView(false);
                            setIsTopUpPending(false);
                            Alert.alert('Notice', 'Payment cancelled');
                        }}>
                            <Ionicons name="close" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                    <WebView
                        source={{ uri: checkoutUrl }}
                        onNavigationStateChange={async (navState) => {
                            if (navState.url.includes('standard.paystack.co/close') || navState.url.includes('callback') || navState.url.includes('cancel')) {
                                setShowPaystackWebView(false);
                                setIsTopUpPending(true);

                                try {
                                    const { data, error } = await supabase.functions.invoke('verify-paystack-payment', {
                                        body: {
                                            reference: currentRef,
                                            action: 'wallet_topup',
                                            amount: parseInt(topUpAmount),
                                            user_id: user.id
                                        }
                                    });

                                    if (error) throw error;
                                    if (!data?.success) throw new Error(data?.error || 'Verification failed');

                                    Alert.alert('Success', `₦${parseInt(topUpAmount).toLocaleString()} added to your wallet!`);
                                    
                                    const depositPhone = user?.phone || user?.user_metadata?.phone_number;
                                    if (depositPhone) {
                                        const depositMsg = `Your Abu Mafhal wallet has been successfully recharged with ₦${parseInt(topUpAmount).toLocaleString()}. Thank you!`;
                                        whatsappService.sendDirect(depositPhone, depositMsg, user.id)
                                            .catch(e => console.log('Wallet deposit WhatsApp Error:', e));
                                    }

                                    fetchWalletData();
                                } catch (err) {
                                    console.log('[DEBUG-PAYSTACK] Custom Post-payment error:', err);
                                    Alert.alert('Processing Notice', 'Payment window closed. If you paid, it might take a moment to reflect.');
                                } finally {
                                    setIsTopUpPending(false);
                                }
                            }
                        }}
                        startInLoadingState={true}
                        renderLoading={() => (
                            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                <ActivityIndicator size="large" color="#0F172A" />
                            </View>
                        )}
                        style={{ flex: 1 }}
                    />
                </SafeAreaView>
            </Modal>
        </SafeAreaView>
    );
};

const localStyles = StyleSheet.create({
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingTop: Platform.OS === 'android' ? 42 : 8,
        paddingBottom: 10,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderColor: '#F1F5F9'
    },
    headerIconButton: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    headerTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: 0.1
    },
    heroSection: {
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 16,
        backgroundColor: '#F8FAFC'
    },
    balanceCard: {
        borderRadius: 18,
        padding: 16,
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
        elevation: 4
    },
    decorCircle: {
        position: 'absolute',
        top: -30,
        right: -30,
        width: 100,
        height: 100,
        borderRadius: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.03)'
    },
    decorCircle2: {
        position: 'absolute',
        bottom: -20,
        left: -20,
        width: 70,
        height: 70,
        borderRadius: 35,
        backgroundColor: 'rgba(255, 255, 255, 0.02)'
    },
    balanceLabelText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 8.5,
        fontWeight: '850',
        letterSpacing: 1
    },
    balanceAmountText: {
        color: 'white',
        fontSize: 22,
        fontWeight: '900',
        marginTop: 1
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 2.5,
        borderRadius: 6,
        gap: 3,
        borderWidth: 0.5,
        borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    actionStrip: {
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'white',
        borderBottomWidth: 1,
        borderColor: '#F1F5F9'
    },
    actionItem: {
        alignItems: 'center',
        width: '22%'
    },
    actionIconWrapper: {
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3
    },
    actionLabel: {
        fontSize: 11,
        fontWeight: '700',
        color: '#475569'
    },
    goalContainer: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 12,
        backgroundColor: 'white',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    savingsContainer: {
        marginTop: 16
    },
    sectionHeaderSavings: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
        paddingHorizontal: 16
    },
    savingsGoalCard: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        width: 145,
        padding: 12,
        borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1.5 },
        shadowOpacity: 0.02,
        shadowRadius: 4,
        elevation: 1
    },
    savingsIconWrapper: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center'
    },
    addSavingsBtn: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#0F172A',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1
    },
    savingsGoalName: {
        fontSize: 11,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 1
    },
    savingsGoalAmount: {
        fontSize: 9,
        fontWeight: '700',
        color: '#475569',
        marginBottom: 6
    },
    progressTrack: {
        height: 3.5,
        backgroundColor: '#F1F5F9',
        borderRadius: 1.75,
        overflow: 'hidden',
        marginBottom: 4
    },
    progressBar: {
        height: '100%',
        borderRadius: 1.75
    },
    savingsGoalPercent: {
        fontSize: 8.5,
        fontWeight: '800'
    },
    hubContainer: {
        paddingHorizontal: 16,
        marginTop: 16
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    sectionTitleText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A'
    },
    viewAllLink: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#3B82F6'
    },
    filterChip: {
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#F1F5F9'
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
        color: 'white'
    },
    transactionContainerCard: {
        backgroundColor: 'white',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.02,
        shadowRadius: 5,
        elevation: 1
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12
    },
    activityIconContainer: {
        width: 28,
        height: 28,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10
    },
    activityTitleText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#1E293B',
        marginBottom: 1
    },
    activityTimeText: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600'
    },
    activityAmountText: {
        fontSize: 12.5,
        fontWeight: '800',
        marginBottom: 1
    },
    statusBubble: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 5,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    statusDot: {
        width: 3.5,
        height: 3.5,
        borderRadius: 1.75,
        backgroundColor: '#10B981'
    },
    statusBubbleText: {
        fontSize: 8,
        fontWeight: '800',
        color: '#047857',
        textTransform: 'uppercase'
    },
    noActivityBox: {
        alignItems: 'center',
        padding: 24,
        backgroundColor: 'white',
        borderRadius: 14,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#E2E8F0'
    },
    noActivityIconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
    },
    noActivityTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B',
        marginBottom: 3
    },
    noActivitySub: {
        fontSize: 11,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 14,
        paddingHorizontal: 12
    },
    modalDimLayer: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.5)',
        justifyContent: 'flex-end'
    },
    modalContentSheet: {
        backgroundColor: 'white',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 16,
        paddingBottom: Platform.OS === 'ios' ? 35 : 16
    },
    modalHandleBar: {
        width: 32,
        height: 4.5,
        backgroundColor: '#F1F5F9',
        borderRadius: 2.25,
        alignSelf: 'center',
        marginBottom: 12
    },
    modalHeaderSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    modalMainTitle: {
        fontSize: 16.5,
        fontWeight: '850',
        color: '#0F172A'
    },
    modalSecondaryTitle: {
        fontSize: 11.5,
        fontWeight: '600',
        color: '#94A3B8',
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
    inputAreaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    inputPrefix: {
        fontSize: 20,
        fontWeight: '800',
        color: '#0F172A',
        marginRight: 6
    },
    mainTextInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: '800',
        color: '#0F172A',
        padding: 0
    },
    quickSelectionLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 0.8,
        marginTop: 16,
        marginBottom: 8
    },
    pillsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginBottom: 20
    },
    amountPill: {
        paddingVertical: 6.5,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F1F5F9'
    },
    activePill: {
        backgroundColor: '#EFF6FF',
        borderColor: '#3B82F6'
    },
    pillText: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#64748B'
    },
    activePillText: {
        color: '#3B82F6'
    },
    primaryActionBtn: {
        backgroundColor: '#0F172A',
        paddingVertical: 12,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.1,
        shadowRadius: 5,
        elevation: 2
    },
    actionBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    actionBtnText: {
        color: 'white',
        fontSize: 13.5,
        fontWeight: '800'
    },
    footerSecurityLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
        gap: 3
    },
    footerSecurityText: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600'
    }
});

export const WalletPage = (props) => {
    const { settings } = useAppSettings();

    if (settings?.loading) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600', fontSize: 12.5 }}>Initializing Gateway...</Text>
            </View>
        );
    }
    return (
        <WalletPageInner {...props} />
    );
};
