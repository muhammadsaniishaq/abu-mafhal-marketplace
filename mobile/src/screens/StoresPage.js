import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, Dimensions, FlatList, StatusBar, Alert
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const AM_LOGO = require('../../assets/am_logo.png');

const MOCK_TOP_STORES = [
    {
        id: '1',
        name: 'ELSON Boutique',
        category: 'Fashion & Accessories',
        rating: 4.8,
        reviews: '1.2K',
        productsCount: 256,
        logo: 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=300&auto=format&fit=crop',
        isVerified: true,
        followed: false,
    },
    {
        id: '2',
        name: 'Tech Gadgets NG',
        category: 'Electronics',
        rating: 4.7,
        reviews: '980',
        productsCount: 412,
        logo: 'https://images.unsplash.com/photo-1550009158-9ebf69173e03?q=80&w=300&auto=format&fit=crop',
        isVerified: true,
        followed: true,
    },
    {
        id: '3',
        name: 'FreshMart NG',
        category: 'Groceries & Essentials',
        rating: 4.9,
        reviews: '2.1K',
        productsCount: 589,
        logo: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=300&auto=format&fit=crop',
        isVerified: true,
        followed: false,
    },
    {
        id: '4',
        name: 'Royal Fragrances',
        category: 'Beauty & Perfumes',
        rating: 4.9,
        reviews: '840',
        productsCount: 148,
        logo: 'https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?q=80&w=300&auto=format&fit=crop',
        isVerified: true,
        followed: false,
    }
];

const MOCK_POPULAR_PRODUCTS = [
    {
        id: 'p1',
        name: 'iPhone 14 Pro Max',
        price: 980000,
        image: 'https://images.unsplash.com/photo-1695048133142-1a20484d2569?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'p2',
        name: 'Nike Air Force 1 White',
        price: 60000,
        image: 'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'p3',
        name: 'YSL Luxury Leather Bag',
        price: 240000,
        image: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'p4',
        name: 'Dior Sauvage Eau de Parfum',
        price: 115000,
        image: 'https://images.unsplash.com/photo-1523293182086-7651a899d37f?q=80&w=400&auto=format&fit=crop',
    }
];

export const StoresPage = ({ onGoToCart, onGoToNotifications, cartCount = 0, onProductClick }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeSubTab, setActiveSubTab] = useState('top_stores');
    const [stores, setStores] = useState(MOCK_TOP_STORES);
    const [popularProducts, setPopularProducts] = useState(MOCK_POPULAR_PRODUCTS);

    useEffect(() => {
        fetchStoresFromSupabase();
    }, []);

    const fetchStoresFromSupabase = async () => {
        try {
            const { data, error } = await supabase
                .from('vendors')
                .select('*')
                .limit(10);
            if (!error && data && data.length > 0) {
                const mapped = data.map(v => ({
                    id: v.id,
                    name: v.business_name || v.store_name || 'Verified Vendor',
                    category: v.category || 'General Store',
                    rating: v.rating || 4.8,
                    reviews: `${v.review_count || 120}`,
                    productsCount: v.total_sales || 85,
                    logo: v.logo_url || 'https://images.unsplash.com/photo-1544441893-675973e31985?q=80&w=300&auto=format&fit=crop',
                    isVerified: true,
                    followed: false,
                }));
                setStores(mapped);
            }
        } catch (_) {}
    };

    const toggleFollow = (id) => {
        setStores(prev => prev.map(s => s.id === id ? { ...s, followed: !s.followed } : s));
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Top White Header */}
            <View style={{
                backgroundColor: 'white',
                paddingTop: 46,
                paddingHorizontal: 16,
                paddingBottom: 14,
                borderBottomWidth: 1,
                borderBottomColor: '#F1F5F9',
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Image source={AM_LOGO} style={{ width: 38, height: 38, resizeMode: 'contain' }} />
                        <View>
                            <Text style={{ color: '#0A192F', fontSize: 17, fontWeight: '900', letterSpacing: 0.8 }}>
                                ABU <Text style={{ color: '#0284C7' }}>MAFHAL</Text>
                            </Text>
                            <Text style={{ color: '#64748B', fontSize: 7.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                                Your Marketplace, Your Choice.
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        <TouchableOpacity onPress={onGoToNotifications} style={{ position: 'relative', padding: 6 }}>
                            <Ionicons name="notifications-outline" size={24} color="#0F172A" />
                            <View style={{ position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444' }} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={onGoToCart} style={{ position: 'relative', padding: 6 }}>
                            <Ionicons name="cart-outline" size={25} color="#0F172A" />
                            {cartCount > 0 && (
                                <View style={{
                                    position: 'absolute',
                                    top: 3,
                                    right: 2,
                                    backgroundColor: '#10B981',
                                    borderRadius: 9,
                                    minWidth: 18,
                                    height: 18,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: 3
                                }}>
                                    <Text style={{ color: 'white', fontSize: 10, fontWeight: '900' }}>{cartCount}</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F1F5F9',
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    height: 44,
                }}>
                    <Ionicons name="search-outline" size={19} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search for products, stores and more..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, fontSize: 13, color: '#0F172A', fontWeight: '500' }}
                    />
                    <TouchableOpacity style={{ padding: 4 }}>
                        <Ionicons name="scan-outline" size={20} color="#0A192F" />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 120 }}>
                {/* Hero Banner: Shop from Top Stores */}
                <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
                    <View style={{
                        backgroundColor: '#0E1F3D',
                        borderRadius: 24,
                        padding: 20,
                        overflow: 'hidden',
                        position: 'relative',
                        minHeight: 140,
                        justifyContent: 'center'
                    }}>
                        <View style={{ width: '60%', zIndex: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                Shop from
                            </Text>
                            <Text style={{ fontSize: 24, fontWeight: '900', color: '#F59E0B', letterSpacing: -0.5, marginBottom: 4 }}>
                                Top Stores
                            </Text>
                            <Text style={{ fontSize: 11, color: '#CBD5E1', fontWeight: '500', marginBottom: 12 }}>
                                Trusted Sellers. Quality Products.
                            </Text>

                            <TouchableOpacity style={{
                                backgroundColor: '#F59E0B',
                                paddingHorizontal: 14,
                                paddingVertical: 7,
                                borderRadius: 12,
                                flexDirection: 'row',
                                alignItems: 'center',
                                alignSelf: 'flex-start',
                                gap: 6,
                            }}>
                                <Text style={{ color: '#0A192F', fontWeight: '900', fontSize: 11.5 }}>
                                    Explore Stores
                                </Text>
                                <Ionicons name="arrow-forward" size={13} color="#0A192F" />
                            </TouchableOpacity>
                        </View>

                        {/* Banner Image / Graphic */}
                        <Image
                            source={{ uri: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=400&auto=format&fit=crop' }}
                            style={{
                                position: 'absolute',
                                right: -15,
                                bottom: -10,
                                width: 155,
                                height: 155,
                                borderRadius: 20,
                                opacity: 0.85
                            }}
                        />

                        {/* Carousel Dots */}
                        <View style={{ flexDirection: 'row', gap: 5, position: 'absolute', bottom: 10, alignSelf: 'center' }}>
                            <View style={{ width: 14, height: 4, borderRadius: 2, backgroundColor: '#F59E0B' }} />
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                            <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' }} />
                        </View>
                    </View>
                </View>

                {/* Sub-tabs Row */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 14, gap: 16 }}>
                    {[
                        { key: 'popular', label: 'Popular', icon: 'flame-outline' },
                        { key: 'top_stores', label: 'Top Stores', icon: 'storefront-outline' },
                        { key: 'all_stores', label: 'All Stores', icon: 'pricetag-outline' },
                        { key: 'top_rated', label: 'Top Rated', icon: 'star-outline' },
                        { key: 'categories', label: 'Categories', icon: 'grid-outline' },
                    ].map(tab => {
                        const active = activeSubTab === tab.key;
                        return (
                            <TouchableOpacity
                                key={tab.key}
                                onPress={() => setActiveSubTab(tab.key)}
                                style={{ alignItems: 'center', paddingBottom: 6 }}
                            >
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                                    <Ionicons name={tab.icon} size={16} color={active ? '#06B6D4' : '#64748B'} />
                                    <Text style={{ fontSize: 13, fontWeight: active ? '900' : '600', color: active ? '#0A192F' : '#64748B' }}>
                                        {tab.label}
                                    </Text>
                                </View>
                                {active && (
                                    <View style={{ width: '80%', height: 3, borderRadius: 2, backgroundColor: '#06B6D4', marginTop: 4 }} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>

                {/* Section Header: Top Stores */}
                <View style={{ paddingHorizontal: 16, marginBottom: 12 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 }}>
                            Top Stores
                        </Text>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#0284C7' }}>See All</Text>
                            <Ionicons name="chevron-forward" size={13} color="#0284C7" />
                        </TouchableOpacity>
                    </View>
                    <Text style={{ fontSize: 11.5, color: '#64748B', fontWeight: '500' }}>
                        Discover trusted stores and shop your favourite products
                    </Text>
                </View>

                {/* Horizontal Stores Carousel */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: 18 }}>
                    {stores.map(store => (
                        <View
                            key={store.id}
                            style={{
                                width: 175,
                                backgroundColor: 'white',
                                borderRadius: 20,
                                padding: 14,
                                alignItems: 'center',
                                borderWidth: 1,
                                borderColor: '#F1F5F9',
                                shadowColor: '#0F172A',
                                shadowOffset: { width: 0, height: 4 },
                                shadowOpacity: 0.05,
                                shadowRadius: 10,
                                elevation: 2,
                            }}
                        >
                            {/* Store Avatar with Verified Badge */}
                            <View style={{ position: 'relative', marginBottom: 10 }}>
                                <Image
                                    source={{ uri: store.logo }}
                                    style={{ width: 62, height: 62, borderRadius: 31, backgroundColor: '#F1F5F9' }}
                                />
                                {store.isVerified && (
                                    <View style={{
                                        position: 'absolute',
                                        top: 0,
                                        right: -2,
                                        backgroundColor: '#10B981',
                                        borderRadius: 9,
                                        width: 18,
                                        height: 18,
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        borderWidth: 2,
                                        borderColor: 'white'
                                    }}>
                                        <Ionicons name="checkmark" size={11} color="white" />
                                    </View>
                                )}
                            </View>

                            <Text numberOfLines={1} style={{ fontSize: 13.5, fontWeight: '900', color: '#0F172A', textAlign: 'center', marginBottom: 2 }}>
                                {store.name}
                            </Text>

                            <Text numberOfLines={1} style={{ fontSize: 10.5, color: '#64748B', fontWeight: '600', marginBottom: 6, textAlign: 'center' }}>
                                {store.category}
                            </Text>

                            {/* Rating & Product Count */}
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 }}>
                                <Ionicons name="star" size={13} color="#F59E0B" />
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#0F172A' }}>
                                    {store.rating} <Text style={{ color: '#94A3B8', fontWeight: '500' }}>({store.reviews})</Text>
                                </Text>
                            </View>

                            <Text style={{ fontSize: 10.5, fontWeight: '700', color: '#64748B', marginBottom: 12 }}>
                                {store.productsCount} Products
                            </Text>

                            {/* Buttons */}
                            <TouchableOpacity
                                onPress={() => toggleFollow(store.id)}
                                style={{
                                    width: '100%',
                                    backgroundColor: store.followed ? '#F1F5F9' : '#0A192F',
                                    paddingVertical: 7,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                    marginBottom: 6,
                                }}
                            >
                                <Text style={{ color: store.followed ? '#0F172A' : 'white', fontSize: 11, fontWeight: '800' }}>
                                    {store.followed ? 'Following' : '+ Follow'}
                                </Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={{
                                    width: '100%',
                                    backgroundColor: 'white',
                                    borderWidth: 1,
                                    borderColor: '#E2E8F0',
                                    paddingVertical: 6,
                                    borderRadius: 12,
                                    alignItems: 'center',
                                }}
                            >
                                <Text style={{ color: '#0F172A', fontSize: 10.5, fontWeight: '800' }}>
                                    View Store
                                </Text>
                            </TouchableOpacity>
                        </View>
                    ))}
                </ScrollView>

                {/* Section Header: Popular Products */}
                <View style={{ paddingHorizontal: 16, marginBottom: 10, marginTop: 6 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 }}>
                            Popular Products
                        </Text>
                        <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#0284C7' }}>See All</Text>
                            <Ionicons name="chevron-forward" size={13} color="#0284C7" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Popular Products Row */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 10 }}>
                    {popularProducts.map(prod => (
                        <TouchableOpacity
                            key={prod.id}
                            activeOpacity={0.85}
                            onPress={() => onProductClick && onProductClick(prod)}
                            style={{
                                width: 110,
                                backgroundColor: 'white',
                                borderRadius: 16,
                                padding: 8,
                                borderWidth: 1,
                                borderColor: '#F1F5F9',
                                shadowColor: '#0F172A',
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: 0.04,
                                shadowRadius: 6,
                                elevation: 1,
                                position: 'relative'
                            }}
                        >
                            <View style={{ position: 'absolute', top: 6, right: 6, zIndex: 2 }}>
                                <Ionicons name="heart-outline" size={16} color="#94A3B8" />
                            </View>
                            <Image
                                source={{ uri: prod.image }}
                                style={{ width: '100%', height: 90, borderRadius: 12, resizeMode: 'cover', marginBottom: 6 }}
                            />
                            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: '#0F172A' }}>
                                {prod.name}
                            </Text>
                            <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#0F172A', marginTop: 2 }}>
                                ₦{prod.price.toLocaleString()}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </ScrollView>
        </View>
    );
};
