import React, { useRef, useState, useEffect } from 'react';
import { View, Text, Image, TouchableOpacity, ScrollView, Animated, ImageBackground, Dimensions, Platform, StatusBar, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { useAppSettings } from '../context/AppSettingsContext';
import { ServiceIcon } from '../components/ServiceIcon';
import { SectionHeader } from '../components/SectionHeader';
import { Footer } from '../components/Footer';
import { supabase } from '../lib/supabase';
import { CountdownTimer } from '../components/CountdownTimer';

const { width } = Dimensions.get('window');

const TRUST_ITEMS = [
    { icon: 'shield-checkmark', label: 'Secure Payment', color: '#10B981' },
    { icon: 'rocket', label: 'Fast Delivery', color: '#3B82F6' },
    { icon: 'headset', label: '24/7 Support', color: '#8B5CF6' },
];

export const LandingPage = ({ navigation, onEnterShop, cartCount, onGoToCart, onLogin, user, onGoToProfile, onNavigate, addToCart }) => {
    const { settings } = useAppSettings();
    const scrollX = useRef(new Animated.Value(0)).current;
    const slideRef = useRef(null);

    const [newArrivals, setNewArrivals] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [banners, setBanners] = useState([]);
    const [promoBanners, setPromoBanners] = useState([]);
    const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
    const [bannerIndex, setBannerIndex] = useState(0); // Added for hero auto-slide
    const promoFlatListRef = useRef(null);
    const [flashSale, setFlashSale] = useState([]);
    const [brands, setBrands] = useState([]);
    const [categories, setCategories] = useState([]);

    // Hero Banner Auto-Slide Logic
    useEffect(() => {
        if (banners.length > 1) {
            const timer = setInterval(() => {
                setBannerIndex(prev => {
                    const nextIndex = (prev + 1) % banners.length;
                    slideRef.current?.scrollTo({ x: nextIndex * width, animated: true });
                    return nextIndex;
                });
            }, 5000);
            return () => clearInterval(timer);
        }
    }, [banners.length]);

    // Promo Banner Auto-Slide Logic
    useEffect(() => {
        if (promoBanners.length > 1) {
            const timer = setInterval(() => {
                setCurrentPromoIndex(prev => {
                    const nextIndex = (prev + 1) % promoBanners.length;
                    promoFlatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
                    return nextIndex;
                });
            }, 4000);
            return () => clearInterval(timer);
        }
    }, [promoBanners.length]);

    useEffect(() => {
        const fetchLandingProducts = async () => {
            // Fetch Hero Banners
            const { data: bannerData } = await supabase
                .from('banners')
                .select('*')
                .eq('is_active', true)
                .eq('section', 'landing') // Strictly landing section
                .order('display_order');

            if (bannerData) setBanners(bannerData);
            else setBanners([]);

            // Fetch Promo Banners
            const { data: promoData } = await supabase
                .from('banners')
                .select('*')
                .eq('section', 'promo')
                .eq('is_active', true)
                .order('created_at', { ascending: false });

            if (promoData && promoData.length > 0) {
                const validPromos = promoData.map(promo => {
                    let linkData = { text: promo.action_link || '', locations: ['home'] };
                    try {
                        const parsed = JSON.parse(promo.action_link);
                        if (parsed && typeof parsed === 'object') {
                            linkData = { ...linkData, ...parsed };
                        }
                    } catch (e) {
                        // Fallback
                    }
                    return { ...promo, linkData };
                }).filter(promo => promo.linkData.locations && promo.linkData.locations.includes('landing'));

                setPromoBanners(validPromos);
            } else {
                setPromoBanners([]);
            }

            // Fetch Categories
            const { data: catData } = await supabase.from('categories').select('*').eq('is_active', true).order('display_order');
            if (catData) setCategories(catData);

            // Fetch Brands
            const { data: brandsData, error: brandsError } = await supabase.from('brands').select('*').eq('is_active', true).order('created_at', { ascending: false });
            if (brandsError) console.log('LandingPage: Error fetching brands', brandsError);
            if (brandsData) {
                // Log count for debugging
                // console.log('LandingPage: Fetched Brands', brandsData.length);
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
                // Log count for debugging
                // console.log('LandingPage: Fetched New Arrivals', newProds.length);
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
                            ref={slideRef}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                                useNativeDriver: false
                            })}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                if (index !== bannerIndex) {
                                    setBannerIndex(index);
                                }
                            }}
                            scrollEventThrottle={16}
                        >
                            {banners.map((item, index) => (
                                <TouchableOpacity key={index} activeOpacity={0.9} onPress={onEnterShop} style={{ width: width, paddingHorizontal: 16 }}>
                                    <ImageBackground
                                        source={{ uri: item?.image_url }}
                                        style={{ width: '100%', height: '100%', borderRadius: 24, overflow: 'hidden' }}
                                        resizeMode="cover"
                                    >
                                        {/* REMOVED TEXT OVERLAY AS REQUESTED */}
                                    </ImageBackground>
                                </TouchableOpacity>
                            ))}
                        </Animated.ScrollView>
                        {/* Dots Indicator */}
                        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
                            {banners.map((_, i) => {
                                const opacity = scrollX.interpolate({
                                    inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                                    outputRange: [0.3, 1, 0.3],
                                    extrapolate: 'clamp'
                                });
                                const dotWidth = scrollX.interpolate({
                                    inputRange: [(i - 1) * width, i * width, (i + 1) * width],
                                    outputRange: [6, 20, 6],
                                    extrapolate: 'clamp'
                                });
                                return <Animated.View key={i} style={{ height: 6, width: dotWidth, borderRadius: 3, backgroundColor: '#0F172A', marginHorizontal: 3, opacity }} />;
                            })}
                        </View>
                    </View>
                )}

                {/* DYNAMIC PROMO BANNERS CAROUSEL */}
                {promoBanners.length > 0 && (
                    <View style={{ marginTop: 20 }}>
                        <FlatList
                            ref={promoFlatListRef}
                            data={promoBanners}
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            snapToInterval={width}
                            decelerationRate="fast"
                            scrollEventThrottle={16}
                            onMomentumScrollEnd={(e) => {
                                const index = Math.round(e.nativeEvent.contentOffset.x / width);
                                if (index !== currentPromoIndex) {
                                    setCurrentPromoIndex(index);
                                }
                            }}
                            keyExtractor={(item) => item.id.toString()}
                            renderItem={({ item: promo }) => (
                                <TouchableOpacity
                                    activeOpacity={0.9}
                                    onPress={() => {
                                        if (promo.linkData?.productId) {
                                            supabase.from('products').select('*').eq('id', promo.linkData.productId).single()
                                                .then(({ data }) => {
                                                    if (data) {
                                                        const promoDiscount = promo.linkData.discountValue ? {
                                                            type: promo.linkData.discountType || 'percent',
                                                            value: promo.linkData.discountValue
                                                        } : null;
                                                        navigation.navigate('ProductDetails', { product: { ...data, promoDiscount } });
                                                    } else {
                                                        onEnterShop();
                                                    }
                                                }).catch(() => onEnterShop());
                                        } else {
                                            onEnterShop();
                                        }
                                    }}
                                    style={{ width: width - 32, marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', height: 140, backgroundColor: '#0F172A', boxShadow: '0px 8px 20px rgba(0,0,0,0.15)', shadowRadius: 15 }}
                                >
                                    <Image
                                        source={{ uri: promo.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }}
                                        style={{ width: '100%', height: '100%', position: 'absolute', opacity: 0.5 }}
                                        resizeMode="cover"
                                    />
                                    <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)' }} />

                                    <View style={{ padding: 20, justifyContent: 'center', height: '100%' }}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <View style={{ flex: 1 }}>
                                                <View style={{ backgroundColor: '#EF4444', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginBottom: 8 }}>
                                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 10, letterSpacing: 1 }}>
                                                        {promo.subtitle?.toUpperCase() || 'LIMITED OFFER'}
                                                    </Text>
                                                </View>
                                                <Text style={{ fontSize: 20, fontWeight: '900', color: 'white', marginBottom: 4, lineHeight: 24, paddingRight: 10 }}>
                                                    {promo.title || 'Special Promotion'}
                                                </Text>
                                            </View>

                                            {promo.linkData?.timerEnd && (
                                                <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', padding: 10, borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center' }}>
                                                    <Text style={{ color: 'white', fontSize: 9, fontWeight: '800', marginBottom: 4, letterSpacing: 1 }}>ENDS IN</Text>
                                                    <CountdownTimer targetDate={promo.linkData.timerEnd} lightMode={true} />
                                                </View>
                                            )}
                                        </View>

                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
                                            <Text style={{ color: '#F8FAFC', fontWeight: '700', fontSize: 13 }}>
                                                {promo.linkData?.text || 'Explore Offer'}
                                            </Text>
                                            <Ionicons name="arrow-forward" size={14} color="#F8FAFC" />
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                        {/* Pagination Dots */}
                        {promoBanners.length > 1 && (
                            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 12 }}>
                                {promoBanners.map((_, i) => (
                                    <View
                                        key={i}
                                        style={{
                                            width: currentPromoIndex === i ? 20 : 6,
                                            height: 6,
                                            borderRadius: 3,
                                            backgroundColor: currentPromoIndex === i ? '#3B82F6' : '#E2E8F0',
                                        }}
                                    />
                                ))}
                            </View>
                        )}
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
                                <TouchableOpacity key={cat?.id} style={styles.catItem} onPress={onEnterShop}>
                                    <View style={[styles.catIconBox, { backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }]}>
                                        {cat?.image_url ? (
                                            <Image source={{ uri: cat.image_url }} style={{ width: 32, height: 32, borderRadius: 16 }} />
                                        ) : (
                                            <Ionicons name="grid-outline" size={20} color="#64748B" />
                                        )}
                                    </View>
                                    <Text style={[styles.catName, { fontWeight: '700' }]}>{cat?.name || 'Category'}</Text>
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
                                <TouchableOpacity key={i} style={[styles.recCard, { width: 160, borderRadius: 20, padding: 0, overflow: 'hidden' }]} onPress={() => navigation.navigate('ProductDetails', { product: item })}>
                                    <Image source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }} style={{ width: '100%', height: 160 }} />
                                    <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>-{item?.discount || 0}%</Text>
                                    </View>
                                    <View style={{ padding: 12 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }} numberOfLines={1}>{item?.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 16, color: '#3B82F6', marginTop: 4 }}>₦{item?.price ? item.price.toLocaleString() : '0'}</Text>
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
                                    <View style={{ width: 72, height: 72, borderRadius: 36, backgroundColor: 'white', padding: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', shadowRadius: 10 }}>
                                        <Image source={{ uri: brand?.logo_url || 'https://placehold.co/100' }} style={{ width: 48, height: 48, resizeMode: 'contain' }} />
                                    </View>
                                    <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '800', color: '#1E293B' }}>{brand?.name || 'Brand'}</Text>
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
                                <TouchableOpacity key={i} style={styles.newArrivalCard} onPress={() => navigation.navigate('ProductDetails', { product: item })}>
                                    <Image
                                        source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={styles.newArrivalImg}
                                    />
                                    <View style={styles.newArrivalOverlay}>
                                        <Text style={styles.newArrivalPrice}>₦{item?.price ? item.price.toLocaleString() : '0'}</Text>
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
                                <TouchableOpacity key={i} style={styles.recCard} onPress={() => navigation.navigate('ProductDetails', { product: item })}>
                                    <Image
                                        source={{ uri: item?.images?.[0] || 'https://placehold.co/200' }}
                                        style={styles.recImg}
                                    />
                                    <View style={styles.recContent}>
                                        <Text style={styles.recName} numberOfLines={2}>{item?.name}</Text>
                                        <Text style={styles.recPrice}>₦{item?.price ? item.price.toLocaleString() : '0'}</Text>
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
