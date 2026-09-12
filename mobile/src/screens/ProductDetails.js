import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, Animated, StatusBar, Share, Alert,
    ActivityIndicator, StyleSheet, Platform, Modal,
    Clipboard, Linking, Pressable
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useComparison } from '../context/ComparisonContext';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '—';
    return `₦${num.toLocaleString()}`;
};

export const ProductDetails = ({ route, navigation, addToCart }) => {
    const { product } = route.params || {};
    const insets = useSafeAreaInsets();
    const { addToComparison, isInComparison } = useComparison();

    // ── State ─────────────────────────────────────────────────────────────────
    const [activeImg, setActiveImg] = useState(0);
    const [quantity, setQuantity] = useState(1);
    const [descExpanded, setDescExpanded] = useState(false);
    const [validVideo, setValidVideo] = useState(null);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const [vendor, setVendor] = useState(null);
    const [loadingVend, setLoadingVend] = useState(true);
    const [liked, setLiked] = useState(false);
    const [cartDone, setCartDone] = useState(false);
    const [imgZoom, setImgZoom] = useState(false);
    const [showMenu, setShowMenu] = useState(false);

    const heartScale = useRef(new Animated.Value(1)).current;
    const cartScale = useRef(new Animated.Value(1)).current;

    // ── Calculations ──────────────────────────────────────────────────────────
    const origP = Number(product?.compare_at_price || (product?.price ? product.price * 1.35 : 62000));
    const finalP = Number(product?.price || 45000);
    const calcDiscount = origP > finalP ? Math.round(((origP - finalP) / origP) * 100) : 28;
    const discountPercent = product?.discount || calcDiscount || 28;

    const stock = product?.stock_quantity != null ? Number(product.stock_quantity) : (product?.stock != null ? Number(product.stock) : 12);
    const isOutOfStock = stock === 0;

    const getImgs = (imgs) => {
        if (!imgs) return [];
        if (Array.isArray(imgs)) return imgs.filter(Boolean);
        try {
            const p = JSON.parse(imgs);
            return Array.isArray(p) ? p.filter(Boolean) : [imgs];
        } catch {
            return [imgs];
        }
    };

    const parsedImages = getImgs(product?.images);
    const defaultHeadphones = [
        'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1484704849700-f032a568e944?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1546435770-a3e426bf472b?q=80&w=800&auto=format&fit=crop',
        'https://images.unsplash.com/photo-1583394838336-acd977736f90?q=80&w=800&auto=format&fit=crop',
    ];
    const images = parsedImages.length > 0 ? parsedImages : defaultHeadphones;

    useEffect(() => {
        fetchVendor();
        validateVideo();
        checkWishlist();
    }, [product?.id]);

    const fetchVendor = async () => {
        setLoadingVend(true);
        const vId = product?.vendor_id || product?.user_id || product?.owner_id;
        if (!vId || vId === 'admin') {
            setVendor({
                id: 'admin',
                full_name: 'TechWorld Store',
                role: 'Vendor',
                is_verified: true,
                avatar_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop'
            });
            setLoadingVend(false);
            return;
        }
        try {
            const { data } = await supabase.from('profiles').select('*').eq('id', vId).maybeSingle();
            if (data) {
                setVendor({
                    ...data,
                    full_name: data.store_name || data.full_name || 'TechWorld Store',
                    is_verified: true,
                });
            } else {
                setVendor({
                    id: vId,
                    full_name: 'TechWorld Store',
                    is_verified: true,
                });
            }
        } catch {
            setVendor({
                id: 'admin',
                full_name: 'TechWorld Store',
                is_verified: true,
            });
        } finally {
            setLoadingVend(false);
        }
    };

    const validateVideo = async () => {
        let uri = product?.video_url || product?.metadata?.video;
        if (uri && typeof uri === 'string') {
            setValidVideo(uri);
        }
    };

    const checkWishlist = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('wishlists').select('items').eq('id', user.id).maybeSingle();
            if (data?.items) setLiked(data.items.includes(product?.id));
        } catch {}
    };

    const handleLike = async () => {
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, tension: 400 }),
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
            const next = liked ? curr.filter(i => i !== product.id) : [...curr, product.id];
            setLiked(!liked);
            await supabase.from('wishlists').upsert({ id: user.id, items: next, updated_at: new Date() });
        } catch {
            setLiked(!liked);
        }
    };

    const handleAddToCart = () => {
        if (!addToCart) return;
        if (isOutOfStock) {
            Alert.alert('Out of Stock', 'This item is currently out of stock.');
            return;
        }
        addToCart({ ...product, price: finalP }, quantity);
        setCartDone(true);
        Animated.sequence([
            Animated.spring(cartScale, { toValue: 0.9, useNativeDriver: true, tension: 400 }),
            Animated.spring(cartScale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        setTimeout(() => setCartDone(false), 1200);
    };

    const handleBuyNow = () => {
        if (!addToCart) return;
        if (isOutOfStock) {
            Alert.alert('Out of Stock', 'This item is currently out of stock.');
            return;
        }
        addToCart({ ...product, price: finalP }, quantity);
        navigation.navigate('Main', { screen: 'cart' });
    };

    const handleQty = (delta) => {
        const next = quantity + delta;
        if (next < 1) return;
        if (stock != null && next > stock) {
            Alert.alert('Max Stock', `Only ${stock} units available.`);
            return;
        }
        setQuantity(next);
    };

    const handleShare = () => {
        Share.share({
            message: `🛍️ Check out "${product?.name || 'Wireless Headphones Pro Max'}" on Abu Mafhal Marketplace!\n💰 Price: ${fmtPrice(finalP)}\n📱 Shop now on Abu Mafhal`,
        });
    };

    if (!product) {
        return (
            <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
                <ActivityIndicator size="large" color="#0A192F" />
            </View>
        );
    }

    return (
        <View style={s.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

            {/* ── TOP BAR (Matching Screenshot 3) ── */}
            <View style={[s.topBar, { paddingTop: Math.max(insets.top, 14) }]}>
                <TouchableOpacity
                    style={s.topBarBtn}
                    onPress={() => navigation.goBack()}
                    activeOpacity={0.7}
                >
                    <Ionicons name="menu-outline" size={26} color="#0F172A" />
                </TouchableOpacity>

                {/* Abu Mafhal Center Logo */}
                <View style={s.topBarLogoWrap}>
                    <Image source={AM_LOGO} style={s.topLogoImg} resizeMode="contain" />
                    <View style={{ alignItems: 'flex-start' }}>
                        <Text style={s.topLogoTitle}>
                            ABU <Text style={{ color: '#00D2FF' }}>MAFHAL</Text>
                        </Text>
                        <Text style={s.topLogoSubtitle}>YOUR MARKETPLACE, YOUR CHOICE.</Text>
                    </View>
                </View>

                {/* Top Right Actions */}
                <View style={s.topRightActions}>
                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={() => navigation.navigate('Main', { screen: 'shop' })}
                    >
                        <Ionicons name="search-outline" size={22} color="#0F172A" />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={() => navigation.navigate('Main', { screen: 'cart' })}
                    >
                        <Ionicons name="cart-outline" size={22} color="#0F172A" />
                        <View style={s.cartBadge}>
                            <Text style={s.cartBadgeTxt}>3</Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={s.topIconBtn}
                        onPress={() => setShowMenu(prev => !prev)}
                    >
                        <Ionicons name="ellipsis-vertical" size={20} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Dropdown Menu Modal */}
            {showMenu && (
                <View style={s.menuPopup}>
                    <TouchableOpacity style={s.menuItem} onPress={handleShare}>
                        <Ionicons name="share-social-outline" size={18} color="#0F172A" />
                        <Text style={s.menuItemTxt}>Share Product</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={s.menuItem}
                        onPress={() => {
                            addToComparison(product);
                            setShowMenu(false);
                            Alert.alert('Comparison', 'Added to product comparison list.');
                        }}
                    >
                        <Ionicons name="git-compare-outline" size={18} color="#0F172A" />
                        <Text style={s.menuItemTxt}>Compare</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[s.menuItem, { borderBottomWidth: 0 }]}
                        onPress={() => {
                            Clipboard.setString(product?.name || '');
                            setShowMenu(false);
                            Alert.alert('Copied', 'Product link copied.');
                        }}
                    >
                        <Ionicons name="copy-outline" size={18} color="#0F172A" />
                        <Text style={s.menuItemTxt}>Copy Name</Text>
                    </TouchableOpacity>
                </View>
            )}

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* ── BREADCRUMB ── */}
                <View style={s.breadcrumbRow}>
                    <Text style={s.breadcrumbMuted}>Home</Text>
                    <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
                    <Text style={s.breadcrumbMuted}>{product?.category || 'Electronics'}</Text>
                    <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
                    <Text style={s.breadcrumbMuted}>Audio</Text>
                    <Ionicons name="chevron-forward" size={12} color="#94A3B8" />
                    <Text style={s.breadcrumbActive} numberOfLines={1}>
                        {product?.name || 'Wireless Headphones'}
                    </Text>
                </View>

                {/* ── GALLERY ROW (Matching Screenshot 3 Left Thumbnails + Right Big Card) ── */}
                <View style={s.galleryContainer}>
                    {/* Left Column: Thumbnails */}
                    <View style={s.thumbnailCol}>
                        {images.slice(0, 4).map((uri, idx) => (
                            <TouchableOpacity
                                key={idx}
                                style={[s.thumbnailWrap, activeImg === idx && s.thumbnailWrapActive]}
                                onPress={() => setActiveImg(idx)}
                                activeOpacity={0.8}
                            >
                                <Image source={{ uri }} style={s.thumbnailImg} resizeMode="contain" />
                            </TouchableOpacity>
                        ))}

                        {/* Video thumbnail with play icon */}
                        <TouchableOpacity
                            style={[s.thumbnailWrap, s.videoThumbWrap]}
                            onPress={() => {
                                if (validVideo) {
                                    setShowVideoModal(true);
                                } else {
                                    Alert.alert('Video Preview', 'Product video demonstration is available soon.');
                                }
                            }}
                            activeOpacity={0.8}
                        >
                            <Image
                                source={{ uri: images[0] }}
                                style={[s.thumbnailImg, { opacity: 0.6 }]}
                                resizeMode="contain"
                            />
                            <View style={s.videoPlayOverlay}>
                                <Ionicons name="play" size={16} color="#FFFFFF" />
                            </View>
                        </TouchableOpacity>
                    </View>

                    {/* Right Column: Large Product Image Card */}
                    <View style={s.mainImageCard}>
                        {/* Discount Badge */}
                        <View style={s.mainDiscountBadge}>
                            <Text style={s.mainDiscountTxt}>{discountPercent}%</Text>
                            <Text style={s.mainDiscountTxtSub}>OFF</Text>
                        </View>

                        {/* Floating Heart Button */}
                        <TouchableOpacity
                            style={s.mainHeartBtn}
                            onPress={handleLike}
                            activeOpacity={0.8}
                        >
                            <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                                <Ionicons
                                    name={liked ? "heart" : "heart-outline"}
                                    size={20}
                                    color={liked ? "#EF4444" : "#0F172A"}
                                />
                            </Animated.View>
                        </TouchableOpacity>

                        {/* Main Product Image */}
                        <Pressable onPress={() => setImgZoom(true)} style={{ width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' }}>
                            <Image
                                source={{ uri: images[activeImg] || images[0] }}
                                style={s.mainImg}
                                resizeMode="contain"
                            />
                        </Pressable>

                        {/* 1/5 Indicator Badge */}
                        <View style={s.counterBadge}>
                            <Text style={s.counterBadgeTxt}>{activeImg + 1}/{images.length || 5}</Text>
                        </View>
                    </View>
                </View>

                {/* ── PRODUCT TITLE & DETAILS ── */}
                <View style={s.contentSection}>
                    <Text style={s.productTitle}>
                        {product?.name || 'Wireless Headphones Pro Max'}
                    </Text>

                    <Text style={s.productSubtitle}>
                        {product?.description?.slice(0, 60) || 'Premium Sound. All Day Comfort.'}
                    </Text>

                    {/* Rating & Sold Row */}
                    <View style={s.ratingRow}>
                        <Ionicons name="star" size={16} color="#F59E0B" />
                        <Text style={s.ratingNum}>4.8</Text>
                        <Text style={s.reviewsCount}>(256 reviews)</Text>
                        <Text style={s.ratingDivider}>|</Text>
                        <Text style={s.soldCount}>1.2K+ sold</Text>
                    </View>

                    {/* ── VERIFIED SELLER CARD ── */}
                    <View style={s.sellerCard}>
                        <View style={s.sellerAvatarWrap}>
                            <Image
                                source={{ uri: vendor?.avatar_url || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?q=80&w=200&auto=format&fit=crop' }}
                                style={s.sellerAvatar}
                            />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <Text style={s.sellerName}>{vendor?.full_name || 'TechWorld Store'}</Text>
                                <Ionicons name="checkmark-circle" size={16} color="#00D2FF" />
                            </View>
                            <Text style={s.sellerVerifiedTxt}>Verified Seller</Text>
                        </View>
                        <TouchableOpacity
                            style={s.viewStoreBtn}
                            onPress={() => navigation.navigate('Main', { screen: 'stores' })}
                        >
                            <Text style={s.viewStoreBtnTxt}>View Store</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── PRICE & STOCK ROW ── */}
                    <View style={s.priceStockRow}>
                        <View style={s.priceWrap}>
                            <Text style={s.currentPrice}>{fmtPrice(finalP)}</Text>
                            <Text style={s.comparePrice}>{fmtPrice(origP)}</Text>
                            <View style={s.savePill}>
                                <Text style={s.savePillTxt}>{discountPercent}% OFF</Text>
                            </View>
                        </View>

                        <View style={s.stockWrap}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                <View style={s.stockDot} />
                                <Text style={s.stockStatusTxt}>In Stock</Text>
                            </View>
                            <Text style={s.stockLeftTxt}>Only {stock} left!</Text>
                        </View>
                    </View>

                    {/* ── 4 FEATURE ICON BLOCKS (Matching Screenshot 3) ── */}
                    <View style={s.featuresGrid}>
                        <View style={s.featureBox}>
                            <View style={s.featureIconCircle}>
                                <Ionicons name="headset-outline" size={20} color="#0284C7" />
                            </View>
                            <Text style={s.featureLabel}>High Quality</Text>
                            <Text style={s.featureLabelBold}>Sound</Text>
                        </View>

                        <View style={s.featureBox}>
                            <View style={s.featureIconCircle}>
                                <Ionicons name="battery-charging-outline" size={20} color="#0284C7" />
                            </View>
                            <Text style={s.featureLabel}>Long Battery</Text>
                            <Text style={s.featureLabelBold}>Life</Text>
                        </View>

                        <View style={s.featureBox}>
                            <View style={s.featureIconCircle}>
                                <Ionicons name="mic-outline" size={20} color="#0284C7" />
                            </View>
                            <Text style={s.featureLabel}>Built-in</Text>
                            <Text style={s.featureLabelBold}>Microphone</Text>
                        </View>

                        <View style={s.featureBox}>
                            <View style={s.featureIconCircle}>
                                <Ionicons name="leaf-outline" size={20} color="#0284C7" />
                            </View>
                            <Text style={s.featureLabel}>Comfortable</Text>
                            <Text style={s.featureLabelBold}>Design</Text>
                        </View>
                    </View>

                    {/* ── QUANTITY & ACTION BUTTONS ROW (Matching Screenshot 3) ── */}
                    <View style={s.actionRowContainer}>
                        {/* Quantity Stepper */}
                        <View style={s.qtySection}>
                            <Text style={s.qtyHeading}>Quantity</Text>
                            <View style={s.qtyStepper}>
                                <TouchableOpacity style={s.qtyBtn} onPress={() => handleQty(-1)}>
                                    <Ionicons name="remove" size={16} color="#0F172A" />
                                </TouchableOpacity>
                                <Text style={s.qtyValue}>{quantity}</Text>
                                <TouchableOpacity style={s.qtyBtn} onPress={() => handleQty(1)}>
                                    <Ionicons name="add" size={16} color="#0F172A" />
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Dual Action Buttons */}
                        <View style={s.dualButtonsWrap}>
                            <TouchableOpacity
                                style={[s.addToCartBtn, cartDone && s.addToCartBtnDone]}
                                onPress={handleAddToCart}
                                activeOpacity={0.85}
                            >
                                <Ionicons
                                    name={cartDone ? "checkmark-circle" : "cart"}
                                    size={18}
                                    color={cartDone ? "#10B981" : "#0A192F"}
                                />
                                <Text style={[s.addToCartTxt, cartDone && { color: '#10B981' }]}>
                                    {cartDone ? "Added!" : "Add to Cart"}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={s.buyNowBtn}
                                onPress={handleBuyNow}
                                activeOpacity={0.85}
                            >
                                <Ionicons name="flash" size={16} color="#0F172A" />
                                <Text style={s.buyNowTxt}>Buy Now</Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* ── 4 TRUST BADGES STRIP ── */}
                    <View style={s.trustBadgesRow}>
                        <View style={s.trustItem}>
                            <Ionicons name="bus-outline" size={18} color="#0284C7" />
                            <Text style={s.trustTitle}>Fast Delivery</Text>
                            <Text style={s.trustSub}>Across Nigeria</Text>
                        </View>

                        <View style={s.trustItem}>
                            <Ionicons name="shield-checkmark-outline" size={18} color="#0284C7" />
                            <Text style={s.trustTitle}>7 Days</Text>
                            <Text style={s.trustSub}>Return Policy</Text>
                        </View>

                        <View style={s.trustItem}>
                            <Ionicons name="card-outline" size={18} color="#0284C7" />
                            <Text style={s.trustTitle}>Secure</Text>
                            <Text style={s.trustSub}>Payments</Text>
                        </View>

                        <View style={s.trustItem}>
                            <Ionicons name="checkmark-done-circle-outline" size={18} color="#0284C7" />
                            <Text style={s.trustTitle}>100% Original</Text>
                            <Text style={s.trustSub}>Products</Text>
                        </View>
                    </View>

                    {/* ── PRODUCT DESCRIPTION ACCORDION ── */}
                    <TouchableOpacity
                        style={s.accordionHeader}
                        onPress={() => setDescExpanded(prev => !prev)}
                        activeOpacity={0.7}
                    >
                        <Text style={s.accordionTitle}>Product Description</Text>
                        <Ionicons
                            name={descExpanded ? "chevron-up" : "chevron-forward"}
                            size={18}
                            color="#0F172A"
                        />
                    </TouchableOpacity>

                    {descExpanded && (
                        <View style={s.accordionContent}>
                            <Text style={s.descriptionText}>
                                {product?.description ||
                                    'Engineered for maximum acoustic fidelity and acoustic isolation. Features high-definition drivers, ultra-soft memory foam ear cushions, and seamless wireless connectivity across all your favorite devices.'}
                            </Text>

                            {/* Key specs */}
                            <View style={s.specsTable}>
                                <View style={s.specRow}>
                                    <Text style={s.specLabel}>Brand</Text>
                                    <Text style={s.specVal}>{product?.brand || 'Abu Mafhal Verified'}</Text>
                                </View>
                                <View style={s.specRow}>
                                    <Text style={s.specLabel}>Category</Text>
                                    <Text style={s.specVal}>{product?.category || 'Electronics'}</Text>
                                </View>
                                <View style={s.specRow}>
                                    <Text style={s.specLabel}>Condition</Text>
                                    <Text style={s.specVal}>Brand New / Sealed</Text>
                                </View>
                                <View style={s.specRow}>
                                    <Text style={s.specLabel}>Warranty</Text>
                                    <Text style={s.specVal}>12 Months Official Warranty</Text>
                                </View>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* ── ZOOM MODAL ── */}
            <Modal visible={imgZoom} transparent animationType="fade">
                <View style={s.zoomModalWrap}>
                    <TouchableOpacity style={s.zoomCloseBtn} onPress={() => setImgZoom(false)}>
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: images[activeImg] || images[0] }}
                        style={s.zoomFullImg}
                        resizeMode="contain"
                    />
                </View>
            </Modal>

            {/* ── VIDEO MODAL ── */}
            <Modal visible={showVideoModal} transparent animationType="slide">
                <View style={s.zoomModalWrap}>
                    <TouchableOpacity style={s.zoomCloseBtn} onPress={() => setShowVideoModal(false)}>
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                    {validVideo && (
                        <Video
                            source={{ uri: validVideo }}
                            style={{ width: width - 32, height: 300, borderRadius: 16 }}
                            useNativeControls
                            resizeMode={ResizeMode.CONTAIN}
                            shouldPlay
                        />
                    )}
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: '#FFFFFF',
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
    topBarBtn: {
        padding: 4,
    },
    topBarLogoWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    topLogoImg: {
        width: 32,
        height: 32,
    },
    topLogoTitle: {
        fontSize: 14,
        fontWeight: '900',
        color: '#0A192F',
        letterSpacing: 0.5,
    },
    topLogoSubtitle: {
        fontSize: 6.5,
        fontWeight: '700',
        color: '#64748B',
        letterSpacing: 0.5,
    },
    topRightActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    topIconBtn: {
        position: 'relative',
        padding: 4,
    },
    cartBadge: {
        position: 'absolute',
        top: 0,
        right: 0,
        backgroundColor: '#EF4444',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    cartBadgeTxt: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
    },

    // Menu popup
    menuPopup: {
        position: 'absolute',
        top: 60,
        right: 16,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
        zIndex: 99,
        minWidth: 160,
    },
    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9',
    },
    menuItemTxt: {
        fontSize: 13,
        fontWeight: '600',
        color: '#0F172A',
    },

    // Breadcrumb
    breadcrumbRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    breadcrumbMuted: {
        fontSize: 11.5,
        color: '#64748B',
        fontWeight: '500',
    },
    breadcrumbActive: {
        fontSize: 11.5,
        color: '#0F172A',
        fontWeight: '700',
        flexShrink: 1,
    },

    // Gallery Row
    galleryContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        gap: 12,
        marginBottom: 16,
    },
    thumbnailCol: {
        width: 58,
        gap: 8,
    },
    thumbnailWrap: {
        width: 58,
        height: 58,
        borderRadius: 10,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        padding: 4,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    thumbnailWrapActive: {
        borderColor: '#0284C7',
        borderWidth: 2,
        backgroundColor: '#F0F9FF',
    },
    thumbnailImg: {
        width: '100%',
        height: '100%',
    },
    videoThumbWrap: {
        position: 'relative',
        backgroundColor: '#0F172A',
    },
    videoPlayOverlay: {
        position: 'absolute',
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: 'rgba(0,0,0,0.6)',
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Main Image Card
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
        padding: 16,
    },
    mainDiscountBadge: {
        position: 'absolute',
        top: 14,
        left: 14,
        backgroundColor: '#F59E0B',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        alignItems: 'center',
        zIndex: 2,
    },
    mainDiscountTxt: {
        color: '#0F172A',
        fontSize: 13,
        fontWeight: '900',
        lineHeight: 14,
    },
    mainDiscountTxtSub: {
        color: '#0F172A',
        fontSize: 9,
        fontWeight: '800',
    },
    mainHeartBtn: {
        position: 'absolute',
        top: 14,
        right: 14,
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        zIndex: 2,
    },
    mainImg: {
        width: '100%',
        height: '90%',
    },
    counterBadge: {
        position: 'absolute',
        bottom: 14,
        right: 14,
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
    },
    counterBadgeTxt: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '700',
    },

    // Content Section
    contentSection: {
        paddingHorizontal: 16,
    },
    productTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: '#0F172A',
        marginBottom: 4,
    },
    productSubtitle: {
        fontSize: 12.5,
        color: '#64748B',
        fontWeight: '500',
        marginBottom: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginBottom: 14,
    },
    ratingNum: {
        fontSize: 13,
        fontWeight: '800',
        color: '#0F172A',
    },
    reviewsCount: {
        fontSize: 12,
        color: '#64748B',
    },
    ratingDivider: {
        fontSize: 12,
        color: '#CBD5E1',
        marginHorizontal: 4,
    },
    soldCount: {
        fontSize: 12,
        color: '#64748B',
        fontWeight: '600',
    },

    // Seller Card
    sellerCard: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        marginBottom: 16,
    },
    sellerAvatarWrap: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: '#0A192F',
        overflow: 'hidden',
    },
    sellerAvatar: {
        width: '100%',
        height: '100%',
    },
    sellerName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A',
    },
    sellerVerifiedTxt: {
        fontSize: 11,
        fontWeight: '600',
        color: '#10B981',
    },
    viewStoreBtn: {
        backgroundColor: '#EFF6FF',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 20,
    },
    viewStoreBtnTxt: {
        color: '#2563EB',
        fontSize: 11.5,
        fontWeight: '700',
    },

    // Price & Stock
    priceStockRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 18,
    },
    priceWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    currentPrice: {
        fontSize: 22,
        fontWeight: '900',
        color: '#0F172A',
    },
    comparePrice: {
        fontSize: 13,
        color: '#94A3B8',
        textDecorationLine: 'line-through',
    },
    savePill: {
        backgroundColor: '#10B981',
        paddingHorizontal: 7,
        paddingVertical: 3,
        borderRadius: 6,
    },
    savePillTxt: {
        color: '#FFFFFF',
        fontSize: 10,
        fontWeight: '800',
    },
    stockWrap: {
        alignItems: 'flex-end',
    },
    stockDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#10B981',
    },
    stockStatusTxt: {
        fontSize: 12,
        fontWeight: '800',
        color: '#10B981',
    },
    stockLeftTxt: {
        fontSize: 10,
        color: '#64748B',
        marginTop: 1,
    },

    // 4 Feature Blocks
    featuresGrid: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 20,
    },
    featureBox: {
        flex: 1,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 12,
        paddingHorizontal: 4,
        alignItems: 'center',
    },
    featureIconCircle: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: '#E0F2FE',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 6,
    },
    featureLabel: {
        fontSize: 9.5,
        color: '#64748B',
        fontWeight: '600',
        textAlign: 'center',
    },
    featureLabelBold: {
        fontSize: 9.5,
        color: '#0F172A',
        fontWeight: '800',
        textAlign: 'center',
    },

    // Action Row
    actionRowContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 20,
    },
    qtySection: {
        alignItems: 'center',
    },
    qtyHeading: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
        marginBottom: 4,
    },
    qtyStepper: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F1F5F9',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        height: 44,
        paddingHorizontal: 4,
    },
    qtyBtn: {
        width: 32,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    qtyValue: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
        paddingHorizontal: 8,
    },
    dualButtonsWrap: {
        flex: 1,
        gap: 8,
    },
    addToCartBtn: {
        height: 42,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#0A192F',
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    addToCartBtnDone: {
        borderColor: '#10B981',
        backgroundColor: '#ECFDF5',
    },
    addToCartTxt: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0A192F',
    },
    buyNowBtn: {
        height: 42,
        borderRadius: 12,
        backgroundColor: '#F59E0B',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    buyNowTxt: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0F172A',
    },

    // Trust Badges Strip
    trustBadgesRow: {
        flexDirection: 'row',
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        paddingVertical: 12,
        paddingHorizontal: 6,
        marginBottom: 20,
    },
    trustItem: {
        flex: 1,
        alignItems: 'center',
        gap: 2,
    },
    trustTitle: {
        fontSize: 8.5,
        fontWeight: '800',
        color: '#0F172A',
        textAlign: 'center',
        marginTop: 4,
    },
    trustSub: {
        fontSize: 7.5,
        color: '#64748B',
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
        borderColor: '#E2E8F0',
    },
    accordionTitle: {
        fontSize: 14,
        fontWeight: '800',
        color: '#0F172A',
    },
    accordionContent: {
        paddingVertical: 12,
    },
    descriptionText: {
        fontSize: 12.5,
        lineHeight: 19,
        color: '#475569',
        marginBottom: 12,
    },
    specsTable: {
        backgroundColor: '#F8FAFC',
        borderRadius: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        gap: 6,
    },
    specRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
    },
    specLabel: {
        fontSize: 11,
        color: '#64748B',
        fontWeight: '600',
    },
    specVal: {
        fontSize: 11,
        color: '#0F172A',
        fontWeight: '700',
    },

    // Zoom modal
    zoomModalWrap: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
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
        width: width - 32,
        height: 400,
    },
});
