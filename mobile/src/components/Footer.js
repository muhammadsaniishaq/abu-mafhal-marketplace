import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Linking, Alert, TextInput, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

const AM_LOGO = require('../../assets/am_logo.png');

/* ─── Brand Colors ─── */
const BRAND = {
    bg: '#0E1A2E',
    gold: '#D9A73A',
    goldLight: '#F5C842',
    goldDim: 'rgba(217,167,58,0.15)',
    goldBorder: 'rgba(217,167,58,0.25)',
    white: '#FFFFFF',
    mutedWhite: 'rgba(255,255,255,0.55)',
    divider: 'rgba(217,167,58,0.1)',
};

const SOCIALS = [
    { icon: 'logo-facebook', label: 'Facebook', url: 'https://facebook.com/abumafhal' },
    { icon: 'logo-instagram', label: 'Instagram', url: 'https://instagram.com/abumafhal' },
    { icon: 'logo-twitter', label: 'X (Twitter)', url: 'https://x.com/abumafhal' },
    { icon: 'logo-whatsapp', label: 'WhatsApp', url: 'https://wa.me/2348145853539' },
];

const EXPLORE_LINKS = [
    { label: 'Shop Elite', screen: 'shop', icon: 'bag-handle-outline' },
    { label: 'Become a Vendor', screen: 'vendor', icon: 'storefront-outline' },
    { label: 'Global Logistics', screen: 'support', icon: 'airplane-outline' },
    { label: 'AI Support', screen: 'support', icon: 'sparkles-outline' },
];

const LEGAL_LINKS = [
    { label: 'About Founder', screen: 'about', icon: 'person-outline' },
    { label: 'Privacy Policy', screen: 'privacy', icon: 'shield-outline' },
    { label: 'Terms of Service', screen: 'terms', icon: 'document-text-outline' },
    { label: 'Help Center', screen: 'support', icon: 'help-circle-outline' },
];

export const Footer = ({ onEnterShop, onNavigate }) => {
    const [email, setEmail] = useState('');
    const [subscribed, setSubscribed] = useState(false);

    const handleSubscribe = () => {
        if (!email.trim()) {
            Alert.alert('Subscription', 'Please enter your email address.');
            return;
        }
        if (!email.includes('@')) {
            Alert.alert('Invalid Email', 'Please enter a valid email address.');
            return;
        }
        setSubscribed(true);
        setEmail('');
        Alert.alert('🎉 Subscribed!', `Exclusive updates from Abu Mafhal will be sent to ${email}`);
        setTimeout(() => setSubscribed(false), 5000);
    };

    const handleNav = (screen) => {
        if (screen === 'shop' && onEnterShop) {
            onEnterShop();
        } else if (onNavigate) {
            onNavigate(screen);
        } else {
            Alert.alert('Navigation', 'This section is coming soon.');
        }
    };

    const handleSocial = (url) => {
        Linking.canOpenURL(url)
            .then(supported => {
                if (supported) Linking.openURL(url);
                else Alert.alert('Error', 'Cannot open this link.');
            })
            .catch(() => Alert.alert('Error', 'Cannot open this link.'));
    };

    return (
        <View style={{ backgroundColor: BRAND.bg, marginTop: 20 }}>
            {/* ── Gold Gradient Top Border ── */}
            <LinearGradient
                colors={['transparent', BRAND.gold, BRAND.goldLight, BRAND.gold, 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 2, width: '100%' }}
            />

            <View style={{ padding: 22, paddingBottom: 16 }}>

                {/* ── Brand Header ── */}
                <View style={{ marginBottom: 24 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
                        {/* Logo */}
                        <View style={{
                            width: 50, height: 50, borderRadius: 14,
                            backgroundColor: '#0E1A2E',
                            alignItems: 'center', justifyContent: 'center',
                            borderWidth: 2, borderColor: BRAND.goldBorder,
                            overflow: 'hidden',
                            shadowColor: BRAND.gold, shadowOffset: { width: 0, height: 0 },
                            shadowOpacity: 0.4, shadowRadius: 8, elevation: 4,
                        }}>
                            <Image
                                source={AM_LOGO}
                                style={{ width: 44, height: 44 }}
                                resizeMode="contain"
                            />
                        </View>
                        <View style={{ marginLeft: 14 }}>
                            <Text style={{ color: BRAND.white, fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>ABU MAFHAL</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 1 }}>
                                <View style={{ width: 5, height: 5, borderRadius: 2.5, backgroundColor: BRAND.gold }} />
                                <Text style={{ color: BRAND.gold, fontSize: 9.5, fontWeight: '900', letterSpacing: 2.5 }}>ELITE ECOSYSTEM</Text>
                            </View>
                        </View>
                        {/* Version badge */}
                        <View style={{
                            marginLeft: 'auto', backgroundColor: BRAND.goldDim,
                            paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
                            borderWidth: 1, borderColor: BRAND.goldBorder,
                        }}>
                            <Text style={{ color: BRAND.gold, fontSize: 8, fontWeight: '900', letterSpacing: 1 }}>v2.1.2</Text>
                        </View>
                    </View>

                    <Text style={{ color: BRAND.mutedWhite, fontSize: 13, lineHeight: 21, fontWeight: '500', marginBottom: 16 }}>
                        Nigeria's premier multi-vendor marketplace — connecting elite sellers with a global audience through AI-driven logistics and secure escrow payments.
                    </Text>

                    {/* Social Icons */}
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        {SOCIALS.map((s, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => handleSocial(s.url)}
                                accessibilityLabel={s.label}
                                style={{
                                    width: 40, height: 40, borderRadius: 12,
                                    backgroundColor: BRAND.goldDim,
                                    alignItems: 'center', justifyContent: 'center',
                                    borderWidth: 1, borderColor: BRAND.goldBorder,
                                }}>
                                <Ionicons name={s.icon} size={18} color={BRAND.gold} />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Divider ── */}
                <View style={{ height: 1, backgroundColor: BRAND.divider, marginBottom: 22 }} />

                {/* ── Newsletter ── */}
                <View style={{
                    backgroundColor: 'rgba(217,167,58,0.06)',
                    borderRadius: 16, padding: 18, marginBottom: 22,
                    borderWidth: 1, borderColor: BRAND.goldBorder,
                }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                        <Ionicons name="mail" size={16} color={BRAND.gold} />
                        <Text style={{ color: BRAND.white, fontWeight: '900', fontSize: 14.5 }}>Elite Newsletter</Text>
                    </View>
                    <Text style={{ color: BRAND.mutedWhite, fontSize: 11.5, marginBottom: 14, lineHeight: 18 }}>
                        Get early access to global product drops, vendor discounts & AI logistics updates.
                    </Text>
                    <View style={{ flexDirection: 'row', gap: 8, height: 46 }}>
                        <TextInput
                            placeholder="Enter your email..."
                            placeholderTextColor="rgba(255,255,255,0.3)"
                            value={email}
                            onChangeText={setEmail}
                            keyboardType="email-address"
                            autoCapitalize="none"
                            style={{
                                flex: 1, backgroundColor: 'rgba(255,255,255,0.06)',
                                borderRadius: 10, paddingHorizontal: 14,
                                color: 'white', fontSize: 13, fontWeight: '600',
                                borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
                            }}
                        />
                        <TouchableOpacity
                            onPress={handleSubscribe}
                            style={{
                                backgroundColor: BRAND.gold,
                                paddingHorizontal: 18, alignItems: 'center',
                                justifyContent: 'center', borderRadius: 10,
                                shadowColor: BRAND.gold, shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
                            }}>
                            {subscribed
                                ? <Ionicons name="checkmark" size={20} color={BRAND.bg} />
                                : <Ionicons name="send" size={18} color={BRAND.bg} />
                            }
                        </TouchableOpacity>
                    </View>
                </View>

                {/* ── Navigation Links ── */}
                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 22 }}>
                    {/* Explore */}
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 }}>
                            <View style={{ width: 3, height: 12, backgroundColor: BRAND.gold, borderRadius: 1.5 }} />
                            <Text style={{ color: BRAND.gold, fontWeight: '900', fontSize: 10, letterSpacing: 2 }}>EXPLORE</Text>
                        </View>
                        {EXPLORE_LINKS.map((link, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => handleNav(link.screen)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}
                            >
                                <Ionicons name={link.icon} size={13} color={BRAND.goldBorder.replace(')', '').split('(')[1] ? BRAND.gold : BRAND.gold} />
                                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13, fontWeight: '700' }}>
                                    {link.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* Vertical divider */}
                    <View style={{ width: 1, backgroundColor: BRAND.divider }} />

                    {/* Legal */}
                    <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 14 }}>
                            <View style={{ width: 3, height: 12, backgroundColor: 'rgba(255,255,255,0.4)', borderRadius: 1.5 }} />
                            <Text style={{ color: 'rgba(255,255,255,0.5)', fontWeight: '900', fontSize: 10, letterSpacing: 2 }}>LEGAL</Text>
                        </View>
                        {LEGAL_LINKS.map((link, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => handleNav(link.screen)}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 12 }}
                            >
                                <Ionicons name={link.icon} size={13} color="rgba(255,255,255,0.35)" />
                                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: '700' }}>
                                    {link.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* ── Contact Info ── */}
                <View style={{
                    backgroundColor: BRAND.goldDim,
                    borderRadius: 14, padding: 14, marginBottom: 22,
                    borderWidth: 1, borderColor: BRAND.goldBorder,
                }}>
                    <Text style={{ color: BRAND.gold, fontWeight: '900', fontSize: 10, letterSpacing: 2, marginBottom: 12 }}>CONTACT</Text>
                    {[
                        { icon: 'mail-outline', text: 'support@abumafhal.com', action: () => Linking.openURL('mailto:support@abumafhal.com') },
                        { icon: 'call-outline', text: '+234 814 585 3539', action: () => Linking.openURL('tel:+2348145853539') },
                        { icon: 'location-outline', text: 'Goni Aji St, Gashua, Yobe State, Nigeria', action: null },
                    ].map((item, i) => (
                        <TouchableOpacity
                            key={i}
                            onPress={item.action}
                            disabled={!item.action}
                            style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: i < 2 ? 10 : 0 }}
                        >
                            <Ionicons name={item.icon} size={14} color={BRAND.gold} style={{ marginTop: 1 }} />
                            <Text style={{ color: BRAND.mutedWhite, fontSize: 12.5, fontWeight: '600', flex: 1, lineHeight: 18 }}>
                                {item.text}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* ── Security Badge ── */}
                <View style={{
                    flexDirection: 'row', alignItems: 'center', gap: 10,
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    borderRadius: 12, padding: 12, marginBottom: 22,
                    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
                }}>
                    <Ionicons name="shield-checkmark" size={22} color={BRAND.gold} />
                    <View>
                        <Text style={{ color: BRAND.gold, fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 }}>SECURE PLATFORM</Text>
                        <Text style={{ color: BRAND.mutedWhite, fontSize: 11.5, fontWeight: '600', marginTop: 1 }}>SSL 256-bit Encrypted • Escrow Protected</Text>
                    </View>
                </View>

                {/* ── Gold Divider ── */}
                <View style={{ height: 1, backgroundColor: BRAND.divider, marginBottom: 16 }} />

                {/* ── Bottom Bar ── */}
                <View style={{ alignItems: 'center', gap: 6 }}>
                    <Text style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, fontWeight: '700', textAlign: 'center' }}>
                        © {new Date().getFullYear()} Abu Mafhal Marketplace. Built for the Elite.
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: BRAND.gold }} />
                        <Text style={{ color: 'rgba(217,167,58,0.5)', fontSize: 9.5, fontWeight: '900', letterSpacing: 1.5 }}>
                            LAGOS · KANO · ABUJA · WORLDWIDE
                        </Text>
                        <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: BRAND.gold }} />
                    </View>
                    <Text style={{ color: 'rgba(255,255,255,0.2)', fontSize: 9, fontWeight: '800', letterSpacing: 1, marginTop: 2 }}>
                        V 2.1.2-ELITE • VISIONARY ECOSYSTEM
                    </Text>
                </View>

            </View>

            {/* ── Extra padding for bottom nav ── */}
            <View style={{ height: 80 }} />
        </View>
    );
};
