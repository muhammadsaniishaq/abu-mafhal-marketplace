import React, { useState, useEffect } from 'react';
import {
    View, Text, ScrollView, Image, TouchableOpacity,
    StyleSheet, Dimensions, ActivityIndicator, Alert,
    Platform, StatusBar, Modal, Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useComparison } from '../context/ComparisonContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { supabase } from '../lib/supabase';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const FEATURE_COLUMN_WIDTH = 100;
const PRODUCT_COLUMN_WIDTH = 150;

export const ProductComparison = ({ navigation, addToCart }) => {
    const { comparisonItems, removeFromComparison, clearComparison, comparisonCount } = useComparison();
    const insets = useSafeAreaInsets();

    const [wishlist, setWishlist] = useState([]);
    const [loadingWishlist, setLoadingWishlist] = useState(false);
    const [imgZoom, setImgZoom] = useState(false);
    const [zoomImage, setZoomImage] = useState(null);

    useEffect(() => {
        fetchWishlist();
    }, []);

    const fetchWishlist = async () => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            setLoadingWishlist(true);
            const { data, error } = await supabase
                .from('wishlists')
                .select('items')
                .eq('id', user.id)
                .single();

            if (error && error.code !== 'PGRST116') throw error;
            if (data && data.items) {
                setWishlist(data.items);
            }
        } catch (err) {
            console.log("Error fetching wishlist in Compare:", err);
        } finally {
            setLoadingWishlist(false);
        }
    };

    const toggleWishlist = async (productId) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                Alert.alert('Notice', 'Please login to add to wishlist.');
                return;
            }

            let newWishlist;
            if (wishlist.includes(productId)) {
                newWishlist = wishlist.filter(id => id !== productId);
                Alert.alert('Wishlist', 'Product removed from wishlist.');
            } else {
                newWishlist = [...wishlist, productId];
                Alert.alert('Wishlist', 'Product added to wishlist.');
            }

            setWishlist(newWishlist);
            await supabase.from('wishlists').upsert({ id: user.id, items: newWishlist, updated_at: new Date() });
        } catch (err) {
            console.log("Toggle Wishlist Error in Compare:", err);
        }
    };

    if (comparisonCount === 0) {
        return (
            <View style={styles.container}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />
                
                {/* Header */}
                <LinearGradient
                    colors={['#0F172A', '#1E293B']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={[styles.header, { paddingTop: Math.max(insets.top || 0, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0) + 8 }]}
                >
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hBtn}>
                        <Ionicons name="chevron-back" size={20} color="white" />
                    </TouchableOpacity>
                    <View style={styles.brandDot} />
                    <Text style={styles.headerTitle}>Comparison</Text>
                    <View style={{ width: 32 }} />
                </LinearGradient>

                <View style={styles.emptyContainer}>
                    <View style={styles.emptyCircle}>
                        <Ionicons name="git-compare-outline" size={56} color="#6366F1" />
                    </View>
                    <Text style={styles.emptyTitle}>No Products to Compare</Text>
                    <Text style={styles.emptySubtitle}>Add products from the shop to compare their specifications side-by-side.</Text>
                    <TouchableOpacity style={styles.browseBtn} onPress={() => navigation.navigate('Main', { screen: 'shop' })}>
                        <Text style={styles.browseText}>Browse Products</Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    }

    // Helper to normalize specs to key-value object
    const getSpecsObject = (product) => {
        const specs = product.specifications || product.metadata?.specifications || {};
        if (Array.isArray(specs)) {
            const obj = {};
            specs.forEach(item => {
                if (item && item.key) {
                    obj[item.key] = item.value;
                }
            });
            return obj;
        }
        if (typeof specs === 'object' && specs !== null) {
            return specs;
        }
        return {};
    };

    // Get all unique specifications keys
    const allSpecKeys = new Set();
    comparisonItems.forEach(product => {
        const normalized = getSpecsObject(product);
        Object.keys(normalized).forEach(key => allSpecKeys.add(key));
    });
    const specKeysArray = Array.from(allSpecKeys);

    // Calculate quick stats
    const bestPriceProduct = comparisonItems.reduce((min, p) => p.price < min.price ? p : min, comparisonItems[0]);
    const highestRatedProduct = comparisonItems.reduce((max, p) => {
        const ratingA = p.rating || p.averageRating || 0;
        const ratingB = max.rating || max.averageRating || 0;
        return ratingA > ratingB ? p : max;
    }, comparisonItems[0]);

    const handleAddToCart = (product) => {
        if (addToCart) {
            addToCart(product, 1);
            Alert.alert('Added to Cart', `Added ${product.name} to cart.`);
        }
    };

    const getProductImage = (imgs) => {
        if (!imgs) return null;
        if (typeof imgs === 'string') {
            try { return JSON.parse(imgs)[0]; } catch { return imgs; }
        }
        if (Array.isArray(imgs) && imgs.length > 0) return imgs[0];
        return null;
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent={true} />

            {/* Header */}
            <LinearGradient
                colors={['#0F172A', '#1E293B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={[styles.header, { paddingTop: Math.max(insets.top || 0, Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0) + 8 }]}
            >
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.hBtn}>
                    <Ionicons name="chevron-back" size={20} color="white" />
                </TouchableOpacity>
                <View style={styles.brandDot} />
                <Text style={styles.headerTitle} numberOfLines={1}>Compare ({comparisonCount})</Text>
                <TouchableOpacity onPress={clearComparison} style={styles.clearBtn}>
                    <Text style={styles.clearBtnText}>Clear All</Text>
                </TouchableOpacity>
            </LinearGradient>

            {/* Accent line under header */}
            <View style={styles.accentStrip}>
                <View style={styles.accentInner} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 50, paddingTop: 14 }}>
                
                {/* Visual Pill Decorations */}
                <View style={styles.decorRow}>
                    <View style={[styles.decorPill, { width: 22, backgroundColor: '#6366F1' }]} />
                    <View style={styles.decorPill} />
                    <View style={[styles.decorPill, { width: 7 }]} />
                </View>

                {/* Main scrollable grid table */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false} style={styles.scrollTableWrapper}>
                    <View style={styles.tableContainer}>
                        
                        {/* 1. Header Row (Images, names, rates) */}
                        <View style={styles.tableRow}>
                            <View style={[styles.cell, styles.featureCell, { height: 225 }]} />
                            {comparisonItems.map(product => {
                                const isBestPrice = product.id === bestPriceProduct.id;
                                const isTopRated = product.id === highestRatedProduct.id && (product.rating || product.averageRating || 0) > 0;
                                const imgUri = getProductImage(product.images);
                                return (
                                    <View key={product.id} style={[styles.cell, styles.productHeaderCell, { height: 225 }]}>
                                        
                                        {/* Remove Action */}
                                        <TouchableOpacity style={styles.removeProductBtn} onPress={() => removeFromComparison(product.id)}>
                                            <Ionicons name="close" size={13} color="white" />
                                        </TouchableOpacity>

                                        {/* Wishlist Toggle */}
                                        <TouchableOpacity 
                                            style={styles.floatingWishlistBtn} 
                                            onPress={() => toggleWishlist(product.id)}
                                        >
                                            <Ionicons 
                                                name={(wishlist || []).includes(product.id) ? "heart" : "heart-outline"} 
                                                size={15} 
                                                color={(wishlist || []).includes(product.id) ? "#EF4444" : "#64748B"} 
                                            />
                                        </TouchableOpacity>

                                        {/* Image Display */}
                                        <TouchableOpacity 
                                            style={styles.imageContainer}
                                            onPress={() => {
                                                if (imgUri) {
                                                    setZoomImage(imgUri);
                                                    setImgZoom(true);
                                                }
                                            }}
                                            activeOpacity={0.9}
                                        >
                                            {imgUri ? (
                                                <Image source={{ uri: imgUri }} style={styles.productImage} resizeMode="contain" />
                                            ) : (
                                                <Ionicons name="bag-outline" size={36} color="#CBD5E1" />
                                            )}
                                            
                                            {/* Zoom icon hint */}
                                            <View style={styles.zoomHintIcon}>
                                                <Ionicons name="expand-outline" size={10} color="white" />
                                            </View>

                                            {/* Smart Badges */}
                                            {isBestPrice && (
                                                <View style={[styles.badge, styles.bestPriceBadge]}>
                                                    <Ionicons name="sparkles" size={8} color="white" style={{ marginRight: 2 }} />
                                                    <Text style={styles.badgeText}>BEST PRICE</Text>
                                                </View>
                                            )}
                                            {!isBestPrice && isTopRated && (
                                                <View style={[styles.badge, styles.topRatedBadge]}>
                                                    <Ionicons name="star" size={8} color="white" style={{ marginRight: 2 }} />
                                                    <Text style={styles.badgeText}>TOP RATED</Text>
                                                </View>
                                            )}
                                        </TouchableOpacity>

                                        <TouchableOpacity 
                                            activeOpacity={0.7}
                                            onPress={() => navigation.navigate('ProductDetails', { product })}
                                            style={{ alignItems: 'center', width: '100%', marginTop: 2 }}
                                        >
                                            <Text style={styles.productName} numberOfLines={2}>{product.name || 'Product'}</Text>
                                            <Text style={styles.productPrice}>₦{Number(product.price || 0).toLocaleString()}</Text>
                                        </TouchableOpacity>
                                    </View>
                                );
                            })}
                        </View>

                        {/* 2. Price Row */}
                        <View style={[styles.tableRow, styles.rowAlternate]}>
                            <View style={[styles.cell, styles.featureCell]}>
                                <View style={styles.specLabelRow}>
                                    <View style={[styles.specDot, { backgroundColor: '#6366F1' }]} />
                                    <Text style={styles.featureLabel}>Price</Text>
                                </View>
                            </View>
                            {comparisonItems.map(product => {
                                const isBest = product.id === bestPriceProduct.id;
                                return (
                                    <View key={product.id} style={styles.cell}>
                                        <Text style={[styles.priceValue, isBest && { color: '#10B981', fontWeight: '900' }]}>
                                            ₦{Number(product.price || 0).toLocaleString()}
                                        </Text>
                                        {isBest && comparisonItems.length > 1 && (
                                            <View style={styles.savingTag}>
                                                <Text style={styles.savingTagTxt}>Cheaper</Text>
                                            </View>
                                        )}
                                    </View>
                                );
                            })}
                        </View>

                        {/* 3. Category Row */}
                        <View style={styles.tableRow}>
                            <View style={[styles.cell, styles.featureCell]}>
                                <View style={styles.specLabelRow}>
                                    <View style={[styles.specDot, { backgroundColor: '#EC4899' }]} />
                                    <Text style={styles.featureLabel}>Category</Text>
                                </View>
                            </View>
                            {comparisonItems.map(product => (
                                <View key={product.id} style={styles.cell}>
                                    <Text style={styles.cellValue}>{product.category || 'General'}</Text>
                                </View>
                            ))}
                        </View>

                        {/* 4. Rating Row */}
                        <View style={[styles.tableRow, styles.rowAlternate]}>
                            <View style={[styles.cell, styles.featureCell]}>
                                <View style={styles.specLabelRow}>
                                    <View style={[styles.specDot, { backgroundColor: '#F59E0B' }]} />
                                    <Text style={styles.featureLabel}>Rating</Text>
                                </View>
                            </View>
                            {comparisonItems.map(product => {
                                const rate = product.rating || product.averageRating || 0;
                                const revs = product.reviews || product.totalReviews || 0;
                                return (
                                    <View key={product.id} style={styles.cell}>
                                        <View style={styles.ratingBox}>
                                            <Ionicons name="star" size={11} color="#CA8A04" style={{ marginRight: 2 }} />
                                            <Text style={styles.ratingText}>{rate > 0 ? rate.toFixed(1) : 'N/A'}</Text>
                                        </View>
                                        <Text style={styles.reviewsText}>({revs} reviews)</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {/* 5. Availability Row */}
                        <View style={styles.tableRow}>
                            <View style={[styles.cell, styles.featureCell]}>
                                <View style={styles.specLabelRow}>
                                    <View style={[styles.specDot, { backgroundColor: '#10B981' }]} />
                                    <Text style={styles.featureLabel}>Availability</Text>
                                </View>
                            </View>
                            {comparisonItems.map(product => {
                                const stockVal = product.stock != null ? Number(product.stock) : null;
                                const inStock = stockVal === null || stockVal > 0;
                                return (
                                    <View key={product.id} style={styles.cell}>
                                        <View style={[styles.stockBadge, { backgroundColor: inStock ? '#F0FDF4' : '#FEF2F2', borderColor: inStock ? '#86EFAC' : '#FCA5A5' }]}>
                                            <Text style={[styles.stockBadgeText, { color: inStock ? '#16A34A' : '#EF4444' }]}>
                                                {inStock ? (stockVal != null ? `${stockVal} Left` : 'In Stock') : 'Out of Stock'}
                                            </Text>
                                        </View>
                                    </View>
                                );
                            })}
                        </View>

                        {/* 6. Brand Row */}
                        <View style={[styles.tableRow, styles.rowAlternate]}>
                            <View style={[styles.cell, styles.featureCell]}>
                                <View style={styles.specLabelRow}>
                                    <View style={[styles.specDot, { backgroundColor: '#3B82F6' }]} />
                                    <Text style={styles.featureLabel}>Brand</Text>
                                </View>
                            </View>
                            {comparisonItems.map(product => (
                                <View key={product.id} style={styles.cell}>
                                    <Text style={styles.cellValue}>{product.brand || 'Generic'}</Text>
                                </View>
                            ))}
                        </View>

                        {/* 7. Description Row */}
                        <View style={styles.tableRow}>
                            <View style={[styles.cell, styles.featureCell, { height: 90 }]}>
                                <View style={styles.specLabelRow}>
                                    <View style={[styles.specDot, { backgroundColor: '#64748B' }]} />
                                    <Text style={styles.featureLabel}>About</Text>
                                </View>
                            </View>
                            {comparisonItems.map(product => (
                                <View key={product.id} style={[styles.cell, { height: 90, justifyContent: 'flex-start', paddingTop: 4 }]}>
                                    <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={true}>
                                        <Text style={styles.descriptionText}>
                                            {product.description || 'No description available.'}
                                        </Text>
                                    </ScrollView>
                                </View>
                            ))}
                        </View>

                        {/* Custom Attributes Specifications Rows */}
                        {specKeysArray.map((key, index) => (
                            <View key={key} style={[styles.tableRow, index % 2 === 1 ? null : styles.rowAlternate]}>
                                <View style={[styles.cell, styles.featureCell]}>
                                    <View style={styles.specLabelRow}>
                                        <View style={[styles.specDot, { backgroundColor: '#8B5CF6' }]} />
                                        <Text style={styles.featureLabel} numberOfLines={1}>{key}</Text>
                                    </View>
                                </View>
                                {comparisonItems.map(product => {
                                    const normalized = getSpecsObject(product);
                                    const val = normalized[key];
                                    return (
                                        <View key={product.id} style={styles.cell}>
                                            <Text style={styles.cellValue}>
                                                {val !== undefined && val !== null && typeof val !== 'object' ? String(val) : '—'}
                                            </Text>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}

                        {/* 8. Purchase Buttons Row */}
                        <View style={styles.tableRow}>
                            <View style={[styles.cell, styles.featureCell, { height: 58, borderBottomWidth: 0 }]} />
                            {comparisonItems.map(product => (
                                <View key={product.id} style={[styles.cell, { height: 58, borderBottomWidth: 0 }]}>
                                    <TouchableOpacity style={styles.addToCartBtn} onPress={() => handleAddToCart(product)}>
                                        <Ionicons name="bag-add" size={12} color="white" style={{ marginRight: 3 }} />
                                        <Text style={styles.addToCartText}>Add to Cart</Text>
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>

                    </View>
                </ScrollView>

                {/* ── SMART ADVANTAGE SUMMARY CARD ── */}
                {comparisonItems.length === 2 && (
                    <View style={styles.summaryContainer}>
                        <Text style={styles.summaryTitle}>⚡ Key Highlights</Text>
                        <View style={styles.summaryGrid}>
                            
                            {/* Price advantage card */}
                            {comparisonItems[0].price !== comparisonItems[1].price && (
                                <View style={[styles.summaryCard, { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }]}>
                                    <View style={styles.summaryCardHeader}>
                                        <Text style={styles.summaryIcon}>💰</Text>
                                        <Text style={[styles.summaryCardLabel, { color: '#059669' }]}>Savings Advantage</Text>
                                    </View>
                                    <Text style={styles.summaryProductName} numberOfLines={1}>
                                        {bestPriceProduct.name}
                                    </Text>
                                    <Text style={[styles.summaryProductValue, { color: '#047857' }]}>
                                        is ₦{Math.abs(comparisonItems[0].price - comparisonItems[1].price).toLocaleString()} cheaper!
                                    </Text>
                                </View>
                            )}

                            {/* Rating advantage card */}
                            {Math.abs((comparisonItems[0].rating || 0) - (comparisonItems[1].rating || 0)) > 0.1 && (
                                <View style={[styles.summaryCard, { backgroundColor: '#FFFDF0', borderColor: '#FDE68A' }]}>
                                    <View style={styles.summaryCardHeader}>
                                        <Text style={styles.summaryIcon}>⭐</Text>
                                        <Text style={[styles.summaryCardLabel, { color: '#B45309' }]}>Highly Rated</Text>
                                    </View>
                                    <Text style={styles.summaryProductName} numberOfLines={1}>
                                        {highestRatedProduct.name}
                                    </Text>
                                    <Text style={[styles.summaryProductValue, { color: '#A16207' }]}>
                                        leads by {(highestRatedProduct.rating || 5).toFixed(1)} stars!
                                    </Text>
                                </View>
                            )}

                        </View>
                    </View>
                )}

            </ScrollView>

            {/* ── IMAGE ZOOM MODAL ── */}
            <Modal visible={imgZoom} transparent={true} animationType="fade" onRequestClose={() => setImgZoom(false)}>
                <View style={styles.zoomModal}>
                    <TouchableOpacity style={styles.zoomClose} onPress={() => setImgZoom(false)}>
                        <Ionicons name="close" size={24} color="white" />
                    </TouchableOpacity>
                    {zoomImage && (
                        <Image source={{ uri: zoomImage }} style={{ width: SCREEN_WIDTH - 20, height: SCREEN_WIDTH + 60 }} resizeMode="contain" />
                    )}
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F3F6FC',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingBottom: 10,
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 4,
    },
    hBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.11)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    hBtnLiked: {
        backgroundColor: 'rgba(239, 68, 68, 0.25)',
    },
    brandDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#6366F1',
        marginLeft: 8,
        marginRight: -4,
    },
    headerTitle: {
        flex: 1,
        color: 'white',
        fontWeight: '800',
        fontSize: 12,
        marginLeft: 10,
    },
    clearBtn: {
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        backgroundColor: 'rgba(239, 68, 68, 0.18)',
        borderWidth: 0.8,
        borderColor: 'rgba(239, 68, 68, 0.3)',
    },
    clearBtnText: {
        color: '#F87171',
        fontSize: 9.5,
        fontWeight: '800',
    },
    accentStrip: {
        height: 2,
        backgroundColor: '#1E293B',
        overflow: 'hidden',
    },
    accentInner: {
        height: 2,
        width: '45%',
        backgroundColor: '#6366F1',
        borderRadius: 1,
    },
    decorRow: {
        flexDirection: 'row',
        gap: 3,
        alignItems: 'center',
        marginHorizontal: 16,
        marginBottom: 8,
    },
    decorPill: {
        width: 6,
        height: 3,
        borderRadius: 1.5,
        backgroundColor: '#CBD5E1',
    },
    // Empty State
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 24,
        backgroundColor: '#F8FAFC',
    },
    emptyCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#EEF2FF',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 0.8,
        borderColor: '#E0E7FF',
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 6,
    },
    emptySubtitle: {
        fontSize: 11,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 16,
        marginBottom: 20,
    },
    browseBtn: {
        backgroundColor: '#0F172A',
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 10,
        elevation: 3,
    },
    browseText: {
        color: 'white',
        fontWeight: '700',
        fontSize: 12,
    },
    // Table Structure
    scrollTableWrapper: {
        marginHorizontal: 10,
        borderRadius: 14,
        borderWidth: 0.8,
        borderColor: '#E2E8F0',
        backgroundColor: 'white',
        elevation: 3,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        marginBottom: 12,
    },
    tableContainer: {
        flexDirection: 'column',
        paddingVertical: 4,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowAlternate: {
        backgroundColor: '#F8FAFC',
    },
    cell: {
        width: PRODUCT_COLUMN_WIDTH,
        height: 44,
        paddingHorizontal: 8,
        justifyContent: 'center',
        alignItems: 'center',
        borderBottomWidth: 0.8,
        borderBottomColor: '#EEF2F8',
    },
    featureCell: {
        width: FEATURE_COLUMN_WIDTH,
        backgroundColor: 'white',
        justifyContent: 'center',
        alignItems: 'flex-start',
        paddingLeft: 8,
        borderRightWidth: 0.8,
        borderRightColor: '#EEF2F8',
    },
    specLabelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    specDot: {
        width: 4,
        height: 4,
        borderRadius: 2,
    },
    featureLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: '#64748B',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    productHeaderCell: {
        backgroundColor: 'white',
        paddingTop: 16,
        paddingBottom: 8,
        justifyContent: 'flex-start',
    },
    removeProductBtn: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(239, 68, 68, 0.95)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
    floatingWishlistBtn: {
        position: 'absolute',
        top: 4,
        left: 4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
        borderWidth: 0.8,
        borderColor: '#E2E8F0',
    },
    imageContainer: {
        width: 65,
        height: 65,
        borderRadius: 8,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        marginBottom: 6,
        borderWidth: 0.8,
        borderColor: '#EEF2F8',
    },
    productImage: {
        width: '85%',
        height: '85%',
    },
    zoomHintIcon: {
        position: 'absolute',
        bottom: 3,
        right: 3,
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: 'rgba(0,0,0,0.4)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    badge: {
        position: 'absolute',
        bottom: -5,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 5,
        paddingVertical: 1.5,
        borderRadius: 5,
        zIndex: 12,
        elevation: 2,
    },
    bestPriceBadge: {
        backgroundColor: '#10B981',
    },
    topRatedBadge: {
        backgroundColor: '#F59E0B',
    },
    badgeText: {
        color: 'white',
        fontSize: 7,
        fontWeight: '900',
        letterSpacing: 0.3,
    },
    productName: {
        fontSize: 11.5,
        fontWeight: '800',
        color: '#1E293B',
        textAlign: 'center',
        marginBottom: 2,
        paddingHorizontal: 4,
        lineHeight: 14,
    },
    productPrice: {
        fontSize: 12,
        fontWeight: '900',
        color: '#6366F1',
    },
    priceValue: {
        fontSize: 12,
        fontWeight: '800',
        color: '#475569',
    },
    savingTag: {
        backgroundColor: '#ECFDF5',
        borderWidth: 0.8,
        borderColor: '#86EFAC',
        borderRadius: 4,
        paddingHorizontal: 4,
        paddingVertical: 0.5,
        marginTop: 2,
    },
    savingTagTxt: {
        color: '#10B981',
        fontSize: 7.5,
        fontWeight: '800',
    },
    cellValue: {
        fontSize: 11,
        fontWeight: '600',
        color: '#475569',
        textAlign: 'center',
    },
    ratingBox: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FEF9C3',
        paddingHorizontal: 4,
        paddingVertical: 1.5,
        borderRadius: 5,
        marginBottom: 1,
        borderWidth: 0.5,
        borderColor: '#FEF08A',
    },
    ratingText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#854D0E',
    },
    reviewsText: {
        fontSize: 8,
        color: '#94A3B8',
        fontWeight: '500',
    },
    stockBadge: {
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.8,
    },
    stockBadgeText: {
        fontSize: 8.5,
        fontWeight: '800',
    },
    descriptionText: {
        fontSize: 9,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 12,
        paddingHorizontal: 3,
        fontWeight: '500',
    },
    addToCartBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#6366F1',
        paddingVertical: 6,
        paddingHorizontal: 11,
        borderRadius: 8,
        elevation: 2,
    },
    addToCartText: {
        color: 'white',
        fontSize: 10,
        fontWeight: '800',
    },
    // Summary Section
    summaryContainer: {
        marginTop: 4,
        paddingHorizontal: 16,
    },
    summaryTitle: {
        fontSize: 12.5,
        fontWeight: '800',
        color: '#0F172A',
        marginBottom: 8,
    },
    summaryGrid: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 8,
    },
    summaryCard: {
        flex: 1,
        borderRadius: 10,
        borderWidth: 0.8,
        padding: 8,
        elevation: 1,
        shadowColor: '#0F172A',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.02,
        shadowRadius: 3,
    },
    summaryCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 3,
    },
    summaryIcon: {
        fontSize: 11,
        marginRight: 3,
    },
    summaryCardLabel: {
        fontSize: 8,
        fontWeight: '800',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    summaryProductName: {
        fontSize: 10,
        fontWeight: '800',
        color: '#1E293B',
        marginBottom: 2,
    },
    summaryProductValue: {
        fontSize: 10,
        fontWeight: '700',
    },
    // Zoom Modal
    zoomModal: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomClose: {
        position: 'absolute',
        top: 40,
        right: 16,
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
    },
});
