import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Image, TextInput, ScrollView, Alert, ActivityIndicator, Modal, StyleSheet, Dimensions, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

const { width } = Dimensions.get('window');

export const AdminBanners = () => {
    const [banners, setBanners] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);

    // Form State
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState(null);
    const [form, setForm] = useState({
        title: '',
        subtitle: '',
        image_url: '',
        action_link: '',
        display_order: '0',
        section: 'home'
    });

    const SECTIONS = ['landing', 'home', 'shop'];

    useEffect(() => {
        fetchBanners();
    }, []);

    const fetchBanners = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('banners')
            .select('*')
            .order('display_order', { ascending: true });

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setBanners(data || []);
        }
        setLoading(false);
    };

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsEditing: true,
            aspect: form.section === 'shop' ? [2, 1] : [16, 9],
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
        } catch (error) {
            Alert.alert('Upload Error', error.message);
        } finally {
            setUploading(false);
        }
    };

    const handleEdit = (banner) => {
        setEditingId(banner.id);
        setForm({
            title: banner.title || '',
            subtitle: banner.subtitle || '',
            image_url: banner.image_url || '',
            action_link: banner.action_link || '',
            display_order: String(banner.display_order || 0),
            section: banner.section || 'home'
        });
        setShowForm(true);
    };

    const handleDelete = async (id) => {
        Alert.alert('Delete Banner', 'Are you sure you want to remove this banner?', [
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
        if (!form.image_url) {
            Alert.alert('Error', 'Image is required');
            return;
        }

        setUploading(true);
        const bannerData = {
            title: form.title,
            subtitle: form.subtitle,
            image_url: form.image_url,
            action_link: form.action_link,
            display_order: parseInt(form.display_order) || 0,
            section: form.section || 'home',
            is_active: true
        };

        let error;
        if (editingId) {
            const { error: updateError } = await supabase
                .from('banners')
                .update(bannerData)
                .eq('id', editingId);
            error = updateError;
        } else {
            const { error: insertError } = await supabase
                .from('banners')
                .insert([bannerData]);
            error = insertError;
        }

        setUploading(false);
        if (error) {
            Alert.alert('Error', error.message);
        } else {
            setShowForm(false);
            resetForm();
            fetchBanners();
        }
    };

    const resetForm = () => {
        setForm({ title: '', subtitle: '', image_url: '', action_link: '', display_order: '0', section: 'home' });
        setEditingId(null);
    };

    const toggleActive = async (banner) => {
        const { error } = await supabase.from('banners').update({ is_active: !banner.is_active }).eq('id', banner.id);
        if (!error) fetchBanners();
    };

    const renderHeader = () => (
        <View style={styles.modernHeader}>
            <View>
                <Text style={styles.modernTitle}>Banners</Text>
                <Text style={styles.modernSubtitle}>Manage marketing slots</Text>
            </View>
            <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => { resetForm(); setShowForm(true); }}
                style={styles.addButtonModern}
            >
                <Ionicons name="add" size={24} color="white" />
                <Text style={styles.addButtonText}>Create</Text>
            </TouchableOpacity>
        </View>
    );

    return (
        <View style={styles.containerWhite}>
            {renderHeader()}

            {loading ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color="#0F172A" />
                </View>
            ) : (
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
                >
                    {banners.length === 0 && (
                        <View style={styles.emptyStateContainer}>
                            <Ionicons name="images-outline" size={64} color="#CBD5E1" />
                            <Text style={styles.emptyStateText}>No banners yet</Text>
                            <Text style={styles.emptyStateSub}>Touch the + button to add one</Text>
                        </View>
                    )}

                    {SECTIONS.map(section => {
                        const sectionBanners = banners.filter(b => (b.section || 'home') === section);
                        if (sectionBanners.length === 0) return null;

                        return (
                            <View key={section} style={{ marginBottom: 32 }}>
                                <View style={styles.sectionHeaderModern}>
                                    <Text style={styles.sectionTitleModern}>{section}</Text>
                                    <View style={styles.badgeModern}>
                                        <Text style={styles.badgeText}>{sectionBanners.length}</Text>
                                    </View>
                                </View>

                                {sectionBanners.map((item) => (
                                    <View key={item.id} style={styles.bannerCardModern}>
                                        <Image source={{ uri: item.image_url }} style={styles.bannerImageModern} resizeMode="cover" />
                                        <View style={styles.bannerContentModern}>
                                            <View style={{ flex: 1 }}>
                                                {/* REMOVED TITLE/SUBTITLE FROM CARD AS THEY ARE NOW UNUSED */}
                                            </View>
                                            <View style={styles.cardActionsModern}>
                                                <TouchableOpacity
                                                    onPress={() => toggleActive(item)}
                                                    style={[styles.iconButtonSmall, { backgroundColor: item.is_active ? '#DCFCE7' : '#F1F5F9' }]}
                                                >
                                                    <Ionicons name={item.is_active ? "eye" : "eye-off"} size={18} color={item.is_active ? '#10B981' : '#64748B'} />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleEdit(item)}
                                                    style={[styles.iconButtonSmall, { backgroundColor: '#DBEAFE' }]}
                                                >
                                                    <Ionicons name="create-outline" size={18} color="#2563EB" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => handleDelete(item.id)}
                                                    style={[styles.iconButtonSmall, { backgroundColor: '#FEE2E2' }]}
                                                >
                                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        );
                    })}
                </ScrollView>
            )}

            {/* MODAL FORM */}
            <Modal
                visible={showForm}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setShowForm(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContentModern}>
                        <View style={styles.modalHeaderModern}>
                            <Text style={styles.modalTitleModern}>{editingId ? 'Edit Banner' : 'New Banner'}</Text>
                            <TouchableOpacity onPress={() => setShowForm(false)}>
                                <Ionicons name="close" size={24} color="#0F172A" />
                            </TouchableOpacity>
                        </View>

                        <ScrollView showsVerticalScrollIndicator={false} style={{ padding: 20 }}>
                            <Text style={styles.labelModern}>Target Section</Text>
                            <View style={styles.segmentContainer}>
                                {SECTIONS.map(sec => (
                                    <TouchableOpacity
                                        key={sec}
                                        onPress={() => setForm({ ...form, section: sec })}
                                        style={[styles.segmentItem, form.section === sec && styles.segmentItemActive]}
                                    >
                                        <Text style={[styles.segmentText, form.section === sec && styles.segmentTextActive]}>{sec}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>

                            <Text style={styles.labelModern}>Banner Image</Text>
                            <TouchableOpacity onPress={pickImage} style={styles.imageUploadBoxModern}>
                                {form.image_url ? (
                                    <>
                                        <Image source={{ uri: form.image_url }} style={styles.previewImageModern} />
                                        <View style={styles.imageReplaceOverlay}>
                                            <Ionicons name="camera" size={20} color="white" />
                                            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 10, marginLeft: 6 }}>CHANGE</Text>
                                        </View>
                                    </>
                                ) : (
                                    <View style={{ alignItems: 'center' }}>
                                        {uploading ? <ActivityIndicator color="#3B82F6" /> : (
                                            <>
                                                <Ionicons name="image-outline" size={40} color="#CBD5E1" />
                                                <Text style={styles.uploadTextModern}>Select Image</Text>
                                            </>
                                        )}
                                    </View>
                                )}
                            </TouchableOpacity>

                            <Text style={styles.labelModern}>Deep Link / Action (Optional)</Text>
                            <TextInput
                                style={styles.modernInput}
                                placeholder="/shop/category"
                                value={form.action_link}
                                onChangeText={t => setForm({ ...form, action_link: t })}
                            />

                            <TouchableOpacity
                                style={styles.saveButtonModern}
                                onPress={handleSave}
                                disabled={uploading}
                            >
                                {uploading ? <ActivityIndicator color="white" /> : (
                                    <Text style={styles.saveButtonText}>{editingId ? 'Update Banner' : 'Create Banner'}</Text>
                                )}
                            </TouchableOpacity>

                            <View style={{ height: 40 }} />
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// Integration styles added to main theme or used here if distinct
// I'll define them properly in the component scope or use existing from styles.theme
// Assuming styles.theme is already quite rich, I'll use inline styles for the gaps
const localStyles = StyleSheet.create({
    // Using existing styles where possible
});
