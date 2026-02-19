import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Alert, TextInput, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { styles } from '../../styles/theme';

export const AdminBrands = () => {
    const [brands, setBrands] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [newBrandName, setNewBrandName] = useState('');
    const [newBrandLogo, setNewBrandLogo] = useState(null);

    useEffect(() => {
        fetchBrands();
    }, []);

    const fetchBrands = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('brands').select('*').order('created_at', { ascending: false });
        if (error) Alert.alert('Error', error.message);
        else setBrands(data || []);
        setLoading(false);
    };

    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 0.5,
            base64: true
        });

        if (!result.canceled) {
            setNewBrandLogo(result.assets[0]);
        }
    };

    const handleAddBrand = async () => {
        if (!newBrandName.trim()) return Alert.alert('Error', 'Please enter a brand name');

        try {
            setUploading(true);
            let logoUrl = null;

            if (newBrandLogo) {
                const fileName = `brand-${Date.now()}.png`;
                const { data, error } = await supabase.storage
                    .from('product-images') // Reusing existing bucket
                    .upload(fileName, decode(newBrandLogo.base64), {
                        contentType: 'image/png'
                    });

                if (error) throw error;

                const { data: publicUrlData } = supabase.storage
                    .from('product-images')
                    .getPublicUrl(fileName);

                logoUrl = publicUrlData.publicUrl;
            }

            const { error: insertError } = await supabase
                .from('brands')
                .insert([{ name: newBrandName, logo_url: logoUrl }]);

            if (insertError) throw insertError;

            Alert.alert('Success', 'Brand added successfully');
            setNewBrandName('');
            setNewBrandLogo(null);
            fetchBrands();

        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteBrand = (id) => {
        Alert.alert('Delete Brand', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('brands').delete().eq('id', id);
                    if (!error) fetchBrands();
                    else Alert.alert('Error', error.message);
                }
            }
        ]);
    };

    const renderItem = ({ item }) => (
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 8, borderWidth: 1, borderColor: '#F1F5F9' }}>
            <View style={{ width: 50, height: 50, borderRadius: 25, backgroundColor: '#F8FAFC', padding: 8, marginRight: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' }}>
                {item.logo_url ? (
                    <Image source={{ uri: item.logo_url }} style={{ width: 30, height: 30, resizeMode: 'contain' }} />
                ) : (
                    <Ionicons name="image" size={24} color="#CBD5E1" />
                )}
            </View>
            <Text style={{ flex: 1, fontWeight: '600', color: '#0F172A' }}>{item.name}</Text>
            <TouchableOpacity onPress={() => handleDeleteBrand(item.id)} style={{ padding: 8 }}>
                <Ionicons name="trash-outline" size={20} color="#EF4444" />
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={{ flex: 1, padding: 20 }}>
            <Text style={styles.sectionTitle}>Manage Official Stores</Text>

            {/* ADD NEW BRAND */}
            <View style={{ backgroundColor: 'white', padding: 16, borderRadius: 16, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <Text style={{ fontWeight: '700', marginBottom: 12 }}>Add New Brand</Text>

                <View style={{ flexDirection: 'row', gap: 12, marginBottom: 12 }}>
                    <TouchableOpacity onPress={pickImage} style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: '#CBD5E1' }}>
                        {newBrandLogo ? (
                            <Image source={{ uri: newBrandLogo.uri }} style={{ width: 60, height: 60, borderRadius: 30 }} />
                        ) : (
                            <Ionicons name="camera" size={24} color="#94A3B8" />
                        )}
                    </TouchableOpacity>
                    <TextInput
                        placeholder="Brand Name (e.g. Nike)"
                        style={{ flex: 1, backgroundColor: '#F8FAFC', borderRadius: 8, paddingHorizontal: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                        value={newBrandName}
                        onChangeText={setNewBrandName}
                    />
                </View>

                <TouchableOpacity
                    onPress={handleAddBrand}
                    disabled={uploading}
                    style={{ backgroundColor: '#0F172A', padding: 14, borderRadius: 12, alignItems: 'center' }}
                >
                    {uploading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Add Brand</Text>}
                </TouchableOpacity>
            </View>

            {/* LIST */}
            {loading ? <ActivityIndicator size="large" color="#0F172A" /> : (
                <FlatList
                    data={brands}
                    keyExtractor={item => item.id}
                    renderItem={renderItem}
                    contentContainerStyle={{ paddingBottom: 100 }}
                    ListEmptyComponent={<Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20 }}>No brands found</Text>}
                />
            )}
        </View>
    );
};
