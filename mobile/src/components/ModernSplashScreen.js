import React, { useEffect, useRef, useState } from 'react';
import {
    View,
    Text,
    Image,
    StyleSheet,
    Animated,
    Dimensions,
    Platform,
    StatusBar,
    Easing
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

const { width, height } = Dimensions.get('window');
const LOGO_IMG = require('../../assets/splash-icon.png');

export const ModernSplashScreen = ({ onFinish, minimumDuration = 1800 }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const scaleAnim = useRef(new Animated.Value(0.82)).current;
    const glowAnim = useRef(new Animated.Value(0.3)).current;
    const contentFade = useRef(new Animated.Value(0)).current;
    const progressAnim = useRef(new Animated.Value(0)).current;

    const [statusText, setStatusText] = useState('Initializing Escrow Engine...');

    useEffect(() => {
        // 1. Entrance animation sequence
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 500,
                useNativeDriver: true,
            }),
            Animated.spring(scaleAnim, {
                toValue: 1,
                friction: 6,
                tension: 40,
                useNativeDriver: true,
            }),
            Animated.timing(contentFade, {
                toValue: 1,
                duration: 700,
                delay: 200,
                useNativeDriver: true,
            }),
            Animated.timing(progressAnim, {
                toValue: 1,
                duration: minimumDuration - 300,
                easing: Easing.bezier(0.4, 0.0, 0.2, 1),
                useNativeDriver: false,
            }),
        ]).start();

        // 2. Subtle continuous breathing glow
        const glowLoop = Animated.loop(
            Animated.sequence([
                Animated.timing(glowAnim, {
                    toValue: 0.8,
                    duration: 800,
                    useNativeDriver: true,
                }),
                Animated.timing(glowAnim, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: true,
                }),
            ])
        );
        glowLoop.start();

        // 3. Dynamic status text simulation
        const statusTimer1 = setTimeout(() => {
            setStatusText('Verifying Vault Security...');
        }, 700);

        const statusTimer2 = setTimeout(() => {
            setStatusText('Connecting to Marketplace...');
        }, 1300);

        // 4. Smooth exit transition
        const exitTimer = setTimeout(() => {
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 0,
                    duration: 400,
                    useNativeDriver: true,
                }),
                Animated.timing(scaleAnim, {
                    toValue: 1.05,
                    duration: 400,
                    useNativeDriver: true,
                }),
            ]).start(() => {
                glowLoop.stop();
                if (onFinish) onFinish();
            });
        }, minimumDuration);

        return () => {
            clearTimeout(statusTimer1);
            clearTimeout(statusTimer2);
            clearTimeout(exitTimer);
            glowLoop.stop();
        };
    }, []);

    const progressWidth = progressAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0%', '100%'],
    });

    return (
        <Animated.View style={[styles.overlayContainer, { opacity: fadeAnim }]}>
            <StatusBar barStyle="light-content" backgroundColor="#070F1E" translucent />
            <LinearGradient
                colors={['#050B16', '#0A192F', '#0D1E32']}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={styles.gradientContainer}
            >
                {/* Background Ambient Decorative Circles */}
                <View style={styles.ambientTopCircle} />
                <View style={styles.ambientBottomCircle} />

                {/* Center Content */}
                <View style={styles.centerSection}>
                    {/* Glowing Crest Frame */}
                    <View style={styles.crestWrapper}>
                        <Animated.View
                            style={[
                                styles.crestHaloGlow,
                                {
                                    opacity: glowAnim,
                                    transform: [{ scale: glowAnim.interpolate({
                                        inputRange: [0.3, 0.8],
                                        outputRange: [0.95, 1.1]
                                    }) }]
                                }
                            ]}
                        />
                        <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
                            <View style={styles.crestBorder}>
                                <Image
                                    source={LOGO_IMG}
                                    style={styles.crestLogo}
                                    resizeMode="contain"
                                />
                            </View>
                        </Animated.View>
                    </View>

                    {/* Brand Typography */}
                    <Animated.View style={[styles.typographyBlock, { opacity: contentFade }]}>
                        <View style={styles.brandTitleRow}>
                            <Text style={styles.brandTitleAbu}>ABU </Text>
                            <Text style={styles.brandTitleMafhal}>MAFHAL</Text>
                        </View>
                        <Text style={styles.brandSubtitle}>ONLINE MARKETPLACE</Text>
                        <View style={styles.goldDivider} />
                        <Text style={styles.brandTagline}>Buy. Sell. Earn. Grow Together.</Text>
                    </Animated.View>
                </View>

                {/* Bottom Progress & Trust Badges */}
                <Animated.View style={[styles.bottomSection, { opacity: contentFade }]}>
                    {/* Sleek Progress Track */}
                    <View style={styles.progressTrackWrapper}>
                        <View style={styles.progressTrack}>
                            <Animated.View style={[styles.progressBar, { width: progressWidth }]} />
                        </View>
                        <Text style={styles.statusText}>{statusText}</Text>
                    </View>

                    {/* Trust & Security Badge */}
                    <View style={styles.trustBadgeRow}>
                        <Ionicons name="shield-checkmark" size={13} color="#10B981" />
                        <Text style={styles.trustBadgeText}>100% Escrow Protection • CBN Regulated Banking</Text>
                    </View>

                    <Text style={styles.versionText}>Official Google Play Store Edition • v1.0.0</Text>
                </Animated.View>
            </LinearGradient>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    overlayContainer: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 999999,
        elevation: 999999,
        backgroundColor: '#070F1E',
    },
    gradientContainer: {
        flex: 1,
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: Platform.OS === 'ios' ? 60 : 40,
        paddingHorizontal: 24,
    },
    ambientTopCircle: {
        position: 'absolute',
        top: -height * 0.1,
        left: -width * 0.2,
        width: width * 0.8,
        height: width * 0.8,
        borderRadius: width * 0.4,
        backgroundColor: 'rgba(217, 167, 58, 0.05)',
    },
    ambientBottomCircle: {
        position: 'absolute',
        bottom: -height * 0.1,
        right: -width * 0.2,
        width: width * 0.9,
        height: width * 0.9,
        borderRadius: width * 0.45,
        backgroundColor: 'rgba(16, 185, 129, 0.04)',
    },
    centerSection: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
    },
    crestWrapper: {
        width: 140,
        height: 140,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 24,
    },
    crestHaloGlow: {
        position: 'absolute',
        width: 160,
        height: 160,
        borderRadius: 80,
        backgroundColor: 'rgba(217, 167, 58, 0.22)',
    },
    crestBorder: {
        width: 130,
        height: 130,
        borderRadius: 65,
        backgroundColor: '#0D1E32',
        borderWidth: 2,
        borderColor: '#D9A73A',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#D9A73A',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.35,
        shadowRadius: 16,
        elevation: 10,
    },
    crestLogo: {
        width: 110,
        height: 110,
        borderRadius: 55,
    },
    typographyBlock: {
        alignItems: 'center',
    },
    brandTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    brandTitleAbu: {
        fontSize: 26,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 3,
    },
    brandTitleMafhal: {
        fontSize: 26,
        fontWeight: '900',
        color: '#D9A73A',
        letterSpacing: 3,
    },
    brandSubtitle: {
        fontSize: 10,
        fontWeight: '800',
        color: '#94A3B8',
        letterSpacing: 4.5,
        marginTop: 4,
    },
    goldDivider: {
        width: 48,
        height: 2.5,
        backgroundColor: '#D9A73A',
        borderRadius: 2,
        marginVertical: 12,
    },
    brandTagline: {
        fontSize: 12,
        fontWeight: '600',
        color: '#E2E8F0',
        letterSpacing: 0.5,
    },
    bottomSection: {
        width: '100%',
        alignItems: 'center',
    },
    progressTrackWrapper: {
        width: '100%',
        maxWidth: 240,
        alignItems: 'center',
        marginBottom: 18,
    },
    progressTrack: {
        width: '100%',
        height: 3.5,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 2,
        overflow: 'hidden',
        marginBottom: 8,
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#D9A73A',
        borderRadius: 2,
    },
    statusText: {
        fontSize: 9.5,
        color: '#94A3B8',
        fontWeight: '600',
        letterSpacing: 0.3,
    },
    trustBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(16, 185, 129, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(16, 185, 129, 0.25)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 14,
        gap: 6,
        marginBottom: 10,
    },
    trustBadgeText: {
        color: '#10B981',
        fontSize: 9.5,
        fontWeight: '700',
        letterSpacing: 0.2,
    },
    versionText: {
        fontSize: 8.5,
        color: '#64748B',
        fontWeight: '500',
    },
});

export default ModernSplashScreen;
