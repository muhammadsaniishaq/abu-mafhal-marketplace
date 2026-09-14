import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, Animated, StatusBar, Share, Alert,
    ActivityIndicator, StyleSheet, Platform, Modal,
    Linking, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useComparison } from '../context/ComparisonContext';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

const BRAND = {
    navy: '#0A192F',
    navyLight: '#0E223D',
    gold: '#D9A73A',
    goldLight: '#FEF3C7',
    emerald: '#10B981',
    emeraldLight: '#ECFDF5',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    danger: '#EF4444',
};

const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '₦0';
    return `₦${num.toLocaleString()}`;
};

export const ProductDetails = ({ route, navigation, addToCart }) => {
    const initialProduct = route?.params?.product || null;
    const productId = route?.params?.id || route?.params?.productId || initialProduct?.id;

    const insets = useSafeAreaInsets();
    const { addToComparison } = useComparison();

    // ── States ────────────────────────────────────────────────────────────────
    const [product, setProduct] = useState(initialProduct);
    const [activeImg, setActiveImg] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [selectedVariant, setSelectedVariant] = useState(null);
    const [descExpanded, setDescExpanded] = useState(false);
    const [vendor, setVendor] = useState(null);
    const [loadingVend, setLoadingVend] = useState(true);
    const [relatedProducts, setRelatedProducts] = useState([]);
    const [reviewsList, setReviewsList] = useState([]);
    const [loadingReviews, setLoadingReviews] = useState(false);
    const [liked, setLiked] = useState(false);
    const [cartDone, setCartDone] = useState(false);
    const [imgZoom, setImgZoom] = useState(false);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [showMenu, setShowMenu] = useState(false);
    const [refreshing, setRefreshing] = useState(false);

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
                setProduct(data);
                fetchVendor(data);
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

    // ── Fetch Real Vendor / Store Profile ─────────────────────────────────────
    const fetchVendor = async (currentProd) => {
        setLoadingVend(true);
        const vId = currentProd?.vendor_id || currentProd?.user_id;

        // Default Official Store Fallback
        const officialStore = {
            id: 'official',
            name: 'Abu Mafhal Official Store',
            business_name: 'Abu Mafhal Official Store',
            role: 'admin',
            isOfficial: true,
            is_verified: true,
            rating: 5.0,
            reviews: '3.8K',
            phone: '2349021486162',
            whatsapp: '2349021486162',
            avatar: null,
            tagline: 'Official Flagship Mall • 100% Genuine Guaranteed'
        };

        if (!vId || vId === 'admin') {
            setVendor(officialStore);
            setLoadingVend(false);
            return;
        }

        try {
            const { data } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', vId)
                .maybeSingle();

            if (data) {
                const parseAddr = (addr) => {
                    if (!addr || typeof addr !== 'string') return {};
                    try {
                        if (addr.startsWith('{') && addr.endsWith('}')) return JSON.parse(addr);
                    } catch (_) {}
                    return {};
                };
                const vAddr = parseAddr(data.address);

                setVendor({
                    id: data.id,
                    name: data.business_name || data.full_name || 'Verified Merchant',
                    business_name: data.business_name || data.full_name || 'Verified Merchant',
                    role: data.role || 'vendor',
                    isOfficial: data.role === 'admin',
                    is_verified: true,
                    rating: 4.9,
                    reviews: '120+',
                    phone: data.phone || data.phone_number || '2349021486162',
                    whatsapp: vAddr.whatsapp || data.phone || data.phone_number || '2349021486162',
                    avatar: data.avatar_url || null,
                    tagline: vAddr.tagline || 'Verified Marketplace Merchant'
                });
            } else {
                setVendor(officialStore);
            }
        } catch {
            setVendor(officialStore);
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
            await supabase.from('wishlists').upsert({ id: user.id, items: next, updated_at: new Date() });
        } catch {
            setLiked(!liked);
        }
    };

    // ── Calculations & Parsing ────────────────────────────────────────────────
    const currentPrice = Number(selectedVariant?.price || product?.price || 0);
    const comparePrice = Number(product?.compare_at_price || product?.original_price || 0);
    const hasDiscount = comparePrice > currentPrice && currentPrice > 0;
    const discountPercent = hasDiscount ? Math.round(((comparePrice - currentPrice) / comparePrice) * 100) : null;

    const stock = product?.stock_quantity != null ? Number(product.stock_quantity) : (product?.stock != null ? Number(product.stock) : 10);
    const isOutOfStock = stock <= 0;

    // Parse Images cleanly
    const parseImgs = () => {
        const list = [];
        if (product?.image_url) list.push(product.image_url);

        if (Array.isArray(product?.images)) {
            product.images.forEach(img => {
                if (typeof img === 'string' && img && !list.includes(img)) list.push(img);
            });
        } else if (typeof product?.images === 'string') {
            try {
                const parsed = JSON.parse(product.images);
                if (Array.isArray(parsed)) {
                    parsed.forEach(img => { if (img && !list.includes(img)) list.push(img); });
                }
            } catch (_) {
                if (product.images && !list.includes(product.images)) list.push(product.images);
            }
        }

        if (list.length === 0) {
            list.push('https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=600&auto=format&fit=crop');
        }
        return list;
    };

    const images = parseImgs();

    // Parse Variants cleanly
    const variants = (() => {
        const v = product?.metadata?.variants || product?.variants;
        if (Array.isArray(v) && v.length > 0) return v;
        return [];
    })();

    // Parse Specifications
    const specifications = (() => {
        const specs = [];
        specs.push({ key: 'Brand', value: product?.brand || 'Abu Mafhal Verified' });
        specs.push({ key: 'Category', value: product?.category || 'General Department' });
        if (product?.sku) specs.push({ key: 'SKU Code', value: product.sku });
        specs.push({ key: 'Condition', value: 'Brand New / Factory Sealed' });
        specs.push({ key: 'Warranty', value: '12 Months Official Merchant Warranty' });
        if (product?.shipping_weight) specs.push({ key: 'Weight', value: `${product.shipping_weight} kg` });

        // Merge custom specs from metadata
        const customSpecs = product?.metadata?.specifications || product?.specifications;
        if (Array.isArray(customSpecs)) {
            customSpecs.forEach(s => {
                if (s.key && s.value && !specs.some(x => x.key.toLowerCase() === s.key.toLowerCase())) {
                    specs.push({ key: s.key, value: s.value });
                }
            });
        }
        return specs;
    })();

    // ── Cart & Purchase Handlers ──────────────────────────────────────────────
    const handleAddToCart = () => {
        if (!addToCart) return;
        if (isOutOfStock) {
            Alert.alert('Out of Stock', 'This product is currently sold out.');
            return;
        }

        addToCart({
            ...product,
            price: currentPrice,
            selectedVariant: selectedVariant?.name || null
        }, quantity);

        setCartDone(true);
        showToast(`Added ${quantity}x "${product.name}" to cart!`);

        Animated.sequence([
            Animated.spring(cartScale, { toValue: 0.9, useNativeDriver: true, tension: 400 }),
            Animated.spring(cartScale, { toValue: 1, useNativeDriver: true }),
        ]).start();

        setTimeout(() => setCartDone(false), 1600);
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

    const handleWhatsAppVendor = () => {
        const rawPhone = vendor?.whatsapp || vendor?.phone || '2349021486162';
        const phone = rawPhone.replace(/[^0-9]/g, '');
        const msg = encodeURIComponent(
            `Hello ${vendor?.name || 'Seller'}, I am inquiring about "${product?.name}" (${fmtPrice(currentPrice)}) on Abu Mafhal Marketplace. Is it available for express delivery?`
        );
        Linking.openURL(`https://wa.me/${phone}?text=${msg}`).catch(() => {
            Alert.alert('Contact Seller', `Phone: +${phone}`);
        });
    };

    const handleShare = () => {
        Share.share({
            message: `🛍️ Check out "${product?.name}" on Abu Mafhal Marketplace!\n💰 Price: ${fmtPrice(currentPrice)}\n🛡️ 100% Genuine with Buyer Escrow Guarantee.\nShop here: https://abumafhal.com/mobile#product/${product?.id}`,
            title: product?.name
        });
    };

    if (!product) {
        return (
            <View style={s.loadingContainer}>
                <ActivityIndicator size="large" color={BRAND.navy} />
                <Text style={s.loadingTxt}>Loading live product details...</Text>
            </View>
        );
    }

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* ══════════════════════════════════════════════════
                1. TOP LUXURY NAVIGATION BAR
            ══════════════════════════════════════════════════ */}
            <View style={[s.topBar, { paddingTop: Math.max(insets.top, 12) }]}>
                <TouchableOpacity
                    style={s.topNavBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="arrow-back" size={22} color={BRAND.slateDark} />
                </TouchableOpacity>

                <View style={s.topBrandCenter}>
                    <Image source={AM_LOGO} style={s.topLogoImg} resizeMode="contain" />
                    <View>
                        <Text style={s.topLogoTitle}>
                            ABU <Text style={{ color: BRAND.sky }}>MAFHAL</Text>
                        </Text>
                        <Text style={s.topLogoSub}>VERIFIED MARKETPLACE</Text>
                    </View>
                </View>

                <View style={s.topRightActions}>
                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={handleShare}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="share-social-outline" size={21} color={BRAND.slateDark} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={() => navigation.navigate('Main', { screen: 'cart' })}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="cart-outline" size={22} color={BRAND.slateDark} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 130 }}
            >
                {/* ── BREADCRUMB STRIP ── */}
                <View style={s.breadcrumbRow}>
                    <Text style={s.breadcrumbMuted}>Marketplace</Text>
                    <Ionicons name="chevron-forward" size={11} color="#94A3B8" />
                    <Text style={s.breadcrumbMuted}>{product.category || 'General'}</Text>
                    <Ionicons name="chevron-forward" size={11} color="#94A3B8" />
                    <Text style={s.breadcrumbActive} numberOfLines={1}>
                        {product.name}
                    </Text>
                </View>

                {/* ══════════════════════════════════════════════════
                    2. DUAL-PANE IMAGE GALLERY (Thumbnails + Main Stage)
                ══════════════════════════════════════════════════ */}
                <View style={s.galleryContainer}>
                    {/* Left Thumbnails Column (if more than 1 image) */}
                    {images.length > 1 && (
                        <View style={s.thumbnailCol}>
                            {images.slice(0, 5).map((uri, idx) => (
                                <TouchableOpacity
                                    key={'thumb-' + idx}
                                    style={[s.thumbnailWrap, activeImg === idx && s.thumbnailWrapActive]}
                                    onPress={() => setActiveImg(idx)}
                                    activeOpacity={0.8}
                                >
                                    <Image source={{ uri }} style={s.thumbnailImg} resizeMode="contain" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}

                    {/* Main Stage Image Card */}
                    <View style={s.mainImageCard}>
                        {/* Discount Ribbon */}
                        {hasDiscount && (
                            <View style={s.discountBadge}>
                                <Text style={s.discountTxt}>-{discountPercent}%</Text>
                                <Text style={s.discountSub}>OFF</Text>
                            </View>
                        )}

                        {/* Floating Wishlist Heart */}
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

                        {/* Tap to Zoom Stage */}
                        <Pressable
                            onPress={() => setImgZoom(true)}
                            style={s.mainImgPressable}
                        >
                            <Image
                                source={{ uri: images[activeImg] || images[0] }}
                                style={s.mainImg}
                                resizeMode="contain"
                            />
                        </Pressable>

                        {/* Image Counter Badge */}
                        <View style={s.counterBadge}>
                            <Ionicons name="images-outline" size={11} color="#FFFFFF" style={{ marginRight: 3 }} />
                            <Text style={s.counterBadgeTxt}>{activeImg + 1}/{images.length}</Text>
                        </View>
                    </View>
                </View>

                {/* ══════════════════════════════════════════════════
                    3. PRODUCT INFORMATION & PRICING
                ══════════════════════════════════════════════════ */}
                <View style={s.contentSection}>
                    {/* Department / Category Pill */}
                    <View style={s.categoryPillRow}>
                        <View style={s.categoryPill}>
                            <Text style={s.categoryPillTxt}>{product.category || 'General'}</Text>
                        </View>
                        {product.brand && (
                            <View style={s.brandPill}>
                                <Text style={s.brandPillTxt}>Brand: {product.brand}</Text>
                            </View>
                        )}
                    </View>

                    {/* Product Name */}
                    <Text style={s.productTitle}>
                        {product.name}
                    </Text>

                    {/* Rating & Sold Micro-Row */}
                    <View style={s.ratingRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3 }}>
                            <Ionicons name="star" size={15} color="#F59E0B" />
                            <Text style={s.ratingNum}>{product.rating || '4.9'}</Text>
                        </View>
                        <Text style={s.reviewsCount}>({product.reviews || reviewsList.length || 18} reviews)</Text>
                        <Text style={s.ratingDivider}>•</Text>
                        <Text style={s.soldCount}>
                            {product.total_sales ? `${product.total_sales}+ sold` : 'Verified Authentic'}
                        </Text>
                    </View>

                    {/* ── PRICE & STOCK ROW ── */}
                    <View style={s.priceStockRow}>
                        <View>
                            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                                <Text style={s.currentPrice}>{fmtPrice(currentPrice)}</Text>
                                {hasDiscount && (
                                    <Text style={s.comparePrice}>{fmtPrice(comparePrice)}</Text>
                                )}
                            </View>
                            {hasDiscount && (
                                <Text style={s.saveAmountTxt}>
                                    You save {fmtPrice(comparePrice - currentPrice)} ({discountPercent}% off)
                                </Text>
                            )}
                        </View>

                        {/* Stock Status Badge */}
                        <View style={s.stockBox}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <View style={[s.stockDot, isOutOfStock && s.stockDotOut]} />
                                <Text style={[s.stockStatusTxt, isOutOfStock && s.stockStatusTxtOut]}>
                                    {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                                </Text>
                            </View>
                            {!isOutOfStock && stock <= 5 && (
                                <Text style={s.lowStockAlert}>Only {stock} left!</Text>
                            )}
                        </View>
                    </View>

                    {/* ── REAL SELLER / STORE CARD ── */}
                    <View style={s.sellerCard}>
                        <View style={s.sellerAvatarWrap}>
                            {vendor?.avatar ? (
                                <Image source={{ uri: vendor.avatar }} style={s.sellerAvatar} />
                            ) : vendor?.isOfficial ? (
                                <Image source={AM_LOGO} style={s.sellerAvatar} resizeMode="contain" />
                            ) : (
                                <View style={[s.sellerAvatar, { backgroundColor: BRAND.skyLight, alignItems: 'center', justifyContent: 'center' }]}>
                                    <Ionicons name="storefront" size={20} color={BRAND.sky} />
                                </View>
                            )}
                            {vendor?.is_verified && (
                                <View style={s.sellerCheckBadge}>
                                    <Ionicons name="checkmark-sharp" size={8} color="#FFFFFF" />
                                </View>
                            )}
                        </View>

                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Text numberOfLines={1} style={s.sellerName}>
                                    {vendor?.name || 'Abu Mafhal Official Store'}
                                </Text>
                            </View>
                            <Text numberOfLines={1} style={s.sellerTagline}>
                                {vendor?.tagline || 'Verified Marketplace Merchant'}
                            </Text>
                        </View>

                        {/* WhatsApp Vendor Contact Button */}
                        <TouchableOpacity
                            onPress={handleWhatsAppVendor}
                            style={s.sellerWhatsAppBtn}
                            activeOpacity={0.8}
                        >
                            <Ionicons name="logo-whatsapp" size={15} color="#10B981" />
                            <Text style={s.sellerWhatsAppTxt}>Chat</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={s.viewStoreBtn}
                            onPress={() => navigation.navigate('Main', { screen: 'stores' })}
                            activeOpacity={0.8}
                        >
                            <Text style={s.viewStoreBtnTxt}>Store</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── VARIANTS SELECTION (Color / Size) ── */}
                    {variants.length > 0 && (
                        <View style={s.variantsSection}>
                            <Text style={s.sectionHeaderTitle}>
                                SELECT VARIANT / OPTION
                            </Text>
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
                                            {v.price && (
                                                <Text style={[s.variantPriceTxt, isSel && s.variantPriceTxtActive]}>
                                                    {fmtPrice(v.price)}
                                                </Text>
                                            )}
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}

                    {/* ── QUANTITY STEPPER & ACTION BUTTONS ── */}
                    <View style={s.actionRowContainer}>
                        <View style={s.qtySection}>
                            <Text style={s.qtyHeading}>Quantity</Text>
                            <View style={s.qtyStepper}>
                                <TouchableOpacity
                                    style={s.qtyBtn}
                                    onPress={() => handleQty(-1)}
                                    disabled={quantity <= 1 || isOutOfStock}
                                >
                                    <Ionicons name="remove" size={16} color={quantity <= 1 ? '#CBD5E1' : BRAND.slateDark} />
                                </TouchableOpacity>
                                <Text style={s.qtyValue}>{quantity}</Text>
                                <TouchableOpacity
                                    style={s.qtyBtn}
                                    onPress={() => handleQty(1)}
                                    disabled={isOutOfStock}
                                >
                                    <Ionicons name="add" size={16} color={isOutOfStock ? '#CBD5E1' : BRAND.slateDark} />
                                </TouchableOpacity>
                            </View>
                        </View>

                        <View style={s.dualButtonsWrap}>
                            <TouchableOpacity
                                style={[s.addToCartBtn, cartDone && s.addToCartBtnDone, isOutOfStock && s.btnDisabled]}
                                onPress={handleAddToCart}
                                disabled={isOutOfStock}
                                activeOpacity={0.85}
                            >
                                <Animated.View style={{ transform: [{ scale: cartScale }], flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                    <Ionicons
                                        name={cartDone ? "checkmark-circle" : "cart"}
                                        size={18}
                                        color={cartDone ? "#10B981" : "#FFFFFF"}
                                    />
                                    <Text style={[s.addToCartTxt, cartDone && { color: '#10B981' }]}>
                                        {cartDone ? "Added to Cart!" : isOutOfStock ? "Out of Stock" : "Add to Cart"}
                                    </Text>
                                </Animated.View>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[s.buyNowBtn, isOutOfStock && s.btnDisabled]}
                                onPress={handleBuyNow}
                                disabled={isOutOfStock}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="flash" size={16} color="#0A192F" />
                                <Text style={s.buyNowTxt}>Buy Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── 4 TRUST & GUARANTEE TILES ── */}
                    <View style={s.trustBadgesRow}>
                        <View style={s.trustItem}>
                            <Ionicons name="shield-checkmark" size={18} color={BRAND.sky} />
                            <Text style={s.trustTitle}>Buyer Escrow</Text>
                            <Text style={s.trustSub}>Money Protected</Text>
                        </View>
                        <View style={s.trustItem}>
                            <Ionicons name="sync" size={18} color={BRAND.emerald} />
                            <Text style={s.trustTitle}>7 Days</Text>
                            <Text style={s.trustSub}>Return Policy</Text>
                        </View>
                        <View style={s.trustItem}>
                            <Ionicons name="rocket-outline" size={18} color={BRAND.gold} />
                            <Text style={s.trustTitle}>Express</Text>
                            <Text style={s.trustSub}>Nationwide</Text>
                        </View>
                        <View style={s.trustItem}>
                            <Ionicons name="ribbon-outline" size={18} color={BRAND.sky} />
                            <Text style={s.trustTitle}>100% Genuine</Text>
                            <Text style={s.trustSub}>Direct Sourced</Text>
                        </View>
                    </View>

                    {/* ── PRODUCT DESCRIPTION ACCORDION ── */}
                    <TouchableOpacity
                        style={s.accordionHeader}
                        onPress={() => setDescExpanded(prev => !prev)}
                        activeOpacity={0.7}
                    >
                        <Text style={s.accordionTitle}>Product Description & Specifications</Text>
                        <Ionicons
                            name={descExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={BRAND.slateDark}
                        />
                    </TouchableOpacity>

                    {descExpanded && (
                        <View style={s.accordionContent}>
                            <Text style={s.descriptionText}>
                                {product.description || 'Authentic product verified by Abu Mafhal Marketplace. Genuine brand warranty and premium quality guaranteed.'}
                            </Text>

                            {/* Specifications Table */}
                            <View style={s.specsTable}>
                                {specifications.map((spec, sIdx) => (
                                    <View key={'spec-' + sIdx} style={[s.specRow, sIdx % 2 === 1 && { backgroundColor: '#FFFFFF' }]}>
                                        <Text style={s.specLabel}>{spec.key}</Text>
                                        <Text style={s.specVal}>{spec.value}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── CUSTOMER REVIEWS SECTION ── */}
                    <View style={s.reviewsSection}>
                        <View style={s.reviewsHeadRow}>
                            <Text style={s.sectionHeaderTitle}>
                                CUSTOMER REVIEWS ({product.reviews || reviewsList.length || 0})
                            </Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                <Ionicons name="star" size={14} color="#F59E0B" />
                                <Text style={{ fontSize: 13, fontWeight: '800', color: BRAND.slateDark }}>
                                    {product.rating || '4.9'} / 5.0
                                </Text>
                            </View>
                        </View>

                        {reviewsList.length === 0 ? (
                            <View style={s.emptyReviewsBox}>
                                <Text style={s.emptyReviewsTxt}>
                                    ⭐ Rated {product.rating || '5.0'} by verified marketplace buyers.
                                </Text>
                                <Text style={s.emptyReviewsSub}>
                                    Authentic purchases are protected by Abu Mafhal Buyer Guarantee.
                                </Text>
                            </View>
                        ) : (
                            <View style={{ gap: 8 }}>
                                {reviewsList.map((rev, rIdx) => (
                                    <View key={'rev-' + rIdx} style={s.reviewCard}>
                                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
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
                                        <Text style={s.reviewComment}>{rev.comment || 'Excellent product, works perfectly!'}</Text>
                                    </View>
                                ))}
                            </View>
                        )}
                    </View>

                    {/* ── RELATED PRODUCTS SECTION ── */}
                    {relatedProducts.length > 0 && (
                        <View style={s.relatedSection}>
                            <Text style={s.sectionHeaderTitle}>
                                RELATED IN {product.category?.toUpperCase() || 'THIS DEPARTMENT'}
                            </Text>

                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ gap: 10, paddingVertical: 4 }}
                            >
                                {relatedProducts.map((rel) => (
                                    <TouchableOpacity
                                        key={'rel-' + rel.id}
                                        activeOpacity={0.88}
                                        onPress={() => navigation.push('ProductDetails', { product: rel, id: rel.id })}
                                        style={s.relatedCard}
                                    >
                                        <View style={s.relatedImgWrap}>
                                            <Image
                                                source={{ uri: rel.image_url || (Array.isArray(rel.images) ? rel.images[0] : 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=400') }}
                                                style={s.relatedImg}
                                                resizeMode="contain"
                                            />
                                        </View>
                                        <Text numberOfLines={1} style={s.relatedName}>{rel.name}</Text>
                                        <Text style={s.relatedPrice}>{fmtPrice(rel.price)}</Text>
                                    </TouchableOpacity>
                                ))}
                            </ScrollView>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* ════ ZOOM FULL SCREEN MODAL ════ */}
            <Modal visible={imgZoom} transparent animationType="fade" onRequestClose={() => setImgZoom(false)}>
                <View style={s.zoomModalWrap}>
                    <TouchableOpacity style={s.zoomCloseBtn} onPress={() => setImgZoom(false)}>
                        <Ionicons name="close" size={24} color="#FFFFFF" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: images[activeImg] || images[0] }}
                        style={s.zoomFullImg}
                        resizeMode="contain"
                    />
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
    // Top Bar
    topBar: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    topNavBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    topBrandCenter: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topLogoImg: {
        width: 30,
        height: 30,
    },
    topLogoTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: BRAND.navy,
        letterSpacing: 0.5,
    },
    topLogoSub: {
        fontSize: 7,
        fontWeight: '800',
        color: BRAND.slate,
        letterSpacing: 0.5,
    },
    topRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topIconBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Breadcrumb
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 8,
        backgroundColor: '#F8FAFC',
    },
    breadcrumbMuted: {
        fontSize: 11,
        color: BRAND.slate,
        fontWeight: '600',
    },
    breadcrumbActive: {
        fontSize: 11,
        color: BRAND.slateDark,
        fontWeight: '800',
        flexShrink: 1,
    },
    // Gallery
    galleryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 10,
        paddingTop: 12,
        marginBottom: 14,
    },
    thumbnailCol: {
        width: 52,
        gap: 8,
    },
    thumbnailWrap: {
        width: 52,
        height: 52,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 3,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbnailWrapActive: {
        borderColor: BRAND.sky,
        borderWidth: 2,
        backgroundColor: BRAND.skyLight,
    },
    thumbnailImg: {
        width: '100%',
        height: '100%',
    },
    mainImageCard: {
        flex: 1,
        height: 290,
        backgroundColor: '#F8FAFC',
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        padding: 12,
    },
    discountBadge: {
        position: 'absolute',
        top: 12,
        left: 12,
        backgroundColor: BRAND.gold,
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        alignItems: 'center',
        zIndex: 2,
    },
    discountTxt: {
        color: BRAND.navy,
        fontSize: 12,
        fontWeight: '900',
        lineHeight: 13,
    },
    discountSub: {
        color: BRAND.navy,
        fontSize: 8,
        fontWeight: '900',
    },
    floatingHeartBtn: {
        position: 'absolute',
        top: 12,
        right: 12,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
        zIndex: 2,
    },
    mainImgPressable: {
        width: '100%',
        height: '92%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mainImg: {
        width: '100%',
        height: '100%',
    },
    counterBadge: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        backgroundColor: 'rgba(10, 25, 47, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
    },
    counterBadgeTxt: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    // Content Section
    contentSection: {
        paddingHorizontal: 16,
    },
    categoryPillRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 6,
    },
    categoryPill: {
        backgroundColor: BRAND.skyLight,
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 6,
    },
    categoryPillTxt: {
        color: BRAND.sky,
        fontSize: 9.5,
        fontWeight: '900',
        textTransform: 'uppercase',
    },
    brandPill: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 6,
    },
    brandPillTxt: {
        color: BRAND.slateDark,
        fontSize: 9.5,
        fontWeight: '700',
    },
    productTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: BRAND.slateDark,
        lineHeight: 25,
        marginBottom: 6,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 14,
    },
    ratingNum: {
        fontSize: 13,
        fontWeight: '900',
        color: BRAND.slateDark,
    },
    reviewsCount: {
        fontSize: 12,
        color: BRAND.slate,
        fontWeight: '600',
    },
    ratingDivider: {
        fontSize: 10,
        color: '#CBD5E1',
    },
    soldCount: {
        fontSize: 12,
        color: BRAND.emerald,
        fontWeight: '700',
    },
    // Price & Stock
    priceStockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 14,
    },
    currentPrice: {
        fontSize: 22,
        fontWeight: '900',
        color: BRAND.navy,
    },
    comparePrice: {
        fontSize: 13,
        color: BRAND.slate,
        textDecorationLine: 'line-through',
        fontWeight: '600',
    },
    saveAmountTxt: {
        fontSize: 10.5,
        color: BRAND.emerald,
        fontWeight: '800',
        marginTop: 2,
    },
    stockBox: {
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
        fontSize: 12,
        fontWeight: '800',
        color: BRAND.emerald,
    },
    stockStatusTxtOut: {
        color: BRAND.danger,
    },
    lowStockAlert: {
        fontSize: 10,
        color: BRAND.danger,
        fontWeight: '700',
        marginTop: 2,
    },
    // Seller Card
    sellerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    sellerAvatarWrap: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: BRAND.navy,
        overflow: 'hidden',
        position: 'relative',
    },
    sellerAvatar: {
        width: '100%',
        height: '100%',
    },
    sellerCheckBadge: {
        position: 'absolute',
        bottom: 0,
        right: 0,
        backgroundColor: BRAND.sky,
        borderRadius: 6,
        width: 12,
        height: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sellerName: {
        fontSize: 13,
        fontWeight: '900',
        color: BRAND.slateDark,
    },
    sellerTagline: {
        fontSize: 10.5,
        color: BRAND.slate,
        marginTop: 1,
    },
    sellerWhatsAppBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#A7F3D0',
        marginRight: 6,
    },
    sellerWhatsAppTxt: {
        color: '#065F46',
        fontSize: 11,
        fontWeight: '800',
    },
    viewStoreBtn: {
        backgroundColor: BRAND.navy,
        paddingHorizontal: 11,
        paddingVertical: 6,
        borderRadius: 10,
    },
    viewStoreBtnTxt: {
        color: '#FFFFFF',
        fontSize: 11,
        fontWeight: '800',
    },
    // Variants Section
    variantsSection: {
        marginBottom: 16,
    },
    sectionHeaderTitle: {
        fontSize: 11,
        fontWeight: '900',
        color: BRAND.slate,
        letterSpacing: 0.5,
        textTransform: 'uppercase',
        marginBottom: 8,
    },
    variantsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    variantPill: {
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
    },
    variantPillActive: {
        backgroundColor: BRAND.navy,
        borderColor: BRAND.navy,
    },
    variantPillTxt: {
        fontSize: 12,
        fontWeight: '700',
        color: BRAND.slateDark,
    },
    variantPillTxtActive: {
        color: '#FFFFFF',
    },
    variantPriceTxt: {
        fontSize: 10,
        color: BRAND.slate,
        marginTop: 1,
    },
    variantPriceTxtActive: {
        color: BRAND.gold,
    },
    // Action Row
    actionRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 18,
    },
    qtySection: {
        alignItems: 'center',
    },
    qtyHeading: {
        fontSize: 10,
        fontWeight: '700',
        color: BRAND.slate,
        marginBottom: 3,
    },
    qtyStepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 44,
        paddingHorizontal: 4,
    },
    qtyBtn: {
        width: 28,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyValue: {
        fontSize: 14,
        fontWeight: '900',
        color: BRAND.slateDark,
        paddingHorizontal: 6,
    },
    dualButtonsWrap: {
        flex: 1,
        gap: 6,
    },
    addToCartBtn: {
        height: 42,
        borderRadius: 12,
        backgroundColor: BRAND.navy,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: BRAND.navy,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
        elevation: 2,
    },
    addToCartBtnDone: {
        backgroundColor: '#ECFDF5',
        borderWidth: 1,
        borderColor: BRAND.emerald,
    },
    addToCartTxt: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    buyNowBtn: {
        height: 38,
        borderRadius: 12,
        backgroundColor: BRAND.gold,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    buyNowTxt: {
        fontSize: 12.5,
        fontWeight: '900',
        color: BRAND.navy,
    },
    btnDisabled: {
        backgroundColor: '#CBD5E1',
    },
    // Trust Badges
    trustBadgesRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 12,
        paddingHorizontal: 4,
        marginBottom: 16,
    },
    trustItem: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    trustTitle: {
        fontSize: 9.5,
        fontWeight: '900',
        color: BRAND.slateDark,
        textAlign: 'center',
        marginTop: 3,
    },
    trustSub: {
        fontSize: 8,
        color: BRAND.slate,
        textAlign: 'center',
    },
    // Accordion
    accordionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        borderTopWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#F1F5F9',
        marginBottom: 12,
    },
    accordionTitle: {
        fontSize: 13.5,
        fontWeight: '900',
        color: BRAND.slateDark,
    },
    accordionContent: {
        paddingBottom: 14,
    },
    descriptionText: {
        fontSize: 13,
        lineHeight: 20,
        color: '#475569',
        marginBottom: 12,
    },
    specsTable: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        overflow: 'hidden',
    },
    specRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    specLabel: {
        fontSize: 11.5,
        color: BRAND.slate,
        fontWeight: '600',
    },
    specVal: {
        fontSize: 11.5,
        color: BRAND.slateDark,
        fontWeight: '800',
    },
    // Reviews
    reviewsSection: {
        marginTop: 10,
        marginBottom: 16,
    },
    reviewsHeadRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    emptyReviewsBox: {
        backgroundColor: '#F8FAFC',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    emptyReviewsTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    emptyReviewsSub: {
        fontSize: 10.5,
        color: BRAND.slate,
        marginTop: 2,
    },
    reviewCard: {
        backgroundColor: '#F8FAFC',
        padding: 10,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    reviewerName: {
        fontSize: 11.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    reviewComment: {
        fontSize: 12,
        color: '#475569',
        marginTop: 4,
    },
    // Related
    relatedSection: {
        marginTop: 10,
        marginBottom: 20,
    },
    relatedCard: {
        width: 125,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 8,
    },
    relatedImgWrap: {
        width: '100%',
        height: 90,
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        overflow: 'hidden',
        marginBottom: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    relatedImg: {
        width: '100%',
        height: '100%',
    },
    relatedName: {
        fontSize: 11,
        fontWeight: '700',
        color: BRAND.slateDark,
        marginBottom: 2,
    },
    relatedPrice: {
        fontSize: 12,
        fontWeight: '900',
        color: BRAND.navy,
    },
    // Zoom Modal
    zoomModalWrap: {
        flex: 1,
        backgroundColor: 'rgba(10, 25, 47, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomCloseBtn: {
        position: 'absolute',
        top: 50,
        right: 20,
        padding: 8,
        zIndex: 10,
    },
    zoomFullImg: {
        width: width - 24,
        height: 420,
    },
    // Toast
    toastContainer: {
        position: 'absolute',
        bottom: 85,
        left: 20,
        right: 20,
        backgroundColor: BRAND.navy,
        borderRadius: 14,
        paddingVertical: 12,
        paddingHorizontal: 16,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
        elevation: 8,
        zIndex: 9999,
    },
    toastTxt: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
        flex: 1,
    },
});
