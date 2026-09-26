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
    const { settings, refreshSettings } = useAppSettings();
    const activeSettings = testSettings || settings || {};

    const [checking, setChecking] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Pulse animation for alert badge
    const pulseAnim = useRef(new Animated.Value(1)).current;

    useEffect(() => {
        const pulse = Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.06,
                    duration: 1200,
                    useNativeDriver: true
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 1200,
                    useNativeDriver: true
                })
            ])
        );
        pulse.start();
        return () => pulse.stop();
    }, []);

    // Get current app version from Expo config or fallback
    const currentAppVersion = useMemo(() => {
        return (
            Constants.expoConfig?.version ||
            Constants.manifest?.version ||
            '1.0.0'
        );
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

        const backHandler = BackHandler.addEventListener(
            'hardwareBackPress',
            () => {
                // Return true to prevent going back
                return true;
            }
        );

        return () => backHandler.remove();
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
            // Artificial small delay for UX feel
            await new Promise(r => setTimeout(r, 800));
        } catch (_) {
        } finally {
            setChecking(false);
        }
    };

    // Parse release notes into array
    const releaseNotesList = useMemo(() => {
        const raw = activeSettings.update_release_notes;
        if (!raw) {
            return [
                'Inganta saurin manhaja da sauƙin amfani',
                'Sabon tsarin VIP Pass da katin shaida mai lambar QR',
                'Kariyar asusu da ingantaccen tsaron biyan kuɗi',
                'Gyaran kurakurai da sauƙaƙa saye da sayarwa'
            ];
        }

        if (Array.isArray(raw)) return raw;

        return String(raw)
            .split('\n')
            .map(line => line.replace(/^[•\-\*0-9\.\s]+/, '').trim())
            .filter(Boolean);
    }, [activeSettings.update_release_notes]);

    if (!isVisible) return null;

    return (
        <Modal
            visible={isVisible}
            transparent={true}
            animationType="fade"
            statusBarTranslucent={true}
            onRequestClose={() => {
                // If mandatory, do nothing (cannot close)
                if (!isMandatory) {
                    setDismissed(true);
                }
            }}
        >
            <View style={styles.overlay}>
                <View style={styles.cardContainer}>
                    {/* Glowing Accent Top Bar */}
                    <View style={styles.topAccentGlow} />

                    <ScrollView
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={styles.scrollContent}
                    >
                        {/* Header Badges */}
                        <View style={styles.headerRow}>
                            {/* Play Store Badge */}
                            <View style={styles.playStoreBadge}>
                                <Ionicons name="logo-google-playstore" size={24} color="#00E676" />
                                <View style={styles.playBadgeTextWrap}>
                                    <Text style={styles.playBadgeTitle}>Google Play</Text>
                                    <Text style={styles.playBadgeSub}>Official Store</Text>
                                </View>
                            </View>

                            {/* Abu Mafhal Logo / Crest */}
                            <View style={styles.brandCrest}>
                                <Ionicons name="shield-checkmark" size={18} color="#D9A73A" />
                                <Text style={styles.brandCrestTxt}>ABU MAFHAL</Text>
                            </View>
                        </View>

                        {/* Animated Alert Badge */}
                        <Animated.View
                            style={[
                                styles.alertPill,
                                isMandatory ? styles.alertPillMandatory : styles.alertPillOptional,
                                { transform: [{ scale: pulseAnim }] }
                            ]}
                        >
                            <Ionicons
                                name={isMandatory ? 'alert-circle' : 'sparkles'}
                                size={16}
                                color={isMandatory ? '#EF4444' : '#F59E0B'}
                            />
                            <Text
                                style={[
                                    styles.alertPillText,
                                    { color: isMandatory ? '#EF4444' : '#F59E0B' }
                                ]}
                            >
                                {isMandatory
                                    ? '⚠️ DOLE NE KAYI UPDATE KAFIN KA SHIGA'
                                    : '✨ SABON UPDATE YA FITO'}
                            </Text>
                        </Animated.View>

                        {/* Title */}
                        <Text style={styles.mainTitle}>
                            {activeSettings.update_title || 'Sabon Version Ya Fito A Play Store!'}
                        </Text>

                        {/* Version Comparison Indicator */}
                        <View style={styles.versionRow}>
                            <View style={styles.versionBox}>
                                <Text style={styles.versionLabel}>Wanda Ke Wayarka</Text>
                                <View style={styles.versionValueWrap}>
                                    <Ionicons name="phone-portrait-outline" size={13} color="#94A3B8" />
                                    <Text style={styles.versionOldValue}>v{currentAppVersion}</Text>
                                </View>
                            </View>

                            <View style={styles.versionArrowWrap}>
                                <Ionicons name="arrow-forward" size={18} color="#D9A73A" />
                            </View>

                            <View style={[styles.versionBox, styles.versionBoxNew]}>
                                <Text style={[styles.versionLabel, { color: '#00E676' }]}>Sabuwar Sigar</Text>
                                <View style={styles.versionValueWrap}>
                                    <Ionicons name="cloud-download-outline" size={13} color="#00E676" />
                                    <Text style={styles.versionNewValue}>v{latestAppVersion}</Text>
                                </View>
                            </View>
                        </View>

                        {/* Message Description */}
                        <Text style={styles.descriptionText}>
                            {activeSettings.update_message ||
                                'Muna bukatar kayi update na manhajar Abu Mafhal zuwa sabon version domin samun sabbin fasaloli da ingantaccen tsaro kafin ka shiga.'}
                        </Text>

                        {/* Release Notes Section */}
                        <View style={styles.releaseNotesCard}>
                            <View style={styles.notesHeader}>
                                <Ionicons name="gift-outline" size={15} color="#D9A73A" />
                                <Text style={styles.notesTitle}>
                                    ABINDA KE CIKIN SABON VERSION (WHAT'S NEW)
                                </Text>
                            </View>

                            <View style={styles.notesList}>
                                {releaseNotesList.map((item, idx) => (
                                    <View key={idx} style={styles.noteItem}>
                                        <View style={styles.noteCheckDot}>
                                            <Ionicons name="checkmark" size={12} color="#10B981" />
                                        </View>
                                        <Text style={styles.noteText}>{item}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>

                        {/* Google Play Store Main CTA */}
                        <TouchableOpacity
                            onPress={handleOpenPlayStore}
                            activeOpacity={0.88}
                            style={styles.playStoreBtn}
                        >
                            <View style={styles.playBtnIconWrap}>
                                <Ionicons name="logo-google-playstore" size={26} color="#FFFFFF" />
                            </View>
                            <View style={styles.playBtnTextWrap}>
                                <Text style={styles.playBtnAction}>YI UPDATE YANZU A PLAY STORE</Text>
                                <Text style={styles.playBtnSub}>Bude Google Play Store Domin Saukewa</Text>
                            </View>
                            <Ionicons name="open-outline" size={20} color="#FFFFFF" />
                        </TouchableOpacity>

                        {/* Check Again Button */}
                        <TouchableOpacity
                            onPress={handleCheckAgain}
                            disabled={checking}
                            style={styles.checkBtn}
                            activeOpacity={0.7}
                        >
                            {checking ? (
                                <ActivityIndicator size="small" color="#D9A73A" />
                            ) : (
                                <Ionicons name="refresh-outline" size={16} color="#D9A73A" />
                            )}
                            <Text style={styles.checkBtnText}>
                                {checking ? 'Ana Dubawa...' : 'Na Riga Na Yi Update (Duba Kuma)'}
                            </Text>
                        </TouchableOpacity>

                        {/* Optional Close button (ONLY visible if not mandatory or in test mode) */}
                        {(!isMandatory || testMode) && (
                            <TouchableOpacity
                                onPress={() => {
                                    if (testMode && onClosePreview) {
                                        onClosePreview();
                                    } else {
                                        setDismissed(true);
                                    }
                                }}
                                style={styles.laterBtn}
                            >
                                <Text style={styles.laterBtnText}>
                                    {testMode ? 'Rufe Gwaji (Close Preview)' : 'Ci gaba a yanzu (Remind me later)'}
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
        backgroundColor: 'rgba(5, 11, 20, 0.94)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 24
    },
    cardContainer: {
        width: '100%',
        maxWidth: 460,
        maxHeight: SCREEN_HEIGHT * 0.92,
        backgroundColor: '#0E1726',
        borderRadius: 28,
        borderWidth: 1.5,
        borderColor: '#1E293B',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 16 },
        shadowOpacity: 0.5,
        shadowRadius: 30,
        elevation: 24
    },
    topAccentGlow: {
        height: 4,
        width: '100%',
        backgroundColor: '#00E676'
    },
    scrollContent: {
        padding: 22,
        alignItems: 'center'
    },
    headerRow: {
        width: '100%',
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    playStoreBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 230, 118, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(0, 230, 118, 0.25)',
        gap: 8
    },
    playBadgeTextWrap: {
        flexDirection: 'column'
    },
    playBadgeTitle: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.3
    },
    playBadgeSub: {
        color: '#00E676',
        fontSize: 9,
        fontWeight: '700',
        textTransform: 'uppercase'
    },
    brandCrest: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(217, 167, 58, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)'
    },
    brandCrestTxt: {
        color: '#D9A73A',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1
    },
    alertPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        marginBottom: 16
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
        fontSize: 11,
        fontWeight: '800',
        letterSpacing: 0.4
    },
    mainTitle: {
        color: '#F8FAFC',
        fontSize: 20,
        fontWeight: '900',
        textAlign: 'center',
        lineHeight: 27,
        marginBottom: 14
    },
    versionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        width: '100%',
        marginBottom: 14
    },
    versionBox: {
        flex: 1,
        backgroundColor: '#162235',
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 12,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#24344D'
    },
    versionBoxNew: {
        backgroundColor: 'rgba(0, 230, 118, 0.08)',
        borderColor: 'rgba(0, 230, 118, 0.35)'
    },
    versionLabel: {
        color: '#64748B',
        fontSize: 10,
        fontWeight: '700',
        marginBottom: 4,
        textTransform: 'uppercase'
    },
    versionValueWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    versionOldValue: {
        color: '#94A3B8',
        fontSize: 15,
        fontWeight: '800'
    },
    versionNewValue: {
        color: '#00E676',
        fontSize: 15,
        fontWeight: '900'
    },
    versionArrowWrap: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#1E293B',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#334155'
    },
    descriptionText: {
        color: '#CBD5E1',
        fontSize: 13,
        lineHeight: 20,
        textAlign: 'center',
        marginBottom: 18,
        paddingHorizontal: 6
    },
    releaseNotesCard: {
        width: '100%',
        backgroundColor: '#162235',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        borderColor: '#24344D',
        marginBottom: 20
    },
    notesHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#24344D',
        paddingBottom: 8
    },
    notesTitle: {
        color: '#D9A73A',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.6
    },
    notesList: {
        gap: 8
    },
    noteItem: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8
    },
    noteCheckDot: {
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(16, 185, 129, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 2
    },
    noteText: {
        flex: 1,
        color: '#E2E8F0',
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '500'
    },
    playStoreBtn: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#059669',
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        shadowColor: '#059669',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 8,
        marginBottom: 12
    },
    playBtnIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center'
    },
    playBtnTextWrap: {
        flex: 1,
        marginHorizontal: 12
    },
    playBtnAction: {
        color: '#FFFFFF',
        fontSize: 13,
        fontWeight: '900',
        letterSpacing: 0.4
    },
    playBtnSub: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 10,
        fontWeight: '600',
        marginTop: 2
    },
    checkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 7,
        paddingVertical: 11,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.4)',
        backgroundColor: 'rgba(217, 167, 58, 0.08)',
        width: '100%'
    },
    checkBtnText: {
        color: '#D9A73A',
        fontSize: 12,
        fontWeight: '800'
    },
    laterBtn: {
        marginTop: 10,
        paddingVertical: 8,
        paddingHorizontal: 16
    },
    laterBtnText: {
        color: '#64748B',
        fontSize: 12,
        fontWeight: '600',
        textDecorationLine: 'underline'
    }
});

export default ForceUpdateModal;
