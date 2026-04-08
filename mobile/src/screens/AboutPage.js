import React from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, StyleSheet, Dimensions, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles as theme } from '../styles/theme';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');

export const AboutPage = ({ onBack }) => {
    return (
        <View style={theme.container}>
            {/* Header */}
            <View style={[theme.headerRow, { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                <TouchableOpacity onPress={onBack}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={theme.sectionTitle}>About Founder</Text>
                <View style={{ width: 24 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
                {/* Founder Hero */}
                <View style={styles.heroSection}>
                    <Image 
                        source={require('../../assets/founder.png')} 
                        style={styles.founderImage}
                        resizeMode="cover"
                    />
                    <LinearGradient
                        colors={['transparent', 'rgba(15, 23, 42, 0.95)']}
                        style={styles.heroOverlay}
                    >
                        {/* Video Play Placeholder */}
                        <TouchableOpacity style={styles.videoPlayBtn}>
                            <Ionicons name="play" size={24} color="white" />
                        </TouchableOpacity>
                        
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', width: '100%' }}>
                            <View>
                                <View style={styles.heroTag}>
                                    <Text style={styles.heroTagText}>THE ARCHITECT</Text>
                                </View>
                                <Text style={styles.founderName}>Sani Ishaq</Text>
                            </View>
                            <TouchableOpacity style={styles.shareBtn}>
                                <Ionicons name="share-social" size={20} color="white" />
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>

                {/* The Story */}
                <View style={styles.contentPadding}>
                    <Text style={styles.sectionHeading}>Driven by Innovation.</Text>
                    <Text style={styles.storyText}>
                        "My journey started with a simple observation: Nigeria is home to incredible craftsmanship, but many lack the digital tools to reach the global market."
                    </Text>
                    <Text style={styles.storyText}>
                        I built Abu Mafhal to be that missing link. By integrating advanced AI, secure payments, and reliable logistics, we've created an elite ecosystem where every vendor can thrive.
                    </Text>
                </View>

                {/* NEW: Milestone Timeline (Vertical) */}
                <View style={styles.contentPadding}>
                    <Text style={styles.sectionHeading}>Our Evolution</Text>
                    <View style={styles.timelineContainer}>
                        {[
                            { year: "2024", title: "The Inception", desc: "Northern Nigeria's first multi-vendor bridge prototype." },
                            { year: "2025", title: "AI Launch", desc: "Elite logistics tracker powered by regional AI." },
                            { year: "2026", title: "Future", desc: "Decentralized governance & automated logistics." },
                        ].map((item, i) => (
                            <View key={i} style={styles.timelineItem}>
                                <View style={styles.timelineLineContainer}>
                                    <View style={styles.timelinePoint} />
                                    {i < 2 && <View style={styles.timelineLine} />}
                                </View>
                                <View style={styles.timelineContent}>
                                    <Text style={styles.timelineYear}>{item.year}</Text>
                                    <Text style={styles.timelineTitle}>{item.title}</Text>
                                    <Text style={styles.timelineDesc}>{item.desc}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* NEW: Testimonials (Horizontal Scroll simulated/Cards) */}
                <View style={styles.contentPadding}>
                    <Text style={styles.sectionHeading}>Trusted Visionaries</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -24, paddingHorizontal: 24 }}>
                        {[
                            { name: "Alhaji Ibrahim", role: "Vendor", text: "Abu Mafhal transformed my business." },
                            { name: "Sadiya Yusuf", role: "Buyer", text: "Trust and speed are the priorities here." },
                            { name: "Engr. Bello", role: "Partner", text: "The UI is clean and support is 24/7." },
                        ].map((t, i) => (
                            <View key={i} style={styles.testimonialCard}>
                                <Ionicons name="star" size={12} color="#F59E0B" />
                                <Text style={styles.testimonialText}>"{t.text}"</Text>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                    <View style={styles.avatarTiny}><Text style={styles.avatarText}>{t.name[0]}</Text></View>
                                    <View>
                                        <Text style={styles.testimonialName}>{t.name}</Text>
                                        <Text style={styles.testimonialRole}>{t.role}</Text>
                                    </View>
                                </View>
                            </View>
                        ))}
                    </ScrollView>
                </View>

                {/* Stats */}
                <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>10k+</Text>
                        <Text style={styles.statLabel}>Users</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>500+</Text>
                        <Text style={styles.statLabel}>Vendors</Text>
                    </View>
                    <View style={styles.statBox}>
                        <Text style={styles.statNum}>24/7</Text>
                        <Text style={styles.statLabel}>Support</Text>
                    </View>
                </View>

                {/* NEW: Founders Message Quote */}
                <View style={styles.quoteSection}>
                    <Ionicons name="apps-outline" size={40} color="#3B82F6" style={{ opacity: 0.2, position: 'absolute', top: 20, left: 20 }} />
                    <Text style={styles.quoteText}>
                        "At Abu Mafhal, we don't just sell products; we cultivate a legacy of trust and elite craftsmanship across Africa."
                    </Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <View style={{ h: 1, w: 20, backgroundColor: '#3B82F6' }} />
                        <Text style={{ color: '#0F172A', fontWeight: '900', fontSize: 12 }}>VISIONARY LEADERSHIP</Text>
                    </View>
                </View>

                {/* Vision Cards */}
                <View style={styles.contentPadding}>
                    <View style={styles.visionCard}>
                        <View style={[styles.iconBox, { backgroundColor: '#EFF6FF' }]}>
                            <Ionicons name="rocket" size={24} color="#3B82F6" />
                        </View>
                        <Text style={styles.cardTitle}>Our Mission</Text>
                        <Text style={styles.cardDesc}>Empowering businesses through cutting-edge technology and seamless integration.</Text>
                    </View>

                    <View style={styles.visionCard}>
                        <View style={[styles.iconBox, { backgroundColor: '#F0F9FF' }]}>
                            <Ionicons name="eye" size={24} color="#0EA5E9" />
                        </View>
                        <Text style={styles.cardTitle}>Our Vision</Text>
                        <Text style={styles.cardDesc}>To be Africa's leading elite marketplace, defined by security and speed.</Text>
                    </View>
                </View>

                {/* CTA */}
                <View style={styles.ctaSection}>
                    <Text style={styles.ctaTitle}>Ready to join the elite?</Text>
                    <TouchableOpacity 
                        style={styles.ctaButton}
                        onPress={() => Linking.openURL('https://wa.me/2348145853539')}
                    >
                        <Ionicons name="logo-whatsapp" size={20} color="white" />
                        <Text style={styles.ctaButtonText}>Direct Chat with Founder</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {/* Floating Action for Support */}
            <TouchableOpacity 
                style={styles.floatingAction}
                onPress={() => Linking.openURL('https://wa.me/2348145853539')}
            >
                <Ionicons name="chatbubble-ellipses" size={24} color="white" />
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    heroSection: {
        width: width,
        height: 450,
        position: 'relative',
    },
    founderImage: {
        width: '100%',
        height: '100%',
    },
    heroOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: 200,
        padding: 24,
        justifyContent: 'flex-end',
    },
    heroTag: {
        backgroundColor: '#3B82F6',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 6,
        alignSelf: 'flex-start',
        marginBottom: 8,
    },
    heroTagText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '900',
        letterSpacing: 1,
    },
    founderName: {
        color: 'white',
        fontSize: 32,
        fontWeight: '900',
        letterSpacing: -1,
    },
    contentPadding: {
        padding: 24,
    },
    sectionHeading: {
        fontSize: 24,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 16,
        letterSpacing: -0.5,
    },
    storyText: {
        fontSize: 15,
        color: '#475569',
        lineHeight: 24,
        marginBottom: 16,
        fontWeight: '500',
    },
    statsRow: {
        flexDirection: 'row',
        paddingHorizontal: 24,
        marginBottom: 32,
        gap: 12,
    },
    statBox: {
        flex: 1,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 16,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 1,
    },
    statNum: {
        fontSize: 18,
        fontWeight: '900',
        color: '#3B82F6',
    },
    statLabel: {
        fontSize: 10,
        color: '#64748B',
        fontWeight: '700',
        textTransform: 'uppercase',
        marginTop: 4,
    },
    visionCard: {
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 1,
    },
    iconBox: {
        width: 48,
        height: 48,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
    },
    cardTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 8,
    },
    cardDesc: {
        fontSize: 14,
        color: '#64748B',
        lineHeight: 20,
        fontWeight: '500',
    },
    ctaSection: {
        margin: 24,
        backgroundColor: '#0F172A',
        borderRadius: 32,
        padding: 32,
        alignItems: 'center',
    },
    ctaTitle: {
        color: 'white',
        fontSize: 20,
        fontWeight: '900',
        marginBottom: 20,
        textAlign: 'center',
    },
    ctaButton: {
        backgroundColor: '#3B82F6',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 24,
        paddingVertical: 14,
        borderRadius: 16,
    },
    // Extreme Modernization Styles
    videoPlayBtn: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(59, 130, 246, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 100,
        alignSelf: 'center',
        borderWidth: 2,
        borderColor: 'white',
    },
    shareBtn: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    timelineContainer: {
        marginTop: 10,
    },
    timelineItem: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    timelineLineContainer: {
        width: 12,
        alignItems: 'center',
        marginRight: 20,
    },
    timelinePoint: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#3B82F6',
        zIndex: 1,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: '#E2E8F0',
        marginTop: -2,
    },
    timelineContent: {
        flex: 1,
    },
    timelineYear: {
        fontSize: 11,
        fontWeight: '900',
        color: '#3B82F6',
        letterSpacing: 1,
        marginBottom: 4,
    },
    timelineTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 4,
    },
    timelineDesc: {
        fontSize: 13,
        color: '#64748B',
        lineHeight: 18,
    },
    testimonialCard: {
        width: width * 0.7,
        backgroundColor: 'white',
        borderRadius: 24,
        padding: 24,
        marginRight: 16,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        elevation: 2,
    },
    testimonialText: {
        fontSize: 14,
        color: '#475569',
        lineHeight: 22,
        fontStyle: 'italic',
        marginVertical: 12,
        fontWeight: '500',
    },
    avatarTiny: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: '#EFF6FF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#3B82F6',
    },
    testimonialName: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    testimonialRole: {
        fontSize: 10,
        color: '#94A3B8',
        fontWeight: '700',
        textTransform: 'uppercase',
    },
    quoteSection: {
        margin: 24,
        padding: 32,
        backgroundColor: '#F8FAFC',
        borderRadius: 32,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        position: 'relative',
        overflow: 'hidden',
    },
    quoteText: {
        fontSize: 18,
        fontWeight: '700',
        color: '#0F172A',
        lineHeight: 28,
        fontStyle: 'italic',
        marginBottom: 20,
    },
    floatingAction: {
        position: 'absolute',
        bottom: 30,
        right: 30,
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#3B82F6',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#3B82F6',
        shadowOpacity: 0.4,
        shadowRadius: 10,
        elevation: 10,
    }
});
