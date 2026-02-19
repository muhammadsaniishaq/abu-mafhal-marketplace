import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

export const AdminBanners = () => {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [form, setForm] = useState({ title: '', subtitle: '', image_url: '', action_link: '', display_order: '0', section: 'home' });
    const [uploadProgress, setUploadProgress] = useState(0);

    const SECTIONS = ['landing', 'home', 'shop'];

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: form.section === 'shop' ? [2, 1] : [16, 9], // Aspect ratio hint based on section
            quality: 0.8,
            base64: true
        });

        if (!result.canceled) {
            const asset = result.assets[0];
            uploadImageToSupabase(asset);
        }
    };

    const uploadImageToSupabase = async (asset) => {
        try {
            setUploading(true);
            const fileName = `banner_${Date.now()}.jpg`;
            const fileData = decode(asset.base64);

            const { data, error } = await supabase.storage.from('banners').upload(fileName, fileData, {
                contentType: 'image/jpeg',
                upsert: false
            });

            if (error) throw error;

            const { data: publicUrl } = supabase.storage.from('banners').getPublicUrl(fileName);
            setForm(prev => ({ ...prev, image_url: publicUrl.publicUrl }));
            Alert.alert('Success', 'Image uploaded successfully');
        } catch (error) {
            Alert.alert('Upload Error', error.message);
        } finally {
            setUploading(false);
        }
    };

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        setLoading(true);
        const { data, error } = await supabase.from('banners').select('*').order('display_order');
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setBanners(data || []);
        }
        setLoading(false);
    };

    const handleDelete = async (id) => {
        Alert.alert('Delete Banner', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('banners').delete().eq('id', id);
                    if (!error) fetchBanners();
                }
            }
        ]);
    };

    const handleSave = async () => {
        if (!form.image_url || !form.title) {
            Alert.alert('Error', 'Image URL and Title are required');
            return;
        }

        setUploading(true);
        const { error } = await supabase.from('banners').insert([{
            title: form.title,
            subtitle: form.subtitle,
            image_url: form.image_url,
            action_link: form.action_link,
            display_order: parseInt(form.display_order) || 0,
            image_url: form.image_url,
            action_link: form.action_link,
            display_order: parseInt(form.display_order) || 0,
            section: form.section || 'home',
            is_active: true
        }]);

        setUploading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Success', 'Banner added');
            setShowForm(false);
            Alert.alert('Success', 'Banner added');
            setShowForm(false);
            setForm({ title: '', subtitle: '', image_url: '', action_link: '', display_order: '0', section: 'home' });
            fetchBanners();
        }
    };

    const toggleActive = async (banner) => {
        const { error } = await supabase.from('banners').update({ is_active: !banner.is_active }).eq('id', banner.id);
        if (!error) fetchBanners();
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <Text style={styles.sectionTitle}>Home Page Banners</Text>
                <TouchableOpacity onPress={() => setShowForm(!showForm)} style={{ backgroundColor: '#0F172A', padding: 8, borderRadius: 8 }}>
                    <Ionicons name={showForm ? "close" : "add"} size={24} color="white" />
                </TouchableOpacity>
            </View>

            {showForm && (
                <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#E2E8F0' }}>
                    <Text style={{ fontWeight: '700', marginBottom: 12 }}>Add New Banner</Text>

                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Section</Text>
                    <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        {SECTIONS.map(sec => (
                            <TouchableOpacity
                                key={sec}
                                onPress={() => setForm({ ...form, section: sec })}
                                style={{
                                    paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                                    backgroundColor: form.section === sec ? '#0F172A' : '#F1F5F9',
                                    borderWidth: 1, borderColor: form.section === sec ? '#0F172A' : '#CBD5E1'
                                }}
                            >
                                <Text style={{ fontSize: 12, fontWeight: '600', color: form.section === sec ? 'white' : '#64748B', textTransform: 'capitalize' }}>{sec}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Image</Text>
                    <View style={{ marginBottom: 16 }}>
                        {form.image_url ? (
                            <View>
                                <Image source={{ uri: form.image_url }} style={{ width: '100%', height: 150, borderRadius: 8, marginBottom: 8 }} resizeMode="cover" />
                                <TouchableOpacity onPress={() => setForm({ ...form, image_url: '' })} style={{ alignSelf: 'flex-end' }}>
                                    <Text style={{ color: '#EF4444', fontSize: 12, fontWeight: '700' }}>Remove Image</Text>
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity onPress={pickImage} style={{ height: 120, borderWidth: 1, borderColor: '#CBD5E1', borderStyle: 'dashed', borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: 'white' }}>
                                {uploading ? (
                                    <ActivityIndicator color="#3B82F6" />
                                ) : (
                                    <>
                                        <Ionicons name="cloud-upload-outline" size={32} color="#94A3B8" />
                                        <Text style={{ color: '#64748B', marginTop: 4 }}>Tap to upload banner</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Image URL (Optional Override)</Text>
                    <TextInput
                        style={localStyles.input}
                        placeholder="https://..."
                        value={form.image_url}
                        onChangeText={t => setForm({ ...form, image_url: t })}
                    />

                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Title</Text>
                    <TextInput
                        style={localStyles.input}
                        placeholder="Summer Sale"
                        value={form.title}
                        onChangeText={t => setForm({ ...form, title: t })}
                    />

                    <Text style={{ fontSize: 12, color: '#64748B', marginBottom: 4 }}>Subtitle</Text>
                    <TextInput
                        style={localStyles.input}
                        placeholder="Up to 50% Off"
                        value={form.subtitle}
                        onChangeText={t => setForm({ ...form, subtitle: t })}
                    />

                    <TouchableOpacity
                        style={{ backgroundColor: '#3B82F6', padding: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 }}
                        onPress={handleSave}
                        disabled={uploading}
                    >
                        {uploading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Save Banner</Text>}
                    </TouchableOpacity>
                </View>
            )}

            {loading ? (
                <ActivityIndicator color="#0F172A" />
            ) : (
                <ScrollView showsVerticalScrollIndicator={false}>
                    {banners.length === 0 ? <Text style={{ color: '#94A3B8' }}>No banners found.</Text> : null}
                    {banners.map((item) => (
                        <View key={item.id} style={{ marginBottom: 16, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <Image source={{ uri: item.image_url }} style={{ width: '100%', height: 150 }} resizeMode="cover" />
                            <View style={{ padding: 12, backgroundColor: 'white' }}>
                                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <View>
                                        <Text style={{ fontWeight: '700', fontSize: 16 }}>{item.title}</Text>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                            <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                                                <Text style={{ fontSize: 10, fontWeight: '700', color: '#64748B', textTransform: 'uppercase' }}>{item.section || 'HOME'}</Text>
                                            </View>
                                            <Text style={{ color: '#64748B', fontSize: 12 }}>{item.subtitle}</Text>
                                        </View>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 8 }}>
                                        <TouchableOpacity onPress={() => toggleActive(item)} style={{ padding: 6, backgroundColor: item.is_active ? '#DCFCE7' : '#F1F5F9', borderRadius: 6 }}>
                                            <Ionicons name={item.is_active ? "eye" : "eye-off"} size={18} color={item.is_active ? '#10B981' : '#94A3B8'} />
                                        </TouchableOpacity>
                                        <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 6, backgroundColor: '#FEE2E2', borderRadius: 6 }}>
                                            <Ionicons name="trash" size={18} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            </View>
                        </View>
                    ))}
                </ScrollView>
            )}
        </View>
    );
};

const localStyles = {
    input: { backgroundColor: 'white', borderWidth: 1, borderColor: '#CBD5E1', borderRadius: 8, padding: 10, marginBottom: 12, fontSize: 14 }
};
