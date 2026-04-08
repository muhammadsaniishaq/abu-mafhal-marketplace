import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, Alert, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { useAppSettings } from '../context/AppSettingsContext';

const SOCIALS = [
    { icon: 'logo-facebook', url: 'https://facebook.com/abumafhal', color: '#1877F2' },
    { icon: 'logo-instagram', url: 'https://instagram.com/abumafhal', color: '#E4405F' },
    { icon: 'logo-twitter', url: 'https://x.com/abumafhal', color: '#1DA1F2' },
    { icon: 'logo-whatsapp', url: 'https://wa.me/2348145853539', color: '#25D366' },
];

export const Footer = ({ onEnterShop, onNavigate }) => {
    const { settings } = useAppSettings();
    const [email, setEmail] = useState('');

    const handleSubscribe = () => {
        if (!email) return;
        Alert.alert('Elite Access', `Exclusive updates will be sent to ${email}`);
        setEmail('');
    };

    const handleLinkPress = (screen) => {
        if (onNavigate) {
            onNavigate(screen);
        } else {
            Alert.alert('Notice', 'Navigation link is being updated.');
        }
    };

    return (
        <View style={[styles.modernFooter, { paddingBottom: 60 }]}>
            {/* Elite Brand Header */}
            <View style={{ marginBottom: 32 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                     <View style={{ width: 48, height: 48, backgroundColor: '#3B82F6', borderRadius: 14, alignItems: 'center', justifyContent: 'center', shadowColor: '#3B82F6', shadowOpacity: 0.3, shadowRadius: 10, elevation: 5 }}>
                        <Text style={{ color: 'white', fontWeight: '900', fontSize: 24 }}>A</Text>
                    </View>
                    <View style={{ marginLeft: 16 }}>
                        <Text style={{ color: 'white', fontSize: 20, fontWeight: '900', letterSpacing: -0.5 }}>ABU MAFHAL</Text>
                        <Text style={{ color: '#3B82F6', fontSize: 10, fontWeight: '800', letterSpacing: 2 }}>ELITE ECOSYSTEM</Text>
                    </View>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 14, lineHeight: 22, fontWeight: '500' }}>
                    Nigeria's premier multi-vendor bridge, connecting elite sellers with a global audience through AI-driven logistics.
                </Text>
            </View>

            {/* Newsletter Pulse */}
            <View style={{ backgroundColor: 'rgba(255,255,255,0.03)', padding: 20, borderRadius: 24, marginBottom: 32, borderRotate: 1, borderColor: 'rgba(255,255,255,0.05)' }}>
                <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, marginBottom: 8 }}>Join the Elite Pulse</Text>
                <Text style={{ color: '#64748B', fontSize: 12, marginBottom: 16 }}>Get early access to global product drops.</Text>
                <View style={{ flexDirection: 'row', height: 50, gap: 8 }}>
                    <TextInput
                        placeholder="Your email address"
                        placeholderTextColor="#475569"
                        value={email}
                        onChangeText={setEmail}
                        style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.2)', borderRadius: 12, paddingHorizontal: 16, color: 'white', fontSize: 14, fontWeight: '600' }}
                    />
                    <TouchableOpacity onPress={handleSubscribe} style={{ backgroundColor: '#3B82F6', paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center', borderRadius: 12 }}>
                        <Ionicons name="send" size={18} color="white" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Quick Navigation */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 40 }}>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 11, letterSpacing: 1.5, marginBottom: 20 }}>EXPLORE</Text>
                    <TouchableOpacity onPress={onEnterShop} style={{ marginBottom: 12 }}><Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>Shop Elite</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleLinkPress('about')} style={{ marginBottom: 12 }}><Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>About Founder</Text></TouchableOpacity>
                    <TouchableOpacity onPress={() => handleLinkPress('support')} style={{ marginBottom: 12 }}><Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>Global Support</Text></TouchableOpacity>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={{ color: '#3B82F6', fontWeight: '900', fontSize: 11, letterSpacing: 1.5, marginBottom: 20 }}>LEGAL</Text>
                    <TouchableOpacity style={{ marginBottom: 12 }}><Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>Privacy Protocol</Text></TouchableOpacity>
                    <TouchableOpacity style={{ marginBottom: 12 }}><Text style={{ color: '#F8FAFC', fontSize: 14, fontWeight: '700' }}>Terms of Service</Text></TouchableOpacity>
                </View>
            </View>

            {/* Social Connection */}
            <View style={{ flexDirection: 'row', gap: 16, marginBottom: 40 }}>
                {SOCIALS.map((s, i) => (
                    <TouchableOpacity key={i} style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center' }} onPress={() => Linking.openURL(s.url)}>
                        <Ionicons name={s.icon} size={20} color={s.color} />
                    </TouchableOpacity>
                ))}
            </View>

            {/* Platform Trust */}
            <View style={{ paddingTop: 32, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', alignItems: 'center' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 16, backgroundColor: 'rgba(255, 255, 255, 0.03)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 10 }}>
                    <Ionicons name="shield-checkmark" size={14} color="#64748B" />
                    <Text style={{ color: '#64748B', fontSize: 11, fontWeight: '800' }}>256-BIT ENCRYPTION ACTIVE</Text>
                </View>
                <Text style={{ color: '#475569', fontSize: 11, fontWeight: '700' }}>© {new Date().getFullYear()} ABU MAFHAL MARKETPLACE</Text>
                <Text style={{ color: '#1E293B', fontSize: 9, fontWeight: '900', marginTop: 8, letterSpacing: 1 }}>V 2.1.2-ELITE • VISIONARY ECOSYSTEM</Text>
            </View>
        </View>
    );
};
