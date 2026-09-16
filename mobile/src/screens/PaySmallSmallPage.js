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

const { width } = Dimensions.get('window');

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
    const [selectedPaymentMethod, setSelectedPaymentMethod] = useState('wallet'); // 'wallet' | 'card'
    const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

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
            try {
                const cached = await AsyncStorage.getItem(storageKey);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (Array.isArray(parsed)) setPlans(parsed);
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

            // 3. Fetch BNPL Orders from Supabase
            const { data: orders, error } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', activeUserId)
                .or('payment_method.eq.pay_small_small,payment_method.eq.Pay Small Small')
                .order('created_at', { ascending: false });

            let fetchedPlans = [];
            if (orders && orders.length > 0) {
                fetchedPlans = orders.map(order => {
                    const rawPlan = order.installment_plan || order.metadata?.installment_plan;
                    const total = Number(order.total_amount || 0);

                    // Parse plan or construct from order if structure not populated
                    let schedule = rawPlan?.schedule;
                    if (!schedule || !Array.isArray(schedule) || schedule.length === 0) {
                        const count = 3;
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

                    return {
                        id: order.id,
                        orderNumber: order.id.slice(0, 8).toUpperCase(),
                        createdAt: order.created_at,
                        totalAmount: total,
                        paidAmount,
                        remainingAmount,
                        planType: rawPlan?.plan_type || '3_months',
                        installmentsCount: schedule.length,
                        installmentsPaid: paidCount,
                        isCompleted,
                        schedule,
                        items: Array.isArray(order.items) ? order.items : []
                    };
                });
            }

            // Sync with local fallback if no live cloud orders yet
            if (fetchedPlans.length > 0) {
                setPlans(fetchedPlans);
                await AsyncStorage.setItem(storageKey, JSON.stringify(fetchedPlans));
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

    // Derived Metrics
    const activePlans = useMemo(() => plans.filter(p => !p.isCompleted), [plans]);
    const completedPlans = useMemo(() => plans.filter(p => p.isCompleted), [plans]);
    const totalOutstanding = useMemo(() => activePlans.reduce((sum, p) => sum + p.remainingAmount, 0), [activePlans]);
    
    // Find next payment due date across all active plans
    const nextDueInfo = useMemo(() => {
        let earliestDate = null;
        let nextAmount = 0;
        let planOrderNum = '';

        for (const plan of activePlans) {
            const nextInst = plan.schedule.find(s => s.status !== 'paid');
            if (nextInst) {
                const dueDate = new Date(nextInst.due_date);
                if (!earliestDate || dueDate < earliestDate) {
                    earliestDate = dueDate;
                    nextAmount = nextInst.amount;
                    planOrderNum = plan.orderNumber;
                }
            }
        }

        return earliestDate ? {
            dateStr: earliestDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
            daysRemaining: Math.ceil((earliestDate - new Date()) / (1000 * 60 * 60 * 24)),
            amount: nextAmount,
            orderNumber: planOrderNum
        } : null;
    }, [activePlans]);

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

    const handleConfirmPayment = async () => {
        if (!selectedPlan || !selectedPlan.targetInstallment) return;

        const installmentToPay = selectedPlan.targetInstallment;
        const instAmount = Number(installmentToPay.amount);

        // Wallet Balance Check
        if (selectedPaymentMethod === 'wallet' && walletBalance < instAmount) {
            Alert.alert(
                'Insufficient Wallet Balance',
                `Your wallet balance is ${formatCurrency(walletBalance)}, which is less than the required installment of ${formatCurrency(instAmount)}. Please top up your wallet or pay with card.`,
                [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Select Card Payment', onPress: () => setSelectedPaymentMethod('card') }
                ]
            );
            return;
        }

        setIsSubmittingPayment(true);
        try {
            // Update local schedule
            const updatedSchedule = selectedPlan.schedule.map(s => {
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
            const newRemaining = Math.max(0, selectedPlan.totalAmount - newPaidAmount);
            const isCompleted = newRemaining <= 0;

            const updatedPlan = {
                ...selectedPlan,
                schedule: updatedSchedule,
                paidAmount: newPaidAmount,
                remainingAmount: newRemaining,
                installmentsPaid: selectedPlan.installmentsPaid + 1,
                isCompleted
            };

            // 1. If paying via wallet, debit wallet
            if (selectedPaymentMethod === 'wallet' && user?.id) {
                const newWalletBal = Math.max(0, walletBalance - instAmount);
                await supabase.from('wallets').update({ balance: newWalletBal }).eq('user_id', user.id);
                setWalletBalance(newWalletBal);
            }

            // 2. Persist update to Supabase orders table
            if (selectedPlan.id) {
                await supabase.from('orders').update({
                    installment_plan: {
                        plan_type: selectedPlan.planType,
                        total_amount: selectedPlan.totalAmount,
                        remaining_balance: newRemaining,
                        installments_paid: updatedPlan.installmentsPaid,
                        schedule: updatedSchedule
                    },
                    payment_status: isCompleted ? 'paid' : 'installment_in_progress'
                }).eq('id', selectedPlan.id);
            }

            // 3. Update local state
            const updatedPlans = plans.map(p => p.id === selectedPlan.id ? updatedPlan : p);
            setPlans(updatedPlans);
            await AsyncStorage.setItem(storageKey, JSON.stringify(updatedPlans));

            setPaymentModalVisible(false);
            setSelectedPlan(null);

            Alert.alert(
                'Installment Received! 🎉',
                `Successfully processed ${formatCurrency(instAmount)} for Order #${selectedPlan.orderNumber}. Your BNPL ledger has been updated.`
            );
        } catch (err) {
            console.log('Error submitting installment payment:', err);
            Alert.alert('Payment Error', 'Unable to complete installment payment. Please try again.');
        } finally {
            setIsSubmittingPayment(false);
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
                                    nextDueInfo.daysRemaining <= 3 ? s.kpiNoticeUrgent : null
                                ]}>
                                    {nextDueInfo.daysRemaining > 0
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

                                        {/* Installment Milestone Timeline */}
                                        <View style={s.milestoneList}>
                                            {plan.schedule.map((inst, idx) => {
                                                const isPaid = inst.status === 'paid';
                                                const isCurrentTarget = nextPending && nextPending.installment_number === inst.installment_number;
                                                const dueDateObj = new Date(inst.due_date);
                                                const formattedDate = dueDateObj.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

                                                return (
                                                    <View key={inst.installment_number} style={s.milestoneItem}>
                                                        <View style={[
                                                            s.milestoneDot,
                                                            isPaid && s.milestoneDotPaid,
                                                            isCurrentTarget && s.milestoneDotCurrent
                                                        ]}>
                                                            {isPaid ? (
                                                                <Ionicons name="checkmark" size={11} color={WHITE} />
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
                                                                <Text style={[s.milestoneTitle, isPaid && s.milestoneTitlePaid]}>
                                                                    {inst.installment_number === 1 ? 'Down Payment (Initial)' : `Installment ${inst.installment_number}`}
                                                                </Text>
                                                                <Text style={[s.milestoneAmount, isPaid && s.milestoneAmountPaid]}>
                                                                    {formatCurrency(inst.amount)}
                                                                </Text>
                                                            </View>
                                                            <View style={s.milestoneRow}>
                                                                <Text style={s.milestoneDate}>
                                                                    {isPaid ? `Paid ✓` : `Due: ${formattedDate}`}
                                                                </Text>
                                                                <Text style={[
                                                                    s.milestoneStatus,
                                                                    isPaid ? s.statusPaid : isCurrentTarget ? s.statusCurrent : s.statusUpcoming
                                                                ]}>
                                                                    {isPaid ? 'COMPLETED' : isCurrentTarget ? 'DUE NEXT' : 'UPCOMING'}
                                                                </Text>
                                                            </View>
                                                        </View>
                                                    </View>
                                                );
                                            })}
                                        </View>

                                        {/* Action Bar */}
                                        {nextPending && (
                                            <View style={s.planActionRow}>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={s.nextDuePrompt}>Next Installment</Text>
                                                    <Text style={s.nextDuePromptVal}>
                                                        {formatCurrency(nextPending.amount)}
                                                    </Text>
                                                </View>
                                                <TouchableOpacity
                                                    style={s.payInstBtn}
                                                    onPress={() => handleOpenPayment(plan)}
                                                    activeOpacity={0.8}
                                                >
                                                    <Ionicons name="card-outline" size={15} color={WHITE} />
                                                    <Text style={s.payInstBtnTxt}>Pay Now</Text>
                                                </TouchableOpacity>
                                            </View>
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

                        <Text style={s.methodSelectTitle}>Select Payment Source</Text>

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
                                </Text>
                            </View>
                            <View style={[
                                s.methodRadio,
                                selectedPaymentMethod === 'wallet' && s.methodRadioActive
                            ]}>
                                {selectedPaymentMethod === 'wallet' && <View style={s.methodRadioDot} />}
                            </View>
                        </TouchableOpacity>

                        {/* Option 2: Card / Paystack */}
                        <TouchableOpacity
                            style={[
                                s.methodChoice,
                                selectedPaymentMethod === 'card' && s.methodChoiceActive
                            ]}
                            onPress={() => setSelectedPaymentMethod('card')}
                            activeOpacity={0.8}
                        >
                            <View style={s.methodIconCircle}>
                                <Ionicons name="card-outline" size={18} color={NAVY} />
                            </View>
                            <View style={{ flex: 1, marginLeft: 10 }}>
                                <Text style={s.methodChoiceName}>Debit Card / Instant Transfer</Text>
                                <Text style={s.methodChoiceSub}>Paystack Secure Checkout</Text>
                            </View>
                            <View style={[
                                s.methodRadio,
                                selectedPaymentMethod === 'card' && s.methodRadioActive
                            ]}>
                                {selectedPaymentMethod === 'card' && <View style={s.methodRadioDot} />}
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
                                        Confirm {formatCurrency(selectedPlan?.targetInstallment?.amount)}
                                    </Text>
                                </>
                            )}
                        </TouchableOpacity>
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
