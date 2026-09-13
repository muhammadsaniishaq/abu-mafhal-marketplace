import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Alert, Modal, TextInput, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

export const AdminCategories = () => {
    const [categories, setCategories] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    // Modal state for Add / Edit
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formName, setFormName] = useState('');
    const [formImageUrl, setFormImageUrl] = useState('');

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('categories')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('Fetch categories error:', error);
            } else {
                setCategories(data || []);
            }
        } catch (e) {
            console.error('Fetch categories crash:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                if (asset.base64) {
                    setUploading(true);
                    const fileName = `cat_${Date.now()}.png`;
                    const { error: uploadError } = await supabase.storage
                        .from('product-images')
                        .upload(fileName, decode(asset.base64), {
                            contentType: 'image/png',
                            upsert: true
                        });

                    if (!uploadError) {
                        const { data: publicUrlData } = supabase.storage
                            .from('product-images')
                            .getPublicUrl(fileName);
                        setFormImageUrl(publicUrlData.publicUrl);
                    } else {
                        // Fallback to asset URI
                        setFormImageUrl(asset.uri);
                    }
                }
            }
        } catch (err) {
            console.error('Image pick error:', err);
        } finally {
            setUploading(false);
        }
    };

    const openAddModal = () => {
        setEditingCategory(null);
        setFormName('');
        setFormImageUrl('');
        setModalVisible(true);
    };

    const openEditModal = (cat) => {
        setEditingCategory(cat);
        setFormName(cat.name || '');
        setFormImageUrl(cat.image_url || '');
        setModalVisible(true);
    };

    const handleSave = async () => {
        if (!formName.trim()) {
            return Alert.alert('Error', 'Please enter category name');
        }

        const slug = formName.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-');

        try {
            setUploading(true);

            if (editingCategory) {
                // Update
                const { error } = await supabase
                    .from('categories')
                    .update({
                        name: formName.trim(),
                        slug,
                        image_url: formImageUrl || null
                    })
                    .eq('id', editingCategory.id);

                if (error) throw error;
                Alert.alert('Updated', 'Category updated successfully.');
            } else {
                // Insert
                const { error } = await supabase
                    .from('categories')
                    .insert([{
                        name: formName.trim(),
                        slug,
                        image_url: formImageUrl || null,
                        is_active: true
                    }]);

                if (error) throw error;
                Alert.alert('Success', 'New category created successfully.');
            }

            setModalVisible(false);
            fetchCategories();
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to save category.');
        } finally {
            setUploading(false);
        }
    };

    const deleteCat = (cat) => {
        Alert.alert(
            'Delete Category',
            `Are you sure you want to delete category "${cat.name}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        const { error } = await supabase.from('categories').delete().eq('id', cat.id);
                        if (!error) {
                            setCategories(prev => prev.filter(c => c.id !== cat.id));
                        } else {
                            Alert.alert('Error', error.message);
                        }
                    }
                }
            ]
        );
    };

    const filteredCategories = categories.filter(c => {
        if (!searchQuery.trim()) return true;
        return (c.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    });

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header Area */}
            <View style={{ padding: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                    <View>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY }}>
                            Categories Management
                        </Text>
                        <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                            Manage product categories and catalog structure for Abu Mafhal Marketplace
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={openAddModal}
                        style={{
                            flexDirection: 'row',
                            alignItems: 'center',
                            gap: 5,
                            backgroundColor: NAVY,
                            paddingHorizontal: 12,
                            paddingVertical: 8,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: GOLD
                        }}
                    >
                        <Ionicons name="add" size={17} color={GOLD} />
                        <Text style={{ color: GOLD, fontWeight: '800', fontSize: 12 }}>Ƙara Sabo</Text>
                    </TouchableOpacity>
                </View>

                {/* Search Bar */}
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
                        placeholder="Nemi rukuni..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={{ flex: 1, marginLeft: 8, fontSize: 12.5, color: NAVY }}
                        placeholderTextColor="#94A3B8"
                    />
                </View>
            </View>

            {loading && !refreshing ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Ana loda rukunoni...</Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCategories}
                    keyExtractor={item => item.id}
                    numColumns={2}
                    contentContainerStyle={{ padding: 14, paddingBottom: 60 }}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchCategories(); }} colors={[GOLD, NAVY]} />
                    }
                    renderItem={({ item }) => (
                        <View style={{
                            flex: 1,
                            margin: 6,
                            backgroundColor: '#FFFFFF',
                            borderRadius: 18,
                            padding: 14,
                            alignItems: 'center',
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            shadowColor: NAVY,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.04,
                            shadowRadius: 5,
                            elevation: 1,
                            position: 'relative'
                        }}>
                            <View style={{
                                width: 64,
                                height: 64,
                                borderRadius: 32,
                                backgroundColor: '#F8FAFC',
                                marginBottom: 10,
                                overflow: 'hidden',
                                borderWidth: 1.5,
                                borderColor: 'rgba(217, 167, 58, 0.3)',
                                alignItems: 'center',
                                justifyContent: 'center'
                            }}>
                                {item.image_url ? (
                                    <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <Ionicons name="cube-outline" size={26} color={GOLD} />
                                )}
                            </View>

                            <Text numberOfLines={1} style={{ fontSize: 13, fontWeight: '800', color: NAVY, textAlign: 'center', marginBottom: 2 }}>
                                {item.name}
                            </Text>
                            <Text numberOfLines={1} style={{ fontSize: 10, color: '#64748B', textAlign: 'center', marginBottom: 10 }}>
                                /{item.slug}
                            </Text>

                            {/* Actions */}
                            <View style={{ flexDirection: 'row', gap: 8 }}>
                                <TouchableOpacity
                                    onPress={() => openEditModal(item)}
                                    style={{
                                        backgroundColor: 'rgba(14, 26, 46, 0.06)',
                                        paddingHorizontal: 10,
                                        paddingVertical: 5,
                                        borderRadius: 8,
                                        flexDirection: 'row',
                                        alignItems: 'center',
                                        gap: 3
                                    }}
                                >
                                    <Ionicons name="create-outline" size={13} color={NAVY} />
                                    <Text style={{ fontSize: 10.5, fontWeight: '700', color: NAVY }}>Edit</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => deleteCat(item)}
                                    style={{
                                        backgroundColor: '#FEE2E2',
                                        paddingHorizontal: 8,
                                        paddingVertical: 5,
                                        borderRadius: 8
                                    }}
                                >
                                    <Ionicons name="trash-outline" size={13} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', marginTop: 40, opacity: 0.7 }}>
                            <Ionicons name="folder-open-outline" size={48} color="#94A3B8" />
                            <Text style={{ color: '#64748B', marginTop: 10, fontWeight: '700', fontSize: 13 }}>
                                No categories match your search.
                            </Text>
                        </View>
                    }
                />
            )}

            {/* ADD / EDIT MODAL */}
            <Modal visible={modalVisible} animationType="fade" transparent onRequestClose={() => setModalVisible(false)}>
                <View style={{ flex: 1, backgroundColor: 'rgba(14, 26, 46, 0.6)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: NAVY, marginBottom: 14 }}>
                            {editingCategory ? 'Edit Category' : 'Add New Category'}
                        </Text>

                        {/* Image picker preview */}
                        <View style={{ alignItems: 'center', marginBottom: 16 }}>
                            <TouchableOpacity
                                onPress={handlePickImage}
                                style={{
                                    width: 80,
                                    height: 80,
                                    borderRadius: 40,
                                    backgroundColor: '#F8FAFC',
                                    borderWidth: 2,
                                    borderColor: GOLD,
                                    borderStyle: 'dashed',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden'
                                }}
                            >
                                {formImageUrl ? (
                                    <Image source={{ uri: formImageUrl }} style={{ width: '100%', height: '100%' }} />
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        <Ionicons name="camera" size={24} color={GOLD} />
                                        <Text style={{ fontSize: 8.5, color: '#64748B', fontWeight: '700', marginTop: 2 }}>Select Image</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                            {uploading && <Text style={{ fontSize: 10, color: GOLD, fontWeight: '700', marginTop: 4 }}>Uploading image...</Text>}
                        </View>

                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                            Category Name
                        </Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 12, marginBottom: 14, backgroundColor: '#F8FAFC', fontSize: 13, color: NAVY, fontWeight: '700' }}
                            placeholder="e.g. Electronics, Fashion, Groceries"
                            placeholderTextColor="#94A3B8"
                            value={formName}
                            onChangeText={setFormName}
                        />

                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 6 }}>
                            Image URL (or pick from library)
                        </Text>
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 12, marginBottom: 20, backgroundColor: '#F8FAFC', fontSize: 12, color: NAVY }}
                            placeholder="https://images.unsplash.com/..."
                            placeholderTextColor="#94A3B8"
                            value={formImageUrl}
                            onChangeText={setFormImageUrl}
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity
                                onPress={() => setModalVisible(false)}
                                style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 12 }}
                            >
                                <Text style={{ color: '#64748B', fontWeight: '700' }}>Cancel</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={uploading}
                                style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: NAVY, borderRadius: 12, borderWidth: 1, borderColor: GOLD }}
                            >
                                {uploading ? (
                                    <ActivityIndicator color={GOLD} />
                                ) : (
                                    <Text style={{ color: GOLD, fontWeight: '900' }}>Save Category</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
