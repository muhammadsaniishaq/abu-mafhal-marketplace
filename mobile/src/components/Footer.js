import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Image, Linking, Alert, TextInput } from 'react-native';
import { Ionicons, FontAwesome5 } from '@expo/vector-icons';
import { styles } from '../styles/theme';

import { useAppSettings } from '../context/AppSettingsContext';

const SOCIALS = [
    { icon: 'logo-facebook', url: 'https://facebook.com/abumafhal' },
    { icon: 'logo-instagram', url: 'https://instagram.com/abumafhal' },
    { icon: 'logo-twitter', url: 'https://x.com/abumafhal' },
];

const FOOTER_LINKS = {
    'Company': ['About Us', 'Contact', 'Vendors'],
    'Support': ['Shipping', 'Returns', 'Privacy'],
};

export const Footer = ({ onEnterShop, onNavigate }) => {
    const { settings } = useAppSettings();
    const [email, setEmail] = useState('');

    const handleSubscribe = () => {
        if (!email) return;
        Alert.alert('Subscribed!', `Thank you for subscribing with ${email}`);
        setEmail('');
    };

    const handleLinkPress = (title, link) => {
        // Special case for Shop
        if (title === 'Shop') {
            onEnterShop();
            return;
        }

        // Check if it's a known page
        if (onNavigate) {
            onNavigate(link);
        } else {
            Alert.alert(link, 'This page is coming soon!');
        }
    };

    return (
        <View style={styles.modernFooter}>
            {/* Brand & Socials */}
            <View style={styles.footerBrandSection}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <Image
                        source={settings?.logo_url ? { uri: settings.logo_url } : require('../../assets/logo.jpg')}
                        style={[
                            { width: 40, height: 40, borderRadius: 8 },
                            settings?.logo_url && { backgroundColor: 'white' }
                        ]}
                    />
                    <View style={{ marginLeft: 12 }}>
                        <Text style={styles.footerBrandTitle}>{settings?.app_name || 'ABU MAFHAL'}</Text>
                        <Text style={styles.footerBrandSub}>Marketplace</Text>
                    </View>
                </View>
                <Text style={styles.footerDesc}>Nigeria's premier multi-vendor marketplace. Buy and sell with confidence.</Text>

                {/* Newsletter Section */}
                <View style={{ marginBottom: 24 }}>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 13, marginBottom: 8 }}>Subscribe to our Newsletter</Text>
                    <View style={{ flexDirection: 'row', height: 44 }}>
                        <TextInput
                            placeholder="Enter your email"
                            placeholderTextColor="#64748B"
                            value={email}
                            onChangeText={setEmail}
                            style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.1)', borderTopLeftRadius: 8, borderBottomLeftRadius: 8, paddingHorizontal: 16, color: 'white', fontSize: 13 }}
                        />
                        <TouchableOpacity onPress={handleSubscribe} style={{ backgroundColor: '#EF4444', paddingHorizontal: 16, alignItems: 'center', justifyContent: 'center', borderTopRightRadius: 8, borderBottomRightRadius: 8 }}>
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 12 }}>JOIN</Text>
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={styles.socialRow}>
                    {SOCIALS.map((s, i) => (
                        <TouchableOpacity key={i} style={styles.socialBtn} onPress={() => Linking.openURL(s.url)}>
                            <Ionicons name={s.icon} size={18} color="#CBD5E1" />
                        </TouchableOpacity>
                    ))}
                </View>
            </View>

            {/* Links Grid */}
            <View style={styles.footerLinksGrid}>
                {Object.entries(FOOTER_LINKS).map(([title, links]) => (
                    <View key={title} style={styles.footerLinkCol}>
                        <Text style={styles.footerLinkHeader}>{title}</Text>
                        {links.map((link, i) => (
                            <TouchableOpacity key={i} onPress={() => handleLinkPress(title, link)}>
                                <Text style={styles.footerLinkItem}>{link}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                ))}
            </View>

            {/* Contact Info */}
            <View style={styles.footerContact}>
                <Text style={styles.footerLinkHeader}>Contact Us</Text>
                <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('mailto:support@abumafhal.com')}>
                    <Ionicons name="mail-outline" size={16} color="#3B82F6" />
                    <Text style={styles.contactText}>support@abumafhal.com</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.contactRow} onPress={() => Linking.openURL('tel:+2348145853539')}>
                    <Ionicons name="call-outline" size={16} color="#3B82F6" />
                    <Text style={styles.contactText}>+234 814 585 3539</Text>
                </TouchableOpacity>
                <View style={styles.contactRow}>
                    <Ionicons name="location-outline" size={16} color="#3B82F6" />
                    <Text style={styles.contactText}>123 Goni Aji Street, Gashua, Yobe</Text>
                </View>
            </View>

            {/* Payment & Copyright */}
            <View style={styles.footerBottom}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                    {['Visa', 'Mastercard', 'PayPal', 'Crypto'].map((m, i) => (
                        <View key={i} style={styles.paymentBadge}><Text style={{ fontSize: 10, fontWeight: '700', color: '#334155' }}>{m}</Text></View>
                    ))}
                </View>
                <View style={styles.secureRow}>
                    <Ionicons name="shield-checkmark" size={14} color="#10B981" />
                    <Text style={{ color: '#94A3B8', fontSize: 12, marginLeft: 6 }}>SSL Encrypted Payment</Text>
                </View>
                <Text style={styles.copyright}>© {new Date().getFullYear()} ABU MAFHAL MARKETPLACE.</Text>
            </View>
        </View>
    );
};
