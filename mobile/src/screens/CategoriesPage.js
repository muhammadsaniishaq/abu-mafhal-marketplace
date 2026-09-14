import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    View, Text, TextInput, ScrollView,
    Image, StatusBar,
    RefreshControl, StyleSheet, Animated, Linking, Platform,
    Pressable, useWindowDimensions,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { supabase } from "../lib/supabase";

const RAIL_WIDTH = 82;

// Luxury Navy & Gold Palette
const C = {
    navyDark: "#071422",
    navy: "#0A192F",
    navyMid: "#0E2340",
    navyLight: "#162E52",
    navySubtle: "#1E3A66",
    gold: "#D9A73A",
    goldBright: "#F5C842",
    goldLight: "#FFFBEB",
    goldBorder: "rgba(217, 167, 58, 0.35)",
    goldGlow: "rgba(217, 167, 58, 0.16)",
    goldDark: "#A07820",
    white: "#FFFFFF",
    bgLight: "#F8FAFC",
    surface: "#FFFFFF",
    border: "#E2E8F0",
    borderSoft: "#F1F5F9",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    emerald: "#10B981",
    emeraldBg: "#ECFDF5",
    red: "#EF4444",
};

const CAT_IMGS = {
    "phones & tablets": "https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=300&auto=format&fit=crop",
    "fashion & apparel": "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=300&auto=format&fit=crop",
    "electronics & gadgets": "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=300&auto=format&fit=crop",
    "shoes & footwear": "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=300&auto=format&fit=crop",
    "beauty & health": "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=300&auto=format&fit=crop",
    "home & living": "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=300&auto=format&fit=crop",
    "automotive": "https://images.unsplash.com/photo-1503376780353-7e6692767b70?q=80&w=300&auto=format&fit=crop",
    "groceries & food": "https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=300&auto=format&fit=crop",
};

const BANNERS = {
    "phones & tablets": { banner: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?q=80&w=700&auto=format&fit=crop", tagline: "Up to 35% OFF Phones & Tablets", highlight: "Genuine Warranty" },
    "electronics & gadgets": { banner: "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=700&auto=format&fit=crop", tagline: "Laptops, Smart Audio & Tech", highlight: "100% Authentic" },
    "fashion & apparel": { banner: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?q=80&w=700&auto=format&fit=crop", tagline: "Trending Men & Women Styles", highlight: "Urban & Traditional" },
    "shoes & footwear": { banner: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=700&auto=format&fit=crop", tagline: "Sneakers, Sandals & Loafers", highlight: "Premium Comfort" },
    "beauty & health": { banner: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=700&auto=format&fit=crop", tagline: "Luxury Perfumes & Skin Care", highlight: "Original Brands" },
    "home & living": { banner: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=700&auto=format&fit=crop", tagline: "Modern Living Essentials", highlight: "Fast Delivery" },
};

const SUBCATS = {
    "phones & tablets": [{ n: "All", i: "apps", q: "" }, { n: "Phones", i: "phone-portrait-outline", q: "smartphone" }, { n: "iPhones", i: "logo-apple", q: "iphone" }, { n: "Tablets", i: "tablet-portrait-outline", q: "tablet" }, { n: "Audio", i: "headset-outline", q: "audio" }, { n: "Cases", i: "shield-outline", q: "case" }],
    "electronics & gadgets": [{ n: "All", i: "apps", q: "" }, { n: "Laptops", i: "laptop-outline", q: "laptop" }, { n: "Smart TVs", i: "tv-outline", q: "tv" }, { n: "Watches", i: "watch-outline", q: "watch" }, { n: "Cameras", i: "camera-outline", q: "camera" }, { n: "Gaming", i: "game-controller-outline", q: "gaming" }],
    "fashion & apparel": [{ n: "All", i: "apps", q: "" }, { n: "Men", i: "man-outline", q: "men" }, { n: "Women", i: "woman-outline", q: "women" }, { n: "Kaftan", i: "shirt-outline", q: "kaftan" }, { n: "Bags", i: "bag-handle-outline", q: "bag" }, { n: "Jewelry", i: "diamond-outline", q: "jewelry" }],
    "shoes & footwear": [{ n: "All", i: "apps", q: "" }, { n: "Sneakers", i: "footsteps-outline", q: "sneaker" }, { n: "Formal", i: "briefcase-outline", q: "formal" }, { n: "Sandals", i: "sunny-outline", q: "sandal" }, { n: "Boots", i: "shield-half-outline", q: "boot" }],
    "beauty & health": [{ n: "All", i: "apps", q: "" }, { n: "Skincare", i: "sparkles-outline", q: "skincare" }, { n: "Perfumes", i: "flower-outline", q: "perfume" }, { n: "Hair", i: "cut-outline", q: "hair" }, { n: "Makeup", i: "color-palette-outline", q: "makeup" }],
    "home & living": [{ n: "All", i: "apps", q: "" }, { n: "Kitchen", i: "restaurant-outline", q: "kitchen" }, { n: "Furniture", i: "bed-outline", q: "furniture" }, { n: "Decor", i: "moon-outline", q: "decor" }, { n: "Appliances", i: "power-outline", q: "appliance" }],
};

const EMOJI = {
    "phones & tablets": "📱",
    "electronics & gadgets": "💻",
    "fashion & apparel": "👗",
    "shoes & footwear": "👟",
    "beauty & health": "💄",
    "home & living": "🏠",
    "automotive": "🚗",
    "groceries & food": "🛒",
    "sports & fitness": "🏋️",
    "baby & kids": "👶"
};

const getCatImg = (cat) => {
    if (cat?.image_url) return cat.image_url;
    const k = (cat?.name || "").toLowerCase().trim();
    for (const [key, img] of Object.entries(CAT_IMGS)) {
        if (k.includes(key) || key.includes(k)) return img;
    }
    return "https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=300&auto=format&fit=crop";
};

const getBanner = (cat) => {
    const k = (cat?.name || "").toLowerCase().trim();
    for (const [key, b] of Object.entries(BANNERS)) {
        if (k.includes(key) || key.includes(k)) return b;
    }
    return {
        banner: getCatImg(cat),
        tagline: `Shop ${cat?.name || "Verified"} Products`,
        highlight: "Escrow Protected"
    };
};

const getSubcats = (cat) => {
    const k = (cat?.name || "").toLowerCase().trim();
    for (const [key, list] of Object.entries(SUBCATS)) {
        if (k.includes(key) || key.includes(k)) return list;
    }
    return [
        { n: "All", i: "apps", q: "" },
        { n: "Popular", i: "star-outline", q: "popular" },
        { n: "Deals", i: "pricetag-outline", q: "deals" },
        { n: "New", i: "sparkles-outline", q: "new" }
    ];
};

const getEmoji = (cat) => {
    const k = (cat?.name || "").toLowerCase().trim();
    for (const [key, em] of Object.entries(EMOJI)) {
        if (k.includes(key) || key.includes(k)) return em;
    }
    return "🛍️";
};

const fmtN = (n) => {
    const x = Number(n);
    return x ? `₦${x.toLocaleString()}` : "₦0";
};

const getProdImg = (p) => {
    if (p?.image_url) return p.image_url;
    if (Array.isArray(p?.images) && p.images.length > 0) return p.images[0];
    if (typeof p?.images === "string") {
        try {
            const a = JSON.parse(p.images);
            if (Array.isArray(a) && a.length > 0) return a[0];
        } catch (_) {}
        return p.images;
    }
    return "https://images.unsplash.com/photo-1523275335684-37898b6baf30?q=80&w=300&auto=format&fit=crop";
};

// Shimmer placeholder
const Shimmer = ({ style }) => {
    const a = useRef(new Animated.Value(0)).current;
    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(a, { toValue: 1, duration: 800, useNativeDriver: true }),
                Animated.timing(a, { toValue: 0, duration: 800, useNativeDriver: true })
            ])
        ).start();
    }, []);
    return (
        <Animated.View
            style={[
                { backgroundColor: "#E2E8F0", borderRadius: 8 },
                style,
                { opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.75] }) }
            ]}
        />
    );
};

const Skeleton = () => (
    <View style={{ flex: 1, flexDirection: "row", backgroundColor: C.bgLight }}>
        <View style={{ width: RAIL_WIDTH, backgroundColor: "#FFFFFF", paddingTop: 10, borderRightWidth: 1, borderRightColor: C.border }}>
            {[1, 2, 3, 4, 5, 6].map(i => (
                <View key={i} style={{ paddingVertical: 10, alignItems: "center", gap: 6 }}>
                    <Shimmer style={{ width: 44, height: 44, borderRadius: 14 }} />
                    <Shimmer style={{ width: 50, height: 8, borderRadius: 4 }} />
                </View>
            ))}
        </View>
        <View style={{ flex: 1, padding: 12, gap: 12 }}>
            <Shimmer style={{ height: 115, borderRadius: 16 }} />
            <Shimmer style={{ height: 30, borderRadius: 15 }} />
            <View style={{ flexDirection: "row", gap: 8 }}>
                <Shimmer style={{ flex: 1, height: 160, borderRadius: 14 }} />
                <Shimmer style={{ flex: 1, height: 160, borderRadius: 14 }} />
            </View>
        </View>
    </View>
);

// Rail Item Component
const RailItem = React.memo(({ cat, isSelected, count, onPress }) => {
    const sc = useRef(new Animated.Value(1)).current;
    const press = () => {
        Animated.sequence([
            Animated.timing(sc, { toValue: 0.92, duration: 60, useNativeDriver: true }),
            Animated.spring(sc, { toValue: 1, speed: 30, bounciness: 8, useNativeDriver: true })
        ]).start();
        onPress();
    };

    return (
        <Pressable onPress={press} style={[s.rItem, isSelected && s.rItemActive]}>
            {isSelected && <View style={s.rPill} />}
            <Animated.View style={[s.rImgBox, isSelected && s.rImgBoxActive, { transform: [{ scale: sc }] }]}>
                <Image source={{ uri: getCatImg(cat) }} style={s.rImg} />
            </Animated.View>
            <Text numberOfLines={2} style={[s.rLbl, isSelected && s.rLblActive]}>
                {cat.name}
            </Text>
            {count > 0 && (
                <View style={[s.rCount, isSelected && s.rCountActive]}>
                    <Text style={[s.rCountTxt, isSelected && s.rCountTxtActive]}>{count}</Text>
                </View>
            )}
        </Pressable>
    );
});

// Compact Product Card for Showcase
const ProdCard = React.memo(({ prod, onPress, onAdd, cardWidth }) => {
    const sc = useRef(new Animated.Value(1)).current;
    const addSc = useRef(new Animated.Value(1)).current;
    const hasDisc = Number(prod.compare_at_price) > Number(prod.price);
    const pct = hasDisc ? Math.round(((Number(prod.compare_at_price) - Number(prod.price)) / Number(prod.compare_at_price)) * 100) : 0;

    const onIn = () => Animated.spring(sc, { toValue: 0.95, speed: 50, useNativeDriver: true }).start();
    const onOut = () => Animated.spring(sc, { toValue: 1, speed: 50, useNativeDriver: true }).start();

    const doAdd = () => {
        Animated.sequence([
            Animated.timing(addSc, { toValue: 1.35, duration: 90, useNativeDriver: true }),
            Animated.spring(addSc, { toValue: 1, speed: 25, bounciness: 12, useNativeDriver: true })
        ]).start();
        onAdd && onAdd(prod);
    };

    return (
        <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={{ width: cardWidth }}>
            <Animated.View style={[s.pCard, { transform: [{ scale: sc }] }]}>
                <View style={s.pImgBox}>
                    <Image source={{ uri: getProdImg(prod) }} style={s.pImg} resizeMode="cover" />
                    {hasDisc && (
                        <View style={s.pDisc}>
                            <Text style={s.pDiscTxt}>-{pct}%</Text>
                        </View>
                    )}
                </View>
                <View style={s.pBody}>
                    <Text numberOfLines={2} style={s.pName}>{prod.name}</Text>
                    {prod.rating > 0 && (
                        <View style={s.ratingRow}>
                            <Ionicons name="star" size={9} color={C.gold} />
                            <Text style={s.ratingTxt}>{Number(prod.rating).toFixed(1)}</Text>
                        </View>
                    )}
                    <View style={s.pFooter}>
                        <View style={{ flex: 1 }}>
                            <Text numberOfLines={1} style={s.pPrice}>{fmtN(prod.price)}</Text>
                            {hasDisc && <Text numberOfLines={1} style={s.strikeP}>{fmtN(prod.compare_at_price)}</Text>}
                        </View>
                        <Pressable onPress={doAdd} hitSlop={6}>
                            <Animated.View style={[s.addBtn, { transform: [{ scale: addSc }] }]}>
                                <Ionicons name="add" size={15} color={C.navy} />
                            </Animated.View>
                        </Pressable>
                    </View>
                </View>
            </Animated.View>
        </Pressable>
    );
});

// Subcategory Chip
const Chip = React.memo(({ sub, isActive, onPress }) => {
    const sc = useRef(new Animated.Value(1)).current;
    const tap = () => {
        Animated.sequence([
            Animated.timing(sc, { toValue: 0.9, duration: 60, useNativeDriver: true }),
            Animated.spring(sc, { toValue: 1, speed: 30, bounciness: 8, useNativeDriver: true })
        ]).start();
        onPress();
    };

    return (
        <Pressable onPress={tap}>
            <Animated.View style={[s.chip, isActive && s.chipActive, { transform: [{ scale: sc }] }]}>
                <Ionicons
                    name={sub.i || "apps"}
                    size={11}
                    color={isActive ? C.gold : C.textSecondary}
                    style={{ marginRight: 4 }}
                />
                <Text style={[s.chipTxt, isActive && s.chipTxtActive]}>{sub.n}</Text>
            </Animated.View>
        </Pressable>
    );
});

// Full Grid Category Card
const GridCatCard = React.memo(({ cat, count, cardWidth, onPress }) => {
    const sc = useRef(new Animated.Value(1)).current;
    const onIn = () => Animated.spring(sc, { toValue: 0.94, speed: 50, useNativeDriver: true }).start();
    const onOut = () => Animated.spring(sc, { toValue: 1, speed: 50, useNativeDriver: true }).start();

    return (
        <Pressable onPress={onPress} onPressIn={onIn} onPressOut={onOut} style={{ width: cardWidth, marginBottom: 10 }}>
            <Animated.View style={[s.gCard, { transform: [{ scale: sc }] }]}>
                <View style={s.gImgBox}>
                    <Image source={{ uri: getCatImg(cat) }} style={s.gImg} resizeMode="cover" />
                    <LinearGradient
                        colors={["transparent", "rgba(10,25,47,0.88)"]}
                        style={StyleSheet.absoluteFillObject}
                        start={{ x: 0, y: 0.3 }}
                        end={{ x: 0, y: 1 }}
                    />
                    <Text style={s.gEmoji}>{getEmoji(cat)}</Text>
                </View>
                <View style={s.gInfo}>
                    <Text numberOfLines={2} style={s.gTitle}>{cat.name}</Text>
                    <Text style={s.gCount}>{count > 0 ? `${count} items` : "Explore"}</Text>
                </View>
            </Animated.View>
        </Pressable>
    );
});

// ══════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════
export const CategoriesPage = ({
    onSelectCategory,
    onGoToCart,
    cartCount = 0,
    onProductClick,
    onAddToCart,
    onGoToShop,
    onNavigate
}) => {
    const { width: windowWidth } = useWindowDimensions();
    const [sq, setSq] = useState("");
    const [vm, setVm] = useState("explorer"); // "explorer" | "grid"
    const [cats, setCats] = useState([]);
    const [selCat, setSelCat] = useState(null);
    const [activeSub, setActiveSub] = useState(null);
    const [prods, setProds] = useState([]);
    const [counts, setCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [toastMsg, setToastMsg] = useState("");

    const toastA = useRef(new Animated.Value(0)).current;
    const cartA = useRef(new Animated.Value(1)).current;
    const modeA = useRef(new Animated.Value(0)).current;
    const sfA = useRef(new Animated.Value(0)).current;

    const toast = (msg) => {
        setToastMsg(msg);
        Animated.sequence([
            Animated.spring(toastA, { toValue: 1, speed: 22, bounciness: 10, useNativeDriver: true }),
            Animated.delay(1800),
            Animated.timing(toastA, { toValue: 0, duration: 200, useNativeDriver: true })
        ]).start();
    };

    const bounceCart = () => {
        Animated.sequence([
            Animated.timing(cartA, { toValue: 1.3, duration: 90, useNativeDriver: true }),
            Animated.spring(cartA, { toValue: 1, speed: 24, bounciness: 10, useNativeDriver: true })
        ]).start();
    };

    const switchVm = (m) => {
        Animated.timing(modeA, {
            toValue: m === "explorer" ? 0 : 1,
            duration: 180,
            useNativeDriver: false
        }).start();
        setVm(m);
    };

    useEffect(() => {
        fetchD();
        const ch = supabase.channel("cats-live-modern")
            .on("postgres_changes", { event: "*", schema: "public", table: "categories" }, () => fetchD(true))
            .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => fetchD(true))
            .subscribe();
        return () => supabase.removeChannel(ch);
    }, []);

    const fetchD = async (silent = false) => {
        if (!silent) setLoading(true);
        try {
            const [cr, pr] = await Promise.allSettled([
                supabase.from("categories").select("*").eq("is_active", true).order("display_order", { ascending: true, nullsFirst: false }),
                supabase.from("products").select("id,name,description,price,compare_at_price,image_url,images,category,rating,reviews,stock,total_sales,status,created_at").eq("status", "approved").order("created_at", { ascending: false }).limit(150),
            ]);
            const cl = cr.status === "fulfilled" && Array.isArray(cr.value?.data) ? cr.value.data : [];
            const pl = pr.status === "fulfilled" && Array.isArray(pr.value?.data) ? pr.value.data : [];
            setCats(cl);
            setProds(pl);

            const c = {};
            pl.forEach(p => {
                if (p.category) {
                    const k = p.category.toLowerCase().trim();
                    c[k] = (c[k] || 0) + 1;
                }
            });
            setCounts(c);

            setSelCat(prev => {
                if (!prev && cl.length > 0) return cl[0];
                if (prev) return cl.find(c => c.id === prev.id) || cl[0];
                return prev;
            });
        } catch (e) {
            console.log("[CategoriesPage]", e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchD(true);
    };

    const doWA = (cat) => {
        const m = encodeURIComponent(`Assalamu Alaikum Abu Mafhal, I need assistance finding products under "${cat?.name || "Categories"}".`);
        Linking.openURL(`https://wa.me/2349021486162?text=${m}`).catch(() => {});
    };

    const doAdd = (p) => {
        if (onAddToCart) {
            onAddToCart(p);
            bounceCart();
            toast(`Added to cart: ${p.name}`);
        }
    };

    const doSel = useCallback((cat) => {
        setSelCat(cat);
        setActiveSub(null);
    }, []);

    const fCats = cats.filter(c => (c.name || "").toLowerCase().includes(sq.toLowerCase()));

    const fProds = prods.filter(p => {
        if (!selCat) return true;
        const cn = (selCat.name || "").toLowerCase().trim();
        const pc = (p.category || "").toLowerCase().trim();
        if (!(pc.includes(cn) || cn.includes(pc))) return false;
        if (activeSub?.q) {
            const q = activeSub.q.toLowerCase();
            return (p.name || "").toLowerCase().includes(q) || (p.description || "").toLowerCase().includes(q);
        }
        return true;
    });

    const subs = selCat ? getSubcats(selCat) : [];
    const banner = selCat ? getBanner(selCat) : null;
    const emoji = selCat ? getEmoji(selCat) : "🛍️";

    // Safe dynamic responsive width calculations
    const showcaseWidth = Math.max(160, windowWidth - RAIL_WIDTH - 24); // 24 = showcase padding horizontal
    const cardWidth = Math.max(105, Math.floor((showcaseWidth - 8) / 2)); // 2 columns with 8px gap
    const gridCardWidth = Math.max(95, Math.floor((windowWidth - 32 - 16) / 3)); // 3 columns for grid view

    // Fixed slider position for mode toggle: width 72, button 34 each, slider 32 wide
    const sliderLeft = modeA.interpolate({
        inputRange: [0, 1],
        outputRange: [2, 36]
    });

    const searchBorderColor = sfA.interpolate({
        inputRange: [0, 1],
        outputRange: ["rgba(255,255,255,0.2)", C.gold]
    });

    const safePaddingTop = Platform.OS === "ios" ? 50 : Platform.OS === "web" ? 14 : (StatusBar.currentHeight || 24) + 8;

    return (
        <View style={s.root}>
            <StatusBar barStyle="light-content" backgroundColor={C.navy} translucent />

            {/* HEADER - Navy & Gold Luxury Header */}
            <LinearGradient
                colors={[C.navyDark, C.navy, C.navyMid]}
                style={[s.hdr, { paddingTop: safePaddingTop }]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            >
                {/* Brand Row */}
                <View style={s.hRow}>
                    <View style={s.brandBox}>
                        <LinearGradient colors={[C.goldBright, C.goldDark]} style={s.logo} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                            <Ionicons name="bag-handle" size={17} color={C.navyDark} />
                        </LinearGradient>
                        <View style={s.brandTitles}>
                            <Text style={s.bTitle} numberOfLines={1}>
                                ABU <Text style={s.bAccent}>MAFHAL</Text>
                            </Text>
                            <Text style={s.bSub}>Departments & Categories</Text>
                        </View>
                    </View>

                    <View style={s.hActions}>
                        {/* Mode Toggle Slider (Fixed pixel bounds to prevent boundary overflow) */}
                        <View style={s.modeWrap}>
                            <Animated.View style={[s.mSlider, { left: sliderLeft }]} />
                            <Pressable onPress={() => switchVm("explorer")} style={s.mBtn}>
                                <Ionicons name="layers" size={13} color={vm === "explorer" ? C.navy : C.textMuted} />
                            </Pressable>
                            <Pressable onPress={() => switchVm("grid")} style={s.mBtn}>
                                <Ionicons name="grid" size={13} color={vm === "grid" ? C.navy : C.textMuted} />
                            </Pressable>
                        </View>

                        {/* Cart Button with Gold Accent */}
                        <Pressable onPress={onGoToCart} style={s.cartPress}>
                            <Animated.View style={[s.cartBtn, { transform: [{ scale: cartA }] }]}>
                                <Ionicons name="cart" size={18} color={C.white} />
                                {cartCount > 0 && (
                                    <View style={s.cartBadge}>
                                        <Text style={s.cartBTxt}>{cartCount > 99 ? "99+" : cartCount}</Text>
                                    </View>
                                )}
                            </Animated.View>
                        </Pressable>
                    </View>
                </View>

                {/* Search Bar */}
                <Animated.View style={[s.searchWrap, { borderColor: searchBorderColor }]}>
                    <Ionicons name="search" size={16} color={C.gold} />
                    <TextInput
                        placeholder="Search departments, categories..."
                        placeholderTextColor="#94A3B8"
                        value={sq}
                        onChangeText={setSq}
                        style={s.searchInput}
                        onFocus={() => Animated.timing(sfA, { toValue: 1, duration: 150, useNativeDriver: false }).start()}
                        onBlur={() => Animated.timing(sfA, { toValue: 0, duration: 150, useNativeDriver: false }).start()}
                    />
                    {sq.length > 0 && (
                        <Pressable onPress={() => setSq("")} hitSlop={10}>
                            <Ionicons name="close-circle" size={16} color="#94A3B8" />
                        </Pressable>
                    )}
                </Animated.View>
            </LinearGradient>

            {/* BODY SECTION */}
            {loading && !refreshing ? (
                <Skeleton />
            ) : vm === "explorer" ? (
                /* DUAL-PANE EXPLORER VIEW */
                <View style={s.exWrap}>
                    {/* LEFT CATEGORY RAIL */}
                    <ScrollView
                        style={s.rail}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={s.railContent}
                    >
                        {fCats.map((cat) => (
                            <RailItem
                                key={cat.id}
                                cat={cat}
                                isSelected={selCat?.id === cat.id}
                                count={counts[(cat.name || "").toLowerCase().trim()] || 0}
                                onPress={() => doSel(cat)}
                            />
                        ))}
                    </ScrollView>

                    {/* RIGHT SHOWCASE PANE */}
                    <ScrollView
                        style={s.show}
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={s.showContent}
                        refreshControl={
                            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} colors={[C.gold]} />
                        }
                    >
                        {selCat && (
                            <>
                                {/* Hero Category Banner */}
                                <Pressable
                                    onPress={() => onSelectCategory ? onSelectCategory(selCat.name) : onGoToShop && onGoToShop(selCat.name)}
                                    style={s.hero}
                                >
                                    <Image source={{ uri: banner.banner }} style={s.heroImg} />
                                    <LinearGradient
                                        colors={["rgba(10,25,47,0.35)", "rgba(10,25,47,0.85)", "rgba(10,25,47,0.98)"]}
                                        style={StyleSheet.absoluteFillObject}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 0, y: 1 }}
                                    />
                                    <View style={s.heroContent}>
                                        <View style={s.heroBadge}>
                                            <Ionicons name="shield-checkmark" size={10} color={C.gold} />
                                            <Text style={s.heroBadgeTxt}>{banner.highlight}</Text>
                                        </View>
                                        <View>
                                            <Text style={s.heroTitle} numberOfLines={1}>
                                                {emoji} {selCat.name}
                                            </Text>
                                            <Text style={s.heroSub} numberOfLines={1}>
                                                {banner.tagline}
                                            </Text>
                                        </View>
                                        <View style={s.heroCta}>
                                            <Text style={s.heroCtaTxt}>Shop All</Text>
                                            <Ionicons name="arrow-forward" size={11} color={C.navyDark} />
                                        </View>
                                    </View>
                                </Pressable>

                                {/* Subcategories Filter Chips */}
                                <View style={s.subcatSec}>
                                    <View style={s.secHeader}>
                                        <View style={s.secDot} />
                                        <Text style={s.secTitle}>EXPLORE SUB-ITEMS</Text>
                                    </View>
                                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chipRow}>
                                        {subs.map((sub, i) => (
                                            <Chip
                                                key={i}
                                                sub={sub}
                                                isActive={activeSub?.n === sub.n || (!activeSub && i === 0)}
                                                onPress={() => sub.q === "" ? setActiveSub(null) : setActiveSub(sub)}
                                            />
                                        ))}
                                    </ScrollView>
                                </View>

                                {/* In-Stock Products Grid */}
                                <View style={s.prodSec}>
                                    <View style={s.prodHeader}>
                                        <View style={s.secHeader}>
                                            <View style={s.secDot} />
                                            <Text style={s.secTitle}>IN-STOCK</Text>
                                            <View style={s.cBubble}>
                                                <Text style={s.cBubbleTxt}>{fProds.length}</Text>
                                            </View>
                                        </View>
                                        <Pressable
                                            onPress={() => onSelectCategory ? onSelectCategory(selCat.name) : onGoToShop && onGoToShop(selCat.name)}
                                            style={s.seeAll}
                                        >
                                            <Text style={s.seeAllTxt}>View all</Text>
                                            <Ionicons name="chevron-forward" size={11} color={C.goldDark} />
                                        </Pressable>
                                    </View>

                                    {fProds.length === 0 ? (
                                        <View style={s.emptyBox}>
                                            <Text style={{ fontSize: 28, marginBottom: 4 }}>📦</Text>
                                            <Text style={s.emptyT}>No items under this filter</Text>
                                            <Text style={s.emptyS}>Try selecting another subcategory</Text>
                                            <Pressable
                                                onPress={() => onSelectCategory ? onSelectCategory(selCat.name) : onGoToShop && onGoToShop(selCat.name)}
                                                style={s.emptyBtn}
                                            >
                                                <Text style={s.emptyBtnT}>Browse Category</Text>
                                            </Pressable>
                                        </View>
                                    ) : (
                                        <View style={s.prodGrid}>
                                            {fProds.slice(0, 10).map((p) => (
                                                <ProdCard
                                                    key={p.id}
                                                    prod={p}
                                                    cardWidth={cardWidth}
                                                    onPress={() => onProductClick && onProductClick(p)}
                                                    onAdd={doAdd}
                                                />
                                            ))}
                                        </View>
                                    )}
                                </View>

                                {/* WhatsApp Concierge Help */}
                                <Pressable onPress={() => doWA(selCat)} style={s.waCard}>
                                    <View style={s.waIcon}>
                                        <Ionicons name="logo-whatsapp" size={18} color="#25D366" />
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={s.waTitle}>Need help with {selCat.name}?</Text>
                                        <Text style={s.waSub}>Chat with Abu Mafhal Escrow Assistant</Text>
                                    </View>
                                    <Ionicons name="chevron-forward" size={14} color="#059669" />
                                </Pressable>
                                <View style={{ height: 20 }} />
                            </>
                        )}
                    </ScrollView>
                </View>
            ) : (
                /* FULL GRID VIEW MODE */
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={s.gridCont}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.gold} colors={[C.gold]} />
                    }
                >
                    {/* Luxury Stats Bar */}
                    <LinearGradient
                        colors={[C.navyDark, C.navyMid]}
                        style={s.statsBar}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                    >
                        <View style={s.statItem}>
                            <Text style={s.statNum}>{fCats.length}</Text>
                            <Text style={s.statLbl}>Departments</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statItem}>
                            <Text style={s.statNum}>{prods.length}</Text>
                            <Text style={s.statLbl}>Products</Text>
                        </View>
                        <View style={s.statDivider} />
                        <View style={s.statItem}>
                            <Text style={[s.statNum, { color: C.goldBright }]}>100%</Text>
                            <Text style={s.statLbl}>Escrow Safe</Text>
                        </View>
                    </LinearGradient>

                    <View style={s.gridSectionHeader}>
                        <View style={s.secDot} />
                        <Text style={[s.secTitle, { color: C.textPrimary }]}>ALL DEPARTMENTS</Text>
                    </View>

                    <View style={s.gridContainer}>
                        {fCats.map((cat) => (
                            <GridCatCard
                                key={cat.id}
                                cat={cat}
                                cardWidth={gridCardWidth}
                                count={counts[(cat.name || "").toLowerCase().trim()] || 0}
                                onPress={() => {
                                    doSel(cat);
                                    switchVm("explorer");
                                }}
                            />
                        ))}
                    </View>
                </ScrollView>
            )}

            {/* TOAST MESSAGE */}
            <Animated.View
                pointerEvents="none"
                style={[
                    s.toast,
                    {
                        opacity: toastA,
                        transform: [{
                            translateY: toastA.interpolate({
                                inputRange: [0, 1],
                                outputRange: [16, 0]
                            })
                        }]
                    }
                ]}
            >
                <View style={s.toastIn}>
                    <Ionicons name="checkmark-circle" size={16} color={C.gold} />
                    <Text style={s.toastTxt} numberOfLines={1}>{toastMsg}</Text>
                </View>
            </Animated.View>
        </View>
    );
};

const s = StyleSheet.create({
    root: {
        flex: 1,
        backgroundColor: C.bgLight
    },

    // ─── Header ───
    hdr: {
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: "rgba(217, 167, 58, 0.2)",
    },
    hRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 10,
    },
    brandBox: {
        flexDirection: "row",
        alignItems: "center",
        gap: 9,
        flexShrink: 1,
    },
    logo: {
        width: 34,
        height: 34,
        borderRadius: 10,
        alignItems: "center",
        justifyContent: "center",
        elevation: 3,
    },
    brandTitles: {
        flexShrink: 1,
    },
    bTitle: {
        color: C.white,
        fontSize: 14,
        fontWeight: "900",
        letterSpacing: 0.5,
    },
    bAccent: {
        color: C.gold,
    },
    bSub: {
        color: C.textMuted,
        fontSize: 9,
        fontWeight: "600",
        marginTop: 1,
    },
    hActions: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },

    // ─── Mode Toggle ───
    modeWrap: {
        width: 72,
        height: 32,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "rgba(255, 255, 255, 0.12)",
        position: "relative",
        flexDirection: "row",
        alignItems: "center",
        overflow: "hidden",
    },
    mSlider: {
        position: "absolute",
        top: 2,
        width: 32,
        height: 26,
        backgroundColor: C.gold,
        borderRadius: 6,
        zIndex: 0,
    },
    mBtn: {
        width: 34,
        height: 30,
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1,
    },

    // ─── Cart Button ───
    cartPress: {
        position: "relative",
    },
    cartBtn: {
        width: 34,
        height: 34,
        borderRadius: 10,
        backgroundColor: "rgba(255, 255, 255, 0.08)",
        borderWidth: 1,
        borderColor: "rgba(217, 167, 58, 0.35)",
        alignItems: "center",
        justifyContent: "center",
    },
    cartBadge: {
        position: "absolute",
        top: -4,
        right: -5,
        backgroundColor: C.gold,
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: 3,
        borderWidth: 1.5,
        borderColor: C.navyDark,
    },
    cartBTxt: {
        color: C.navyDark,
        fontSize: 8,
        fontWeight: "900",
    },

    // ─── Search ───
    searchWrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.white,
        borderRadius: 10,
        paddingHorizontal: 10,
        height: 38,
        borderWidth: 1.5,
        gap: 7,
    },
    searchInput: {
        flex: 1,
        fontSize: 12,
        color: C.textPrimary,
        fontWeight: "600",
        paddingVertical: 0,
    },

    // ─── Explorer Body ───
    exWrap: {
        flex: 1,
        flexDirection: "row",
    },

    // ─── Left Rail ───
    rail: {
        width: RAIL_WIDTH,
        backgroundColor: C.white,
        borderRightWidth: 1,
        borderRightColor: C.border,
    },
    railContent: {
        paddingTop: 4,
        paddingBottom: 100,
    },
    rItem: {
        paddingVertical: 9,
        paddingHorizontal: 4,
        alignItems: "center",
        position: "relative",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: C.borderSoft,
    },
    rItemActive: {
        backgroundColor: "#F1F5F9",
    },
    rPill: {
        position: "absolute",
        left: 0,
        top: 8,
        bottom: 8,
        width: 3.5,
        backgroundColor: C.gold,
        borderTopRightRadius: 3,
        borderBottomRightRadius: 3,
    },
    rImgBox: {
        width: 44,
        height: 44,
        borderRadius: 12,
        backgroundColor: C.bgLight,
        overflow: "hidden",
        marginBottom: 4,
        borderWidth: 1,
        borderColor: C.border,
    },
    rImgBoxActive: {
        borderColor: C.gold,
        borderWidth: 1.5,
    },
    rImg: {
        width: "100%",
        height: "100%",
        resizeMode: "cover",
    },
    rLbl: {
        fontSize: 9,
        fontWeight: "700",
        color: C.textSecondary,
        textAlign: "center",
        lineHeight: 12,
        paddingHorizontal: 2,
    },
    rLblActive: {
        color: C.navy,
        fontWeight: "900",
    },
    rCount: {
        marginTop: 3,
        backgroundColor: C.borderSoft,
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 6,
    },
    rCountActive: {
        backgroundColor: "rgba(217, 167, 58, 0.2)",
    },
    rCountTxt: {
        fontSize: 8,
        fontWeight: "800",
        color: C.textMuted,
    },
    rCountTxtActive: {
        color: C.goldDark,
    },

    // ─── Showcase Pane ───
    show: {
        flex: 1,
        backgroundColor: C.bgLight,
    },
    showContent: {
        padding: 12,
        paddingBottom: 110,
    },

    // ─── Hero Banner ───
    hero: {
        height: 115,
        borderRadius: 14,
        overflow: "hidden",
        marginBottom: 12,
        backgroundColor: C.navyDark,
        elevation: 3,
    },
    heroImg: {
        ...StyleSheet.absoluteFillObject,
        width: "100%",
        height: "100%",
        opacity: 0.45,
    },
    heroContent: {
        flex: 1,
        padding: 10,
        justifyContent: "space-between",
    },
    heroBadge: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        alignSelf: "flex-start",
        backgroundColor: "rgba(217, 167, 58, 0.2)",
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 5,
        borderWidth: 0.8,
        borderColor: "rgba(217, 167, 58, 0.4)",
    },
    heroBadgeTxt: {
        color: C.goldBright,
        fontSize: 8,
        fontWeight: "800",
        textTransform: "uppercase",
    },
    heroTitle: {
        color: C.white,
        fontSize: 14,
        fontWeight: "900",
        letterSpacing: 0.2,
    },
    heroSub: {
        color: "rgba(255, 255, 255, 0.75)",
        fontSize: 9.5,
        fontWeight: "600",
        marginTop: 1,
    },
    heroCta: {
        flexDirection: "row",
        alignItems: "center",
        gap: 3,
        alignSelf: "flex-start",
        backgroundColor: C.gold,
        paddingHorizontal: 9,
        paddingVertical: 4,
        borderRadius: 6,
    },
    heroCtaTxt: {
        color: C.navyDark,
        fontSize: 9.5,
        fontWeight: "900",
    },

    // ─── Section Headers ───
    secHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
    },
    secDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: C.gold,
    },
    secTitle: {
        fontSize: 9.5,
        fontWeight: "900",
        color: C.textSecondary,
        letterSpacing: 0.5,
        textTransform: "uppercase",
    },

    // ─── Subcategories ───
    subcatSec: {
        marginBottom: 12,
    },
    chipRow: {
        gap: 6,
        paddingTop: 6,
        paddingBottom: 2,
        flexDirection: "row",
    },
    chip: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: C.white,
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.border,
    },
    chipActive: {
        backgroundColor: C.navy,
        borderColor: C.gold,
    },
    chipTxt: {
        fontSize: 10,
        fontWeight: "700",
        color: C.textPrimary,
    },
    chipTxtActive: {
        color: C.gold,
        fontWeight: "800",
    },

    // ─── Products ───
    prodSec: {
        marginBottom: 12,
    },
    prodHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    cBubble: {
        backgroundColor: "rgba(217, 167, 58, 0.15)",
        paddingHorizontal: 5,
        paddingVertical: 1,
        borderRadius: 5,
        borderWidth: 0.8,
        borderColor: "rgba(217, 167, 58, 0.3)",
        marginLeft: 2,
    },
    cBubbleTxt: {
        fontSize: 8.5,
        fontWeight: "800",
        color: C.goldDark,
    },
    seeAll: {
        flexDirection: "row",
        alignItems: "center",
        gap: 1,
    },
    seeAllTxt: {
        fontSize: 10.5,
        color: C.goldDark,
        fontWeight: "800",
    },
    prodGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },

    // ─── Compact Product Card ───
    pCard: {
        backgroundColor: C.white,
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: C.border,
        elevation: 1,
    },
    pImgBox: {
        width: "100%",
        height: 95,
        backgroundColor: C.bgLight,
        position: "relative",
    },
    pImg: {
        width: "100%",
        height: "100%",
    },
    pDisc: {
        position: "absolute",
        top: 4,
        left: 4,
        backgroundColor: C.gold,
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    pDiscTxt: {
        color: C.navyDark,
        fontSize: 8,
        fontWeight: "900",
    },
    pBody: {
        padding: 7,
    },
    pName: {
        fontSize: 10.5,
        fontWeight: "700",
        color: C.textPrimary,
        lineHeight: 13,
        minHeight: 26,
        marginBottom: 2,
    },
    ratingRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 2,
        marginBottom: 4,
    },
    ratingTxt: {
        fontSize: 9,
        fontWeight: "800",
        color: C.goldDark,
    },
    pFooter: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 4,
        marginTop: 2,
    },
    pPrice: {
        fontSize: 11,
        fontWeight: "900",
        color: C.navy,
    },
    strikeP: {
        fontSize: 8.5,
        color: C.textMuted,
        textDecorationLine: "line-through",
        fontWeight: "600",
    },
    addBtn: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: C.gold,
        alignItems: "center",
        justifyContent: "center",
    },

    // ─── Empty ───
    emptyBox: {
        paddingVertical: 26,
        alignItems: "center",
        backgroundColor: C.white,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: C.border,
        borderStyle: "dashed",
    },
    emptyT: {
        fontSize: 11.5,
        fontWeight: "800",
        color: C.textPrimary,
        textAlign: "center",
    },
    emptyS: {
        fontSize: 9.5,
        color: C.textMuted,
        marginTop: 1,
        textAlign: "center",
    },
    emptyBtn: {
        marginTop: 10,
        backgroundColor: C.navy,
        paddingHorizontal: 14,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: C.gold,
    },
    emptyBtnT: {
        color: C.gold,
        fontSize: 10.5,
        fontWeight: "800",
    },

    // ─── WhatsApp ───
    waCard: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        backgroundColor: C.emeraldBg,
        padding: 9,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: "#A7F3D0",
    },
    waIcon: {
        width: 30,
        height: 30,
        borderRadius: 8,
        backgroundColor: "#D1FAE5",
        alignItems: "center",
        justifyContent: "center",
    },
    waTitle: {
        fontSize: 10.5,
        fontWeight: "800",
        color: "#065F46",
        lineHeight: 14,
    },
    waSub: {
        fontSize: 9,
        color: "#059669",
        marginTop: 1,
    },

    // ─── Grid View ───
    gridCont: {
        padding: 12,
        paddingBottom: 110,
    },
    statsBar: {
        flexDirection: "row",
        borderRadius: 12,
        paddingVertical: 12,
        paddingHorizontal: 8,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: "rgba(217, 167, 58, 0.3)",
    },
    statItem: {
        flex: 1,
        alignItems: "center",
    },
    statNum: {
        fontSize: 16,
        fontWeight: "900",
        color: C.gold,
    },
    statLbl: {
        fontSize: 9,
        color: C.textMuted,
        fontWeight: "700",
        marginTop: 1,
    },
    statDivider: {
        width: 1,
        backgroundColor: "rgba(255, 255, 255, 0.12)",
        marginVertical: 2,
    },
    gridSectionHeader: {
        flexDirection: "row",
        alignItems: "center",
        gap: 5,
        marginBottom: 10,
    },
    gridContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    gCard: {
        backgroundColor: C.white,
        borderRadius: 10,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: C.border,
        elevation: 1,
    },
    gImgBox: {
        width: "100%",
        height: 75,
        position: "relative",
        alignItems: "center",
        justifyContent: "flex-end",
        paddingBottom: 4,
    },
    gImg: {
        ...StyleSheet.absoluteFillObject,
        width: "100%",
        height: "100%",
    },
    gEmoji: {
        fontSize: 20,
        zIndex: 1,
    },
    gInfo: {
        padding: 6,
        alignItems: "center",
    },
    gTitle: {
        fontSize: 10,
        fontWeight: "800",
        color: C.textPrimary,
        textAlign: "center",
        lineHeight: 12,
        minHeight: 24,
    },
    gCount: {
        fontSize: 8.5,
        fontWeight: "700",
        color: C.goldDark,
        marginTop: 2,
    },

    // ─── Toast ───
    toast: {
        position: "absolute",
        bottom: 85,
        left: 16,
        right: 16,
        alignItems: "center",
        zIndex: 9999,
    },
    toastIn: {
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: C.navyDark,
        borderWidth: 1,
        borderColor: C.gold,
        width: "100%",
        elevation: 6,
    },
    toastTxt: {
        color: C.white,
        fontSize: 11.5,
        fontWeight: "700",
        flex: 1,
    },
});
