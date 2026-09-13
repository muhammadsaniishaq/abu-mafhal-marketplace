import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Alert, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminBrands = () => {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [newBrandLogo, setNewBrandLogo] = useState(null);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        fetchBrands();
    }, []);

    const fetchBrands = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
            if (error) {
                console.error('Fetch brands error:', error);
            } else {
                setBrands(data || []);
            }
        } catch (e) {
            console.error('Brands crash:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const pickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                setNewBrandLogo(result.assets[0]);
            }
        } catch (err) {
            console.error('Pick image error:', err);
        }
    };

    const handleAddBrand = async () => {
        if (!newBrandName.trim()) {
            return Alert.alert('Kuskure', 'Da fatan a saka sunan babban shago / brand');
        }

        try {
            setUploading(true);
            let logoUrl = null;

            if (newBrandLogo && newBrandLogo.base64) {
                const fileName = `brand-${Date.now()}.png`;
                const { error: uploadError } = await supabase.storage
                    .from('product-images')
                    .upload(fileName, decode(newBrandLogo.base64), {
                        contentType: 'image/png',
                        upsert: true
                    });

                if (uploadError) throw uploadError;

                const { data: publicUrlData } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);

                logoUrl = publicUrlData.publicUrl;
            }

            const { error: insertError } = await supabase
                .from('brands')
                .insert([{ name: newBrandName.trim(), logo_url: logoUrl }]);

            if (insertError) throw insertError;

            Alert.alert('An Yi Nasara', `An yi nasarar ƙara brand din "${newBrandName.trim()}"`);
            setNewBrandName('');
            setNewBrandLogo(null);
            fetchBrands();

        } catch (error) {
            Alert.alert('Kuskure', error.message || 'An kasa ƙara brand');
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteBrand = (brand) => {
        Alert.alert(
            'Goge Brand',
            `Kana da tabbacin kana son goge brand din "${brand.name}"?`,
            [
                { text: 'A\'a (Cancel)', style: 'cancel' },
                {
                    text: 'Goge (Delete)',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase.from('brands').delete().eq('id', brand.id);
                        if (!error) {
                            setBrands(prev => prev.filter(b => b.id !== brand.id));
                        } else {
                            Alert.alert('Kuskure', error.message);
                        }
                    }
                }
            ]
        );
    };

    const filteredBrands = brands.filter(b => {
        if (!searchQuery.trim()) return true;
        return (b.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    });

    const renderItem = ({ item }) => (
        <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: '#FFFFFF',
            padding: 14,
            borderRadius: 18,
            marginBottom: 10,
            borderWidth: 1,
            borderColor: '#E2E8F0',
            shadowColor: NAVY,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.04,
            shadowRadius: 5,
            elevation: 1
        }}>
            <View style={{
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: '#F8FAFC',
                padding: 6,
                marginRight: 12,
                borderWidth: 1.5,
                borderColor: 'rgba(217, 167, 58, 0.35)',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {item.logo_url ? (
                    <Image source={{ uri: item.logo_url }} style={{ width: 34, height: 34, resizeMode: 'contain' }} />
                ) : (
                    <Ionicons name="pricetag-outline" size={22} color={GOLD} />
                )}
            </View>

            <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: NAVY, fontSize: 14 }}>{item.name}</Text>
                <Text style={{ fontSize: 11, color: '#64748B', marginTop: 1 }}>Official Brand Store</Text>
            </View>

            <TouchableOpacity
                onPress={() => handleDeleteBrand(item)}
                style={{ backgroundColor: '#FEE2E2', padding: 8, borderRadius: 10 }}
            >
                <Ionicons name="trash-outline" size={17} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header Area */}
            <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY }}>
                    Manyan Brands (Official Stores)
                </Text>
                <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                    Kula da tambari da shahararrun brands na kasuwar Abu Mafhal
                </Text>

                {/* Add Brand Form Card */}
                <View style={{
                    backgroundColor: '#F8FAFC',
                    padding: 14,
                    borderRadius: 16,
                    marginTop: 14,
                    borderWidth: 1,
                    borderColor: '#E2E8F0'
                }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: NAVY, marginBottom: 10 }}>
                        Ƙara Sabon Brand
                    </Text>

                    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 12 }}>
                        <TouchableOpacity
                            onPress={pickImage}
                            style={{
                                width: 50,
                                height: 50,
                                borderRadius: 25,
                                backgroundColor: '#FFFFFF',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderStyle: 'dashed',
                                borderWidth: 1.5,
                                borderColor: GOLD
                            }}
                        >
                            {newBrandLogo ? (
                                <Image source={{ uri: newBrandLogo.uri }} style={{ width: 50, height: 50, borderRadius: 25 }} />
                            ) : (
                                <Ionicons name="camera" size={20} color={GOLD} />
                            )}
                        </TouchableOpacity>

                        <TextInput
                            placeholder="Sunan Brand (Misali: Apple, Nike, Samsung)"
                            style={{
                                flex: 1,
                                backgroundColor: '#FFFFFF',
                                borderRadius: 12,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                borderWidth: 1,
                                borderColor: '#E2E8F0',
                                fontSize: 12.5,
                                color: NAVY,
                                fontWeight: '700'
                            }}
                            placeholderTextColor="#94A3B8"
                            value={newBrandName}
                            onChangeText={setNewBrandName}
                        />
                    </View>

                    <TouchableOpacity
                        onPress={handleAddBrand}
                        disabled={uploading}
                        style={{
                            backgroundColor: NAVY,
                            paddingVertical: 11,
                            borderRadius: 12,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: GOLD
                        }}
                    >
                        {uploading ? (
                            <ActivityIndicator color={GOLD} />
                        ) : (
                            <Text style={{ color: GOLD, fontWeight: '900', fontSize: 12.5 }}>Ƙara Brand</Text>
                        )}
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: '#F8FAFC',
                    borderRadius: 12,
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    marginTop: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0'
                }}>
                    <Ionicons name="search" size={16} color="#94A3B8" />
                    <TextInput
                        placeholder="Nemi brand..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, marginLeft: 8, fontSize: 12.5, color: NAVY }}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            {/* List */}
            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Ana loda brands...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredBrands}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchBrands(); }} colors={[GOLD, NAVY]} />
                    }
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.7 }}>
                            <Ionicons name="pricetag-outline" size={48} color="#94A3B8" />
                            <Text style={{ color: '#64748B', marginTop: 10, fontWeight: '700', fontSize: 13 }}>
                                Babu wani brand a halin yanzu.
                            </Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};
