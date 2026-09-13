import React, { useState, useEffect } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView,
    Image, SafeAreaView, Dimensions, StatusBar, ActivityIndicator,
    RefreshControl
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';

const { width } = Dimensions.get('window');
const COLUMN_WIDTH = (width - 48) / 3;
const AM_LOGO = require('../../assets/am_logo.png');

const DEFAULT_CATEGORY_IMAGES = {
    'phones & tablets': 'https://images.unsplash.com/photo-1584438784894-089d6a62b8fa?q=80&w=400&auto=format&fit=crop',
    'fashion & apparel': 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?q=80&w=400&auto=format&fit=crop',
    'electronics & gadgets': 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?q=80&w=400&auto=format&fit=crop',
    'shoes & footwear': 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?q=80&w=400&auto=format&fit=crop',
    'beauty & health': 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?q=80&w=400&auto=format&fit=crop',
    'home & living': 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?q=80&w=400&auto=format&fit=crop',
};

const getCategoryImage = (cat) => {
    if (cat.image_url) return cat.image_url;
    const key = (cat.name || '').toLowerCase().trim();
    for (const [k, img] of Object.entries(DEFAULT_CATEGORY_IMAGES)) {
        if (key.includes(k) || k.includes(key)) return img;
    }
    return 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?q=80&w=400&auto=format&fit=crop';
};

export const CategoriesPage = ({ onSelectCategory, onGoToCart, cartCount = 0 }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    useEffect(() => {
        fetchCategories();

        const channel = supabase
            .channel('categories-page-realtime')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                fetchCategories(true);
            })
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchCategories = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .eq('is_active', true)
                .order('display_order', { ascending: true });

            if (!error && data && data.length > 0) {
                setCategories(data);
            }
        } catch (err) {
            console.log('CategoriesPage fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = () => {
        setRefreshing(true);
        fetchCategories(true);
    };

    const filteredCategories = categories.filter(cat =>
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
                                }}>
                                    <Text style={{ color: '#0A192F', fontSize: 10, fontWeight: '900' }}>
                                        {cartCount > 99 ? '99+' : cartCount}
                                    </Text>
                                </View>
                            )}
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Page Title & Subtitle */}
                <View style={{ marginBottom: 14 }}>
                    <Text style={{ color: 'white', fontSize: 21, fontWeight: '900', letterSpacing: -0.4 }}>
                        Explore All Categories
                    </Text>
                    <Text style={{ color: '#94A3B8', fontSize: 12, fontWeight: '500', marginTop: 2 }}>
                        Live catalog updated directly from our marketplace
                    </Text>
                </View>

                {/* Search Bar */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: 'white',
                    borderRadius: 16,
                    paddingHorizontal: 14,
                    height: 46,
                    shadowColor: '#000',
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.08,
                    shadowRadius: 10,
                    elevation: 3,
                }}>
                    <Ionicons name="search-outline" size={19} color="#64748B" style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search for categories..."
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

            {/* Categories Content */}
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 18,
                    paddingBottom: 120,
                }}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0284C7']} />
                }
            >
                {loading ? (
                    <View style={{ paddingVertical: 50, alignItems: 'center' }}>
                        <ActivityIndicator size="large" color="#0284C7" />
                        <Text style={{ color: '#64748B', fontSize: 12, marginTop: 10, fontWeight: '600' }}>
                            Loading categories...
                        </Text>
                    </View>
                ) : (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' }}>
                        {filteredCategories.map((cat) => (
                            <TouchableOpacity
                                key={cat.id}
                                activeOpacity={0.85}
                                onPress={() => onSelectCategory && onSelectCategory(cat.name)}
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
                                        source={{ uri: getCategoryImage(cat) }}
                                        style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                                    />
                                </View>

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
                )}
            </ScrollView>
        </View>
    );
};
