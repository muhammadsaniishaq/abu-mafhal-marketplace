import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, Image, Alert, Modal, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminCategories = () => {
    const [categories, setCategories] = useState([]);
    const [modalVisible, setModalVisible] = useState(false);
    const [newCat, setNewCat] = useState({ name: '', image_url: '' });

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        const { data, error } = await supabase.from('categories').select('*').order('display_order', { ascending: true });
        if (data) setCategories(data);
    };

    const handleCreate = async () => {
        if (!newCat.name) return Alert.alert('Error', 'Name is required');

        const slug = newCat.name.toLowerCase().replace(/ /g, '-');
        const { error } = await supabase.from('categories').insert([{ ...newCat, slug, is_active: true }]);

        if (!error) {
            Alert.alert('Success', 'Category Added');
            setModalVisible(false);
            setNewCat({ name: '', image_url: '' });
            fetchCategories();
        } else {
            Alert.alert('Error', error.message);
        }
    };

    const deleteCat = async (id) => {
        Alert.alert('Delete', 'Delete this category?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete', style: 'destructive', onPress: async () => {
                    await supabase.from('categories').delete().eq('id', id);
                    setCategories(prev => prev.filter(c => c.id !== id));
                }
            }
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Manage Categories</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={{ backgroundColor: '#0F172A', padding: 8, borderRadius: 8 }}>
                    <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={categories}
                keyExtractor={item => item.id}
                numColumns={3}
                contentContainerStyle={{ padding: 20 }}
                renderItem={({ item }) => (
                    <View style={{ flex: 1, alignItems: 'center', margin: 8, position: 'relative' }}>
                        <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', marginBottom: 8, overflow: 'hidden' }}>
                            {item.image_url ? (
                                <Image source={{ uri: item.image_url }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="image-outline" size={24} color="#CBD5E1" />
                                </View>
                            )}
                        </View>
                        <Text style={{ fontSize: 12, fontWeight: '600', textAlign: 'center' }}>{item.name}</Text>
                        <TouchableOpacity
                            onPress={() => deleteCat(item.id)}
                            style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#EF4444', borderRadius: 10, padding: 4 }}
                        >
                            <Ionicons name="close" size={12} color="white" />
                        </TouchableOpacity>
                    </View>
                )}
            />

            <Modal visible={modalVisible} animationType="fade" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 16 }}>
                        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 16 }}>Add Category</Text>

                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 8, marginBottom: 12 }}
                            placeholder="Category Name (e.g. Fashion)"
                            value={newCat.name}
                            onChangeText={t => setNewCat(p => ({ ...p, name: t }))}
                        />
                        <TextInput
                            style={{ borderWidth: 1, borderColor: '#E2E8F0', padding: 12, borderRadius: 8, marginBottom: 20 }}
                            placeholder="Image URL"
                            value={newCat.image_url}
                            onChangeText={t => setNewCat(p => ({ ...p, image_url: t }))}
                        />

                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 8 }}>
                                <Text>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreate} style={{ flex: 1, padding: 12, alignItems: 'center', backgroundColor: '#0F172A', borderRadius: 8 }}>
                                <Text style={{ color: 'white', fontWeight: '700' }}>Save</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};
