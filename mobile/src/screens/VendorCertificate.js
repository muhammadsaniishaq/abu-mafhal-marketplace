import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';

import React, { useRef } from 'react';
import { View, Text, StyleSheet, Image, TouchableOpacity, ScrollView, SafeAreaView, Alert, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

const { width, height } = Dimensions.get('window');
// A4 Aspect Ratio: 1 : 1.414
const CERT_WIDTH = width - 40; // More margin
const CERT_HEIGHT = CERT_WIDTH * 1.414;

import { useAppSettings } from '../context/AppSettingsContext';
import { supabase } from '../lib/supabase';

export const VendorCertificate = ({ user, vendorData, onBack }) => {
    const { settings } = useAppSettings();
    const viewRef = useRef();

    const handleDownload = async () => {
        try {
            // 1. Capture the View
            const uri = await captureRef(viewRef, {
                format: 'png',
                quality: 1,
                result: 'tmpfile' // Save to temp for sharing
            });

            // 2. Share/Save
            // Sharing.shareAsync offers "Save Image" option on iOS and Android
            if (Platform.OS === 'android' && FileSystem.StorageAccessFramework) {
                const permissions = await FileSystem.StorageAccessFramework.requestDirectoryPermissionsAsync();
                if (permissions.granted) {
                    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
                    await FileSystem.StorageAccessFramework.createFileAsync(permissions.directoryUri, 'vendor_certificate.png', 'image/png')
                        .then(async (uri) => {
                            await FileSystem.writeAsStringAsync(uri, base64, { encoding: FileSystem.EncodingType.Base64 });
                            Alert.alert('Success', 'Certificate saved successfully!');
                        })
                        .catch(e => {
                            console.log(e);
                            // Fallback if SAF fails or is cancelled
                            Sharing.shareAsync(uri);
                        });
                } else {
                    Sharing.shareAsync(uri);
                }
            } else {
                // iOS or Android without SAF support
                await Sharing.shareAsync(uri);
            }
        } catch (err) {
            console.error(err);
            Alert.alert('Error', 'Could not save certificate. Please try again.');
        }
    };

    const [fetchedName, setFetchedName] = React.useState(null);

    const businessName = fetchedName || vendorData?.business_name || user?.user_metadata?.business_name || "Business Name";
    const dateApproved = vendorData?.updated_at ? new Date(vendorData.updated_at).toLocaleDateString() : new Date().toLocaleDateString();

    React.useEffect(() => {
        const fetchName = async () => {
            if (businessName === "Business Name" && user?.id) {
                // Try fetching from vendors table
                const { data: vData } = await supabase.from('vendors').select('business_name').eq('user_id', user.id).single();
                if (vData?.business_name) {
                    setFetchedName(vData.business_name);
                    return;
                }

                // Fallback to vendor_applications
                const { data: aData } = await supabase.from('vendor_applications').select('business_name').eq('user_id', user.id).order('created_at', { ascending: false }).limit(1).single();
                if (aData?.business_name) {
                    setFetchedName(aData.business_name);
                }
            }
        };
        fetchName();
    }, [user?.id, vendorData]);

    // Use cert_logo_url if available for top logo, otherwise fallback to main logo_url, then default asset
    const logoSource = settings?.cert_logo_url
        ? { uri: settings.cert_logo_url }
        : (settings?.logo_url ? { uri: settings.logo_url } : require('../../assets/logo.jpg'));

    return (
        <View style={{ flex: 1, backgroundColor: '#0F172A' }}>
            <SafeAreaView style={{ flex: 1, paddingTop: Platform.OS === 'android' ? 40 : 0 }}>
                {/* Header Actions */}
                <View style={{ padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', zIndex: 10 }}>
                    <TouchableOpacity onPress={onBack} style={localStyles.iconButton}>
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 16, letterSpacing: 1 }}>OFFICIAL CERTIFICATE</Text>
                    <TouchableOpacity onPress={handleDownload} style={localStyles.iconButton}>
                        <Ionicons name="download-outline" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                <ScrollView
                    contentContainerStyle={{ padding: 20, alignItems: 'center', paddingBottom: 60 }}
                    showsVerticalScrollIndicator={false}
                >
                    {/* A4 PAPER CONTAINER */}
                    <View ref={viewRef} style={[localStyles.paper, { width: CERT_WIDTH, height: CERT_HEIGHT }]}>

                        {/* 1. OUTER FRAME (Thin Elegant) */}
                        <View style={localStyles.outerBorder}>
                            {/* 2. INNER FRAME (Thick Elegant) */}
                            <View style={localStyles.innerPatternFrame}>

                                {/* CORNER ACCENTS REMOVED */}

                                {/* BACKGROUND PATTERN (Subtle Icons) */}
                                <View style={localStyles.patternContainer}>
                                    {Array.from({ length: 40 }).map((_, i) => (
                                        <Ionicons
                                            key={i}
                                            name={['cart-outline', 'pricetag-outline', 'bag-handle-outline', 'storefront-outline'][i % 4]}
                                            size={24}
                                            color="#B45309" // Dark Gold for better visibility
                                            style={{ margin: 15 }} // Removed internal opacity
                                        />
                                    ))}
                                </View>

                                {/* WATERMARK (Logo) */}
                                <View style={localStyles.watermarkContainer}>
                                    <Image source={logoSource} style={{ width: '70%', height: '70%', opacity: 0.05 }} resizeMode="contain" />
                                </View>

                                {/* CONTENT CONTAINER */}
                                <View style={{ width: '100%', height: '100%', justifyContent: 'space-between', zIndex: 10 }}>

                                    {/* --- HEADER SECTION --- */}
                                    <View style={localStyles.headerSection}>
                                        <Image source={logoSource} style={localStyles.logo} resizeMode="contain" />
                                        <Text style={localStyles.orgName}>ABU MAFHAL MARKETPLACE</Text>
                                        <Text style={localStyles.title}>CERTIFICATE</Text>
                                        <Text style={localStyles.subtitle}>OF VENDORSHIP</Text>
                                    </View>

                                    {/* --- BODY SECTION --- */}
                                    <View style={localStyles.bodySection}>
                                        <Text style={localStyles.presentedTo}>This certifies that</Text>

                                        {/* CURSIVE NAME */}
                                        <Text style={localStyles.businessName}>{businessName}</Text>

                                        <Text style={localStyles.bodyText}>
                                            Has successfully completed all identity verification protocols required by Abu Mafhal Marketplace. The holder is hereby recognized as a fully Verified Vendor with all associated privileges and trusted status.
                                        </Text>
                                    </View>

                                    {/* --- FOOTER SECTION --- */}
                                    <View style={localStyles.footerSection}>

                                        {/* LEFT: Signature */}
                                        <View style={localStyles.signBox}>
                                            <Image
                                                source={settings?.cert_signature_url ? { uri: settings.cert_signature_url } : { uri: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e4/Signature_sample.svg/1200px-Signature_sample.svg.png' }}
                                                style={localStyles.signImage}
                                            />
                                            <View style={localStyles.signLine} />
                                            <Text style={localStyles.signLabel}>AUTHORIZED SIGNATURE</Text>
                                        </View>

                                        {/* CENTER: Modern Verified Badge */}
                                        <View style={localStyles.sealContainer}>
                                            <View style={localStyles.sealOuter}>
                                                <View style={localStyles.sealInner}>
                                                    {settings?.cert_badge_url ? (
                                                        <Image source={{ uri: settings.cert_badge_url }} style={{ width: 60, height: 60 }} resizeMode="contain" />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="shield-checkmark" size={36} color="#F59E0B" />
                                                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#0F172A', marginTop: 4, letterSpacing: 1 }}>OFFICIAL</Text>
                                                            <Text style={{ fontSize: 8, fontWeight: '700', color: '#0F172A', letterSpacing: 1 }}>VENDOR</Text>
                                                        </>
                                                    )}
                                                </View>
                                            </View>
                                        </View>

                                        {/* RIGHT: Date */}
                                        <View style={localStyles.dateBox}>
                                            <Text style={localStyles.dateVal}>{dateApproved}</Text>
                                            <View style={localStyles.dateLine} />
                                            <Text style={localStyles.dateLabel}>DATE ISSUED</Text>
                                        </View>
                                    </View>

                                    {/* --- ID (Absolute Bottom) --- */}
                                    <View style={localStyles.idBox}>
                                        <Text style={localStyles.certId}>ID: {vendorData?.id?.split('-')[0].toUpperCase() || 'UNKNOWN'}</Text>
                                    </View>
                                </View>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </View>
    );
};

const localStyles = StyleSheet.create({
    iconButton: {
        width: 40, height: 40, alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 20
    },
    // PAPER STYLING - Pure White Base
    paper: {
        backgroundColor: '#FFFFFF',
        borderRadius: 2,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
        overflow: 'hidden'
    },

    // BORDER SYSTEM (Simple & Clean - Pre-Sample Style)
    outerBorder: {
        flex: 1,
        margin: 15,
        borderWidth: 4,
        borderColor: '#F59E0B', // Standard Gold
        backgroundColor: 'transparent',
    },
    innerPatternFrame: {
        flex: 1,
        margin: 5,
        backgroundColor: '#FFFFFF',
        position: 'relative',
        // Optional: Slight inner line if needed, else plain
        borderWidth: 1,
        borderColor: '#F59E0B'
    },

    // CORNERS REMOVED (User requested pre-sample style)

    // BACKGROUND PATTERN
    patternContainer: {
        ...StyleSheet.absoluteFillObject,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-around',
        alignItems: 'center',
        opacity: 0.2, // Increased to 0.2 for clear visibility
        padding: 20,
        zIndex: 0,
        overflow: 'hidden'
    },

    watermarkContainer: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        alignItems: 'center', justifyContent: 'center',
        zIndex: 1, // Above pattern, below content
    },

    // HEADER - RIGID & ALIGNED
    headerSection: {
        height: '24%', // Increased height slightly to accommodate larger logo
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 50, // Moved down (sauka kasa)
        paddingHorizontal: 20
    },
    logo: { width: 70, height: 70, marginBottom: 10 }, // Increased size (kara girma)
    orgName: {
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 2,
        color: '#64748B',
        textTransform: 'uppercase',
        marginBottom: 8
    },

    // BODY - CENTERED & BALANCED
    bodySection: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
        width: '100%'
    },
    title: {
        fontSize: 28,
        fontWeight: '900',
        color: '#0F172A',
        letterSpacing: 1,
        fontFamily: Platform.OS === 'ios' ? 'Didot' : 'serif',
        textTransform: 'uppercase'
    },
    subtitle: {
        fontSize: 11,
        fontWeight: '600',
        color: '#C29340',
        letterSpacing: 4,
        marginTop: 6,
        textTransform: 'uppercase'
    },

    presentedTo: {
        fontSize: 10,
        color: '#64748B',
        fontStyle: 'italic',
        marginTop: 20,
        marginBottom: 10
    },

    // BUSINESS NAME
    businessName: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        fontFamily: Platform.OS === 'ios' ? 'Bodoni 72' : 'serif',
        textAlign: 'center',
        width: '100%',
        marginBottom: 4,
        paddingBottom: 8,
        borderBottomWidth: 1.5,
        borderBottomColor: '#F59E0B'
    },

    bodyText: {
        fontSize: 10,
        color: '#475569',
        textAlign: 'center',
        lineHeight: 18,
        marginTop: 12,
        paddingHorizontal: 0
    },

    // FOOTER - RIGIDLY ALIGNED
    footerSection: {
        height: '20%',
        flexDirection: 'row',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
        paddingBottom: 30
    },

    // LEFT: Signature
    signBox: { width: '30%', justifyContent: 'flex-end', alignItems: 'flex-start' },
    signImage: {
        width: 180,
        height: 80,
        resizeMode: 'contain',
        opacity: 1,
        marginBottom: -20,
        marginLeft: -50,
    },
    signLine: { height: 1.5, backgroundColor: '#0F172A', width: '100%', marginBottom: 4 },
    signLabel: { fontSize: 8, color: '#64748B', fontWeight: '800', textTransform: 'uppercase' },

    // CENTER: Modern Verified Badge
    sealContainer: { alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 10 },
    sealOuter: {
        // Removed vintage styles
        alignItems: 'center', justifyContent: 'center',
    },
    sealInner: {
        // Modern Hexagon/Badge look simulation (using just icon + text for cleanliness)
        alignItems: 'center', justifyContent: 'center',
    },
    badgeTextVerified: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0F172A',
        marginTop: 4,
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },
    badgeTextVendor: {
        fontSize: 10,
        fontWeight: '700',
        color: '#0F172A',
        fontFamily: Platform.OS === 'ios' ? 'System' : 'sans-serif',
    },

    // RIGHT: Date
    dateBox: { width: '30%', justifyContent: 'flex-end', alignItems: 'flex-end' },
    dateVal: { fontSize: 10, fontWeight: '700', color: '#0F172A', marginBottom: 4 },
    dateLine: { height: 1.5, backgroundColor: '#0F172A', width: '100%', marginBottom: 4 },
    dateLabel: { fontSize: 8, color: '#64748B', fontWeight: '800', textTransform: 'uppercase' },

    idBox: { position: 'absolute', bottom: 8, width: '100%', alignItems: 'center' },
    certId: { fontSize: 8, color: '#94A3B8', letterSpacing: 1 }
});
