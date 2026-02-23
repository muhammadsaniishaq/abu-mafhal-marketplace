import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import { NotificationService } from '../lib/notifications';
import { sendOtpEmail } from '../services/simpleEmailService';

import { useAppSettings } from '../context/AppSettingsContext';

export const AuthPage = ({ onBack, onLoginSuccess }) => {
    const { settings } = useAppSettings();

    // UI State
    const [loading, setLoading] = useState(false);
    const [otpSent, setOtpSent] = useState(false); // Controls View: Form vs OTP
    const [timer, setTimer] = useState(0);

    // Form State
    // Form State
    const [isLogin, setIsLogin] = useState(true);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [fullName, setFullName] = useState('');
    const [phone, setPhone] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [otp, setOtp] = useState('');
    const [generatedOtp, setGeneratedOtp] = useState(null); // [NEW] Custom OTP

    // ...

    const handleAuthAction = async () => {
        if (!email || !password) {
            Alert.alert('Error', 'Please fill in all required fields.');
            return;
        }

        if (!isLogin && (!fullName || !phone)) {
            Alert.alert('Error', 'Please fill in your details for account creation.');
            return;
        }

        setLoading(true);
        try {
            if (isLogin) {
                // LOGIN FLOW (Standard Email + Password)
                const { data, error } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password,
                });

                if (error) throw error;

                // NOTIFICATION: Login
                let ipAddress = 'Unknown IP';
                try {
                    const ipRes = await fetch('https://api.ipify.org?format=json');
                    const ipData = await ipRes.json();
                    ipAddress = ipData.ip;
                } catch (e) {
                    console.log('IP Fetch Error:', e);
                }

                await NotificationService.send({
                    userId: data.user.id,
                    title: 'New Login Detected 🛡️',
                    message: `New login to your account from IP: ${ipAddress}. If this wasn't you, please reset your password immediately.`,
                    type: 'login',
                    email: email
                });

                Alert.alert('Success', 'Welcome back!');
                if (onLoginSuccess) onLoginSuccess(data.user);

            } else {
                // SIGNUP FLOW: Pre-Verify Email first
                console.log("Starting Signup Process (Custom OTP Flow)...");

                // 1. Check Phone limit/uniqueness (Optional but good)

                // 2. Generate OTP
                const code = Math.floor(100000 + Math.random() * 900000).toString();
                setGeneratedOtp(code);
                console.log("Generated Custom OTP:", code);

                // 3. Send OTP via Resend
                await sendOtpEmail({ email, otp: code });

                setOtpSent(true);
                setTimer(60);
                Alert.alert('Verify Email', `We've sent a 6-digit code to ${email}.\n\nPlease check your Inbox and SPAM folder.`);
            }
        } catch (error) {
            console.error("[Login/Signup Error]:", error);

            // Handle Unconfirmed Email specific case
            if (error.message.includes('Email not confirmed')) {
                Alert.alert(
                    '📧 Verification Required',
                    'You are trying to Login, but this email has not been verified yet.\n\nSince "Confirm Email" is active on the server, you MUST click the link sent to your email by Supabase to activate your account.'
                );
            } else if (error.message.includes('Invalid login credentials')) {
                Alert.alert('Login Failed', 'Incorrect email or password.');
            } else {
                Alert.alert('Authentication Failed', error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (!otp || otp.length !== 6) {
            Alert.alert('Invalid Code', 'Please enter the complete 6-digit verification code.');
            return;
        }

        setLoading(true);
        try {
            // Verify Custom OTP
            if (generatedOtp && otp !== generatedOtp) {
                throw new Error("Invalid verification code. Please try again.");
            }

            // [FALLBACK] If no generatedOtp (e.g. app restart), verify with Supabase (if they handle it)
            // But for this flow, we strictly rely on generatedOtp
            if (!generatedOtp) {
                // Try Supabase Verify just in case it was a legacy Signup
                const { error } = await supabase.auth.verifyOtp({ email, token: otp, type: 'signup' });
                if (error) throw new Error("Session expired. Please sign up again.");
            }

            console.log("OTP Verified. Creating Account...");

            // 1. Create User in Supabase Auth
            // [IMPORTANT] 'Confirm Email' must be DISABLED in Supabase for this to return a session immediately.
            const { data, error } = await supabase.auth.signUp({
                email: email,
                password: password,
                options: {
                    data: {
                        full_name: fullName,
                        phone_number: phone,
                    }
                }
            });

            if (error) throw error;

            if (error) throw error;

            const user = data.user;
            const session = data.session;

            if (user && !session) {
                Alert.alert(
                    '⚠️ Account Created but Inactive',
                    'Your account was created successfully!\n\nHOWEVER: You cannot login yet because the server requires email verification.\n\n👉 Please go to your Email Inbox (or Spam) and click the confirmation link from "Abu Mafhal".',
                    [{ text: 'OK', onPress: () => setIsLogin(true) }]
                );
                return;
            }

            if (!user) throw new Error("Signup failed. Please try again.");

            // 2. Create Profile/Wallet (Existing Logic)
            if (user && session) {
                // Ensure profile exists (idempotent)
                // Ensure profile exists (idempotent)
                console.log("Inserting user profile into 'profiles' table...");
                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert([{
                        id: user.id,
                        email: email,
                        full_name: fullName,
                        phone_number: phone,
                        role: 'buyer',
                        is_verified: true, // Since we verified OTP
                        is_banned: false
                    }]);

                // ... (rest of profile setup)
                // Create Wallet (Manually, since we removed the trigger)
                console.log("Creating user wallet...");
                const { error: walletError } = await supabase
                    .from('wallets')
                    .insert([{
                        user_id: user.id,
                        balance: 0.00,
                        currency: 'NGN',
                        is_active: true
                    }]);

                // NOTIFICATION: Welcome
                await NotificationService.send({
                    userId: user.id,
                    title: 'Welcome to Abu Mafhal!',
                    message: 'Thanks for joining. Explore thousands of products now.',
                    type: 'welcome',
                    email: email
                });

                Alert.alert('Success', 'Account verified! Welcome to Abu Mafhal.');
                if (onLoginSuccess) onLoginSuccess(user);
            }

        } catch (error) {
            Alert.alert('Verification Failed', error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleResendOtp = async () => {
        if (timer > 0) return;
        setLoading(true);
        try {
            const code = Math.floor(100000 + Math.random() * 900000).toString();
            setGeneratedOtp(code);
            await sendOtpEmail({ email, otp: code });

            setTimer(60);
            Alert.alert('Sent', 'New code sent.');
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.authContainer}>
            {/* DECORATIONS */}
            <View style={styles.circle1} />
            <View style={styles.circle2} />
            <View style={styles.circle3} />
            <View style={styles.circle4} />
            <View style={styles.decorationStrip} />
            <View style={styles.decorationSquare} />

            <SafeAreaView style={styles.safeArea}>
                <TouchableOpacity onPress={onBack} style={{ padding: 16 }}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
            </SafeAreaView>

            <View style={styles.authScroll}>
                <View style={styles.authHeader}>
                    <Image
                        source={settings?.logo_url ? { uri: settings.logo_url } : require('../../assets/logo.jpg')}
                        style={[styles.authLogo, settings?.logo_url && { borderRadius: 50 }]}
                    />
                    <Text style={styles.authBigTitle}>
                        {otpSent ? 'Verify\nEmail' : (isLogin ? 'Hello,\nWelcome Back!' : 'Create\nAccount')}
                    </Text>
                    {otpSent && <Text style={{ color: '#64748B', marginTop: 8 }}>Enter the code sent to {email}</Text>}
                </View>

                <View style={styles.authCard}>

                    {!otpSent ? (
                        <>
                            {/* NORMAL AUTH FORM */}
                            {!isLogin && (
                                <>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Full Name</Text>
                                        <TextInput
                                            style={styles.modernInput}
                                            placeholder="John Doe"
                                            value={fullName}
                                            onChangeText={setFullName}
                                        />
                                    </View>
                                    <View style={styles.inputGroup}>
                                        <Text style={styles.label}>Phone Number</Text>
                                        <TextInput
                                            style={styles.modernInput}
                                            placeholder="08012345678"
                                            value={phone}
                                            onChangeText={setPhone}
                                            keyboardType="phone-pad"
                                        />
                                    </View>
                                </>
                            )}

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Email Address</Text>
                                <TextInput
                                    style={styles.modernInput}
                                    placeholder="user@example.com"
                                    value={email}
                                    onChangeText={setEmail}
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                />
                            </View>

                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Password</Text>
                                <View style={{ position: 'relative', justifyContent: 'center' }}>
                                    <TextInput
                                        style={[styles.modernInput, { paddingRight: 48 }]}
                                        placeholder="••••••••"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry={!showPassword}
                                    />
                                    <TouchableOpacity
                                        onPress={() => setShowPassword(!showPassword)}
                                        style={{ position: 'absolute', right: 16, height: '100%', justifyContent: 'center' }}
                                    >
                                        <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color="#64748B" />
                                    </TouchableOpacity>
                                </View>
                                {isLogin && <TouchableOpacity style={{ marginVertical: 8 }}><Text style={styles.forgotPass}>Forgot Password?</Text></TouchableOpacity>}
                            </View>

                            <TouchableOpacity style={styles.modernBtn} onPress={handleAuthAction} disabled={loading}>
                                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.modernBtnText}>{isLogin ? 'Login' : 'Sign Up'}</Text>}
                            </TouchableOpacity>

                            <View style={styles.divider}>
                                <View style={styles.line} />
                                <Text style={styles.orText}>Or</Text>
                                <View style={styles.line} />
                            </View>

                            <View style={styles.switchRow}>
                                <Text style={styles.switchText}>{isLogin ? "Don't have an account?" : "Already have an account?"}</Text>
                                <TouchableOpacity onPress={() => setIsLogin(!isLogin)}>
                                    <Text style={styles.switchLink}>{isLogin ? 'Sign Up' : 'Login'}</Text>
                                </TouchableOpacity>
                            </View>
                        </>
                    ) : (
                        <>
                            {/* OTP VERIFICATION FORM */}
                            <View style={styles.inputGroup}>
                                <Text style={styles.label}>Verification Code</Text>
                                <TextInput
                                    style={[styles.modernInput, { textAlign: 'center', letterSpacing: 8, fontSize: 24, fontWeight: '700' }]}
                                    placeholder="000000"
                                    value={otp}
                                    onChangeText={setOtp}
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />
                            </View>

                            <TouchableOpacity style={styles.modernBtn} onPress={handleVerifyOtp} disabled={loading}>
                                {loading ? <ActivityIndicator color="white" /> : <Text style={styles.modernBtnText}>Verify & Login</Text>}
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleResendOtp}
                                style={{ marginTop: 20, alignItems: 'center' }}
                            >
                                <Text style={{ color: timer === 0 ? '#4F46E5' : '#94A3B8', fontWeight: '600' }}>
                                    {timer > 0 ? `Resend Code in ${timer}s` : 'Resend Code'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={() => setOtpSent(false)}
                                style={{ marginTop: 20, alignItems: 'center' }}
                            >
                                <Text style={{ color: '#64748B' }}>Entered wrong email?</Text>
                            </TouchableOpacity>
                        </>
                    )}
                </View>
            </View>
        </View>
    );
};
