import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Animated, ImageBackground, Dimensions, Platform, StatusBar } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { useAppSettings } from '../context/AppSettingsContext';
import { ServiceIcon } from '../components/ServiceIcon';
import { SectionHeader } from '../components/SectionHeader';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

const TRUST_ITEMS = [
    { icon: 'shield-checkmark', label: 'Secure Payment', color: '#10B981' },
    { icon: 'rocket', label: 'Fast Delivery', color: '#3B82F6' },
    { icon: 'headset', label: '24/7 Support', color: '#8B5CF6' },
];

export const LandingPage = ({ onEnterShop, cartCount, onGoToCart, onLogin, user, onGoToProfile, onNavigate, addToCart }) => {
    const { settings } = useAppSettings();
    const scrollX = useRef(new Animated.Value(0)).current;
    const slideRef = useRef(null);

    const [newArrivals, setNewArrivals] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [banners, setBanners] = useState([]);
    const [flashSale, setFlashSale] = useState([]);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);

    useEffect(() => {
        const fetchLandingProducts = async () => {
            // Fetch Banners
            const { data: bannerData } = await supabase.from('banners').select('*').eq('is_active', true).order('display_order');
            if (bannerData) setBanners(bannerData);

            // Fetch Categories
            const { data: catData } = await supabase.from('categories').select('*').eq('is_active', true).order('display_order');
            if (catData) setCategories(catData);

            // Fetch Brands
            const { data: brandsData, error: brandsError } = await supabase.from('brands').select('*').eq('is_active', true).order('created_at', { ascending: false });
            if (brandsError) console.log('LandingPage: Error fetching brands', brandsError);
            if (brandsData) {
                console.log('LandingPage: Fetched Brands', brandsData.length);
                setBrands(brandsData);
            }

            // Fetch Flash Sale (Discount > 0)
            const { data: flashData } = await supabase
                .from('products')
                .select('*')
                .eq('status', 'approved')
                .not('compare_at_price', 'is', null)
                .limit(4);
            if (flashData) setFlashSale(flashData);

            // Fetch New Arrivals (limit 6)
            const { data: newProds, error: newError } = await supabase
                .from('products')
                .select('*')
                .eq('status', 'approved')
                .order('created_at', { ascending: false })
                .limit(6);

            if (newError) console.log('LandingPage: Error fetching new arrivals', newError);
            if (newProds) {
                console.log('LandingPage: Fetched New Arrivals', newProds.length);
                setNewArrivals(newProds);
            }

            // Fetch Recommended (random/limit 10)
            const { data: recProds, error: recError } = await supabase
                .from('products')
                .select('*')
                .eq('status', 'approved')
                .limit(10);

            if (recError) console.log('LandingPage: Error fetching recommended', recError);
            if (recProds) setRecommended(recProds);
        };
        fetchLandingProducts();
    }, []);

    const onScrollMomentumEnd = () => {
        // Placeholder for slide logic if needed
    };

    return (
        <SafeAreaView style={[styles.container, { paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }]}>
            <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 10, backgroundColor: 'white', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                {/* LOGO AREA */}
                <View style={styles.logoContainer}>
                    <Image
                        source={settings?.logo_url ? { uri: settings.logo_url } : require('../../assets/logo.jpg')}
                        style={[styles.logoImage, settings?.logo_url && { borderRadius: 8 }]}
                        resizeMode="contain"
                    />
                    <View>
                        <Text style={styles.brandTitle}>{settings?.app_name || 'ABU MAFHAL'}</Text>
                        <Text style={styles.brandSub}>ELITE ECOSYSTEM</Text>
                    </View>
                </View>

                {/* ICONS AREA */}
                <View style={styles.headerIcons}>
                    {user ? (
                        <TouchableOpacity style={styles.profileHeadBtn} onPress={onGoToProfile}>
                            <View style={[styles.avatarHead, { backgroundColor: '#0F172A' }]}>
                                <Text style={styles.avatarHeadText}>{user.email ? user.email[0].toUpperCase() : 'U'}</Text>
                            </View>
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity
                            style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12 }}
                            onPress={onLogin}
                        >
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>SIGN IN</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 0 }}>

                {/* HERO CAROUSEL (DYNAMIC) */}
                {banners.length > 0 && (
                    <View style={{ height: 220, marginTop: 16 }}>
                        <Animated.ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                        >
                            {banners.map((item, index) => (
                                <TouchableOpacity key={index} activeOpacity={0.9} onPress={onEnterShop} style={{ width: width, paddingHorizontal: 16 }}>
                                    <ImageBackground
                                        source={{ uri: item.image_url }}
                                        style={{ width: '100%', height: '100%', borderRadius: 24, overflow: 'hidden', justifyContent: 'center', padding: 24 }}
                                        resizeMode="cover"
                                    >
                                        <View style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                                        <View>
                                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 32, lineHeight: 36 }}>{item.title}</Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 14, marginBottom: 16, marginTop: 4 }}>{item.subtitle}</Text>
                                            <View style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, alignSelf: 'flex-start', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10 }}>
                                                <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>DISCOVER NOW</Text>
                                            </View>
                                        </View>
                                    </ImageBackground>
                                </TouchableOpacity>
                            ))}
                        </Animated.ScrollView>
                    </View>
                )}

                {/* QUICK ACTIONS GRID */}
                <View style={[styles.servicesRow, { marginTop: 20 }]}>
                    <ServiceIcon icon="flash" label="Sales" color="#EF4444" lib="mc" onPress={onEnterShop} />
                    <ServiceIcon icon="shield-checkmark" label="Elite" color="#3B82F6" onPress={onEnterShop} />
                    <ServiceIcon icon="truck-delivery" label="Global" color="#10B981" lib="mc" onPress={onEnterShop} />
                    <ServiceIcon icon="wallet" label="Wallet" color="#8B5CF6" lib="mc" onPress={onEnterShop} />
                </View>

                {/* VISUAL CATEGORIES (DYNAMIC) */}
                {categories.length > 0 && (
                    <View style={[styles.catSection, { marginTop: 10 }]}>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                            {categories.map((cat) => (
                                <TouchableOpacity key={cat.id} style={styles.catItem} onPress={onEnterShop}>
                                    <View style={[styles.catIconBox, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }]}>
                                        {cat.image_url ? (
                                            <Image source={{ uri: cat.image_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                        ) : (
                                            <Ionicons name="grid-outline" size={20} color="#64748B" />
                                        )}
                                    </View>
                                    <Text style={[styles.catName, { fontWeight: '700' }]}>{cat.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* FLASH SALE */}
                {flashSale.length > 0 && (
                    <View style={{ marginTop: 10, paddingHorizontal: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <View style={{ width: 8, height: 24, backgroundColor: '#EF4444', borderRadius: 4 }} />
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Flash Sale</Text>
                            </View>
                            <TouchableOpacity onPress={onEnterShop}><Text style={{ color: '#EF4444', fontWeight: '800' }}>View All</Text></TouchableOpacity>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 16 }}>
                            {flashSale.map((item, i) => (
                                <TouchableOpacity key={i} style={[styles.recCard, { width: 160, borderRadius: 20, padding: 0, overflow: 'hidden' }]} onPress={onEnterShop}>
                                    <Image source={{ uri: item.images ? item.images[0] : 'https://placehold.co/200' }} style={{ width: '100%', height: 160 }} />
                                    <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>-{item.discount}%</Text>
                                    </View>
                                    <View style={{ padding: 12 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }} numberOfLines={1}>{item.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 16, color: '#3B82F6', marginTop: 4 }}>₦{item.price ? item.price.toLocaleString() : '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* FEATURED BRANDS */}
                {brands.length > 0 && (
                    <View style={{ marginTop: 32, paddingBottom: 8 }}>
                        <Text style={{ paddingHorizontal: 16, fontSize: 20, fontWeight: '900', color: '#0F172A', marginBottom: 16 }}>Official Stores</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 24 }}>
                            {brands.map((brand, i) => (
                                <TouchableOpacity key={i} style={{ alignItems: 'center' }} onPress={onEnterShop}>
                                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', padding: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 10 }}>
                                        <Image source={{ uri: brand.logo_url }} style={{ width: 48, height: 48, resizeMode: 'contain' }} />
                                    </View>
                                    <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '800', color: '#1E293B' }}>{brand.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* NEW ARRIVALS (REAL DATA) */}
                {newArrivals.length > 0 && (
                    <View style={styles.sectionContainer}>
                        <SectionHeader title="New Arrivals" action="View All" />
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                            {newArrivals.map((item, i) => (
                                <TouchableOpacity key={i} style={styles.newArrivalCard} onPress={onEnterShop}>
                                    <Image
                                        source={{ uri: item.images && item.images[0] ? item.images[0] : 'https://placehold.co/200' }}
                                        style={styles.newArrivalImg}
                                    />
                                    <View style={styles.newArrivalOverlay}>
                                        <Text style={styles.newArrivalPrice}>₦{item.price ? item.price.toLocaleString() : '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* RECOMMENDED FOR YOU (REAL DATA) */}
                {recommended.length > 0 && (
                    <View style={styles.graySection}>
                        <SectionHeader title="Recommended For You" />
                        <View style={styles.grid2Col}>
                            {recommended.map((item, i) => (
                                <TouchableOpacity key={i} style={styles.recCard} onPress={onEnterShop}>
                                    <Image
                                        source={{ uri: item.images && item.images[0] ? item.images[0] : 'https://placehold.co/200' }}
                                        style={styles.recImg}
                                    />
                                    <View style={styles.recContent}>
                                        <Text style={styles.recName} numberOfLines={2}>{item.name}</Text>
                                        <Text style={styles.recPrice}>₦{item.price ? item.price.toLocaleString() : '0'}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* TRUST STRIP (NEW ROUND 2) */}
                <View style={styles.trustStrip}>
                    {TRUST_ITEMS.map((item, i) => (
                        <View key={i} style={styles.trustItem}>
                            <Ionicons name={item.icon} size={24} color={item.color} style={{ marginBottom: 8 }} />
                            <Text style={styles.trustText}>{item.label}</Text>
                        </View>
                    ))}
                </View>

                {/* MODERN FOOTER */}
                <Footer onEnterShop={onEnterShop} onNavigate={onNavigate} />

            </ScrollView>
        </SafeAreaView>
    );
};
