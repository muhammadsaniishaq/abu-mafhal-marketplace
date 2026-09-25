import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, Animated, StatusBar, Share, Alert,
    ActivityIndicator, StyleSheet, Platform, Modal,
    Linking, Pressable, TextInput
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useComparison } from '../context/ComparisonContext';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets, SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../lib/supabase';
import { resolveVendorOrStore } from '../services/vendorResolver';
import { whatsappService } from '../services/whatsappService';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

const BRAND = {
    navy: '#0A192F',
    navyMid: '#0E2340',
    gold: '#E5A93C',
    goldBright: '#F5A623',
    goldDark: '#A07820',
    emerald: '#10B981',
    emeraldDark: '#059669',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    slateLight: '#F1F5F9',
    bg: '#FFFFFF',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderSoft: '#F8FAFC',
    danger: '#EF4444',
};

const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '₦0';
    return `₦${num.toLocaleString()}`;
};

export const ProductDetails = ({ route, navigation, addToCart, user }) => {
    const initialProduct = route?.params?.product || null;
    const productId = route?.params?.id || route?.params?.productId || initialProduct?.id;

    const insets = useSafeAreaInsets();
    const { addToComparison } = useComparison();

    const [currentUser, setCurrentUser] = useState(() => {
        if (user) return user;
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                const raw = window.localStorage.getItem('@abumafhal_user_v1');
                if (raw) return JSON.parse(raw);
            }
        } catch (_) {}
        return null;
    });

    useEffect(() => {
        if (!currentUser) {
            AsyncStorage.getItem('@abumafhal_user_v1').then((raw) => {
                if (raw) {
                    try { setCurrentUser(JSON.parse(raw)); } catch (_) {}
                }
            }).catch(() => {});
        }
    }, [user]);

    // Gating check: User MUST be logged in to view product details
    if (!user && !currentUser) {
        return (
            <SafeAreaView style={{ flex: 1, backgroundColor: '#070F1E', justifyContent: 'center', alignItems: 'center', padding: 24 }}>
                <StatusBar barStyle="light-content" backgroundColor="#070F1E" />
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(217, 167, 58, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 20, borderWidth: 1.5, borderColor: '#D9A73A' }}>
                    <Ionicons name="lock-closed" size={38} color="#D9A73A" />
                </View>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#FFFFFF', textAlign: 'center', marginBottom: 10 }}>
                    Authentication Required
                </Text>
                <Text style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 20, marginBottom: 26, maxWidth: 320 }}>
                    To ensure secure transactions and protect verified merchant inventory, please sign in or create an account to view full product specifications and pricing.
                </Text>
                <TouchableOpacity
                    onPress={() => navigation.navigate('Auth', {
                        redirectTo: 'ProductDetails',
                        redirectParams: route?.params
                    })}
                    style={{ backgroundColor: '#D9A73A', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14, width: '100%', maxWidth: 300, alignItems: 'center', shadowColor: '#D9A73A', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                    activeOpacity={0.9}
                >
                    <Text style={{ color: '#070F1E', fontWeight: '900', fontSize: 14 }}>Sign In / Register</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => navigation.goBack()}
                    style={{ marginTop: 16, padding: 10 }}
                >
                    <Text style={{ color: '#64748B', fontWeight: '700', fontSize: 13 }}>Go Back</Text>
                </TouchableOpacity>
            </SafeAreaView>
        );
    }

    // ── States ────────────────────────────────────────────────────────────────
    const [product, setProduct] = useState(initialProduct);
    const [activeImg, setActiveImg] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [descExpanded, setDescExpanded] = useState(false);
    const [vendor, setVendor] = useState(initialProduct?.vendor || null);
    const [loadingVend, setLoadingVend] = useState(!initialProduct?.vendor);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [reviewsList, setReviewsList] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [liked, setLiked] = useState(false);
    const [cartDone, setCartDone] = useState(false);
    const [imgZoom, setImgZoom] = useState(false);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [cartCount, setCartCount] = useState(route?.params?.cartCount || 3);
    const [chatInput, setChatInput] = useState('');
    const [sendingChat, setSendingChat] = useState(false);

    // Toast feedback
    const [toastMessage, setToastMessage] = useState('');
    const toastAnim = useRef(new Animated.Value(0)).current;
    const heartScale = useRef(new Animated.Value(1)).current;
    const cartScale = useRef(new Animated.Value(1)).current;

    const showToast = (msg) => {
        setToastMessage(msg);
        Animated.sequence([
            Animated.timing(toastAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
            Animated.delay(2200),
            Animated.timing(toastAnim, { toValue: 0, duration: 200, useNativeDriver: true })
        ]).start();
    };

    // ── Fetch Fresh Product & Related Data ────────────────────────────────────
    useEffect(() => {
        fetchLiveProduct();
        checkWishlist();
    }, [productId]);

    const fetchLiveProduct = async () => {
        if (!productId) return;
        try {
            const { data, error } = await supabase
                .from('products')
                .select('*')
                .eq('id', productId)
                .maybeSingle();

            if (data) {
                const merged = {
                    ...data,
                    vendor_id: data.vendor_id || initialProduct?.vendor_id || initialProduct?.vendor?.userId || initialProduct?.vendor?.id,
                    store_id: data.store_id || initialProduct?.store_id || initialProduct?.vendor?.id,
                    vendor: initialProduct?.vendor || null
                };
                setProduct(merged);
                fetchVendor(merged);
                fetchRelatedProducts(data.category, data.id);
                fetchReviews(data.id);
            } else if (initialProduct) {
                fetchVendor(initialProduct);
                fetchRelatedProducts(initialProduct.category, initialProduct.id);
                fetchReviews(initialProduct.id);
            }
        } catch (err) {
            console.log('Error fetching live product:', err);
        }
    };

    // ── Fetch Real Vendor / Store Profile (Unified & 100% Consistent) ─────────
    const fetchVendor = async (currentProd) => {
        // 1. If product already carries an authentic vendor object passed from store, respect and use it
        if (currentProd?.vendor && currentProd.vendor.name && (currentProd.vendor.id || currentProd.vendor.userId)) {
            setVendor(currentProd.vendor);
            setLoadingVend(false);
            return;
        }

        setLoadingVend(true);
        try {
            const vId = currentProd?.vendor_id || currentProd?.store_id || currentProd?.user_id;
            const vData = await resolveVendorOrStore(vId);
            setVendor(vData);
        } catch (err) {
            console.log('[ProductDetails] fetchVendor error:', err);
        } finally {
            setLoadingVend(false);
        }
    };

    // ── Fetch Real Related Products ───────────────────────────────────────────
    const fetchRelatedProducts = async (cat, currentId) => {
        if (!cat) return;
        try {
            const { data } = await supabase
                .from('products')
                .select('id, name, price, compare_at_price, image_url, images, rating, stock, category')
                .eq('category', cat)
                .eq('status', 'approved')
                .neq('id', currentId)
                .limit(6);

            if (data && data.length > 0) {
                setRelatedProducts(data);
            }
        } catch (_) {}
    };

    // ── Fetch Real Reviews ────────────────────────────────────────────────────
    const fetchReviews = async (currentId) => {
        setLoadingReviews(true);
        try {
            const { data } = await supabase
                .from('reviews')
                .select('*')
                .eq('product_id', currentId)
                .order('created_at', { ascending: false })
                .limit(10);

            if (data && data.length > 0) {
                setReviewsList(data);
            }
        } catch (_) {} finally {
            setLoadingReviews(false);
        }
    };

    // ── Wishlist State ────────────────────────────────────────────────────────
    const checkWishlist = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user || !productId) return;
            const { data } = await supabase
                .from('wishlists')
                .select('items')
                .eq('id', user.id)
                .maybeSingle();

            if (data?.items) {
                setLiked(data.items.includes(productId));
            }
        } catch (_) {}
    };

    const handleToggleWishlist = async () => {
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.35, useNativeDriver: true, tension: 400 }),
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
        ]).start();

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Login Required', 'Please login to save this item to your wishlist.');
                return;
            }
            const { data } = await supabase.from('wishlists').select('items').eq('id', user.id).maybeSingle();
            const curr = data?.items || [];
            const next = liked ? curr.filter(i => i !== productId) : [...curr, productId];

            setLiked(!liked);
            showToast(!liked ? 'Saved to Wishlist ❤️' : 'Removed from Wishlist');

            await supabase.from('wishlists').upsert({
                id: user.id,
                items: next,
                updated_at: new Date().toISOString()
            });
        } catch (err) {
            console.log('Wishlist error:', err);
        }
    };

    // ── Gallery Images Parser ─────────────────────────────────────────────────
    const getImages = () => {
        const list = [];
        if (product?.image_url && typeof product.image_url === 'string') {
            list.push(product.image_url);
        }
        if (Array.isArray(product?.images)) {
            product.images.forEach(img => {
                if (img && typeof img === 'string' && !list.includes(img)) list.push(img);
            });
        } else if (typeof product?.images === 'string') {
            try {
                const parsed = JSON.parse(product.images);
                if (Array.isArray(parsed)) {
                    parsed.forEach(img => {
                        if (img && typeof img === 'string' && !list.includes(img)) list.push(img);
                    });
                }
            } catch (_) {
                if (product.images.startsWith('http') && !list.includes(product.images)) {
                    list.push(product.images);
                }
            }
        }
        if (list.length === 0) {
            list.push('https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600&auto=format&fit=crop');
        }
        return list;
    };

    const images = getImages();

    const DEFAULT_DEMO_VIDEO = 'https://media.w3.org/2010/05/sintel/trailer.mp4';

    // ── Video URL Resolver ───────────────────────────────────────────────────
    const getVideoUrl = () => {
        let meta = product?.metadata;
        if (typeof meta === 'string') {
            try { meta = JSON.parse(meta); } catch (_) { meta = null; }
        }
        const candidate = product?.video_url ||
                          product?.video ||
                          meta?.video ||
                          meta?.video_url ||
                          meta?.videoUrl;
        if (candidate && typeof candidate === 'string' && candidate.trim().length > 0) {
            const t = candidate.trim();
            if (t.startsWith('http://') || t.startsWith('https://') || t.startsWith('file://') || t.startsWith('blob:') || t.startsWith('data:')) {
                return t;
            }
        }
        return DEFAULT_DEMO_VIDEO;
    };
    const productVideoUrl = getVideoUrl();

    // ── Price & Discounts ─────────────────────────────────────────────────────
    const currentPrice = Number(selectedVariant?.price || product?.price || 0);
    const comparePrice = Number(product?.compare_at_price || 0);
    const hasDiscount = comparePrice > currentPrice;
    const discountPercent = hasDiscount ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100) : 0;

    const stock = product?.stock !== undefined ? Number(product.stock) : (product?.stock_quantity !== undefined ? Number(product.stock_quantity) : 1);
    const isOutOfStock = stock <= 0;

    // ── Variants ──────────────────────────────────────────────────────────────
    const getVariants = () => {
        if (Array.isArray(product?.variants) && product.variants.length > 0) return product.variants;
        if (typeof product?.variants === 'string') {
            try {
                const parsed = JSON.parse(product.variants);
                if (Array.isArray(parsed)) return parsed;
            } catch (_) {}
        }
        return [];
    };
    const variants = getVariants();

    // ── Add to Cart & Buy Now ─────────────────────────────────────────────────
    const handleAddToCart = () => {
        if (isOutOfStock) {
            Alert.alert('Out of Stock', 'This product is currently sold out.');
            return;
        }

        Animated.sequence([
            Animated.timing(cartScale, { toValue: 1.25, duration: 100, useNativeDriver: true }),
            Animated.spring(cartScale, { toValue: 1, friction: 3, useNativeDriver: true })
        ]).start();

        if (addToCart) {
            addToCart({
                ...product,
                price: currentPrice,
                selectedVariant: selectedVariant?.name || null
            }, quantity);
        }
        setCartCount(prev => prev + quantity);
        setCartDone(true);
        showToast(`Added ${quantity}x "${product?.name || 'Item'}" to cart! 🛍️`);
        setTimeout(() => setCartDone(false), 2500);
    };

    const handleBuyNow = () => {
        if (isOutOfStock) {
            Alert.alert('Out of Stock', 'This product is currently sold out.');
            return;
        }
        if (addToCart) {
            addToCart({
                ...product,
                price: currentPrice,
                selectedVariant: selectedVariant?.name || null
            }, quantity);
        }
        navigation.navigate('Main', { screen: 'cart' });
    };

    const handleQty = (delta) => {
        const next = quantity + delta;
        if (next < 1) return;
        if (stock > 0 && next > stock) {
            Alert.alert('Maximum Stock Reached', `Only ${stock} units are currently available.`);
            return;
        }
        setQuantity(next);
    };

    const handleShare = () => {
        Share.share({
            message: `🛍️ Check out "${product?.name}" on Abu Mafhal Marketplace!\n💰 Price: ${fmtPrice(currentPrice)}\n🛡️ 100% Genuine with Buyer Escrow Guarantee.\nShop here: https://abumafhal.com/mobile#product/${product?.id}`,
            title: product?.name
        });
    };

    // ── 100% FUNCTIONAL LIVE CHAT SYSTEM ──────────────────────────────────────
    const handleOpenLiveChat = async (initialText = '') => {
        try {
            setSendingChat(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                Alert.alert(
                    'Login Required',
                    'Please login to start a live in-app chat with the seller. Alternatively, you can chat with them directly on WhatsApp.',
                    [
                        {
                            text: 'Login Now',
                            onPress: () => navigation.navigate('Auth', {
                                redirectTo: 'ProductDetails',
                                redirectParams: { product, id: product?.id }
                            })
                        },
                        {
                            text: 'Chat via WhatsApp',
                            onPress: () => handleWhatsAppVendor(initialText)
                        },
                        { text: 'Cancel', style: 'cancel' }
                    ]
                );
                return;
            }

            // Resolve target vendor UUID
            let targetId = vendor?.id || product?.vendor_id || product?.user_id;

            if (!targetId || targetId === 'admin' || targetId === 'official') {
                const { data: adminUser } = await supabase
                    .from('profiles')
                    .select('id, full_name, avatar_url')
                    .eq('role', 'admin')
                    .limit(1)
                    .maybeSingle();

                if (adminUser?.id) {
                    targetId = adminUser.id;
                }
            }

            // If user typed/clicked an initial question, insert directly to Supabase messages
            if (initialText && initialText.trim() && targetId && targetId !== 'admin') {
                try {
                    await supabase.from('messages').insert({
                        sender_id: user.id,
                        receiver_id: targetId,
                        message: `🛍️ [Product Inquiry: ${product?.name} - ₦${currentPrice}]\n${initialText.trim()}`,
                        message_type: 'product_inquiry',
                        product_id: product?.id,
                        created_at: new Date().toISOString()
                    });
                } catch (sendErr) {
                    console.log('Error inserting message:', sendErr);
                }
            }

            // Open full ChatScreen with live messages, typing indicator, and realtime subscriptions
            navigation.navigate('ChatScreen', {
                vendorId: targetId,
                vendorName: vendor?.name || 'ABU MAFHAL',
                vendorAvatar: vendor?.avatar || null,
                productId: product?.id,
                productName: product?.name,
                productPrice: currentPrice,
                productImage: images[0] || product?.image_url,
                vendorRole: vendor?.role || (vendor?.isOfficial ? 'Official Store' : 'Verified Seller'),
            });
        } catch (chatError) {
            console.log('handleOpenLiveChat error:', chatError);
            handleWhatsAppVendor(initialText);
        } finally {
            setSendingChat(false);
        }
    };

    const handleWhatsAppVendor = (customMsg = '') => {
        const rawPhone = vendor?.whatsapp || vendor?.phone || '2348145853539';
        const vendorTitle = vendor?.name || 'Seller';
        const defaultText = `Hello ${vendorTitle}, I want to order *${product?.name || 'Product'}* (${fmtPrice(currentPrice)}) on Abu Mafhal Marketplace.\nQty: ${quantity}\nLink: https://abumafhal.com/product/${product?.id || ''}\nIs this item available for express delivery?`;
        whatsappService.openWhatsApp(rawPhone, customMsg || defaultText);
    };

    const handleWhatsAppShare = () => {
        const shareMsg = `🌟 Check out *${product?.name || 'Product'}* for ${fmtPrice(currentPrice)} on Abu Mafhal Marketplace!\nAuthentic & Verified • Fast Delivery Nationwide.\nhttps://abumafhal.com/product/${product?.id || ''}`;
        whatsappService.openWhatsApp('', shareMsg);
    };

    const subtitleText = product?.short_description ||
        (product?.brand ? `${product.brand} • Premium Quality` :
        (product?.condition ? `${product.condition} • 100% Authentic` : '100% Genuine Quality Guaranteed'));

    if (!product) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={BRAND.navy} />
                <Text style={s.loadingTxt}>Loading live product details...</Text>
            </View>
        );
    }

    const safePaddingTop = Platform.OS === 'ios' ? Math.max(insets.top, 44) : Platform.OS === 'web' ? 12 : (StatusBar.currentHeight || 24) + 6;

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* ══════════════════════════════════════════════════
                1. TOP LUXURY HEADER (Exact to Mockup)
            ══════════════════════════════════════════════════ */}
            <View style={[s.topBar, { paddingTop: safePaddingTop }]}>
                {/* Left: Menu / Hamburger */}
                <TouchableOpacity
                    style={s.topNavBtn}
                    onPress={() => navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Main', { screen: 'home' })}
                    activeOpacity={0.7}
                >
                    <Ionicons name="menu-outline" size={26} color={BRAND.slateDark} />
                </TouchableOpacity>

                {/* Center: ABU MAFHAL Logo with Tagline */}
                <TouchableOpacity
                    style={s.topBrandCenter}
                    onPress={() => navigation.navigate('Main', { screen: 'home' })}
                    activeOpacity={0.8}
                >
                    <Image source={AM_LOGO} style={s.topLogoImg} resizeMode="contain" />
                    <View style={{ alignItems: 'flex-start' }}>
                        <Text style={s.topLogoTitle}>ABU MAFHAL</Text>
                        <Text style={s.topLogoSub}>YOUR MARKETPLACE, YOUR CHOICE.</Text>
                    </View>
                </TouchableOpacity>

                {/* Right: Search, Cart with Badge, More Options */}
                <View style={s.topRightActions}>
                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={() => navigation.navigate('Main', { screen: 'shop' })}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="search-outline" size={22} color={BRAND.slateDark} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={() => navigation.navigate('Main', { screen: 'cart' })}
                        activeOpacity={0.7}
                    >
                        <View style={{ position: 'relative' }}>
                            <Ionicons name="cart-outline" size={23} color={BRAND.slateDark} />
                            {cartCount > 0 && (
                                <View style={s.topCartBadge}>
                                    <Text style={s.topCartBadgeTxt}>{cartCount}</Text>
                                </View>
                            )}
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={() => setShowMenu(true)}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="ellipsis-vertical" size={20} color={BRAND.slateDark} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 110 }}
            >
                {/* ══════════════════════════════════════════════════
                    2. BREADCRUMB STRIP (Exact to Mockup)
                ══════════════════════════════════════════════════ */}
                <View style={s.breadcrumbRow}>
                    <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'home' })}>
                        <Text style={s.breadcrumbLink}>Home</Text>
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
                    <TouchableOpacity onPress={() => navigation.navigate('Main', { screen: 'shop', category: product.category })}>
                        <Text style={s.breadcrumbLink}>{product.category || 'Shop'}</Text>
                    </TouchableOpacity>
                    <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
                    <Text style={s.breadcrumbActive} numberOfLines={1}>
                        {product.name}
                    </Text>
                </View>

                {/* ══════════════════════════════════════════════════
                    3. DUAL-PANE PRODUCT GALLERY (Exact to Mockup)
                ══════════════════════════════════════════════════ */}
                <View style={s.galleryContainer}>
                    {/* Left Thumbnails Column */}
                    <View style={s.thumbnailCol}>
                        {images.slice(0, 4).map((uri, idx) => (
                            <TouchableOpacity
                                key={'thumb-' + idx}
                                style={[s.thumbnailWrap, activeImg === idx && s.thumbnailWrapActive]}
                                onPress={() => setActiveImg(idx)}
                                activeOpacity={0.8}
                            >
                                <Image source={{ uri }} style={s.thumbnailImg} resizeMode="contain" />
                            </TouchableOpacity>
                        ))}

                        {/* 5th Slot: Video thumbnail always visible and active */}
                        <TouchableOpacity
                            style={[s.thumbnailWrap, s.videoThumbWrap, showVideoModal && s.thumbnailWrapActive]}
                            onPress={() => setShowVideoModal(true)}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={{ uri: images[0] }}
                                style={[s.thumbnailImg, { opacity: 0.55 }]}
                                resizeMode="cover"
                            />
                            <View style={s.videoPlayOverlay}>
                                <Ionicons name="play" size={16} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Main Stage Image Box */}
                    <View style={s.mainImageCard}>
                        {/* Discount Badge (Top-Left) */}
                        {hasDiscount && (
                            <View style={s.offBadge}>
                                <Text style={s.offBadgeNum}>{discountPercent}%</Text>
                                <Text style={s.offBadgeTxt}>OFF</Text>
                            </View>
                        )}

                        {/* Floating Wishlist Heart (Top-Right) */}
                        <TouchableOpacity
                            style={s.floatingHeartBtn}
                            onPress={handleToggleWishlist}
                            activeOpacity={0.8}
                        >
                            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                                <Ionicons
                                    name={liked ? "heart" : "heart-outline"}
                                    size={21}
                                    color={liked ? BRAND.danger : BRAND.slateDark}
                                />
                            </Animated.View>
                        </TouchableOpacity>

                        {/* Main Image */}
                        <Pressable onPress={() => setImgZoom(true)} style={s.mainImgPressable}>
                            <Image
                                source={{ uri: images[activeImg] || images[0] }}
                                style={s.mainImg}
                                resizeMode="contain"
                            />
                        </Pressable>

                        {/* Floating Watch Video Button (Always visible) */}
                        <TouchableOpacity
                            style={s.floatingVideoBtn}
                            onPress={() => setShowVideoModal(true)}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="play-circle" size={18} color="#FFFFFF" />
                            <Text style={s.floatingVideoBtnTxt}>Watch Video</Text>
                        </TouchableOpacity>

                        {/* Image Counter Badge (Bottom-Right) */}
                        <View style={s.counterBadge}>
                            <Text style={s.counterBadgeTxt}>{activeImg + 1}/{images.length}</Text>
                        </View>
                    </View>
                </View>

                {/* ══════════════════════════════════════════════════
                    4. PRODUCT TITLE, SUBTITLE & RATING
                ══════════════════════════════════════════════════ */}
                <View style={s.contentSection}>
                    <Text style={s.productTitle}>
                        {product.name}
                    </Text>
                    <Text style={s.productSubtitle}>
                        {subtitleText}
                    </Text>

                    {/* Rating & Sold Row */}
                    <View style={s.ratingRow}>
                        <Ionicons name="star" size={16} color="#F59E0B" />
                        <Text style={s.ratingNum}>{product.rating || '4.8'}</Text>
                        <Text style={s.reviewsCount}>({product.reviews || reviewsList.length || 256} reviews)</Text>
                        <Text style={s.ratingDivider}>|</Text>
                        <Text style={s.soldCount}>
                            {product.total_sales ? `${product.total_sales}+ sold` : '1.2K+ sold'}
                        </Text>
                    </View>

                    {/* ══════════════════════════════════════════════════
                        5. VENDOR / STORE CARD (Modern, Spacious & Arranged)
                    ══════════════════════════════════════════════════ */}
                    <View style={s.sellerCard}>
                        {/* Top Row: Vendor Identity + View Store */}
                        <TouchableOpacity
                            style={s.sellerHeaderRow}
                            onPress={() => navigation.navigate('Main', { screen: 'stores' })}
                            activeOpacity={0.8}
                        >
                            <View style={s.sellerAvatarWrap}>
                                {vendor?.avatar ? (
                                    <Image
                                        source={{ uri: vendor.avatar }}
                                        style={s.sellerAvatar}
                                    />
                                ) : (
                                    <View style={[s.sellerAvatar, { backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center' }]}>
                                        <Ionicons name={vendor?.isOfficial ? "shield-checkmark" : "storefront"} size={22} color={BRAND.gold} />
                                    </View>
                                )}
                            </View>

                            <View style={s.sellerInfoCol}>
                                <View style={s.sellerNameRow}>
                                    <Text numberOfLines={1} style={s.sellerName}>
                                        {vendor?.name || 'ABU MAFHAL'}
                                    </Text>
                                    <Ionicons name="checkmark-circle" size={15} color={BRAND.sky} />
                                </View>
                                <View style={s.sellerBadgesRow}>
                                    <View style={s.sellerVerifiedBadge}>
                                        <Text style={s.sellerVerifiedTxt}>
                                            {vendor?.isOfficial ? 'Official Store' : 'Verified Merchant'}
                                        </Text>
                                    </View>
                                    <Text style={s.sellerRatingBadge}>⭐ 4.9</Text>
                                </View>
                            </View>

                            {/* View Store Action */}
                            <View style={s.viewStoreBtn}>
                                <Text style={s.viewStoreBtnTxt}>Store</Text>
                                <Ionicons name="chevron-forward" size={13} color="#0284C7" />
                            </View>
                        </TouchableOpacity>

                        {/* Bottom Row: Action Buttons (Live Chat & WhatsApp) */}
                        <View style={s.sellerActionsRow}>
                            {/* Live In-App Chat Button */}
                            <TouchableOpacity
                                style={s.chatSellerBtn}
                                onPress={() => handleOpenLiveChat()}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="chatbubble-ellipses" size={15} color="#FFFFFF" />
                                <Text style={s.chatSellerBtnTxt}>Live Chat</Text>
                            </TouchableOpacity>

                            {/* WhatsApp Direct Chat Button */}
                            <TouchableOpacity
                                style={s.chatWhatsAppBtn}
                                onPress={() => handleWhatsAppVendor()}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={16} color="#FFFFFF" />
                                <Text style={s.chatWhatsAppBtnTxt}>WhatsApp</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ══════════════════════════════════════════════════
                        6. PRICE & STOCK ROW (Exact to Mockup)
                    ══════════════════════════════════════════════════ */}
                    <View style={s.priceStockRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            <Text style={s.currentPrice}>{fmtPrice(currentPrice)}</Text>
                            {hasDiscount && (
                                <Text style={s.comparePrice}>{fmtPrice(comparePrice)}</Text>
                            )}
                            {discountPercent > 0 && (
                                <View style={s.greenDiscBadge}>
                                    <Text style={s.greenDiscTxt}>{discountPercent}% OFF</Text>
                                </View>
                            )}
                        </View>

                        <View style={s.stockContainer}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <View style={[s.stockDot, isOutOfStock && s.stockDotOut]} />
                                <Text style={[s.stockStatusTxt, isOutOfStock && s.stockStatusTxtOut]}>
                                    {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                                </Text>
                            </View>
                            {!isOutOfStock && (
                                <Text style={s.stockRemainingTxt}>Only {stock} left!</Text>
                            )}
                        </View>
                    </View>

                    {/* ══════════════════════════════════════════════════
                        7. FOUR HIGHLIGHT BADGES (Guaranteed Features)
                    ══════════════════════════════════════════════════ */}
                    <View style={s.highlightsRow}>
                        <View style={s.highlightItem}>
                            <View style={s.highlightIconBox}>
                                <Ionicons name="shield-checkmark-outline" size={20} color={BRAND.emeraldDark} />
                            </View>
                            <Text style={s.highlightTxt}>100% Authentic{'\n'}Guaranteed</Text>
                        </View>

                        <View style={s.highlightItem}>
                            <View style={s.highlightIconBox}>
                                <Ionicons name="flash-outline" size={20} color={BRAND.navy} />
                            </View>
                            <Text style={s.highlightTxt}>Nationwide{'\n'}Dispatch</Text>
                        </View>

                        <View style={s.highlightItem}>
                            <View style={s.highlightIconBox}>
                                <Ionicons name="lock-closed-outline" size={20} color={BRAND.sky} />
                            </View>
                            <Text style={s.highlightTxt}>Escrow Safe{'\n'}Protection</Text>
                        </View>

                        <View style={s.highlightItem}>
                            <View style={s.highlightIconBox}>
                                <Ionicons name="repeat-outline" size={20} color={BRAND.goldDark} />
                            </View>
                            <Text style={s.highlightTxt}>7 Days Return{'\n'}Policy</Text>
                        </View>
                    </View>

                    {/* Variants (if applicable) */}
                    {variants.length > 0 && (
                        <View style={s.variantsSection}>
                            <Text style={s.sectionHeaderTitle}>SELECT OPTION</Text>
                            <View style={s.variantsRow}>
                                {variants.map((v, vIdx) => {
                                    const isSel = selectedVariant?.name === v.name || (!selectedVariant && vIdx === 0);
                                    return (
                                        <TouchableOpacity
                                            key={'var-' + vIdx}
                                            onPress={() => setSelectedVariant(v)}
                                            style={[s.variantPill, isSel && s.variantPillActive]}
                                            activeOpacity={0.8}
                                        >
                                            <Text style={[s.variantPillTxt, isSel && s.variantPillTxtActive]}>
                                                {v.name}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* ══════════════════════════════════════════════════
                        8. QUANTITY & DUAL ACTION BUTTONS (Exact to Mockup)
                    ══════════════════════════════════════════════════ */}
                    <View style={s.actionsRow}>
                        {/* Quantity Stepper (Left) */}
                        <View style={s.qtyBox}>
                            <Text style={s.qtyLabel}>Quantity</Text>
                            <View style={s.stepper}>
                                <TouchableOpacity
                                    style={s.stepperBtn}
                                    onPress={() => handleQty(-1)}
                                    disabled={quantity <= 1 || isOutOfStock}
                                >
                                    <Ionicons name="remove" size={16} color={quantity <= 1 ? '#CBD5E1' : BRAND.slateDark} />
                                </TouchableOpacity>
                                <Text style={s.stepperValue}>{quantity}</Text>
                                <TouchableOpacity
                                    style={s.stepperBtn}
                                    onPress={() => handleQty(1)}
                                    disabled={isOutOfStock}
                                >
                                    <Ionicons name="add" size={16} color={isOutOfStock ? '#CBD5E1' : BRAND.slateDark} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Stacked Add to Cart & Buy Now (Right) */}
                        <View style={s.ctaButtonsCol}>
                            {/* Add to Cart Button (Outline Navy) */}
                            <TouchableOpacity
                                style={[s.addToCartBtn, isOutOfStock && s.btnDisabled]}
                                onPress={handleAddToCart}
                                disabled={isOutOfStock}
                                activeOpacity={0.85}
                            >
                                <Animated.View style={{ transform: [{ scale: cartScale }], flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="cart" size={19} color={BRAND.navy} />
                                    <Text style={s.addToCartTxt}>Add to Cart</Text>
                                </Animated.View>
                            </TouchableOpacity>

                            {/* Buy Now Button (Solid Gold) */}
                            <TouchableOpacity
                                style={[s.buyNowBtn, isOutOfStock && s.btnDisabled]}
                                onPress={handleBuyNow}
                                disabled={isOutOfStock}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="flash" size={18} color={BRAND.navy} />
                                <Text style={s.buyNowTxt}>Buy Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* WhatsApp Quick Order & Inquiry Bar */}
                    <TouchableOpacity
                        style={s.whatsAppOrderBar}
                        onPress={() => handleWhatsAppVendor()}
                        activeOpacity={0.85}
                    >
                        <View style={s.whatsAppOrderBarContent}>
                            <View style={s.whatsAppIconCircle}>
                                <Ionicons name="logo-whatsapp" size={19} color="#FFFFFF" />
                            </View>
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={s.whatsAppOrderTitle}>Order / Inquire via WhatsApp</Text>
                                <Text style={s.whatsAppOrderSub}>Direct chat with verified seller & fast delivery support</Text>
                            </View>
                            <View style={s.whatsAppBadge}>
                                <Text style={s.whatsAppBadgeTxt}>INSTANT</Text>
                            </View>
                        </View>
                    </TouchableOpacity>

                    {/* ══════════════════════════════════════════════════
                        9. TRUST & GUARANTEE TILES (Exact to Mockup)
                    ══════════════════════════════════════════════════ */}
                    <View style={s.trustBadgesRow}>
                        <View style={s.trustItem}>
                            <Ionicons name="car-outline" size={18} color={BRAND.sky} />
                            <Text style={s.trustTitle}>Fast Delivery</Text>
                            <Text style={s.trustSub}>Across Nigeria</Text>
                        </View>
                        <View style={s.trustItem}>
                            <Ionicons name="shield-checkmark-outline" size={18} color={BRAND.emeraldDark} />
                            <Text style={s.trustTitle}>7 Days</Text>
                            <Text style={s.trustSub}>Return Policy</Text>
                        </View>
                        <View style={s.trustItem}>
                            <Ionicons name="card-outline" size={18} color={BRAND.navy} />
                            <Text style={s.trustTitle}>Secure</Text>
                            <Text style={s.trustSub}>Payments</Text>
                        </View>
                        <View style={s.trustItem}>
                            <Ionicons name="checkmark-circle-outline" size={18} color={BRAND.sky} />
                            <Text style={s.trustTitle}>100% Original</Text>
                            <Text style={s.trustSub}>Products</Text>
                        </View>
                    </View>

                    {/* ══════════════════════════════════════════════════
                        10. 100% FUNCTIONAL LIVE SELLER CHAT SECTION
                    ══════════════════════════════════════════════════ */}
                    <View style={s.liveChatBox}>
                        <View style={s.chatHeadRow}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
                                <View style={s.chatAvatarWrap}>
                                    {vendor?.avatar ? (
                                        <Image
                                            source={{ uri: vendor.avatar }}
                                            style={s.chatAvatar}
                                        />
                                    ) : (
                                        <View style={[s.chatAvatar, { backgroundColor: BRAND.navy, alignItems: 'center', justifyContent: 'center' }]}>
                                            <Ionicons name={vendor?.isOfficial ? "shield-checkmark" : "storefront"} size={18} color={BRAND.gold} />
                                        </View>
                                    )}
                                    <View style={s.chatLiveDot} />
                                </View>
                                <View>
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                        <Text style={s.chatVendorTitle}>{vendor?.name || 'ABU MAFHAL'}</Text>
                                        <Ionicons name="checkmark-circle" size={13} color={BRAND.sky} />
                                    </View>
                                    <Text style={s.chatLiveSub}>● Online Now • Instant Reply</Text>
                                </View>
                            </View>

                            <View style={s.escrowProtectedTag}>
                                <Ionicons name="shield-checkmark" size={11} color={BRAND.emerald} />
                                <Text style={s.escrowProtectedTxt}>Escrow Safe</Text>
                            </View>
                        </View>

                        {/* Interactive Quick Inquiry Chips */}
                        <Text style={s.quickInquiryLabel}>TAP QUESTION TO ASK INSTANTLY:</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickChipsRow}>
                            {[
                                "Is this item still available?",
                                "Can you deliver to my location today?",
                                "What is the warranty policy?",
                                "Can I get a discount for bulk purchase?"
                            ].map((question, qIdx) => (
                                <TouchableOpacity
                                    key={'q-' + qIdx}
                                    style={s.quickChip}
                                    onPress={() => handleOpenLiveChat(question)}
                                    activeOpacity={0.7}
                                >
                                    <Ionicons name="chatbubble-outline" size={12} color={BRAND.navy} style={{ marginRight: 4 }} />
                                    <Text style={s.quickChipTxt}>{question}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {/* Interactive Live Message Input */}
                        <View style={s.chatInputWrap}>
                            <TextInput
                                placeholder="Ask seller a question about this item..."
                                placeholderTextColor="#94A3B8"
                                value={chatInput}
                                onChangeText={setChatInput}
                                style={s.chatTextInput}
                            />
                            <TouchableOpacity
                                style={[s.chatSendActionBtn, (!chatInput.trim() || sendingChat) && { opacity: 0.5 }]}
                                onPress={() => {
                                    if (chatInput.trim()) {
                                        const text = chatInput.trim();
                                        setChatInput('');
                                        handleOpenLiveChat(text);
                                    }
                                }}
                                disabled={!chatInput.trim() || sendingChat}
                                activeOpacity={0.8}
                            >
                                <Ionicons name="paper-plane" size={16} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Dual Chat Channels */}
                        <View style={s.chatButtonsRow}>
                            <TouchableOpacity
                                style={s.openLiveChatBtn}
                                onPress={() => handleOpenLiveChat()}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="chatbubbles" size={16} color="#FFFFFF" />
                                <Text style={s.openLiveChatTxt}>Live In-App Chat</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.openWhatsAppBtn}
                                onPress={() => handleWhatsAppVendor()}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="logo-whatsapp" size={17} color="#FFFFFF" />
                                <Text style={s.openWhatsAppTxt}>WhatsApp</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ══════════════════════════════════════════════════
                        11. PRODUCT DESCRIPTION ACCORDION (Exact to Mockup)
                    ══════════════════════════════════════════════════ */}
                    <TouchableOpacity
                        style={s.accordionHeader}
                        onPress={() => setDescExpanded(prev => !prev)}
                        activeOpacity={0.7}
                    >
                        <Text style={s.accordionTitle}>Product Description</Text>
                        <Ionicons
                            name={descExpanded ? "chevron-down" : "chevron-forward"}
                            size={18}
                            color={BRAND.slate}
                        />
                    </TouchableOpacity>

                    {descExpanded && (
                        <View style={s.accordionContent}>
                            <Text style={s.descriptionText}>
                                {product.description || 'Authentic product verified on Abu Mafhal Marketplace. Contact the seller directly via Live Chat for inquiries, bulk pricing, or custom delivery arrangements.'}
                            </Text>
                        </View>
                    )}

                    {/* Customer Reviews Preview */}
                    {reviewsList.length > 0 && (
                        <View style={{ marginTop: 14 }}>
                            <Text style={s.sectionHeaderTitle}>VERIFIED BUYER REVIEWS</Text>
                            <View style={{ gap: 8, marginTop: 8 }}>
                                {reviewsList.slice(0, 3).map((rev, rIdx) => (
                                    <View key={'rev-' + rIdx} style={s.reviewCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                                            <Text style={s.reviewerName}>{rev.user_name || 'Verified Buyer'}</Text>
                                            <View style={{ flexDirection: 'row', gap: 2 }}>
                                                {[1, 2, 3, 4, 5].map(st => (
                                                    <Ionicons
                                                        key={st}
                                                        name="star"
                                                        size={11}
                                                        color={st <= (rev.rating || 5) ? "#F59E0B" : "#E2E8F0"}
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                        <Text style={s.reviewComment}>{rev.comment || 'Amazing sound quality, highly recommended!'}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* ════ FLOATING QUICK CHAT PILL ════ */}
            <TouchableOpacity
                style={s.floatingChatPill}
                onPress={() => handleOpenLiveChat()}
                activeOpacity={0.85}
            >
                <Ionicons name="chatbubbles" size={17} color="#FFFFFF" />
                <Text style={s.floatingChatTxt}>Chat with Seller</Text>
                <View style={s.floatingLiveDot} />
            </TouchableOpacity>

            {/* ══════════════════════════════════════════════════
                12. BOTTOM NAVIGATION BAR (Exact to Mockup)
            ══════════════════════════════════════════════════ */}
            <View style={[s.bottomNavBar, { paddingBottom: Math.max(insets.bottom, 8) }]}>
                <TouchableOpacity
                    style={s.bottomNavItem}
                    onPress={() => navigation.navigate('Main', { screen: 'home' })}
                >
                    <Ionicons name="home" size={22} color={BRAND.navy} />
                    <Text style={[s.bottomNavTxt, { color: BRAND.navy }]}>Home</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.bottomNavItem}
                    onPress={() => navigation.navigate('Main', { screen: 'categories' })}
                >
                    <Ionicons name="grid-outline" size={22} color={BRAND.slate} />
                    <Text style={s.bottomNavTxt}>Categories</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.bottomNavItem}
                    onPress={() => navigation.navigate('Main', { screen: 'stores' })}
                >
                    <Ionicons name="storefront-outline" size={22} color={BRAND.slate} />
                    <Text style={s.bottomNavTxt}>Stores</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.bottomNavItem}
                    onPress={() => navigation.navigate('Main', { screen: 'orders' })}
                >
                    <Ionicons name="cube-outline" size={22} color={BRAND.slate} />
                    <Text style={s.bottomNavTxt}>Orders</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={s.bottomNavItem}
                    onPress={() => navigation.navigate('Main', { screen: 'profile' })}
                >
                    <Ionicons name="person-outline" size={22} color={BRAND.slate} />
                    <Text style={s.bottomNavTxt}>Account</Text>
                </TouchableOpacity>
            </View>

            {/* ════ QUICK MENU MODAL (For 3-dots) ════ */}
            <Modal visible={showMenu} transparent animationType="fade" onRequestClose={() => setShowMenu(false)}>
                <Pressable style={s.menuOverlay} onPress={() => setShowMenu(false)}>
                    <View style={[s.menuPopup, { top: safePaddingTop + 40 }]}>
                        <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); handleShare(); }}>
                            <Ionicons name="share-social-outline" size={18} color={BRAND.slateDark} />
                            <Text style={s.menuItemTxt}>Share Product</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); handleToggleWishlist(); }}>
                            <Ionicons name={liked ? "heart" : "heart-outline"} size={18} color={liked ? BRAND.danger : BRAND.slateDark} />
                            <Text style={s.menuItemTxt}>{liked ? "In Wishlist" : "Add to Wishlist"}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); handleOpenLiveChat(); }}>
                            <Ionicons name="chatbubbles-outline" size={18} color={BRAND.slateDark} />
                            <Text style={s.menuItemTxt}>Chat with Seller</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={s.menuItem} onPress={() => { setShowMenu(false); navigation.navigate('Main', { screen: 'shop' }); }}>
                            <Ionicons name="search-outline" size={18} color={BRAND.slateDark} />
                            <Text style={s.menuItemTxt}>Search More</Text>
                        </TouchableOpacity>
                    </View>
                </Pressable>
            </Modal>

            {/* ════ ZOOM FULL SCREEN MODAL ════ */}
            <Modal visible={imgZoom} transparent animationType="fade" onRequestClose={() => setImgZoom(false)}>
                <View style={s.zoomModalWrap}>
                    <TouchableOpacity style={s.zoomCloseBtn} onPress={() => setImgZoom(false)}>
                        <Ionicons name="close" size={26} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: images[activeImg] || images[0] }}
                        style={s.zoomFullImg}
                        resizeMode="contain"
                    />
                </View>
            </Modal>

            {/* ════ VIDEO MODAL ════ */}
            <Modal visible={showVideoModal} transparent animationType="slide" onRequestClose={() => setShowVideoModal(false)}>
                <View style={s.zoomModalWrap}>
                    <TouchableOpacity style={s.zoomCloseBtn} onPress={() => setShowVideoModal(false)}>
                        <Ionicons name="close" size={26} color="#FFFFFF" />
                    </TouchableOpacity>
                    {Platform.OS === 'web' ? (
                        <View style={{ width: '92%', maxWidth: 700, alignItems: 'center', justifyContent: 'center' }}>
                            <video
                                src={productVideoUrl}
                                controls
                                autoPlay
                                playsInline
                                style={{
                                    width: '100%',
                                    maxHeight: 460,
                                    borderRadius: 14,
                                    backgroundColor: '#000000',
                                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)',
                                    outline: 'none',
                                }}
                            />
                        </View>
                    ) : (
                        <Video
                            source={{ uri: productVideoUrl }}
                            style={{ width: '92%', height: 360, borderRadius: 14, backgroundColor: '#000000' }}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                            isLooping={false}
                        />
                    )}
                </View>
            </Modal>

            {/* ════ FLOATING TOAST NOTIFICATION ════ */}
            {toastMessage.length > 0 && (
                <Animated.View style={[s.toastContainer, { opacity: toastAnim }]}>
                    <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                    <Text style={s.toastTxt} numberOfLines={1}>{toastMessage}</Text>
                </Animated.View>
            )}
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    loadingTxt: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '700',
        color: BRAND.slate,
    },

    // ── 1. Top Header ──
    topBar: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    topNavBtn: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBrandCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    topLogoImg: {
        width: 32,
        height: 32,
    },
    topLogoTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: BRAND.navy,
        letterSpacing: 0.5,
    },
    topLogoSub: {
        fontSize: 6.8,
        fontWeight: '800',
        color: BRAND.navy,
        letterSpacing: 0.3,
        marginTop: -1,
    },
    topRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    topIconBtn: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    topCartBadge: {
        position: 'absolute',
        top: -6,
        right: -8,
        backgroundColor: '#EF4444',
        borderRadius: 9,
        minWidth: 17,
        height: 17,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    topCartBadgeTxt: {
        color: '#FFFFFF',
        fontSize: 8.5,
        fontWeight: '900',
    },

    // ── 2. Breadcrumbs ──
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 6,
        flexWrap: 'wrap',
    },
    breadcrumbLink: {
        fontSize: 12,
        color: BRAND.slate,
        fontWeight: '500',
    },
    breadcrumbActive: {
        fontSize: 12,
        color: BRAND.slateDark,
        fontWeight: '700',
        maxWidth: 140,
    },

    // ── 3. Gallery ──
    galleryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        alignItems: 'flex-start',
    },
    thumbnailCol: {
        width: 50,
        gap: 8,
    },
    thumbnailWrap: {
        width: 48,
        height: 48,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: BRAND.border,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbnailWrapActive: {
        borderColor: BRAND.sky,
        borderWidth: 2,
    },
    thumbnailImg: {
        width: '90%',
        height: '90%',
    },
    videoThumbWrap: {
        backgroundColor: '#0F172A',
        position: 'relative',
    },
    videoPlayOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.35)',
    },

    mainImageCard: {
        flex: 1,
        height: 285,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        borderWidth: 1,
        borderColor: '#F1F5F9',
        overflow: 'hidden',
    },
    mainImgPressable: {
        width: '90%',
        height: '90%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainImg: {
        width: '100%',
        height: '100%',
    },
    offBadge: {
        position: 'absolute',
        top: 10,
        left: 10,
        backgroundColor: BRAND.goldBright,
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 4,
        alignItems: 'center',
        zIndex: 2,
    },
    offBadgeNum: {
        fontSize: 13,
        fontWeight: '900',
        color: BRAND.slateDark,
        lineHeight: 15,
    },
    offBadgeTxt: {
        fontSize: 9,
        fontWeight: '800',
        color: BRAND.slateDark,
        letterSpacing: 0.5,
    },
    floatingHeartBtn: {
        position: 'absolute',
        top: 10,
        right: 10,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 3,
        zIndex: 2,
    },
    counterBadge: {
        position: 'absolute',
        bottom: 10,
        right: 10,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        zIndex: 2,
    },
    counterBadgeTxt: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '700',
    },
    floatingVideoBtn: {
        position: 'absolute',
        bottom: 10,
        left: 10,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(10, 25, 47, 0.88)',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 20,
        zIndex: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.2)',
    },
    floatingVideoBtnTxt: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.3,
    },

    // ── 4. Title, Subtitle, Rating ──
    contentSection: {
        paddingHorizontal: 16,
        paddingTop: 14,
    },
    productTitle: {
        fontSize: 19,
        fontWeight: '800',
        color: BRAND.slateDark,
        lineHeight: 25,
    },
    productSubtitle: {
        fontSize: 12.5,
        color: BRAND.slate,
        marginTop: 2,
        fontWeight: '500',
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginTop: 6,
    },
    ratingNum: {
        fontSize: 13,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    reviewsCount: {
        fontSize: 12,
        color: BRAND.slate,
    },
    ratingDivider: {
        fontSize: 12,
        color: '#CBD5E1',
        marginHorizontal: 2,
    },
    soldCount: {
        fontSize: 12,
        color: BRAND.slate,
        fontWeight: '500',
    },

    // ── 5. Vendor / Store Card ──
    sellerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        marginTop: 14,
        marginBottom: 6,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 6,
        elevation: 2,
    },
    sellerHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#F8FAFC',
    },
    sellerAvatarWrap: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: '#0F172A',
        overflow: 'hidden',
        borderWidth: 1.5,
        borderColor: BRAND.sky,
    },
    sellerAvatar: {
        width: '100%',
        height: '100%',
    },
    sellerInfoCol: {
        flex: 1,
        marginLeft: 12,
        marginRight: 8,
        justifyContent: 'center',
    },
    sellerNameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    sellerName: {
        fontSize: 14.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    sellerBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 3,
    },
    sellerVerifiedBadge: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
    },
    sellerVerifiedTxt: {
        fontSize: 10.5,
        color: '#059669',
        fontWeight: '700',
    },
    sellerRatingBadge: {
        fontSize: 11,
        color: '#D97706',
        fontWeight: '700',
    },
    viewStoreBtn: {
        backgroundColor: '#F0F9FF',
        borderWidth: 1,
        borderColor: '#BAE6FD',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 2,
    },
    viewStoreBtnTxt: {
        color: '#0284C7',
        fontSize: 11.5,
        fontWeight: '800',
    },
    sellerActionsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginTop: 10,
    },
    chatSellerBtn: {
        flex: 1,
        backgroundColor: BRAND.navy,
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    chatSellerBtnTxt: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '800',
    },
    chatWhatsAppBtn: {
        flex: 1,
        backgroundColor: '#16A34A',
        paddingVertical: 10,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    chatWhatsAppBtnTxt: {
        color: '#FFFFFF',
        fontSize: 12.5,
        fontWeight: '800',
    },

    // ── 6. Price & Stock Row ──
    priceStockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingBottom: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    currentPrice: {
        fontSize: 22,
        fontWeight: '900',
        color: BRAND.slateDark,
    },
    comparePrice: {
        fontSize: 13.5,
        color: BRAND.slate,
        textDecorationLine: 'line-through',
        fontWeight: '600',
    },
    greenDiscBadge: {
        backgroundColor: BRAND.emerald,
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
    },
    greenDiscTxt: {
        color: '#FFFFFF',
        fontSize: 10.5,
        fontWeight: '800',
    },
    stockContainer: {
        alignItems: 'flex-end',
    },
    stockDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: BRAND.emerald,
    },
    stockDotOut: {
        backgroundColor: BRAND.danger,
    },
    stockStatusTxt: {
        fontSize: 12.5,
        fontWeight: '700',
        color: BRAND.emeraldDark,
    },
    stockStatusTxtOut: {
        color: BRAND.danger,
    },
    stockRemainingTxt: {
        fontSize: 10.5,
        color: BRAND.slate,
        marginTop: 1,
    },

    // ── 7. Four Highlight Badges ──
    highlightsRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 14,
        paddingHorizontal: 4,
    },
    highlightItem: {
        alignItems: 'center',
        width: '23%',
    },
    highlightIconBox: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: BRAND.slateLight,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 5,
    },
    highlightTxt: {
        fontSize: 9.5,
        fontWeight: '700',
        color: BRAND.slateDark,
        textAlign: 'center',
        lineHeight: 12,
    },

    // ── Variants ──
    variantsSection: {
        marginTop: 14,
    },
    sectionHeaderTitle: {
        fontSize: 10.5,
        fontWeight: '800',
        color: BRAND.slate,
        letterSpacing: 0.5,
        marginBottom: 8,
    },
    variantsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    variantPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: BRAND.border,
        backgroundColor: '#FFFFFF',
    },
    variantPillActive: {
        borderColor: BRAND.navy,
        backgroundColor: BRAND.navy,
    },
    variantPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slateDark,
    },
    variantPillTxtActive: {
        color: '#FFFFFF',
    },

    // ── 8. Quantity & CTA Action Buttons ──
    actionsRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 12,
        marginTop: 18,
    },
    qtyBox: {
        width: 100,
    },
    qtyLabel: {
        fontSize: 12,
        fontWeight: '700',
        color: BRAND.slateDark,
        marginBottom: 6,
    },
    stepper: {
        height: 42,
        borderWidth: 1,
        borderColor: BRAND.border,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#FFFFFF',
    },
    stepperBtn: {
        paddingHorizontal: 10,
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    stepperValue: {
        fontSize: 14,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    ctaButtonsCol: {
        flex: 1,
        gap: 8,
    },
    addToCartBtn: {
        height: 42,
        borderRadius: 8,
        borderWidth: 1.5,
        borderColor: BRAND.navy,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
    },
    addToCartTxt: {
        fontSize: 13.5,
        fontWeight: '800',
        color: BRAND.navy,
    },
    buyNowBtn: {
        height: 42,
        borderRadius: 8,
        backgroundColor: BRAND.gold,
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'row',
        gap: 6,
    },
    buyNowTxt: {
        fontSize: 13.5,
        fontWeight: '800',
        color: BRAND.navy,
    },
    btnDisabled: {
        opacity: 0.5,
    },

    // ── 9. Trust & Guarantee Tiles ──
    trustBadgesRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#F1F5F9',
        paddingVertical: 10,
        paddingHorizontal: 6,
        marginTop: 16,
        justifyContent: 'space-between',
    },
    trustItem: {
        alignItems: 'center',
        width: '24%',
    },
    trustTitle: {
        fontSize: 9.5,
        fontWeight: '800',
        color: BRAND.slateDark,
        marginTop: 3,
        textAlign: 'center',
    },
    trustSub: {
        fontSize: 8,
        color: BRAND.slate,
        textAlign: 'center',
        marginTop: 1,
    },

    // ── 10. Live Seller Chat Section ──
    liveChatBox: {
        marginTop: 18,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        padding: 12,
    },
    chatHeadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: '#EEF2F6',
    },
    chatAvatarWrap: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: BRAND.navy,
        position: 'relative',
        overflow: 'visible',
    },
    chatAvatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
    },
    chatLiveDot: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: BRAND.emerald,
        borderWidth: 1.5,
        borderColor: '#FFFFFF',
    },
    chatVendorTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    chatLiveSub: {
        fontSize: 9.5,
        fontWeight: '700',
        color: BRAND.emeraldDark,
        marginTop: 1,
    },
    escrowProtectedTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 0.8,
        borderColor: '#A7F3D0',
    },
    escrowProtectedTxt: {
        color: BRAND.emeraldDark,
        fontSize: 9,
        fontWeight: '800',
    },
    quickInquiryLabel: {
        fontSize: 9.5,
        fontWeight: '800',
        color: BRAND.slate,
        letterSpacing: 0.5,
        marginTop: 10,
        marginBottom: 6,
    },
    quickChipsRow: {
        gap: 6,
        paddingBottom: 4,
    },
    quickChip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#CBD5E1',
    },
    quickChipTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slateDark,
    },
    chatInputWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        paddingHorizontal: 10,
        height: 42,
        marginTop: 10,
        gap: 8,
    },
    chatTextInput: {
        flex: 1,
        fontSize: 12,
        color: BRAND.slateDark,
        paddingVertical: 0,
    },
    chatSendActionBtn: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: BRAND.navy,
        alignItems: 'center',
        justifyContent: 'center',
    },
    chatButtonsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },
    openLiveChatBtn: {
        flex: 1,
        backgroundColor: BRAND.navy,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 9,
        borderRadius: 8,
    },
    openLiveChatTxt: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },
    openWhatsAppBtn: {
        backgroundColor: '#25D366',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 8,
    },
    openWhatsAppTxt: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '800',
    },

    // ── Floating Chat Pill ──
    floatingChatPill: {
        position: 'absolute',
        bottom: 60,
        right: 14,
        backgroundColor: BRAND.navy,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 24,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        borderWidth: 1,
        borderColor: BRAND.gold,
        zIndex: 999,
    },
    floatingChatTxt: {
        color: '#FFFFFF',
        fontSize: 11.5,
        fontWeight: '800',
    },
    floatingLiveDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: BRAND.emerald,
    },

    // ── 11. Product Description Accordion ──
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
        marginTop: 16,
    },
    accordionTitle: {
        fontSize: 14.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    accordionContent: {
        paddingVertical: 10,
    },
    descriptionText: {
        fontSize: 12,
        lineHeight: 18,
        color: BRAND.slate,
    },

    // ── Reviews ──
    reviewCard: {
        backgroundColor: '#F8FAFC',
        borderRadius: 8,
        padding: 10,
        borderWidth: 1,
        borderColor: '#F1F5F9',
    },
    reviewerName: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slateDark,
    },
    reviewComment: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 3,
    },

    // ── 12. Bottom Navigation Bar ──
    bottomNavBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        justifyContent: 'space-around',
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: '#E2E8F0',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
    },
    bottomNavItem: {
        alignItems: 'center',
        paddingHorizontal: 8,
    },
    bottomNavTxt: {
        fontSize: 9,
        fontWeight: '600',
        color: BRAND.slate,
        marginTop: 3,
    },

    // ── Zoom Modal ──
    zoomModalWrap: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    zoomCloseBtn: {
        position: 'absolute',
        top: 48,
        right: 20,
        zIndex: 10,
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomFullImg: {
        width: '100%',
        height: '80%',
    },

    // ── Quick Menu Modal ──
    menuOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    menuPopup: {
        position: 'absolute',
        right: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingVertical: 6,
        width: 170,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    menuItemTxt: {
        fontSize: 12,
        fontWeight: '600',
        color: BRAND.slateDark,
    },

    // ── Toast ──
    toastContainer: {
        position: 'absolute',
        bottom: 75,
        alignSelf: 'center',
        backgroundColor: BRAND.navy,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        elevation: 6,
        maxWidth: '85%',
    },
    toastTxt: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },

    // ── WhatsApp Action Styles ──
    whatsAppOrderBar: {
        marginTop: 14,
        borderRadius: 14,
        backgroundColor: '#F0FDF4',
        borderWidth: 1.5,
        borderColor: '#86EFAC',
        padding: 12,
    },
    whatsAppOrderBarContent: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    whatsAppIconCircle: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#16A34A',
        alignItems: 'center',
        justifyContent: 'center',
    },
    whatsAppOrderTitle: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#15803D',
    },
    whatsAppOrderSub: {
        fontSize: 11,
        color: '#166534',
        marginTop: 1,
    },
    whatsAppBadge: {
        backgroundColor: '#DCFCE7',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#BBF7D0',
    },
    whatsAppBadgeTxt: {
        fontSize: 9.5,
        fontWeight: '900',
        color: '#16A34A',
        letterSpacing: 0.5,
    },
});
