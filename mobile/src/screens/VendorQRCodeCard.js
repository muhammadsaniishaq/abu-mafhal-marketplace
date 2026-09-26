import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Alert,
    Dimensions,
    Linking,
    Platform
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Clipboard from 'expo-clipboard';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { UserAvatar } from '../components/UserAvatar';

const { width } = Dimensions.get('window');
const GOLD = '#D9A73A';
const GOLD_LIGHT = '#FDE68A';
const NAVY = '#0B132B';

export const VendorQRCodeCard = ({ user, vendor, onBack }) => {
    const [generating, setGenerating] = useState(false);

    const storeId = vendor?.user_id || vendor?.id || user?.id || '';
    const storeName = vendor?.business_name || vendor?.name || 'Abu Mafhal Verified Store';
    const storeTagline = vendor?.tagline || 'Official Merchant Store • 100% Genuine Guaranteed';
    const storePhone = vendor?.phone || vendor?.whatsapp || '08145853539';
    const storeAddress = vendor?.address || `${vendor?.lga || 'Gashua'}, ${vendor?.state || 'Yobe State'}`;
    const logoUrl = vendor?.logo_url || vendor?.logo;

    // Public web store URL
    const storeUrl = `https://abumafhal.com/store/${storeId}`;

    // Reliable Universal QR Code Image URL
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(storeUrl)}&color=0B132B&bgcolor=FFFFFF`;

    const handleCopyLink = async () => {
        await Clipboard.setStringAsync(storeUrl);
        if (Platform.OS === 'web') alert(`Store link copied: ${storeUrl}`);
        else Alert.alert('Copied!', 'Store public link copied to clipboard.');
    };

    const handleShareWhatsApp = () => {
        const text = encodeURIComponent(
            `🛒 Welcome to *${storeName}* on Abu Mafhal Marketplace!\n\n` +
            `Browse our quality products, authentic brand warranty, and fast nationwide delivery.\n\n` +
            `👉 Visit Store: ${storeUrl}\n\n` +
            `📞 Contact: ${storePhone}`
        );
        Linking.openURL(`https://wa.me/?text=${text}`).catch(() => {
            Alert.alert('Error', 'Unable to open WhatsApp.');
        });
    };

    const handlePrintOrSavePdf = async () => {
        try {
            setGenerating(true);
            const htmlContent = `
                <html>
                    <head>
                        <style>
                            body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; padding: 30px; text-align: center; color: #0F172A; }
                            .card { border: 4px solid #D9A73A; border-radius: 24px; padding: 36px 24px; max-width: 480px; margin: 0 auto; background: #FFFFFF; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
                            .logo { width: 90px; height: 90px; border-radius: 45px; border: 3px solid #D9A73A; object-fit: cover; }
                            .store-name { font-size: 26px; font-weight: 900; margin-top: 14px; color: #0B132B; }
                            .badge { display: inline-block; background: #FEF3C7; color: #B45309; padding: 4px 12px; border-radius: 12px; font-size: 12px; font-weight: 800; margin-top: 6px; }
                            .tagline { font-size: 13px; color: #64748B; margin: 10px 0 20px 0; }
                            .qr-wrap { background: #F8FAFC; border: 2px dashed #CBD5E1; border-radius: 16px; padding: 16px; display: inline-block; }
                            .qr-img { width: 220px; height: 220px; display: block; margin: 0 auto; }
                            .scan-txt { font-size: 14px; font-weight: 800; color: #0B132B; margin-top: 12px; letter-spacing: 1px; }
                            .url-txt { font-size: 12px; color: #3B82F6; margin-top: 4px; word-break: break-all; }
                            .details { margin-top: 24px; border-top: 1px solid #E2E8F0; padding-top: 16px; font-size: 12px; color: #475569; }
                            .footer { margin-top: 24px; font-size: 11px; color: #94A3B8; }
                        </style>
                    </head>
                    <body>
                        <div class="card">
                            ${logoUrl ? `<img src="${logoUrl}" class="logo" />` : ''}
                            <div class="store-name">${storeName}</div>
                            <div class="badge">⭐ VERIFIED MERCHANT STORE</div>
                            <div class="tagline">${storeTagline}</div>

                            <div class="qr-wrap">
                                <img src="${qrImageUrl}" class="qr-img" />
                                <div class="scan-txt">SCAN WITH YOUR PHONE TO SHOP</div>
                                <div class="url-txt">${storeUrl}</div>
                            </div>

                            <div class="details">
                                <div><strong>📍 Location:</strong> ${storeAddress}</div>
                                <div style="margin-top: 4px;"><strong>📞 Phone / WhatsApp:</strong> ${storePhone}</div>
                            </div>

                            <div class="footer">
                                Abu Mafhal Marketplace Official Merchant Display Card • Scan to browse live products
                            </div>
                        </div>
                    </body>
                </html>
            `;

            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (err) {
            console.error('Error generating QR flyer:', err);
            Alert.alert('Error', 'Could not generate flyer PDF.');
        } finally {
            setGenerating(false);
        }
    };

    return (
        <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.container}
        >
            {/* Header Description */}
            <View style={styles.headerInfo}>
                <Text style={styles.headerTitle}>Store QR Flyer & Link</Text>
                <Text style={styles.headerSub}>
                    Display this flyer at your shop counter, share on WhatsApp status, or print for promotional marketing.
                </Text>
            </View>

            {/* Printable Luxury Promo Flyer Card */}
            <View style={styles.flyerCard}>
                <LinearGradient
                    colors={['#070D1B', '#0E1A2E']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.flyerHeader}
                >
                    <UserAvatar
                        user={user}
                        sourceUrl={logoUrl}
                        size={64}
                        border={GOLD}
                    />
                    <Text style={styles.flyerStoreName} numberOfLines={1}>
                        {storeName}
                    </Text>
                    <View style={styles.badgePill}>
                        <Ionicons name="checkmark-circle" size={13} color={GOLD} />
                        <Text style={styles.badgePillText}>VERIFIED MERCHANT</Text>
                    </View>
                    <Text style={styles.flyerTagline} numberOfLines={2}>
                        {storeTagline}
                    </Text>
                </LinearGradient>

                {/* QR Code Container */}
                <View style={styles.qrSection}>
                    <View style={styles.qrBox}>
                        <Image
                            source={{ uri: qrImageUrl }}
                            style={styles.qrImage}
                            resizeMode="contain"
                        />
                    </View>
                    <Text style={styles.scanNotice}>SCAN TO BROWSE & ORDER</Text>
                    <Text style={styles.storeUrlText} numberOfLines={1}>
                        {storeUrl}
                    </Text>
                </View>

                {/* Store Contact Footer */}
                <View style={styles.contactFooter}>
                    <View style={styles.contactItem}>
                        <Ionicons name="location-outline" size={14} color="#64748B" />
                        <Text style={styles.contactText} numberOfLines={1}>{storeAddress}</Text>
                    </View>
                    <View style={styles.contactItem}>
                        <Ionicons name="call-outline" size={14} color="#64748B" />
                        <Text style={styles.contactText} numberOfLines={1}>{storePhone}</Text>
                    </View>
                </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionsContainer}>
                {/* Copy Link Button */}
                <TouchableOpacity
                    style={[styles.btn, styles.copyBtn]}
                    onPress={handleCopyLink}
                    activeOpacity={0.8}
                >
                    <Ionicons name="copy-outline" size={18} color="#0F172A" />
                    <Text style={styles.copyBtnText}>Copy Store Link</Text>
                </TouchableOpacity>

                {/* WhatsApp Share Button */}
                <TouchableOpacity
                    style={[styles.btn, styles.whatsappBtn]}
                    onPress={handleShareWhatsApp}
                    activeOpacity={0.8}
                >
                    <Ionicons name="logo-whatsapp" size={18} color="#FFFFFF" />
                    <Text style={styles.whatsappBtnText}>Share on WhatsApp</Text>
                </TouchableOpacity>

                {/* Print / Save PDF Flyer */}
                <TouchableOpacity
                    style={[styles.btn, styles.printBtn]}
                    onPress={handlePrintOrSavePdf}
                    disabled={generating}
                    activeOpacity={0.8}
                >
                    <Ionicons name="print-outline" size={18} color="#FFFFFF" />
                    <Text style={styles.printBtnText}>
                        {generating ? 'Preparing Flyer...' : 'Print / Save PDF Flyer'}
                    </Text>
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 110,
        alignItems: 'center'
    },
    headerInfo: {
        width: '100%',
        marginBottom: 16
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: -0.3
    },
    headerSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 3,
        lineHeight: 17
    },
    flyerCard: {
        width: '100%',
        maxWidth: 360,
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: GOLD,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 16,
        elevation: 4
    },
    flyerHeader: {
        alignItems: 'center',
        padding: 22,
        paddingBottom: 18
    },
    flyerStoreName: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 10,
        textAlign: 'center'
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        backgroundColor: 'rgba(217, 167, 58, 0.2)',
        borderWidth: 1,
        borderColor: GOLD,
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
        marginTop: 6
    },
    badgePillText: {
        fontSize: 10,
        fontWeight: '800',
        color: GOLD_LIGHT,
        letterSpacing: 0.5
    },
    flyerTagline: {
        fontSize: 11.5,
        color: '#94A3B8',
        textAlign: 'center',
        marginTop: 8,
        lineHeight: 16,
        paddingHorizontal: 10
    },
    qrSection: {
        alignItems: 'center',
        padding: 20,
        backgroundColor: '#FFFFFF'
    },
    qrBox: {
        width: 190,
        height: 190,
        borderRadius: 16,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        padding: 10,
        alignItems: 'center',
        justifyContent: 'center'
    },
    qrImage: {
        width: 170,
        height: 170
    },
    scanNotice: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 1,
        marginTop: 14
    },
    storeUrlText: {
        fontSize: 11,
        color: '#2563EB',
        fontWeight: '600',
        marginTop: 3
    },
    contactFooter: {
        backgroundColor: '#F8FAFC',
        padding: 14,
        borderTopWidth: 1,
        borderColor: '#F1F5F9',
        gap: 6
    },
    contactItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    contactText: {
        fontSize: 11.5,
        color: '#475569',
        fontWeight: '600'
    },
    actionsContainer: {
        width: '100%',
        maxWidth: 360,
        gap: 10,
        marginTop: 18
    },
    btn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 14
    },
    copyBtn: {
        backgroundColor: '#F1F5F9',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    copyBtnText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A'
    },
    whatsappBtn: {
        backgroundColor: '#16A34A'
    },
    whatsappBtnText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#FFFFFF'
    },
    printBtn: {
        backgroundColor: NAVY
    },
    printBtnText: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#FFFFFF'
    }
});
