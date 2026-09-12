import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, SafeAreaView, Dimensions, StatusBar
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 3;
const AM_LOGO = require('../../assets/am_logo.png');

const CATEGORIES_DATA = [
    {
        id: 'electronics',
        name: 'Electronics',
        slug: 'electronics',
        image: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'fashion',
        name: 'Fashion',
        slug: 'fashion',
        image: 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'home-living',
        name: 'Home & Living',
        slug: 'home',
        image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'beauty',
        name: 'Beauty',
        slug: 'beauty',
        image: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'groceries',
        name: 'Groceries',
        slug: 'groceries',
        image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'mobile-accessories',
        name: 'Mobile Accessories',
        slug: 'phones',
        image: 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'health-fitness',
        name: 'Health & Fitness',
        slug: 'health',
        image: 'https://images.unsplash.com/photo-1517838277536-f5f99be501cd?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'toys-games',
        name: 'Toys & Games',
        slug: 'gaming',
        image: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'automotive',
        name: 'Automotive',
        slug: 'automotive',
        image: 'https://images.unsplash.com/photo-1486006920555-c77dce18193b?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'books-stationery',
        name: 'Books & Stationery',
        slug: 'books',
        image: 'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'sports-outdoors',
        name: 'Sports & Outdoors',
        slug: 'sports',
        image: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?q=80&w=400&auto=format&fit=crop',
    },
    {
        id: 'more',
        name: 'More Categories',
        slug: 'all',
        isMore: true,
    }
];

export const CategoriesPage = ({ onSelectCategory, onGoToCart, cartCount = 0 }) => {
    const [searchQuery, setSearchQuery] = useState('');

    const filteredCategories = CATEGORIES_DATA.filter(cat =>
        cat.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor="#0A192F" />

            {/* Dark Navy Top Header */}
            <View style={{
                backgroundColor: '#0A192F',
                paddingTop: 48,
                paddingHorizontal: 16,
                paddingBottom: 22,
                borderBottomLeftRadius: 28,
                borderBottomRightRadius: 28,
            }}>
                {/* Top Row: Logo & Icons */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Image
                            source={AM_LOGO}
                            style={{ width: 38, height: 38, resizeMode: 'contain' }}
                        />
                        <View>
                            <Text style={{ color: '#00D2FF', fontSize: 17, fontWeight: '900', letterSpacing: 0.8 }}>
                                ABU <Text style={{ color: '#38BDF8' }}>MAFHAL</Text>
                            </Text>
                            <Text style={{ color: '#94A3B8', fontSize: 7.5, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' }}>
                                Your Marketplace, Your Choice.
                            </Text>
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                        <TouchableOpacity
                            onPress={onGoToCart}
                            style={{ position: 'relative', padding: 4 }}
                        >
                            <Ionicons name="cart-outline" size={26} color="white" />
                            {cartCount > 0 && (
                                <View style={{
                                    position: 'absolute',
                                    top: 0,
                                    right: -2,
                                    backgroundColor: '#F59E0B',
                                    borderRadius: 10,
                                    minWidth: 18,
                                    height: 18,
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    paddingHorizontal: 4,
                                    borderWidth: 1.5,
                                    borderColor: '#0A192F'
                                }}>
                                    <Text style={{ color: '#0A192F', fontSize: 10, fontWeight: '900' }}>
                                        {cartCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity style={{ padding: 4 }}>
                            <Ionicons name="search-outline" size={24} color="white" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Title */}
                <Text style={{ fontSize: 28, fontWeight: '900', color: 'white', letterSpacing: -0.5, marginBottom: 16 }}>
                    Categories
                </Text>

                {/* Search Bar */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    borderRadius: 24,
                    paddingHorizontal: 16,
                    height: 46,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.1,
                    shadowRadius: 8,
                    elevation: 3
                }}>
                    <Ionicons name="search-outline" size={20} color="#64748B" style={{ marginRight: 10 }} />
                    <TextInput
                        placeholder="Search for products, brands and more..."
                        placeholderTextColor="#94A3B8"
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, fontSize: 13.5, color: '#0F172A', fontWeight: '500' }}
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            {/* 3-Column Categories Grid */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 18,
                    paddingBottom: 110,
                }}
            >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                    {filteredCategories.map((cat) => (
                        <TouchableOpacity
                            key={cat.id}
                            activeOpacity={0.85}
                            onPress={() => onSelectCategory && onSelectCategory(cat.slug || cat.name)}
                            style={{
                                width: COLUMN_WIDTH,
                                backgroundColor: 'white',
                                borderRadius: 20,
                                paddingVertical: 14,
                                paddingHorizontal: 8,
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                minHeight: 128,
                                shadowColor: '#0F172A',
                                shadowOffset: { width: 0, height: 3 },
                                shadowOpacity: 0.04,
                                shadowRadius: 8,
                                elevation: 1.5,
                                borderWidth: 1,
                                borderColor: '#F1F5F9',
                                marginBottom: 8,
                            }}
                        >
                            {cat.isMore ? (
                                <View style={{
                                    width: 54,
                                    height: 54,
                                    borderRadius: 16,
                                    backgroundColor: '#F8FAFC',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 8,
                                    flexDirection: 'row',
                                    flexWrap: 'wrap',
                                    padding: 8,
                                    gap: 5
                                }}>
                                    <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: '#0A192F' }} />
                                    <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: '#06B6D4' }} />
                                    <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: '#F59E0B' }} />
                                    <View style={{ width: 16, height: 16, borderRadius: 5, backgroundColor: '#CBD5E1' }} />
                                </View>
                            ) : (
                                <View style={{
                                    width: 64,
                                    height: 64,
                                    borderRadius: 14,
                                    overflow: 'hidden',
                                    backgroundColor: '#F1F5F9',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginBottom: 8,
                                }}>
                                    <Image
                                        source={{ uri: cat.image }}
                                        style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                                    />
                                </View>
                            )}

                            <Text
                                numberOfLines={2}
                                style={{
                                    fontSize: 11.5,
                                    fontWeight: '800',
                                    color: '#0F172A',
                                    textAlign: 'center',
                                    lineHeight: 15,
                                }}
                            >
                                {cat.name}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </ScrollView>
        </View>
    );
};
