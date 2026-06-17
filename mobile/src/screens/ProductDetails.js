import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    Dimensions, Animated, StatusBar, Share, Alert,
    FlatList, ActivityIndicator, StyleSheet, Platform,
    Modal, Clipboard, Linking, Pressable
} from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useComparison } from '../context/ComparisonContext';
import { Video, ResizeMode } from 'expo-av';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import * as FileSystem from 'expo-file-system/legacy';
import { LinearGradient } from 'expo-linear-gradient';

const { width, height } = Dimensions.get('window');

// ── Helpers ───────────────────────────────────────────────────────────────────
const fmtPrice = (n) => {
    const num = Number(n);
    if (!num) return '—';
    if (num >= 1_000_000) return `₦${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000)     return `₦${(num / 1_000).toFixed(0)}K`;
    return `₦${num}`;
};

const getDeliveryEst = () => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' });
};

// Category → accent color map
const CAT_COLORS = {
    phones: '#6366F1', electronics: '#6366F1',
    fashion: '#EC4899', clothing: '#EC4899',
    food: '#F59E0B', drinks: '#F59E0B',
    home: '#10B981', furniture: '#10B981',
    beauty: '#F472B6', health: '#10B981',
    default: '#6366F1',
};
const getCatColor = (cat) => {
    if (!cat) return CAT_COLORS.default;
    const key = cat.toLowerCase();
    for (const k of Object.keys(CAT_COLORS)) { if (key.includes(k)) return CAT_COLORS[k]; }
    return CAT_COLORS.default;
};

// ─────────────────────────────────────────────────────────────────────────────
export const ProductDetails = ({ route, navigation, addToCart }) => {
    const { product } = route.params || {};
    const insets = useSafeAreaInsets();
    const { addToComparison, isInComparison } = useComparison();

    // ── State ─────────────────────────────────────────────────────────────────
    const [activeImg,    setActiveImg]    = useState(0);
    const [quantity,     setQuantity]     = useState(1);
    const [descExpanded, setDescExpanded] = useState(false);
    const [validVideo,   setValidVideo]   = useState(null);
    const [related,      setRelated]      = useState([]);
    const [loadingRel,   setLoadingRel]   = useState(true);
    const [vendor,       setVendor]       = useState(null);
    const [loadingVend,  setLoadingVend]  = useState(true);
    const [me,           setMe]           = useState(null);
    const [liked,        setLiked]        = useState(false);
    const [cartDone,     setCartDone]     = useState(false);
    const [selectedVar,  setSelectedVar]  = useState(null);
    const [imgZoom,      setImgZoom]      = useState(false);
    const [copied,       setCopied]       = useState(false);
    const [priceAlert,   setPriceAlert]   = useState(false);

    const cartScale   = useRef(new Animated.Value(1)).current;
    const heartScale  = useRef(new Animated.Value(1)).current;
    const scrollRef   = useRef(null);

    // ── Price calc ────────────────────────────────────────────────────────────
    const promo  = product?.promoDiscount || null;
    const origP  = Number(product?.price || 0);
    const finalP = promo
        ? (promo.type === 'percent' ? origP * (1 - parseFloat(promo.value) / 100) : origP - parseFloat(promo.value))
        : origP;
    const saving = origP - finalP;
    const catColor = getCatColor(product?.category);

    if (!product) return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#F8FAFC' }}>
            <ActivityIndicator size="large" color="#6366F1" />
        </View>
    );

    const getImgs = (imgs) => {
        if (!imgs) return [];
        if (Array.isArray(imgs)) return imgs.filter(Boolean);
        try { const p = JSON.parse(imgs); return Array.isArray(p) ? p.filter(Boolean) : [imgs]; } catch { return [imgs]; }
    };
    const getImg1 = (imgs) => { const a = getImgs(imgs); return a.length ? a[0] : null; };

    const images   = getImgs(product?.images);
    const variants = product?.metadata?.variants || [];
    const isOwner  = vendor?.id && me && vendor.id === me.id;
    const inComp   = isInComparison(product.id);
    const stock    = product?.stock != null ? Number(product.stock) : null;
    const stockPct = stock != null && stock <= 20 ? stock / 20 : 1;
    const isLowStock = stock != null && stock > 0 && stock <= 10;
    const isOutOfStock = stock === 0;

    // Quick highlights from description
    const highlights = product?.description
        ? product.description.split(/[.،,\n]/).map(s => s.trim()).filter(s => s.length > 20 && s.length < 100).slice(0, 3)
        : [];

    useEffect(() => {
        fetchVendor(); fetchRelated(); validateVideo(); checkWishlist();
    }, [product?.id]);

    const fetchVendor = async () => {
        setLoadingVend(true);
        const vId = product.vendor_id || product.user_id || product.owner_id;
        if (!vId || vId === 'admin') {
            try {
                const { data } = await supabase.from('profiles').select('*').eq('email', 'muhammadsaniisyaku3@gmail.com').single();
                setVendor(data ? { ...data, full_name: 'Abu Mafhal Admin', role: 'Admin' } : { id: 'admin', full_name: 'Abu Mafhal Admin', role: 'Admin', avatar_url: null });
            } catch { setVendor({ id: 'admin', full_name: 'Abu Mafhal Admin', role: 'Admin', avatar_url: null }); }
            setLoadingVend(false); return;
        }
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setMe(user);
            if (user?.id === vId) {
                let av = user.user_metadata?.avatar_url || user.avatar_url;
                if (av?.startsWith('file://') || av?.startsWith('/data/')) av = null;
                setVendor({ ...user, full_name: user.user_metadata?.full_name || 'You', role: 'Vendor', avatar_url: av });
                setLoadingVend(false); return;
            }
            let { data } = await supabase.from('profiles').select('*').eq('id', vId).single();
            if (!data) { const r = await supabase.from('users').select('*').eq('id', vId).single(); data = r.data; }
            if (data) {
                let av = data.avatar_url || null;
                if (av?.startsWith('file://') || av?.startsWith('/data/')) av = null;
                setVendor({ ...data, full_name: data.full_name || 'Vendor', role: (data.role === 'admin' || data.email === 'muhammadsaniisyaku3@gmail.com') ? 'Admin' : 'Vendor', avatar_url: av });
            }
        } catch {} finally { setLoadingVend(false); }
    };

    const fetchRelated = async () => {
        try {
            let q = supabase.from('products').select('*').neq('id', product.id).limit(8);
            if (product.category) q = q.eq('category', product.category);
            const { data } = await q;
            setRelated((data || []).filter(i => !i.name?.toLowerCase().includes('mock')));
        } catch {} finally { setLoadingRel(false); }
    };

    const validateVideo = async () => {
        let uri = product?.video_url || product?.metadata?.video || product?.video || product?.videoUrl;
        if (!uri) return;
        if (Array.isArray(uri)) uri = uri[0];
        if (typeof uri === 'string' && uri.startsWith('[')) { try { const p = JSON.parse(uri); if (Array.isArray(p)) uri = p[0]; } catch {} }
        if (typeof uri !== 'string') return;
        if (uri.startsWith('http')) { setValidVideo(uri); return; }
        try { const fi = await FileSystem.getInfoAsync(uri); if (fi.exists) setValidVideo(uri); } catch {}
    };

    const checkWishlist = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            const { data } = await supabase.from('wishlists').select('items').eq('id', user.id).single();
            if (data?.items) setLiked(data.items.includes(product.id));
        } catch {}
    };

    // ── Actions ───────────────────────────────────────────────────────────────
    const handleCart = () => {
        if (!addToCart) return;
        if (isOutOfStock) { Alert.alert('Out of Stock', 'This product is currently unavailable.'); return; }
        addToCart({ ...product, price: finalP }, quantity);
        setCartDone(true);
        Animated.sequence([
            Animated.spring(cartScale, { toValue: 0.9, useNativeDriver: true, tension: 400 }),
            Animated.spring(cartScale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        setTimeout(() => { setCartDone(false); navigation.goBack(); }, 700);
    };

    const handleLike = async () => {
        // Animate heart
        Animated.sequence([
            Animated.spring(heartScale, { toValue: 1.4, useNativeDriver: true, tension: 400 }),
            Animated.spring(heartScale, { toValue: 1, useNativeDriver: true }),
        ]).start();
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) { Alert.alert('Login Required', 'Please login to save wishlist'); return; }
            const { data } = await supabase.from('wishlists').select('items').eq('id', user.id).single();
            const curr = data?.items || [];
            const next = liked ? curr.filter(i => i !== product.id) : [...curr, product.id];
            setLiked(!liked);
            await supabase.from('wishlists').upsert({ id: user.id, items: next, updated_at: new Date() });
        } catch {}
    };

    const handleChat = () => {
        if (isOwner) { Alert.alert('Your Product', 'Manage it from your vendor dashboard.'); return; }
        navigation.navigate('ChatScreen', {
            productId: product.id, productName: product.name, productPrice: product.price,
            productImage: images[0],
            vendorId: vendor?.id || product.vendor_id || 'admin',
            vendorName: vendor?.full_name || 'Vendor',
            vendorAvatar: vendor?.avatar_url, vendorRole: vendor?.role,
        });
    };

    const handleShare = () => {
        Share.share({ message: `🛍️ Check out "${product.name}" on Abu Mafhal!\n💰 Price: ${fmtPrice(finalP)}\n📱 Download Abu Mafhal app` });
    };

    const handleWhatsApp = () => {
        const msg = encodeURIComponent(`🛍️ *${product.name}*\n💰 Price: ${fmtPrice(finalP)}\nFound on Abu Mafhal app`);
        Linking.openURL(`https://wa.me/?text=${msg}`).catch(() => Alert.alert('WhatsApp not installed'));
    };

    const handleCopy = () => {
        Clipboard.setString(`${product.name} - ${fmtPrice(finalP)}`);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleQty = (delta) => {
        const next = quantity + delta;
        if (next < 1) return;
        if (stock != null && next > stock) {
            Alert.alert('Max Stock', `Only ${stock} items available`);
            return;
        }
        setQuantity(next);
    };

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

            {/* ── HEADER ── */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[s.header, { paddingTop: Math.max(insets.top || 0, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0) + 8 }]}
            >
                <TouchableOpacity style={s.hBtn} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={20} color="white" />
                </TouchableOpacity>

                <View style={[s.brandDot, { backgroundColor: catColor }]} />
                <Text style={s.hTitle} numberOfLines={1}>{product?.name || 'Product'}</Text>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                    {/* Copy button */}
                    <TouchableOpacity style={s.hBtn} onPress={handleCopy}>
                        <Ionicons name={copied ? 'checkmark' : 'copy-outline'} size={15} color={copied ? '#86EFAC' : 'rgba(255,255,255,0.8)'} />
                    </TouchableOpacity>
                    <Animated.View style={{ transform: [{ scale: heartScale }] }}>
                        <TouchableOpacity style={[s.hBtn, liked && s.hBtnLiked]} onPress={handleLike}>
                            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={16} color={liked ? '#FCA5A5' : 'rgba(255,255,255,0.8)'} />
                        </TouchableOpacity>
                    </Animated.View>
                    <TouchableOpacity style={s.hBtn} onPress={handleShare}>
                        <Ionicons name="share-outline" size={16} color="rgba(255,255,255,0.8)" />
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* ── Accent strip ── */}
            <View style={s.accentStrip}>
                <View style={[s.accentFill, { backgroundColor: catColor }]} />
            </View>

            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

                {/* ── IMAGE SECTION ── */}
                <View style={s.imgSection}>
                    {/* Corner accents */}
                    <View style={[s.cornerTL, { backgroundColor: catColor + '18' }]} />
                    <View style={[s.cornerBR, { backgroundColor: catColor + '10' }]} />

                    {/* Category watermark */}
                    {product?.category && (
                        <Text style={[s.catWatermark, { color: catColor + '18' }]}>{product.category.toUpperCase()}</Text>
                    )}

                    {images.length > 0 ? (
                        <FlatList
                            data={images}
                            horizontal pagingEnabled showsHorizontalScrollIndicator={false}
                            keyExtractor={(_, i) => i.toString()}
                            onMomentumScrollEnd={e => setActiveImg(Math.round(e.nativeEvent.contentOffset.x / width))}
                            renderItem={({ item }) => (
                                <Pressable style={s.imgSlide} onPress={() => setImgZoom(true)}>
                                    <Image source={{ uri: item }} style={s.productImg} resizeMode="contain" />
                                    {/* Zoom hint */}
                                    <View style={s.zoomHint}>
                                        <Ionicons name="expand-outline" size={12} color="rgba(255,255,255,0.9)" />
                                        <Text style={s.zoomHintTxt}>Tap to zoom</Text>
                                    </View>
                                </Pressable>
                            )}
                        />
                    ) : (
                        <View style={s.imgPlaceholder}>
                            <Ionicons name="bag-outline" size={48} color="#C7D2FE" />
                        </View>
                    )}

                    {/* Out of stock overlay */}
                    {isOutOfStock && (
                        <View style={s.outOfStockOverlay}>
                            <Text style={s.outOfStockTxt}>OUT OF STOCK</Text>
                        </View>
                    )}

                    {/* Badges row */}
                    <View style={s.imgBadgesRow}>
                        {(product?.discount > 0 || promo) && (
                            <View style={s.discBadge}>
                                <Text style={s.discBadgeTxt}>
                                    -{product?.discount || (promo?.type === 'percent' ? promo.value : '')}%
                                </Text>
                            </View>
                        )}
                        {product?.isNew && <View style={[s.discBadge, { backgroundColor: catColor }]}><Text style={s.discBadgeTxt}>NEW</Text></View>}
                    </View>

                    {/* Compare + image counter */}
                    <View style={s.imgTopRight}>
                        <TouchableOpacity style={[s.compPill, inComp && { borderColor: catColor + '60', backgroundColor: catColor + '18' }]}
                            onPress={() => addToComparison(product)}>
                            <Ionicons name="git-compare-outline" size={11} color={inComp ? catColor : '#94A3B8'} />
                            <Text style={[s.compPillTxt, inComp && { color: catColor }]}>{inComp ? 'Comparing' : 'Compare'}</Text>
                        </TouchableOpacity>
                        {images.length > 1 && (
                            <View style={s.imgCounter}>
                                <Text style={s.imgCounterTxt}>{activeImg + 1}/{images.length}</Text>
                            </View>
                        )}
                    </View>

                    {/* Thumbnail strip */}
                    {images.length > 1 && (
                        <View style={s.thumbRow}>
                            {images.map((uri, i) => (
                                <TouchableOpacity key={i}
                                    style={[s.thumb, i === activeImg && { borderColor: catColor, backgroundColor: catColor + '10' }]}>
                                    <Image source={{ uri }} style={{ width: '100%', height: '100%', borderRadius: 6 }} resizeMode="contain" />
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </View>

                {/* ── CONTENT CARD ── */}
                <View style={s.card}>
                    {/* Decorative handle */}
                    <View style={[s.handle, { backgroundColor: catColor + '40' }]} />

                    {/* Pill dots decoration */}
                    <View style={s.decorDots}>
                        <View style={[s.dot3, { backgroundColor: catColor, width: 18 }]} />
                        <View style={s.dot3} />
                        <View style={[s.dot3, { width: 6 }]} />
                    </View>

                    {/* ── NAME + RATING ── */}
                    <View style={s.nameRow}>
                        <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={s.name}>{product?.name || 'Product'}</Text>
                            {product?.category && (
                                <View style={[s.catTag, { backgroundColor: catColor + '18', borderColor: catColor + '30' }]}>
                                    <Ionicons name="pricetag-outline" size={9} color={catColor} />
                                    <Text style={[s.catTagTxt, { color: catColor }]}>{product.category}</Text>
                                </View>
                            )}
                        </View>
                        {product?.rating > 0 && (
                            <View style={s.rBadge}>
                                <Ionicons name="star" size={11} color="#F59E0B" />
                                <Text style={s.rNum}>{product.rating.toFixed(1)}</Text>
                                <Text style={s.rCnt}>({product.reviews ?? 0})</Text>
                            </View>
                        )}
                    </View>

                    {/* ── PRICE ── */}
                    <View style={[s.priceSection, { borderLeftColor: catColor }]}>
                        <View style={s.priceLeft}>
                            <Text style={[s.price, { color: catColor }]}>{fmtPrice(finalP)}</Text>
                            {(promo || product?.discount > 0) && (
                                <Text style={s.oldPrice}>{fmtPrice(origP)}</Text>
                            )}
                        </View>
                        <View style={{ gap: 5, alignItems: 'flex-end' }}>
                            {saving > 0 && (
                                <View style={s.savingBadge}>
                                    <Ionicons name="trending-down" size={10} color="#16A34A" />
                                    <Text style={s.savingTxt}>Save {fmtPrice(saving)}</Text>
                                </View>
                            )}
                            {promo && (
                                <View style={s.promoBadge}>
                                    <Ionicons name="sparkles" size={9} color="#16A34A" />
                                    <Text style={s.promoTxt}>{promo.value}{promo.type === 'percent' ? '%' : '₦'} OFF</Text>
                                </View>
                            )}
                        </View>
                    </View>

                    {/* ── STOCK URGENCY BAR ── */}
                    {stock != null && stock > 0 && (
                        <View style={s.stockBar}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                                <Text style={s.stockLbl}>
                                    {isLowStock ? `🔥 Only ${stock} left!` : `✅ In stock (${stock} available)`}
                                </Text>
                                <Text style={[s.stockPct, { color: isLowStock ? '#EF4444' : '#10B981' }]}>
                                    {isLowStock ? 'Almost gone' : 'Available'}
                                </Text>
                            </View>
                            <View style={s.stockTrack}>
                                <View style={[s.stockFill, {
                                    width: `${Math.min(stockPct * 100, 100)}%`,
                                    backgroundColor: isLowStock ? '#EF4444' : '#10B981',
                                }]} />
                            </View>
                        </View>
                    )}

                    {/* ── DELIVERY CARD ── */}
                    <View style={s.deliveryCard}>
                        <View style={s.delivIcon}>
                            <Ionicons name="bicycle" size={18} color={catColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Text style={s.delivTitle}>
                                {origP >= 50000 ? '🎉 Free Delivery' : '📦 Delivery Available'}
                            </Text>
                            <Text style={s.delivSub}>Est. arrival: <Text style={{ fontWeight: '800', color: '#0F172A' }}>{getDeliveryEst()}</Text></Text>
                        </View>
                        {origP >= 50000 && (
                            <View style={[s.freeTag, { borderColor: catColor + '40', backgroundColor: catColor + '10' }]}>
                                <Text style={[s.freeTxt, { color: catColor }]}>FREE</Text>
                            </View>
                        )}
                    </View>

                    {/* ── TRUST BADGES ── */}
                    <View style={s.trustRow}>
                        {[
                            { icon: 'shield-checkmark-outline', label: 'Verified Product', color: '#6366F1' },
                            { icon: 'lock-closed-outline',      label: 'Secure Pay',       color: '#10B981' },
                            { icon: 'refresh-outline',          label: 'Easy Returns',     color: '#F59E0B' },
                        ].map((b, i) => (
                            <View key={i} style={s.trustBadge}>
                                <Ionicons name={b.icon} size={16} color={b.color} />
                                <Text style={s.trustTxt}>{b.label}</Text>
                            </View>
                        ))}
                    </View>

                    <View style={s.div} />

                    {/* ── VARIANTS ── */}
                    {variants.length > 0 && (
                        <View style={s.section}>
                            <View style={s.secRow}><View style={[s.secBar, { backgroundColor: catColor }]} /><Text style={s.secLabel}>Select Option</Text></View>
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7 }}>
                                {variants.map((v, i) => (
                                    <TouchableOpacity key={i} onPress={() => setSelectedVar(v)}
                                        style={[s.varBtn, selectedVar === v && { borderColor: catColor, backgroundColor: catColor + '15' }]}>
                                        <Text style={[s.varTxt, selectedVar === v && { color: catColor, fontWeight: '800' }]}>
                                            {v?.name}  {fmtPrice(v?.price)}
                                        </Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── QUICK HIGHLIGHTS ── */}
                    {highlights.length > 0 && (
                        <View style={s.section}>
                            <View style={s.secRow}><View style={[s.secBar, { backgroundColor: catColor }]} /><Text style={s.secLabel}>Highlights</Text></View>
                            <View style={s.highlightBox}>
                                {highlights.map((h, i) => (
                                    <View key={i} style={s.highlightRow}>
                                        <View style={[s.highlightDot, { backgroundColor: catColor }]} />
                                        <Text style={s.highlightTxt}>{h}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── VENDOR ── */}
                    {loadingVend ? (
                        <View style={s.vendorSkeleton}>
                            <View style={s.skelCircle} />
                            <View style={{ flex: 1, gap: 5 }}>
                                <View style={s.skelLine} />
                                <View style={[s.skelLine, { width: '50%' }]} />
                            </View>
                        </View>
                    ) : vendor && (
                        <View style={s.vendorCard}>
                            <View style={[s.vendorAv, { borderColor: catColor + '50' }]}>
                                {vendor.avatar_url
                                    ? <Image source={{ uri: vendor.avatar_url }} style={{ width: '100%', height: '100%' }} />
                                    : <Ionicons name="storefront-outline" size={15} color={catColor} />}
                            </View>
                            <View style={{ flex: 1 }}>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Text style={s.vendorName} numberOfLines={1}>{vendor.full_name}</Text>
                                    {vendor.role === 'Admin' && (
                                        <View style={[s.officialBadge, { backgroundColor: catColor + '18' }]}>
                                            <Text style={[s.officialTxt, { color: catColor }]}>✓ OFFICIAL</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                                    <Ionicons name="location-outline" size={10} color="#94A3B8" />
                                    <Text style={s.vendorRole}>{vendor.role || 'Seller'} · Abu Mafhal</Text>
                                </View>
                            </View>
                            <View style={{ gap: 5 }}>
                                <TouchableOpacity style={[s.vendorActionBtn, { borderColor: catColor + '40', backgroundColor: catColor + '10' }]} onPress={handleChat}>
                                    <Ionicons name={isOwner ? 'create-outline' : 'chatbubble-ellipses-outline'} size={13} color={isOwner ? '#16A34A' : catColor} />
                                    <Text style={[s.vendorActionTxt, { color: isOwner ? '#16A34A' : catColor }]}>{isOwner ? 'Edit' : 'Chat'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity style={s.vendorActionBtn} onPress={handleWhatsApp}>
                                    <Ionicons name="logo-whatsapp" size={13} color="#25D366" />
                                    <Text style={[s.vendorActionTxt, { color: '#25D366' }]}>WhatsApp</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}

                    {/* ── DESCRIPTION ── */}
                    <View style={s.section}>
                        <View style={s.secRow}><View style={[s.secBar, { backgroundColor: catColor }]} /><Text style={s.secLabel}>About this product</Text></View>
                        <Text style={s.desc} numberOfLines={descExpanded ? undefined : 4}>
                            {product?.description || 'No description provided.'}
                        </Text>
                        <TouchableOpacity style={[s.readMoreBtn, { borderColor: catColor + '30' }]} onPress={() => setDescExpanded(!descExpanded)}>
                            <Text style={[s.readMoreTxt, { color: catColor }]}>{descExpanded ? '↑ Show less' : '↓ Read more'}</Text>
                        </TouchableOpacity>
                    </View>

                    {/* ── SPECS ── */}
                    <View style={s.specCard}>
                        <View style={s.secRow}><View style={[s.secBar, { backgroundColor: catColor }]} /><Text style={s.secLabel}>Specifications</Text></View>
                        {[
                            ['Category',     product?.category || 'General'],
                            ['Condition',    product?.condition || 'New'],
                            ['Availability', isOutOfStock ? '❌ Out of Stock' : `✅ ${stock != null ? stock + ' units' : 'Available'}`],
                            product?.brand && ['Brand', '🏷 ' + product.brand],
                            product?.weight && ['Weight', product.weight],
                        ].filter(Boolean).map(([k, v], i, arr) => (
                            <View key={k} style={[s.specRow, i < arr.length - 1 && { borderBottomWidth: 1, borderBottomColor: '#F1F5F9' }]}>
                                <Text style={s.specK}>{k}</Text>
                                <Text style={s.specV}>{v}</Text>
                            </View>
                        ))}
                    </View>

                    {/* ── PRICE ALERT ── */}
                    <TouchableOpacity style={s.priceAlertBtn} onPress={() => { setPriceAlert(!priceAlert); if (!priceAlert) Alert.alert('🔔 Price Alert Set!', 'We\'ll notify you when the price drops.'); }}>
                        <Ionicons name={priceAlert ? 'notifications' : 'notifications-outline'} size={15} color={priceAlert ? catColor : '#64748B'} />
                        <View style={{ flex: 1 }}>
                            <Text style={[s.priceAlertTxt, priceAlert && { color: catColor }]}>
                                {priceAlert ? '🔔 Price alert is ON' : 'Notify me when price drops'}
                            </Text>
                            <Text style={s.priceAlertSub}>Get notified of any price changes</Text>
                        </View>
                        <View style={[s.toggle, priceAlert && { backgroundColor: catColor }]}>
                            <View style={[s.toggleKnob, priceAlert && { marginLeft: 14 }]} />
                        </View>
                    </TouchableOpacity>

                    {/* ── RATING ── */}
                    {product?.reviews > 0 && (
                        <View style={s.ratingCard}>
                            <View style={s.starBurst}>
                                <Ionicons name="star" size={60} color="rgba(251,191,36,0.08)" />
                            </View>
                            <View style={{ alignItems: 'center', minWidth: 65 }}>
                                <Text style={s.rBig}>{product.rating?.toFixed(1)}</Text>
                                <View style={{ flexDirection: 'row', gap: 1, marginBottom: 3 }}>
                                    {Array.from({ length: 5 }).map((_, i) => (
                                        <Ionicons key={i} name={i < Math.round(product.rating || 0) ? 'star' : 'star-outline'} color="#F59E0B" size={11} />
                                    ))}
                                </View>
                                <Text style={{ fontSize: 9, color: '#A16207' }}>{product.reviews} reviews</Text>
                            </View>
                            <View style={{ flex: 1, gap: 4 }}>
                                {[5, 4, 3, 2, 1].map(star => (
                                    <View key={star} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                        <Text style={{ fontSize: 9, color: '#92400E', width: 7 }}>{star}</Text>
                                        <View style={s.barBg}>
                                            <View style={[s.barFg, { width: star <= Math.round(product.rating || 0) ? `${(6 - star) * 15 + 8}%` : '5%' }]} />
                                        </View>
                                    </View>
                                ))}
                            </View>
                        </View>
                    )}

                    {/* ── VIDEO ── */}
                    {validVideo && (
                        <View style={s.section}>
                            <View style={s.secRow}><View style={[s.secBar, { backgroundColor: catColor }]} /><Text style={s.secLabel}>Product Video</Text></View>
                            <View style={s.videoBox}>
                                <Video style={{ width: '100%', height: '100%' }} source={{ uri: validVideo }}
                                    useNativeControls resizeMode={ResizeMode.CONTAIN} isLooping onError={() => {}} />
                            </View>
                        </View>
                    )}

                    {/* ── SHARE ROW ── */}
                    <View style={s.shareRow}>
                        <Text style={s.shareLbl}>Share via:</Text>
                        {[
                            { icon: 'logo-whatsapp', color: '#25D366', label: 'WhatsApp', action: handleWhatsApp },
                            { icon: 'share-outline',  color: catColor,   label: 'Share',     action: handleShare },
                            { icon: 'copy-outline',   color: '#64748B',  label: copied ? 'Copied!' : 'Copy',   action: handleCopy },
                        ].map((btn, i) => (
                            <TouchableOpacity key={i} style={s.shareBtn} onPress={btn.action}>
                                <Ionicons name={btn.icon} size={17} color={btn.color} />
                                <Text style={[s.shareBtnTxt, { color: btn.color }]}>{btn.label}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    {/* ── RELATED ── */}
                    {related.length > 0 && (
                        <View style={s.section}>
                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                                <View style={s.secRow}><View style={[s.secBar, { backgroundColor: catColor }]} /><Text style={s.secLabel}>You May Also Like</Text></View>
                                <Text style={[{ fontSize: 10, fontWeight: '700', color: catColor }]}>{related.length} items</Text>
                            </View>
                            <FlatList
                                data={related} horizontal showsHorizontalScrollIndicator={false}
                                keyExtractor={i => i.id.toString()}
                                contentContainerStyle={{ gap: 9 }}
                                renderItem={({ item }) => {
                                    const img = getImg1(item?.images);
                                    const rColor = getCatColor(item?.category);
                                    return (
                                        <TouchableOpacity style={s.relCard}
                                            onPress={() => navigation.push('ProductDetails', { product: item })} activeOpacity={0.85}>
                                            <View style={s.relImgWrap}>
                                                {img
                                                    ? <Image source={{ uri: img }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
                                                    : <Ionicons name="image-outline" size={18} color="#C7D2FE" />}
                                                {item.discount > 0 && (
                                                    <View style={[s.relBadge, { backgroundColor: rColor }]}><Text style={{ color: 'white', fontSize: 7, fontWeight: '900' }}>-{item.discount}%</Text></View>
                                                )}
                                            </View>
                                            <View style={{ padding: 6 }}>
                                                <Text style={s.relName} numberOfLines={1}>{item?.name}</Text>
                                                <Text style={[s.relPrice, { color: rColor }]}>{fmtPrice(item?.price)}</Text>
                                            </View>
                                        </TouchableOpacity>
                                    );
                                }}
                            />
                        </View>
                    )}
                    {loadingRel && <ActivityIndicator size="small" color={catColor} style={{ marginBottom: 10 }} />}
                </View>
            </ScrollView>

            {/* ── IMAGE ZOOM MODAL ── */}
            <Modal visible={imgZoom} transparent animationType="fade" onRequestClose={() => setImgZoom(false)}>
                <View style={s.zoomModal}>
                    <TouchableOpacity style={s.zoomClose} onPress={() => setImgZoom(false)}>
                        <Ionicons name="close" size={22} color="white" />
                    </TouchableOpacity>
                    <Image
                        source={{ uri: images[activeImg] }}
                        style={{ width: width, height: width }}
                        resizeMode="contain"
                    />
                    <Text style={s.zoomCaption}>{product.name}</Text>
                    <View style={s.zoomDots}>
                        {images.map((_, i) => (
                            <View key={i} style={[s.dot3, { backgroundColor: i === activeImg ? 'white' : 'rgba(255,255,255,0.35)', width: i === activeImg ? 18 : 6 }]} />
                        ))}
                    </View>
                </View>
            </Modal>

            {/* ── BOTTOM ACTION BAR ── */}
            <View style={[s.bottomBar, { paddingBottom: (insets.bottom || 0) + 8 }]}>
                {/* Qty stepper */}
                <View style={s.stepper}>
                    <TouchableOpacity style={s.stepBtn} onPress={() => handleQty(-1)}>
                        <Ionicons name="remove" size={14} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={s.stepNum}>{quantity}</Text>
                    <TouchableOpacity style={s.stepBtn} onPress={() => handleQty(1)}>
                        <Ionicons name="add" size={14} color="#0F172A" />
                    </TouchableOpacity>
                </View>

                {/* Chat */}
                <TouchableOpacity style={[s.chatIconBtn, { borderColor: catColor + '40', backgroundColor: catColor + '10' }]} onPress={handleChat}>
                    <Ionicons name={isOwner ? 'create-outline' : 'chatbubble-ellipses-outline'} size={17} color={isOwner ? '#16A34A' : catColor} />
                </TouchableOpacity>

                {/* Add to cart */}
                <Animated.View style={{ flex: 1, transform: [{ scale: cartScale }] }}>
                    <TouchableOpacity
                        style={[s.cartBtn, cartDone && s.cartBtnOk, isOutOfStock && s.cartBtnOos,
                            !cartDone && !isOutOfStock && { backgroundColor: catColor }]}
                        onPress={handleCart} activeOpacity={0.88}>
                        <Ionicons name={cartDone ? 'checkmark-circle' : isOutOfStock ? 'close-circle-outline' : 'bag-add-outline'} size={16} color="white" />
                        <Text style={s.cartBtnTxt}>
                            {cartDone ? 'Added!' : isOutOfStock ? 'Out of Stock' : `Add · ${fmtPrice(finalP * quantity)}`}
                        </Text>
                    </TouchableOpacity>
                </Animated.View>
            </View>
        </View>
    );
};

// ─────────────────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#F0F3FA' },

    header: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: 12, paddingBottom: 10, gap: 8,
        elevation: 4,
    },
    hBtn: {
        width: 28, height: 28, borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center', justifyContent: 'center',
    },
    hBtnLiked: { backgroundColor: 'rgba(239,68,68,0.25)' },
    hTitle:    { flex: 1, color: 'white', fontWeight: '700', fontSize: 11.5 },
    brandDot:  { width: 6, height: 6, borderRadius: 3 },

    accentStrip: { height: 2, backgroundColor: '#1E293B', overflow: 'hidden' },
    accentFill:  { height: 2, width: '40%', borderRadius: 1 },

    // Image
    imgSection: { backgroundColor: '#FFFFFF', minHeight: 165, borderBottomWidth: 0.8, borderBottomColor: '#EEF2F8', position: 'relative', paddingBottom: 6 },
    cornerTL:   { position: 'absolute', top: 0, left: 0, width: 45, height: 45 },
    cornerBR:   { position: 'absolute', bottom: 6, right: 0, width: 30, height: 30 },
    catWatermark: { position: 'absolute', bottom: 30, right: 8, fontSize: 28, fontWeight: '900', zIndex: 0 },
    imgSlide:   { width, height: 155, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
    productImg: { width: '100%', height: '100%' },
    imgPlaceholder: { height: 155, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },

    // Out of stock overlay
    outOfStockOverlay: {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 20,
        backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center',
    },
    outOfStockTxt: { color: 'white', fontSize: 15, fontWeight: '900', letterSpacing: 2 },

    // Zoom hint
    zoomHint: {
        position: 'absolute', bottom: 6, right: 8,
        flexDirection: 'row', alignItems: 'center', gap: 3,
        backgroundColor: 'rgba(0,0,0,0.3)',
        paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6,
    },
    zoomHintTxt: { color: 'rgba(255,255,255,0.9)', fontSize: 8, fontWeight: '600' },

    // Badges
    imgBadgesRow: { position: 'absolute', top: 8, left: 8, zIndex: 10, flexDirection: 'row', gap: 4 },
    discBadge:    { backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    discBadgeTxt: { color: 'white', fontSize: 8.5, fontWeight: '900' },

    imgTopRight: { position: 'absolute', top: 8, right: 8, zIndex: 10, gap: 4, alignItems: 'flex-end' },
    compPill: {
        flexDirection: 'row', alignItems: 'center', gap: 2.5,
        backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2.5, borderRadius: 8,
        borderWidth: 0.8, borderColor: '#E2E8F0',
    },
    compPillTxt: { fontSize: 8.5, fontWeight: '700', color: '#94A3B8' },
    imgCounter:  { backgroundColor: 'rgba(0,0,0,0.35)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
    imgCounterTxt: { color: 'white', fontSize: 8.5, fontWeight: '700' },

    thumbRow:   { flexDirection: 'row', gap: 5, paddingHorizontal: 12, paddingTop: 6 },
    thumb:      { width: 32, height: 32, borderRadius: 6, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', overflow: 'hidden', padding: 2 },

    // Card
    card: {
        backgroundColor: 'white',
        borderTopLeftRadius: 18, borderTopRightRadius: 18,
        marginTop: -12, paddingHorizontal: 12, paddingTop: 8,
        elevation: 3, shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.05, shadowRadius: 6,
    },
    handle:    { width: 28, height: 2.5, borderRadius: 1.5, alignSelf: 'center', marginBottom: 8 },
    decorDots: { flexDirection: 'row', gap: 3, alignItems: 'center', marginBottom: 8 },
    dot3:      { width: 6, height: 3, borderRadius: 1.5, backgroundColor: '#E2E8F0' },

    // Name
    nameRow:  { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
    name:     { fontSize: 16.5, fontWeight: '900', color: '#0F172A', lineHeight: 22 },
    catTag:   { flexDirection: 'row', alignItems: 'center', gap: 2.5, alignSelf: 'flex-start', marginTop: 3, paddingHorizontal: 5, paddingVertical: 1.5, borderRadius: 5, borderWidth: 0.8 },
    catTagTxt: { fontSize: 8.5, fontWeight: '800' },
    rBadge:   { flexDirection: 'row', alignItems: 'center', gap: 2, backgroundColor: '#FFFBEB', paddingHorizontal: 5, paddingVertical: 3, borderRadius: 6, alignSelf: 'flex-start', borderWidth: 0.8, borderColor: '#FDE68A' },
    rNum:     { fontSize: 10, fontWeight: '800', color: '#92400E' },
    rCnt:     { fontSize: 9, color: '#B45309' },

    // Price
    priceSection: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, paddingLeft: 8, borderLeftWidth: 2 },
    priceLeft:    {},
    price:        { fontSize: 21, fontWeight: '900' },
    oldPrice:     { fontSize: 10.5, color: '#CBD5E1', textDecorationLine: 'line-through', marginTop: 1 },
    savingBadge:  { flexDirection: 'row', alignItems: 'center', gap: 2.5, backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5, borderWidth: 0.8, borderColor: '#86EFAC' },
    savingTxt:    { color: '#16A34A', fontWeight: '800', fontSize: 9.5 },
    promoBadge:   { flexDirection: 'row', alignItems: 'center', gap: 2.5, backgroundColor: '#FEF9C3', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
    promoTxt:     { color: '#92400E', fontWeight: '800', fontSize: 9.5 },

    // Stock bar
    stockBar: { marginBottom: 10, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 8, borderWidth: 0.8, borderColor: '#EEF2F8' },
    stockLbl: { fontSize: 10.5, fontWeight: '700', color: '#374151' },
    stockPct: { fontSize: 9.5, fontWeight: '700' },
    stockTrack: { height: 4, backgroundColor: '#E5E7EB', borderRadius: 2 },
    stockFill:  { height: 4, borderRadius: 2 },

    // Delivery card
    deliveryCard: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 8, marginBottom: 10,
        backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 0.8, borderColor: '#EEF2F8',
    },
    delivIcon:  { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' },
    delivTitle: { fontSize: 11, fontWeight: '800', color: '#0F172A', marginBottom: 1 },
    delivSub:   { fontSize: 9, color: '#64748B' },
    freeTag:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5, borderWidth: 0.8 },
    freeTxt:    { fontSize: 8.5, fontWeight: '900' },

    // Trust badges
    trustRow:  { flexDirection: 'row', gap: 5, marginBottom: 10 },
    trustBadge:{ flex: 1, alignItems: 'center', padding: 6, backgroundColor: '#F8FAFC', borderRadius: 8, gap: 3, borderWidth: 0.8, borderColor: '#EEF2F8' },
    trustTxt:  { fontSize: 8.5, color: '#475569', fontWeight: '600', textAlign: 'center' },

    div: { height: 0.8, backgroundColor: '#F1F5F9', marginVertical: 10 },

    // Section
    section:  { marginBottom: 10 },
    secRow:   { flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 6 },
    secBar:   { width: 2.5, height: 11, borderRadius: 1.5 },
    secLabel: { fontSize: 11, fontWeight: '800', color: '#0F172A' },

    // Variants
    varBtn:  { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#E2E8F0' },
    varTxt:  { color: '#64748B', fontWeight: '600', fontSize: 10 },

    // Highlights
    highlightBox: { gap: 4 },
    highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
    highlightDot: { width: 4, height: 4, borderRadius: 2, marginTop: 4, flexShrink: 0 },
    highlightTxt: { fontSize: 10, color: '#475569', lineHeight: 15, flex: 1 },

    // Vendor
    vendorSkeleton: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, marginBottom: 10, backgroundColor: '#F8FAFC', borderRadius: 10 },
    skelCircle: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#E2E8F0' },
    skelLine:   { height: 8, backgroundColor: '#E2E8F0', borderRadius: 4, width: '80%' },
    vendorCard: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 8, marginBottom: 10, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 0.8, borderColor: '#EEF2F8' },
    vendorAv:   { width: 28, height: 28, borderRadius: 14, backgroundColor: '#EEF2FF', overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
    vendorName: { fontSize: 11, fontWeight: '800', color: '#0F172A' },
    vendorRole: { fontSize: 9, color: '#94A3B8' },
    officialBadge: { paddingHorizontal: 3.5, paddingVertical: 1, borderRadius: 3.5 },
    officialTxt:   { fontSize: 7.5, fontWeight: '900' },
    vendorActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 2.5, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6, borderWidth: 0.8, borderColor: '#E2E8F0' },
    vendorActionTxt: { fontSize: 9, fontWeight: '800' },

    // Description
    desc:       { fontSize: 10.5, color: '#64748B', lineHeight: 16 },
    readMoreBtn: { marginTop: 4, paddingVertical: 3.5, paddingHorizontal: 8, borderRadius: 6, borderWidth: 0.8, alignSelf: 'flex-start' },
    readMoreTxt: { fontWeight: '700', fontSize: 10 },

    // Spec
    specCard: { marginBottom: 10, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 0.8, borderColor: '#EEF2F8' },
    specRow:  { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4.5 },
    specK:    { fontSize: 9.5, color: '#94A3B8', fontWeight: '600' },
    specV:    { fontSize: 9.5, color: '#0F172A', fontWeight: '700' },

    // Price alert toggle
    priceAlertBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        padding: 8, marginBottom: 10,
        backgroundColor: '#F8FAFC', borderRadius: 10,
        borderWidth: 0.8, borderColor: '#EEF2F8',
    },
    priceAlertTxt: { fontSize: 11, fontWeight: '700', color: '#374151' },
    priceAlertSub: { fontSize: 9, color: '#94A3B8', marginTop: 0.5 },
    toggle: { width: 30, height: 18, borderRadius: 9, backgroundColor: '#E2E8F0', padding: 1.5, justifyContent: 'center' },
    toggleKnob: { width: 15, height: 15, borderRadius: 7.5, backgroundColor: 'white', elevation: 2 },

    // Rating
    ratingCard: { flexDirection: 'row', gap: 10, marginBottom: 10, padding: 8, backgroundColor: '#FFFBEB', borderRadius: 10, borderWidth: 0.8, borderColor: '#FDE68A', overflow: 'hidden', position: 'relative' },
    starBurst:  { position: 'absolute', right: -10, bottom: -10, zIndex: 0 },
    rBig: { fontSize: 24, fontWeight: '900', color: '#92400E' },
    barBg: { flex: 1, height: 3.5, backgroundColor: '#FDE68A', borderRadius: 1.75 },
    barFg: { height: 3.5, backgroundColor: '#F59E0B', borderRadius: 1.75 },

    // Video
    videoBox: { height: 145, borderRadius: 10, overflow: 'hidden', backgroundColor: '#000', elevation: 3, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 5 },

    // Share row
    shareRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10, padding: 8, backgroundColor: '#F8FAFC', borderRadius: 10, borderWidth: 0.8, borderColor: '#EEF2F8' },
    shareLbl: { fontSize: 9, color: '#94A3B8', fontWeight: '600' },
    shareBtn: { flex: 1, alignItems: 'center', gap: 2.5 },
    shareBtnTxt: { fontSize: 8.5, fontWeight: '700' },

    // Related
    relCard:    { width: 95, backgroundColor: 'white', borderRadius: 8, overflow: 'hidden', borderWidth: 0.8, borderColor: '#E8EDF5', elevation: 2 },
    relImgWrap: { width: '100%', height: 75, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' },
    relBadge:   { position: 'absolute', top: 3, left: 3, paddingHorizontal: 3, paddingVertical: 1, borderRadius: 3 },
    relName:    { fontSize: 9, fontWeight: '700', color: '#1E293B', marginBottom: 1 },
    relPrice:   { fontSize: 9.5, fontWeight: '900' },

    // Zoom modal
    zoomModal:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.95)', alignItems: 'center', justifyContent: 'center' },
    zoomClose:  { position: 'absolute', top: 40, right: 16, width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center', zIndex: 10 },
    zoomCaption:{ color: 'rgba(255,255,255,0.7)', fontSize: 10.5, marginTop: 15, textAlign: 'center' },
    zoomDots:   { flexDirection: 'row', gap: 4, marginTop: 10 },

    // Bottom bar
    bottomBar:  { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', paddingHorizontal: 12, paddingTop: 9, flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 0.8, borderTopColor: '#EEF2F8', elevation: 12 },
    stepper:    { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 11, borderWidth: 0.8, borderColor: '#E9EDF5', height: 38 },
    stepBtn:    { width: 30, height: 38, alignItems: 'center', justifyContent: 'center' },
    stepNum:    { fontSize: 13.5, fontWeight: '800', color: '#0F172A', paddingHorizontal: 4 },
    chatIconBtn:{ width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center', borderWidth: 0.8 },
    cartBtn:    { flex: 1, height: 38, borderRadius: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, elevation: 3 },
    cartBtnOk:  { backgroundColor: '#10B981' },
    cartBtnOos: { backgroundColor: '#94A3B8' },
    cartBtnTxt: { color: 'white', fontSize: 13, fontWeight: '800' },
});
