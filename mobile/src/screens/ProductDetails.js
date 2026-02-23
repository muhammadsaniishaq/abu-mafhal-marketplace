import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Image, TouchableOpacity, Dimensions, Animated, StatusBar, Share, Alert, FlatList, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');

export const ProductDetails = ({ route, navigation, addToCart }) => {
    const { product } = route.params;
    const insets = useSafeAreaInsets();

    // States
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [activeImageIndex, setActiveImageIndex] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [isDescExpanded, setIsDescExpanded] = useState(false);

    // Live Data States
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [loadingRelated, setLoadingRelated] = useState(true);
    const [vendorProfile, setVendorProfile] = useState(null);
    const [currentUser, setCurrentUser] = useState(null); // Add this

    const scrollX = React.useRef(new Animated.Value(0)).current;

    const images = product.images && product.images.length > 0 ? product.images : [];
    const variants = product.metadata?.variants || [];

    // FETCH VENDOR PROFILE
    useEffect(() => {
        const fetchVendor = async () => {
            const vId = product.vendor_id || product.user_id || product.owner_id;
            console.log("ProductDetails: Fetching Vendor for ID:", vId);

            if (!vId || vId === 'admin') {
                // [NEW] Try to fetch real Admin Profile by email
                try {
                    const { data: adminData } = await supabase
                        .from('profiles')
                        .select('*')
                        .eq('email', 'muhammadsaniisyaku3@gmail.com') // Main Admin
                        .single();

                    if (adminData) {
                        setVendorProfile({
                            ...adminData,
                            full_name: 'Abu Mafhal Admin',
                            role: 'Admin',
                            avatar_url: adminData.avatar_url || adminData.user_metadata?.avatar_url || null
                        });
                    } else {
                        // Fallback if no admin profile found
                        setVendorProfile({ id: 'admin', full_name: 'Abu Mafhal Admin', role: 'Admin', avatar_url: null });
                    }
                } catch (e) {
                    setVendorProfile({ id: 'admin', full_name: 'Abu Mafhal Admin', role: 'Admin', avatar_url: null });
                }
                return;
            }

            try {
                // 0. SELF-VIEW OPTIMIZATION
                const { data: { user } } = await supabase.auth.getUser();
                if (user) setCurrentUser(user);

                const currentUserLocal = user;

                if (currentUserLocal && currentUserLocal.id === vId) {
                    console.log("ProductDetails: Vendor is Current User.");

                    let selfAvatar = currentUserLocal.user_metadata?.avatar_url || currentUserLocal.avatar_url;
                    // SAFETY CHECK: Ignore local URIs
                    if (selfAvatar && (selfAvatar.startsWith('file://') || selfAvatar.startsWith('/data/'))) {
                        selfAvatar = null;
                    }

                    setVendorProfile({
                        ...currentUserLocal,
                        full_name: `${currentUserLocal.user_metadata?.full_name || 'You'}`,
                        role: 'Vendor',
                        avatar_url: selfAvatar
                    });
                    return;
                }

                // 1. Fetch from 'profiles' table
                let { data, error } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', vId)
                    .single();

                if (!data) {
                    const { data: userData } = await supabase.from('users').select('*').eq('id', vId).single();
                    if (userData) data = userData;
                }

                if (data) {
                    // Smart Avatar Resolution
                    let finalAvatar = data.avatar_url || data.user_metadata?.avatar_url || data.avatarUrl || null;

                    // SAFETY CHECK: If avatar is a local file string (mistakenly saved), ignore it.
                    if (finalAvatar && (finalAvatar.startsWith('file://') || finalAvatar.startsWith('/data/'))) {
                        console.log("ProductDetails: Ignored local avatar URI:", finalAvatar);
                        finalAvatar = null;
                    }

                    setVendorProfile({
                        ...data,
                        full_name: data.full_name || data.username || 'Vendor',
                        role: (data.role === 'admin' || data.email === 'muhammadsaniisyaku3@gmail.com') ? 'Admin' : 'Vendor',
                        avatar_url: finalAvatar
                    });
                }
            } catch (e) {
                console.log('Error fetching vendor:', e);
            }
        };
        fetchVendor();
    }, [product]);

    // FETCH REAL RELATED PRODUCTS
    useEffect(() => {
        const fetchRelated = async () => {
            try {
                // Find products in same category, exclude current one
                let query = supabase
                    .from('products')
                    .select('*')
                    .neq('id', product.id)
                    .limit(5);

                if (product.category) {
                    query = query.eq('category', product.category);
                }

                const { data, error } = await query;
                if (!error && data) {
                    // Filter out any potential database mock data or bad entries
                    const cleanData = data.filter(item =>
                        !item.name.toLowerCase().includes('mock') &&
                        !item.name.toLowerCase().includes('test') &&
                        !item.name.includes('2026') // Specific removal as requested
                    );
                    setRelatedProducts(cleanData);
                }
            } catch (err) {
                console.log('Error fetching related:', err);
            } finally {
                setLoadingRelated(false);
            }
        };

        fetchRelated();
    }, [product]);

    const handleShare = async () => {
        try {
            await Share.share({
                message: `Check out ${product.name} on Abu Mafhal! Price: ₦${product.price ? product.price.toLocaleString() : 'N/A'}`,
            });
        } catch (error) {
            console.log(error.message);
        }
    };

    const handleAddToCart = () => {
        if (addToCart) {
            addToCart(product, quantity);
            Alert.alert('Success', `Added ${quantity} x ${product.name} to cart.`);
            navigation.goBack();
        } else {
            console.log('addToCart is missing');
            // Fallback for standalone preview
            Alert.alert('Demo', `Added ${quantity} x ${product.name} to cart state.`);
            navigation.goBack();
        }
    };

    const handleQuantityChange = (delta) => {
        setQuantity(prev => Math.max(1, prev + delta));
    };

    // Helper to extract first image
    const getProductImage = (imgs) => {
        if (!imgs) return null;
        if (typeof imgs === 'string') {
            try { return JSON.parse(imgs)[0]; } catch { return imgs; }
        }
        if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
        return null;
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

            {/* Header / Back Button - ADJUSTED TOP PADDING */}
            <View style={{ position: 'absolute', top: insets.top + 10, left: 20, right: 20, zIndex: 50, flexDirection: 'row', justifyContent: 'space-between' }}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(10px)' }}>
                    <Ionicons name="arrow-back" size={24} color="white" />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleShare} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="share-outline" size={22} color="white" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Image Carousel - MOVED DOWN & REDUCED */}
                <View style={{ height: 350, backgroundColor: '#F1F5F9', marginTop: insets.top + 20 }}>
                    {images.length > 0 ? (
                        <>
                            <Animated.FlatList
                                data={images}
                                horizontal
                                pagingEnabled
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={(_, index) => index.toString()}
                                onScroll={Animated.event(
                                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                                    { useNativeDriver: false }
                                )}
                                onMomentumScrollEnd={(e) => {
                                    setActiveImageIndex(Math.round(e.nativeEvent.contentOffset.x / width));
                                }}
                                renderItem={({ item }) => (
                                    <Image source={{ uri: item }} style={{ width: width, height: 350, resizeMode: 'cover' }} />
                                )}
                            />
                            {/* Pagination Dots */}
                            <View style={{ position: 'absolute', bottom: 40, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 8 }}>
                                {images.map((_, i) => (
                                    <View key={i} style={{ width: i === activeImageIndex ? 24 : 8, height: 8, borderRadius: 4, backgroundColor: i === activeImageIndex ? '#0F172A' : 'rgba(255,255,255,0.5)' }} />
                                ))}
                            </View>
                        </>
                    ) : (
                        <View style={{ width: width, height: 350, alignItems: 'center', justifyContent: 'center', backgroundColor: '#CBD5E1' }}>
                            <Ionicons name="image-outline" size={64} color="white" />
                            <Text style={{ color: 'white', marginTop: 10 }}>No Image Available</Text>
                        </View>
                    )}

                    {/* FLOATING WISHLIST BUTTON */}
                    <TouchableOpacity
                        style={{ position: 'absolute', bottom: -24, right: 30, width: 50, height: 50, borderRadius: 25, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', zIndex: 20 }}
                        onPress={() => Alert.alert('Added to Wishlist', `${product.name} saved!`)}
                    >
                        <Ionicons name="heart" size={24} color="white" />
                    </TouchableOpacity>
                </View>

                {/* VIDEO PLAYER */}
                {(product.video_url || product.metadata?.video || product.video) && (
                    <View style={{ marginTop: 24, paddingHorizontal: 24 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Product Video</Text>
                        <Video
                            style={{ width: '100%', height: 200, borderRadius: 16, backgroundColor: '#000' }}
                            source={{ uri: product.video_url || product.metadata?.video || product.video }}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            isLooping
                            onError={(e) => console.log('Video Error:', e)}
                        />
                    </View>
                )}

                {/* Content Container - FILTERED ENTRY ANIMATION */}
                <View style={{ padding: 24, marginTop: 0, backgroundColor: 'white', borderTopLeftRadius: 32, borderTopRightRadius: 32, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>

                    {/* CENTER INDICATOR */}
                    <View style={{ width: 40, height: 4, backgroundColor: '#E2E8F0', borderRadius: 2, alignSelf: 'center', marginBottom: 20 }} />

                    {/* Title & Price */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 26, fontWeight: '800', color: '#0F172A', marginBottom: 8, lineHeight: 34 }}>{product.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text style={{ fontSize: 28, fontWeight: '900', color: '#3B82F6' }}>
                                ₦{product.price ? product.price.toLocaleString() : 'N/A'}
                            </Text>

                            {/* Rating Badge - Only show if valid */}
                            {(product.reviews > 0 || product.rating > 0) && (
                                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FEF9C3', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 }}>
                                    <Ionicons name="star" size={16} color="#EAB308" />
                                    <Text style={{ fontSize: 14, fontWeight: '700', color: '#854D0E', marginLeft: 4 }}>{product.rating?.toFixed(1)}</Text>
                                    <Text style={{ fontSize: 14, color: '#A16207', marginLeft: 4 }}>({product.reviews} reviews)</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Divider */}
                    <View style={{ height: 1, backgroundColor: '#F1F5F9', marginBottom: 24 }} />

                    {/* Variants Selection */}
                    {variants.length > 0 && (
                        <View style={{ marginBottom: 24 }}>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Select Option</Text>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                                {variants.map((v, i) => (
                                    <TouchableOpacity
                                        key={i}
                                        onPress={() => setSelectedVariant(v)}
                                        style={{
                                            paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1,
                                            borderColor: selectedVariant === v ? '#0F172A' : '#E2E8F0',
                                            backgroundColor: selectedVariant === v ? '#0F172A' : 'white'
                                        }}
                                    >
                                        <Text style={{ color: selectedVariant === v ? 'white' : '#64748B', fontWeight: '600' }}>
                                            {v.name} - ₦{v.price}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* Owner / Vendor Info */}
                    {vendorProfile && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 24, padding: 12, backgroundColor: '#F8FAFC', borderRadius: 16 }}>
                            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#E2E8F0', overflow: 'hidden', marginRight: 12, alignItems: 'center', justifyContent: 'center' }}>
                                {vendorProfile.avatar_url ? (
                                    <Image source={{ uri: vendorProfile.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Ionicons name="person" size={24} color="#94A3B8" />
                                )}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                                    {vendorProfile.full_name || (vendorProfile.role === 'admin' ? 'Abu Mafhal Admin' : 'Vendor')}
                                </Text>
                                <Text style={{ fontSize: 13, color: '#64748B' }}>
                                    {vendorProfile.role ? vendorProfile.role.charAt(0).toUpperCase() + vendorProfile.role.slice(1) : 'Seller'}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => navigation.navigate('ChatScreen', {
                                    productId: product.id,
                                    productName: product.name,
                                    productPrice: product.price,
                                    productImage: images[0],
                                    vendorId: vendorProfile.id,
                                    vendorName: vendorProfile.full_name,
                                    vendorAvatar: vendorProfile.avatar_url
                                })}
                                style={{ padding: 8, backgroundColor: '#EFF6FF', borderRadius: 12 }}
                            >
                                <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
                            </TouchableOpacity>
                        </View>
                    )}

                    {/* Description */}
                    <View style={{ marginBottom: 24 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 8 }}>Description</Text>
                        <Text style={{ fontSize: 15, color: '#64748B', lineHeight: 26 }} numberOfLines={isDescExpanded ? undefined : 3}>
                            {product.description || "No description provided."}
                        </Text>
                        <TouchableOpacity onPress={() => setIsDescExpanded(!isDescExpanded)} style={{ marginTop: 8 }}>
                            <Text style={{ color: '#3B82F6', fontWeight: '600' }}>{isDescExpanded ? 'Show Less' : 'Read More'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Specifications Box */}
                    <View style={{ marginBottom: 24, padding: 16, backgroundColor: '#F8FAFC', borderRadius: 16 }}>
                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Product Details</Text>
                        <View style={{ gap: 12 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748B' }}>Category</Text>
                                <Text style={{ color: '#0F172A', fontWeight: '600' }}>{product.category || 'General'}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                <Text style={{ color: '#64748B' }}>Stock Status</Text>
                                <Text style={{ color: '#10B981', fontWeight: '600' }}>In Stock</Text>
                            </View>
                            {product.brand && (
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                    <Text style={{ color: '#64748B' }}>Brand</Text>
                                    <Text style={{ color: '#0F172A', fontWeight: '600' }}>{product.brand}</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* Reviews Summary - ONLY SHOW IF REAL DATA EXISTS */}
                    {(product.reviews > 0) && (
                        <View style={{ marginBottom: 24 }}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A' }}>Reviews</Text>
                                <TouchableOpacity><Text style={{ color: '#3B82F6', fontWeight: '600' }}>See all</Text></TouchableOpacity>
                            </View>
                            <View style={{ alignItems: 'center', justifyContent: 'center', padding: 16, backgroundColor: '#FEF9C3', borderRadius: 16, alignSelf: 'flex-start' }}>
                                <Text style={{ fontSize: 32, fontWeight: '900', color: '#854D0E' }}>{product.rating?.toFixed(1)}</Text>
                                <View style={{ flexDirection: 'row' }}>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Ionicons key={i} name={i < Math.round(product.rating || 0) ? "star" : "star-outline"} color="#EAB308" size={14} />
                                    ))}
                                </View>
                                <Text style={{ fontSize: 12, color: '#A16207', marginTop: 4 }}>{product.reviews} Reviews</Text>
                            </View>
                        </View>
                    )}

                    {/* Related Products - REAL DATA */}
                    {relatedProducts.length > 0 && (
                        <View style={{ marginBottom: 30 }}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>You May Also Like</Text>
                            <FlatList
                                data={relatedProducts}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                keyExtractor={item => item.id.toString()}
                                renderItem={({ item }) => {
                                    const imgUri = getProductImage(item.images);
                                    return (
                                        <TouchableOpacity
                                            onPress={() => navigation.push('ProductDetails', { product: item })} // Use push for new instance
                                            style={{ width: 140, marginRight: 16 }}
                                        >
                                            {imgUri ? (
                                                <Image source={{ uri: imgUri }} style={{ width: 140, height: 140, borderRadius: 16, marginBottom: 8, backgroundColor: '#F1F5F9' }} />
                                            ) : (
                                                <View style={{ width: 140, height: 140, borderRadius: 16, marginBottom: 8, backgroundColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Ionicons name="image-outline" size={32} color="#94A3B8" />
                                                </View>
                                            )}
                                            <Text style={{ fontWeight: '600', color: '#0F172A' }} numberOfLines={1}>{item.name}</Text>
                                            <Text style={{ color: '#3B82F6', fontWeight: '700' }}>₦{item.price ? item.price.toLocaleString() : 'N/A'}</Text>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    )}

                    {loadingRelated && (
                        <View style={{ padding: 20, alignItems: 'center' }}>
                            <ActivityIndicator size="small" color="#94A3B8" />
                        </View>
                    )}

                </View>
            </ScrollView>

            {/* Bottom Sticky Action Bar */}
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, paddingBottom: insets.bottom + 10, borderTopWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                <View style={{ flexDirection: 'row', gap: 12 }}>

                    {/* Chat Button */}
                    {/* Chat/Edit Button */}
                    <TouchableOpacity
                        onPress={() => {
                            // Check if owner
                            const isOwner = vendorProfile?.id && currentUser && vendorProfile.id === currentUser.id;

                            if (isOwner) {
                                // Navigate to Edit or Alert
                                Alert.alert('Manage Product', 'This is your product. You can edit it from your shop dashboard.');
                                // navigation.navigate('EditProduct', { product }); // If you have an edit screen
                                return;
                            }

                            console.log('Navigating to Chat. Vendor Profile:', vendorProfile);
                            // Use the RESOLVED vendorProfile data, not just raw product data
                            const finalVendorId = vendorProfile?.id || product.vendor_id || product.user_id || product.owner_id || 'admin';

                            navigation.navigate('ChatScreen', {
                                productId: product.id,
                                productName: product.name,
                                productPrice: product.price,
                                productImage: images[0],
                                vendorId: finalVendorId,
                                vendorName: vendorProfile?.full_name || product.vendor_name || 'Vendor',
                                vendorAvatar: vendorProfile?.avatar_url,
                                vendorRole: vendorProfile?.role // Pass the resolved role!
                            });
                        }}
                        style={{
                            width: 54,
                            height: 54,
                            borderRadius: 16,
                            backgroundColor: (vendorProfile?.id && currentUser && vendorProfile.id === currentUser.id) ? '#F0FDF4' : '#F1F5F9', // Green tint for owner
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderWidth: 1,
                            borderColor: '#E2E8F0'
                        }}
                    >
                        <Ionicons
                            name={(vendorProfile?.id && currentUser && vendorProfile.id === currentUser.id) ? "create-outline" : "chatbubble-ellipses-outline"}
                            size={24}
                            color={(vendorProfile?.id && currentUser && vendorProfile.id === currentUser.id) ? "#16A34A" : "#0F172A"}
                        />
                    </TouchableOpacity>

                    {/* Quantity Selector */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16, paddingHorizontal: 4 }}>
                        <TouchableOpacity onPress={() => handleQuantityChange(-1)} style={{ width: 44, height: 54, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="remove" size={20} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={{ fontSize: 18, fontWeight: '700', width: 20, textAlign: 'center' }}>{quantity}</Text>
                        <TouchableOpacity onPress={() => handleQuantityChange(1)} style={{ width: 44, height: 54, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="add" size={20} color="#0F172A" />
                        </TouchableOpacity>
                    </View>

                    {/* Add to Cart Button */}
                    <TouchableOpacity
                        onPress={handleAddToCart}
                        style={{ flex: 1, height: 54, backgroundColor: '#0F172A', borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowOffset: { height: 4 }, shadowRadius: 12 }}
                    >
                        <Ionicons name="cart" size={20} color="white" />
                        <Text style={{ color: 'white', fontSize: 16, fontWeight: '700' }}>Add - ₦{product.price ? (product.price * quantity).toLocaleString() : '0'}</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
};
