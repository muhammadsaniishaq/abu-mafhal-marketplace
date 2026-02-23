import React, { useEffect, useState, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, ImageBackground, Image, TextInput, RefreshControl, Dimensions, Animated, FlatList, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { styles } from '../styles/theme';
import { SectionHeader } from '../components/SectionHeader';
import { Footer } from '../components/Footer';
import { ServiceIcon } from '../components/ServiceIcon';
import { supabase } from '../lib/supabase';
import { CountdownTimer } from '../components/CountdownTimer';
import { NewsletterCard } from '../components/NewsletterCard';
import { HomeSkeleton } from '../components/SkeletonLoader';
import { AutoScrollList } from '../components/AutoScrollList';

const { width } = Dimensions.get('window');

export const AppHome = ({ onGoToShop, onGoToCart, onGoToNotifications, onNavigate, user }) => {
    const [banners, setBanners] = useState([]);
    const [categories, setCategories] = useState([]);
    const [flashSale, setFlashSale] = useState([]);
    const [newArrivals, setNewArrivals] = useState([]);
    const [recommended, setRecommended] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [topVendors, setTopVendors] = useState([]);
    const [homeServices, setHomeServices] = useState([]);
    const [loyalty, setLoyalty] = useState(null);
    const [topCustomers, setTopCustomers] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [brands, setBrands] = useState([]);

    const scrollX = useRef(new Animated.Value(0)).current;

    const fetchData = async () => {
        try {
            // 1. Fetch Banners (Home Section)
            const { data: bannerData } = await supabase.from('banners').select('*').eq('is_active', true).eq('section', 'home').order('display_order');
            setBanners(bannerData || []);

            // 2. Fetch Flash Sale (Discount > 0)
            const { data: flashData } = await supabase.from('products').select('*').eq('status', 'approved').not('compare_at_price', 'is', null).limit(4);
            setFlashSale(flashData || []);

            // 3. Fetch New Arrivals (Is New)
            const { data: newData } = await supabase.from('products').select('*').eq('status', 'approved').eq('is_new', true).limit(6);
            setNewArrivals(newData || []);

            // 4. Fetch Recommended (Random or logic)
            const { data: recData } = await supabase.from('products').select('*').eq('status', 'approved').limit(10);
            setRecommended(recData || []);

            // 5. Fetch Categories
            const { data: catData } = await supabase.from('categories').select('*').eq('is_active', true).order('display_order').limit(6);
            setCategories(catData || []);

            // 6. Fetch Top Vendors (Verified, sorted by Sales & Reviews)
            const { data: vendorData } = await supabase
                .from('vendors')
                .select('*')
                .eq('vendor_status', 'active')
                .eq('is_verified', true)
                .order('total_sales', { ascending: false })
                .order('review_count', { ascending: false })
                .limit(8);
            setTopVendors(vendorData || []);

            // 7. Fetch Dynamic Services
            const { data: svcData } = await supabase.from('home_services').select('*').eq('is_active', true).order('display_order');
            setHomeServices(svcData || []);

            // 8. Fetch User Loyalty
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            if (currentUser) {
                try {
                    const { data: lData, error: lError } = await supabase.from('loyalty').select('*').eq('user_id', currentUser.id).maybeSingle();
                    if (!lError) setLoyalty(lData);
                } catch (err) {
                    console.log('Loyalty fetch failed:', err.message);
                }
            }

            // 9. Fetch Top Customers (Featured, sorted by Spend)
            const { data: tcData } = await supabase
                .from('profiles')
                .select('*')
                .eq('is_featured', true)
                .order('total_spend', { ascending: false })
                .limit(10);
            setTopCustomers(tcData || []);

            // 10. Fetch Displayed Reviews
            const { data: rData } = await supabase.from('reviews').select('*, user:user_id(full_name, avatar_url)').eq('is_displayed', true).limit(10);
            setReviews(rData || []);

            // 11. Fetch Featured Brands
            const { data: bData } = await supabase.from('brands').select('*').eq('is_featured', true).limit(10);
            setBrands(bData || []);

        } catch (e) {
            console.log('Error fetching home data:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };


    useFocusEffect(
        React.useCallback(() => {
            fetchData();
        }, [])
    );

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleSearchSubmit = () => {
        if (searchQuery.trim()) {
            onGoToShop();
        }
    };

    if (loading) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
                <HomeSkeleton />
            </SafeAreaView>
        );
    }

    return (
        <View style={styles.container}>
            {/* ELITE HEADER */}
            <SafeAreaView style={{ backgroundColor: 'white', zIndex: 10, borderBottomWidth: 1, borderColor: '#F1F5F9', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 0 }}>
                <View style={{ paddingHorizontal: 20, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            {user?.user_metadata?.avatar_url || user?.avatar_url ? (
                                <Image
                                    source={{ uri: user.user_metadata?.avatar_url || user?.avatar_url }}
                                    style={{ width: '100%', height: '100%' }}
                                    resizeMode="cover"
                                />
                            ) : (
                                <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>
                                    {user?.email ? user.email[0].toUpperCase() : 'U'}
                                </Text>
                            )}
                        </View>
                        <View>
                            <Text style={{ fontSize: 11, color: '#94A3B8', fontWeight: '800', letterSpacing: 0.5 }}>ELITE GREETINGS</Text>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>
                                {user?.fullName || user?.user_metadata?.full_name || user?.full_name || user?.email?.split('@')[0] || 'Member'}
                            </Text>
                        </View>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 14 }}>
                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#F8FAFC', width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' }]} onPress={onGoToNotifications}>
                            <Ionicons name="notifications-outline" size={24} color="#0F172A" />
                            <View style={[styles.redDot, { right: 10, top: 10 }]} />
                        </TouchableOpacity>
                        <TouchableOpacity style={[styles.iconBtn, { backgroundColor: '#F8FAFC', width: 44, height: 44, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' }]} onPress={onGoToCart}>
                            <Ionicons name="cart-outline" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* SEARCH BAR - MODERNIZED */}
                <View style={{ paddingHorizontal: 20, paddingBottom: 16 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 16, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <Ionicons name="search" size={22} color="#94A3B8" />
                        <TextInput
                            placeholder="Search your ecosystem..."
                            placeholderTextColor="#94A3B8"
                            style={{ flex: 1, marginLeft: 12, fontSize: 15, color: '#0F172A', fontWeight: '600' }}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            onSubmitEditing={handleSearchSubmit}
                        />
                    </View>
                </View>
            </SafeAreaView>

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                contentContainerStyle={{ paddingBottom: 100 }}
            >
                {/* ELITE MEMBERSHIP CARD */}
                <View style={{ paddingHorizontal: 16, marginTop: 12 }}>
                    <ImageBackground
                        source={{ uri: 'https://images.unsplash.com/photo-1614850523296-d8c1af93d400?auto=format&fit=crop&w=800&q=80' }}
                        style={{ width: '100%', height: 110, borderRadius: 20, overflow: 'hidden', padding: 18, justifyContent: 'center' }}
                    >
                        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(15, 23, 42, 0.7)' }} />
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                    <Ionicons name="shield-checkmark" size={14} color="#FBBF24" />
                                    <Text style={{ color: '#FBBF24', fontSize: 11, fontWeight: '900', letterSpacing: 1 }}>{loyalty?.tier?.toUpperCase() || 'NEW MEMBER'}</Text>
                                </View>
                                <Text style={{ color: 'white', fontSize: 20, fontWeight: '900' }}>{loyalty?.is_elite ? 'Elite Status' : (loyalty?.tier || 'Membership')}</Text>
                                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 2 }}>{loyalty?.points?.toLocaleString() || 0} Elite Points</Text>
                            </View>
                            <TouchableOpacity style={{ backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}>
                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 12 }}>REDEEM</Text>
                            </TouchableOpacity>
                        </View>
                    </ImageBackground>
                </View>
                {/* HERO CAROUSEL */}
                {banners.length > 0 && (
                    <View style={{ height: 220, marginTop: 16 }}>
                        <Animated.ScrollView
                            horizontal
                            pagingEnabled
                            showsHorizontalScrollIndicator={false}
                            onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: false })}
                        >
                            {banners.map((item, index) => (
                                <TouchableOpacity key={index} activeOpacity={0.9} onPress={onGoToShop} style={{ width: width, paddingHorizontal: 16 }}>
                                    <ImageBackground
                                        source={{ uri: item.image_url }}
                                        style={{ width: '100%', height: '100%', borderRadius: 24, overflow: 'hidden', justifyContent: 'center', padding: 24 }}
                                        resizeMode="cover"
                                    >
                                        <View style={{ backgroundColor: 'rgba(15, 23, 42, 0.4)', position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }} />
                                        <View>
                                            <Text style={{ color: 'white', fontWeight: '900', fontSize: 32, lineHeight: 36 }}>{item.title}</Text>
                                            <Text style={{ color: 'rgba(255,255,255,0.9)', fontWeight: '600', fontSize: 14, marginBottom: 16, marginTop: 4 }}>{item.subtitle}</Text>
                                            <View style={{ backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 12, alignSelf: 'flex-start' }}>
                                                <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 13 }}>DISCOVER MORE</Text>
                                            </View>
                                        </View>
                                    </ImageBackground>
                                </TouchableOpacity>
                            ))}
                        </Animated.ScrollView>
                    </View>
                )}

                {/* 1. VERIFIED SELLERS (Auto Scroll) */}
                {topVendors.length > 0 && (
                    <View style={{ marginTop: 24 }}>
                        <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Top Verified Sellers</Text>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#3B82F6', fontWeight: '800' }}>See All</Text></TouchableOpacity>
                        </View>
                        <AutoScrollList
                            data={topVendors}
                            itemWidth={126} // 110 width + 16 gap
                            interval={3000}
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: vendor }) => (
                                <TouchableOpacity style={{ alignItems: 'center', width: 110, marginRight: 16 }} onPress={onGoToShop}>
                                    <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F8FAFC', padding: 4, borderWidth: 2, borderColor: '#3B82F6' }}>
                                        <Image
                                            source={{ uri: vendor.logo_url || 'https://placehold.co/200' }}
                                            style={{ width: '100%', height: '100%', borderRadius: 36 }}
                                            resizeMode="cover"
                                        />
                                        <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: 'white', borderRadius: 10, padding: 2 }}>
                                            <Ionicons name="checkmark-circle" size={18} color="#3B82F6" />
                                        </View>
                                    </View>
                                    <Text style={{ marginTop: 10, fontSize: 13, fontWeight: '700', color: '#0F172A', textAlign: 'center' }} numberOfLines={1}>
                                        {vendor.business_name || vendor.store_name}
                                    </Text>
                                    <View style={{ marginTop: 4, alignItems: 'center' }}>
                                        <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>{vendor.total_sales || 0} Sales</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                                            <Ionicons name="star" size={10} color="#FBBF24" />
                                            <Text style={{ fontSize: 10, color: '#64748B', fontWeight: '600' }}>4.9 ({vendor.review_count || 0})</Text>
                                        </View>
                                    </View>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                )}

                {/* 2. TOP CUSTOMERS (Auto Scroll) */}
                {topCustomers.length > 0 && (
                    <View style={{ marginTop: 32 }}>
                        <View style={{ paddingHorizontal: 20, marginBottom: 16 }}>
                            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A' }}>Elite Members</Text>
                        </View>
                        <AutoScrollList
                            data={topCustomers}
                            itemWidth={106} // 90 width + 16 gap
                            interval={3500} // Slightly different speed
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: customer }) => (
                                <View style={{ alignItems: 'center', width: 90, marginRight: 16 }}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, padding: 3, borderWidth: 2, borderColor: '#FBBF24' }}>
                                        <Image
                                            source={{ uri: customer.avatar_url || 'https://placehold.co/100' }}
                                            style={{ width: '100%', height: '100%', borderRadius: 30 }}
                                        />
                                        <View style={{ position: 'absolute', bottom: -4, alignSelf: 'center', backgroundColor: '#FBBF24', paddingHorizontal: 6, borderRadius: 8 }}>
                                            <Text style={{ fontSize: 8, fontWeight: '900', color: '#0F172A' }}>VIP</Text>
                                        </View>
                                    </View>
                                    <Text style={{ marginTop: 8, fontSize: 11, fontWeight: '700', color: '#0F172A', textAlign: 'center' }} numberOfLines={1}>
                                        {customer.full_name?.split(' ')[0] || 'Member'}
                                    </Text>
                                    <Text style={{ fontSize: 9, color: '#64748B', fontWeight: '600', marginTop: 2 }}>
                                        ₦{(customer.total_spend || 0).toLocaleString()}
                                    </Text>
                                </View>
                            )}
                        />
                    </View>
                )}

                {/* 3. CUSTOMER REVIEWS (Auto Scroll) */}
                {reviews.length > 0 && (
                    <View style={{ marginTop: 32, paddingBottom: 10 }}>
                        <Text style={{ paddingHorizontal: 16, fontSize: 18, fontWeight: '900', color: '#0F172A', marginBottom: 16 }}>Member Voices</Text>
                        <AutoScrollList
                            data={reviews}
                            itemWidth={296} // 280 width + 16 gap
                            interval={4000} // Slowest for reading
                            contentContainerStyle={{ paddingHorizontal: 16 }}
                            renderItem={({ item: review }) => (
                                <View style={{ width: 280, backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', marginRight: 16 }}>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                                        <Image source={{ uri: review.user?.avatar_url || 'https://placehold.co/100' }} style={{ width: 32, height: 32, borderRadius: 16, marginRight: 8, backgroundColor: '#E2E8F0' }} />
                                        <View>
                                            <Text style={{ fontWeight: '700', fontSize: 13, color: '#0F172A' }}>{review.user?.full_name}</Text>
                                            <View style={{ flexDirection: 'row', gap: 2 }}>
                                                {[...Array(5)].map((_, i) => (
                                                    <Ionicons key={i} name="star" size={10} color={i < review.rating ? "#FBBF24" : "#E2E8F0"} />
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                    <Text style={{ fontSize: 13, color: '#475569', lineHeight: 20 }} numberOfLines={3}>"{review.comment}"</Text>
                                </View>
                            )}
                        />
                    </View>
                )}

                {/* 4. FEATURED BRANDS */}
                {brands.length > 0 && (
                    <View style={{ marginTop: 32, paddingBottom: 8 }}>
                        <Text style={{ paddingHorizontal: 16, fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>Featured Brands</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 20 }}>
                            {brands.map((brand, i) => (
                                <TouchableOpacity key={i} style={{ alignItems: 'center' }} onPress={onGoToShop}>
                                    <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'white', padding: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                                        <Image source={{ uri: brand.logo_url || 'https://placehold.co/100' }} style={{ width: 40, height: 40, resizeMode: 'contain' }} />
                                    </View>
                                    <Text style={{ marginTop: 8, fontSize: 12, fontWeight: '600', color: '#475569' }}>{brand.name}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}

                {/* FLASH SALE WITH TIMER */}
                {flashSale.length > 0 && (
                    <View style={{ marginTop: 32, paddingHorizontal: 16 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <View style={{ width: 8, height: 24, backgroundColor: '#EF4444', borderRadius: 4 }} />
                                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Flash Sale</Text>
                                <CountdownTimer targetDate={new Date().setHours(24, 0, 0, 0)} />
                            </View>
                            <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#EF4444', fontWeight: '800' }}>See All</Text></TouchableOpacity>
                        </View>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
                            {flashSale.map((item, i) => (
                                <TouchableOpacity key={i} style={[styles.recCard, { width: '47.5%', borderRadius: 20, padding: 0, overflow: 'hidden' }]} onPress={onGoToShop}>
                                    <Image source={{ uri: item.images ? item.images[0] : 'https://placehold.co/200' }} style={{ width: '100%', height: 160 }} />
                                    <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: '#EF4444', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                                        <Text style={{ color: 'white', fontSize: 11, fontWeight: '900' }}>-{item.discount}%</Text>
                                    </View>
                                    <View style={{ padding: 12 }}>
                                        <Text style={{ fontWeight: '700', fontSize: 14, color: '#0F172A' }} numberOfLines={1}>{item.name}</Text>
                                        <Text style={{ fontWeight: '900', fontSize: 16, color: '#3B82F6', marginTop: 4 }}>₦{item.price.toLocaleString()}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                )}

                {/* VISUAL CATEGORIES GRID */}
                <View style={{ marginTop: 40 }}>
                    <View style={{ paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Elite Collections</Text>
                        <TouchableOpacity onPress={onGoToShop}><Text style={{ color: '#3B82F6', fontWeight: '800' }}>Explore All</Text></TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' }}>
                        {categories.map((cat, i) => (
                            <TouchableOpacity key={i} style={{ width: '48%', marginBottom: 16, height: 120, borderRadius: 20, overflow: 'hidden' }} onPress={onGoToShop}>
                                <ImageBackground source={{ uri: cat.image_url || 'https://placehold.co/400x300' }} style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                                    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.4)' }} />
                                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 16, letterSpacing: 1 }}>{cat.name.toUpperCase()}</Text>
                                </ImageBackground>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* SERVICE HIGHLIGHTS (Moved Down) */}
                {homeServices.length > 0 && (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginTop: 40, marginBottom: 10 }}>
                        {homeServices.map((svc, i) => (
                            <ServiceIcon key={i} icon={svc.icon} label={svc.title} color={svc.bg_color || '#3B82F6'} lib={svc.lib} onPress={onGoToShop} />
                        ))}
                    </View>
                )}


                {/* SPECIAL PROMO BANNER */}
                <View style={{ marginTop: 24, paddingHorizontal: 16 }}>
                    <TouchableOpacity activeOpacity={0.9} onPress={onGoToShop} style={{ borderRadius: 16, overflow: 'hidden', height: 160 }}>
                        <ImageBackground
                            source={{ uri: 'https://images.unsplash.com/photo-1556656793-02715d8dd6f8' }}
                            style={{ width: '100%', height: '100%', justifyContent: 'center', alignItems: 'flex-start', padding: 24 }}
                        >
                            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.4)' }} />
                            <View style={{ backgroundColor: '#EF4444', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 4, marginBottom: 8 }}>
                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 10 }}>LIMITED OFFER</Text>
                            </View>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 24, maxWidth: '70%' }}>Summer Collection 50% Off</Text>
                            <View style={{ marginTop: 12, paddingHorizontal: 16, paddingVertical: 8, backgroundColor: 'white', borderRadius: 8 }}>
                                <Text style={{ color: 'black', fontWeight: '700' }}>Shop Now</Text>
                            </View>
                        </ImageBackground>
                    </TouchableOpacity>
                </View>

                {/* NEW ARRIVALS */}
                {newArrivals.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                        <View style={{ paddingHorizontal: 16 }}>
                            <SectionHeader title="New Arrivals" action="See All" />
                        </View>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}>
                            {newArrivals.map((item, i) => (
                                <TouchableOpacity key={i} style={{ width: 140, marginRight: 12 }} onPress={onGoToShop}>
                                    {item.images && item.images[0] ? (
                                        <Image source={{ uri: item.images[0] }} style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: '#F1F5F9' }} />
                                    ) : (
                                        <View style={{ width: 140, height: 140, borderRadius: 12, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                                            <Ionicons name="image-outline" size={32} color="#94A3B8" />
                                        </View>
                                    )}
                                    <Text style={{ marginTop: 8, fontSize: 14, fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{item.name}</Text>
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#3B82F6' }}>₦{item.price.toLocaleString()}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>
                    </View>
                )}


                {/* RECOMMENDED FOR YOU */}
                <View style={styles.sectionContainer}>
                    <SectionHeader title="Recommended For You" action="See All" />
                    <View style={styles.grid2Col}>
                        {recommended.map((item, i) => (
                            <TouchableOpacity key={i} style={styles.recCard} onPress={onGoToShop}>
                                {item.images && item.images[0] ? (
                                    <Image source={{ uri: item.images[0] }} style={styles.recImg} />
                                ) : (
                                    <View style={[styles.recImg, { backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }]}>
                                        <Ionicons name="image-outline" size={32} color="#94A3B8" />
                                    </View>
                                )}
                                <View style={styles.recContent}>
                                    <Text style={styles.recName} numberOfLines={2}>{item.name}</Text>
                                    <Text style={styles.recPrice}>₦{item.price.toLocaleString()}</Text>
                                </View>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* FOOTER */}
                <Footer onEnterShop={onGoToShop} onNavigate={onNavigate} />
            </ScrollView>
        </View>
    );
};
