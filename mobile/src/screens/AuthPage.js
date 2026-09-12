import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image,
    Alert, ActivityIndicator, StyleSheet, Dimensions,
    StatusBar, KeyboardAvoidingView, Platform, ScrollView,
    Animated, Modal
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { NotificationService } from '../lib/notifications';
import { sendOtpEmail } from '../services/simpleEmailService';
import { whatsappService } from '../services/whatsappService';
import { useAppSettings } from '../context/AppSettingsContext';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

export const AuthPage = ({ route, onBack, onLoginSuccess }) => {
    const insets = useSafeAreaInsets();
    const { params } = route || {};
    const codeFromLink = params?.code;
    const { settings } = useAppSettings();

    // ── UI States ─────────────────────────────────────────────────────────────
    const [isLogin, setIsLogin] = useState(!codeFromLink); // true = Login, false = Signup
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [timer, setTimer] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    // ── Form States ───────────────────────────────────────────────────────────
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otp, setOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState(null);
    const [referralCode, setReferralCode] = useState(codeFromLink || '');
    const [referrerName, setReferrerName] = useState(null);

    // Animations
    const tabAnim = useRef(new Animated.Value(isLogin ? 0 : 1)).current;
    const fadeAnim = useRef(new Animated.Value(1)).current;

    // Countdown Timer for OTP
    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // Check Referrer
    useEffect(() => {
        if (referralCode && referralCode.length >= 6) {
            checkReferrer();
        } else {
            setReferrerName(null);
        }
    }, [referralCode]);

    const checkReferrer = async () => {
        try {
            const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('referral_code', referralCode.toUpperCase())
                .maybeSingle();

            if (data && data.full_name) {
                setReferrerName(data.full_name);
            } else {
                setReferrerName(null);
            }
        } catch {
            setReferrerName(null);
        }
    };

    const handleSwitchTab = (loginTab) => {
        setIsLogin(loginTab);
        setErrorMsg('');
        Animated.timing(tabAnim, {
            toValue: loginTab ? 0 : 1,
            duration: 200,
            useNativeDriver: false,
        }).start();
    };

    // ── Auth Action (Login or OTP Trigger) ────────────────────────────────────
    const handleAuthAction = async () => {
        setErrorMsg('');
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').trim();

        if (!cleanEmail || !cleanPassword) {
            setErrorMsg('Please enter both your email address and password.');
            return;
        }

        if (!isLogin && (!fullName.trim() || !phone.trim())) {
            setErrorMsg('Please enter your full name and phone number.');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                // ── LOGIN FLOW ──
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: cleanEmail,
                    password: cleanPassword,
                });

                if (error) throw error;

                // Non-blocking fire-and-forget security note
                (async () => {
                    try {
                        let ipAddress = 'Unknown IP';
                        const ipRes = await fetch('https://api.ipify.org?format=json', { signal: AbortSignal.timeout(2000) }).catch(() => null);
                        if (ipRes) {
                            const ipData = await ipRes.json().catch(() => ({}));
                            ipAddress = ipData.ip || 'Unknown IP';
                        }
                        await NotificationService.send({
                            userId: data.user.id,
                            title: 'New Login Detected 🛡️',
                            message: `New login to your Abu Mafhal account from IP: ${ipAddress}.`,
                            type: 'login',
                            email: cleanEmail
                        }).catch(() => {});
                    } catch {}
                })();

                if (onLoginSuccess) {
                    onLoginSuccess(data.user);
                } else {
                    Alert.alert('Welcome Back', 'Logged in successfully!');
                }

            } else {
                // ── SIGNUP FLOW (Send OTP) ──
                // Check if email already registered
                const { data: existingUser } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', cleanEmail)
                    .maybeSingle();

                if (existingUser) {
                    setErrorMsg('An account with this email already exists. Please sign in.');
                    setLoading(false);
                    return;
                }

                const code = Math.floor(100000 + Math.random() * 900000).toString();
                setGeneratedOtp(code);

                await sendOtpEmail({ email: cleanEmail, otp: code });
                setOtpSent(true);
                setTimer(60);
            }
        } catch (error) {
            const rawMsg = error?.message || error?.error_description || 'Authentication failed.';
            if (rawMsg.toLowerCase().includes('invalid login credentials')) {
                setErrorMsg('Incorrect email or password. Please try again.');
            } else if (rawMsg.includes('Email not confirmed')) {
                setErrorMsg('Your email is not confirmed yet. Please verify your email inbox.');
            } else {
                setErrorMsg(rawMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    // ── Verify OTP & Complete Signup ─────────────────────────────────────────
    const handleVerifyOtp = async () => {
        setErrorMsg('');
        if (!otp || otp.length !== 6) {
            setErrorMsg('Please enter the complete 6-digit verification code.');
            return;
        }

        setLoading(true);
        try {
            if (generatedOtp && otp.trim() !== generatedOtp.trim()) {
                throw new Error('Invalid verification code. Please check and try again.');
            }

            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPassword = (password || '').trim();

            const { data, error } = await supabase.auth.signUp({
                email: cleanEmail,
                password: cleanPassword,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        phone_number: phone.trim(),
                    }
                }
            });

            if (error) throw error;
            const user = data.user;
            const session = data.session;

            if (user && !session) {
                Alert.alert(
                    'Verification Sent',
                    'Your account has been created! Please click the activation link in your email to activate your account.',
                    [{ text: 'Sign In', onPress: () => { setOtpSent(false); setIsLogin(true); } }]
                );
                return;
            }

            if (!user) throw new Error('Account creation could not be completed. Please try again.');

            // Upsert profile
            await supabase.from('profiles').upsert([{
                id: user.id,
                email: cleanEmail,
                full_name: fullName.trim(),
                phone_number: phone.trim(),
                role: 'buyer',
                is_verified: true,
                is_banned: false
            }]);

            // Referral processing if code exists
            if (referralCode.trim()) {
                const { data: referrer } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('referral_code', referralCode.trim().toUpperCase())
                    .maybeSingle();

                if (referrer && referrer.id !== user.id) {
                    await supabase.rpc('process_referral_reward', {
                        p_new_user_id: user.id,
                        p_referrer_id: referrer.id
                    }).catch(() => {});
                }
            }

            // Create initial wallet
            await supabase.from('wallets').insert([{
                user_id: user.id,
                balance: 0.00,
                currency: 'NGN',
                is_active: true
            }]).catch(() => {});

            // Welcome notifications
            NotificationService.send({
                userId: user.id,
                title: 'Welcome to Abu Mafhal! 🎉',
                message: 'Your account is ready. Discover thousands of great products now!',
                type: 'welcome',
                email: cleanEmail
            }).catch(() => {});

            if (phone) {
                whatsappService.sendDirect(
                    phone,
                    'Welcome to Abu Mafhal! Your account has been successfully created. We are excited to have you on board.',
                    user.id
                ).catch(() => {});
            }

            Alert.alert('Welcome!', 'Account created and verified successfully!');
            if (onLoginSuccess) onLoginSuccess(user);

        } catch (error) {
            setErrorMsg(error.message || 'Verification failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        setLoading(true);
        setErrorMsg('');
        try {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(code);
            await sendOtpEmail({ email: (email || '').trim().toLowerCase(), otp: code });
            setTimer(60);
            Alert.alert('Code Sent', `A new 6-digit code has been sent to ${email}.`);
        } catch (e) {
            setErrorMsg(e.message || 'Failed to resend code.');
        } finally {
            setLoading(false);
        }
    };

    const handleForgotPassword = async () => {
        if (!forgotEmail.trim()) {
            Alert.alert('Required', 'Please enter your account email address.');
            return;
        }
        setForgotLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase());
            if (error) throw error;
            Alert.alert(
                'Password Reset Sent',
                'We have sent password reset instructions to your email address. Please check your inbox and spam folder.',
                [{ text: 'OK', onPress: () => setShowForgotModal(false) }]
            );
        } catch (err) {
            Alert.alert('Error', err.message || 'Could not send reset email. Please try again.');
        } finally {
            setForgotLoading(false);
        }
    };

    const tabTranslateX = tabAnim.interpolate({
        inputRange: [0, 1],
        outputRange: [4, (width - 40) / 2],
    });

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="#0A192F" />

            {/* ── TOP NAV HEADER ── */}
            <View style={[s.topHeader, { paddingTop: Math.max(insets.top, 16) }]}>
                <TouchableOpacity
                    onPress={onBack}
                    style={s.backBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
                </TouchableOpacity>

                <View style={s.headerLogoWrap}>
                    <Image source={AM_LOGO} style={s.headerLogoImg} resizeMode="contain" />
                    <View>
                        <Text style={s.headerLogoTitle}>
                            ABU <Text style={{ color: '#00D2FF' }}>MAFHAL</Text>
                        </Text>
                        <Text style={s.headerLogoSub}>YOUR MARKETPLACE, YOUR CHOICE.</Text>
                    </View>
                </View>

                <View style={{ width: 40 }} />
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40, paddingTop: 16 }}
                >
                    {/* ── HERO GREETING CARD ── */}
                    <View style={s.heroBanner}>
                        <LinearGradient
                            colors={['#0A192F', '#0E2A4D', '#133E68']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                        />
                        <View style={s.heroBadge}>
                            <Ionicons name="shield-checkmark" size={14} color="#F59E0B" />
                            <Text style={s.heroBadgeTxt}>SECURE ACCESS</Text>
                        </View>
                        <Text style={s.heroHeading}>
                            {otpSent
                                ? 'Verify Email'
                                : (isLogin ? 'Welcome Back 👋' : 'Join Abu Mafhal 🚀')}
                        </Text>
                        <Text style={s.heroSub}>
                            {otpSent
                                ? `Enter the 6-digit verification code sent to ${email}`
                                : (isLogin
                                    ? 'Access your orders, wishlist, and favourite stores'
                                    : 'Create an account to shop from verified sellers across Nigeria')}
                        </Text>
                    </View>

                    {/* ── ERROR MESSAGE BANNER ── */}
                    {errorMsg !== '' && (
                        <View style={s.errorBanner}>
                            <Ionicons name="alert-circle" size={18} color="#EF4444" />
                            <Text style={s.errorBannerTxt}>{errorMsg}</Text>
                        </View>
                    )}

                    {/* ── REFERRAL WELCOME BANNER ── */}
                    {!otpSent && !isLogin && referrerName && (
                        <View style={s.referralBanner}>
                            <Ionicons name="gift" size={20} color="#10B981" />
                            <Text style={s.referralBannerTxt}>
                                <Text style={{ fontWeight: '900' }}>{referrerName}</Text> invited you! Sign up now to claim your welcome bonus.
                            </Text>
                        </View>
                    )}

                    {!otpSent ? (
                        <View style={s.cardContainer}>
                            {/* ── SEGMENTED SWITCH: LOGIN vs SIGNUP ── */}
                            <View style={s.segmentedContainer}>
                                <Animated.View
                                    style={[
                                        s.activeIndicator,
                                        { transform: [{ translateX: tabTranslateX }], width: (width - 48) / 2 }
                                    ]}
                                />
                                <TouchableOpacity
                                    style={s.segmentedBtn}
                                    onPress={() => handleSwitchTab(true)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[s.segmentedTxt, isLogin && s.segmentedTxtActive]}>
                                        Sign In
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={s.segmentedBtn}
                                    onPress={() => handleSwitchTab(false)}
                                    activeOpacity={0.8}
                                >
                                    <Text style={[s.segmentedTxt, !isLogin && s.segmentedTxtActive]}>
                                        Create Account
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {/* ── SIGNUP FIELDS ── */}
                            {!isLogin && (
                                <>
                                    <View style={s.inputWrap}>
                                        <Text style={s.inputLabel}>Full Name</Text>
                                        <View style={s.inputBox}>
                                            <Ionicons name="person-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                            <TextInput
                                                style={s.textInput}
                                                placeholder="e.g. Aminu Bello"
                                                placeholderTextColor="#94A3B8"
                                                value={fullName}
                                                onChangeText={setFullName}
                                                autoCapitalize="words"
                                            />
                                        </View>
                                    </View>

                                    <View style={s.inputWrap}>
                                        <Text style={s.inputLabel}>Phone Number</Text>
                                        <View style={s.inputBox}>
                                            <Ionicons name="call-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                            <TextInput
                                                style={s.textInput}
                                                placeholder="08012345678"
                                                placeholderTextColor="#94A3B8"
                                                value={phone}
                                                onChangeText={setPhone}
                                                keyboardType="phone-pad"
                                            />
                                        </View>
                                    </View>
                                </>
                            )}

                            {/* ── EMAIL FIELD ── */}
                            <View style={s.inputWrap}>
                                <Text style={s.inputLabel}>Email Address</Text>
                                <View style={s.inputBox}>
                                    <Ionicons name="mail-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={s.textInput}
                                        placeholder="user@example.com"
                                        placeholderTextColor="#94A3B8"
                                        value={email}
                                        onChangeText={setEmail}
                                        autoCapitalize="none"
                                        keyboardType="email-address"
                                    />
                                </View>
                            </View>

                            {/* ── PASSWORD FIELD ── */}
                            <View style={s.inputWrap}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <Text style={s.inputLabel}>Password</Text>
                                    {isLogin && (
                                        <TouchableOpacity onPress={() => { setForgotEmail(email); setShowForgotModal(true); }}>
                                            <Text style={s.forgotTxt}>Forgot Password?</Text>
                                        </TouchableOpacity>
                                    )}
                                </View>
                                <View style={s.inputBox}>
                                    <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                    <TextInput
                                        style={[s.textInput, { paddingRight: 40 }]}
                                        placeholder="••••••••"
                                        placeholderTextColor="#94A3B8"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity
                                        style={s.eyeBtn}
                                        onPress={() => setShowPassword(p => !p)}
                                    >
                                        <Ionicons
                                            name={showPassword ? "eye-off-outline" : "eye-outline"}
                                            size={18}
                                            color="#64748B"
                                        />
                                    </TouchableOpacity>
                                </View>
                            </View>

                            {/* ── OPTIONAL REFERRAL CODE ── */}
                            {!isLogin && (
                                <View style={s.inputWrap}>
                                    <Text style={s.inputLabel}>Referral Code (Optional)</Text>
                                    <View style={s.inputBox}>
                                        <Ionicons name="gift-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                        <TextInput
                                            style={s.textInput}
                                            placeholder="e.g. ABU-12345"
                                            placeholderTextColor="#94A3B8"
                                            value={referralCode}
                                            onChangeText={setReferralCode}
                                            autoCapitalize="characters"
                                        />
                                    </View>
                                </View>
                            )}

                            {/* ── SUBMIT BUTTON ── */}
                            <TouchableOpacity
                                style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                                onPress={handleAuthAction}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#0A192F" size="small" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={s.primaryBtnTxt}>
                                            {isLogin ? 'Sign In to Account' : 'Continue to Verification'}
                                        </Text>
                                        <Ionicons name="arrow-forward" size={18} color="#0A192F" />
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* ── SWITCH PROMPT FOOTER ── */}
                            <View style={s.switchFooter}>
                                <Text style={s.switchFooterTxt}>
                                    {isLogin ? "Don't have an account yet?" : "Already have an account?"}
                                </Text>
                                <TouchableOpacity onPress={() => handleSwitchTab(!isLogin)}>
                                    <Text style={s.switchFooterLink}>
                                        {isLogin ? 'Create Account' : 'Sign In'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        /* ── OTP VERIFICATION VIEW ── */
                        <View style={s.cardContainer}>
                            <View style={s.otpIconWrap}>
                                <Ionicons name="mail-unread-outline" size={36} color="#0284C7" />
                            </View>

                            <Text style={s.otpTitle}>Enter 6-Digit Code</Text>
                            <Text style={s.otpSub}>
                                We sent an authentication code to <Text style={{ fontWeight: '800', color: '#0F172A' }}>{email}</Text>
                            </Text>

                            <View style={s.otpInputWrap}>
                                <TextInput
                                    style={s.otpInput}
                                    placeholder="• • • • • •"
                                    placeholderTextColor="#CBD5E1"
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                    autoFocus
                                />
                            </View>

                            <TouchableOpacity
                                style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                                onPress={handleVerifyOtp}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#0A192F" size="small" />
                                ) : (
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                        <Text style={s.primaryBtnTxt}>Verify & Complete</Text>
                                        <Ionicons name="checkmark-circle" size={18} color="#0A192F" />
                                    </View>
                                )}
                            </TouchableOpacity>

                            {/* Resend Action */}
                            <TouchableOpacity
                                onPress={handleResendOtp}
                                disabled={timer > 0 || loading}
                                style={s.resendBtn}
                            >
                                <Ionicons name="refresh-outline" size={16} color={timer > 0 ? '#94A3B8' : '#0284C7'} />
                                <Text style={[s.resendTxt, timer > 0 && { color: '#94A3B8' }]}>
                                    {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Verification Code'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => { setOtpSent(false); setOtp(''); }}
                                style={{ marginTop: 16, alignSelf: 'center' }}
                            >
                                <Text style={s.wrongEmailTxt}>Wrong email address? Change</Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>
            </KeyboardAvoidingView>

            {/* ── FORGOT PASSWORD MODAL ── */}
            <Modal
                visible={showForgotModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowForgotModal(false)}
            >
                <View style={s.modalOverlay}>
                    <View style={s.modalBox}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                            <Text style={s.modalTitle}>Reset Password</Text>
                            <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                                <Ionicons name="close-circle-outline" size={24} color="#64748B" />
                            </TouchableOpacity>
                        </View>
                        <Text style={s.modalSub}>
                            Enter your account email address. We'll send you a secure link to reset your password.
                        </Text>
                        <View style={[s.inputBox, { marginBottom: 16 }]}>
                            <Ionicons name="mail-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                            <TextInput
                                style={s.textInput}
                                placeholder="user@example.com"
                                placeholderTextColor="#94A3B8"
                                value={forgotEmail}
                                onChangeText={setForgotEmail}
                                autoCapitalize="none"
                                keyboardType="email-address"
                            />
                        </View>
                        <TouchableOpacity
                            style={[s.primaryBtn, forgotLoading && s.primaryBtnDisabled]}
                            onPress={handleForgotPassword}
                            disabled={forgotLoading}
                        >
                            {forgotLoading ? (
                                <ActivityIndicator color="#0A192F" size="small" />
                            ) : (
                                <Text style={s.primaryBtnTxt}>Send Reset Link</Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },

    // Header
    topHeader: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 16,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomLeftRadius: 24,
        borderBottomRightRadius: 24,
    },
    backBtn: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerLogoWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerLogoImg: {
        width: 32,
        height: 32,
    },
    headerLogoTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    headerLogoSub: {
        fontSize: 6.5,
        fontWeight: '700',
        color: '#94A3B8',
        letterSpacing: 0.5,
    },

    // Hero Card
    heroBanner: {
        borderRadius: 20,
        overflow: 'hidden',
        padding: 18,
        backgroundColor: '#0A192F',
        marginBottom: 16,
        position: 'relative',
    },
    heroBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(245, 158, 11, 0.15)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(245, 158, 11, 0.3)',
    },
    heroBadgeTxt: {
        color: '#F59E0B',
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.8,
    },
    heroHeading: {
        fontSize: 20,
        fontWeight: '900',
        color: '#FFFFFF',
        marginBottom: 4,
    },
    heroSub: {
        fontSize: 12,
        color: '#94A3B8',
        lineHeight: 18,
    },

    // Error & Referral
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FECACA',
        padding: 12,
        borderRadius: 12,
        marginBottom: 14,
    },
    errorBannerTxt: {
        flex: 1,
        color: '#B91C1C',
        fontSize: 12,
        fontWeight: '600',
    },
    referralBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#10B981',
        padding: 12,
        borderRadius: 12,
        marginBottom: 14,
    },
    referralBannerTxt: {
        flex: 1,
        color: '#065F46',
        fontSize: 12,
        fontWeight: '600',
    },

    // Card Container
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 22,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },

    // Segmented Tabs
    segmentedContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 14,
        padding: 4,
        marginBottom: 20,
        position: 'relative',
        height: 44,
        alignItems: 'center',
    },
    activeIndicator: {
        position: 'absolute',
        top: 4,
        bottom: 4,
        backgroundColor: '#0A192F',
        borderRadius: 11,
    },
    segmentedBtn: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2,
    },
    segmentedTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    segmentedTxtActive: {
        color: '#FFFFFF',
        fontWeight: '800',
    },

    // Input Styles
    inputWrap: {
        marginBottom: 14,
    },
    inputLabel: {
        fontSize: 11.5,
        fontWeight: '700',
        color: '#334155',
        marginBottom: 6,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 46,
        paddingHorizontal: 12,
    },
    inputIcon: {
        marginRight: 8,
    },
    textInput: {
        flex: 1,
        fontSize: 13.5,
        color: '#0F172A',
        fontWeight: '500',
    },
    eyeBtn: {
        position: 'absolute',
        right: 12,
        padding: 4,
    },
    forgotTxt: {
        fontSize: 11,
        color: '#0284C7',
        fontWeight: '700',
    },

    // Primary Button
    primaryBtn: {
        backgroundColor: '#F59E0B',
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 8,
        elevation: 2,
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
    },
    primaryBtnDisabled: {
        opacity: 0.65,
    },
    primaryBtnTxt: {
        color: '#0A192F',
        fontSize: 14,
        fontWeight: '900',
    },

    // Switch Footer
    switchFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 18,
    },
    switchFooterTxt: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
    },
    switchFooterLink: {
        fontSize: 12.5,
        color: '#0284C7',
        fontWeight: '800',
    },

    // OTP Styles
    otpIconWrap: {
        width: 60,
        height: 60,
        borderRadius: 30,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 12,
    },
    otpTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        textAlign: 'center',
        marginBottom: 4,
    },
    otpSub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 20,
        paddingHorizontal: 10,
    },
    otpInputWrap: {
        marginBottom: 18,
    },
    otpInput: {
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#0284C7',
        height: 54,
        textAlign: 'center',
        fontSize: 24,
        fontWeight: '900',
        letterSpacing: 10,
        color: '#0A192F',
    },
    resendBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 18,
        paddingVertical: 4,
    },
    resendTxt: {
        fontSize: 12.5,
        color: '#0284C7',
        fontWeight: '700',
    },
    wrongEmailTxt: {
        fontSize: 11.5,
        color: '#64748B',
        fontWeight: '600',
    },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    modalBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        width: '100%',
        maxWidth: 380,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: '900',
        color: '#0F172A',
    },
    modalSub: {
        fontSize: 12,
        color: '#64748B',
        marginBottom: 16,
        lineHeight: 18,
    },
});
