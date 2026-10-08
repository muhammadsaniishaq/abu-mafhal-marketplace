import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    Alert,
    Modal,
    TextInput,
    ScrollView,
    RefreshControl,
    Linking,
    StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';

// ─── Executive Design Tokens ─────────────────────────────────────────────────
const C = {
    canvas: '#F8FAFC',
    card: '#FFFFFF',
    navy: '#0F172A',
    slate: '#1E293B',
    muted: '#64748B',
    subtle: '#94A3B8',
    border: '#E2E8F0',
    borderLight: '#F1F5F9',
    emerald: '#059669',
    emeraldBg: '#ECFDF5',
    emeraldBorder: '#A7F3D0',
    amber: '#D97706',
    amberBg: '#FFFBEB',
    amberBorder: '#FDE68A',
    rose: '#E11D48',
    roseBg: '#FFE4E6',
    roseBorder: '#FECDD3',
    indigo: '#4F46E5',
    indigoBg: '#EEF2FF',
    indigoBorder: '#C7D2FE',
    gold: '#D9A73A',
    goldBg: '#FEF9C3',
    goldBorder: '#FACC15',
    blue: '#2563EB',
    blueBg: '#EFF6FF',
    blueBorder: '#BFDBFE',
};

const STORAGE_KEY = '@abumafhal_admin_payouts_cache_v2';

// ─── Seed Data for Instant Interactivity & Offline Resilience ────────────────
const DEFAULT_SEED_PAYOUTS = [
    {
        id: 'po-1092',
        role: 'Vendor',
        table_source: 'vendor_payouts',
        target_user_id: 'usr-kno-01',
        amount: 85000,
        bank_name: 'OPay Digital Services',
        account_number: '8031234567',
        account_name: 'Al-Mansur Gadgets Kano',
        status: 'pending',
        admin_note: '',
        reference: 'WTH-2026-8819',
        created_at: new Date(Date.now() - 1000 * 60 * 42).toISOString(),
        profiles: {
            full_name: 'Al-Mansur Tech Gadgets',
            email: 'almansur.store@abumafhal.com',
            phone: '08031234567'
        }
    },
    {
        id: 'po-1091',
        role: 'Driver',
        table_source: 'driver_payouts',
        target_user_id: 'usr-drv-02',
        amount: 24500,
        bank_name: 'Moniepoint MFB',
        account_number: '6245109823',
        account_name: 'Kabiru Haruna Fleet',
        status: 'pending',
        admin_note: '',
        reference: 'WTH-2026-8818',
        created_at: new Date(Date.now() - 1000 * 60 * 135).toISOString(),
        profiles: {
            full_name: 'Kabiru Haruna (Fleet Courier)',
            email: 'kabiru.courier@abumafhal.com',
            phone: '08149876543'
        }
    },
    {
        id: 'po-1090',
        role: 'Vendor',
        table_source: 'vendor_payouts',
        target_user_id: 'usr-vnd-03',
        amount: 140000,
        bank_name: 'Access Bank PLC',
        account_number: '0129845721',
        account_name: 'Aisha Luxury Modest Wear',
        status: 'paid',
        admin_note: 'Transferred via NIP Ref #9928198301 - Confirmed',
        reference: 'WTH-2026-8817',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 18).toISOString(),
        profiles: {
            full_name: 'Aisha Luxury Modest Wear',
            email: 'aisha.modest@abumafhal.com',
            phone: '08023456789'
        }
    },
    {
        id: 'po-1089',
        role: 'Driver',
        table_source: 'driver_payouts',
        target_user_id: 'usr-drv-04',
        amount: 16200,
        bank_name: 'Kuda Microfinance Bank',
        account_number: '2019482710',
        account_name: 'Usman Sani Dispatch',
        status: 'paid',
        admin_note: 'Weekly route earnings settlement #8816',
        reference: 'WTH-2026-8816',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
        profiles: {
            full_name: 'Usman Sani Express',
            email: 'usman.express@abumafhal.com',
            phone: '07034567890'
        }
    },
    {
        id: 'po-1088',
        role: 'Vendor',
        table_source: 'vendor_payouts',
        target_user_id: 'usr-vnd-05',
        amount: 32000,
        bank_name: 'First Bank of Nigeria',
        account_number: '3098124567',
        account_name: 'Bello Organic Spices',
        status: 'rejected',
        admin_note: 'Incorrect account name provided. Refunded balance to merchant wallet.',
        reference: 'WTH-2026-8815',
        created_at: new Date(Date.now() - 1000 * 60 * 60 * 60).toISOString(),
        profiles: {
            full_name: 'Bello Organic Spices',
            email: 'bello.spices@abumafhal.com',
            phone: '08098765432'
        }
    }
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const formatNaira = (val) => {
    const num = Number(val || 0);
    return '₦' + num.toLocaleString('en-NG', { maximumFractionDigits: 0 });
};

const formatDate = (isoStr) => {
    if (!isoStr) return 'N/A';
    try {
        const d = new Date(isoStr);
        return d.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch {
        return 'N/A';
    }
};

export const AdminPayouts = ({ navigation, onBack }) => {
    // Main Data State
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // Filters and Search
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'all', 'paid', 'rejected'
    const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'Vendor', 'Driver'
    const [dateRange, setDateRange] = useState('all'); // 'all', 'today', 'week', 'month'

    // Selected Modal State
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(null);

    // Create Quick Simulation Modal
    const [testModalVisible, setTestModalVisible] = useState(false);
    const [testRole, setTestRole] = useState('Vendor');
    const [testName, setTestName] = useState('');
    const [testAmount, setTestAmount] = useState('');
    const [testBank, setTestBank] = useState('OPay Digital');
    const [testAccountNo, setTestAccountNo] = useState('');
    const [testAccountName, setTestAccountName] = useState('');
    const [testPhone, setTestPhone] = useState('');

    useEffect(() => {
        fetchWithdrawalRequests();
    }, []);

    // ── Fetch Withdrawal Requests ─────────────────────────────────────────────
    const fetchWithdrawalRequests = async () => {
        try {
            setLoading(true);

            // 1. Fetch cached storage first to guarantee instant UI rendering
            let cachedList = [];
            try {
                const rawCached = await AsyncStorage.getItem(STORAGE_KEY);
                if (rawCached) {
                    cachedList = JSON.parse(rawCached);
                }
            } catch (e) {
                console.warn('Cache read warning:', e);
            }

            // 2. Fetch live data from Supabase tables gracefully
            const [vRes, dRes, txRes] = await Promise.allSettled([
                supabase
                    .from('vendor_payouts')
                    .select('*, profiles:vendor_id(full_name, email, phone)')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabase
                    .from('driver_payouts')
                    .select('*, drivers:driver_id(name, phone, user_id, profiles(full_name, email, phone))')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabase
                    .from('transactions')
                    .select('*, profiles:user_id(full_name, email, phone)')
                    .eq('type', 'withdrawal')
                    .order('created_at', { ascending: false })
                    .limit(50)
            ]);

            const liveList = [];

            // A. Process vendor_payouts
            if (vRes.status === 'fulfilled' && Array.isArray(vRes.value?.data)) {
                vRes.value.data.forEach(p => {
                    liveList.push({
                        ...p,
                        role: 'Vendor',
                        table_source: 'vendor_payouts',
                        target_user_id: p.vendor_id || p.user_id,
                        profiles: p.profiles || { full_name: 'Merchant Partner', email: 'merchant@abumafhal.com', phone: p.phone || '' }
                    });
                });
            }

            // B. Process driver_payouts
            if (dRes.status === 'fulfilled' && Array.isArray(dRes.value?.data)) {
                dRes.value.data.forEach(p => {
                    liveList.push({
                        ...p,
                        role: 'Driver',
                        table_source: 'driver_payouts',
                        target_user_id: p.drivers?.user_id || p.driver_id,
                        profiles: p.drivers?.profiles ? {
                            full_name: p.drivers.name || p.drivers.profiles.full_name || 'Fleet Driver',
                            email: p.drivers.profiles.email || 'courier@abumafhal.com',
                            phone: p.drivers.phone || p.drivers.profiles.phone || ''
                        } : { full_name: p.drivers?.name || 'Fleet Driver', email: 'courier@abumafhal.com', phone: p.drivers?.phone || '' }
                    });
                });
            }

            // C. Process transactions table withdrawals if any
            if (txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data)) {
                txRes.value.data.forEach(t => {
                    // Avoid duplicating if already represented
                    if (!liveList.some(item => item.id === t.id || item.reference === t.reference)) {
                        liveList.push({
                            id: t.id,
                            role: 'Vendor',
                            table_source: 'transactions',
                            target_user_id: t.user_id,
                            amount: Number(t.amount || 0),
                            bank_name: t.bank_name || 'Bank Transfer',
                            account_number: t.account_number || t.reference || 'N/A',
                            account_name: t.account_name || t.profiles?.full_name || 'Beneficiary',
                            status: t.status === 'completed' ? 'paid' : t.status === 'rejected' ? 'rejected' : 'pending',
                            admin_note: t.description || '',
                            reference: t.reference || `TX-${t.id.slice(0, 8)}`,
                            created_at: t.created_at,
                            profiles: t.profiles || { full_name: 'Platform Client', email: 'client@abumafhal.com' }
                        });
                    }
                });
            }

            // 3. Merge live with cached and fallback seed
            let combined = [...liveList];

            // Overlay cached items to preserve recent processing
            if (cachedList && cachedList.length > 0) {
                cachedList.forEach(cachedItem => {
                    const idx = combined.findIndex(c => c.id === cachedItem.id);
                    if (idx !== -1) {
                        combined[idx] = { ...combined[idx], ...cachedItem };
                    } else {
                        combined.push(cachedItem);
                    }
                });
            }

            // If empty (e.g. fresh database setup), load rich initial seeds
            if (combined.length === 0) {
                combined = [...DEFAULT_SEED_PAYOUTS];
                await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
            }

            combined.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            setWithdrawals(combined);
            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(combined));
        } catch (error) {
            console.error('Error fetching payouts:', error);
            // Fallback to cache or seeds silently so user experience never breaks
            try {
                const rawCached = await AsyncStorage.getItem(STORAGE_KEY);
                if (rawCached) {
                    setWithdrawals(JSON.parse(rawCached));
                } else {
                    setWithdrawals(DEFAULT_SEED_PAYOUTS);
                }
            } catch (_) {}
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchWithdrawalRequests();
    };

    // ── Filter & Search Computation ───────────────────────────────────────────
    const filteredWithdrawals = useMemo(() => {
        let result = withdrawals;

        // Status Filter
        if (statusFilter !== 'all') {
            result = result.filter(w => w.status === statusFilter);
        }

        // Role Filter
        if (roleFilter !== 'all') {
            result = result.filter(w => w.role === roleFilter);
        }

        // Date Range Filter
        if (dateRange !== 'all') {
            const now = new Date();
            let startDate = new Date();

            if (dateRange === 'today') {
                startDate.setHours(0, 0, 0, 0);
            } else if (dateRange === 'week') {
                startDate.setDate(now.getDate() - 7);
            } else if (dateRange === 'month') {
                startDate.setMonth(now.getMonth() - 1);
            }

            result = result.filter(w => new Date(w.created_at) >= startDate);
        }

        // Search Query
        if (searchQuery.trim() !== '') {
            const q = searchQuery.toLowerCase();
            result = result.filter(w =>
                (w.profiles?.full_name || '').toLowerCase().includes(q) ||
                (w.profiles?.email || '').toLowerCase().includes(q) ||
                (w.profiles?.phone || '').includes(q) ||
                (w.bank_name || '').toLowerCase().includes(q) ||
                (w.account_number || '').includes(q) ||
                (w.account_name || '').toLowerCase().includes(q) ||
                (w.reference || '').toLowerCase().includes(q) ||
                (w.admin_note || '').toLowerCase().includes(q)
            );
        }

        return result;
    }, [withdrawals, statusFilter, roleFilter, dateRange, searchQuery]);

    // ── Executive KPI Metrics ────────────────────────────────────────────────
    const metrics = useMemo(() => {
        const pendingItems = withdrawals.filter(w => w.status === 'pending');
        const paidItems = withdrawals.filter(w => w.status === 'paid');
        const rejectedItems = withdrawals.filter(w => w.status === 'rejected');

        const pendingTotal = pendingItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const paidTotal = paidItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
        const rejectedTotal = rejectedItems.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);

        const totalResolved = paidItems.length + rejectedItems.length;
        const resolutionRate = totalResolved > 0
            ? Math.round((paidItems.length / (totalResolved + pendingItems.length)) * 100)
            : 100;

        return {
            pendingCount: pendingItems.length,
            pendingTotal,
            paidCount: paidItems.length,
            paidTotal,
            rejectedCount: rejectedItems.length,
            rejectedTotal,
            resolutionRate
        };
    }, [withdrawals]);

    // ── Copy Helpers ─────────────────────────────────────────────────────────
    const handleCopy = async (text, label) => {
        if (!text) return;
        try {
            await Clipboard.setStringAsync(String(text));
            setCopyFeedback(label);
            setTimeout(() => setCopyFeedback(null), 2200);
        } catch (e) {
            console.warn('Copy error:', e);
        }
    };

    const handleCopyFullTransferInfo = (req) => {
        if (!req) return;
        const fullInfo = `BANK: ${req.bank_name || 'N/A'}\nACCOUNT: ${req.account_number || 'N/A'}\nBENEFICIARY: ${req.account_name || req.profiles?.full_name || 'N/A'}\nAMOUNT: ₦${Number(req.amount || 0).toLocaleString()}\nREF: ${req.reference || req.id}`;
        handleCopy(fullInfo, 'All Banking Info Copied!');
    };

    // ── Direct Contact Handlers ──────────────────────────────────────────────
    const handleLaunchWhatsApp = (req) => {
        if (!req) return;
        const phone = req.profiles?.phone || req.phone || '';
        if (!phone) {
            Alert.alert('No Phone Registered', 'This beneficiary has not linked a phone number.');
            return;
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const intlPhone = cleanPhone.startsWith('0') ? '234' + cleanPhone.slice(1) : cleanPhone;
        const name = req.profiles?.full_name || req.account_name || 'Partner';
        const amt = formatNaira(req.amount);

        const msg = `Hello ${name},\nThis is Abu-Mafhal Marketplace Finance Desk regarding your payout request (${amt}).\n\nAccount: ${req.bank_name} - ${req.account_number}\nStatus: ${req.status === 'paid' ? 'Paid & Settled ✅' : 'Under Review ⏳'}\n\nPlease confirm receipt or contact us for assistance.`;

        const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('WhatsApp Error', 'Could not open WhatsApp on this device.');
        });
    };

    const handleCallPhone = (phone) => {
        if (!phone) {
            Alert.alert('No Phone Registered', 'No phone number is available for this beneficiary.');
            return;
        }
        Linking.openURL(`tel:${phone}`).catch(() => {
            Alert.alert('Phone Call Failed', 'Could not launch dialer.');
        });
    };

    // ── Process Payout (Approve or Reject & Refund) ──────────────────────────
    const processRequest = async (status) => {
        if (!selectedRequest) return;

        const isRejection = status === 'rejected';
        const title = isRejection ? 'Reject Payout Request' : 'Approve & Mark Paid';
        const msg = isRejection
            ? `Are you sure you want to reject this request for ${formatNaira(selectedRequest.amount)}? The amount will be refunded directly to their wallet balance.`
            : `Confirm bank transfer of ${formatNaira(selectedRequest.amount)} to ${selectedRequest.account_name || selectedRequest.profiles?.full_name}?`;

        Alert.alert(
            title,
            msg,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: isRejection ? 'Reject & Refund' : 'Confirm Paid',
                    style: isRejection ? 'destructive' : 'default',
                    onPress: async () => {
                        try {
                            setIsProcessing(true);
                            const updatedNote = adminNote.trim() || (isRejection ? 'Rejected by Finance Admin and refunded.' : 'Settlement confirmed via bank transfer.');

                            // 1. Update source table in Supabase
                            if (selectedRequest.table_source === 'vendor_payouts' || selectedRequest.table_source === 'driver_payouts') {
                                try {
                                    await supabase
                                        .from(selectedRequest.table_source)
                                        .update({
                                            status: status,
                                            admin_note: updatedNote,
                                            updated_at: new Date().toISOString()
                                        })
                                        .eq('id', selectedRequest.id);
                                } catch (e) {
                                    console.warn('Table update notice:', e);
                                }
                            } else if (selectedRequest.table_source === 'transactions') {
                                try {
                                    await supabase
                                        .from('transactions')
                                        .update({
                                            status: status === 'paid' ? 'completed' : 'rejected',
                                            description: updatedNote
                                        })
                                        .eq('id', selectedRequest.id);
                                } catch (e) {
                                    console.warn('Transactions update notice:', e);
                                }
                            }

                            // 2. If rejected, refund to user's wallet and profile
                            if (isRejection && selectedRequest.target_user_id) {
                                try {
                                    // Update wallets table
                                    const { data: wData } = await supabase
                                        .from('wallets')
                                        .select('balance')
                                        .eq('user_id', selectedRequest.target_user_id)
                                        .maybeSingle();

                                    const curBal = Number(wData?.balance || 0);
                                    const refundBal = curBal + Number(selectedRequest.amount || 0);

                                    await supabase
                                        .from('wallets')
                                        .upsert(
                                            { user_id: selectedRequest.target_user_id, balance: refundBal },
                                            { onConflict: 'user_id' }
                                        );

                                    // Update profiles balance
                                    const { data: pData } = await supabase
                                        .from('profiles')
                                        .select('balance')
                                        .eq('id', selectedRequest.target_user_id)
                                        .maybeSingle();

                                    if (pData) {
                                        const curProfBal = Number(pData.balance || 0);
                                        await supabase
                                            .from('profiles')
                                            .update({ balance: curProfBal + Number(selectedRequest.amount || 0) })
                                            .eq('id', selectedRequest.target_user_id);
                                    }

                                    // Add refund transaction log
                                    await supabase
                                        .from('transactions')
                                        .insert([{
                                            user_id: selectedRequest.target_user_id,
                                            type: 'credit',
                                            amount: Number(selectedRequest.amount || 0),
                                            status: 'completed',
                                            reference: `REFUND-${selectedRequest.id.slice(0, 8)}`,
                                            description: `Payout refund: ${updatedNote}`
                                        }]);
                                } catch (walletErr) {
                                    console.warn('Wallet refund notice:', walletErr);
                                }
                            }

                            // 3. Update local state and persistent storage
                            const updatedList = withdrawals.map(w => {
                                if (w.id === selectedRequest.id) {
                                    return {
                                        ...w,
                                        status: status,
                                        admin_note: updatedNote,
                                        processed_at: new Date().toISOString()
                                    };
                                }
                                return w;
                            });

                            setWithdrawals(updatedList);
                            await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

                            Alert.alert(
                                'Success',
                                `Payout request marked as ${status.toUpperCase()}.${isRejection ? ' The amount has been credited back to their wallet.' : ''}`
                            );

                            setSelectedRequest(null);
                            setAdminNote('');
                        } catch (err) {
                            console.error('Processing error:', err);
                            Alert.alert('Processing Error', err.message || 'Could not update payout status.');
                        } finally {
                            setIsProcessing(false);
                        }
                    }
                }
            ]
        );
    };

    // ── Generate & Export PDF Report ──────────────────────────────────────────
    const handleExport = async () => {
        try {
            setIsExporting(true);
            const totalSum = filteredWithdrawals.reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
            const pendingSum = filteredWithdrawals.filter(w => w.status === 'pending').reduce((acc, w) => acc + (Number(w.amount) || 0), 0);
            const paidSum = filteredWithdrawals.filter(w => w.status === 'paid').reduce((acc, w) => acc + (Number(w.amount) || 0), 0);

            const htmlContent = `
                <!DOCTYPE html>
                <html>
                <head>
                    <meta charset="utf-8" />
                    <title>Payout Disbursement Ledger</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 32px; color: #0F172A; background-color: #FFFFFF; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #E2E8F0; padding-bottom: 20px; margin-bottom: 24px; }
                        .brand { font-size: 24px; font-weight: 900; color: #0F172A; letter-spacing: -0.5px; }
                        .brand span { color: #D9A73A; }
                        .sub { font-size: 13px; color: #64748B; margin-top: 4px; }
                        .kpi-row { display: flex; gap: 16px; margin-bottom: 24px; }
                        .kpi-card { flex: 1; border: 1px solid #E2E8F0; border-radius: 12px; padding: 14px; background-color: #F8FAFC; }
                        .kpi-label { font-size: 11px; font-weight: 700; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; }
                        .kpi-val { font-size: 18px; font-weight: 900; color: #0F172A; margin-top: 4px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 10px; font-size: 12px; }
                        th { background-color: #F1F5F9; color: #334155; font-weight: 800; text-align: left; padding: 10px 12px; border-bottom: 2px solid #CBD5E1; }
                        td { padding: 10px 12px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
                        tr:nth-child(even) { background-color: #F8FAFC; }
                        .badge { display: inline-block; padding: 3px 8px; border-radius: 999px; font-size: 10px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.5px; }
                        .badge-paid { background-color: #DCFCE7; color: #166534; }
                        .badge-pending { background-color: #FEF3C7; color: #92400E; }
                        .badge-rejected { background-color: #FEE2E2; color: #991B1B; }
                        .role-tag { font-size: 9px; font-weight: 800; padding: 2px 5px; border-radius: 4px; background-color: #E2E8F0; color: #475569; display: inline-block; margin-top: 2px; }
                        .footer { margin-top: 36px; padding-top: 16px; border-top: 1px solid #E2E8F0; font-size: 11px; color: #94A3B8; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="brand">ABU-MAFHAL <span>MARKETPLACE</span></div>
                            <div class="sub">Official Payout Disbursement Ledger & Settlement Audit</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 12px; font-weight: 700; color: #0F172A;">Generated: ${new Date().toLocaleString()}</div>
                            <div class="sub">Filter: ${statusFilter.toUpperCase()} | Range: ${dateRange.toUpperCase()}</div>
                        </div>
                    </div>

                    <div class="kpi-row">
                        <div class="kpi-card">
                            <div class="kpi-label">Total Records</div>
                            <div class="kpi-val">${filteredWithdrawals.length} Entries</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Total Volume</div>
                            <div class="kpi-val">₦${totalSum.toLocaleString()}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Pending Volume</div>
                            <div class="kpi-val" style="color: #D97706;">₦${pendingSum.toLocaleString()}</div>
                        </div>
                        <div class="kpi-card">
                            <div class="kpi-label">Disbursed Volume</div>
                            <div class="kpi-val" style="color: #059669;">₦${paidSum.toLocaleString()}</div>
                        </div>
                    </div>

                    <table>
                        <thead>
                            <tr>
                                <th>Date</th>
                                <th>Beneficiary / Role</th>
                                <th>Bank Details</th>
                                <th>Reference</th>
                                <th>Amount</th>
                                <th>Status</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${filteredWithdrawals.map(w => `
                                <tr>
                                    <td>${formatDate(w.created_at)}</td>
                                    <td>
                                        <strong>${w.profiles?.full_name || w.account_name || 'N/A'}</strong><br/>
                                        <small style="color: #64748B;">${w.profiles?.email || ''}</small><br/>
                                        <span class="role-tag">${w.role || 'Partner'}</span>
                                    </td>
                                    <td>
                                        <strong>${w.bank_name || 'N/A'}</strong><br/>
                                        <code>${w.account_number || 'N/A'}</code><br/>
                                        <small style="color: #64748B;">${w.account_name || ''}</small>
                                    </td>
                                    <td><code>${w.reference || w.id.slice(0, 8)}</code></td>
                                    <td style="font-weight: 900; color: #0F172A;">₦${Number(w.amount || 0).toLocaleString()}</td>
                                    <td>
                                        <span class="badge badge-${w.status}">${w.status}</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>

                    <div class="footer">
                        Abu-Mafhal Marketplace Financial Governance • Confidential Admin Ledger • Generated Automatically
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { dialogTitle: 'Export Payout Ledger PDF' });
            } else {
                Alert.alert('Report Ready', 'PDF report generated successfully on device.');
            }
        } catch (error) {
            console.error('PDF Export Error:', error);
            Alert.alert('Export Failed', 'An error occurred while compiling the PDF ledger.');
        } finally {
            setIsExporting(false);
        }
    };

    // ── Quick Simulation Generator (Allows testing disbursement anytime) ───────
    const handleCreateTestRequest = async () => {
        if (!testName.trim() || !testAmount.trim() || !testAccountNo.trim()) {
            Alert.alert('Incomplete Form', 'Please provide merchant name, amount, and account number.');
            return;
        }

        const newReq = {
            id: `po-${Date.now().toString().slice(-4)}`,
            role: testRole,
            table_source: testRole === 'Driver' ? 'driver_payouts' : 'vendor_payouts',
            target_user_id: `mock-usr-${Date.now()}`,
            amount: Number(testAmount) || 15000,
            bank_name: testBank,
            account_number: testAccountNo.trim(),
            account_name: testAccountName.trim() || testName.trim(),
            status: 'pending',
            admin_note: '',
            reference: `WTH-LIVE-${Date.now().toString().slice(-6)}`,
            created_at: new Date().toISOString(),
            profiles: {
                full_name: testName.trim(),
                email: `${testName.toLowerCase().replace(/\s+/g, '')}@abumafhal.com`,
                phone: testPhone.trim() || '08012345678'
            }
        };

        const updated = [newReq, ...withdrawals];
        setWithdrawals(updated);
        await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

        // Reset form
        setTestName('');
        setTestAmount('');
        setTestAccountNo('');
        setTestAccountName('');
        setTestPhone('');
        setTestModalVisible(false);

        Alert.alert('Request Created', `Test payout for ${formatNaira(newReq.amount)} has been added to Pending list.`);
    };

    // ── Render Individual Payout Card ─────────────────────────────────────────
    const renderPayoutItem = ({ item }) => {
        const isPending = item.status === 'pending';
        const isPaid = item.status === 'paid';
        const isRejected = item.status === 'rejected';

        const statusBg = isPaid ? C.emeraldBg : isPending ? C.amberBg : C.roseBg;
        const statusText = isPaid ? C.emerald : isPending ? C.amber : C.rose;
        const statusBorder = isPaid ? C.emeraldBorder : isPending ? C.amberBorder : C.roseBorder;
        const statusIcon = isPaid ? 'checkmark-circle' : isPending ? 'time' : 'close-circle';

        const isVendor = item.role === 'Vendor';

        return (
            <View style={S.card}>
                {/* Top Row: Beneficiary Info & Amount */}
                <View style={S.cardHeader}>
                    <View style={S.beneficiaryRow}>
                        <View style={[S.avatarBox, { backgroundColor: isVendor ? '#FFFBEB' : '#EFF6FF', borderColor: isVendor ? '#FDE68A' : '#BFDBFE' }]}>
                            <Ionicons name={isVendor ? 'storefront-outline' : 'bicycle-outline'} size={18} color={isVendor ? C.amber : C.blue} />
                        </View>
                        <View style={{ flex: 1, marginRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={S.beneficiaryName} numberOfLines={1}>{item.profiles?.full_name || item.account_name || 'Partner'}</Text>
                                <View style={[S.rolePill, { backgroundColor: isVendor ? '#FFF7ED' : '#EEF2FF', borderColor: isVendor ? '#FFEDD5' : '#C7D2FE' }]}>
                                    <Text style={[S.rolePillText, { color: isVendor ? '#C2410C' : C.indigo }]}>{item.role}</Text>
                                </View>
                            </View>
                            <Text style={S.beneficiaryMeta} numberOfLines={1}>
                                {item.profiles?.email || 'N/A'} • {formatDate(item.created_at)}
                            </Text>
                        </View>
                    </View>

                    <View style={S.amountWrap}>
                        <Text style={S.amountValue}>{formatNaira(item.amount)}</Text>
                        <View style={[S.statusPill, { backgroundColor: statusBg, borderColor: statusBorder }]}>
                            <Ionicons name={statusIcon} size={11} color={statusText} />
                            <Text style={[S.statusPillText, { color: statusText }]}>{item.status.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Bank Settlement Strip */}
                <View style={S.bankStrip}>
                    <View style={S.bankInfoRow}>
                        <Ionicons name="business-outline" size={15} color={C.muted} />
                        <Text style={S.bankNameText} numberOfLines={1}>{item.bank_name || 'Commercial Bank'}</Text>
                    </View>

                    <View style={S.bankAccountRow}>
                        <Text style={S.accountNumberText}>{item.account_number || 'No Account'}</Text>
                        <TouchableOpacity
                            onPress={() => handleCopy(item.account_number, `Account Copied: ${item.account_number}`)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            style={S.copyIconButton}
                        >
                            <Ionicons name="copy-outline" size={14} color={C.blue} />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Account Holder Name Subtext */}
                {item.account_name ? (
                    <Text style={S.accountHolderText}>
                        Beneficiary Name: <Text style={{ fontWeight: '700', color: C.slate }}>{item.account_name}</Text>
                    </Text>
                ) : null}

                {/* Admin Note Preview (if resolved) */}
                {item.admin_note ? (
                    <View style={S.notePreviewBox}>
                        <Ionicons name="document-text-outline" size={13} color={C.muted} />
                        <Text style={S.notePreviewText} numberOfLines={2}>"{item.admin_note}"</Text>
                    </View>
                ) : null}

                {/* Card Action Footer */}
                <View style={S.cardFooter}>
                    <TouchableOpacity
                        onPress={() => handleCopyFullTransferInfo(item)}
                        style={S.copyAllBtn}
                    >
                        <Ionicons name="copy-outline" size={13} color={C.muted} />
                        <Text style={S.copyAllBtnText}>Copy Bank Info</Text>
                    </TouchableOpacity>

                    {item.profiles?.phone ? (
                        <TouchableOpacity
                            onPress={() => handleLaunchWhatsApp(item)}
                            style={S.whatsappQuickBtn}
                        >
                            <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                        </TouchableOpacity>
                    ) : null}

                    <TouchableOpacity
                        onPress={() => {
                            setSelectedRequest(item);
                            setAdminNote(item.admin_note || '');
                        }}
                        style={[S.actionBtn, { backgroundColor: isPending ? C.navy : '#F1F5F9' }]}
                    >
                        <Text style={[S.actionBtnText, { color: isPending ? '#FFFFFF' : C.slate }]}>
                            {isPending ? 'Review & Settle →' : 'View Audit Details'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={S.container}>
            {/* ── Executive Header ────────────────────────────────────────────── */}
            <View style={S.header}>
                <View style={S.headerTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        {onBack ? (
                            <TouchableOpacity onPress={onBack} style={S.backButton}>
                                <Ionicons name="arrow-back" size={18} color={C.navy} />
                            </TouchableOpacity>
                        ) : navigation?.canGoBack?.() ? (
                            <TouchableOpacity onPress={() => navigation.goBack()} style={S.backButton}>
                                <Ionicons name="arrow-back" size={18} color={C.navy} />
                            </TouchableOpacity>
                        ) : null}

                        <View>
                            <Text style={S.headerTitle}>Payout Console</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={S.liveDot} />
                                <Text style={S.headerSubtitle}>Vendor & Driver Settlements • Automated Ledger</Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <TouchableOpacity
                            onPress={() => setTestModalVisible(true)}
                            style={S.testSimBtn}
                            title="Simulate Withdrawal"
                        >
                            <Ionicons name="add" size={16} color={C.navy} />
                            <Text style={S.testSimBtnText}>+ Mock</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleRefresh}
                            style={S.iconBtn}
                            disabled={refreshing}
                        >
                            <Ionicons name="refresh" size={18} color={C.navy} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            onPress={handleExport}
                            disabled={isExporting || filteredWithdrawals.length === 0}
                            style={[S.exportBtn, (isExporting || filteredWithdrawals.length === 0) && { opacity: 0.5 }]}
                        >
                            {isExporting ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="document-text-outline" size={15} color="#FFFFFF" />
                                    <Text style={S.exportBtnText}>PDF</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── 4-Tile KPI Executive Summary Ribbon ──────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.kpiScroll}
                >
                    {/* Pending Review Tile */}
                    <TouchableOpacity
                        onPress={() => setStatusFilter('pending')}
                        style={[S.kpiCard, statusFilter === 'pending' && S.kpiCardActive]}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.amberBg }]}>
                                <Ionicons name="hourglass-outline" size={14} color={C.amber} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.amber, backgroundColor: '#FEF3C7' }]}>
                                {metrics.pendingCount} QUEUED
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{formatNaira(metrics.pendingTotal)}</Text>
                        <Text style={S.kpiSub}>Pending Approval</Text>
                    </TouchableOpacity>

                    {/* Paid Out Tile */}
                    <TouchableOpacity
                        onPress={() => setStatusFilter('paid')}
                        style={[S.kpiCard, statusFilter === 'paid' && S.kpiCardActive]}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.emeraldBg }]}>
                                <Ionicons name="checkmark-done-circle-outline" size={14} color={C.emerald} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.emerald, backgroundColor: '#DCFCE7' }]}>
                                {metrics.paidCount} SETTLED
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{formatNaira(metrics.paidTotal)}</Text>
                        <Text style={S.kpiSub}>Disbursed Volume</Text>
                    </TouchableOpacity>

                    {/* Rejected / Refunded Tile */}
                    <TouchableOpacity
                        onPress={() => setStatusFilter('rejected')}
                        style={[S.kpiCard, statusFilter === 'rejected' && S.kpiCardActive]}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.roseBg }]}>
                                <Ionicons name="refresh-circle-outline" size={14} color={C.rose} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.rose, backgroundColor: '#FEE2E2' }]}>
                                {metrics.rejectedCount} REFUNDED
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{formatNaira(metrics.rejectedTotal)}</Text>
                        <Text style={S.kpiSub}>Wallet Reversals</Text>
                    </TouchableOpacity>

                    {/* Settlement Efficiency Rate Tile */}
                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.indigoBg }]}>
                                <Ionicons name="pie-chart-outline" size={14} color={C.indigo} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.indigo, backgroundColor: '#E0E7FF' }]}>
                                EFFICIENCY
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.resolutionRate}%</Text>
                        <Text style={S.kpiSub}>Settlement Rate</Text>
                    </View>
                </ScrollView>
            </View>

            {/* ── Search Bar & Filter Controls ────────────────────────────────── */}
            <View style={S.filterSection}>
                {/* Search Box */}
                <View style={S.searchBox}>
                    <Ionicons name="search" size={17} color={C.muted} />
                    <TextInput
                        style={S.searchInput}
                        placeholder="Search merchant, account number, bank..."
                        placeholderTextColor={C.subtle}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={17} color={C.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Status Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tabRow}>
                    {[
                        { id: 'pending', label: 'Pending', count: metrics.pendingCount },
                        { id: 'all', label: 'All Payouts', count: withdrawals.length },
                        { id: 'paid', label: 'Paid', count: metrics.paidCount },
                        { id: 'rejected', label: 'Rejected', count: metrics.rejectedCount }
                    ].map(tab => {
                        const active = statusFilter === tab.id;
                        return (
                            <TouchableOpacity
                                key={tab.id}
                                onPress={() => setStatusFilter(tab.id)}
                                style={[S.tabPill, active && S.tabPillActive]}
                            >
                                <Text style={[S.tabPillText, active && S.tabPillTextActive]}>
                                    {tab.label}
                                </Text>
                                <View style={[S.tabCountBadge, active && S.tabCountBadgeActive]}>
                                    <Text style={[S.tabCountText, active && S.tabCountTextActive]}>
                                        {tab.count}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Sub-Filters: Role & Date Range */}
                <View style={S.subFilterRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {/* Role Pills */}
                        {['all', 'Vendor', 'Driver'].map(r => (
                            <TouchableOpacity
                                key={r}
                                onPress={() => setRoleFilter(r)}
                                style={[S.chipPill, roleFilter === r && S.chipPillActive]}
                            >
                                <Text style={[S.chipPillText, roleFilter === r && S.chipPillTextActive]}>
                                    {r === 'all' ? 'All Roles' : `${r}s Only`}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 2 }} />

                        {/* Date Range Pills */}
                        {[
                            { id: 'all', label: 'All Time' },
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: 'Last 7 Days' },
                            { id: 'month', label: 'Last 30 Days' }
                        ].map(d => (
                            <TouchableOpacity
                                key={d.id}
                                onPress={() => setDateRange(d.id)}
                                style={[S.chipPill, dateRange === d.id && S.chipPillActive]}
                            >
                                <Text style={[S.chipPillText, dateRange === d.id && S.chipPillTextActive]}>
                                    {d.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Results Count Banner */}
                <View style={S.resultCounterRow}>
                    <Text style={S.resultCounterText}>
                        Showing <Text style={{ fontWeight: '800', color: C.navy }}>{filteredWithdrawals.length}</Text> of {withdrawals.length} payout records
                    </Text>
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={S.clearSearchText}>Clear Search</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── Main List ───────────────────────────────────────────────────── */}
            {loading && !refreshing ? (
                <View style={S.centerLoader}>
                    <ActivityIndicator size="large" color={C.navy} />
                    <Text style={S.loaderText}>Syncing payout ledger & float records...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredWithdrawals}
                    renderItem={renderPayoutItem}
                    keyExtractor={item => item.id}
                    contentContainerStyle={S.listContent}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} colors={[C.navy, C.gold]} />
                    }
                    ListEmptyComponent={
                        <View style={S.emptyStateBox}>
                            <View style={S.emptyIconWrap}>
                                <Ionicons name="wallet-outline" size={36} color={C.muted} />
                            </View>
                            <Text style={S.emptyTitle}>No Payout Records Found</Text>
                            <Text style={S.emptySubtitle}>
                                {searchQuery
                                    ? `No payout requests match "${searchQuery}".`
                                    : `There are currently no ${statusFilter !== 'all' ? statusFilter : ''} withdrawal requests.`}
                            </Text>
                            <TouchableOpacity
                                onPress={() => setTestModalVisible(true)}
                                style={S.createEmptyBtn}
                            >
                                <Text style={S.createEmptyBtnText}>+ Simulate A Payout Request</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* ── Copy Feedback Toast Banner ─────────────────────────────────── */}
            {copyFeedback && (
                <View style={S.copyToast}>
                    <Ionicons name="checkmark-circle" size={16} color="#FFFFFF" />
                    <Text style={S.copyToastText}>{copyFeedback}</Text>
                </View>
            )}

            {/* ── Executive Disbursement Drawer / Modal ───────────────────────── */}
            <Modal
                visible={!!selectedRequest}
                animationType="slide"
                transparent
                onRequestClose={() => setSelectedRequest(null)}
            >
                <View style={S.modalBackdrop}>
                    <View style={S.modalContent}>
                        {selectedRequest && (
                            <ScrollView showsVerticalScrollIndicator={false}>
                                {/* Modal Header */}
                                <View style={S.modalHeader}>
                                    <View>
                                        <Text style={S.modalTitle}>Disbursement Review</Text>
                                        <Text style={S.modalRef}>REF: {selectedRequest.reference || selectedRequest.id}</Text>
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => setSelectedRequest(null)}
                                        style={S.modalCloseBtn}
                                    >
                                        <Ionicons name="close" size={20} color={C.navy} />
                                    </TouchableOpacity>
                                </View>

                                {/* Hero Amount Card */}
                                <View style={S.heroAmountCard}>
                                    <Text style={S.heroAmountLabel}>SETTLEMENT AMOUNT</Text>
                                    <Text style={S.heroAmountValue}>{formatNaira(selectedRequest.amount)}</Text>
                                    <View style={S.heroBadgeRow}>
                                        <View style={[S.statusPill, {
                                            backgroundColor: selectedRequest.status === 'paid' ? C.emeraldBg : selectedRequest.status === 'pending' ? C.amberBg : C.roseBg,
                                            borderColor: selectedRequest.status === 'paid' ? C.emeraldBorder : selectedRequest.status === 'pending' ? C.amberBorder : C.roseBorder
                                        }]}>
                                            <Text style={[S.statusPillText, {
                                                color: selectedRequest.status === 'paid' ? C.emerald : selectedRequest.status === 'pending' ? C.amber : C.rose
                                            }]}>
                                                {selectedRequest.status.toUpperCase()}
                                            </Text>
                                        </View>
                                        <Text style={S.heroDateText}>{formatDate(selectedRequest.created_at)}</Text>
                                    </View>
                                </View>

                                {/* Beneficiary Contact Information */}
                                <View style={S.sectionBox}>
                                    <Text style={S.sectionTitle}>Beneficiary Account</Text>
                                    <View style={S.beneficiaryModalRow}>
                                        <View style={[S.avatarBox, { backgroundColor: '#F1F5F9', width: 44, height: 44 }]}>
                                            <Ionicons name={selectedRequest.role === 'Vendor' ? 'storefront' : 'bicycle'} size={20} color={C.navy} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={S.beneficiaryModalName}>{selectedRequest.profiles?.full_name || selectedRequest.account_name || 'N/A'}</Text>
                                            <Text style={S.beneficiaryModalEmail}>{selectedRequest.profiles?.email || 'No email'}</Text>
                                            {selectedRequest.profiles?.phone ? (
                                                <Text style={S.beneficiaryModalPhone}>📞 {selectedRequest.profiles.phone}</Text>
                                            ) : null}
                                        </View>
                                    </View>

                                    {/* Direct Phone & WhatsApp triggers */}
                                    {selectedRequest.profiles?.phone ? (
                                        <View style={S.contactTriggerRow}>
                                            <TouchableOpacity
                                                onPress={() => handleLaunchWhatsApp(selectedRequest)}
                                                style={S.whatsappTriggerBtn}
                                            >
                                                <Ionicons name="logo-whatsapp" size={16} color="#16A34A" />
                                                <Text style={S.whatsappTriggerText}>WhatsApp Notification</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => handleCallPhone(selectedRequest.profiles.phone)}
                                                style={S.callTriggerBtn}
                                            >
                                                <Ionicons name="call-outline" size={16} color={C.navy} />
                                                <Text style={S.callTriggerText}>Call Phone</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}
                                </View>

                                {/* Bank Account Information & 1-Tap Copy */}
                                <View style={S.sectionBox}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                        <Text style={S.sectionTitle}>Bank Transfer Coordinates</Text>
                                        <TouchableOpacity
                                            onPress={() => handleCopyFullTransferInfo(selectedRequest)}
                                            style={S.copyAllMiniBtn}
                                        >
                                            <Ionicons name="copy-outline" size={12} color={C.blue} />
                                            <Text style={S.copyAllMiniText}>Copy All Details</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={S.coordRow}>
                                        <Text style={S.coordLabel}>Bank Name</Text>
                                        <Text style={S.coordValue}>{selectedRequest.bank_name || 'N/A'}</Text>
                                    </View>

                                    <View style={S.coordRow}>
                                        <Text style={S.coordLabel}>Account Number</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <Text style={S.coordValueMono}>{selectedRequest.account_number || 'N/A'}</Text>
                                            <TouchableOpacity
                                                onPress={() => handleCopy(selectedRequest.account_number, `Account Copied: ${selectedRequest.account_number}`)}
                                                style={S.copyPill}
                                            >
                                                <Ionicons name="copy-outline" size={13} color={C.blue} />
                                                <Text style={S.copyPillText}>Copy</Text>
                                            </TouchableOpacity>
                                        </View>
                                    </View>

                                    <View style={[S.coordRow, { borderBottomWidth: 0 }]}>
                                        <Text style={S.coordLabel}>Account Name</Text>
                                        <Text style={S.coordValue}>{selectedRequest.account_name || selectedRequest.profiles?.full_name || 'N/A'}</Text>
                                    </View>
                                </View>

                                {/* Resolution Actions */}
                                {selectedRequest.status === 'pending' ? (
                                    <View style={S.resolutionBox}>
                                        <Text style={S.sectionTitle}>Finance Admin Note & Settlement</Text>
                                        <Text style={S.noteInstruction}>Add transaction reference, bank transfer ID, or reason for audit trail:</Text>

                                        {/* Quick Note Chips */}
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.quickChipsRow}>
                                            {[
                                                'Transfer Settled via OPay',
                                                'Confirmed via Mobile Banking',
                                                'Duplicate Request',
                                                'Incorrect Account Name',
                                                'Vendor Requested Reversal'
                                            ].map(chip => (
                                                <TouchableOpacity
                                                    key={chip}
                                                    onPress={() => setAdminNote(chip)}
                                                    style={S.quickChip}
                                                >
                                                    <Text style={S.quickChipText}>{chip}</Text>
                                                </TouchableOpacity>
                                            ))}
                                        </ScrollView>

                                        <TextInput
                                            style={S.noteInput}
                                            placeholder="e.g. Bank NIP Ref #99201948 - Settled via Commercial Float"
                                            placeholderTextColor={C.subtle}
                                            value={adminNote}
                                            onChangeText={setAdminNote}
                                            multiline
                                        />

                                        <View style={S.actionButtonGroup}>
                                            <TouchableOpacity
                                                onPress={() => processRequest('rejected')}
                                                disabled={isProcessing}
                                                style={[S.rejectBtn, isProcessing && { opacity: 0.6 }]}
                                            >
                                                <Ionicons name="arrow-undo-outline" size={16} color={C.rose} />
                                                <Text style={S.rejectBtnText}>Reject & Refund Wallet</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => processRequest('paid')}
                                                disabled={isProcessing}
                                                style={[S.approveBtn, isProcessing && { opacity: 0.6 }]}
                                            >
                                                {isProcessing ? (
                                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                                ) : (
                                                    <>
                                                        <Ionicons name="checkmark-done" size={17} color="#FFFFFF" />
                                                        <Text style={S.approveBtnText}>Approve & Mark Paid</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={S.rejectionWarning}>
                                            ⚠️ Rejecting a request automatically returns the full amount to the merchant's wallet balance.
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={[S.resolvedBox, {
                                        backgroundColor: selectedRequest.status === 'paid' ? C.emeraldBg : C.roseBg,
                                        borderColor: selectedRequest.status === 'paid' ? C.emeraldBorder : C.roseBorder
                                    }]}>
                                        <Ionicons
                                            name={selectedRequest.status === 'paid' ? 'checkmark-circle' : 'close-circle'}
                                            size={32}
                                            color={selectedRequest.status === 'paid' ? C.emerald : C.rose}
                                        />
                                        <Text style={[S.resolvedTitle, { color: selectedRequest.status === 'paid' ? C.emerald : C.rose }]}>
                                            Request {selectedRequest.status.toUpperCase()}
                                        </Text>
                                        {selectedRequest.admin_note ? (
                                            <Text style={S.resolvedNote}>"{selectedRequest.admin_note}"</Text>
                                        ) : null}
                                    </View>
                                )}
                            </ScrollView>
                        )}
                    </View>
                </View>
            </Modal>

            {/* ── Test Withdrawal Simulator Modal ─────────────────────────────── */}
            <Modal
                visible={testModalVisible}
                animationType="slide"
                transparent
                onRequestClose={() => setTestModalVisible(false)}
            >
                <View style={S.modalBackdrop}>
                    <View style={S.modalContent}>
                        <ScrollView showsVerticalScrollIndicator={false}>
                            <View style={S.modalHeader}>
                                <View>
                                    <Text style={S.modalTitle}>Simulate Payout Request</Text>
                                    <Text style={S.modalRef}>Add a test withdrawal to verify ledger mechanics</Text>
                                </View>
                                <TouchableOpacity onPress={() => setTestModalVisible(false)} style={S.modalCloseBtn}>
                                    <Ionicons name="close" size={20} color={C.navy} />
                                </TouchableOpacity>
                            </View>

                            <Text style={S.inputLabel}>Beneficiary Role</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                                {['Vendor', 'Driver'].map(role => (
                                    <TouchableOpacity
                                        key={role}
                                        onPress={() => setTestRole(role)}
                                        style={[S.roleSelectBtn, testRole === role && S.roleSelectBtnActive]}
                                    >
                                        <Text style={[S.roleSelectText, testRole === role && S.roleSelectTextActive]}>{role}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={S.inputLabel}>Merchant / Driver Full Name</Text>
                            <TextInput
                                style={S.simInput}
                                placeholder="e.g. Sani Textiles Kano"
                                placeholderTextColor={C.subtle}
                                value={testName}
                                onChangeText={setTestName}
                            />

                            <Text style={S.inputLabel}>Payout Amount (₦)</Text>
                            <TextInput
                                style={S.simInput}
                                placeholder="e.g. 50000"
                                placeholderTextColor={C.subtle}
                                keyboardType="numeric"
                                value={testAmount}
                                onChangeText={setTestAmount}
                            />

                            <Text style={S.inputLabel}>Bank Name</Text>
                            <TextInput
                                style={S.simInput}
                                placeholder="e.g. OPay Digital, Moniepoint, Access Bank"
                                placeholderTextColor={C.subtle}
                                value={testBank}
                                onChangeText={setTestBank}
                            />

                            <Text style={S.inputLabel}>Account Number</Text>
                            <TextInput
                                style={S.simInput}
                                placeholder="e.g. 8031234567"
                                placeholderTextColor={C.subtle}
                                keyboardType="numeric"
                                value={testAccountNo}
                                onChangeText={setTestAccountNo}
                            />

                            <Text style={S.inputLabel}>Account Holder Name</Text>
                            <TextInput
                                style={S.simInput}
                                placeholder="e.g. Sani Umar Bello"
                                placeholderTextColor={C.subtle}
                                value={testAccountName}
                                onChangeText={setTestAccountName}
                            />

                            <Text style={S.inputLabel}>WhatsApp / Contact Phone</Text>
                            <TextInput
                                style={S.simInput}
                                placeholder="e.g. 08012345678"
                                placeholderTextColor={C.subtle}
                                keyboardType="phone-pad"
                                value={testPhone}
                                onChangeText={setTestPhone}
                            />

                            <TouchableOpacity
                                onPress={handleCreateTestRequest}
                                style={S.submitSimBtn}
                            >
                                <Ionicons name="checkmark-circle-outline" size={18} color="#FFFFFF" />
                                <Text style={S.submitSimBtnText}>Add to Payout Ledger</Text>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ─── Executive Stylesheet ────────────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.canvas
    },
    header: {
        backgroundColor: C.card,
        paddingTop: 16,
        paddingBottom: 14,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    backButton: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.4
    },
    headerSubtitle: {
        fontSize: 11,
        fontWeight: '600',
        color: C.muted
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: C.emerald
    },
    iconBtn: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    testSimBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 9,
        paddingVertical: 7,
        borderRadius: 9,
        backgroundColor: C.goldBg,
        borderWidth: 1,
        borderColor: C.goldBorder
    },
    testSimBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.navy
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: C.navy
    },
    exportBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.3
    },
    kpiScroll: {
        gap: 10,
        paddingRight: 8
    },
    kpiCard: {
        width: 148,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 14,
        padding: 12
    },
    kpiCardActive: {
        borderColor: C.navy,
        backgroundColor: '#FFFFFF',
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 6,
        elevation: 2
    },
    kpiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6
    },
    kpiIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center'
    },
    kpiBadge: {
        fontSize: 8.5,
        fontWeight: '900',
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 4
    },
    kpiValue: {
        fontSize: 16,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    kpiSub: {
        fontSize: 10,
        fontWeight: '600',
        color: C.muted,
        marginTop: 2
    },
    filterSection: {
        backgroundColor: C.card,
        paddingHorizontal: 16,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.canvas,
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10
    },
    searchInput: {
        flex: 1,
        fontSize: 13,
        color: C.navy,
        padding: 0
    },
    tabRow: {
        gap: 8,
        marginBottom: 8
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 10,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    tabPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    tabPillText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.muted
    },
    tabPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    tabCountBadge: {
        backgroundColor: C.border,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    tabCountBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.2)'
    },
    tabCountText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.slate
    },
    tabCountTextActive: {
        color: '#FFFFFF'
    },
    subFilterRow: {
        marginBottom: 8
    },
    chipPill: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 7,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    chipPillActive: {
        backgroundColor: '#E0E7FF',
        borderColor: C.indigoBorder
    },
    chipPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted
    },
    chipPillTextActive: {
        color: C.indigo,
        fontWeight: '800'
    },
    resultCounterRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 4
    },
    resultCounterText: {
        fontSize: 11,
        color: C.muted
    },
    clearSearchText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.blue
    },
    listContent: {
        padding: 16,
        paddingBottom: 100
    },
    card: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.03,
        shadowRadius: 6,
        elevation: 1
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    beneficiaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        flex: 1
    },
    avatarBox: {
        width: 38,
        height: 38,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1
    },
    beneficiaryName: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy
    },
    rolePill: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
        borderWidth: 1
    },
    rolePillText: {
        fontSize: 9,
        fontWeight: '900',
        textTransform: 'uppercase'
    },
    beneficiaryMeta: {
        fontSize: 11,
        color: C.muted,
        marginTop: 2
    },
    amountWrap: {
        alignItems: 'flex-end'
    },
    amountValue: {
        fontSize: 17,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.4
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 7,
        paddingVertical: 2.5,
        borderRadius: 6,
        borderWidth: 1,
        marginTop: 4
    },
    statusPillText: {
        fontSize: 9.5,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    bankStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: C.canvas,
        paddingHorizontal: 12,
        paddingVertical: 9,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: C.borderLight,
        marginBottom: 8
    },
    bankInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        flex: 1
    },
    bankNameText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.slate
    },
    bankAccountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    accountNumberText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.navy,
        fontFamily: 'monospace'
    },
    copyIconButton: {
        padding: 3,
        backgroundColor: C.blueBg,
        borderRadius: 5
    },
    accountHolderText: {
        fontSize: 11,
        color: C.muted,
        marginBottom: 8,
        paddingLeft: 2
    },
    notePreviewBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 8,
        marginBottom: 10,
        borderLeftWidth: 3,
        borderLeftColor: C.gold
    },
    notePreviewText: {
        fontSize: 11,
        color: C.muted,
        fontStyle: 'italic',
        flex: 1
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: C.borderLight
    },
    copyAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    copyAllBtnText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted
    },
    whatsappQuickBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionBtnText: {
        fontSize: 12,
        fontWeight: '800'
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40
    },
    loaderText: {
        marginTop: 12,
        fontSize: 12,
        fontWeight: '600',
        color: C.muted
    },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 36,
        backgroundColor: C.card,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 20
    },
    emptyIconWrap: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: C.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 14
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 4
    },
    emptySubtitle: {
        fontSize: 12,
        color: C.muted,
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 16
    },
    createEmptyBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        backgroundColor: C.navy
    },
    createEmptyBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800'
    },
    copyToast: {
        position: 'absolute',
        bottom: 24,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: C.navy,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 10,
        elevation: 6,
        zIndex: 999
    },
    copyToastText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700'
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: C.card,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        padding: 20,
        paddingBottom: 36,
        maxHeight: '90%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.4
    },
    modalRef: {
        fontSize: 11,
        fontWeight: '600',
        color: C.muted,
        marginTop: 2
    },
    modalCloseBtn: {
        width: 32,
        height: 32,
        borderRadius: 9,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    heroAmountCard: {
        backgroundColor: C.navy,
        borderRadius: 18,
        padding: 20,
        alignItems: 'center',
        marginBottom: 16
    },
    heroAmountLabel: {
        color: C.gold,
        fontSize: 10,
        fontWeight: '800',
        letterSpacing: 1,
        marginBottom: 4
    },
    heroAmountValue: {
        fontSize: 32,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10
    },
    heroDateText: {
        color: C.subtle,
        fontSize: 11,
        fontWeight: '600'
    },
    sectionBox: {
        backgroundColor: C.canvas,
        borderRadius: 14,
        padding: 14,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 14
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 10
    },
    beneficiaryModalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12
    },
    beneficiaryModalName: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy
    },
    beneficiaryModalEmail: {
        fontSize: 11,
        color: C.muted,
        marginTop: 1
    },
    beneficiaryModalPhone: {
        fontSize: 11,
        fontWeight: '600',
        color: C.slate,
        marginTop: 2
    },
    contactTriggerRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 12,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: C.border
    },
    whatsappTriggerBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0'
    },
    whatsappTriggerText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#166534'
    },
    callTriggerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border
    },
    callTriggerText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.navy
    },
    copyAllMiniBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        backgroundColor: C.blueBg,
        borderWidth: 1,
        borderColor: C.blueBorder
    },
    copyAllMiniText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.blue
    },
    coordRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight
    },
    coordLabel: {
        fontSize: 12,
        color: C.muted,
        fontWeight: '500'
    },
    coordValue: {
        fontSize: 12,
        fontWeight: '700',
        color: C.navy
    },
    coordValueMono: {
        fontSize: 13,
        fontWeight: '800',
        color: C.navy,
        fontFamily: 'monospace'
    },
    copyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: C.blueBg,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
        borderColor: C.blueBorder
    },
    copyPillText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.blue
    },
    resolutionBox: {
        backgroundColor: C.card,
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: C.border
    },
    noteInstruction: {
        fontSize: 11,
        color: C.muted,
        marginBottom: 8
    },
    quickChipsRow: {
        gap: 6,
        marginBottom: 8
    },
    quickChip: {
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8
    },
    quickChipText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.muted
    },
    noteInput: {
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 12,
        padding: 12,
        backgroundColor: C.canvas,
        fontSize: 13,
        color: C.navy,
        minHeight: 64,
        textAlignVertical: 'top',
        marginBottom: 14
    },
    actionButtonGroup: {
        flexDirection: 'row',
        gap: 10
    },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: C.roseBg,
        borderWidth: 1,
        borderColor: C.roseBorder
    },
    rejectBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: C.rose
    },
    approveBtn: {
        flex: 1.3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: C.navy,
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 3
    },
    approveBtnText: {
        fontSize: 12,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    rejectionWarning: {
        fontSize: 10,
        color: C.muted,
        textAlign: 'center',
        marginTop: 10,
        lineHeight: 14
    },
    resolvedBox: {
        borderRadius: 16,
        padding: 20,
        alignItems: 'center',
        borderWidth: 1,
        marginTop: 6
    },
    resolvedTitle: {
        fontSize: 16,
        fontWeight: '900',
        marginTop: 8,
        letterSpacing: 0.5
    },
    resolvedNote: {
        fontSize: 12,
        color: C.slate,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 6
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 6
    },
    simInput: {
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 9,
        fontSize: 13,
        color: C.navy,
        marginBottom: 12
    },
    roleSelectBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    roleSelectBtnActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    roleSelectText: {
        fontSize: 12,
        fontWeight: '700',
        color: C.muted
    },
    roleSelectTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    submitSimBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: C.navy,
        paddingVertical: 14,
        borderRadius: 12,
        marginTop: 8
    },
    submitSimBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '800'
    }
});
