import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Linking,
    Platform,
    BackHandler,
    ScrollView,
    Animated,
    Dimensions,
    ActivityIndicator
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { useAppSettings } from '../context/AppSettingsContext';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

/**
 * Robust SemVer comparison
 * Returns:
 *   1 if v1 > v2
 *  -1 if v1 < v2
 *   0 if v1 === v2
 */
export const compareVersions = (v1, v2) => {
    if (!v1 || !v2) return 0;
    const clean1 = String(v1).replace(/^v/i, '').trim();
    const clean2 = String(v2).replace(/^v/i, '').trim();

    const parts1 = clean1.split('.').map(n => parseInt(n, 10) || 0);
    const parts2 = clean2.split('.').map(n => parseInt(n, 10) || 0);

    const maxLen = Math.max(parts1.length, parts2.length);
    for (let i = 0; i < maxLen; i++) {
        const p1 = parts1[i] || 0;
        const p2 = parts2[i] || 0;
        if (p1 > p2) return 1;
        if (p1 < p2) return -1;
    }
    return 0;
};

export const ForceUpdateModal = ({
    testMode = false,
    testSettings = null,
    onClosePreview = null
}) => {
    // 1. Never show in browser / web for live users!
    // Only display on native mobile app (Android / iOS) unless admin is in test preview mode.
    const isNativeMobile = Platform.OS === 'android' || Platform.OS === 'ios';
    if (!testMode && !isNativeMobile) {
        return null;
    }

    const { settings, refreshSettings } = useAppSettings();
    const activeSettings = testSettings || settings || {};

    const [checking, setChecking] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Subtle pulse animation for alert pill
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 1100,
                    useNativeDriver: true
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1100,
                    useNativeDriver: true
                })
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Get current app version from Expo config or fallback
    const currentAppVersion = useMemo(() => {
        try {
            return (
                Constants?.expoConfig?.version ||
                Constants?.manifest2?.extra?.expoClient?.version ||
                Constants?.manifest?.version ||
                '1.0.0'
            );
        } catch (_) {
            return '1.0.0';
        }
    }, []);

    const latestAppVersion = activeSettings.latest_app_version || '1.0.0';
    const minRequiredVersion = activeSettings.min_required_version || '1.0.0';
    const forceUpdateEnabled = !!activeSettings.force_update_enabled;
    const playStoreUrl =
        activeSettings.play_store_url ||
        'https://play.google.com/store/apps/details?id=com.abumafhal.app';

    // Update conditions
    // 1. Mandatory if current version is strictly lower than min_required_version
    const isBelowMin = compareVersions(currentAppVersion, minRequiredVersion) < 0;
    // 2. Outdated if current version is strictly lower than latest_app_version
    const isOutdated = compareVersions(currentAppVersion, latestAppVersion) < 0;

    // Is update strictly required / mandatory?
    const isMandatory = testMode ? true : (isBelowMin || (forceUpdateEnabled && isOutdated));

    // Show modal if either mandatory or (outdated and not dismissed yet)
    const isVisible = testMode ? true : ((isMandatory || isOutdated) && !dismissed);

    // Block hardware back button on Android when update is mandatory
    useEffect(() => {
        if (!isVisible || !isMandatory) return;

        let backHandler = null;
        try {
            backHandler = BackHandler.addEventListener(
                'hardwareBackPress',
                () => true
            );
        } catch (_) {}

        return () => {
            try {
                if (backHandler && backHandler.remove) {
                    backHandler.remove();
                }
            } catch (_) {}
        };
    }, [isVisible, isMandatory]);

    // Handle Open Google Play Store
    const handleOpenPlayStore = async () => {
        const androidMarketUrl = 'market://details?id=com.abumafhal.app';
        const targetWebUrl = playStoreUrl || 'https://play.google.com/store/apps/details?id=com.abumafhal.app';

        if (Platform.OS === 'android') {
            try {
                const canOpen = await Linking.canOpenURL(androidMarketUrl);
                if (canOpen) {
                    await Linking.openURL(androidMarketUrl);
                    return;
                }
            } catch (_) {}
        }

        try {
            await Linking.openURL(targetWebUrl);
        } catch (e) {
            console.warn('Could not open Play Store link:', e);
            if (Platform.OS === 'web' && typeof window !== 'undefined') {
                window.open(targetWebUrl, '_blank');
            }
        }
    };

    // Handle Check Again / Refresh
    const handleCheckAgain = async () => {
        setChecking(true);
        try {
            if (refreshSettings) {
                await refreshSettings();
            }
            await new Promise(r => setTimeout(r, 800));
        } catch (_) {
        } finally {
            setChecking(false);
        }
    };

    // Parse release notes into clean bullet array
    const releaseNotesList = useMemo(() => {
        const raw = activeSettings.update_release_notes;
        if (!raw) {
            return [
                'Inganta saurin manhaja da sauƙin lodi',
                'Kariyar asusu da ingantaccen tsaron biyan kuɗi',
                'Gyaran kurakurai da sauƙaƙa saye da sayarwa'
            ];
        }

        if (Array.isArray(raw)) return raw.slice(0, 4);

        return String(raw)
            .split('\n')
            .map(line => line.replace(/^[•\-\*0-9\.\s]+/, '').trim())
            .filter(Boolean)
            .slice(0, 4);
    }, [activeSettings.update_release_notes]);

    if (!isVisible) return null;

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={() => {
                if (!isMandatory) {
                    setDismissed(true);
                }
            }}
        >
            <View style={styles.overlay}>
                <View style={styles.compactCard}>
                    {/* Glowing Accent Line */}
                    <View style={[styles.glowLine, { backgroundColor: isMandatory ? '#EF4444' : '#10B981' }]} />

                    {/* Official Google Play Store Header Banner */}
                    <View style={styles.playStoreHeader}>
                        <View style={styles.playIconContainer}>
                            <Ionicons name="logo-google-playstore" size={26} color="#00E676" />
                        </View>
                        <View style={styles.playHeaderInfo}>
                            <View style={styles.googlePlayBrandRow}>
                                <Text style={styles.googleText}>Google</Text>
                                <Text style={styles.playText}>Play</Text>
                                <View style={styles.verifiedChip}>
                                    <Ionicons name="checkmark-circle" size={11} color="#00E676" />
                                    <Text style={styles.verifiedTxt}>Official</Text>
                                </View>
                            </View>
                            <Text style={styles.playSubText}>Abu Mafhal Marketplace</Text>
                        </View>

                        {/* Abu Mafhal Crest */}
                        <View style={styles.brandCrest}>
                            <Ionicons name="shield-checkmark" size={14} color="#D9A73A" />
                        </View>
                    </View>

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollBody}
                    >
                        {/* Alert Pill */}
                        <Animated.View
                            style={[
                                styles.alertPill,
                                isMandatory ? styles.alertPillMandatory : styles.alertPillOptional,
                                { transform: [{ scale: pulseAnim }] }
                            ]}
                        >
                            <Ionicons
                                name={isMandatory ? 'alert-circle' : 'sparkles'}
                                size={14}
                                color={isMandatory ? '#EF4444' : '#F59E0B'}
                            />
                            <Text
                                style={[
                                    styles.alertPillText,
                                    { color: isMandatory ? '#EF4444' : '#F59E0B' }
                                ]}
                            >
                                {isMandatory ? 'SABUNTAWA TA DOLE (REQUIRED)' : 'SABON UPDATE YA FITO'}
                            </Text>
                        </Animated.View>

                        {/* Title */}
                        <Text style={styles.titleText}>
                            {activeSettings.update_title || 'Sabon Version Ya Fito A Google Play!'}
                        </Text>

                        {/* Compact Version Comparison Chip */}
                        <View style={styles.versionChipRow}>
                            <View style={styles.versionChip}>
                                <Text style={styles.versionChipLabel}>Wanda Ke Wayarka</Text>
                                <Text style={styles.versionOldNum}>v{currentAppVersion}</Text>
                            </View>

                            <View style={styles.arrowIconWrap}>
                                <Ionicons name="arrow-forward" size={14} color="#D9A73A" />
                            </View>

                            <View style={[styles.versionChip, styles.versionChipNew]}>
                                <Text style={[styles.versionChipLabel, { color: '#00E676' }]}>Sabuwar Siga</Text>
                                <Text style={styles.versionNewNum}>v{latestAppVersion}</Text>
                            </View>
                        </View>

                        {/* Message Description */}
                        <Text style={styles.descriptionText}>
                            {activeSettings.update_message ||
                                'Muna bukatar kayi sabuntawa zuwa sabuwar sigar domin samun ingantaccen tsaro da saukin amfani.'}
                        </Text>

                        {/* Release Highlights */}
                        {releaseNotesList.length > 0 && (
                            <View style={styles.notesBox}>
                                <View style={styles.notesBoxHeader}>
                                    <Ionicons name="sparkles" size={12} color="#D9A73A" />
                                    <Text style={styles.notesBoxTitle}>ABUBUWAN DA AKA INGANTA</Text>
                                </View>
                                {releaseNotesList.map((item, idx) => (
                                    <View key={idx} style={styles.noteLine}>
                                        <Ionicons name="checkmark-circle" size={13} color="#10B981" />
                                        <Text style={styles.noteLineText} numberOfLines={2}>{item}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        {/* Primary Google Play Store Button */}
                        <TouchableOpacity
                            onPress={handleOpenPlayStore}
                            activeOpacity={0.85}
                            style={styles.googlePlayBtn}
                        >
                            <View style={styles.playStoreBtnIconWrap}>
                                <Ionicons name="logo-google-playstore" size={22} color="#FFFFFF" />
                            </View>
                            <View style={styles.playStoreBtnTextWrap}>
                                <Text style={styles.playStoreBtnSub}>SABUNTA KAI TSAYE A</Text>
                                <Text style={styles.playStoreBtnTitle}>Google Play Store</Text>
                            </View>
                            <Ionicons name="arrow-forward-circle" size={20} color="#FFFFFF" />
                        </TouchableOpacity>

                        {/* Secondary Check Again Button */}
                        <TouchableOpacity
                            onPress={handleCheckAgain}
                            disabled={checking}
                            style={styles.checkAgainBtn}
                            activeOpacity={0.7}
                        >
                            {checking ? (
                                <ActivityIndicator size="small" color="#D9A73A" />
                            ) : (
                                <Ionicons name="sync-outline" size={15} color="#D9A73A" />
                            )}
                            <Text style={styles.checkAgainBtnTxt}>
                                {checking ? 'Ana Dubawa...' : 'Na Riga Na Sabunta (Duba Kuma)'}
                            </Text>
                        </TouchableOpacity>

                        {/* Dismiss / Close Preview Button */}
                        {(!isMandatory || testMode) && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (testMode && onClosePreview) {
                                        onClosePreview();
                                    } else {
                                        setDismissed(true);
                                    }
                                }}
                                style={styles.closeBtn}
                            >
                                <Text style={styles.closeBtnTxt}>
                                    {testMode ? 'Rufe Gwaji (Close Preview)' : 'Ci gaba a yanzu (Remind later)'}
                                </Text>
                            </TouchableOpacity>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(2, 6, 17, 0.90)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 20
    },
    compactCard: {
        width: '100%',
        maxWidth: 380,
        maxHeight: SCREEN_HEIGHT * 0.82,
        backgroundColor: '#0F172A',
        borderRadius: 22,
        borderWidth: 1.5,
        borderColor: '#1E293B',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 14 },
        shadowOpacity: 0.55,
        shadowRadius: 24,
        elevation: 20
    },
    glowLine: {
        height: 3.5,
        width: '100%'
    },
    playStoreHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingTop: 14,
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#1E293B',
        backgroundColor: 'rgba(15, 23, 42, 0.6)'
    },
    playIconContainer: {
        width: 40,
        height: 40,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 230, 118, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0, 230, 118, 0.25)',
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12
    },
    playHeaderInfo: {
        flex: 1
    },
    googlePlayBrandRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3
    },
    googleText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.2
    },
    playText: {
        color: '#00E676',
        fontSize: 14,
        fontWeight: '900',
        letterSpacing: 0.2
    },
    verifiedChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        marginLeft: 6,
        backgroundColor: 'rgba(0, 230, 118, 0.12)',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 6
    },
    verifiedTxt: {
        color: '#00E676',
        fontSize: 9,
        fontWeight: '800'
    },
    playSubText: {
        color: '#94A3B8',
        fontSize: 11,
        fontWeight: '600',
        marginTop: 1
    },
    brandCrest: {
        width: 28,
        height: 28,
        borderRadius: 8,
        backgroundColor: 'rgba(217, 167, 58, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        justifyContent: 'center',
        alignItems: 'center'
    },
    scrollBody: {
        paddingHorizontal: 18,
        paddingTop: 14,
        paddingBottom: 18,
        alignItems: 'center'
    },
    alertPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 5,
        borderRadius: 16,
        borderWidth: 1,
        marginBottom: 10
    },
    alertPillMandatory: {
        backgroundColor: 'rgba(239, 68, 68, 0.12)',
        borderColor: 'rgba(239, 68, 68, 0.35)'
    },
    alertPillOptional: {
        backgroundColor: 'rgba(245, 158, 11, 0.12)',
        borderColor: 'rgba(245, 158, 11, 0.35)'
    },
    alertPillText: {
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    titleText: {
        color: '#F8FAFC',
        fontSize: 16,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 22,
        marginBottom: 10
    },
    versionChipRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        width: '100%',
        marginBottom: 10
    },
    versionChip: {
        flex: 1,
        backgroundColor: '#162235',
        borderRadius: 10,
        paddingVertical: 7,
        paddingHorizontal: 10,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#24344D'
    },
    versionChipNew: {
        backgroundColor: 'rgba(0, 230, 118, 0.08)',
        borderColor: 'rgba(0, 230, 118, 0.3)'
    },
    versionChipLabel: {
        color: '#64748B',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    versionOldNum: {
        color: '#94A3B8',
        fontSize: 13,
        fontWeight: '800',
        marginTop: 2
    },
    versionNewNum: {
        color: '#00E676',
        fontSize: 13,
        fontWeight: '900',
        marginTop: 2
    },
    arrowIconWrap: {
        width: 24,
        height: 24,
        borderRadius: 12,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center'
    },
    descriptionText: {
        color: '#94A3B8',
        fontSize: 12,
        lineHeight: 17,
        textAlign: 'center',
        marginBottom: 12,
        paddingHorizontal: 4
    },
    notesBox: {
        width: '100%',
        backgroundColor: '#162235',
        borderRadius: 12,
        padding: 10,
        borderWidth: 1,
        borderColor: '#24344D',
        marginBottom: 14,
        gap: 6
    },
    notesBoxHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 2
    },
    notesBoxTitle: {
        color: '#D9A73A',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.5
    },
    noteLine: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 6
    },
    noteLineText: {
        flex: 1,
        color: '#E2E8F0',
        fontSize: 11,
        lineHeight: 15,
        fontWeight: '500'
    },
    googlePlayBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#059669',
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 14,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
        marginBottom: 9
    },
    playStoreBtnIconWrap: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    playStoreBtnTextWrap: {
        flex: 1,
        marginHorizontal: 10
    },
    playStoreBtnSub: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 9,
        fontWeight: '700',
        letterSpacing: 0.3
    },
    playStoreBtnTitle: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.3
    },
    checkAgainBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.35)',
        backgroundColor: 'rgba(217, 167, 58, 0.08)',
        width: '100%'
    },
    checkAgainBtnTxt: {
        color: '#D9A73A',
        fontSize: 11,
        fontWeight: '800'
    },
    closeBtn: {
        marginTop: 8,
        paddingVertical: 5,
        paddingHorizontal: 12
    },
    closeBtnTxt: {
        color: '#64748B',
        fontSize: 11,
        fontWeight: '600',
        textDecorationLine: 'underline'
    }
});

export default ForceUpdateModal;
