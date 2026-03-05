import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, TextInput, ActivityIndicator, Alert, RefreshControl, StyleSheet, Modal, Platform, Image, Dimensions } from 'react-native';
import { Ionicons, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { WebView } from 'react-native-webview';
import { useAppSettings } from '../context/AppSettingsContext';

const { width } = Dimensions.get('window');

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount).replace('NGN', '₦');
};

const WalletPageInner = ({ user, onBack, normalizedKey }) => {
    const [wallet, setWallet] = useState({ balance: 0, points: 0 });
    const [transactions, setTransactions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [topUpAmount, setTopUpAmount] = useState('1000');
    const [isTopUpPending, setIsTopUpPending] = useState(false);
    const [showTopUpModal, setShowTopUpModal] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

    // [NEW] Custom Paystack Integration State
    const [showPaystackWebView, setShowPaystackWebView] = useState(false);
    const [currentRef, setCurrentRef] = useState(null);
    const [checkoutUrl, setCheckoutUrl] = useState(null);

    const { settings } = useAppSettings();

    const fetchWalletData = async () => {
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
                .limit(20);

            if (txData) setTransactions(txData);

        } catch (error) {
            console.log("Wallet Data Error:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchWalletData();
    }, []);

    const onRefresh = useCallback(async () => {
        setRefreshing(true);
        await fetchWalletData();
        setRefreshing(false);
    }, []);

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
                        reference: ref
                    }
                });

                if (error) throw error;
                if (!data?.success) throw new Error(data?.error || 'Failed to initialize payment');

                setCurrentRef(ref);
                setCheckoutUrl(data.authorization_url);
                setShowPaystackWebView(true);
            } catch (err) {
                console.error('[DEBUG-PAYSTACK] Init Error:', err);
                Alert.alert('Payment Error', 'Could not initialize payment. Please try again.');
            } finally {
                setIsTopUpPending(false);
            }
        }, 200);
    };

    const getTxIcon = (type, description) => {
        const desc = description?.toLowerCase() || '';
        if (type === 'topup') return { name: 'plus-circle', type: 'Feather', color: '#10B981', bg: '#D1FAE5' };
        if (desc.includes('checkin') || desc.includes('check-in')) return { name: 'calendar-check', type: 'FontAwesome5', color: '#3B82F6', bg: '#DBEAFE' };
        if (desc.includes('refer')) return { name: 'user-friends', type: 'FontAwesome5', color: '#8B5CF6', bg: '#EDE9FE' };
        return { name: 'swap-horizontal', type: 'MaterialCommunityIcons', color: '#6B7280', bg: '#F3F4F6' };
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

    if (loading && !refreshing) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
                <ActivityIndicator size="large" color="#0F172A" />
            </View>
        );
    }

    // Using the custom AMC logo provided by the user
    const amcLogo = require('../../assets/am_logo.png');

    return (
        <SafeAreaView style={[styles.container, { backgroundColor: '#F1F5F9' }]}>
            {/* GLASS HEADER */}
            <View style={localStyles.header}>
                <TouchableOpacity onPress={onBack} style={localStyles.headerIconButton}>
                    <Ionicons name="chevron-back" size={24} color="#1E293B" />
                </TouchableOpacity>
                <Text style={localStyles.headerTitle}>Professional Wallet</Text>
                <TouchableOpacity onPress={onRefresh} style={localStyles.headerIconButton}>
                    <MaterialCommunityIcons name="refresh" size={22} color="#1E293B" />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#0F172A" />}
            >
                {/* MODERNIZED HERO SECTION */}
                <View style={localStyles.heroSection}>
                    <View style={localStyles.balanceCard}>
                        {/* DECORATIVE CIRCLE */}
                        <View style={localStyles.decorCircle} />

                        <View style={localStyles.cardTop}>
                            <View>
                                <Text style={localStyles.balanceLabelText}>ACCOUNT BALANCE</Text>
                                <Text style={localStyles.balanceAmountText}>{formatCurrency(wallet.balance)}</Text>
                            </View>
                            <View style={localStyles.secureBadge}>
                                <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                                <Text style={localStyles.secureText}>SECURE</Text>
                            </View>
                        </View>

                        <View style={localStyles.cardDivider} />

                        <View style={localStyles.cardBottom}>
                            <View style={localStyles.coinsSection}>
                                <View style={localStyles.coinIconWrapper}>
                                    <Image
                                        source={amcLogo}
                                        style={localStyles.coinIconImage}
                                    />
                                </View>
                                <View>
                                    <Text style={localStyles.coinLabelText}>MAFHAL COINS</Text>
                                    <Text style={localStyles.coinCountText}>{wallet.points.toLocaleString()}</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={localStyles.plusButton}
                                onPress={() => setShowTopUpModal(true)}
                                activeOpacity={0.8}
                            >
                                <Text style={localStyles.plusButtonText}>Add Funds</Text>
                                <Ionicons name="add" size={18} color="white" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* ACTIVITY HUB */}
                <View style={localStyles.hubContainer}>
                    <View style={localStyles.sectionHeader}>
                        <Text style={localStyles.sectionTitleText}>Financial Activity</Text>
                        <TouchableOpacity activeOpacity={0.6}>
                            <Text style={localStyles.viewAllLink}>History Details</Text>
                        </TouchableOpacity>
                    </View>

                    {transactions.length > 0 ? (
                        transactions.map((tx) => {
                            const icon = getTxIcon(tx.type, tx.description);
                            return (
                                <View key={tx.id} style={localStyles.activityItem}>
                                    <View style={[localStyles.activityIconContainer, { backgroundColor: icon.bg }]}>
                                        {icon.type === 'Feather' && <Ionicons name="plus-circle" size={20} color={icon.color} />}
                                        {icon.type === 'FontAwesome5' && <FontAwesome5 name={icon.name} size={18} color={icon.color} />}
                                        {icon.type === 'MaterialCommunityIcons' && <MaterialCommunityIcons name={icon.name} size={22} color={icon.color} />}
                                    </View>
                                    <View style={{ flex: 1, paddingRight: 12 }}>
                                        <Text style={localStyles.activityTitleText} numberOfLines={1}>
                                            {tx.description || 'Wallet Update'}
                                        </Text>
                                        <Text style={localStyles.activityTimeText}>
                                            {new Date(tx.created_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} • {new Date(tx.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[localStyles.activityAmountText, { color: tx.amount > 0 ? '#10B981' : tx.points_change > 0 ? '#F59E0B' : '#1E293B' }]}>
                                            {tx.amount > 0 ? `+₦${tx.amount.toLocaleString()}` : tx.points_change > 0 ? `+${tx.points_change}` : '-'}
                                        </Text>
                                        <View style={localStyles.statusBubble}>
                                            <Text style={localStyles.statusBubbleText}>Success</Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })
                    ) : (
                        <View style={localStyles.noActivityBox}>
                            <View style={localStyles.noActivityIconCircle}>
                                <MaterialCommunityIcons name="clipboard-text-outline" size={36} color="#CBD5E1" />
                            </View>
                            <Text style={localStyles.noActivityTitle}>Awaiting Activity</Text>
                            <Text style={localStyles.noActivitySub}>Your recent wallet movements will be displayed here.</Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* TOP UP MODAL - ULTRAPREMIUM */}
            <Modal
                visible={showTopUpModal}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setShowTopUpModal(false)}
            >
                <View style={localStyles.modalDimLayer}>
                    <View style={localStyles.modalContentSheet}>
                        <View style={localStyles.modalHandleBar} />

                        <View style={localStyles.modalHeaderSection}>
                            <View>
                                <Text style={localStyles.modalMainTitle}>Top-up Funds</Text>
                                <Text style={localStyles.modalSecondaryTitle}>Choose an amount to add</Text>
                            </View>
                            <TouchableOpacity
                                style={localStyles.modalCloseCircle}
                                onPress={() => setShowTopUpModal(false)}
                            >
                                <Ionicons name="close" size={24} color="#64748B" />
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

                        <Text style={localStyles.quickSelectionLabel}>PRESET BUDGETS</Text>
                        <View style={localStyles.pillsGrid}>
                            <QuickAmount value={1000} />
                            <QuickAmount value={2500} />
                            <QuickAmount value={5000} />
                            <QuickAmount value={15000} />
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
                                    <Ionicons name="arrow-forward" size={18} color="white" />
                                </View>
                            )}
                        </TouchableOpacity>

                        <View style={localStyles.footerSecurityLine}>
                            <Ionicons name="lock-closed-outline" size={12} color="#94A3B8" />
                            <Text style={localStyles.footerSecurityText}>Processed securely through Paystack API</Text>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Custom Paystack WebView */}
            <Modal visible={showPaystackWebView} animationType="slide" transparent={false}>
                <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                    <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '700' }}>Secure Checkout</Text>
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
                                setIsTopUpPending(true); // Keep loading state

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
        paddingHorizontal: 20,
        paddingVertical: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0'
    },
    headerIconButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '800',
        color: '#0F172A',
        letterSpacing: -0.5
    },
    heroSection: {
        padding: 20,
        backgroundColor: '#F1F5F9'
    },
    balanceCard: {
        backgroundColor: '#0F172A', // Deep obsidian dark for premium feel
        borderRadius: 32,
        padding: 28,
        position: 'relative',
        overflow: 'hidden',
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 15
    },
    decorCircle: {
        position: 'absolute',
        top: -40,
        right: -40,
        width: 120,
        height: 120,
        borderRadius: 60,
        backgroundColor: 'rgba(255, 255, 255, 0.04)'
    },
    cardTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start'
    },
    balanceLabelText: {
        color: 'rgba(255, 255, 255, 0.4)',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 2,
        marginBottom: 8
    },
    balanceAmountText: {
        color: 'white',
        fontSize: 42,
        fontWeight: '900',
        letterSpacing: -1
    },
    secureBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.12)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        gap: 6,
        borderWidth: 0.5,
        borderColor: 'rgba(16, 185, 129, 0.2)'
    },
    secureText: {
        color: '#10B981',
        fontSize: 10,
        fontWeight: '800'
    },
    cardDivider: {
        height: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        marginVertical: 24
    },
    cardBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center'
    },
    coinsSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    coinIconWrapper: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#334155', // Slate dark
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)'
    },
    coinIconImage: {
        width: 38,
        height: 38,
        borderRadius: 19
    },
    coinLabelText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    coinCountText: {
        color: 'white',
        fontSize: 22,
        fontWeight: '900'
    },
    plusButton: {
        backgroundColor: '#3B82F6', // Brighter blue
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 18,
        paddingVertical: 12,
        borderRadius: 16,
        gap: 6
    },
    plusButtonText: {
        color: 'white',
        fontWeight: '800',
        fontSize: 14
    },
    hubContainer: {
        paddingHorizontal: 20,
        marginTop: 10
    },
    sectionHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 18
    },
    sectionTitleText: {
        fontSize: 19,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.5
    },
    viewAllLink: {
        fontSize: 13,
        fontWeight: '700',
        color: '#3B82F6'
    },
    activityItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'white',
        padding: 16,
        borderRadius: 24,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 8
    },
    activityIconContainer: {
        width: 48,
        height: 48,
        borderRadius: 18,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14
    },
    activityTitleText: {
        fontSize: 15,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 4
    },
    activityTimeText: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600',
        letterSpacing: 0.2
    },
    activityAmountText: {
        fontSize: 17,
        fontWeight: '900',
        marginBottom: 4
    },
    statusBubble: {
        backgroundColor: '#F0FDF4',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    statusBubbleText: {
        fontSize: 9,
        fontWeight: '800',
        color: '#16A34A',
        textTransform: 'uppercase'
    },
    noActivityBox: {
        alignItems: 'center',
        padding: 60,
        backgroundColor: 'white',
        borderRadius: 32,
        borderStyle: 'dashed',
        borderWidth: 1.5,
        borderColor: '#E2E8F0'
    },
    noActivityIconCircle: {
        width: 72,
        height: 72,
        borderRadius: 36,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 18
    },
    noActivityTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#64748B',
        marginBottom: 6
    },
    noActivitySub: {
        fontSize: 13,
        color: '#94A3B8',
        textAlign: 'center',
        lineHeight: 20
    },
    modalDimLayer: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.7)',
        justifyContent: 'flex-end'
    },
    modalContentSheet: {
        backgroundColor: 'white',
        borderTopLeftRadius: 42,
        borderTopRightRadius: 42,
        padding: 30,
        paddingBottom: Platform.OS === 'ios' ? 45 : 30
    },
    modalHandleBar: {
        width: 45,
        height: 6,
        backgroundColor: '#F1F5F9',
        borderRadius: 3,
        alignSelf: 'center',
        marginBottom: 25
    },
    modalHeaderSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 30
    },
    modalMainTitle: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.5
    },
    modalSecondaryTitle: {
        fontSize: 13,
        fontWeight: '600',
        color: '#94A3B8',
        marginTop: 2
    },
    modalCloseCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    inputAreaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        paddingHorizontal: 24,
        paddingVertical: 18,
        borderWidth: 1,
        borderColor: '#F1F5F9'
    },
    inputPrefix: {
        fontSize: 32,
        fontWeight: '900',
        color: '#0F172A',
        marginRight: 12
    },
    mainTextInput: {
        flex: 1,
        fontSize: 38,
        fontWeight: '900',
        color: '#0F172A',
        padding: 0
    },
    quickSelectionLabel: {
        fontSize: 11,
        fontWeight: '900',
        color: '#94A3B8',
        textTransform: 'uppercase',
        letterSpacing: 1.5,
        marginTop: 30,
        marginBottom: 16
    },
    pillsGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 12,
        marginBottom: 35
    },
    amountPill: {
        paddingVertical: 14,
        paddingHorizontal: 20,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: '#F1F5F9'
    },
    activePill: {
        backgroundColor: '#F0F9FF',
        borderColor: '#3B82F6'
    },
    pillText: {
        fontSize: 13,
        fontWeight: '800',
        color: '#64748B'
    },
    activePillText: {
        color: '#3B82F6'
    },
    primaryActionBtn: {
        backgroundColor: '#0F172A',
        paddingVertical: 20,
        borderRadius: 24,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 8,
        shadowColor: '#3B82F6',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 10
    },
    actionBtnContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10
    },
    actionBtnText: {
        color: 'white',
        fontSize: 17,
        fontWeight: '900'
    },
    footerSecurityLine: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 20,
        gap: 6
    },
    footerSecurityText: {
        fontSize: 11,
        color: '#94A3B8',
        fontWeight: '600'
    }
});

export const WalletPage = (props) => {
    const { settings } = useAppSettings();

    // Hardening: No hardcoded fallbacks. 
    // We wait for settings to load and check specifically for the key.
    const paystackKey = settings?.paystack_public_key;

    console.log('[DEBUG] WalletPage Render - Settings Loading:', settings?.loading);
    console.log('[DEBUG] WalletPage Render - Paystack Key:', paystackKey ? `${paystackKey.substring(0, 10)}...` : 'MISSING');

    if (settings?.loading) {
        return (
            <View style={[styles.container, { justifyContent: 'center', alignItems: 'center', backgroundColor: '#F1F5F9' }]}>
                <ActivityIndicator size="large" color="#0F172A" />
                <Text style={{ marginTop: 12, color: '#64748B', fontWeight: '600' }}>Initializing Gateway...</Text>
            </View>
        );
    }
    return (
        <WalletPageInner {...props} />
    );
};
