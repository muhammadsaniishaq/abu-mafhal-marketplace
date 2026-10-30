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
    Share
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import { supabase } from '../lib/supabase';

const NAVY = '#070D1B';
const DARK_SURFACE = '#0E1A2E';
const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FDE68A';
const TEAL = '#00BFA5';

export const VendorApiKeys = ({ user, vendor, onBack }) => {
    const [apiKeys, setApiKeys] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [copiedKey, setCopiedKey] = useState(null);
    const [testResult, setTestResult] = useState(null);
    const [testing, setTesting] = useState(false);
    const [activeLang, setActiveLang] = useState('curl');

    const vendorId = user?.id || vendor?.id;
    const baseUrl = 'https://www.abumafhal.com';
    const productsEndpoint = `${baseUrl}/api/v1/products`;

    useEffect(() => {
        if (vendorId) {
            loadApiKeys();
        }
    }, [vendorId]);

    const loadApiKeys = async () => {
        setLoading(true);
        try {
            // 1. Fetch via API endpoint
            const res = await fetch(`${baseUrl}/api/v1/vendor-keys?vendor_id=${vendorId}`).catch(() => null);
            if (res && res.ok) {
                const json = await res.json();
                if (json?.status === 'success' && Array.isArray(json?.data)) {
                    setApiKeys(json.data);
                    setLoading(false);
                    return;
                }
            }

            // 2. Direct fallback to app_settings
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
            const res = await fetch(`${baseUrl}/api/v1/vendor-keys`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    vendor_id: vendorId,
                    key_name: 'Mobile App Developer Key'
                })
            });

            const result = await res.json();
            if (res.ok && result.status === 'success') {
                const msg = 'Sabon API Key ya hadu cikin nasara! Ka kiyaye shi a wuri mai tsaro.';
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
                const res = await fetch(`${baseUrl}/api/v1/vendor-keys`, {
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

    const activeKey = apiKeys.find(k => k.is_active !== false)?.api_key || 'abumafhal_live_YOUR_KEY';

    const testEndpointLive = async () => {
        setTesting(true);
        setTestResult(null);
        try {
            const res = await fetch(`${productsEndpoint}?limit=2`, {
                headers: { 'x-api-key': activeKey }
            });
            const data = await res.json();
            setTestResult(data);
        } catch (e) {
            setTestResult({ error: e.message });
        } finally {
            setTesting(false);
        }
    };

    const codeSamples = {
        curl: `curl -X GET "${productsEndpoint}?limit=20&in_stock_only=true" \\\n  -H "x-api-key: ${activeKey}"`,
        javascript: `const res = await fetch("${productsEndpoint}?limit=20", {\n  headers: { "x-api-key": "${activeKey}" }\n});\nconst { data } = await res.json();\nconsole.log(data);`,
        python: `import requests\nres = requests.get("${productsEndpoint}", headers={"x-api-key": "${activeKey}"})\nprint(res.json())`
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
            {/* Header / Hero */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                style={styles.heroCard}
            >
                <View style={styles.heroTop}>
                    <TouchableOpacity onPress={onBack} style={styles.backBtn} activeOpacity={0.8}>
                        <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                    <View style={styles.badgePill}>
                        <Ionicons name="code-slash" size={13} color={TEAL} />
                        <Text style={styles.badgePillText}>REST API v1</Text>
                    </View>
                </View>

                <Text style={styles.heroTitle}>Vendor Developer API</Text>
                <Text style={styles.heroSub}>
                    Kira kayanka kai tsaye daga Abu Mafhal zuwa kowane website ko application. Hotunan kaya (Images), Farashi (Price), da Adadin da ya rage (Stock).
                </Text>

                <TouchableOpacity
                    onPress={generateNewKey}
                    disabled={generating}
                    style={styles.genBtn}
                    activeOpacity={0.85}
                >
                    {generating ? (
                        <ActivityIndicator size="small" color="#070D1B" />
                    ) : (
                        <>
                          <Ionicons name="key" size={16} color="#070D1B" />
                          <Text style={styles.genBtnText}>Kirkiri Sabon API Key</Text>
                        </>
                    )}
                </TouchableOpacity>
            </LinearGradient>

            {/* Keys Section */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="key-outline" size={18} color={GOLD} />
                    <Text style={styles.sectionTitle}>API Keys Dinka</Text>
                </View>

                {loading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="small" color={TEAL} />
                        <Text style={styles.loadingTxt}>Ana duba keys...</Text>
                    </View>
                ) : apiKeys.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="shield-outline" size={32} color="#64748B" />
                        <Text style={styles.emptyTitle}>Baka da API Key a halin yanzu</Text>
                        <Text style={styles.emptySub}>Danna maballin &quot;Kirkiri Sabon API Key&quot; a sama don samun key.</Text>
                    </View>
                ) : (
                    apiKeys.map(k => (
                        <View key={k.id || k.api_key} style={styles.keyCard}>
                            <View style={styles.keyHeaderRow}>
                                <Text style={styles.keyName}>{k.key_name || 'Production Key'}</Text>
                                <View style={styles.activePill}>
                                    <Text style={styles.activePillText}>Active</Text>
                                </View>
                            </View>

                            <View style={styles.keyRow}>
                                <Text style={styles.keyText} numberOfLines={1} ellipsizeMode="middle">
                                    {k.api_key}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => copyKeyText(k.api_key)}
                                    style={styles.copyBtn}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons
                                        name={copiedKey === k.api_key ? "checkmark" : "copy-outline"}
                                        size={16}
                                        color={copiedKey === k.api_key ? "#10B981" : "#FFFFFF"}
                                    />
                                    <Text style={[styles.copyBtnText, copiedKey === k.api_key && { color: '#10B981' }]}>
                                        {copiedKey === k.api_key ? "An Kwafa" : "Kwafa"}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            <View style={styles.keyFooterRow}>
                                <Text style={styles.keyMeta}>
                                    Calls: <Text style={{ color: '#F1F5F9', fontWeight: 'bold' }}>{k.total_requests || 0}</Text>
                                </Text>
                                <TouchableOpacity
                                    onPress={() => revokeKey(k.id)}
                                    style={styles.revokeBtn}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="trash-outline" size={14} color="#EF4444" />
                                    <Text style={styles.revokeText}>Goge</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ))
                )}
            </View>

            {/* Live API Tester / Playground */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="terminal-outline" size={18} color={TEAL} />
                    <Text style={styles.sectionTitle}>Gwajin API Live (Playground)</Text>
                </View>
                <Text style={styles.descText}>
                    Danna maballin don duba ainihin sakamakon da wannan API yake bayarwa daga shagonka.
                </Text>

                <TouchableOpacity
                    onPress={testEndpointLive}
                    disabled={testing}
                    style={styles.testBtn}
                    activeOpacity={0.8}
                >
                    {testing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <>
                          <Ionicons name="play" size={15} color="#FFFFFF" />
                          <Text style={styles.testBtnText}>Tura Gwajin Request</Text>
                        </>
                    )}
                </TouchableOpacity>

                {testResult && (
                    <View style={styles.jsonBox}>
                        <View style={styles.jsonHeader}>
                            <Text style={styles.jsonStatus}>HTTP 200 OK • JSON Response</Text>
                            <TouchableOpacity onPress={() => copyKeyText(JSON.stringify(testResult, null, 2))}>
                                <Text style={styles.jsonCopy}>Kwafi</Text>
                            </TouchableOpacity>
                        </View>
                        <ScrollView horizontal style={{ maxHeight: 220 }}>
                            <Text style={styles.jsonText}>{JSON.stringify(testResult, null, 2)}</Text>
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* Code Examples */}
            <View style={styles.sectionCard}>
                <View style={styles.sectionHeader}>
                    <Ionicons name="code-working-outline" size={18} color="#A855F7" />
                    <Text style={styles.sectionTitle}>Misalan Code</Text>
                </View>

                {/* Tabs */}
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
                        <Ionicons name="copy-outline" size={13} color="#94A3B8" />
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
        backgroundColor: NAVY
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 40
    },
    heroCard: {
        borderRadius: 20,
        padding: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#334155'
    },
    heroTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 12
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(0,191,165,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(0,191,165,0.4)',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    badgePillText: {
        color: TEAL,
        fontSize: 11,
        fontWeight: 'bold'
    },
    heroTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 6
    },
    heroSub: {
        fontSize: 12,
        color: '#CBD5E1',
        lineHeight: 18,
        marginBottom: 16
    },
    genBtn: {
        backgroundColor: GOLD,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12
    },
    genBtnText: {
        color: '#070D1B',
        fontSize: 13,
        fontWeight: 'bold'
    },
    sectionCard: {
        backgroundColor: DARK_SURFACE,
        borderRadius: 18,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10
    },
    sectionTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        color: '#FFFFFF'
    },
    descText: {
        fontSize: 12,
        color: '#94A3B8',
        marginBottom: 12,
        lineHeight: 16
    },
    loadingBox: {
        paddingVertical: 24,
        alignItems: 'center',
        gap: 8
    },
    loadingTxt: {
        fontSize: 12,
        color: '#94A3B8'
    },
    emptyBox: {
        paddingVertical: 24,
        alignItems: 'center',
        gap: 6
    },
    emptyTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#E2E8F0'
    },
    emptySub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        maxWidth: 240
    },
    keyCard: {
        backgroundColor: '#070D1B',
        borderRadius: 14,
        padding: 14,
        marginBottom: 10,
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    keyHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8
    },
    keyName: {
        fontSize: 13,
        fontWeight: 'bold',
        color: '#FFFFFF'
    },
    activePill: {
        backgroundColor: 'rgba(16,185,129,0.15)',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 8
    },
    activePillText: {
        color: '#10B981',
        fontSize: 10,
        fontWeight: 'bold'
    },
    keyRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#0B1528',
        borderRadius: 10,
        padding: 8,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    keyText: {
        flex: 1,
        fontSize: 11,
        fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
        color: '#38BDF8',
        marginRight: 8
    },
    copyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#1E293B',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    copyBtnText: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '600'
    },
    keyFooterRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    keyMeta: {
        fontSize: 11,
        color: '#94A3B8'
    },
    revokeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    revokeText: {
        color: '#EF4444',
        fontSize: 11,
        fontWeight: '600'
    },
    testBtn: {
        backgroundColor: '#4F46E5',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        borderRadius: 10
    },
    testBtnText: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: 'bold'
    },
    jsonBox: {
        marginTop: 12,
        backgroundColor: '#050A14',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#1E293B'
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
        color: '#10B981',
        fontSize: 11,
        fontWeight: 'bold'
    },
    jsonCopy: {
        color: TEAL,
        fontSize: 11,
        fontWeight: 'bold'
    },
    jsonText: {
        color: '#34D399',
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
        backgroundColor: '#070D1B'
    },
    langTabActive: {
        backgroundColor: TEAL
    },
    langTabText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: 'bold'
    },
    langTabTextActive: {
        color: '#070D1B'
    },
    codeSnippetCard: {
        backgroundColor: '#050A14',
        borderRadius: 12,
        padding: 12,
        borderWidth: 1,
        borderColor: '#1E293B'
    },
    codeText: {
        color: '#CBD5E1',
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
        color: '#94A3B8',
        fontSize: 11
    }
});
