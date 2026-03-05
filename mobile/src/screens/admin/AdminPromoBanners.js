import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, ActivityIndicator, Platform, Dimensions, FlatList, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Toast } from '../../components/Toast';
import { geminiService } from '../../services/geminiService';

const { width } = Dimensions.get('window');

// Simple Modal for Product Search
const SearchModal = ({ visible, onClose, onSearch, results, onSelect }) => {
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!visible) setQuery('');
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.5)', zIndex: 100, justifyContent: 'center', padding: 20 }}>
            <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, maxHeight: '80%' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>Select Linked Product</Text>
                    <TouchableOpacity onPress={onClose}>
                        <Ionicons name="close" size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16 }}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        placeholder="Search products..."
                        value={query}
                        onChangeText={(t) => { setQuery(t); onSearch(t); }}
                        style={{ flex: 1, marginLeft: 10, fontSize: 16, color: '#0F172A' }}
                        autoFocus
                    />
                </View>

                <ScrollView contentContainerStyle={{ gap: 12 }}>
                    {results.length === 0 ? (
                        <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 20 }}>No products found</Text>
                    ) : (
                        results.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => { onSelect(item); onClose(); }}
                                style={{ flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#FFF', borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' }}
                            >
                                <Image source={{ uri: item.image || 'https://placehold.co/100' }} style={{ width: 48, height: 48, borderRadius: 8, marginRight: 12 }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 15 }} numberOfLines={1}>{item.title}</Text>
                                    <Text style={{ color: '#64748B', fontSize: 13, marginTop: 2 }}>{item.subtitle}</Text>
                                </View>
                                <View style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16 }}>
                                    <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 12 }}>Select</Text>
                                </View>
                            </TouchableOpacity>
                        ))
                    )}
                </ScrollView>
            </View>
        </View>
    );
};

export const AdminPromoBanners = () => {
    const [banners, setBanners] = useState([]);
    const [isEditing, setIsEditing] = useState(false);

    const initialPromoState = {
        id: null,
        title: '',
        subtitle: '',
        image_url: '',
        is_active: true,
        linkData: { text: '', timerEnd: '', productId: '', productName: '', locations: ['home'], discountType: 'percent', discountValue: '' },
        tempBase64: '' // Added for AI analysis
    };
    const [promoBanner, setPromoBanner] = useState(initialPromoState);

    const [loading, setLoading] = useState(true);
    const [uploadingBanner, setUploadingBanner] = useState(false);
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
    const [showDatePicker, setShowDatePicker] = useState(false);

    // Search Modal State
    const [searchModalVisible, setSearchModalVisible] = useState(false);
    const [searchResults, setSearchResults] = useState([]);
    const [generatingAI, setGeneratingAI] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState(null);

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
        setTimeout(() => setToast(prev => ({ ...prev, visible: false })), 3000);
    };

    const fetchData = useCallback(async () => {
        setLoading(true);
        const { data: pData } = await supabase.from('banners').select('*').eq('section', 'promo').order('created_at', { ascending: false });
        if (pData) {
            const formatted = pData.map(b => {
                let linkData = { text: '', timerEnd: '', productId: '', productName: '', locations: ['home'] };
                try {
                    if (b.action_link) {
                        const parsed = JSON.parse(b.action_link);
                        linkData = {
                            ...linkData,
                            ...parsed,
                            locations: parsed.locations || ['home'],
                            discountType: parsed.discountType || 'percent',
                            discountValue: parsed.discountValue || ''
                        };
                    }
                } catch (e) { console.warn("Failed to parse link data"); }
                return { ...b, linkData };
            });
            setBanners(formatted);
        } else {
            setBanners([]);
        }
        setLoading(false);
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSavePromo = async () => {
        setLoading(true);
        const linkDataToSave = { ...promoBanner.linkData };
        const stringifiedLink = JSON.stringify(linkDataToSave);
        const payload = { ...promoBanner, action_link: stringifiedLink, section: 'promo' };

        delete payload.linkData;
        delete payload.tempBase64; // Don't save base64 to DB
        delete payload.link;

        if (!payload.id) {
            delete payload.id;
        }

        const { error } = await supabase.from('banners').upsert(payload);
        setLoading(false);

        if (error) {
            showToast(error.message, 'error');
        } else {
            showToast('Promo banner saved successfully!', 'success');
            setIsEditing(false);
            fetchData();
        }
    };

    const handleDelete = (id) => {
        Alert.alert('Delete Promo Banner', 'Are you sure you want to delete this promo banner? This action cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    const { error } = await supabase.from('banners').delete().eq('id', id);
                    if (error) {
                        showToast(error.message, 'error');
                    } else {
                        showToast('Banner deleted successfully', 'success');
                        fetchData();
                    }
                }
            }
        ]);
    };

    const handleEdit = (banner) => {
        setPromoBanner(banner);
        setIsEditing(true);
    };

    const handleAddNew = () => {
        setPromoBanner(initialPromoState);
        setIsEditing(true);
    };

    const handlePickBannerImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: 'images',
                allowsEditing: true,
                aspect: [21, 9],
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setUploadingBanner(true);

                const fileName = `promo_banner_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const filePath = `${fileName}`;

                const { error: uploadError } = await supabase.storage
                    .from('products') // using existing products bucket
                    .upload(filePath, decode(asset.base64), {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                if (uploadError) {
                    showToast('Failed to upload image.', 'error');
                    setUploadingBanner(false);
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from('products')
                    .getPublicUrl(filePath);

                setPromoBanner(prev => ({ ...prev, image_url: publicUrl, tempBase64: asset.base64 }));
                setUploadingBanner(false);
                showToast('Image uploaded successfully! Remember to save.', 'success');
            }
        } catch (error) {
            showToast('Error selecting image', 'error');
            setUploadingBanner(false);
        }
    };

    const performProductSearch = async (query) => {
        try {
            const { data } = await supabase.from('products').select('*').eq('status', 'approved').ilike('name', `%${query}%`).limit(10);
            const formatted = data?.map(p => ({ ...p, title: p.name, subtitle: `₦${p.price}`, image: p.images?.[0] })) || [];
            setSearchResults(formatted);
        } catch (e) {
            showToast('Search error', 'error');
        }
    };

    const handleSelectProduct = (product) => {
        setPromoBanner(prev => ({
            ...prev,
            linkData: { ...Object(prev.linkData), productId: product.id, productName: product.title }
        }));
        showToast('Product linked', 'success');
    };

    const toggleLocation = (loc) => {
        setPromoBanner(prev => {
            const currentLocs = prev.linkData?.locations || [];
            const newLocs = currentLocs.includes(loc) ? currentLocs.filter(l => l !== loc) : [...currentLocs, loc];
            return { ...prev, linkData: { ...Object(prev.linkData), locations: newLocs } };
        });
    };

    const handleAIGenerate = async () => {
        if (generatingAI) return;
        setGeneratingAI(true);
        try {
            const context = {
                productName: promoBanner.linkData?.productName || '',
                subtitle: promoBanner.subtitle || '',
                discount: promoBanner.linkData?.discountValue ? `${promoBanner.linkData.discountValue}${promoBanner.linkData.discountType === 'percent' ? '%' : '₦'}` : '',
                base64Image: promoBanner.tempBase64 || null
            };

            const result = await geminiService.generatePromoCopy(context);
            if (result) {
                setAiSuggestions(result);
                setPromoBanner(prev => ({
                    ...prev,
                    title: result.title || prev.title,
                    subtitle: result.subtitle || prev.subtitle,
                    linkData: {
                        ...Object(prev.linkData),
                        text: result.buttonText || prev.linkData?.text
                    }
                }));
                showToast('AI copy generated!', 'success');
            } else {
                showToast('AI failed to generate copy.', 'error');
            }
        } catch (e) {
            console.error("AI Error:", e);
            showToast('AI Error', 'error');
        } finally {
            setGeneratingAI(false);
        }
    };

    const renderBannerCard = ({ item }) => (
        <View style={{ backgroundColor: 'white', borderRadius: 20, marginBottom: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.05)' }}>
            <View style={{ height: 120, backgroundColor: '#0F172A', position: 'relative' }}>
                <Image source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }} style={{ width: '100%', height: '100%', opacity: 0.5 }} />
                <View style={{ position: 'absolute', top: 12, left: 12, backgroundColor: item.is_active ? '#10B981' : '#64748B', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ color: 'white', fontWeight: '800', fontSize: 10, letterSpacing: 0.5 }}>{item.is_active ? 'ACTIVE' : 'INACTIVE'}</Text>
                </View>
                <View style={{ position: 'absolute', bottom: 12, left: 16 }}>
                    <Text style={{ color: 'white', fontWeight: '900', fontSize: 20 }} numberOfLines={1}>{item.title || 'Untitled Promo'}</Text>
                    <Text style={{ color: '#EF4444', fontWeight: '800', fontSize: 12 }}>{item.subtitle || 'NO SUBTITLE'}</Text>
                </View>
            </View>

            <View style={{ padding: 16 }}>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                    {(item.linkData?.locations || []).map(loc => (
                        <View key={loc} style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                            <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 10, textTransform: 'uppercase' }}>{loc}</Text>
                        </View>
                    ))}
                    {item.linkData?.productId && (
                        <View style={{ backgroundColor: '#FCF5FF', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="link" size={10} color="#9333EA" />
                            <Text style={{ color: '#9333EA', fontWeight: '700', fontSize: 10 }}>PRODUCT LINKED</Text>
                        </View>
                    )}
                    {item.linkData?.timerEnd && (
                        <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="time" size={10} color="#D97706" />
                            <Text style={{ color: '#D97706', fontWeight: '700', fontSize: 10 }}>TIMER ACTIVE</Text>
                        </View>
                    )}
                    {item.linkData?.discountValue ? (
                        <View style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                            <Ionicons name="pricetag" size={10} color="#16A34A" />
                            <Text style={{ color: '#16A34A', fontWeight: '700', fontSize: 10 }}>
                                {item.linkData.discountValue}{item.linkData.discountType === 'percent' ? '%' : '₦'} OFF
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
                    <TouchableOpacity onPress={() => handleEdit(item)} style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="pencil" size={14} color="#0F172A" />
                        <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 13 }}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Ionicons name="trash" size={14} color="#EF4444" />
                        <Text style={{ fontWeight: '700', color: '#EF4444', fontSize: 13 }}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    if (isEditing) {
        return (
            <ScrollView style={{ flex: 1, backgroundColor: '#F8FAFC' }} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 4 }}>{promoBanner.id ? 'Edit Promo' : 'New Promo'}</Text>
                        <Text style={{ fontSize: 14, color: '#64748B' }}>Configure this promo banner's details.</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                            onPress={handleAIGenerate}
                            disabled={generatingAI}
                            style={{ backgroundColor: '#F0FDF4', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 1, borderColor: '#16A34A' }}
                        >
                            {generatingAI ? <ActivityIndicator size="small" color="#16A34A" /> : <Ionicons name="sparkles" size={16} color="#16A34A" />}
                            <Text style={{ fontWeight: '800', color: '#16A34A', fontSize: 13 }}>AI Copy</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsEditing(false)} style={{ backgroundColor: '#F1F5F9', padding: 10, borderRadius: 20 }}>
                            <Ionicons name="close" size={24} color="#64748B" />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={{ backgroundColor: 'white', padding: 20, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.05)' }}>
                    {/* Status Toggle */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                        <Text style={{ fontWeight: '800', fontSize: 16, color: '#0F172A' }}>Banner Status</Text>
                        <TouchableOpacity
                            onPress={() => setPromoBanner(prev => ({ ...prev, is_active: !prev.is_active }))}
                            style={{
                                paddingHorizontal: 16, paddingVertical: 8, borderRadius: 24,
                                backgroundColor: promoBanner.is_active ? '#ECFDF5' : '#F1F5F9',
                                borderWidth: 1, borderColor: promoBanner.is_active ? '#10B981' : '#E2E8F0',
                                flexDirection: 'row', alignItems: 'center', gap: 6
                            }}
                        >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: promoBanner.is_active ? '#10B981' : '#94A3B8' }} />
                            <Text style={{ fontSize: 13, fontWeight: '700', color: promoBanner.is_active ? '#10B981' : '#64748B' }}>
                                {promoBanner.is_active ? 'Active Globally' : 'Hidden'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Display Locations Checkboxes */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 12, marginLeft: 4 }}>DISPLAY LOCATIONS</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {['home', 'shop', 'landing'].map(loc => {
                                const isSelected = promoBanner.linkData?.locations?.includes(loc);
                                return (
                                    <TouchableOpacity
                                        key={loc}
                                        onPress={() => toggleLocation(loc)}
                                        style={{
                                            flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12,
                                            backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFC',
                                            borderWidth: 1, borderColor: isSelected ? '#3B82F6' : '#E2E8F0'
                                        }}
                                    >
                                        <View style={{ width: 18, height: 18, borderRadius: 6, backgroundColor: isSelected ? '#3B82F6' : 'white', borderWidth: isSelected ? 0 : 2, borderColor: '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                                            {isSelected && <Ionicons name="checkmark" size={12} color="white" />}
                                        </View>
                                        <Text style={{ fontSize: 13, fontWeight: '700', color: isSelected ? '#1D4ED8' : '#64748B', textTransform: 'capitalize' }}>
                                            {loc === 'home' ? 'Home Page' : loc === 'landing' ? 'Landing Page' : loc}
                                        </Text>
                                    </TouchableOpacity>
                                )
                            })}
                        </View>
                    </View>

                    <View style={{ gap: 16 }}>
                        {/* Background Image */}
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4 }}>BANNER BACKGROUND</Text>
                            {promoBanner.image_url ? (
                                <View style={{ borderRadius: 16, overflow: 'hidden', height: 140, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }}>
                                    <Image source={{ uri: promoBanner.image_url }} style={{ width: '100%', height: '100%', resizeMode: 'cover' }} />
                                    <TouchableOpacity
                                        style={{ position: 'absolute', top: 10, right: 10, backgroundColor: 'rgba(0,0,0,0.6)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}
                                        onPress={handlePickBannerImage}
                                        disabled={uploadingBanner}
                                    >
                                        {uploadingBanner ? <ActivityIndicator size="small" color="#FFF" /> : <Ionicons name="camera" size={16} color="white" />}
                                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 13 }}>{uploadingBanner ? 'Uploading...' : 'Change'}</Text>
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <TouchableOpacity
                                    style={{ height: 140, borderRadius: 16, borderWidth: 2, borderColor: '#E2E8F0', borderStyle: 'dashed', backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center' }}
                                    onPress={handlePickBannerImage}
                                    disabled={uploadingBanner}
                                >
                                    {uploadingBanner ? (
                                        <ActivityIndicator size="large" color="#3B82F6" />
                                    ) : (
                                        <>
                                            <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
                                                <Ionicons name="cloud-upload" size={24} color="#3B82F6" />
                                            </View>
                                            <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 15 }}>Upload Banner Image</Text>
                                            <Text style={{ color: '#64748B', fontSize: 13, marginTop: 4 }}>Landscape ratio recommended</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Textiles */}
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4 }}>MAIN TITLE</Text>
                            <TextInput
                                placeholder="e.g. End of Year Clearance 70% Off"
                                value={promoBanner.title}
                                onChangeText={t => setPromoBanner(p => ({ ...p, title: t }))}
                                style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A', fontWeight: '500' }}
                            />
                            {aiSuggestions?.title && (
                                <Text style={{ fontSize: 11, color: '#10B981', marginTop: 4, marginLeft: 4, fontWeight: '700' }}>AI Suggestion: {aiSuggestions.title}</Text>
                            )}
                            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, marginLeft: 4 }}>Wannan shine babban rubutun da zai fito a tsakiyar banner. Misali: "HOT DEALS".</Text>
                        </View>
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4 }}>SUBTITLE NOTIFICATION (The RED badge)</Text>
                            <TextInput
                                placeholder="e.g. FLASH SALE"
                                value={promoBanner.subtitle}
                                onChangeText={t => setPromoBanner(p => ({ ...p, subtitle: t }))}
                                style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A', fontWeight: '500' }}
                            />
                            {aiSuggestions?.subtitle && (
                                <Text style={{ fontSize: 11, color: '#10B981', marginTop: 4, marginLeft: 4, fontWeight: '700' }}>AI Suggestion: {aiSuggestions.subtitle}</Text>
                            )}
                            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, marginLeft: 4 }}>Rubutu ne karami wanda yake fitowa a cikin ja. Misali: "LIMITED OFFER".</Text>
                        </View>
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4 }}>BUTTON TEXT</Text>
                            <TextInput
                                placeholder="e.g. Grab it before it's gone"
                                value={promoBanner.linkData?.text}
                                onChangeText={t => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), text: t } }))}
                                style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', color: '#0F172A', fontWeight: '500' }}
                            />
                            {aiSuggestions?.buttonText && (
                                <Text style={{ fontSize: 11, color: '#10B981', marginTop: 4, marginLeft: 4, fontWeight: '700' }}>AI Suggestion: {aiSuggestions.buttonText}</Text>
                            )}
                            <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, marginLeft: 4 }}>Rubutun da zai fito a kasan banner domin kwadaitar da mutane su shiga. Misali: "SAYE YANZU".</Text>
                        </View>
                        {aiSuggestions?.notification && (
                            <View style={{ backgroundColor: '#F0FDFA', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#5EEAD4' }}>
                                <Text style={{ fontSize: 12, color: '#0D9488', fontWeight: '800', marginBottom: 4 }}>AI SUGGESTED NOTIFICATION:</Text>
                                <Text style={{ fontSize: 13, color: '#115E59' }}>{aiSuggestions.notification}</Text>
                            </View>
                        )}

                        {/* Timer & Product Link */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4 }}>COUNTDOWN END (Optional)</Text>
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    style={{ backgroundColor: promoBanner.linkData?.timerEnd ? '#EFF6FF' : '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: promoBanner.linkData?.timerEnd ? '#BFE8FF' : '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <Text style={{ color: promoBanner.linkData?.timerEnd ? '#1D4ED8' : '#94A3B8', fontWeight: '600', fontSize: 14 }}>
                                        {promoBanner.linkData?.timerEnd ? new Date(promoBanner.linkData.timerEnd).toLocaleDateString() : 'Select Date...'}
                                    </Text>
                                    {promoBanner.linkData?.timerEnd ? (
                                        <TouchableOpacity onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), timerEnd: null } }))} style={{ padding: 2 }}>
                                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="calendar" size={16} color="#94A3B8" />
                                    )}
                                </TouchableOpacity>
                                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4, marginLeft: 4 }}>Date timer stops.</Text>
                            </View>

                            {showDatePicker && (
                                <DateTimePicker
                                    value={promoBanner.linkData?.timerEnd ? new Date(promoBanner.linkData.timerEnd) : new Date()}
                                    mode="date"
                                    display="default"
                                    minimumDate={new Date()}
                                    onChange={(event, selectedDate) => {
                                        setShowDatePicker(Platform.OS === 'ios');
                                        if (selectedDate) {
                                            const formattedDate = selectedDate.toISOString().split('T')[0];
                                            setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), timerEnd: formattedDate } }));
                                        }
                                    }}
                                />
                            )}

                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4 }}>LINKED PRODUCT</Text>
                                <TouchableOpacity
                                    onPress={() => setSearchModalVisible(true)}
                                    style={{ backgroundColor: promoBanner.linkData?.productId ? '#EFF6FF' : '#F8FAFC', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: promoBanner.linkData?.productId ? '#BFE8FF' : '#E2E8F0', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
                                >
                                    <Text style={{ color: promoBanner.linkData?.productId ? '#1D4ED8' : '#94A3B8', fontWeight: '600', fontSize: 14 }} numberOfLines={1}>
                                        {promoBanner.linkData?.productName ? promoBanner.linkData.productName : promoBanner.linkData?.productId ? 'Product Selected' : 'Select Product'}
                                    </Text>
                                    {promoBanner.linkData?.productId ? (
                                        <TouchableOpacity onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), productId: null, productName: null } }))} style={{ padding: 2 }}>
                                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="search" size={16} color="#94A3B8" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Discount Settings */}
                        <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: '#0F172A', marginBottom: 12 }}>PROMO DISCOUNT</Text>

                            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center', marginBottom: 16 }}>
                                <TouchableOpacity
                                    onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), discountType: 'percent' } }))}
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: promoBanner.linkData?.discountType === 'percent' ? '#FFF' : 'transparent', borderWidth: 1, borderColor: promoBanner.linkData?.discountType === 'percent' ? '#3B82F6' : '#E2E8F0' }}
                                >
                                    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: promoBanner.linkData?.discountType === 'percent' ? '#3B82F6' : '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                                        {promoBanner.linkData?.discountType === 'percent' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />}
                                    </View>
                                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>Percentage (%)</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), discountType: 'amount' } }))}
                                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 12, backgroundColor: promoBanner.linkData?.discountType === 'amount' ? '#FFF' : 'transparent', borderWidth: 1, borderColor: promoBanner.linkData?.discountType === 'amount' ? '#3B82F6' : '#E2E8F0' }}
                                >
                                    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: promoBanner.linkData?.discountType === 'amount' ? '#3B82F6' : '#CBD5E1', alignItems: 'center', justifyContent: 'center' }}>
                                        {promoBanner.linkData?.discountType === 'amount' && <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#3B82F6' }} />}
                                    </View>
                                    <Text style={{ fontWeight: '700', color: '#0F172A' }}>Fixed (₦)</Text>
                                </TouchableOpacity>
                            </View>

                            <View>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8 }}>DISCOUNT VALUE</Text>
                                <TextInput
                                    placeholder={promoBanner.linkData?.discountType === 'percent' ? "e.g. 50" : "e.g. 1000"}
                                    value={promoBanner.linkData?.discountValue?.toString()}
                                    onChangeText={t => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), discountValue: t } }))}
                                    keyboardType="numeric"
                                    style={{ backgroundColor: '#FFF', padding: 14, borderRadius: 12, borderWidth: 1, borderColor: '#3B82F6', color: '#0F172A', fontWeight: '800', fontSize: 16 }}
                                />
                                <Text style={{ fontSize: 11, color: '#94A3B8', marginTop: 4 }}>Leave blank for no visual discount.</Text>
                            </View>
                        </View>

                        <TouchableOpacity onPress={handleSavePromo} disabled={loading} style={{ backgroundColor: '#3B82F6', padding: 16, borderRadius: 16, alignItems: 'center', marginTop: 10, opacity: loading ? 0.7 : 1 }}>
                            {loading ? <ActivityIndicator color="#FFF" /> : <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Save Promo Banner</Text>}
                        </TouchableOpacity>
                    </View>
                </View>

                <SearchModal
                    visible={searchModalVisible}
                    onClose={() => setSearchModalVisible(false)}
                    onSearch={performProductSearch}
                    results={searchResults}
                    onSelect={handleSelectProduct}
                />
            </ScrollView>
        );
    }

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

            <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', marginBottom: 4 }}>Promo Banners</Text>
                    <Text style={{ fontSize: 14, color: '#64748B' }}>Manage your global promotional campaigns.</Text>
                </View>
                <TouchableOpacity onPress={handleAddNew} style={{ backgroundColor: '#0F172A', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="add" size={18} color="white" />
                    <Text style={{ color: 'white', fontWeight: '700', fontSize: 14 }}>Add New</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : (
                <FlatList
                    data={banners}
                    keyExtractor={(item, idx) => item.id ? item.id.toString() : idx.toString()}
                    renderItem={renderBannerCard}
                    contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
                    ListEmptyComponent={
                        <View style={{ alignItems: 'center', justifyContent: 'center', marginTop: 40 }}>
                            <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                <Ionicons name="megaphone-outline" size={40} color="#3B82F6" />
                            </View>
                            <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A', marginBottom: 8 }}>No Active Promos</Text>
                            <Text style={{ textAlign: 'center', color: '#64748B', maxWidth: 250 }}>Click 'Add New' to create a countdown banner campaign across the app.</Text>
                        </View>
                    }
                />
            )}
        </View>
    );
};
