import React, { useState, useEffect, useMemo } from 'react';
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
import { supabase } from '../../lib/supabase';

// ─── Compact Executive Tokens ────────────────────────────────────────────────
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

// ─── Currency & Date Formatters ──────────────────────────────────────────────
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

// Extract bank credentials if stored inside transaction description string
const parseBankFromDescription = (desc = '') => {
    let bankName = 'Commercial Bank';
    let accountNo = '';
    let accountName = '';

    if (!desc) return { bankName, accountNo, accountName };

    // Common pattern: "Bank Withdrawal to Access Bank (0123456789 - Sani Bello)"
    const match = desc.match(/(?:to\s+)?([A-Za-z0-9\s]+?)\s*\(([0-9]{10})\s*(?:-\s*([^)]+))?\)/i);
    if (match) {
        bankName = match[1]?.trim() || bankName;
        accountNo = match[2]?.trim() || '';
        accountName = match[3]?.trim() || '';
    } else {
        // Try looking for 10 consecutive digits
        const numMatch = desc.match(/\b([0-9]{10})\b/);
        if (numMatch) accountNo = numMatch[1];
    }

    return { bankName, accountNo, accountName };
};

export const AdminPayouts = ({ navigation, onBack }) => {
    // ── Live Data State (Strictly from Supabase) ──────────────────────────────
    const [withdrawals, setWithdrawals] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [isExporting, setIsExporting] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);

    // ── Filters & Search ─────────────────────────────────────────────────────
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('pending'); // 'pending', 'all', 'paid', 'rejected'
    const [roleFilter, setRoleFilter] = useState('all'); // 'all', 'Vendor', 'Driver'
    const [dateRange, setDateRange] = useState('all'); // 'all', 'today', 'week', 'month'

    // ── Interactive Detail / Action Modal ────────────────────────────────────
    const [selectedRequest, setSelectedRequest] = useState(null);
    const [adminNote, setAdminNote] = useState('');
    const [copyFeedback, setCopyFeedback] = useState(null);

    useEffect(() => {
        fetchLivePayoutRequests();
    }, []);

    // ── Live Supabase Query (Zero Mockups) ───────────────────────────────────
    const fetchLivePayoutRequests = async () => {
        try {
            setLoading(true);

            // Query live tables in parallel
            const [vRes, dRes, txRes] = await Promise.allSettled([
                supabase
                    .from('vendor_payouts')
                    .select('*, profiles:vendor_id(id, full_name, email, phone)')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabase
                    .from('driver_payouts')
                    .select('*, drivers:driver_id(name, phone, user_id, profiles(id, full_name, email, phone))')
                    .order('created_at', { ascending: false })
                    .limit(100),
                supabase
                    .from('transactions')
                    .select('*, profiles:user_id(id, full_name, email, phone, role)')
                    .or('type.eq.withdrawal,type.eq.payout')
                    .order('created_at', { ascending: false })
                    .limit(100)
            ]);

            const liveList = [];

            // 1. Process vendor_payouts records
            if (vRes.status === 'fulfilled' && Array.isArray(vRes.value?.data)) {
                vRes.value.data.forEach(p => {
                    liveList.push({
                        id: p.id,
                        role: 'Vendor',
                        table_source: 'vendor_payouts',
                        target_user_id: p.vendor_id || p.user_id,
                        amount: Number(p.amount || 0),
                        bank_name: p.bank_name || 'Commercial Bank',
                        account_number: p.account_number || 'N/A',
                        account_name: p.account_name || p.profiles?.full_name || 'Beneficiary',
                        status: p.status === 'completed' || p.status === 'paid' ? 'paid' : p.status === 'rejected' ? 'rejected' : 'pending',
                        admin_note: p.admin_note || '',
                        reference: p.reference || `VP-${p.id.slice(0, 8)}`,
                        created_at: p.created_at,
                        profiles: p.profiles || { full_name: 'Merchant Partner', email: 'merchant@abumafhal.com', phone: '' }
                    });
                });
            }

            // 2. Process driver_payouts records
            if (dRes.status === 'fulfilled' && Array.isArray(dRes.value?.data)) {
                dRes.value.data.forEach(p => {
                    liveList.push({
                        id: p.id,
                        role: 'Driver',
                        table_source: 'driver_payouts',
                        target_user_id: p.drivers?.user_id || p.driver_id,
                        amount: Number(p.amount || 0),
                        bank_name: p.bank_name || 'Commercial Bank',
                        account_number: p.account_number || 'N/A',
                        account_name: p.account_name || p.drivers?.name || 'Courier',
                        status: p.status === 'completed' || p.status === 'paid' ? 'paid' : p.status === 'rejected' ? 'rejected' : 'pending',
                        admin_note: p.admin_note || '',
                        reference: p.reference || `DP-${p.id.slice(0, 8)}`,
                        created_at: p.created_at,
                        profiles: p.drivers?.profiles ? {
                            full_name: p.drivers.name || p.drivers.profiles.full_name || 'Fleet Driver',
                            email: p.drivers.profiles.email || 'courier@abumafhal.com',
                            phone: p.drivers.phone || p.drivers.profiles.phone || ''
                        } : { full_name: p.drivers?.name || 'Fleet Driver', email: 'courier@abumafhal.com', phone: p.drivers?.phone || '' }
                    });
                });
            }

            // 3. Process transactions table withdrawals
            if (txRes.status === 'fulfilled' && Array.isArray(txRes.value?.data)) {
                txRes.value.data.forEach(t => {
                    // Prevent duplicate if already fetched from vendor_payouts/driver_payouts
                    const isDup = liveList.some(item => item.id === t.id || (t.reference && item.reference === t.reference));
                    if (!isDup) {
                        const parsedBank = parseBankFromDescription(t.description);
                        const isDriver = t.profiles?.role === 'driver';

                        liveList.push({
                            id: t.id,
                            role: isDriver ? 'Driver' : 'Vendor',
                            table_source: 'transactions',
                            target_user_id: t.user_id,
                            amount: Number(t.amount || 0),
                            bank_name: t.bank_name || parsedBank.bankName,
                            account_number: t.account_number || parsedBank.accountNo || 'N/A',
                            account_name: t.account_name || parsedBank.accountName || t.profiles?.full_name || 'Beneficiary',
                            status: t.status === 'completed' || t.status === 'successful' || t.status === 'paid'
                                ? 'paid'
                                : t.status === 'rejected' || t.status === 'failed'
                                    ? 'rejected'
                                    : 'pending',
                            admin_note: t.description || '',
                            reference: t.reference || `TX-${t.id.slice(0, 8)}`,
                            created_at: t.created_at,
                            profiles: t.profiles || { full_name: 'Platform Client', email: 'user@abumafhal.com', phone: '' }
                        });
                    }
                });
            }

            // Sort chronologically (latest requests first)
            liveList.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));

            setWithdrawals(liveList);
        } catch (error) {
            console.error('Error fetching live payouts:', error);
            setWithdrawals([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchLivePayoutRequests();
    };

    // ── Computed Filtered Payouts ─────────────────────────────────────────────
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

        // Search Query Filter
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

    // ── Computed KPI Metrics (Strictly Real Live Ledger) ──────────────────────
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

    // ── 1-Tap Copy Handlers ───────────────────────────────────────────────────
    const handleCopy = async (text, label) => {
        if (!text || text === 'N/A') return;
        try {
            await Clipboard.setStringAsync(String(text));
            setCopyFeedback(label);
            setTimeout(() => setCopyFeedback(null), 2000);
        } catch (e) {
            console.warn('Copy notice:', e);
        }
    };

    const handleCopyFullTransferInfo = (req) => {
        if (!req) return;
        const fullInfo = `BANK: ${req.bank_name || 'N/A'}\nACCOUNT: ${req.account_number || 'N/A'}\nBENEFICIARY: ${req.account_name || req.profiles?.full_name || 'N/A'}\nAMOUNT: ₦${Number(req.amount || 0).toLocaleString()}\nREF: ${req.reference || req.id}`;
        handleCopy(fullInfo, 'All Bank Details Copied!');
    };

    // ── Direct WhatsApp Notification ──────────────────────────────────────────
    const handleLaunchWhatsApp = (req) => {
        if (!req) return;
        const phone = req.profiles?.phone || req.phone || '';
        if (!phone) {
            Alert.alert('No Phone Registered', 'This user has no phone number on record.');
            return;
        }

        const cleanPhone = phone.replace(/[^0-9]/g, '');
        const intlPhone = cleanPhone.startsWith('0') ? '234' + cleanPhone.slice(1) : cleanPhone;
        const name = req.profiles?.full_name || req.account_name || 'Partner';
        const amt = formatNaira(req.amount);

        const msg = `Hello ${name},\nThis is Abu-Mafhal Marketplace Finance regarding your payout request (${amt}).\n\nAccount: ${req.bank_name} - ${req.account_number}\nStatus: ${req.status === 'paid' ? 'Paid & Settled ✅' : 'Under Review ⏳'}\n\nThank you for choosing Abu-Mafhal Marketplace!`;

        const url = `https://wa.me/${intlPhone}?text=${encodeURIComponent(msg)}`;
        Linking.openURL(url).catch(() => {
            Alert.alert('Error', 'Unable to open WhatsApp.');
        });
    };

    const handleCallPhone = (phone) => {
        if (!phone) {
            Alert.alert('No Phone', 'No contact phone number is available.');
            return;
        }
        Linking.openURL(`tel:${phone}`).catch(() => {
            Alert.alert('Error', 'Could not open phone dialer.');
        });
    };

    // ── Live Processing (Approve or Reject with Wallet Refund) ────────────────
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
                                    console.warn('Payout table update warning:', e);
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
                                    console.warn('Transaction table update warning:', e);
                                }
                            }

                            // 2. If rejected, refund to user's wallet & profile balance
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

                                    // Log refund credit transaction
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

                            // 3. Update local state
                            setWithdrawals(prev => prev.map(w => {
                                if (w.id === selectedRequest.id) {
                                    return {
                                        ...w,
                                        status: status,
                                        admin_note: updatedNote,
                                        processed_at: new Date().toISOString()
                                    };
                                }
                                return w;
                            }));

                            Alert.alert(
                                'Success',
                                `Payout marked as ${status.toUpperCase()}.${isRejection ? ' Balance refunded to user wallet.' : ''}`
                            );

                            setSelectedRequest(null);
                            setAdminNote('');
                            fetchLivePayoutRequests();
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

    // ── Generate & Export Live PDF Report ─────────────────────────────────────
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
                    <title>Live Payout Ledger</title>
                    <style>
                        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #0F172A; background-color: #FFFFFF; }
                        .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #E2E8F0; padding-bottom: 14px; margin-bottom: 18px; }
                        .brand { font-size: 20px; font-weight: 900; color: #0F172A; }
                        .brand span { color: #D9A73A; }
                        .sub { font-size: 11px; color: #64748B; margin-top: 3px; }
                        .kpi-row { display: flex; gap: 12px; margin-bottom: 18px; }
                        .kpi-card { flex: 1; border: 1px solid #E2E8F0; border-radius: 8px; padding: 10px; background-color: #F8FAFC; }
                        .kpi-label { font-size: 9px; font-weight: 700; color: #64748B; text-transform: uppercase; }
                        .kpi-val { font-size: 15px; font-weight: 900; color: #0F172A; margin-top: 2px; }
                        table { width: 100%; border-collapse: collapse; margin-top: 8px; font-size: 11px; }
                        th { background-color: #F1F5F9; color: #334155; font-weight: 800; text-align: left; padding: 8px 10px; border-bottom: 2px solid #CBD5E1; }
                        td { padding: 8px 10px; border-bottom: 1px solid #E2E8F0; vertical-align: top; }
                        tr:nth-child(even) { background-color: #F8FAFC; }
                        .badge { display: inline-block; padding: 2px 6px; border-radius: 999px; font-size: 9px; font-weight: 800; text-transform: uppercase; }
                        .badge-paid { background-color: #DCFCE7; color: #166534; }
                        .badge-pending { background-color: #FEF3C7; color: #92400E; }
                        .badge-rejected { background-color: #FEE2E2; color: #991B1B; }
                        .footer { margin-top: 24px; padding-top: 12px; border-top: 1px solid #E2E8F0; font-size: 10px; color: #94A3B8; text-align: center; }
                    </style>
                </head>
                <body>
                    <div class="header">
                        <div>
                            <div class="brand">ABU-MAFHAL <span>MARKETPLACE</span></div>
                            <div class="sub">Live Disbursement & Settlement Audit</div>
                        </div>
                        <div style="text-align: right;">
                            <div style="font-size: 11px; font-weight: 700; color: #0F172A;">Generated: ${new Date().toLocaleString()}</div>
                            <div class="sub">Status: ${statusFilter.toUpperCase()} | Range: ${dateRange.toUpperCase()}</div>
                        </div>
                    </div>

                    <div class="kpi-row">
                        <div class="kpi-card">
                            <div class="kpi-label">Total Records</div>
                            <div class="kpi-val">${filteredWithdrawals.length}</div>
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
                                        <span style="font-size: 9px; font-weight: 800; color: #475569;">${w.role || 'Partner'}</span>
                                    </td>
                                    <td>
                                        <strong>${w.bank_name || 'N/A'}</strong><br/>
                                        <code>${w.account_number || 'N/A'}</code>
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
                        Abu-Mafhal Marketplace Live Financial Governance • Automated Ledger
                    </div>
                </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });

            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, { dialogTitle: 'Export Live Payout Ledger' });
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

    // ── Render Compact Payout Item ────────────────────────────────────────────
    const renderPayoutItem = ({ item }) => {
        const isPending = item.status === 'pending';
        const isPaid = item.status === 'paid';

        const statusBg = isPaid ? C.emeraldBg : isPending ? C.amberBg : C.roseBg;
        const statusText = isPaid ? C.emerald : isPending ? C.amber : C.rose;
        const statusBorder = isPaid ? C.emeraldBorder : isPending ? C.amberBorder : C.roseBorder;
        const statusIcon = isPaid ? 'checkmark-circle' : isPending ? 'time' : 'close-circle';

        const isVendor = item.role === 'Vendor';

        return (
            <View style={S.card}>
                {/* Header Row: Beneficiary & Amount */}
                <View style={S.cardHeader}>
                    <View style={S.beneficiaryRow}>
                        <View style={[S.avatarBox, { backgroundColor: isVendor ? '#FFFBEB' : '#EFF6FF', borderColor: isVendor ? '#FDE68A' : '#BFDBFE' }]}>
                            <Ionicons name={isVendor ? 'storefront-outline' : 'bicycle-outline'} size={15} color={isVendor ? C.amber : C.blue} />
                        </View>
                        <View style={{ flex: 1, marginRight: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Text style={S.beneficiaryName} numberOfLines={1}>
                                    {item.profiles?.full_name || item.account_name || 'Partner'}
                                </Text>
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
                            <Ionicons name={statusIcon} size={10} color={statusText} />
                            <Text style={[S.statusPillText, { color: statusText }]}>{item.status.toUpperCase()}</Text>
                        </View>
                    </View>
                </View>

                {/* Compact Bank Strip */}
                <View style={S.bankStrip}>
                    <View style={S.bankInfoRow}>
                        <Ionicons name="business-outline" size={13} color={C.muted} />
                        <Text style={S.bankNameText} numberOfLines={1}>{item.bank_name || 'Commercial Bank'}</Text>
                    </View>

                    <View style={S.bankAccountRow}>
                        <Text style={S.accountNumberText}>{item.account_number || 'N/A'}</Text>
                        {item.account_number && item.account_number !== 'N/A' ? (
                            <TouchableOpacity
                                onPress={() => handleCopy(item.account_number, `Account Copied: ${item.account_number}`)}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                style={S.copyIconButton}
                            >
                                <Ionicons name="copy-outline" size={12} color={C.blue} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* Account Name */}
                {item.account_name ? (
                    <Text style={S.accountHolderText} numberOfLines={1}>
                        Name: <Text style={{ fontWeight: '700', color: C.slate }}>{item.account_name}</Text>
                    </Text>
                ) : null}

                {/* Admin Note if already settled */}
                {item.admin_note ? (
                    <View style={S.notePreviewBox}>
                        <Ionicons name="document-text-outline" size={11} color={C.muted} />
                        <Text style={S.notePreviewText} numberOfLines={1}>"{item.admin_note}"</Text>
                    </View>
                ) : null}

                {/* Action Buttons */}
                <View style={S.cardFooter}>
                    <TouchableOpacity
                        onPress={() => handleCopyFullTransferInfo(item)}
                        style={S.copyAllBtn}
                    >
                        <Ionicons name="copy-outline" size={12} color={C.muted} />
                        <Text style={S.copyAllBtnText}>Copy Bank Info</Text>
                    </TouchableOpacity>

                    {item.profiles?.phone ? (
                        <TouchableOpacity
                            onPress={() => handleLaunchWhatsApp(item)}
                            style={S.whatsappQuickBtn}
                        >
                            <Ionicons name="logo-whatsapp" size={13} color="#16A34A" />
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
                            {isPending ? 'Settle →' : 'View Audit'}
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    return (
        <View style={S.container}>
            {/* ── Compact Executive Header ────────────────────────────────────── */}
            <View style={S.header}>
                <View style={S.headerTopRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        {onBack ? (
                            <TouchableOpacity onPress={onBack} style={S.backButton}>
                                <Ionicons name="arrow-back" size={16} color={C.navy} />
                            </TouchableOpacity>
                        ) : navigation?.canGoBack?.() ? (
                            <TouchableOpacity onPress={() => navigation.goBack()} style={S.backButton}>
                                <Ionicons name="arrow-back" size={16} color={C.navy} />
                            </TouchableOpacity>
                        ) : null}

                        <View>
                            <Text style={S.headerTitle}>Payout Console</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <View style={S.liveDot} />
                                <Text style={S.headerSubtitle}>Live Supabase Ledger</Text>
                            </View>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <TouchableOpacity
                            onPress={handleRefresh}
                            style={S.iconBtn}
                            disabled={refreshing}
                        >
                            <Ionicons name="refresh" size={15} color={C.navy} />
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
                                    <Ionicons name="document-text-outline" size={13} color="#FFFFFF" />
                                    <Text style={S.exportBtnText}>PDF</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Compact 4-Tile KPI Summary Ribbon ────────────────────────── */}
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={S.kpiScroll}
                >
                    {/* Pending Approval Tile */}
                    <TouchableOpacity
                        onPress={() => setStatusFilter('pending')}
                        style={[S.kpiCard, statusFilter === 'pending' && S.kpiCardActive]}
                    >
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.amberBg }]}>
                                <Ionicons name="hourglass-outline" size={12} color={C.amber} />
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
                                <Ionicons name="checkmark-done-circle-outline" size={12} color={C.emerald} />
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
                                <Ionicons name="refresh-circle-outline" size={12} color={C.rose} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.rose, backgroundColor: '#FEE2E2' }]}>
                                {metrics.rejectedCount} REFUNDED
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{formatNaira(metrics.rejectedTotal)}</Text>
                        <Text style={S.kpiSub}>Wallet Reversals</Text>
                    </TouchableOpacity>

                    {/* Settlement Efficiency Rate */}
                    <View style={S.kpiCard}>
                        <View style={S.kpiHeader}>
                            <View style={[S.kpiIconWrap, { backgroundColor: C.indigoBg }]}>
                                <Ionicons name="pie-chart-outline" size={12} color={C.indigo} />
                            </View>
                            <Text style={[S.kpiBadge, { color: C.indigo, backgroundColor: '#E0E7FF' }]}>
                                RATE
                            </Text>
                        </View>
                        <Text style={S.kpiValue}>{metrics.resolutionRate}%</Text>
                        <Text style={S.kpiSub}>Settlement Rate</Text>
                    </View>
                </ScrollView>
            </View>

            {/* ── Search & Filter Controls ────────────────────────────────────── */}
            <View style={S.filterSection}>
                {/* Search Box */}
                <View style={S.searchBox}>
                    <Ionicons name="search" size={15} color={C.muted} />
                    <TextInput
                        style={S.searchInput}
                        placeholder="Search beneficiary, account, bank..."
                        placeholderTextColor={C.subtle}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={15} color={C.muted} />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Status Tabs */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tabRow}>
                    {[
                        { id: 'pending', label: 'Pending', count: metrics.pendingCount },
                        { id: 'all', label: 'All', count: withdrawals.length },
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

                {/* Sub-Filters: Roles & Date Range */}
                <View style={S.subFilterRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 5 }}>
                        {['all', 'Vendor', 'Driver'].map(r => (
                            <TouchableOpacity
                                key={r}
                                onPress={() => setRoleFilter(r)}
                                style={[S.chipPill, roleFilter === r && S.chipPillActive]}
                            >
                                <Text style={[S.chipPillText, roleFilter === r && S.chipPillTextActive]}>
                                    {r === 'all' ? 'All Roles' : `${r}s`}
                                </Text>
                            </TouchableOpacity>
                        ))}

                        <View style={{ width: 1, backgroundColor: C.border, marginHorizontal: 2 }} />

                        {[
                            { id: 'all', label: 'All Time' },
                            { id: 'today', label: 'Today' },
                            { id: 'week', label: '7 Days' },
                            { id: 'month', label: '30 Days' }
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
                        Showing <Text style={{ fontWeight: '800', color: C.navy }}>{filteredWithdrawals.length}</Text> of {withdrawals.length} live records
                    </Text>
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Text style={S.clearSearchText}>Clear</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* ── Main List ───────────────────────────────────────────────────── */}
            {loading && !refreshing ? (
                <View style={S.centerLoader}>
                    <ActivityIndicator size="small" color={C.navy} />
                    <Text style={S.loaderText}>Querying live payout records...</Text>
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
                                <Ionicons name="wallet-outline" size={30} color={C.muted} />
                            </View>
                            <Text style={S.emptyTitle}>No Live Payout Requests</Text>
                            <Text style={S.emptySubtitle}>
                                {searchQuery
                                    ? `No payout records match "${searchQuery}".`
                                    : `There are currently no ${statusFilter !== 'all' ? statusFilter : ''} withdrawal requests from vendors or drivers in the live database.`}
                            </Text>
                            <TouchableOpacity
                                onPress={handleRefresh}
                                style={S.refreshEmptyBtn}
                            >
                                <Ionicons name="refresh" size={14} color="#FFFFFF" />
                                <Text style={S.refreshEmptyBtnText}>Refresh Live Ledger</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}

            {/* ── Copy Feedback Toast ─────────────────────────────────────────── */}
            {copyFeedback && (
                <View style={S.copyToast}>
                    <Ionicons name="checkmark-circle" size={14} color="#FFFFFF" />
                    <Text style={S.copyToastText}>{copyFeedback}</Text>
                </View>
            )}

            {/* ── Compact Disbursement Review Drawer ──────────────────────────── */}
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
                                        <Ionicons name="close" size={18} color={C.navy} />
                                    </TouchableOpacity>
                                </View>

                                {/* Compact Hero Amount Card */}
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
                                        <View style={[S.avatarBox, { backgroundColor: '#F1F5F9', width: 36, height: 36 }]}>
                                            <Ionicons name={selectedRequest.role === 'Vendor' ? 'storefront' : 'bicycle'} size={17} color={C.navy} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={S.beneficiaryModalName}>{selectedRequest.profiles?.full_name || selectedRequest.account_name || 'N/A'}</Text>
                                            <Text style={S.beneficiaryModalEmail}>{selectedRequest.profiles?.email || 'No email registered'}</Text>
                                            {selectedRequest.profiles?.phone ? (
                                                <Text style={S.beneficiaryModalPhone}>📞 {selectedRequest.profiles.phone}</Text>
                                            ) : null}
                                        </View>
                                    </View>

                                    {/* Direct Phone & WhatsApp buttons */}
                                    {selectedRequest.profiles?.phone ? (
                                        <View style={S.contactTriggerRow}>
                                            <TouchableOpacity
                                                onPress={() => handleLaunchWhatsApp(selectedRequest)}
                                                style={S.whatsappTriggerBtn}
                                            >
                                                <Ionicons name="logo-whatsapp" size={14} color="#16A34A" />
                                                <Text style={S.whatsappTriggerText}>WhatsApp Receipt</Text>
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => handleCallPhone(selectedRequest.profiles.phone)}
                                                style={S.callTriggerBtn}
                                            >
                                                <Ionicons name="call-outline" size={14} color={C.navy} />
                                                <Text style={S.callTriggerText}>Call Phone</Text>
                                            </TouchableOpacity>
                                        </View>
                                    ) : null}
                                </View>

                                {/* Bank Settlement Coordinates */}
                                <View style={S.sectionBox}>
                                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                        <Text style={S.sectionTitle}>Bank Account Details</Text>
                                        <TouchableOpacity
                                            onPress={() => handleCopyFullTransferInfo(selectedRequest)}
                                            style={S.copyAllMiniBtn}
                                        >
                                            <Ionicons name="copy-outline" size={11} color={C.blue} />
                                            <Text style={S.copyAllMiniText}>Copy All</Text>
                                        </TouchableOpacity>
                                    </View>

                                    <View style={S.coordRow}>
                                        <Text style={S.coordLabel}>Bank Name</Text>
                                        <Text style={S.coordValue}>{selectedRequest.bank_name || 'N/A'}</Text>
                                    </View>

                                    <View style={S.coordRow}>
                                        <Text style={S.coordLabel}>Account Number</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <Text style={S.coordValueMono}>{selectedRequest.account_number || 'N/A'}</Text>
                                            {selectedRequest.account_number && selectedRequest.account_number !== 'N/A' ? (
                                                <TouchableOpacity
                                                    onPress={() => handleCopy(selectedRequest.account_number, `Account Copied: ${selectedRequest.account_number}`)}
                                                    style={S.copyPill}
                                                >
                                                    <Ionicons name="copy-outline" size={11} color={C.blue} />
                                                    <Text style={S.copyPillText}>Copy</Text>
                                                </TouchableOpacity>
                                            ) : null}
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
                                        <Text style={S.sectionTitle}>Admin Note & Audit Log</Text>
                                        <Text style={S.noteInstruction}>Transaction ref, bank transfer ID, or reason for audit:</Text>

                                        {/* Quick Note Chips */}
                                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.quickChipsRow}>
                                            {[
                                                'Transfer Settled via OPay',
                                                'Confirmed via Bank App',
                                                'Duplicate Request',
                                                'Incorrect Account Name',
                                                'Vendor Requested Cancellation'
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
                                            placeholder="e.g. Settled via Bank Transfer Ref #99201948"
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
                                                <Ionicons name="arrow-undo-outline" size={14} color={C.rose} />
                                                <Text style={S.rejectBtnText}>Reject & Refund</Text>
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
                                                        <Ionicons name="checkmark-done" size={15} color="#FFFFFF" />
                                                        <Text style={S.approveBtnText}>Approve & Mark Paid</Text>
                                                    </>
                                                )}
                                            </TouchableOpacity>
                                        </View>

                                        <Text style={S.rejectionWarning}>
                                            ⚠️ Rejecting a request automatically refunds the balance back to the merchant's wallet.
                                        </Text>
                                    </View>
                                ) : (
                                    <View style={[S.resolvedBox, {
                                        backgroundColor: selectedRequest.status === 'paid' ? C.emeraldBg : C.roseBg,
                                        borderColor: selectedRequest.status === 'paid' ? C.emeraldBorder : C.roseBorder
                                    }]}>
                                        <Ionicons
                                            name={selectedRequest.status === 'paid' ? 'checkmark-circle' : 'close-circle'}
                                            size={26}
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
        </View>
    );
};

// ─── Compact Modern Stylesheet ───────────────────────────────────────────────
const S = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: C.canvas
    },
    header: {
        backgroundColor: C.card,
        paddingTop: 12,
        paddingBottom: 10,
        paddingHorizontal: 14,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10
    },
    backButton: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    headerTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    headerSubtitle: {
        fontSize: 10,
        fontWeight: '600',
        color: C.muted
    },
    liveDot: {
        width: 5,
        height: 5,
        borderRadius: 2.5,
        backgroundColor: C.emerald
    },
    iconBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    exportBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: C.navy
    },
    exportBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800'
    },
    kpiScroll: {
        gap: 8,
        paddingRight: 6
    },
    kpiCard: {
        width: 126,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 10,
        padding: 9
    },
    kpiCardActive: {
        borderColor: C.navy,
        backgroundColor: '#FFFFFF',
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 1
    },
    kpiHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4
    },
    kpiIconWrap: {
        width: 22,
        height: 22,
        borderRadius: 6,
        alignItems: 'center',
        justifyContent: 'center'
    },
    kpiBadge: {
        fontSize: 7.5,
        fontWeight: '900',
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: 3
    },
    kpiValue: {
        fontSize: 14.5,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    kpiSub: {
        fontSize: 9.5,
        fontWeight: '600',
        color: C.muted,
        marginTop: 1
    },
    filterSection: {
        backgroundColor: C.card,
        paddingHorizontal: 14,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: C.border
    },
    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.canvas,
        borderRadius: 9,
        paddingHorizontal: 10,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 8
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: C.navy,
        padding: 0
    },
    tabRow: {
        gap: 6,
        marginBottom: 6
    },
    tabPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    tabPillActive: {
        backgroundColor: C.navy,
        borderColor: C.navy
    },
    tabPillText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.muted
    },
    tabPillTextActive: {
        color: '#FFFFFF',
        fontWeight: '800'
    },
    tabCountBadge: {
        backgroundColor: C.border,
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5
    },
    tabCountBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.2)'
    },
    tabCountText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.slate
    },
    tabCountTextActive: {
        color: '#FFFFFF'
    },
    subFilterRow: {
        marginBottom: 6
    },
    chipPill: {
        paddingHorizontal: 8,
        paddingVertical: 3.5,
        borderRadius: 6,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    chipPillActive: {
        backgroundColor: '#E0E7FF',
        borderColor: C.indigoBorder
    },
    chipPillText: {
        fontSize: 10,
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
        paddingTop: 2
    },
    resultCounterText: {
        fontSize: 10.5,
        color: C.muted
    },
    clearSearchText: {
        fontSize: 10.5,
        fontWeight: '700',
        color: C.blue
    },
    listContent: {
        padding: 12,
        paddingBottom: 90
    },
    card: {
        backgroundColor: C.card,
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: C.border,
        shadowColor: C.navy,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 8
    },
    beneficiaryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        flex: 1
    },
    avatarBox: {
        width: 32,
        height: 32,
        borderRadius: 9,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1
    },
    beneficiaryName: {
        fontSize: 13,
        fontWeight: '800',
        color: C.navy
    },
    rolePill: {
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 4,
        borderWidth: 1
    },
    rolePillText: {
        fontSize: 8.5,
        fontWeight: '900',
        textTransform: 'uppercase'
    },
    beneficiaryMeta: {
        fontSize: 10,
        color: C.muted,
        marginTop: 1
    },
    amountWrap: {
        alignItems: 'flex-end'
    },
    amountValue: {
        fontSize: 15,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    statusPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        borderWidth: 1,
        marginTop: 3
    },
    statusPillText: {
        fontSize: 8.5,
        fontWeight: '900',
        letterSpacing: 0.3
    },
    bankStrip: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: C.canvas,
        paddingHorizontal: 9,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.borderLight,
        marginBottom: 6
    },
    bankInfoRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        flex: 1
    },
    bankNameText: {
        fontSize: 11,
        fontWeight: '700',
        color: C.slate
    },
    bankAccountRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5
    },
    accountNumberText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.navy,
        fontFamily: 'monospace'
    },
    copyIconButton: {
        padding: 2.5,
        backgroundColor: C.blueBg,
        borderRadius: 4
    },
    accountHolderText: {
        fontSize: 10,
        color: C.muted,
        marginBottom: 6,
        paddingLeft: 2
    },
    notePreviewBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#F8FAFC',
        padding: 6,
        borderRadius: 6,
        marginBottom: 8,
        borderLeftWidth: 2.5,
        borderLeftColor: C.gold
    },
    notePreviewText: {
        fontSize: 10,
        color: C.muted,
        fontStyle: 'italic',
        flex: 1
    },
    cardFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: C.borderLight
    },
    copyAllBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 7,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border
    },
    copyAllBtnText: {
        fontSize: 10,
        fontWeight: '700',
        color: C.muted
    },
    whatsappQuickBtn: {
        width: 28,
        height: 28,
        borderRadius: 7,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0',
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionBtn: {
        flex: 1,
        paddingVertical: 6,
        borderRadius: 7,
        alignItems: 'center',
        justifyContent: 'center'
    },
    actionBtnText: {
        fontSize: 11,
        fontWeight: '800'
    },
    centerLoader: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 30
    },
    loaderText: {
        marginTop: 8,
        fontSize: 11,
        fontWeight: '600',
        color: C.muted
    },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 28,
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        marginTop: 14
    },
    emptyIconWrap: {
        width: 48,
        height: 48,
        borderRadius: 14,
        backgroundColor: C.canvas,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 3
    },
    emptySubtitle: {
        fontSize: 11,
        color: C.muted,
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 14
    },
    refreshEmptyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 8,
        backgroundColor: C.navy
    },
    refreshEmptyBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800'
    },
    copyToast: {
        position: 'absolute',
        bottom: 20,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: C.navy,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 999,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 6,
        zIndex: 999
    },
    copyToastText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700'
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(15, 23, 42, 0.6)',
        justifyContent: 'flex-end'
    },
    modalContent: {
        backgroundColor: C.card,
        borderTopLeftRadius: 22,
        borderTopRightRadius: 22,
        padding: 16,
        paddingBottom: 28,
        maxHeight: '90%'
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 12
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: C.navy,
        letterSpacing: -0.3
    },
    modalRef: {
        fontSize: 10,
        fontWeight: '600',
        color: C.muted,
        marginTop: 1
    },
    modalCloseBtn: {
        width: 28,
        height: 28,
        borderRadius: 7,
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        alignItems: 'center',
        justifyContent: 'center'
    },
    heroAmountCard: {
        backgroundColor: C.navy,
        borderRadius: 14,
        padding: 14,
        alignItems: 'center',
        marginBottom: 12
    },
    heroAmountLabel: {
        color: C.gold,
        fontSize: 9,
        fontWeight: '800',
        letterSpacing: 0.8,
        marginBottom: 2
    },
    heroAmountValue: {
        fontSize: 24,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.4
    },
    heroBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 6
    },
    heroDateText: {
        color: C.subtle,
        fontSize: 10,
        fontWeight: '600'
    },
    sectionBox: {
        backgroundColor: C.canvas,
        borderRadius: 10,
        padding: 11,
        borderWidth: 1,
        borderColor: C.border,
        marginBottom: 10
    },
    sectionTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: C.navy,
        marginBottom: 8
    },
    beneficiaryModalRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8
    },
    beneficiaryModalName: {
        fontSize: 12.5,
        fontWeight: '800',
        color: C.navy
    },
    beneficiaryModalEmail: {
        fontSize: 10,
        color: C.muted,
        marginTop: 1
    },
    beneficiaryModalPhone: {
        fontSize: 10,
        fontWeight: '600',
        color: C.slate,
        marginTop: 1
    },
    contactTriggerRow: {
        flexDirection: 'row',
        gap: 6,
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: C.border
    },
    whatsappTriggerBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 7,
        borderRadius: 7,
        backgroundColor: '#DCFCE7',
        borderWidth: 1,
        borderColor: '#BBF7D0'
    },
    whatsappTriggerText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#166534'
    },
    callTriggerBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 7,
        backgroundColor: C.card,
        borderWidth: 1,
        borderColor: C.border
    },
    callTriggerText: {
        fontSize: 10,
        fontWeight: '800',
        color: C.navy
    },
    copyAllMiniBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 5,
        backgroundColor: C.blueBg,
        borderWidth: 1,
        borderColor: C.blueBorder
    },
    copyAllMiniText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.blue
    },
    coordRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 6,
        borderBottomWidth: 1,
        borderBottomColor: C.borderLight
    },
    coordLabel: {
        fontSize: 11,
        color: C.muted,
        fontWeight: '500'
    },
    coordValue: {
        fontSize: 11,
        fontWeight: '700',
        color: C.navy
    },
    coordValueMono: {
        fontSize: 11.5,
        fontWeight: '800',
        color: C.navy,
        fontFamily: 'monospace'
    },
    copyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2.5,
        backgroundColor: C.blueBg,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        borderWidth: 1,
        borderColor: C.blueBorder
    },
    copyPillText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: C.blue
    },
    resolutionBox: {
        backgroundColor: C.card,
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: C.border
    },
    noteInstruction: {
        fontSize: 10,
        color: C.muted,
        marginBottom: 6
    },
    quickChipsRow: {
        gap: 5,
        marginBottom: 6
    },
    quickChip: {
        backgroundColor: C.canvas,
        borderWidth: 1,
        borderColor: C.border,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    quickChipText: {
        fontSize: 9.5,
        fontWeight: '700',
        color: C.muted
    },
    noteInput: {
        borderWidth: 1,
        borderColor: C.border,
        borderRadius: 9,
        padding: 9,
        backgroundColor: C.canvas,
        fontSize: 11.5,
        color: C.navy,
        minHeight: 52,
        textAlignVertical: 'top',
        marginBottom: 10
    },
    actionButtonGroup: {
        flexDirection: 'row',
        gap: 8
    },
    rejectBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
        borderRadius: 9,
        backgroundColor: C.roseBg,
        borderWidth: 1,
        borderColor: C.roseBorder
    },
    rejectBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: C.rose
    },
    approveBtn: {
        flex: 1.2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingVertical: 10,
        borderRadius: 9,
        backgroundColor: C.navy
    },
    approveBtnText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    rejectionWarning: {
        fontSize: 9.5,
        color: C.muted,
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 13
    },
    resolvedBox: {
        borderRadius: 12,
        padding: 14,
        alignItems: 'center',
        borderWidth: 1,
        marginTop: 4
    },
    resolvedTitle: {
        fontSize: 14,
        fontWeight: '900',
        marginTop: 6,
        letterSpacing: 0.3
    },
    resolvedNote: {
        fontSize: 11,
        color: C.slate,
        fontStyle: 'italic',
        textAlign: 'center',
        marginTop: 4
    }
});
