import React, { useState, useEffect, useCallback } from 'react';
import { 
    View, Text, TouchableOpacity, TextInput, ScrollView, Image, 
    ActivityIndicator, Platform, Dimensions, FlatList, Alert, StyleSheet, RefreshControl 
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Toast } from '../../components/Toast';
import { geminiService } from '../../services/geminiService';

const { width } = Dimensions.get('window');
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

// Simple Modal for Product Search
const SearchModal = ({ visible, onClose, onSearch, results, onSelect }) => {
    const [query, setQuery] = useState('');

    useEffect(() => {
        if (!visible) setQuery('');
    }, [visible]);

    if (!visible) return null;

    return (
        <View style={s.modalOverlay}>
            <View style={s.modalCard}>
                <View style={s.modalHeader}>
                    <View>
                        <Text style={s.modalTitle}>Select Target Product</Text>
                        <Text style={s.modalSub}>Select a product to link directly to this promotional banner</Text>
                    </View>
                    <TouchableOpacity onPress={onClose} style={s.iconButton}>
                        <Ionicons name="close" size={22} color={NAVY} />
                    </TouchableOpacity>
                </View>

                <View style={s.searchBar}>
                    <Ionicons name="search" size={20} color="#94A3B8" />
                    <TextInput
                        placeholder="Search product by name or ID..."
                        placeholderTextColor="#94A3B8"
                        value={query}
                        onChangeText={(t) => { setQuery(t); onSearch(t); }}
                        style={s.searchInput}
                        autoFocus
                    />
                </View>

                <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
                    {results.length === 0 ? (
                        <View style={{ padding: 30, alignItems: 'center' }}>
                            <Ionicons name="cube-outline" size={40} color="#CBD5E1" />
                            <Text style={{ textAlign: 'center', color: '#94A3B8', marginTop: 10, fontSize: 13, fontWeight: '600' }}>
                                No products found. Type a search query above.
                            </Text>
                        </View>
                    ) : (
                        results.map(item => (
                            <TouchableOpacity
                                key={item.id}
                                onPress={() => { onSelect(item); onClose(); }}
                                style={s.searchResultItem}
                                activeOpacity={0.8}
                            >
                                <Image source={{ uri: item.image || 'https://placehold.co/100' }} style={s.productThumb} />
                                <View style={{ flex: 1 }}>
                                    <Text style={s.productTitle} numberOfLines={1}>{item.title}</Text>
                                    <Text style={s.productPrice}>₦{Number(item.price || 0).toLocaleString()}</Text>
                                </View>
                                <View style={s.selectBadge}>
                                    <Text style={s.selectBadgeText}>Select</Text>
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
        tempBase64: ''
    };
    const [promoBanner, setPromoBanner] = useState(initialPromoState);

    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
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
        try {
            const { data: pData, error } = await supabase
                .from('banners')
                .select('*')
                .eq('section', 'promo')
                .order('created_at', { ascending: false });

            if (error) throw error;

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
                    } catch (e) {
                        // Action link was plain text
                        linkData.text = b.action_link || '';
                    }
                    return { ...b, linkData };
                });
                setBanners(formatted);
            } else {
                setBanners([]);
            }
        } catch (err) {
            console.warn('Fetch promo banners error:', err.message);
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
    };

    const handleSavePromo = async () => {
        if (!promoBanner.image_url) {
            Alert.alert('Error', 'Banner image is required.');
            return;
        }

        setLoading(true);
        const linkDataToSave = { ...promoBanner.linkData };
        const stringifiedLink = JSON.stringify(linkDataToSave);
        const payload = { 
            ...promoBanner, 
            action_link: stringifiedLink, 
            section: 'promo',
            title: promoBanner.title || '',
            subtitle: promoBanner.subtitle || '',
            is_active: promoBanner.is_active ?? true
        };

        delete payload.linkData;
        delete payload.tempBase64;
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
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert('Permission', 'Gallery access is required to upload banner.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [21, 9],
                quality: 0.85,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setUploadingBanner(true);

                const fileName = `promo_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;
                const fileData = decode(asset.base64);

                let uploadRes = await supabase.storage
                    .from('banners')
                    .upload(fileName, fileData, {
                        contentType: 'image/jpeg',
                        upsert: true
                    });

                let bucketUsed = 'banners';
                if (uploadRes.error) {
                    uploadRes = await supabase.storage
                        .from('products')
                        .upload(fileName, fileData, {
                            contentType: 'image/jpeg',
                            upsert: true
                        });
                    bucketUsed = 'products';
                }

                if (uploadRes.error) {
                    showToast('Failed to upload image: ' + uploadRes.error.message, 'error');
                    setUploadingBanner(false);
                    return;
                }

                const { data: { publicUrl } } = supabase.storage
                    .from(bucketUsed)
                    .getPublicUrl(fileName);

                setPromoBanner(prev => ({ ...prev, image_url: publicUrl, tempBase64: asset.base64 }));
                setUploadingBanner(false);
                showToast('Image uploaded successfully!', 'success');
            }
        } catch (error) {
            showToast('Error selecting image', 'error');
            setUploadingBanner(false);
        }
    };

    const performProductSearch = async (query) => {
        try {
            const { data } = await supabase
                .from('products')
                .select('*')
                .ilike('name', `%${query}%`)
                .limit(10);
                
            const formatted = data?.map(p => ({ 
                ...p, 
                title: p.name, 
                price: p.price, 
                image: Array.isArray(p.images) ? p.images[0] : p.images 
            })) || [];
            
            setSearchResults(formatted);
        } catch (e) {
            showToast('Search error', 'error');
        }
    };

    const handleSelectProduct = (product) => {
        setPromoBanner(prev => ({
            ...prev,
            linkData: { 
                ...Object(prev.linkData), 
                productId: product.id, 
                productName: product.title 
            }
        }));
        showToast('An danganta kaya: ' + product.title, 'success');
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
                showToast('Gemini AI successfully generated headline!', 'success');
            } else {
                showToast('AI could not generate headline at this time.', 'error');
            }
        } catch (e) {
            console.error("AI Error:", e);
            showToast('AI Error: ' + e.message, 'error');
        } finally {
            setGeneratingAI(false);
        }
    };

    const renderBannerCard = ({ item }) => (
        <View style={s.bannerCard}>
            <View style={s.bannerHero}>
                <Image 
                    source={{ uri: item.image_url || 'https://images.unsplash.com/photo-1607082348824-0a96f2a4b9da?q=80&w=2670&auto=format&fit=crop' }} 
                    style={s.bannerBgImage} 
                />
                <View style={s.bannerHeroOverlay} />
                
                <View style={[s.statusChip, { backgroundColor: item.is_active ? '#059669' : '#64748B' }]}>
                    <Text style={s.statusChipText}>{item.is_active ? 'ACTIVE' : 'INACTIVE'}</Text>
                </View>

                <View style={s.bannerTitles}>
                    {item.subtitle ? (
                        <View style={s.redBadge}>
                            <Text style={s.redBadgeText}>{item.subtitle.toUpperCase()}</Text>
                        </View>
                    ) : null}
                    <Text style={s.bannerTitleText} numberOfLines={2}>
                        {item.title || 'Untitled Promo'}
                    </Text>
                </View>
            </View>

            <View style={s.bannerDetails}>
                <View style={s.tagsRow}>
                    {(item.linkData?.locations || []).map(loc => (
                        <View key={loc} style={s.locTag}>
                            <Text style={s.locTagText}>{loc}</Text>
                        </View>
                    ))}
                    {item.linkData?.productId && (
                        <View style={s.productLinkedTag}>
                            <Ionicons name="link" size={12} color="#7C3AED" />
                            <Text style={s.productLinkedText}>
                                {item.linkData?.productName || 'PRODUCT LINKED'}
                            </Text>
                        </View>
                    )}
                    {item.linkData?.timerEnd && (
                        <View style={s.timerTag}>
                            <Ionicons name="time" size={12} color="#D97706" />
                            <Text style={s.timerTagText}>
                                {new Date(item.linkData.timerEnd).toLocaleDateString()}
                            </Text>
                        </View>
                    )}
                    {item.linkData?.discountValue ? (
                        <View style={s.discountTag}>
                            <Ionicons name="pricetag" size={12} color="#16A34A" />
                            <Text style={s.discountTagText}>
                                {item.linkData.discountValue}{item.linkData.discountType === 'percent' ? '%' : '₦'} OFF
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={s.cardActionsRow}>
                    <TouchableOpacity 
                        onPress={() => handleEdit(item)} 
                        style={s.editActionBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="create-outline" size={16} color={NAVY} />
                        <Text style={s.editActionText}>Edit</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                        onPress={() => handleDelete(item.id)} 
                        style={s.deleteActionBtn}
                        activeOpacity={0.8}
                    >
                        <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        <Text style={s.deleteActionText}>Delete</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );

    if (isEditing) {
        return (
            <ScrollView style={s.container} contentContainerStyle={{ padding: 20, paddingBottom: 100 }}>
                <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

                {/* Edit Header */}
                <View style={s.editHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={s.editTitle}>{promoBanner.id ? 'Edit Promo Banner' : 'New Promo Banner'}</Text>
                        <Text style={s.editSub}>Configure countdown timer, banner copy, and linked product</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity
                            onPress={handleAIGenerate}
                            disabled={generatingAI}
                            style={s.aiButton}
                            activeOpacity={0.8}
                        >
                            {generatingAI ? (
                                <ActivityIndicator size="small" color={GOLD} />
                            ) : (
                                <>
                                    <Ionicons name="sparkles" size={16} color={GOLD} />
                                    <Text style={s.aiButtonText}>AI Copy</Text>
                                </>
                            )}
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => setIsEditing(false)} style={s.closeEditBtn}>
                            <Ionicons name="close" size={22} color={NAVY} />
                        </TouchableOpacity>
                    </View>
                </View>

                <View style={s.formCard}>
                    {/* Status Toggle */}
                    <View style={s.statusToggleRow}>
                        <Text style={s.formSectionTitle}>Banner Status</Text>
                        <TouchableOpacity
                            onPress={() => setPromoBanner(prev => ({ ...prev, is_active: !prev.is_active }))}
                            style={[
                                s.statusToggleButton,
                                { backgroundColor: promoBanner.is_active ? '#ECFDF5' : '#F1F5F9', borderColor: promoBanner.is_active ? '#10B981' : '#CBD5E1' }
                            ]}
                        >
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: promoBanner.is_active ? '#10B981' : '#94A3B8' }} />
                            <Text style={{ fontSize: 12, fontWeight: '800', color: promoBanner.is_active ? '#059669' : '#64748B' }}>
                                {promoBanner.is_active ? 'ACTIVE' : 'HIDDEN'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Display Locations Checkboxes */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={s.inputLabel}>DISPLAY LOCATIONS</Text>
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {['home', 'shop', 'landing'].map(loc => {
                                const isSelected = promoBanner.linkData?.locations?.includes(loc);
                                return (
                                    <TouchableOpacity
                                        key={loc}
                                        onPress={() => toggleLocation(loc)}
                                        style={[
                                            s.locationChip,
                                            isSelected && s.locationChipActive
                                        ]}
                                    >
                                        <View style={[s.checkboxSquare, isSelected && s.checkboxSquareActive]}>
                                            {isSelected && <Ionicons name="checkmark" size={12} color={NAVY} />}
                                        </View>
                                        <Text style={[s.locationChipText, isSelected && s.locationChipTextActive]}>
                                            {loc === 'home' ? 'Home' : loc === 'landing' ? 'Landing Page' : 'Shop'}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>

                    {/* Background Image Upload */}
                    <View style={{ marginBottom: 20 }}>
                        <Text style={s.inputLabel}>BACKGROUND IMAGE</Text>
                        {promoBanner.image_url ? (
                            <View style={s.imagePreviewBox}>
                                <Image source={{ uri: promoBanner.image_url }} style={s.imagePreview} />
                                <TouchableOpacity
                                    style={s.imageChangeOverlay}
                                    onPress={handlePickBannerImage}
                                    disabled={uploadingBanner}
                                >
                                    {uploadingBanner ? (
                                        <ActivityIndicator size="small" color="#FFF" />
                                    ) : (
                                        <>
                                            <Ionicons name="camera" size={16} color="#FFF" />
                                            <Text style={s.imageChangeText}>Change Image</Text>
                                        </>
                                    )}
                                </TouchableOpacity>
                            </View>
                        ) : (
                            <TouchableOpacity
                                style={s.imageUploadDashed}
                                onPress={handlePickBannerImage}
                                disabled={uploadingBanner}
                                activeOpacity={0.8}
                            >
                                {uploadingBanner ? (
                                    <ActivityIndicator size="large" color={GOLD} />
                                ) : (
                                    <>
                                        <View style={s.uploadIconBg}>
                                            <Ionicons name="cloud-upload" size={28} color={GOLD} />
                                        </View>
                                        <Text style={s.uploadPrimaryText}>Upload Banner Image</Text>
                                        <Text style={s.uploadSubText}>Wide banner format (21:9 or 16:9)</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Textiles */}
                    <View style={{ gap: 16 }}>
                        <View>
                            <Text style={s.inputLabel}>MAIN HEADLINE</Text>
                            <TextInput
                                placeholder="e.g. End of Month Mega Sale 50% Off"
                                placeholderTextColor="#94A3B8"
                                value={promoBanner.title}
                                onChangeText={t => setPromoBanner(p => ({ ...p, title: t }))}
                                style={s.formTextInput}
                            />
                            {aiSuggestions?.title && (
                                <Text style={s.aiSuggestionBadge}>AI Suggestion: {aiSuggestions.title}</Text>
                            )}
                        </View>

                        <View>
                            <Text style={s.inputLabel}>BADGE TEXT (HIGHLIGHT)</Text>
                            <TextInput
                                placeholder="e.g. FLASH SALE or LIMITED OFFER"
                                placeholderTextColor="#94A3B8"
                                value={promoBanner.subtitle}
                                onChangeText={t => setPromoBanner(p => ({ ...p, subtitle: t }))}
                                style={s.formTextInput}
                            />
                            {aiSuggestions?.subtitle && (
                                <Text style={s.aiSuggestionBadge}>AI Suggestion: {aiSuggestions.subtitle}</Text>
                            )}
                        </View>

                        <View>
                            <Text style={s.inputLabel}>BUTTON CALL-TO-ACTION</Text>
                            <TextInput
                                placeholder="e.g. SHOP NOW BEFORE IT EXPIRES"
                                placeholderTextColor="#94A3B8"
                                value={promoBanner.linkData?.text}
                                onChangeText={t => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), text: t } }))}
                                style={s.formTextInput}
                            />
                            {aiSuggestions?.buttonText && (
                                <Text style={s.aiSuggestionBadge}>AI Suggestion: {aiSuggestions.buttonText}</Text>
                            )}
                        </View>

                        {aiSuggestions?.notification && (
                            <View style={s.aiNotifCard}>
                                <Text style={s.aiNotifTitle}>AI COPY RECOMMENDATION:</Text>
                                <Text style={s.aiNotifText}>{aiSuggestions.notification}</Text>
                            </View>
                        )}

                        {/* Timer & Product Link */}
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            {/* Date Picker */}
                            <View style={{ flex: 1 }}>
                                <Text style={s.inputLabel}>COUNTDOWN EXPIRY DATE</Text>
                                <TouchableOpacity
                                    onPress={() => setShowDatePicker(true)}
                                    style={[s.formPickerButton, promoBanner.linkData?.timerEnd && s.formPickerButtonActive]}
                                >
                                    <Text style={[s.formPickerText, promoBanner.linkData?.timerEnd && s.formPickerTextActive]}>
                                        {promoBanner.linkData?.timerEnd 
                                            ? new Date(promoBanner.linkData.timerEnd).toLocaleDateString() 
                                            : 'Select Date...'}
                                    </Text>
                                    {promoBanner.linkData?.timerEnd ? (
                                        <TouchableOpacity 
                                            onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), timerEnd: null } }))}
                                        >
                                            <Ionicons name="close-circle" size={18} color="#64748B" />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="calendar-outline" size={18} color="#64748B" />
                                    )}
                                </TouchableOpacity>

                                {showDatePicker && (
                                    Platform.OS === 'web' ? (
                                        <View style={{ marginTop: 8 }}>
                                            <input 
                                                type="date"
                                                value={promoBanner.linkData?.timerEnd || ''}
                                                onChange={(e) => {
                                                    setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), timerEnd: e.target.value } }));
                                                    setShowDatePicker(false);
                                                }}
                                                style={{
                                                    padding: '10px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #CBD5E1',
                                                    backgroundColor: '#FFFFFF',
                                                    color: '#0E1A2E',
                                                    width: '100%'
                                                }}
                                            />
                                        </View>
                                    ) : (
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
                                    )
                                )}
                            </View>

                            {/* Product Search */}
                            <View style={{ flex: 1 }}>
                                <Text style={s.inputLabel}>LINKED PRODUCT</Text>
                                <TouchableOpacity
                                    onPress={() => setSearchModalVisible(true)}
                                    style={[s.formPickerButton, promoBanner.linkData?.productId && s.formPickerButtonActive]}
                                >
                                    <Text style={[s.formPickerText, promoBanner.linkData?.productId && s.formPickerTextActive]} numberOfLines={1}>
                                        {promoBanner.linkData?.productName || 'Select Product...'}
                                    </Text>
                                    {promoBanner.linkData?.productId ? (
                                        <TouchableOpacity 
                                            onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), productId: null, productName: null } }))}
                                        >
                                            <Ionicons name="close-circle" size={18} color="#64748B" />
                                        </TouchableOpacity>
                                    ) : (
                                        <Ionicons name="search-outline" size={18} color="#64748B" />
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>

                        {/* Discount Settings */}
                        <View style={s.discountBox}>
                            <Text style={s.discountBoxTitle}>PROMOTIONAL DISCOUNT</Text>

                            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 14 }}>
                                <TouchableOpacity
                                    onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), discountType: 'percent' } }))}
                                    style={[s.discountTypeBtn, promoBanner.linkData?.discountType === 'percent' && s.discountTypeBtnActive]}
                                >
                                    <Ionicons 
                                        name={promoBanner.linkData?.discountType === 'percent' ? "radio-button-on" : "radio-button-off"} 
                                        size={18} 
                                        color={promoBanner.linkData?.discountType === 'percent' ? NAVY : '#94A3B8'} 
                                    />
                                    <Text style={s.discountTypeLabel}>Percentage (%)</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), discountType: 'amount' } }))}
                                    style={[s.discountTypeBtn, promoBanner.linkData?.discountType === 'amount' && s.discountTypeBtnActive]}
                                >
                                    <Ionicons 
                                        name={promoBanner.linkData?.discountType === 'amount' ? "radio-button-on" : "radio-button-off"} 
                                        size={18} 
                                        color={promoBanner.linkData?.discountType === 'amount' ? NAVY : '#94A3B8'} 
                                    />
                                    <Text style={s.discountTypeLabel}>Fixed Amount (₦)</Text>
                                </TouchableOpacity>
                            </View>

                            <Text style={s.inputLabel}>DISCOUNT VALUE</Text>
                            <TextInput
                                placeholder={promoBanner.linkData?.discountType === 'percent' ? "e.g. 25" : "e.g. 2000"}
                                placeholderTextColor="#94A3B8"
                                value={promoBanner.linkData?.discountValue?.toString()}
                                onChangeText={t => setPromoBanner(p => ({ ...p, linkData: { ...Object(p.linkData), discountValue: t } }))}
                                keyboardType="numeric"
                                style={s.discountInput}
                            />
                        </View>

                        {/* Save Button */}
                        <TouchableOpacity 
                            onPress={handleSavePromo} 
                            disabled={loading} 
                            style={s.savePromoBtn}
                            activeOpacity={0.85}
                        >
                            {loading ? (
                                <ActivityIndicator color={NAVY} />
                            ) : (
                                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                    <Ionicons name="checkmark-circle" size={20} color={NAVY} />
                                    <Text style={s.savePromoBtnText}>Save Promo Banner</Text>
                                </View>
                            )}
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
        <View style={s.container}>
            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(prev => ({ ...prev, visible: false }))} />

            {/* List Header */}
            <View style={s.listHeader}>
                <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <Ionicons name="sparkles" size={22} color={GOLD} />
                        <Text style={s.headerTitle}>Promos & AI Campaigns</Text>
                    </View>
                    <Text style={s.headerSubtitle}>Manage countdown banners, discounts, and AI promotional copy</Text>
                </View>
                <TouchableOpacity onPress={handleAddNew} style={s.addBtn} activeOpacity={0.8}>
                    <Ionicons name="add" size={18} color="#FFFFFF" />
                    <Text style={s.addBtnText}>New Promo</Text>
                </TouchableOpacity>
            </View>

            {loading ? (
                <View style={s.centered}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={s.loadingText}>Loading promo banners...</Text>
                </View>
            ) : (
                <FlatList
                    data={banners}
                    keyExtractor={(item, idx) => item.id ? item.id.toString() : idx.toString()}
                    renderItem={renderBannerCard}
                    contentContainerStyle={{ padding: 16, paddingBottom: 80 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[GOLD, NAVY]} />}
                    ListEmptyComponent={
                        <View style={s.emptyStateBox}>
                            <View style={s.emptyIconCircle}>
                                <Ionicons name="megaphone-outline" size={40} color={GOLD} />
                            </View>
                            <Text style={s.emptyTitle}>No Promo Banners Found</Text>
                            <Text style={s.emptySub}>
                                Tap '+ New Promo' to create an interactive countdown banner with discounts powered by AI.
                            </Text>
                            <TouchableOpacity onPress={handleAddNew} style={s.emptyCreateBtn}>
                                <Ionicons name="sparkles" size={16} color={NAVY} />
                                <Text style={s.emptyCreateBtnText}>Create Promo with AI</Text>
                            </TouchableOpacity>
                        </View>
                    }
                />
            )}
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC'
    },
    listHeader: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottomWidth: 1,
        borderBottomColor: '#E2E8F0',
        elevation: 1,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: '900',
        color: NAVY
    },
    headerSubtitle: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    addBtn: {
        backgroundColor: NAVY,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: GOLD
    },
    addBtnText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 13
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40
    },
    loadingText: {
        marginTop: 12,
        color: '#64748B',
        fontSize: 14,
        fontWeight: '600'
    },
    emptyStateBox: {
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
        marginTop: 40,
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    emptyIconCircle: {
        width: 76,
        height: 76,
        borderRadius: 38,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '900',
        color: NAVY,
        marginBottom: 6
    },
    emptySub: {
        fontSize: 13,
        color: '#64748B',
        textAlign: 'center',
        lineHeight: 18,
        marginBottom: 20
    },
    emptyCreateBtn: {
        backgroundColor: GOLD,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 24
    },
    emptyCreateBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 14
    },
    bannerCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        marginBottom: 16,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 6
    },
    bannerHero: {
        height: 140,
        backgroundColor: NAVY,
        position: 'relative',
        justifyContent: 'flex-end',
        padding: 16
    },
    bannerBgImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        opacity: 0.45
    },
    bannerHeroOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(14, 26, 46, 0.4)'
    },
    statusChip: {
        position: 'absolute',
        top: 12,
        left: 12,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12
    },
    statusChipText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 10,
        letterSpacing: 0.5
    },
    bannerTitles: {
        zIndex: 2
    },
    redBadge: {
        alignSelf: 'flex-start',
        backgroundColor: '#EF4444',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
        marginBottom: 4
    },
    redBadgeText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 10,
        letterSpacing: 0.5
    },
    bannerTitleText: {
        color: '#FFFFFF',
        fontWeight: '900',
        fontSize: 18,
        lineHeight: 22
    },
    bannerDetails: {
        padding: 16
    },
    tagsRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
        flexWrap: 'wrap'
    },
    locTag: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6
    },
    locTagText: {
        color: '#475569',
        fontWeight: '700',
        fontSize: 10,
        textTransform: 'uppercase'
    },
    productLinkedTag: {
        backgroundColor: '#F5F3FF',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    productLinkedText: {
        color: '#7C3AED',
        fontWeight: '700',
        fontSize: 10
    },
    timerTag: {
        backgroundColor: '#FFFBEB',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    timerTagText: {
        color: '#D97706',
        fontWeight: '700',
        fontSize: 10
    },
    discountTag: {
        backgroundColor: '#ECFDF5',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4
    },
    discountTagText: {
        color: '#059669',
        fontWeight: '700',
        fontSize: 10
    },
    cardActionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 10,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9'
    },
    editActionBtn: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    editActionText: {
        fontWeight: '700',
        color: NAVY,
        fontSize: 12
    },
    deleteActionBtn: {
        backgroundColor: '#FEF2F2',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    deleteActionText: {
        fontWeight: '700',
        color: '#EF4444',
        fontSize: 12
    },
    editHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20
    },
    editTitle: {
        fontSize: 22,
        fontWeight: '900',
        color: NAVY
    },
    editSub: {
        fontSize: 12,
        color: '#64748B',
        marginTop: 2
    },
    aiButton: {
        backgroundColor: NAVY,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: GOLD
    },
    aiButtonText: {
        fontWeight: '800',
        color: GOLD,
        fontSize: 12
    },
    closeEditBtn: {
        backgroundColor: '#FFFFFF',
        width: 38,
        height: 38,
        borderRadius: 19,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    formCard: {
        backgroundColor: '#FFFFFF',
        padding: 20,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        elevation: 2,
        shadowColor: NAVY,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 8
    },
    statusToggleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#F1F5F9'
    },
    formSectionTitle: {
        fontWeight: '800',
        fontSize: 15,
        color: NAVY
    },
    statusToggleButton: {
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 20,
        borderWidth: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6
    },
    inputLabel: {
        fontSize: 11,
        fontWeight: '800',
        color: '#64748B',
        marginBottom: 8,
        letterSpacing: 0.5
    },
    locationChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 12,
        backgroundColor: '#F8FAFC',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    locationChipActive: {
        backgroundColor: '#FFFBEB',
        borderColor: GOLD
    },
    checkboxSquare: {
        width: 18,
        height: 18,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center'
    },
    checkboxSquareActive: {
        backgroundColor: GOLD,
        borderColor: GOLD
    },
    locationChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#64748B'
    },
    locationChipTextActive: {
        color: NAVY,
        fontWeight: '800'
    },
    imagePreviewBox: {
        borderRadius: 16,
        overflow: 'hidden',
        height: 150,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        backgroundColor: '#F8FAFC',
        position: 'relative'
    },
    imagePreview: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover'
    },
    imageChangeOverlay: {
        position: 'absolute',
        top: 10,
        right: 10,
        backgroundColor: 'rgba(14, 26, 46, 0.85)',
        paddingHorizontal: 14,
        paddingVertical: 7,
        borderRadius: 18,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        borderWidth: 1,
        borderColor: GOLD
    },
    imageChangeText: {
        color: '#FFFFFF',
        fontWeight: '800',
        fontSize: 12
    },
    imageUploadDashed: {
        height: 140,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        borderStyle: 'dashed',
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center'
    },
    uploadIconBg: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: '#FFFBEB',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 8,
        borderWidth: 1,
        borderColor: '#FDE68A'
    },
    uploadPrimaryText: {
        color: NAVY,
        fontWeight: '800',
        fontSize: 14
    },
    uploadSubText: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2
    },
    formTextInput: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        color: NAVY,
        fontWeight: '600',
        fontSize: 14
    },
    aiSuggestionBadge: {
        fontSize: 11,
        color: '#059669',
        marginTop: 4,
        fontWeight: '700'
    },
    aiNotifCard: {
        backgroundColor: '#F0FDFA',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#5EEAD4'
    },
    aiNotifTitle: {
        fontSize: 11,
        color: '#0D9488',
        fontWeight: '800',
        marginBottom: 4
    },
    aiNotifText: {
        fontSize: 13,
        color: '#115E59',
        lineHeight: 18
    },
    formPickerButton: {
        backgroundColor: '#F8FAFC',
        paddingHorizontal: 12,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between'
    },
    formPickerButtonActive: {
        backgroundColor: '#FFFBEB',
        borderColor: GOLD
    },
    formPickerText: {
        color: '#94A3B8',
        fontWeight: '600',
        fontSize: 13,
        flex: 1
    },
    formPickerTextActive: {
        color: NAVY,
        fontWeight: '700'
    },
    discountBox: {
        backgroundColor: '#F8FAFC',
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    discountBoxTitle: {
        fontSize: 13,
        fontWeight: '800',
        color: NAVY,
        marginBottom: 12
    },
    discountTypeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        padding: 10,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    discountTypeBtnActive: {
        borderColor: GOLD,
        backgroundColor: '#FFFBEB'
    },
    discountTypeLabel: {
        fontWeight: '700',
        color: NAVY,
        fontSize: 12
    },
    discountInput: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: GOLD,
        color: NAVY,
        fontWeight: '800',
        fontSize: 16
    },
    savePromoBtn: {
        backgroundColor: GOLD,
        paddingVertical: 15,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 10,
        elevation: 2,
        shadowColor: GOLD,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6
    },
    savePromoBtnText: {
        color: NAVY,
        fontWeight: '900',
        fontSize: 15
    },
    modalOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(14, 26, 46, 0.65)',
        zIndex: 100,
        justifyContent: 'center',
        padding: 20
    },
    modalCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 20,
        maxHeight: '80%',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.2,
        shadowRadius: 10
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: NAVY
    },
    modalSub: {
        fontSize: 11,
        color: '#64748B',
        marginTop: 2
    },
    iconButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center'
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    searchInput: {
        flex: 1,
        marginLeft: 8,
        fontSize: 14,
        color: NAVY,
        fontWeight: '600'
    },
    searchResultItem: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0'
    },
    productThumb: {
        width: 44,
        height: 44,
        borderRadius: 8,
        marginRight: 10,
        backgroundColor: '#F1F5F9'
    },
    productTitle: {
        fontWeight: '700',
        color: NAVY,
        fontSize: 13
    },
    productPrice: {
        color: GOLD,
        fontWeight: '800',
        fontSize: 12,
        marginTop: 2
    },
    selectBadge: {
        backgroundColor: NAVY,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 14
    },
    selectBadgeText: {
        color: GOLD,
        fontWeight: '800',
        fontSize: 11
    }
});
