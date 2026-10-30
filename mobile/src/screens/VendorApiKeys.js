import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Alert,
    Platform,
    TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';

const TEAL = '#00BFA5';
const SLATE_900 = '#0F172A';
const SLATE_800 = '#1E293B';
const SLATE_600 = '#475569';
const SLATE_500 = '#64748B';
const BORDER_LIGHT = '#E2E8F0';
const BG_LIGHT = '#F8FAFC';
const CARD_BG = '#FFFFFF';

export const VendorApiKeys = ({ user, vendor, onBack }) => {
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copiedKey, setCopiedKey] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [activeLang, setActiveLang] = useState('curl');
    const [keyMode, setKeyMode] = useState('live'); // 'live' | 'test'
    const [selectedApi, setSelectedApi] = useState('products'); // 'products' | 'payments' | 'orders' | 'analytics'
    const [revealed, setRevealed] = useState({});

    // API Access Approval Lock State
    const [accessStatus, setAccessStatus] = useState('loading'); // 'approved' | 'pending' | 'rejected' | 'not_requested'
    const [accessRequest, setAccessRequest] = useState(null);
    const [requestNote, setRequestNote] = useState('');
    const [requestingAccess, setRequestingAccess] = useState(false);

    // Playground parameters
    const [limit, setLimit] = useState('5');
    const [paymentAmount, setPaymentAmount] = useState('5000');
    const [customerEmail, setCustomerEmail] = useState('buyer@example.com');

    const vendorId = user?.id || vendor?.id;
    const officialDomain = 'https://www.abumafhal.com';
    const productsEndpoint = `${officialDomain}/api/v1/products`;
    const paymentsEndpoint = `${officialDomain}/api/v1/payments`;
    const ordersEndpoint = `${officialDomain}/api/v1/orders`;
    const analyticsEndpoint = `${officialDomain}/api/v1/analytics`;

    useEffect(() => {
        if (vendorId) {
            loadApiKeys();
        }
    }, [vendorId]);

    const loadApiKeys = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${officialDomain}/api/v1/vendor-keys?vendor_id=${vendorId}`).catch(() => null);
            if (res && res.ok) {
                const json = await res.json();
                if (json?.status === 'success') {
                    setAccessStatus(json.access_status || 'not_requested');
                    setAccessRequest(json.access_request || null);
                    const retrievedKeys = Array.isArray(json.keys) ? json.keys : Array.isArray(json.data) ? json.data : [];
                    setApiKeys(retrievedKeys);
                    setLoading(false);
                    return;
                }
            }

            const { data } = await supabase
                .from('app_settings')
                .select('value')
                .eq('key', 'vendor_api_keys')
                .maybeSingle();

            if (data?.value?.keys && Array.isArray(data.value.keys)) {
                const userKeys = data.value.keys.filter(k => k.vendor_id === vendorId);
                setApiKeys(userKeys);
            }
        } catch (err) {
            console.error('Failed to load API keys:', err);
        } finally {
            setLoading(false);
        }
    };

    const submitAccessRequest = async () => {
        if (!vendorId) return;
        setRequestingAccess(true);

        try {
            const res = await fetch(`${officialDomain}/api/v1/vendor-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vendor_id: vendorId,
                    action: 'request_access',
                    note: requestNote.trim()
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                const msg = result.message || 'API access request submitted for admin review!';
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Request Submitted', msg);
                setAccessStatus('pending');
                await loadApiKeys();
            } else {
                const errTxt = result.message || 'Failed to submit access request';
                if (Platform.OS === 'web') alert(errTxt);
                else Alert.alert('Request Failed', errTxt);
            }
        } catch (e) {
            const errTxt = 'Network error while requesting API access';
            if (Platform.OS === 'web') alert(errTxt);
            else Alert.alert('Error', errTxt);
        } finally {
            setRequestingAccess(false);
        }
    };

    const generateNewKey = async () => {
        if (!vendorId) return;

        if (accessStatus !== 'approved') {
            const lockMsg = 'Developer API access is locked. You must submit a request and obtain admin approval before generating keys.';
            if (Platform.OS === 'web') alert(lockMsg);
            else Alert.alert('Access Locked', lockMsg);
            return;
        }

        setGenerating(true);

        try {
            const res = await fetch(`${officialDomain}/api/v1/vendor-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vendor_id: vendorId,
                    key_name: keyMode === 'test' ? 'Mobile Sandbox Test Key' : 'Mobile Production Live Key',
                    key_type: keyMode
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                const msg = `Successfully created ${keyMode.toUpperCase()} API key for abumafhal.com!`;
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Key Generated', msg);
                await loadApiKeys();
            } else {
                throw new Error(result.message || 'Key generation failed');
            }
        } catch (err) {
            const errTxt = err.message || 'Error occurred';
            if (Platform.OS === 'web') alert(errTxt);
            else Alert.alert('Error', errTxt);
        } finally {
            setGenerating(false);
        }
    };

    const revokeKey = async (keyId) => {
        const confirmMsg = 'Are you sure you want to revoke this API key?';
        const doRevoke = async () => {
            try {
                const res = await fetch(`${officialDomain}/api/v1/vendor-keys`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendor_id: vendorId, key_id: keyId })
                });
                if (res.ok) {
                    setApiKeys(prev => prev.filter(k => k.id !== keyId));
                    if (Platform.OS === 'web') alert('API Key revoked successfully');
                    else Alert.alert('Success', 'API Key revoked');
                }
            } catch (e) {
                console.error(e);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) doRevoke();
        } else {
            Alert.alert('Revoke Key', confirmMsg, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Revoke', style: 'destructive', onPress: doRevoke }
            ]);
        }
    };

    const copyKeyText = async (text) => {
        try {
            if (Clipboard?.setStringAsync) {
                await Clipboard.setStringAsync(text);
            } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
                await navigator.clipboard.writeText(text);
            }
            setCopiedKey(text);
            setTimeout(() => setCopiedKey(null), 2500);
        } catch (_) {}
    };

    const toggleReveal = (id) => {
        setRevealed(prev => ({ ...prev, [id]: !prev[id] }));
    };

    const activeKey = apiKeys.find(k => k.is_active !== false)?.api_key || 'abumafhal_test_sandbox_verified_key';

    const testEndpointLive = async () => {
        setTesting(true);
        setTestResult(null);

        try {
            const start = Date.now();
            let res;
            if (selectedApi === 'products') {
                res = await fetch(`${productsEndpoint}?limit=${limit}&in_stock_only=true`, {
                    headers: { 'x-api-key': activeKey, 'Accept': 'application/json' }
                });
            } else if (selectedApi === 'payments') {
                res = await fetch(paymentsEndpoint, {
                    method: 'POST',
                    headers: { 'x-api-key': activeKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: Number(paymentAmount) || 5000,
                        customer_email: customerEmail || 'buyer@example.com'
                    })
                });
            } else if (selectedApi === 'orders') {
                res = await fetch(`${ordersEndpoint}?limit=${limit}`, {
                    headers: { 'x-api-key': activeKey, 'Accept': 'application/json' }
                });
            } else {
                res = await fetch(analyticsEndpoint, {
                    headers: { 'x-api-key': activeKey, 'Accept': 'application/json' }
                });
            }
            const elapsed = Date.now() - start;
            const data = await res.json();
            setTestResult({
                status: res.status,
                time: elapsed,
                data: data
            });
        } catch (e) {
            setTestResult({ status: 500, time: 0, data: { error: e.message } });
        } finally {
            setTesting(false);
        }
    };

    const codeSamples = {
        curl: selectedApi === 'products'
            ? `curl -X GET "${productsEndpoint}?limit=20&in_stock_only=true" \\\n  -H "x-api-key: ${activeKey}"`
            : selectedApi === 'payments'
            ? `curl -X POST "${paymentsEndpoint}" \\\n  -H "x-api-key: ${activeKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount": 5000, "customer_email": "buyer@example.com"}'`
            : selectedApi === 'orders'
            ? `curl -X GET "${ordersEndpoint}?limit=10" \\\n  -H "x-api-key: ${activeKey}"`
            : `curl -X GET "${analyticsEndpoint}" \\\n  -H "x-api-key: ${activeKey}"`,
        javascript: selectedApi === 'products'
            ? `const res = await fetch("${productsEndpoint}?limit=20", {\n  headers: { "x-api-key": "${activeKey}" }\n});\nconst result = await res.json();\nconsole.log(result.data);`
            : selectedApi === 'payments'
            ? `const res = await fetch("${paymentsEndpoint}", {\n  method: "POST",\n  headers: { "x-api-key": "${activeKey}", "Content-Type": "application/json" },\n  body: JSON.stringify({ amount: 5000, customer_email: "buyer@example.com" })\n});\nconst { data } = await res.json();\nconsole.log(data.checkout_url);`
            : selectedApi === 'orders'
            ? `const res = await fetch("${ordersEndpoint}?limit=10", {\n  headers: { "x-api-key": "${activeKey}" }\n});\nconst { data } = await res.json();\nconsole.log(data);`
            : `const res = await fetch("${analyticsEndpoint}", {\n  headers: { "x-api-key": "${activeKey}" }\n});\nconst { inventory_summary, sales_summary } = await res.json();\nconsole.log(sales_summary);`,
        python: selectedApi === 'products'
            ? `import requests\nres = requests.get("${productsEndpoint}", headers={"x-api-key": "${activeKey}"})\nprint(res.json())`
            : selectedApi === 'payments'
            ? `import requests\npayload = {"amount": 5000, "customer_email": "buyer@example.com"}\nres = requests.post("${paymentsEndpoint}", headers={"x-api-key": "${activeKey}"}, json=payload)\nprint(res.json())`
            : selectedApi === 'orders'
            ? `import requests\nres = requests.get("${ordersEndpoint}?limit=10", headers={"x-api-key": "${activeKey}"})\nprint(res.json())`
            : `import requests\nres = requests.get("${analyticsEndpoint}", headers={"x-api-key": "${activeKey}"})\nprint(res.json())`
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header Card with Clean White Theme */}
            <View style={styles.headerCard}>
                <View style={styles.headerTop}>
                    {onBack && (
                        <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.7}>
                            <Ionicons name="arrow-back" size={20} color={SLATE_800} />
                        </TouchableOpacity>
                    )}
                    <View style={styles.badgePill}>
                        <Ionicons name="shield-checkmark" size={13} color="#0D9488" />
                        <Text style={styles.badgePillText}>REST & Payments • abumafhal.com</Text>
                    </View>
                </View>

                <Text style={styles.title}>Developer API & Gateways</Text>
                <Text style={styles.subTitle}>
                    Integrate your storefront with Products, Orders, and Instant Payment Gateways directly via official APIs.
                </Text>

                {accessStatus === 'loading' ? (
                    <View style={{ paddingVertical: 16, alignItems: 'center' }}>
                        <ActivityIndicator size="small" color={TEAL} />
                        <Text style={{ fontSize: 11, color: SLATE_500, marginTop: 4 }}>Checking API permissions...</Text>
                    </View>
                ) : accessStatus === 'pending' ? (
                    <View style={[styles.lockCard, styles.lockCardPending]}>
                        <View style={styles.lockHeaderRow}>
                            <Ionicons name="time-outline" size={20} color="#D97706" />
                            <Text style={[styles.lockTitle, { color: '#B45309' }]}>Access Request Pending Review</Text>
                        </View>
                        <Text style={[styles.lockDesc, { color: '#92400E' }]}>
                            Your developer API access application is currently being reviewed by an administrator. Key generation is locked until approved.
                        </Text>
                        {accessRequest?.note ? (
                            <View style={styles.lockNoteBox}>
                                <Text style={styles.lockNoteText}>&quot;{accessRequest.note}&quot;</Text>
                            </View>
                        ) : null}
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="lock-closed" size={14} color="#D97706" />
                            <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#B45309' }}>
                                Awaiting Admin Approval
                            </Text>
                        </View>
                    </View>
                ) : accessStatus === 'rejected' ? (
                    <View style={[styles.lockCard, styles.lockCardRejected]}>
                        <View style={styles.lockHeaderRow}>
                            <Ionicons name="close-circle-outline" size={20} color="#E11D48" />
                            <Text style={[styles.lockTitle, { color: '#BE123C' }]}>Access Request Declined</Text>
                        </View>
                        <Text style={[styles.lockDesc, { color: '#9F1239' }]}>
                            {accessRequest?.admin_note ? `Admin feedback: ${accessRequest.admin_note}` : 'Your request was not approved. Please provide more details about your integration use case.'}
                        </Text>
                        <TextInput
                            value={requestNote}
                            onChangeText={setRequestNote}
                            placeholder="Explain your updated integration use case..."
                            placeholderTextColor="#94A3B8"
                            style={styles.lockInput}
                        />
                        <TouchableOpacity
                            onPress={submitAccessRequest}
                            disabled={requestingAccess}
                            style={[styles.lockBtn, { backgroundColor: SLATE_900 }]}
                        >
                            {requestingAccess ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="paper-plane-outline" size={15} color="#FFFFFF" />
                                    <Text style={styles.lockBtnText}>Re-apply for API Access</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : accessStatus === 'not_requested' ? (
                    <View style={styles.lockCard}>
                        <View style={styles.lockHeaderRow}>
                            <Ionicons name="lock-closed" size={20} color="#D9A73A" />
                            <Text style={styles.lockTitle}>Developer API Access Locked</Text>
                        </View>
                        <Text style={styles.lockDesc}>
                            In accordance with marketplace security policy, vendors must submit an integration request and receive admin approval before generating API keys.
                        </Text>
                        <TextInput
                            value={requestNote}
                            onChangeText={setRequestNote}
                            placeholder="Intended use case (e.g., custom mobile app, ERP/POS sync)..."
                            placeholderTextColor="#94A3B8"
                            style={styles.lockInput}
                        />
                        <TouchableOpacity
                            onPress={submitAccessRequest}
                            disabled={requestingAccess}
                            style={styles.lockBtn}
                        >
                            {requestingAccess ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="shield-checkmark-outline" size={15} color="#FFFFFF" />
                                    <Text style={styles.lockBtnText}>Request Developer Access</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    <>
                        {/* Key Type Selector: Live vs Test */}
                        <View style={styles.modeSelectorRow}>
                            <TouchableOpacity
                                onPress={() => setKeyMode('live')}
                                style={[styles.modeBtn, keyMode === 'live' && styles.modeBtnActiveLive]}
                            >
                                <Ionicons name="radio-button-on" size={13} color={keyMode === 'live' ? '#FFFFFF' : '#10B981'} />
                                <Text style={[styles.modeBtnText, keyMode === 'live' && styles.modeBtnTextActive]}>Live Keys</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => setKeyMode('test')}
                                style={[styles.modeBtn, keyMode === 'test' && styles.modeBtnActiveTest]}
                            >
                                <Ionicons name="flask-outline" size={13} color={keyMode === 'test' ? '#FFFFFF' : '#F59E0B'} />
                                <Text style={[styles.modeBtnText, keyMode === 'test' && styles.modeBtnTextActive]}>Sandbox Test Keys</Text>
                            </TouchableOpacity>
                        </View>

                        <TouchableOpacity
                            onPress={generateNewKey}
                            disabled={generating}
                            style={styles.genBtn}
                            activeOpacity={0.85}
                        >
                            {generating ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <>
                                    <Ionicons name="sparkles" size={16} color="#FFFFFF" />
                                    <Text style={styles.genBtnText}>Generate New {keyMode.toUpperCase()} Key</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </View>

            {/* Keys Management Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="key-outline" size={18} color="#0D9488" />
                    <Text style={styles.cardTitle}>API Credentials</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="small" color={TEAL} />
                        <Text style={styles.loadingTxt}>Loading credentials...</Text>
                    </View>
                ) : apiKeys.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="key-outline" size={32} color="#94A3B8" />
                        <Text style={styles.emptyTitle}>No API Keys Found</Text>
                        <Text style={styles.emptySub}>Click &quot;Generate New Key&quot; above to create a key.</Text>
                    </View>
                ) : (
                    apiKeys.map(k => {
                        const isTest = k.key_type === 'test' || k.api_key.includes('_test_');
                        const isRev = revealed[k.id || k.api_key];
                        const dispKey = isRev ? k.api_key : `${k.api_key.substring(0, 14)}••••••••••••••••••••`;

                        return (
                            <View key={k.id || k.api_key} style={styles.keyBox}>
                                <View style={styles.keyHeaderRow}>
                                    <Text style={styles.keyName}>{k.key_name || (isTest ? 'Sandbox Test Key' : 'Production Live Key')}</Text>
                                    <View style={[styles.activeBadge, isTest && { backgroundColor: '#FEF3C7' }]}>
                                        <Text style={[styles.activeBadgeText, isTest && { color: '#B45309' }]}>
                                            {isTest ? 'TEST KEY' : 'LIVE KEY'}
                                        </Text>
                                    </View>
                                </View>

                                <View style={styles.keyDisplayRow}>
                                    <Text style={styles.keyText} numberOfLines={1}>
                                        {dispKey}
                                    </Text>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                        <TouchableOpacity
                                            onPress={() => toggleReveal(k.id || k.api_key)}
                                            style={styles.iconMiniBtn}
                                        >
                                            <Ionicons name={isRev ? "eye-off-outline" : "eye-outline"} size={16} color={SLATE_600} />
                                        </TouchableOpacity>
                                        <TouchableOpacity
                                            onPress={() => copyKeyText(k.api_key)}
                                            style={styles.copyPill}
                                        >
                                            <Ionicons
                                                name={copiedKey === k.api_key ? "checkmark" : "copy-outline"}
                                                size={14}
                                                color="#0D9488"
                                            />
                                            <Text style={styles.copyPillText}>
                                                {copiedKey === k.api_key ? "Copied" : "Copy"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.keyFooterRow}>
                                    <Text style={styles.keyMeta}>
                                        Requests: <Text style={{ fontWeight: 'bold', color: SLATE_800 }}>{k.total_requests || 0}</Text>
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => revokeKey(k.id)}
                                        style={styles.revokeBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                        <Text style={styles.revokeText}>Revoke</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Interactive Playground (Products vs Payments vs Orders) */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="terminal-outline" size={18} color="#0D9488" />
                    <Text style={styles.cardTitle}>Live Playground</Text>
                </View>

                {/* API Switcher */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                    <View style={styles.apiSwitchRow}>
                        <TouchableOpacity
                            onPress={() => { setSelectedApi('products'); setTestResult(null); }}
                            style={[styles.apiSwitchBtn, selectedApi === 'products' && styles.apiSwitchActiveTeal]}
                        >
                            <Text style={[styles.apiSwitchText, selectedApi === 'products' && styles.apiSwitchTextActive]}>
                                📦 Products
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setSelectedApi('payments'); setTestResult(null); }}
                            style={[styles.apiSwitchBtn, selectedApi === 'payments' && styles.apiSwitchActiveIndigo]}
                        >
                            <Text style={[styles.apiSwitchText, selectedApi === 'payments' && styles.apiSwitchTextActive]}>
                                💳 Payments
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setSelectedApi('orders'); setTestResult(null); }}
                            style={[styles.apiSwitchBtn, selectedApi === 'orders' && styles.apiSwitchActiveDark]}
                        >
                            <Text style={[styles.apiSwitchText, selectedApi === 'orders' && styles.apiSwitchTextActive]}>
                                📋 Orders
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={() => { setSelectedApi('analytics'); setTestResult(null); }}
                            style={[styles.apiSwitchBtn, selectedApi === 'analytics' && { backgroundColor: '#7C3AED' }]}
                        >
                            <Text style={[styles.apiSwitchText, selectedApi === 'analytics' && styles.apiSwitchTextActive]}>
                                📊 Telemetry
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>

                {selectedApi === 'products' ? (
                    <View style={styles.filterRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Limit</Text>
                            <TextInput
                                value={limit}
                                onChangeText={setLimit}
                                keyboardType="numeric"
                                style={styles.input}
                                placeholder="5"
                            />
                        </View>
                    </View>
                ) : selectedApi === 'payments' ? (
                    <View style={styles.filterRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Amount (₦)</Text>
                            <TextInput
                                value={paymentAmount}
                                onChangeText={setPaymentAmount}
                                keyboardType="numeric"
                                style={styles.input}
                                placeholder="5000"
                            />
                        </View>
                        <View style={{ flex: 2 }}>
                            <Text style={styles.inputLabel}>Buyer Email</Text>
                            <TextInput
                                value={customerEmail}
                                onChangeText={setCustomerEmail}
                                style={styles.input}
                                placeholder="buyer@example.com"
                            />
                        </View>
                    </View>
                ) : selectedApi === 'orders' ? (
                    <View style={styles.filterRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Orders Limit</Text>
                            <TextInput
                                value={limit}
                                onChangeText={setLimit}
                                keyboardType="numeric"
                                style={styles.input}
                                placeholder="5"
                            />
                        </View>
                    </View>
                ) : (
                    <View style={{ padding: 10, backgroundColor: '#F5F3FF', borderRadius: 10, marginBottom: 12 }}>
                        <Text style={{ fontSize: 11, color: '#6D28D9', fontWeight: 'bold' }}>
                            📊 Real-Time Storefront Telemetry & Inventory Metrics
                        </Text>
                        <Text style={{ fontSize: 10, color: '#7C3AED', marginTop: 2 }}>
                            Aggregates gross sales in ₦, active catalog count, and gateway latency.
                        </Text>
                    </View>
                )}

                <TouchableOpacity
                    onPress={testEndpointLive}
                    disabled={testing}
                    style={[
                        styles.testBtn,
                        selectedApi === 'payments' && { backgroundColor: '#4F46E5' },
                        selectedApi === 'orders' && { backgroundColor: SLATE_900 },
                        selectedApi === 'analytics' && { backgroundColor: '#7C3AED' }
                    ]}
                    activeOpacity={0.8}
                >
                    {testing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="play" size={14} color="#FFFFFF" />
                            <Text style={styles.testBtnText}>
                                Send Test Request ({selectedApi === 'products' ? 'GET Products' : selectedApi === 'payments' ? 'POST Payment Session' : selectedApi === 'orders' ? 'GET Orders' : 'GET Analytics Telemetry'})
                            </Text>
                        </>
                    )}
                </TouchableOpacity>

                {testResult && (
                    <View style={styles.jsonBox}>
                        <View style={styles.jsonHeader}>
                            <Text style={styles.jsonStatus}>
                                HTTP {testResult.status} OK • {testResult.time}ms
                            </Text>
                            <TouchableOpacity onPress={() => copyKeyText(JSON.stringify(testResult.data, null, 2))}>
                                <Text style={styles.jsonCopy}>Copy JSON</Text>
                            </TouchableOpacity>
                        </View>

                        {/* Visual Preview for Products if available */}
                        {selectedApi === 'products' && Array.isArray(testResult.data?.data) && testResult.data.data.length > 0 && (
                            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ paddingVertical: 10 }}>
                                <View style={{ flexDirection: 'row', gap: 10 }}>
                                    {testResult.data.data.slice(0, 5).map((prod) => (
                                        <View key={prod.id} style={styles.mobileProductCard}>
                                            {prod.primary_image ? (
                                                <Image source={{ uri: prod.primary_image }} style={styles.mobileProductImg} resizeMode="contain" />
                                            ) : (
                                                <View style={styles.mobileProductImgPlaceholder}>
                                                    <Ionicons name="cube-outline" size={24} color="#94A3B8" />
                                                </View>
                                            )}
                                            <Text numberOfLines={1} style={styles.mobileProductName}>{prod.name}</Text>
                                            <Text style={styles.mobileProductPrice}>₦{Number(prod.price).toLocaleString()}</Text>
                                            <View style={styles.mobileStockBadge}>
                                                <Text style={styles.mobileStockBadgeText}>{prod.available_stock} in stock</Text>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            </ScrollView>
                        )}

                        {/* Visual Preview for Payments Checkout */}
                        {selectedApi === 'payments' && testResult.data?.data?.checkout_url && (
                            <View style={styles.paymentSuccessBox}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <Ionicons name="checkmark-circle" size={16} color="#059669" />
                                    <Text style={{ fontWeight: 'bold', fontSize: 13, color: '#065F46' }}>Session Initialized</Text>
                                </View>
                                <Text style={{ fontSize: 11, color: '#047857' }}>Ref: {testResult.data.data.reference}</Text>
                                <Text style={{ fontSize: 11, color: '#047857', fontWeight: 'bold' }}>Amount: ₦{Number(testResult.data.data.amount).toLocaleString()}</Text>
                            </View>
                        )}

                        {/* Visual Preview for Analytics */}
                        {selectedApi === 'analytics' && testResult.data?.inventory_summary && (
                            <View style={{ backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, marginVertical: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                                    <View>
                                        <Text style={{ fontSize: 10, color: SLATE_500, fontWeight: 'bold' }}>GROSS REVENUE</Text>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: SLATE_900 }}>
                                            ₦{Number(testResult.data.sales_summary?.gross_revenue || 0).toLocaleString()}
                                        </Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={{ fontSize: 10, color: SLATE_500, fontWeight: 'bold' }}>ACTIVE LISTINGS</Text>
                                        <Text style={{ fontSize: 14, fontWeight: 'bold', color: TEAL }}>
                                            {testResult.data.inventory_summary?.active_listings || 0}
                                        </Text>
                                    </View>
                                </View>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: 6, borderTopWidth: 1, borderTopColor: '#E2E8F0' }}>
                                    <Text style={{ fontSize: 10, color: '#D97706', fontWeight: 'bold' }}>
                                        ⚠️ {testResult.data.inventory_summary?.low_stock_warning || 0} Low Stock
                                    </Text>
                                    <Text style={{ fontSize: 10, color: '#059669', fontWeight: 'bold' }}>
                                        ● {testResult.data.api_health?.gateway_status || 'OPERATIONAL'}
                                    </Text>
                                </View>
                            </View>
                        )}

                        <ScrollView horizontal style={{ maxHeight: 180, marginTop: 8 }}>
                            <Text style={styles.jsonText}>{JSON.stringify(testResult.data, null, 2)}</Text>
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* Code Examples in English */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="code-slash-outline" size={18} color="#4F46E5" />
                    <Text style={styles.cardTitle}>Code Integration Samples</Text>
                </View>

                <View style={styles.langTabsRow}>
                    {['curl', 'javascript', 'python'].map(l => (
                        <TouchableOpacity
                            key={l}
                            onPress={() => setActiveLang(l)}
                            style={[styles.langTab, activeLang === l && styles.langTabActive]}
                        >
                            <Text style={[styles.langTabText, activeLang === l && styles.langTabTextActive]}>
                                {l.toUpperCase()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                <View style={styles.codeSnippetCard}>
                    <ScrollView horizontal style={{ paddingVertical: 4 }}>
                        <Text style={styles.codeText}>{codeSamples[activeLang]}</Text>
                    </ScrollView>
                    <TouchableOpacity
                        onPress={() => copyKeyText(codeSamples[activeLang])}
                        style={styles.snippetCopy}
                    >
                        <Ionicons name="copy-outline" size={13} color="#0D9488" />
                        <Text style={styles.snippetCopyText}>Copy Code</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Webhooks & Real-Time Event Dispatch */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="flash-outline" size={18} color="#8B5CF6" />
                    <Text style={styles.cardTitle}>Webhooks & Real-Time Events</Text>
                </View>
                <Text style={{ fontSize: 12, color: SLATE_600, marginBottom: 12, lineHeight: 17 }}>
                    Receive instant webhook notifications at your endpoint for automated order fulfillment and payment verification.
                </Text>

                <View style={{ gap: 8 }}>
                    <View style={styles.webhookEventRow}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' }} />
                        <Text style={styles.webhookEventName}>order.created</Text>
                        <Text style={styles.webhookEventDesc}>New customer store order</Text>
                    </View>
                    <View style={styles.webhookEventRow}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#00BFA5' }} />
                        <Text style={styles.webhookEventName}>payment.success</Text>
                        <Text style={styles.webhookEventDesc}>Direct payment confirmed</Text>
                    </View>
                    <View style={styles.webhookEventRow}>
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#F59E0B' }} />
                        <Text style={styles.webhookEventName}>stock.low_alert</Text>
                        <Text style={styles.webhookEventDesc}>Stock below 5 items</Text>
                    </View>
                </View>
            </View>

            {/* HTTP Response Standards */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="pulse-outline" size={18} color="#0284C7" />
                    <Text style={styles.cardTitle}>HTTP Response Standards</Text>
                </View>
                <View style={{ gap: 8 }}>
                    <View style={styles.httpCodeRow}>
                        <Text style={[styles.httpCodeBadge, { backgroundColor: '#DEF7EC', color: '#03543F' }]}>200 OK</Text>
                        <Text style={styles.httpCodeDesc}>Success. Returns data and pagination.</Text>
                    </View>
                    <View style={styles.httpCodeRow}>
                        <Text style={[styles.httpCodeBadge, { backgroundColor: '#FEF08A', color: '#854D0E' }]}>401 Unauthorized</Text>
                        <Text style={styles.httpCodeDesc}>Missing or invalid x-api-key header.</Text>
                    </View>
                    <View style={styles.httpCodeRow}>
                        <Text style={[styles.httpCodeBadge, { backgroundColor: '#FEE2E2', color: '#991B1B' }]}>403 Forbidden</Text>
                        <Text style={styles.httpCodeDesc}>Revoked or expired API credential.</Text>
                    </View>
                </View>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: BG_LIGHT
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40
    },
    headerCard: {
        backgroundColor: CARD_BG,
        borderRadius: 24,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BORDER_LIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
        elevation: 1
    },
    headerTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: '#CCFBF1',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    badgePillText: {
        color: '#0F766E',
        fontSize: 11,
        fontWeight: 'bold'
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: SLATE_900,
        marginBottom: 6
    },
    subTitle: {
        fontSize: 13,
        color: SLATE_600,
        lineHeight: 18,
        marginBottom: 14
    },
    modeSelectorRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
        backgroundColor: '#F1F5F9',
        padding: 4,
        borderRadius: 12
    },
    modeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 9
    },
    modeBtnActiveLive: {
        backgroundColor: '#10B981',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1
    },
    modeBtnActiveTest: {
        backgroundColor: '#F59E0B',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 1
    },
    modeBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
        color: SLATE_600
    },
    modeBtnTextActive: {
        color: '#FFFFFF'
    },
    genBtn: {
        backgroundColor: '#0F766E',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 14
    },
    genBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold'
    },
    card: {
        backgroundColor: CARD_BG,
        borderRadius: 20,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: BORDER_LIGHT,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 2,
        elevation: 1
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10
    },
    cardTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: SLATE_900
    },
    apiSwitchRow: {
        flexDirection: 'row',
        gap: 6,
        backgroundColor: '#F1F5F9',
        padding: 4,
        borderRadius: 12,
        marginBottom: 12
    },
    apiSwitchBtn: {
        flex: 1,
        paddingVertical: 8,
        alignItems: 'center',
        borderRadius: 8
    },
    apiSwitchActiveTeal: {
        backgroundColor: '#0F766E'
    },
    apiSwitchActiveIndigo: {
        backgroundColor: '#4F46E5'
    },
    apiSwitchActiveDark: {
        backgroundColor: SLATE_900
    },
    apiSwitchText: {
        fontSize: 11,
        fontWeight: 'bold',
        color: SLATE_600
    },
    apiSwitchTextActive: {
        color: '#FFFFFF'
    },
    loadingBox: {
        paddingVertical: 20,
        alignItems: 'center',
        gap: 6
    },
    loadingTxt: {
        fontSize: 12,
        color: SLATE_500
    },
    emptyBox: {
        paddingVertical: 24,
        alignItems: 'center',
        gap: 6
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: SLATE_800
    },
    emptySub: {
        fontSize: 12,
        color: SLATE_500,
        textAlign: 'center',
        maxWidth: 240
    },
    keyBox: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: BORDER_LIGHT
    },
    keyHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6
    },
    keyName: {
        fontSize: 13,
        fontWeight: 'bold',
        color: SLATE_900
    },
    activeBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8
    },
    activeBadgeText: {
        color: '#15803D',
        fontSize: 10,
        fontWeight: 'bold'
    },
    keyDisplayRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        padding: 8,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: BORDER_LIGHT
    },
    keyText: {
        flex: 1,
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: SLATE_800,
        marginRight: 6
    },
    iconMiniBtn: {
        padding: 4
    },
    copyPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#CCFBF1',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    copyPillText: {
        color: '#0F766E',
        fontSize: 11,
        fontWeight: 'bold'
    },
    keyFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    keyMeta: {
        fontSize: 11,
        color: SLATE_500
    },
    revokeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    revokeText: {
        color: '#EF4444',
        fontSize: 11,
        fontWeight: 'bold'
    },
    filterRow: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 12
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: 'bold',
        color: SLATE_600,
        marginBottom: 4
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: BORDER_LIGHT,
        borderRadius: 10,
        paddingHorizontal: 10,
        paddingVertical: 6,
        fontSize: 12,
        color: SLATE_800
    },
    testBtn: {
        backgroundColor: '#0F766E',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10
    },
    testBtnText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: 'bold'
    },
    jsonBox: {
        marginTop: 12,
        backgroundColor: '#0F172A',
        borderRadius: 12,
        padding: 12
    },
    jsonHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 6,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        paddingBottom: 4
    },
    jsonStatus: {
        color: '#34D399',
        fontSize: 11,
        fontWeight: 'bold'
    },
    jsonCopy: {
        color: '#38BDF8',
        fontSize: 11,
        fontWeight: 'bold'
    },
    jsonText: {
        color: '#A7F3D0',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace'
    },
    langTabsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 10
    },
    langTab: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        backgroundColor: '#F1F5F9'
    },
    langTabActive: {
        backgroundColor: '#0F766E'
    },
    langTabText: {
        color: SLATE_600,
        fontSize: 11,
        fontWeight: 'bold'
    },
    langTabTextActive: {
        color: '#FFFFFF'
    },
    codeSnippetCard: {
        backgroundColor: '#0F172A',
        borderRadius: 12,
        padding: 12
    },
    codeText: {
        color: '#E2E8F0',
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        lineHeight: 18
    },
    snippetCopy: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 4,
        marginTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#1E293B',
        paddingTop: 6
    },
    snippetCopyText: {
        color: '#38BDF8',
        fontSize: 11,
        fontWeight: 'bold'
    },
    mobileProductCard: {
        width: 140,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1
    },
    mobileProductImg: {
        width: '100%',
        height: 70,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        marginBottom: 6
    },
    mobileProductImgPlaceholder: {
        width: '100%',
        height: 70,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6
    },
    mobileProductName: {
        fontSize: 11,
        fontWeight: 'bold',
        color: SLATE_900,
        marginBottom: 2
    },
    mobileProductPrice: {
        fontSize: 11,
        fontWeight: '900',
        color: '#0F766E',
        marginBottom: 4
    },
    mobileStockBadge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        backgroundColor: '#DCFCE7'
    },
    mobileStockBadgeText: {
        fontSize: 9,
        fontWeight: 'bold',
        color: '#166534'
    },
    paymentSuccessBox: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 10,
        padding: 10,
        marginBottom: 8
    },
    webhookEventRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#F8FAFC',
        padding: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    webhookEventName: {
        fontSize: 11,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: SLATE_900,
        width: 110
    },
    webhookEventDesc: {
        fontSize: 11,
        color: SLATE_600,
        flex: 1
    },
    httpCodeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 4
    },
    httpCodeBadge: {
        fontSize: 10,
        fontWeight: 'bold',
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6
    },
    httpCodeDesc: {
        fontSize: 11,
        color: SLATE_600,
        flex: 1
    },
    lockCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 16,
        marginTop: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2
    },
    lockCardPending: {
        backgroundColor: '#FFFBEB',
        borderColor: '#FDE68A'
    },
    lockCardRejected: {
        backgroundColor: '#FFF1F2',
        borderColor: '#FECDD3'
    },
    lockHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 8
    },
    lockTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: SLATE_900
    },
    lockDesc: {
        fontSize: 12,
        color: SLATE_600,
        lineHeight: 18,
        marginBottom: 12
    },
    lockInput: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#CBD5E1',
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 12,
        color: SLATE_900,
        marginBottom: 10
    },
    lockBtn: {
        backgroundColor: TEAL,
        borderRadius: 10,
        paddingVertical: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6
    },
    lockBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold'
    },
    lockNoteBox: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#FDE68A',
        borderRadius: 8,
        padding: 8,
        marginBottom: 8
    },
    lockNoteText: {
        fontSize: 11,
        color: '#92400E',
        fontStyle: 'italic'
    }
});
