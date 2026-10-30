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
    const [keyMode, setKeyMode] = useState('live'); // 'live' or 'test'
    const [selectedApi, setSelectedApi] = useState('products'); // 'products' or 'payments'
    const [revealed, setRevealed] = useState({});

    // Playground parameters
    const [limit, setLimit] = useState('5');
    const [paymentAmount, setPaymentAmount] = useState('5000');
    const [customerEmail, setCustomerEmail] = useState('buyer@example.com');

    const vendorId = user?.id || vendor?.id;
    const officialDomain = 'https://www.abumafhal.com';
    const productsEndpoint = `${officialDomain}/api/v1/products`;
    const paymentsEndpoint = `${officialDomain}/api/v1/payments`;

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
                if (json?.status === 'success' && Array.isArray(json?.data)) {
                    setApiKeys(json.data);
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

    const generateNewKey = async () => {
        if (!vendorId) return;
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
                const msg = `Sabon ${keyMode.toUpperCase()} Key ya hadu cikin nasara a abumafhal.com!`;
                if (Platform.OS === 'web') alert(msg);
                else Alert.alert('Nasarar Kirkira', msg);
                await loadApiKeys();
            } else {
                throw new Error(result.message || 'Matsala wajen kirkirar key');
            }
        } catch (err) {
            const errTxt = err.message || 'Kuskure ya faru';
            if (Platform.OS === 'web') alert(errTxt);
            else Alert.alert('Kuskure', errTxt);
        } finally {
            setGenerating(false);
        }
    };

    const revokeKey = async (keyId) => {
        const confirmMsg = 'Shin kana da tabbacin kana son goge wannan API Key din?';
        const doRevoke = async () => {
            try {
                const res = await fetch(`${officialDomain}/api/v1/vendor-keys`, {
                    method: 'DELETE',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ vendor_id: vendorId, key_id: keyId })
                });
                if (res.ok) {
                    setApiKeys(prev => prev.filter(k => k.id !== keyId));
                    if (Platform.OS === 'web') alert('An goge API Key cikin nasara');
                    else Alert.alert('An Goge', 'API Key ya goge');
                }
            } catch (e) {
                console.error(e);
            }
        };

        if (Platform.OS === 'web') {
            if (window.confirm(confirmMsg)) doRevoke();
        } else {
            Alert.alert('Goge API Key', confirmMsg, [
                { text: 'A fasa', style: 'cancel' },
                { text: 'Goge', style: 'destructive', onPress: doRevoke }
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

    const activeKey = apiKeys.find(k => k.is_active !== false)?.api_key || 'abumafhal_live_YOUR_KEY';

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
            } else {
                res = await fetch(paymentsEndpoint, {
                    method: 'POST',
                    headers: { 'x-api-key': activeKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: Number(paymentAmount) || 5000,
                        customer_email: customerEmail || 'buyer@example.com'
                    })
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
            : `curl -X POST "${paymentsEndpoint}" \\\n  -H "x-api-key: ${activeKey}" \\\n  -H "Content-Type: application/json" \\\n  -d '{"amount": 5000, "customer_email": "buyer@example.com"}'`,
        javascript: selectedApi === 'products'
            ? `const res = await fetch("${productsEndpoint}?limit=20", {\n  headers: { "x-api-key": "${activeKey}" }\n});\nconst result = await res.json();\nconsole.log(result.data);`
            : `const res = await fetch("${paymentsEndpoint}", {\n  method: "POST",\n  headers: { "x-api-key": "${activeKey}", "Content-Type": "application/json" },\n  body: JSON.stringify({ amount: 5000, customer_email: "buyer@example.com" })\n});\nconst { data } = await res.json();\nconsole.log("Pay URL:", data.checkout_url);`,
        python: selectedApi === 'products'
            ? `import requests\nres = requests.get("${productsEndpoint}", headers={"x-api-key": "${activeKey}"})\nprint(res.json())`
            : `import requests\npayload = {"amount": 5000, "customer_email": "buyer@example.com"}\nres = requests.post("${paymentsEndpoint}", headers={"x-api-key": "${activeKey}"}, json=payload)\nprint(res.json())`
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

                <Text style={styles.title}>Developer API & Payments</Text>
                <Text style={styles.subTitle}>
                    Kira kayan shago (Products, Price, Images, Stock) da karɓar kuɗin ciniki (Payment Gateway) kai tsaye.
                </Text>

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
                        <Text style={[styles.modeBtnText, keyMode === 'test' && styles.modeBtnTextActive]}>Test Keys (Sandbox)</Text>
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
                            <Text style={styles.genBtnText}>Samar da Sabon {keyMode.toUpperCase()} Key</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Keys Management Card */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="key-outline" size={18} color="#0D9488" />
                    <Text style={styles.cardTitle}>API Keys Dinka</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="small" color={TEAL} />
                        <Text style={styles.loadingTxt}>Ana duba keys...</Text>
                    </View>
                ) : apiKeys.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="key-outline" size={32} color="#94A3B8" />
                        <Text style={styles.emptyTitle}>Baka da API Key a halin yanzu</Text>
                        <Text style={styles.emptySub}>Danna maballin &quot;Samar da Sabon Key&quot; a sama don samun key.</Text>
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
                                                {copiedKey === k.api_key ? "An Kwafa" : "Kwafa"}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>

                                <View style={styles.keyFooterRow}>
                                    <Text style={styles.keyMeta}>
                                        Kira: <Text style={{ fontWeight: 'bold', color: SLATE_800 }}>{k.total_requests || 0}</Text>
                                    </Text>
                                    <TouchableOpacity
                                        onPress={() => revokeKey(k.id)}
                                        style={styles.revokeBtn}
                                        activeOpacity={0.7}
                                    >
                                        <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                        <Text style={styles.revokeText}>Goge</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                )}
            </View>

            {/* Interactive Playground (Products vs Payments) */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="terminal-outline" size={18} color="#0D9488" />
                    <Text style={styles.cardTitle}>Gwajin API Live (Playground)</Text>
                </View>

                {/* API Switcher */}
                <View style={styles.apiSwitchRow}>
                    <TouchableOpacity
                        onPress={() => { setSelectedApi('products'); setTestResult(null); }}
                        style={[styles.apiSwitchBtn, selectedApi === 'products' && styles.apiSwitchActiveTeal]}
                    >
                        <Text style={[styles.apiSwitchText, selectedApi === 'products' && styles.apiSwitchTextActive]}>
                            📦 Products API
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => { setSelectedApi('payments'); setTestResult(null); }}
                        style={[styles.apiSwitchBtn, selectedApi === 'payments' && styles.apiSwitchActiveIndigo]}
                    >
                        <Text style={[styles.apiSwitchText, selectedApi === 'payments' && styles.apiSwitchTextActive]}>
                            💳 Payments API
                        </Text>
                    </TouchableOpacity>
                </View>

                {selectedApi === 'products' ? (
                    <View style={styles.filterRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.inputLabel}>Adadi (Limit)</Text>
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
                )}

                <TouchableOpacity
                    onPress={testEndpointLive}
                    disabled={testing}
                    style={[styles.testBtn, selectedApi === 'payments' && { backgroundColor: '#4F46E5' }]}
                    activeOpacity={0.8}
                >
                    {testing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                            <Ionicons name="play" size={14} color="#FFFFFF" />
                            <Text style={styles.testBtnText}>
                                Tura Gwajin Request ({selectedApi === 'products' ? 'GET Products' : 'POST Create Payment'})
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
                                <Text style={styles.jsonCopy}>Kwafi JSON</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal style={{ maxHeight: 220 }}>
                            <Text style={styles.jsonText}>{JSON.stringify(testResult.data, null, 2)}</Text>
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* Code Examples */}
            <View style={styles.card}>
                <View style={styles.cardHeader}>
                    <Ionicons name="code-slash-outline" size={18} color="#4F46E5" />
                    <Text style={styles.cardTitle}>Misalan Code na Haɗawa</Text>
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
                        <Text style={styles.snippetCopyText}>Kwafi Code</Text>
                    </TouchableOpacity>
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
    cardDesc: {
        fontSize: 12,
        color: SLATE_500,
        marginBottom: 12
    },
    apiSwitchRow: {
        flexDirection: 'row',
        gap: 8,
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
    apiSwitchText: {
        fontSize: 12,
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
    }
});
