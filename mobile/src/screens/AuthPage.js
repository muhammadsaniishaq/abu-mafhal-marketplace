import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, Image,
    Alert, ActivityIndicator, StyleSheet, Dimensions,
    StatusBar, KeyboardAvoidingView, Platform, ScrollView,
    Animated, Modal, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { NotificationService } from '../lib/notifications';
import { sendOtpEmail } from '../services/simpleEmailService';
import { useAppSettings } from '../context/AppSettingsContext';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

export const AuthPage = ({ route, onBack, onLoginSuccess }) => {
    const insets = useSafeAreaInsets();
    const { params } = route || {};
    const codeFromLink = params?.code;
    const { settings } = useAppSettings();

    // ── Language State (English & Hausa) ──────────────────────────────────────
    const [lang, setLang] = useState('en'); // 'en' | 'ha'

    // ── UI States ─────────────────────────────────────────────────────────────
    const [isLogin, setIsLogin] = useState(!codeFromLink); // true = Login, false = Signup
    const [loginMethod, setLoginMethod] = useState('email'); // 'email' | 'phone'
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false);
    const [timer, setTimer] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');
    const [showForgotModal, setShowForgotModal] = useState(false);
    const [forgotEmail, setForgotEmail] = useState('');
    const [forgotLoading, setForgotLoading] = useState(false);

    // ── Form States ───────────────────────────────────────────────────────────
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [rememberMe, setRememberMe] = useState(true);
    const [enableBiometrics, setEnableBiometrics] = useState(false);
    const [agreedToTerms, setAgreedToTerms] = useState(true);

    // ── OTP States ────────────────────────────────────────────────────────────
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const [generatedOtp, setGeneratedOtp] = useState(null);
    const otpInputRef = useRef(null);

    // ── Referral States ───────────────────────────────────────────────────────
    const [referralCode, setReferralCode] = useState(codeFromLink || '');
    const [referrerName, setReferrerName] = useState(null);
    const [isCheckingReferral, setIsCheckingReferral] = useState(false);

    // ── Animations ────────────────────────────────────────────────────────────
    const scaleAnim = useRef(new Animated.Value(1)).current;

    // ── Translations Dictionary ───────────────────────────────────────────────
    const t = {
        en: {
            welcomeBack: 'Welcome Back 👋',
            welcomeSub: 'Sign in to access your orders, wallet and favourite stores.',
            joinUs: 'Join Abu Mafhal 🚀',
            joinSub: 'Create an account to shop from verified stores across Nigeria.',
            signIn: 'Sign In',
            createAccount: 'Create Account',
            emailTab: 'Email Address',
            phoneTab: 'Phone Number',
            fullName: 'Full Name',
            fullNamePlaceholder: 'e.g. Aminu Bello',
            phoneLabel: 'Phone Number',
            phonePlaceholder: '08012345678',
            emailLabel: 'Email Address',
            emailPlaceholder: 'user@example.com',
            passwordLabel: 'Password',
            passwordPlaceholder: '••••••••',
            forgotPassword: 'Forgot Password?',
            rememberMe: 'Remember Me',
            biometricLogin: 'Face ID / Fingerprint',
            referralLabel: 'Referral Code (Optional)',
            referralPlaceholder: 'e.g. ABU-12345',
            continueBtn: 'Continue to Verification',
            signInBtn: 'Sign In',
            createAccountBtn: 'Create Account',
            orDivider: 'or continue with',
            termsAgree: 'I agree to the Terms of Service & Privacy Policy',
            dontHaveAccount: "Don't have an account yet?",
            alreadyHaveAccount: 'Already have an account?',
            otpTitle: 'Verify Your Email',
            otpSub: 'Enter the 6-digit verification code sent to',
            verifyBtn: 'Verify & Finish',
            resendCode: 'Resend Code',
            resendIn: 'Resend in',
            changeEmail: 'Change Email Address',
            weakPass: 'Weak',
            fairPass: 'Fair',
            goodPass: 'Good',
            strongPass: 'Strong',
        },
        ha: {
            welcomeBack: 'Barka da Dawowa 👋',
            welcomeSub: 'Shiga don duba ododinka, asusunka da kuma amintattun shaguna.',
            joinUs: 'Shiga Abu Mafhal 🚀',
            joinSub: 'Buɗe asusu don cinikin kaya daga masu sayarwa a faɗin Najeriya.',
            signIn: 'Shiga Ciki',
            createAccount: 'Buɗe Asusu',
            emailTab: 'Adireshin Email',
            phoneTab: 'Lambar Waya',
            fullName: 'Cikakken Suna',
            fullNamePlaceholder: 'Misali: Aminu Bello',
            phoneLabel: 'Lambar Waya',
            phonePlaceholder: '08012345678',
            emailLabel: 'Adireshin Email',
            emailPlaceholder: 'user@example.com',
            passwordLabel: 'Kalmar Sirri',
            passwordPlaceholder: '••••••••',
            forgotPassword: 'Manta Kalmar Sirri?',
            rememberMe: 'Ka Tuna Dani',
            biometricLogin: 'Danna Yatsa / Fuska',
            referralLabel: 'Lambar Gayyata (Na Zaɓi)',
            referralPlaceholder: 'Misali: ABU-12345',
            continueBtn: 'Ci gaba zuwa Tabbatarwa',
            signInBtn: 'Shiga Ciki',
            createAccountBtn: 'Buɗe Asusu',
            orDivider: 'ko amfani da',
            termsAgree: "Na amince da Ƙa'idojin Sabis da Tsaro",
            dontHaveAccount: 'Ba ka da asusu tukuna?',
            alreadyHaveAccount: 'Kana da asusu a baya?',
            otpTitle: 'Tabbatar da Lambar Sirri',
            otpSub: 'Shigar da lambar sirri 6 da aka tura zuwa',
            verifyBtn: 'Tabbatar & Kammala',
            resendCode: 'Sake Tura Lamba',
            resendIn: 'Sake turawa a daƙiƙa',
            changeEmail: 'Canza Adireshin Email',
            weakPass: 'Mai Rauni',
            fairPass: 'Matsakaici',
            goodPass: 'Mai Kyau',
            strongPass: 'Mai Karfi',
        }
    }[lang];

    // Countdown Timer for OTP
    useEffect(() => {
        let interval;
        if (timer > 0) {
            interval = setInterval(() => setTimer(t => t - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // Check Referrer on referralCode changes
    useEffect(() => {
        const cleanRef = (referralCode || '').trim();
        if (cleanRef.length >= 5) {
            checkReferrer(cleanRef);
        } else {
            setReferrerName(null);
        }
    }, [referralCode]);

    const checkReferrer = async (code) => {
        setIsCheckingReferral(true);
        try {
            const { data } = await supabase
                .from('profiles')
                .select('full_name')
                .eq('referral_code', code.toUpperCase())
                .maybeSingle();

            if (data && data.full_name) {
                setReferrerName(data.full_name);
            } else {
                setReferrerName(null);
            }
        } catch {
            setReferrerName(null);
        } finally {
            setIsCheckingReferral(false);
        }
    };

    // Calculate Password Strength (0 to 4)
    const getPasswordStrength = () => {
        if (!password) return 0;
        let score = 0;
        if (password.length >= 6) score += 1;
        if (password.length >= 8) score += 1;
        if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
        if (/[0-9]/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
        return score;
    };

    const passStrength = getPasswordStrength();
    const strengthColors = ['#E2E8F0', '#EF4444', '#F59E0B', '#3B82F6', '#10B981'];
    const strengthLabels = ['', t.weakPass, t.fairPass, t.goodPass, t.strongPass];

    const handleSwitchTab = (loginTab) => {
        setIsLogin(loginTab);
        setErrorMsg('');
    };

    // ── Primary Action: Sign In or Send Signup OTP ────────────────────────────
    const handleAuthAction = async () => {
        setErrorMsg('');
        const cleanEmail = (email || '').trim().toLowerCase();
        const cleanPassword = (password || '').trim();

        if (isLogin) {
            // Validate Sign In fields only
            if (loginMethod === 'email') {
                if (!cleanEmail || !cleanPassword) {
                    setErrorMsg(lang === 'ha' ? 'Da fatan za a shigar da email da kalmar sirri.' : 'Please enter both your email address and password.');
                    return;
                }
            } else {
                // Phone login
                if (!phone.trim() || !cleanPassword) {
                    setErrorMsg(lang === 'ha' ? 'Da fatan za a shigar da lambar waya da kalmar sirri.' : 'Please enter your phone number and password.');
                    return;
                }
            }
        } else {
            // Validate Sign Up fields only
            if (!fullName.trim()) {
                setErrorMsg(lang === 'ha' ? 'Da fatan za a shigar da cikakken sunanka.' : 'Please enter your full name.');
                return;
            }
            if (!phone.trim()) {
                setErrorMsg(lang === 'ha' ? 'Da fatan za a shigar da lambar wayarka.' : 'Please enter your phone number.');
                return;
            }
            if (!cleanEmail) {
                setErrorMsg(lang === 'ha' ? 'Da fatan za a shigar da adireshin email.' : 'Please enter your email address.');
                return;
            }
            if (!cleanPassword || cleanPassword.length < 6) {
                setErrorMsg(lang === 'ha' ? 'Kalmar sirri ta zama aƙalla haruffa 6.' : 'Password must be at least 6 characters.');
                return;
            }
            if (!agreedToTerms) {
                setErrorMsg(lang === 'ha' ? 'Dole ne ka amince da Sharuɗɗan Sabis.' : 'You must agree to the Terms of Service to continue.');
                return;
            }
        }

        setLoading(true);
        try {
            if (isLogin) {
                // Determine login identifier
                const loginIdentifier = loginMethod === 'email' ? cleanEmail : `${phone.replace(/\D/g, '')}@abumafhal.com`;

                const { data, error } = await supabase.auth.signInWithPassword({
                    email: loginIdentifier,
                    password: cleanPassword,
                });

                if (error) throw error;

                // Non-blocking security notification
                (async () => {
                    try {
                        await NotificationService.send({
                            userId: data.user.id,
                            title: 'New Login Detected 🛡️',
                            message: `New login to your Abu Mafhal account.`,
                            type: 'login',
                            email: cleanEmail
                        }).catch(() => {});
                    } catch {}
                })();

                if (onLoginSuccess) {
                    onLoginSuccess(data.user);
                } else {
                    Alert.alert(lang === 'ha' ? 'An Yi Nasara' : 'Welcome Back', lang === 'ha' ? 'An shiga cikin nasara!' : 'Logged in successfully!');
                }

            } else {
                // Signup: check duplicate email
                const { data: existingUser } = await supabase
                    .from('profiles')
                    .select('id')
                    .eq('email', cleanEmail)
                    .maybeSingle();

                if (existingUser) {
                    setErrorMsg(lang === 'ha' ? 'Wannan email din an riga an yi amfani da shi. Shiga ciki.' : 'An account with this email already exists. Please sign in.');
                    setLoading(false);
                    return;
                }

                // Direct user registration (eliminates waiting for broken email service)
                let authRes = await supabase.auth.signUp({
                    email: cleanEmail,
                    password: cleanPassword,
                    options: {
                        data: {
                            full_name: fullName.trim(),
                            phone_number: phone.trim(),
                        }
                    }
                });

                if (authRes.error) {
                    // Fallback without options metadata if trigger requires clean payload
                    authRes = await supabase.auth.signUp({
                        email: cleanEmail,
                        password: cleanPassword,
                    });
                }

                if (authRes.error) throw authRes.error;
                const user = authRes.data?.user;

                if (user) {
                    await supabase.from('profiles').upsert([{
                        id: user.id,
                        email: cleanEmail,
                        full_name: fullName.trim(),
                        phone_number: phone.trim(),
                        role: 'buyer',
                        is_verified: true,
                        is_banned: false
                    }]).catch(() => {});

                    if (referralCode && referralCode.trim()) {
                        try {
                            const { data: refUser } = await supabase
                                .from('profiles')
                                .select('id')
                                .eq('referral_code', referralCode.trim().toUpperCase())
                                .maybeSingle();

                            if (refUser && refUser.id) {
                                await supabase.from('referrals').insert([{
                                    referrer_id: refUser.id,
                                    referee_id: user.id,
                                    status: 'completed',
                                    reward_amount: 1000
                                }]).catch(() => {});
                            }
                        } catch {}
                    }

                    Alert.alert(
                        lang === 'ha' ? 'Barka da Zuwa!' : 'Account Created!',
                        lang === 'ha' ? 'An ƙirƙiri asusunka cikin nasara.' : 'Your account has been created successfully!',
                        [{
                            text: lang === 'ha' ? 'Fara Sayayya' : 'Start Shopping',
                            onPress: () => {
                                if (onLoginSuccess) onLoginSuccess(user);
                            }
                        }]
                    );
                    return;
                }
            }
        } catch (error) {
            const rawMsg = error?.message || error?.error_description || 'Authentication failed.';
            if (rawMsg.toLowerCase().includes('invalid login credentials')) {
                setErrorMsg(lang === 'ha' ? 'Email ko kalmar sirri ba daidai ba ne.' : 'Incorrect email or password. Please try again.');
            } else if (rawMsg.includes('Email not confirmed')) {
                setErrorMsg(lang === 'ha' ? 'Ba a tabbatar da email ba tukuna. Duba inbox dinka.' : 'Your email is not confirmed yet. Please verify your email inbox.');
            } else {
                setErrorMsg(rawMsg);
            }
        } finally {
            setLoading(false);
        }
    };

    // ── OTP Pin Digit Handlers ───────────────────────────────────────────────
    const handleOtpChange = (text, index) => {
        const clean = text.replace(/[^0-9]/g, '');
        const newDigits = [...otpDigits];

        if (clean.length > 1) {
            // Paste scenario
            const pasted = clean.slice(0, 6).split('');
            for (let i = 0; i < 6; i++) {
                newDigits[i] = pasted[i] || '';
            }
            setOtpDigits(newDigits);
            if (pasted.length === 6) {
                verifyOtpCode(newDigits.join(''));
            }
            return;
        }

        newDigits[index] = clean;
        setOtpDigits(newDigits);

        // Auto submit when all 6 digits entered
        if (clean && index === 5) {
            const fullCode = newDigits.join('');
            if (fullCode.length === 6) {
                verifyOtpCode(fullCode);
            }
        }
    };

    const verifyOtpCode = async (codeToVerify) => {
        setErrorMsg('');
        const isDirect = codeToVerify === 'DIRECT';
        const enteredCode = (codeToVerify || otpDigits.join('')).trim();

        if (!isDirect && enteredCode.length !== 6) {
            setErrorMsg(lang === 'ha' ? 'Shigar da lambobi 6 cike.' : 'Please enter the complete 6-digit code.');
            return;
        }

        setLoading(true);
        try {
            if (!isDirect && generatedOtp && enteredCode !== generatedOtp.trim()) {
                throw new Error(lang === 'ha' ? 'Lambar sirri ba daidai ba ce. Sake gwadawa.' : 'Invalid verification code. Please check and try again.');
            }

            const cleanEmail = (email || '').trim().toLowerCase();
            const cleanPassword = (password || '').trim();

            let authRes = await supabase.auth.signUp({
                email: cleanEmail,
                password: cleanPassword,
                options: {
                    data: {
                        full_name: fullName.trim(),
                        phone_number: phone.trim(),
                    }
                }
            });

            if (authRes.error) {
                authRes = await supabase.auth.signUp({
                    email: cleanEmail,
                    password: cleanPassword,
                });
            }

            if (authRes.error) throw authRes.error;
            const user = authRes.data?.user;

            if (user) {
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

                // Referral code rewards
                if (referralCode.trim()) {
                    try {
                        const { data: refUser } = await supabase
                            .from('profiles')
                            .select('id')
                            .eq('referral_code', referralCode.trim().toUpperCase())
                            .maybeSingle();

                        if (refUser && refUser.id) {
                            await supabase.from('referrals').insert([{
                                referrer_id: refUser.id,
                                referee_id: user.id,
                                status: 'completed',
                                reward_amount: 1000
                            }]).catch(() => {});
                        }
                    } catch {}
                }

                Alert.alert(
                    lang === 'ha' ? 'Barka da Zuwa!' : 'Account Created!',
                    lang === 'ha' ? 'An ƙirƙiri asusunka cikin nasara.' : 'Your account has been created successfully!',
                    [{
                        text: lang === 'ha' ? 'Fara Sayayya' : 'Start Shopping',
                        onPress: () => {
                            if (onLoginSuccess) onLoginSuccess(user);
                        }
                    }]
                );
            }
        } catch (err) {
            setErrorMsg(err.message || 'Verification failed.');
        } finally {
            setLoading(false);
        }
    };

    // Resend OTP
    const handleResendOtp = async () => {
        if (timer > 0) return;
        setLoading(true);
        setErrorMsg('');
        try {
            const newCode = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(newCode);
            setOtpDigits(['', '', '', '', '', '']);
            await sendOtpEmail({ email: email.trim().toLowerCase(), otp: newCode });
            setTimer(60);
            Alert.alert(lang === 'ha' ? 'An Sake Turawa' : 'Code Resent', lang === 'ha' ? 'Mun sake tura sabuwar lambar sirri zuwa email dinka.' : 'A new code has been sent to your email.');
        } catch (e) {
            setErrorMsg(e.message || 'Failed to resend code.');
        } finally {
            setLoading(false);
        }
    };

    // Forgot Password
    const handleForgotPassword = async () => {
        if (!forgotEmail.trim()) {
            Alert.alert(lang === 'ha' ? 'Ana Buƙata' : 'Required', lang === 'ha' ? 'Shigar da adireshin email dinka.' : 'Please enter your account email address.');
            return;
        }
        setForgotLoading(true);
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim().toLowerCase());
            if (error) throw error;
            Alert.alert(
                lang === 'ha' ? 'An Tura' : 'Reset Link Sent',
                lang === 'ha' ? 'An tura hanyar sauya kalmar sirri zuwa email dinka. Idan baka gani ba, duba spam ko tuntuɓi WhatsApp.' : 'Password reset instructions sent to your email. Check spam folder if not found.',
                [{ text: 'OK', onPress: () => setShowForgotModal(false) }]
            );
        } catch (err) {
            Alert.alert(
                lang === 'ha' ? 'Taimakon Kalmar Sirri' : 'Password Assistance',
                lang === 'ha' 
                    ? 'Ba a iya tura email ba. Za ka iya tuntuɓar tallafi a WhatsApp nan take domin taimako.'
                    : 'Could not send reset email. You can contact support directly via WhatsApp for instant password assistance.',
                [
                    { text: lang === 'ha' ? 'Rufe' : 'Cancel', style: 'cancel' },
                    { 
                        text: 'WhatsApp Support', 
                        onPress: () => {
                            Linking.openURL('https://wa.me/2348145853539?text=Hello%20Abu%20Mafhal%20Support,%20I%20need%20help%20resetting%20my%20password');
                            setShowForgotModal(false);
                        }
                    }
                ]
            );
        } finally {
            setForgotLoading(false);
        }
    };

    // Social Login Mock / Integration
    const handleSocialAuth = (provider) => {
        Alert.alert(
            `${provider} Sign In`,
            `${provider} authentication will securely connect your Abu Mafhal account.`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Continue',
                    onPress: () => {
                        // Quick demo buyer login for social testing
                        if (onLoginSuccess) {
                            onLoginSuccess({
                                id: `social-${Date.now()}`,
                                email: `social.user@${provider.toLowerCase()}.com`,
                                role: 'buyer',
                                full_name: `${provider} User`
                            });
                        }
                    }
                }
            ]
        );
    };

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="#0A192F" />

            {/* ── TOP NAV HEADER (MOBILE FIRST) ── */}
            <View style={[s.topHeader, { paddingTop: Math.max(insets.top, 14) }]}>
                <TouchableOpacity
                    onPress={onBack}
                    style={s.headerIconBtn}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={20} color="#FFFFFF" />
                </TouchableOpacity>

                {/* Central Brand Badge */}
                <View style={s.headerBrandWrap}>
                    <Image source={AM_LOGO} style={s.headerLogoImg} resizeMode="contain" />
                    <View>
                        <Text style={s.headerBrandTitle}>
                            ABU <Text style={{ color: '#00D2FF' }}>MAFHAL</Text>
                        </Text>
                        <Text style={s.headerBrandSub}>MARKETPLACE</Text>
                    </View>
                </View>

                {/* Language Switcher */}
                <View style={s.headerRightActions}>
                    <TouchableOpacity
                        style={s.langBadge}
                        onPress={() => setLang(l => l === 'en' ? 'ha' : 'en')}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="globe-outline" size={13} color="#00D2FF" />
                        <Text style={s.langBadgeTxt}>{lang === 'en' ? 'EN' : 'HA'}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
            >
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40, paddingTop: 14 }}
                >
                    {/* ── HERO BANNER CARD ── */}
                    <View style={s.heroBanner}>
                        <LinearGradient
                            colors={['#0A192F', '#0E2A4D', '#163E6D']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={StyleSheet.absoluteFillObject}
                        />

                        {/* Top verified security badge */}
                        <View style={s.heroSecurityRow}>
                            <View style={s.heroSecurityBadge}>
                                <Ionicons name="shield-checkmark" size={12} color="#00BFA5" />
                                <Text style={s.heroSecurityTxt}>256-BIT SSL ENCRYPTED</Text>
                            </View>
                            <View style={s.heroSecurityBadge}>
                                <Ionicons name="sparkles" size={12} color="#F59E0B" />
                                <Text style={[s.heroSecurityTxt, { color: '#F59E0B' }]}>OFFICIAL APP</Text>
                            </View>
                        </View>

                        <Text style={s.heroTitle}>
                            {otpSent ? t.otpTitle : (isLogin ? t.welcomeBack : t.joinUs)}
                        </Text>
                        <Text style={s.heroSub}>
                            {otpSent
                                ? `${t.otpSub} ${email}`
                                : (isLogin ? t.welcomeSub : t.joinSub)}
                        </Text>
                    </View>

                    {/* ── ERROR MESSAGE BANNER ── */}
                    {errorMsg !== '' && (
                        <View style={s.errorBanner}>
                            <Ionicons name="alert-circle" size={18} color="#EF4444" />
                            <Text style={s.errorBannerTxt}>{errorMsg}</Text>
                        </View>
                    )}

                    {/* ── REFERRAL WELCOME BANNER (IF INVITED) ── */}
                    {!otpSent && !isLogin && (referrerName || (referralCode && referralCode.length >= 5)) && (
                        <View style={s.referralBanner}>
                            <View style={s.referralIconWrap}>
                                <Ionicons name="gift" size={18} color="#10B981" />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={s.referralTitle}>
                                    {referrerName ? `${referrerName} invited you!` : 'Referral Code Detected'}
                                </Text>
                                <Text style={s.referralSub}>
                                    🎁 ₦1,000 Welcome discount voucher will be credited on your first purchase!
                                </Text>
                            </View>
                            {isCheckingReferral && <ActivityIndicator size="small" color="#10B981" />}
                        </View>
                    )}

                    {!otpSent ? (
                        <View style={s.cardContainer}>
                            {/* ── SEGMENTED PILL SWITCH (SIGN IN vs CREATE ACCOUNT) ── */}
                            <View style={s.segmentedContainer}>
                                <TouchableOpacity
                                    style={[s.segmentedBtn, isLogin && s.segmentedBtnActive]}
                                    onPress={() => handleSwitchTab(true)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons
                                        name={isLogin ? "log-in" : "log-in-outline"}
                                        size={16}
                                        color={isLogin ? "#0A192F" : "#64748B"}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[s.segmentedTxt, isLogin && s.segmentedTxtActive]}>
                                        {t.signIn}
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[s.segmentedBtn, !isLogin && s.segmentedBtnActive]}
                                    onPress={() => handleSwitchTab(false)}
                                    activeOpacity={0.85}
                                >
                                    <Ionicons
                                        name={!isLogin ? "person-add" : "person-add-outline"}
                                        size={16}
                                        color={!isLogin ? "#0A192F" : "#64748B"}
                                        style={{ marginRight: 6 }}
                                    />
                                    <Text style={[s.segmentedTxt, !isLogin && s.segmentedTxtActive]}>
                                        {t.createAccount}
                                    </Text>
                                </TouchableOpacity>
                            </View>

                            {isLogin ? (
                                /* ══════════════ ONLY SIGN IN FORM ══════════════ */
                                <View>
                                    {/* ── METHOD SWITCHER: EMAIL VS PHONE (LOGIN ONLY) ── */}
                                    <View style={s.methodTabsRow}>
                                        <TouchableOpacity
                                            style={[s.methodTab, loginMethod === 'email' && s.methodTabActive]}
                                            onPress={() => setLoginMethod('email')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name="mail-outline"
                                                size={14}
                                                color={loginMethod === 'email' ? '#00BFA5' : '#64748B'}
                                            />
                                            <Text style={[s.methodTabTxt, loginMethod === 'email' && s.methodTabTxtActive]}>
                                                {t.emailTab}
                                            </Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={[s.methodTab, loginMethod === 'phone' && s.methodTabActive]}
                                            onPress={() => setLoginMethod('phone')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name="call-outline"
                                                size={14}
                                                color={loginMethod === 'phone' ? '#00BFA5' : '#64748B'}
                                            />
                                            <Text style={[s.methodTabTxt, loginMethod === 'phone' && s.methodTabTxtActive]}>
                                                {t.phoneTab}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* ── EMAIL OR PHONE INPUT FOR SIGN IN ── */}
                                    {loginMethod === 'email' ? (
                                        <View style={s.inputWrap}>
                                            <Text style={s.inputLabel}>{t.emailLabel}</Text>
                                            <View style={s.inputBox}>
                                                <Ionicons name="mail-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                                <TextInput
                                                    style={s.textInput}
                                                    placeholder={t.emailPlaceholder}
                                                    placeholderTextColor="#94A3B8"
                                                    value={email}
                                                    onChangeText={setEmail}
                                                    autoCapitalize="none"
                                                    keyboardType="email-address"
                                                />
                                            </View>
                                        </View>
                                    ) : (
                                        <View style={s.inputWrap}>
                                            <Text style={s.inputLabel}>{t.phoneLabel}</Text>
                                            <View style={s.inputBox}>
                                                <View style={s.countryPrefix}>
                                                    <Text style={s.countryFlag}>🇳🇬</Text>
                                                    <Text style={s.countryCode}>+234</Text>
                                                </View>
                                                <TextInput
                                                    style={s.textInput}
                                                    placeholder={t.phonePlaceholder}
                                                    placeholderTextColor="#94A3B8"
                                                    value={phone}
                                                    onChangeText={setPhone}
                                                    keyboardType="phone-pad"
                                                />
                                            </View>
                                        </View>
                                    )}

                                    {/* ── PASSWORD INPUT ── */}
                                    <View style={s.inputWrap}>
                                        <View style={s.inputLabelRow}>
                                            <Text style={s.inputLabel}>{t.passwordLabel}</Text>
                                            <TouchableOpacity onPress={() => { setForgotEmail(email); setShowForgotModal(true); }}>
                                                <Text style={s.forgotTxt}>{t.forgotPassword}</Text>
                                            </TouchableOpacity>
                                        </View>
                                        <View style={s.inputBox}>
                                            <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { paddingRight: 42 }]}
                                                placeholder={t.passwordPlaceholder}
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

                                    {/* ── REMEMBER ME & BIOMETRICS ── */}
                                    <View style={s.optionsRow}>
                                        <TouchableOpacity
                                            style={s.rememberMeBtn}
                                            onPress={() => setRememberMe(r => !r)}
                                            activeOpacity={0.8}
                                        >
                                            <View style={[s.checkbox, rememberMe && s.checkboxActive]}>
                                                {rememberMe && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                            </View>
                                            <Text style={s.rememberMeTxt}>{t.rememberMe}</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={s.biometricToggle}
                                            onPress={() => setEnableBiometrics(b => !b)}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons
                                                name="finger-print-outline"
                                                size={16}
                                                color={enableBiometrics ? '#00BFA5' : '#64748B'}
                                            />
                                            <Text style={[s.biometricTxt, enableBiometrics && { color: '#00BFA5', fontWeight: '700' }]}>
                                                {t.biometricLogin}
                                            </Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* ── SIGN IN SUBMIT BUTTON (NO ARROW) ── */}
                                    <TouchableOpacity
                                        style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                                        onPress={handleAuthAction}
                                        disabled={loading}
                                        activeOpacity={0.85}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#0A192F" size="small" />
                                        ) : (
                                            <Text style={s.primaryBtnTxt}>{t.signInBtn}</Text>
                                        )}
                                    </TouchableOpacity>

                                    {/* ── SOCIAL AUTH DIVIDER ── */}
                                    <View style={s.dividerWrap}>
                                        <View style={s.dividerLine} />
                                        <Text style={s.dividerTxt}>{t.orDivider}</Text>
                                        <View style={s.dividerLine} />
                                    </View>

                                    {/* ── FAST SOCIAL LOGINS ── */}
                                    <View style={s.socialRow}>
                                        <TouchableOpacity
                                            style={s.socialBtn}
                                            onPress={() => handleSocialAuth('Google')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="logo-google" size={18} color="#EA4335" />
                                            <Text style={s.socialBtnTxt}>Google</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={s.socialBtn}
                                            onPress={() => handleSocialAuth('Apple')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="logo-apple" size={18} color="#0F172A" />
                                            <Text style={s.socialBtnTxt}>Apple</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* ── SWITCH FOOTER TO SIGN UP ── */}
                                    <View style={s.switchFooter}>
                                        <Text style={s.switchFooterTxt}>{t.dontHaveAccount}</Text>
                                        <TouchableOpacity onPress={() => handleSwitchTab(false)} style={{ marginLeft: 6 }}>
                                            <Text style={s.switchFooterLink}>{t.createAccount}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            ) : (
                                /* ══════════════ ONLY SIGN UP FORM ══════════════ */
                                <View>
                                    {/* ── SIGNUP: FULL NAME ── */}
                                    <View style={s.inputWrap}>
                                        <Text style={s.inputLabel}>{t.fullName}</Text>
                                        <View style={s.inputBox}>
                                            <Ionicons name="person-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                            <TextInput
                                                style={s.textInput}
                                                placeholder={t.fullNamePlaceholder}
                                                placeholderTextColor="#94A3B8"
                                                value={fullName}
                                                onChangeText={setFullName}
                                                autoCapitalize="words"
                                            />
                                        </View>
                                    </View>

                                    {/* ── SIGNUP: PHONE NUMBER ── */}
                                    <View style={s.inputWrap}>
                                        <Text style={s.inputLabel}>{t.phoneLabel}</Text>
                                        <View style={s.inputBox}>
                                            <View style={s.countryPrefix}>
                                                <Text style={s.countryFlag}>🇳🇬</Text>
                                                <Text style={s.countryCode}>+234</Text>
                                            </View>
                                            <TextInput
                                                style={s.textInput}
                                                placeholder={t.phonePlaceholder}
                                                placeholderTextColor="#94A3B8"
                                                value={phone}
                                                onChangeText={setPhone}
                                                keyboardType="phone-pad"
                                            />
                                        </View>
                                    </View>

                                    {/* ── SIGNUP: EMAIL ADDRESS ── */}
                                    <View style={s.inputWrap}>
                                        <Text style={s.inputLabel}>{t.emailLabel}</Text>
                                        <View style={s.inputBox}>
                                            <Ionicons name="mail-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                            <TextInput
                                                style={s.textInput}
                                                placeholder={t.emailPlaceholder}
                                                placeholderTextColor="#94A3B8"
                                                value={email}
                                                onChangeText={setEmail}
                                                autoCapitalize="none"
                                                keyboardType="email-address"
                                            />
                                        </View>
                                    </View>

                                    {/* ── SIGNUP: PASSWORD WITH LIVE STRENGTH ── */}
                                    <View style={s.inputWrap}>
                                        <Text style={s.inputLabel}>{t.passwordLabel}</Text>
                                        <View style={s.inputBox}>
                                            <Ionicons name="lock-closed-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                            <TextInput
                                                style={[s.textInput, { paddingRight: 42 }]}
                                                placeholder={t.passwordPlaceholder}
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

                                        {/* Live Password Strength Meter */}
                                        {password.length > 0 && (
                                            <View style={s.strengthMeterWrap}>
                                                <View style={s.strengthBars}>
                                                    {[1, 2, 3, 4].map(idx => (
                                                        <View
                                                            key={idx}
                                                            style={[
                                                                s.strengthBar,
                                                                {
                                                                    backgroundColor: passStrength >= idx
                                                                        ? strengthColors[passStrength]
                                                                        : '#E2E8F0'
                                                                }
                                                            ]}
                                                        />
                                                    ))}
                                                </View>
                                                <Text style={[s.strengthLabel, { color: strengthColors[passStrength] }]}>
                                                    {strengthLabels[passStrength]}
                                                </Text>
                                            </View>
                                        )}
                                    </View>

                                    {/* ── SIGNUP: REFERRAL CODE (OPTIONAL) ── */}
                                    <View style={s.inputWrap}>
                                        <View style={s.inputLabelRow}>
                                            <Text style={s.inputLabel}>{t.referralLabel}</Text>
                                            <Text style={{ fontSize: 10, color: '#00BFA5', fontWeight: '700' }}>🎁 BONUS</Text>
                                        </View>
                                        <View style={s.inputBox}>
                                            <Ionicons name="gift-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                            <TextInput
                                                style={s.textInput}
                                                placeholder={t.referralPlaceholder}
                                                placeholderTextColor="#94A3B8"
                                                value={referralCode}
                                                onChangeText={setReferralCode}
                                                autoCapitalize="characters"
                                            />
                                            {referrerName && (
                                                <Ionicons name="checkmark-circle" size={18} color="#10B981" style={{ marginRight: 10 }} />
                                            )}
                                        </View>
                                    </View>

                                    {/* ── SIGNUP: TERMS AGREEMENT ── */}
                                    <TouchableOpacity
                                        style={s.termsRow}
                                        onPress={() => setAgreedToTerms(a => !a)}
                                        activeOpacity={0.8}
                                    >
                                        <View style={[s.checkbox, agreedToTerms && s.checkboxActive]}>
                                            {agreedToTerms && <Ionicons name="checkmark" size={13} color="#FFFFFF" />}
                                        </View>
                                        <Text style={s.termsTxt}>
                                            {t.termsAgree}
                                        </Text>
                                    </TouchableOpacity>

                                    {/* ── SIGNUP SUBMIT BUTTON (NO ARROW) ── */}
                                    <TouchableOpacity
                                        style={[s.primaryBtn, loading && s.primaryBtnDisabled]}
                                        onPress={handleAuthAction}
                                        disabled={loading}
                                        activeOpacity={0.85}
                                    >
                                        {loading ? (
                                            <ActivityIndicator color="#0A192F" size="small" />
                                        ) : (
                                            <Text style={s.primaryBtnTxt}>{t.createAccountBtn}</Text>
                                        )}
                                    </TouchableOpacity>

                                    {/* ── SOCIAL AUTH DIVIDER ── */}
                                    <View style={s.dividerWrap}>
                                        <View style={s.dividerLine} />
                                        <Text style={s.dividerTxt}>{t.orDivider}</Text>
                                        <View style={s.dividerLine} />
                                    </View>

                                    {/* ── FAST SOCIAL LOGINS ── */}
                                    <View style={s.socialRow}>
                                        <TouchableOpacity
                                            style={s.socialBtn}
                                            onPress={() => handleSocialAuth('Google')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="logo-google" size={18} color="#EA4335" />
                                            <Text style={s.socialBtnTxt}>Google</Text>
                                        </TouchableOpacity>

                                        <TouchableOpacity
                                            style={s.socialBtn}
                                            onPress={() => handleSocialAuth('Apple')}
                                            activeOpacity={0.8}
                                        >
                                            <Ionicons name="logo-apple" size={18} color="#0F172A" />
                                            <Text style={s.socialBtnTxt}>Apple</Text>
                                        </TouchableOpacity>
                                    </View>

                                    {/* ── SWITCH FOOTER TO SIGN IN ── */}
                                    <View style={s.switchFooter}>
                                        <Text style={s.switchFooterTxt}>{t.alreadyHaveAccount}</Text>
                                        <TouchableOpacity onPress={() => handleSwitchTab(true)} style={{ marginLeft: 6 }}>
                                            <Text style={s.switchFooterLink}>{t.signIn}</Text>
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        </View>
                    ) : (
                        /* ── OTP 6-DIGIT VERIFICATION VIEW ── */
                        <View style={s.cardContainer}>
                            <View style={s.otpHeaderIcon}>
                                <Ionicons name="mail-unread-outline" size={32} color="#00BFA5" />
                            </View>

                            <Text style={s.otpTitle}>{t.otpTitle}</Text>
                            <Text style={s.otpSub}>
                                {t.otpSub} <Text style={{ fontWeight: '800', color: '#0F172A' }}>{email}</Text>
                            </Text>

                            {/* 6 Individual Pin Input Boxes */}
                            <View style={s.pinBoxesRow}>
                                {[0, 1, 2, 3, 4, 5].map((idx) => {
                                    const val = otpDigits[idx] || '';
                                    const isCurrent = otpDigits.findIndex(d => d === '') === idx;
                                    return (
                                        <View
                                            key={idx}
                                            style={[
                                                s.pinBox,
                                                val ? s.pinBoxFilled : null,
                                                isCurrent ? s.pinBoxActive : null
                                            ]}
                                        >
                                            <Text style={s.pinBoxDigit}>{val}</Text>
                                        </View>
                                    );
                                })}
                            </View>

                            {/* Hidden Real Input for Native Keyboard */}
                            <TextInput
                                ref={otpInputRef}
                                style={s.hiddenOtpInput}
                                value={otpDigits.join('')}
                                onChangeText={(text) => handleOtpChange(text, 0)}
                                keyboardType="number-pad"
                                maxLength={6}
                                autoFocus
                            />

                            {/* Verify Button */}
                            <TouchableOpacity
                                style={[s.primaryBtn, loading && s.primaryBtnDisabled, { marginTop: 24 }]}
                                onPress={() => verifyOtpCode()}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                {loading ? (
                                    <ActivityIndicator color="#0A192F" size="small" />
                                ) : (
                                    <Text style={s.primaryBtnTxt}>{t.verifyBtn}</Text>
                                )}
                            </TouchableOpacity>

                            {/* Direct Skip/Instant Verification Button */}
                            <TouchableOpacity
                                style={[s.primaryBtn, { backgroundColor: '#10B981', marginTop: 12 }]}
                                onPress={() => verifyOtpCode('DIRECT')}
                                disabled={loading}
                                activeOpacity={0.85}
                            >
                                <Text style={[s.primaryBtnTxt, { color: '#FFFFFF' }]}>
                                    {lang === 'ha' ? 'Kammala Rijista Nan Take' : 'Complete Registration Instantly'}
                                </Text>
                            </TouchableOpacity>

                            {/* Resend Code Strip */}
                            <View style={s.resendStrip}>
                                {timer > 0 ? (
                                    <Text style={s.timerTxt}>
                                        {t.resendIn} <Text style={{ fontWeight: '800', color: '#00BFA5' }}>{timer}s</Text>
                                    </Text>
                                ) : (
                                    <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                                        <Text style={s.resendLink}>{t.resendCode}</Text>
                                    </TouchableOpacity>
                                )}
                            </View>

                            {/* Change Email Option */}
                            <TouchableOpacity
                                onPress={() => setOtpSent(false)}
                                style={s.changeEmailBtn}
                            >
                                <Ionicons name="arrow-back" size={14} color="#64748B" />
                                <Text style={s.changeEmailTxt}>{t.changeEmail}</Text>
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
                    <View style={s.modalCard}>
                        <View style={s.modalHeader}>
                            <View style={s.modalIconWrap}>
                                <Ionicons name="key-outline" size={24} color="#F59E0B" />
                            </View>
                            <TouchableOpacity onPress={() => setShowForgotModal(false)}>
                                <Ionicons name="close" size={22} color="#94A3B8" />
                            </TouchableOpacity>
                        </View>

                        <Text style={s.modalTitle}>{t.forgotPassword}</Text>
                        <Text style={s.modalSub}>
                            {lang === 'ha'
                                ? 'Shigar da adireshin email na asusunka domin mu tura maka hanyar sake saita kalmar sirri.'
                                : 'Enter your registered email address to receive password reset instructions.'}
                        </Text>

                        <View style={s.inputWrap}>
                            <Text style={s.inputLabel}>{t.emailLabel}</Text>
                            <View style={s.inputBox}>
                                <Ionicons name="mail-outline" size={18} color="#94A3B8" style={s.inputIcon} />
                                <TextInput
                                    style={s.textInput}
                                    placeholder={t.emailPlaceholder}
                                    placeholderTextColor="#94A3B8"
                                    value={forgotEmail}
                                    onChangeText={setForgotEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[s.primaryBtn, forgotLoading && s.primaryBtnDisabled, { marginTop: 14 }]}
                            onPress={handleForgotPassword}
                            disabled={forgotLoading}
                        >
                            {forgotLoading ? (
                                <ActivityIndicator color="#0A192F" size="small" />
                            ) : (
                                <Text style={s.primaryBtnTxt}>
                                    {lang === 'ha' ? 'Tura Hanyar Canza Kalma' : 'Send Reset Link'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ── MODERN MOBILE FIRST STYLESHEET ──────────────────────────────────────────
const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    topHeader: {
        backgroundColor: '#0A192F',
        paddingHorizontal: 16,
        paddingBottom: 14,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.08)',
    },
    headerIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerBrandWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerLogoImg: {
        width: 28,
        height: 28,
    },
    headerBrandTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
    },
    headerBrandSub: {
        fontSize: 8,
        fontWeight: '700',
        color: 'rgba(255,255,255,0.5)',
        letterSpacing: 1.5,
    },
    headerRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    langBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        paddingHorizontal: 8,
        paddingVertical: 5,
        backgroundColor: 'rgba(0, 210, 255, 0.1)',
        borderWidth: 1,
        borderColor: 'rgba(0, 210, 255, 0.3)',
        borderRadius: 10,
    },
    langBadgeTxt: {
        fontSize: 10,
        fontWeight: '900',
        color: '#00D2FF',
    },
    heroBanner: {
        borderRadius: 24,
        padding: 20,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        marginBottom: 16,
        shadowColor: '#0A192F',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
        elevation: 6,
    },
    heroSecurityRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 10,
    },
    heroSecurityBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(255,255,255,0.08)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    heroSecurityTxt: {
        fontSize: 9,
        fontWeight: '900',
        color: '#00BFA5',
        letterSpacing: 0.6,
    },
    heroTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    heroSub: {
        fontSize: 12,
        color: '#94A3B8',
        fontWeight: '500',
        marginTop: 4,
        lineHeight: 18,
    },
    errorBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FEF2F2',
        borderWidth: 1,
        borderColor: '#FCA5A5',
        borderRadius: 16,
        padding: 12,
        marginBottom: 14,
    },
    errorBannerTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#B91C1C',
        flex: 1,
    },
    referralBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: '#A7F3D0',
        borderRadius: 18,
        padding: 14,
        marginBottom: 16,
    },
    referralIconWrap: {
        width: 36,
        height: 36,
        borderRadius: 12,
        backgroundColor: '#D1FAE5',
        alignItems: 'center',
        justifyContent: 'center',
    },
    referralTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#065F46',
    },
    referralSub: {
        fontSize: 11,
        color: '#047857',
        fontWeight: '500',
        marginTop: 2,
    },
    cardContainer: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        shadowColor: '#64748B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    segmentedContainer: {
        flexDirection: 'row',
        backgroundColor: '#F1F5F9',
        borderRadius: 18,
        padding: 4,
        marginBottom: 18,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
    },
    segmentedBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 11,
        borderRadius: 14,
        backgroundColor: 'transparent',
    },
    segmentedBtnActive: {
        backgroundColor: '#F59E0B',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.28,
        shadowRadius: 5,
        elevation: 3,
    },
    segmentedTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: '#64748B',
    },
    segmentedTxtActive: {
        color: '#0A192F',
        fontWeight: '900',
    },
    methodTabsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 14,
    },
    methodTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    methodTabActive: {
        backgroundColor: 'rgba(0, 191, 165, 0.08)',
        borderColor: '#00BFA5',
    },
    methodTabTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    methodTabTxtActive: {
        color: '#00BFA5',
        fontWeight: '900',
    },
    inputWrap: {
        marginBottom: 14,
    },
    inputLabelRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 6,
    },
    inputLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 6,
    },
    inputBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        borderRadius: 16,
        paddingHorizontal: 12,
        height: 50,
    },
    inputIcon: {
        marginRight: 8,
    },
    countryPrefix: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginRight: 8,
        paddingRight: 8,
        borderRightWidth: 1,
        borderRightColor: '#CBD5E1',
    },
    countryFlag: {
        fontSize: 14,
    },
    countryCode: {
        fontSize: 12,
        fontWeight: '800',
        color: '#0F172A',
    },
    textInput: {
        flex: 1,
        fontSize: 14,
        color: '#0F172A',
        fontWeight: '600',
    },
    eyeBtn: {
        position: 'absolute',
        right: 12,
        padding: 6,
    },
    forgotTxt: {
        fontSize: 11,
        fontWeight: '800',
        color: '#F59E0B',
    },
    strengthMeterWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
        paddingHorizontal: 2,
    },
    strengthBars: {
        flexDirection: 'row',
        gap: 4,
        flex: 1,
        marginRight: 10,
    },
    strengthBar: {
        flex: 1,
        height: 4,
        borderRadius: 2,
    },
    strengthLabel: {
        fontSize: 10,
        fontWeight: '800',
    },
    optionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
        marginTop: 2,
    },
    rememberMeBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    checkbox: {
        width: 20,
        height: 20,
        borderRadius: 6,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#FFFFFF',
    },
    checkboxActive: {
        backgroundColor: '#00BFA5',
        borderColor: '#00BFA5',
    },
    rememberMeTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#475569',
    },
    biometricToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 10,
    },
    biometricTxt: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    termsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginBottom: 16,
    },
    termsTxt: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
        flex: 1,
        lineHeight: 16,
    },
    primaryBtn: {
        backgroundColor: '#F59E0B',
        height: 52,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#F59E0B',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 4,
    },
    primaryBtnDisabled: {
        opacity: 0.6,
    },
    primaryBtnInner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    primaryBtnTxt: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.3,
    },
    dividerWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        marginVertical: 18,
    },
    dividerLine: {
        flex: 1,
        height: 1,
        backgroundColor: '#E2E8F0',
    },
    dividerTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#94A3B8',
        marginHorizontal: 12,
        textTransform: 'uppercase',
    },
    socialRow: {
        flexDirection: 'row',
        gap: 12,
    },
    socialBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        height: 46,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
    },
    socialBtnTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#1E293B',
    },
    switchFooter: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 18,
    },
    switchFooterTxt: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    switchFooterLink: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0A192F',
        textDecorationLine: 'underline',
    },

    // ── OTP STYLES ────────────────────────────────────────────────────────────
    otpHeaderIcon: {
        width: 60,
        height: 60,
        borderRadius: 20,
        backgroundColor: '#F0FDFA',
        borderWidth: 1,
        borderColor: '#CCFBF1',
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
    },
    otpSub: {
        fontSize: 12,
        color: '#64748B',
        textAlign: 'center',
        marginTop: 4,
        marginBottom: 20,
        lineHeight: 18,
    },
    pinBoxesRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 10,
    },
    pinBox: {
        width: 44,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pinBoxFilled: {
        borderColor: '#0A192F',
        backgroundColor: '#FFFFFF',
    },
    pinBoxActive: {
        borderColor: '#F59E0B',
        borderWidth: 2,
        backgroundColor: 'rgba(245, 158, 11, 0.05)',
    },
    pinBoxDigit: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0A192F',
    },
    hiddenOtpInput: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0.01,
    },
    resendStrip: {
        alignItems: 'center',
        marginTop: 16,
    },
    timerTxt: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },
    resendLink: {
        fontSize: 12,
        fontWeight: '900',
        color: '#00BFA5',
    },
    changeEmailBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginTop: 18,
        paddingVertical: 8,
    },
    changeEmailTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B',
    },

    // ── FORGOT PASSWORD MODAL ─────────────────────────────────────────────────
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(10, 25, 47, 0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 22,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.25,
        shadowRadius: 20,
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalIconWrap: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
    },
    modalSub: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '500',
        marginTop: 4,
        marginBottom: 16,
        lineHeight: 18,
    },
});

export default AuthPage;
