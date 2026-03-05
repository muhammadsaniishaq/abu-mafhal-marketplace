import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, TextInput, FlatList, Image, ImageBackground, Animated, Dimensions, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles, WIDTH } from '../styles/theme';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { geminiService } from '../services/geminiService';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { CountdownTimer } from '../components/CountdownTimer';

export const ShopPage = ({ onBack, cartCount, onGoToCart, addToCart, onProductClick }) => {
    const promoScrollX = useRef(new Animated.Value(0)).current;
    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeCategory, setActiveCategory] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('default'); // default, priceLow, priceHigh, reviews
    const [wishlist, setWishlist] = useState([]);
    // const [selectedProduct, setSelectedProduct] = useState(null); // Removed for new screen

    // AI Search States
    const [isListening, setIsListening] = useState(false);
    const [showVoiceModal, setShowVoiceModal] = useState(false);
    const [analyzingImage, setAnalyzingImage] = useState(false);

    // Banners State
    const [banners, setBanners] = useState([]);
    const [promoBanners, setPromoBanners] = useState([]);
    const [currentPromoIndex, setCurrentPromoIndex] = useState(0);
    const promoFlatListRef = useRef(null);

    // Auto-Scroll Refs
    const scrollX = useRef(new Animated.Value(0)).current;
    const slideRef = useRef(null);
    const [bannerIndex, setBannerIndex] = useState(0);

    const CATEGORIES_FILTER = ['All', 'Phones', 'Fashion', 'Shoes', 'Gaming', 'Home'];

    useEffect(() => {
        fetchData();
    }, []); // Run only once

    useEffect(() => {
        // Auto-Slide Logic (Every 3 seconds) - Only if we have banners
        if (banners.length > 1) {
            const interval = setInterval(() => {
                setBannerIndex(prev => {
                    const nextIndex = (prev + 1) % banners.length;
                    slideRef.current?.scrollTo({ x: nextIndex * (WIDTH - 32), animated: true });
                    return nextIndex;
                });
            }, 3000);
            return () => clearInterval(interval);
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
        filterProducts();
    }, [activeCategory, searchQuery, products, sortBy]);

    const fetchData = async () => {
        try {
            // 1. Fetch Banners (Shop Section)
            const { data: bannerData } = await supabase.from('banners').select('*').eq('is_active', true).eq('section', 'shop').order('display_order');
            if (bannerData && bannerData.length > 0) {
                setBanners(bannerData);
            } else {
                setBanners([]); // No mock data
            }

            // 1B. Fetch Promo Banners
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
                }).filter(promo => promo.linkData.locations && promo.linkData.locations.includes('shop'));

                setPromoBanners(validPromos);
            } else {
                setPromoBanners([]);
            }

            // 2. Fetch Products
            const { data } = await supabase.from('products').select('*').eq('status', 'approved').limit(100);
            const enriched = (data || []).map(p => ({
                ...p,
                rating: p.rating || 5, // Default to 5 star if new
                reviews: p.reviews || 0
            }));
            console.log('ShopPage: Real Data Fetched', enriched.length);
            setProducts(enriched);
            // 3. Fetch User Wishlist
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: wData } = await supabase.from('wishlists').select('items').eq('id', user.id).single();
                if (wData && wData.items) {
                    setWishlist(wData.items);
                }
            }
        } catch (error) {
            console.log('ShopPage: Error fetching', error);
            // setToast({ visible: true, message: 'Failed to load products', icon: 'alert-circle' });
            setProducts([]); // No mock data
        } finally {
            setLoading(false);
        }
    };

    const toggleWishlist = async (id) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                showToast('Please login to use wishlist', 'lock-closed');
                return;
            }

            let newWishlist;
            if (wishlist.includes(id)) {
                newWishlist = wishlist.filter(item => item !== id);
                showToast('Removed from Wishlist', 'heart-dislike');
            } else {
                newWishlist = [...wishlist, id];
                showToast('Added to Wishlist', 'heart');
            }

            setWishlist(newWishlist);

            // Sync with Supabase
            const { error } = await supabase
                .from('wishlists')
                .upsert({ id: user.id, items: newWishlist, updated_at: new Date() });

            if (error) throw error;
        } catch (err) {
            console.log("Toggle Wishlist Error:", err);
        }
    };

    const filterProducts = () => {
        let result = [...products];

        // 1. Filter by Category
        if (activeCategory !== 'All') {
            result = result.filter(p => p.category === activeCategory || (p.name && p.name.includes(activeCategory)));
        }

        // 2. Filter by Search
        if (searchQuery) {
            result = result.filter(p => p.name && p.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // 3. Sort
        if (sortBy === 'priceLow') {
            result.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
        } else if (sortBy === 'priceHigh') {
            result.sort((a, b) => parseFloat(b.price) - parseFloat(a.price));
        } else if (sortBy === 'reviews') {
            result.sort((a, b) => b.reviews - a.reviews);
        }

        setFilteredProducts(result);
    };



    // Helper to extract valid image URL
    const getImageUrl = (images) => {
        if (!images) return null;
        if (typeof images === 'string') {
            try {
                // Try parsing if it's a JSON string
                const parsed = JSON.parse(images);
                return Array.isArray(parsed) && parsed.length > 0 ? parsed[0] : parsed;
            } catch (e) {
                // If not JSON, return as is (maybe single url string)
                return images;
            }
        }
        if (Array.isArray(images) && images.length > 0) return images[0];
        return null;
    };

    const renderProduct = ({ item }) => {
        if (!item) return null;
        return (
            <TouchableOpacity style={styles.shopCard} activeOpacity={0.9} onPress={() => onProductClick(item)}>
                <View style={styles.shopImgBox}>
                    <Image
                        source={{ uri: getImageUrl(item?.images) || 'https://placehold.co/400' }}
                        style={{ width: '100%', height: '100%' }}
                        resizeMode="cover"
                        onError={(e) => console.log('Shop Image Error:', e.nativeEvent.error)}
                    />

                    {/* BADGES */}
                    {item.discount > 0 ? (
                        <View style={styles.cardBadge}><Text style={styles.cardBadgeText}>-{item.discount}%</Text></View>
                    ) : item.isNew && (
                        <View style={[styles.cardBadge, { backgroundColor: '#3B82F6' }]}><Text style={styles.cardBadgeText}>NEW</Text></View>
                    )}

                    {/* WISHLIST BTN */}
                    <TouchableOpacity style={styles.cardLikeBtn} onPress={() => handleToggleWishlist(item.id)}>
                        <Ionicons name={wishlist.includes(item.id) ? "heart" : "heart-outline"} size={16} color={wishlist.includes(item.id) ? "#EF4444" : "#94A3B8"} />
                    </TouchableOpacity>
                </View>

                <View style={styles.shopDetails}>
                    {/* TITLE */}
                    <Text style={styles.shopTitle} numberOfLines={1}>{item?.name || 'Premium Product'}</Text>

                    {/* RATING ROW */}
                    <View style={styles.ratingRow}>
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Ionicons key={i} name={i < Math.round(item.rating) ? "star" : "star-outline"} size={10} color="#FBBF24" />
                        ))}
                        <Text style={styles.ratingCount}>({item.reviews})</Text>
                    </View>

                    {/* PRICE ROW */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6, justifyContent: 'space-between' }}>
                        <Text style={styles.shopPrice}>₦{item.price ? item.price.toLocaleString() : '85,000'}</Text>
                        {item.discount > 0 && <Text style={{ fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through' }}>₦{(item.price * 1.2).toLocaleString()}</Text>}
                    </View>
                </View>

                <TouchableOpacity style={styles.addCartBtn} onPress={() => handleAddToCart(item)}>
                    <Ionicons name="add" size={16} color="white" />
                </TouchableOpacity>
            </TouchableOpacity>
        );
    };

    const renderEmpty = () => (
        <View style={styles.emptyStateContainer}>
            <Ionicons name="search-outline" size={64} color="#CBD5E1" />
            <Text style={styles.emptyStateText}>No products found</Text>
            <Text style={styles.emptyStateSub}>Try adjusting your filters or search for something else.</Text>
            <TouchableOpacity onPress={() => { setActiveCategory('All'); setSearchQuery(''); }} style={{ marginTop: 20 }}>
                <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Clear all filters</Text>
            </TouchableOpacity>
        </View>
    );

    const onScrollMomentumEnd = (e) => {
        const contentOffsetX = e.nativeEvent.contentOffset.x;
        const index = Math.round(contentOffsetX / (WIDTH - 32));
        if (index !== bannerIndex) {
            setBannerIndex(index);
        }
    };

    const [toast, setToast] = useState({ visible: false, message: '', icon: 'checkmark-circle' });
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const showToast = (message, icon = 'checkmark-circle') => {
        setToast({ visible: true, message, icon });
        Animated.sequence([
            Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
            Animated.delay(2000),
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: false })
        ]).start(() => setToast({ ...toast, visible: false }));
    };

    const [recording, setRecording] = useState(null);

    // Helper to request permissions
    useEffect(() => {
        (async () => {
            const { status: audioStatus } = await Audio.requestPermissionsAsync();
            const { status: cameraStatus } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (audioStatus !== 'granted' || cameraStatus !== 'granted') {
                console.log('Permissions denied');
            }
        })();
        return () => {
            if (recording) {
                recording.stopAndUnloadAsync();
            }
        };
    }, []);

    // AI Search Handlers
    const handleVoiceSearch = async () => {
        try {
            if (recording) {
                await stopRecording();
            } else {
                await startRecording();
            }
        } catch (error) {
            console.log('Voice Error:', error);
            setIsListening(false);
            setShowVoiceModal(false);
            showToast(error.message, 'alert-circle');
        }
    };

    const startRecording = async () => {
        try {
            await Audio.setAudioModeAsync({
                allowsRecordingIOS: true,
                playsInSilentModeIOS: true,
            });

            const { recording } = await Audio.Recording.createAsync(
                Audio.RecordingOptionsPresets.HIGH_QUALITY
            );

            setRecording(recording);
            setIsListening(true);
            setShowVoiceModal(true);

            // Auto-stop after 4 seconds (Simulate short command)
            setTimeout(() => {
                stopRecording(recording); // Safe call
            }, 4000);

        } catch (err) {
            console.error('Failed to start recording', err);
            showToast('Could not start microphone', 'alert-circle');
        }
    };

    const stopRecording = async (currentRec) => {
        const rec = currentRec || recording;
        if (!rec) return;

        setRecording(null);
        setIsListening(false);
        setShowVoiceModal(false);

        try {
            await rec.stopAndUnloadAsync();
            const uri = rec.getURI();

            // Convert to Base64
            const base64Info = await FileSystem.readAsStringAsync(uri, {
                encoding: 'base64'
            });

            // Send to Gemini
            showToast('Processing voice...', 'sync');
            const text = await geminiService.searchByVoice(base64Info);

            if (text) {
                setSearchQuery(text);
                showToast(`Heard: "${text}"`, 'mic');
            } else {
                showToast('Could not understand audio', 'help-circle');
            }

        } catch (error) {
            console.log('Stop Recording Error:', error);
            showToast('Processing Error', 'alert-circle');
        }
    };

    const handleImageSearch = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                quality: 0.5,
                base64: true
            });

            if (!result.canceled && result.assets[0].base64) {
                setAnalyzingImage(true);
                showToast('Analyzing image...', 'scan');

                const keywords = await geminiService.searchByImage(result.assets[0].base64);

                setAnalyzingImage(false);
                if (keywords) {
                    setSearchQuery(keywords);
                    showToast(`Found: ${keywords}`, 'checkmark-circle');
                } else {
                    showToast('Could not identify product', 'help-circle');
                }
            }
        } catch (e) {
            setAnalyzingImage(false);
            console.log(e);
            showToast('Gallery Error', 'alert-circle');
        }
    };

    const handleAddToCart = (item) => {
        addToCart(item);
        showToast(`Added ${item.name} to Cart`, 'cart');
    };

    const handleToggleWishlist = (id) => {
        toggleWishlist(id);
    };

    const renderPromoDots = () => {
        if (promoBanners.length <= 1) return null;
        return (
            <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 12 }}>
                {promoBanners.map((_, i) => {
                    const opacity = promoScrollX.interpolate({
                        inputRange: [(i - 1) * (WIDTH - 32), i * (WIDTH - 32), (i + 1) * (WIDTH - 32)],
                        outputRange: [0.3, 1, 0.3],
                        extrapolate: 'clamp'
                    });
                    const dotWidth = promoScrollX.interpolate({
                        inputRange: [(i - 1) * (WIDTH - 32), i * (WIDTH - 32), (i + 1) * (WIDTH - 32)],
                        outputRange: [6, 20, 6],
                        extrapolate: 'clamp'
                    });
                    return <Animated.View key={i} style={{ height: 6, width: dotWidth, borderRadius: 3, backgroundColor: '#0F172A', marginHorizontal: 3, opacity }} />;
                })}
            </View>
        );
    };

    const memoizedHeader = React.useMemo(() => (
        <View style={{ marginBottom: 12 }}>
            {banners.length > 0 && (
                <>
                    <Animated.ScrollView
                        ref={slideRef}
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        style={{ marginHorizontal: 16, marginTop: 16, height: 160, borderRadius: 12, overflow: 'hidden' }}
                        onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
                            useNativeDriver: false
                        })}
                        onMomentumScrollEnd={onScrollMomentumEnd}
                        scrollEventThrottle={16}
                    >
                        {banners.map((banner, index) => (
                            <TouchableOpacity key={banner.id} activeOpacity={0.9} style={{ width: WIDTH - 32, height: 160 }}>
                                <ImageBackground
                                    source={{ uri: banner.image_url }}
                                    style={{ width: '100%', height: '100%' }}
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
                                inputRange: [(i - 1) * (WIDTH - 32), i * (WIDTH - 32), (i + 1) * (WIDTH - 32)],
                                outputRange: [0.3, 1, 0.3],
                                extrapolate: 'clamp'
                            });
                            const dotWidth = scrollX.interpolate({
                                inputRange: [(i - 1) * (WIDTH - 32), i * (WIDTH - 32), (i + 1) * (WIDTH - 32)],
                                outputRange: [6, 20, 6],
                                extrapolate: 'clamp'
                            });
                            return <Animated.View key={i} style={{ height: 6, width: dotWidth, borderRadius: 3, backgroundColor: '#0F172A', marginHorizontal: 3, opacity }} />;
                        })}
                    </View>
                </>
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
                        snapToInterval={WIDTH}
                        decelerationRate="fast"
                        scrollEventThrottle={16}
                        onScroll={Animated.event(
                            [{ nativeEvent: { contentOffset: { x: promoScrollX } } }],
                            { useNativeDriver: false }
                        )}
                        onMomentumScrollEnd={(e) => {
                            const index = Math.round(e.nativeEvent.contentOffset.x / WIDTH);
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
                                                    onProductClick({ ...data, promoDiscount });
                                                }
                                            }).catch(() => { });
                                    }
                                }}
                                style={{ width: WIDTH - 32, marginHorizontal: 16, borderRadius: 24, overflow: 'hidden', height: 140, backgroundColor: '#0F172A', boxShadow: '0px 8px 20px rgba(0,0,0,0.15)', shadowRadius: 15 }}
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
                    {renderPromoDots()}
                </View>
            )}
        </View>
    ), [banners, promoBanners, scrollX, promoScrollX]); // Dots are animated via Interpolation, indices handled by refs or direct state but the JSX remains stable for scroll state.

    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeAreaWhite}>
                <View style={styles.shopHeader}>
                    <TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color="#0F172A" /></TouchableOpacity>
                    <View style={styles.shopSearch}>
                        <Ionicons name="search" size={18} color="#94A3B8" />
                        <TextInput
                            placeholder="Search products..."
                            style={{ flex: 1, marginLeft: 8 }}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {/* AI ICONS */}
                        {searchQuery.length === 0 && (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginRight: 4 }}>
                                <TouchableOpacity onPress={handleVoiceSearch}>
                                    <Ionicons name="mic" size={20} color="#3B82F6" />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={handleImageSearch}>
                                    <Ionicons name="camera" size={20} color="#3B82F6" />
                                </TouchableOpacity>
                            </View>
                        )}
                        {searchQuery.length > 0 && <TouchableOpacity onPress={() => setSearchQuery('')}><Ionicons name="close-circle" size={16} color="#94A3B8" /></TouchableOpacity>}
                    </View>

                    {/* SORT BUTTON (Simplified Action) */}
                    <TouchableOpacity onPress={() => setSortBy(prev => prev === 'default' ? 'priceLow' : prev === 'priceLow' ? 'priceHigh' : 'default')} style={{ marginLeft: 8 }}>
                        <Ionicons name="filter" size={24} color={sortBy !== 'default' ? '#3B82F6' : '#0F172A'} />
                    </TouchableOpacity>

                    <TouchableOpacity onPress={onGoToCart} style={{ position: 'relative', marginLeft: 16 }}>
                        <Ionicons name="cart-outline" size={24} color="#0F172A" />
                        {cartCount > 0 && <View style={[styles.redDot, { right: -6, top: -4 }]}><Text style={{ fontSize: 8, color: 'white', fontWeight: 'bold', textAlign: 'center', marginTop: -1 }}>{cartCount}</Text></View>}
                    </TouchableOpacity>
                </View>

                {/* FILTER BAR */}
                <View style={styles.filterSection}>
                    <FlatList
                        horizontal
                        data={CATEGORIES_FILTER}
                        keyExtractor={item => item}
                        showsHorizontalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[styles.filterChip, activeCategory === item && styles.filterChipActive]}
                                onPress={() => setActiveCategory(item)}
                            >
                                <Text style={[styles.filterText, activeCategory === item && styles.filterTextActive]}>{item}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </SafeAreaView>

            <FlatList
                data={filteredProducts}
                keyExtractor={(item, i) => i.toString()}
                renderItem={renderProduct}
                ListHeaderComponent={memoizedHeader}
                ListEmptyComponent={renderEmpty}
                numColumns={2}
                columnWrapperStyle={filteredProducts.length > 0 ? { justifyContent: 'space-between', paddingHorizontal: 16 } : null}
                contentContainerStyle={{ paddingTop: 16, paddingBottom: 100, flexGrow: 1 }}
                showsVerticalScrollIndicator={false}
            />

            {/* QUICK VIEW MODAL */}
            {/* QUICK VIEW MODAL REMOVED - Using ProductDetails Screen */}

            {/* VOICE SEARCH OVERLAY */}
            {showVoiceModal && (
                <View style={[styles.modalOverlay, { backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', alignItems: 'center' }]}>
                    <View style={{ backgroundColor: 'white', padding: 32, borderRadius: 24, alignItems: 'center' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                            <Ionicons name="mic" size={40} color="white" />
                        </View>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 8 }}>Listening...</Text>
                        <Text style={{ color: '#64748B' }}>Say "Phones" or "Fashion"</Text>
                    </View>
                </View>
            )}

            {/* TOAST NOTIFICATION */}
            {toast.visible && (
                <Animated.View style={[styles.toastContainer, { opacity: fadeAnim, transform: [{ translateY: fadeAnim.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }]}>
                    <Ionicons name={toast.icon} size={24} color="#10B981" />
                    <Text style={styles.toastText}>{toast.message}</Text>
                </Animated.View>
            )}
        </View>
    );
};
