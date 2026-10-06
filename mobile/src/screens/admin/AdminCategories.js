import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image, Alert,
    Modal, TextInput, ActivityIndicator, RefreshControl, StyleSheet,
    ScrollView, Platform, Switch, Dimensions
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import { supabase } from '../../lib/supabase';
import {
    fetchAllCategories,
    saveCategory,
    deleteCategory,
    toggleCategoryStatus,
    subscribeToCategoryChanges,
    invalidateCategoryCaches,
    generateSlug
} from '../../services/categoryService';

const BRAND = {
    navyDark: '#071422',
    navy: '#0A192F',
    navyLight: '#0E2340',
    navyCard: '#112240',
    gold: '#D9A73A',
    goldLight: '#FEF3C7',
    goldGlow: '#F5C842',
    goldDark: '#A07820',
    emerald: '#10B981',
    emeraldLight: '#ECFDF5',
    sky: '#0284C7',
    skyLight: '#E0F2FE',
    slate: '#64748B',
    slateDark: '#0F172A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderGold: 'rgba(217, 167, 58, 0.35)',
    danger: '#EF4444',
};

// 1-Tap Category Name Suggestions with luxury presets & icons
const CATEGORY_SUGGESTIONS = [
    {
        name: "Wayoyi & Na'urori",
        english: "Phones & Gadgets",
        slug: "wayoyi-naurori",
        icon: "phone-portrait-outline",
        image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Kayan Mata & Turare",
        english: "Women's Fashion & Perfumes",
        slug: "kayan-mata-turare",
        icon: "sparkles-outline",
        image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Alkyabba & Shadda",
        english: "Men's Traditional Wears",
        slug: "alkyabba-shadda",
        icon: "shirt-outline",
        image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Turare & Kayan Kwalliya",
        english: "Perfumes & Cosmetics",
        slug: "turare-kayan-kwalliya",
        icon: "flame-outline",
        image: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Takalma & Jakunkuna",
        english: "Shoes & Luxury Bags",
        slug: "takalma-jakunkuna",
        icon: "bag-handle-outline",
        image: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Agogo & Kayan Ado",
        english: "Watches & Jewelry",
        slug: "agogo-kayan-ado",
        icon: "watch-outline",
        image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Kayan Gida & Kicin",
        english: "Home & Kitchen Appliances",
        slug: "kayan-gida-kicin",
        icon: "home-outline",
        image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Kayan Yara & Jarirai",
        english: "Kids & Baby Essentials",
        slug: "kayan-yara-jarirai",
        icon: "happy-outline",
        image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Kayan Abinci & Masarufi",
        english: "Groceries & Food",
        slug: "kayan-abinci-masarufi",
        icon: "restaurant-outline",
        image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Magungunan Musulunci",
        english: "Islamic & Herbal Health",
        slug: "magungunan-musulunci",
        icon: "leaf-outline",
        image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Kayan Maza & Yadi",
        english: "Men's Fabrics & Clothing",
        slug: "kayan-maza-yadi",
        icon: "briefcase-outline",
        image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Kayan Wasanni & Motsa Jiki",
        english: "Sports & Fitness",
        slug: "kayan-wasanni-motsa-jiki",
        icon: "barbell-outline",
        image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Motoci & Kayan Gyara",
        english: "Automotive & Spare Parts",
        slug: "motoci-kayan-gyara",
        icon: "car-sport-outline",
        image: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&auto=format&fit=crop&q=80"
    },
    {
        name: "Littattafai & Karatu",
        english: "Books & Education",
        slug: "littattafai-karatu",
        icon: "book-outline",
        image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80"
    }
];

// Luxury Preset Photos Rail
const LUXURY_PHOTO_PRESETS = [
    { title: "Turare / Perfumes", uri: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80" },
    { title: "Wayoyi / Phones", uri: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80" },
    { title: "Shadda / Fabrics", uri: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80" },
    { title: "Kayan Kwalliya", uri: "https://images.unsplash.com/photo-1592945403244-b3fbafd7f539?w=600&auto=format&fit=crop&q=80" },
    { title: "Agogo / Watches", uri: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80" },
    { title: "Takalma / Shoes", uri: "https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=600&auto=format&fit=crop&q=80" },
    { title: "Kayan Gida / Home", uri: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80" },
    { title: "Kayan Yara / Baby", uri: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80" },
    { title: "Abinci / Groceries", uri: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80" },
    { title: "Maganin Musulunci", uri: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80" }
];

export const AdminCategories = ({ navigation, onBack }) => {
    const [categories, setCategories] = useState([]);
    const [productCounts, setProductCounts] = useState({});
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'active' | 'inactive'

    // Modal state for Add / Edit
    const [modalVisible, setModalVisible] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [formName, setFormName] = useState('');
    const [formSlug, setFormSlug] = useState('');
    const [formImageUrl, setFormImageUrl] = useState('');
    const [formIcon, setFormIcon] = useState('grid-outline');
    const [formDisplayOrder, setFormDisplayOrder] = useState('1');
    const [formIsActive, setFormIsActive] = useState(true);
    const [saving, setSaving] = useState(false);
    const [modalFeedback, setModalFeedback] = useState(null); // { type: 'success' | 'error' | 'loading', text: '' }

    useEffect(() => {
        fetchCategoriesAndCounts();

        // Subscribe to internal category service updates
        const unsubscribe = subscribeToCategoryChanges((newCats) => {
            if (Array.isArray(newCats)) {
                setCategories(newCats);
            }
        });

        // Also subscribe to Postgres Realtime changes
        const channel = supabase
            .channel('admin-categories-unified-v7')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'categories' }, () => {
                fetchCategoriesAndCounts(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'products' }, () => {
                fetchCategoriesAndCounts(true);
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => {
                fetchCategoriesAndCounts(true);
            })
            .subscribe();

        return () => {
            unsubscribe();
            supabase.removeChannel(channel);
        };
    }, []);

    const fetchCategoriesAndCounts = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        try {
            const [cats, prodsRes] = await Promise.all([
                fetchAllCategories({ forceRefresh: true }),
                supabase.from('products').select('id, category')
            ]);

            const prods = (Array.isArray(prodsRes?.data)) ? prodsRes.data : [];

            // Compute counts
            const counts = {};
            prods.forEach(p => {
                if (p.category) {
                    const norm = p.category.toLowerCase().trim();
                    counts[norm] = (counts[norm] || 0) + 1;
                }
            });

            setCategories(Array.isArray(cats) ? cats : []);
            setProductCounts(counts);
        } catch (e) {
            console.error('[AdminCategories] Fetch crash:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Lightweight image compression for web
    const compressImageOnWeb = (dataUrl, callback) => {
        if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.Image) {
            return callback(dataUrl);
        }
        try {
            const img = new window.Image();
            img.onload = () => {
                const maxDim = 700;
                let width = img.width || 400;
                let height = img.height || 400;
                if (width > maxDim || height > maxDim) {
                    if (width > height) {
                        height = Math.round((height * maxDim) / width);
                        width = maxDim;
                    } else {
                        width = Math.round((width * maxDim) / height);
                        height = maxDim;
                    }
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(img, 0, 0, width, height);
                    const compressed = canvas.toDataURL('image/jpeg', 0.82);
                    callback(compressed);
                } else {
                    callback(dataUrl);
                }
            };
            img.onerror = () => callback(dataUrl);
            img.src = dataUrl;
        } catch (_) {
            callback(dataUrl);
        }
    };

    // 100% Reliable File Picker & Upload Handler
    const handlePickImage = async () => {
        setUploading(true);
        setModalFeedback(null);
        try {
            // WEB BROWSER: Native HTML File Input (Works 100% on Chrome, Safari, Edge, Mobile Web)
            if (Platform.OS === 'web' && typeof document !== 'undefined') {
                const fileInput = document.createElement('input');
                fileInput.type = 'file';
                fileInput.accept = 'image/*';
                fileInput.style.display = 'none';

                fileInput.onchange = async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) {
                        setUploading(false);
                        return;
                    }
                    const reader = new FileReader();
                    reader.onload = async (re) => {
                        const rawDataUrl = re.target?.result;
                        if (rawDataUrl) {
                            compressImageOnWeb(rawDataUrl, (compressedUrl) => {
                                setFormImageUrl(compressedUrl);
                                setUploading(false);
                                setModalFeedback({
                                    type: 'success',
                                    text: 'An loda hoton cikin nasara! ✓'
                                });
                            });
                        } else {
                            setUploading(false);
                        }
                    };
                    reader.onerror = () => {
                        setUploading(false);
                        setModalFeedback({
                            type: 'error',
                            text: 'Kuskure wajen karanta fayil din hoto.'
                        });
                    };
                    reader.readAsDataURL(file);
                };

                document.body.appendChild(fileInput);
                fileInput.click();
                setTimeout(() => {
                    if (fileInput.parentNode) {
                        fileInput.parentNode.removeChild(fileInput);
                    }
                }, 1000);
                return;
            }

            // NATIVE MOBILE (Android / iOS): expo-image-picker
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Izini (Permission)', 'Muna bukatar izinin shiga hotunanka domin zaɓar hoton category.');
                setUploading(false);
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions?.Images || 'Images',
                allowsEditing: false,
                quality: 0.7,
                base64: true
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                if (asset.base64) {
                    const dataUrl = `data:image/jpeg;base64,${asset.base64}`;
                    setFormImageUrl(dataUrl);
                    setModalFeedback({
                        type: 'success',
                        text: 'An zaɓi hoton cikin nasara! ✓'
                    });
                } else if (asset.uri) {
                    setFormImageUrl(asset.uri);
                    setModalFeedback({
                        type: 'success',
                        text: 'An zaɓi hoton cikin nasara! ✓'
                    });
                }
            }
        } catch (err) {
            console.error('Image pick error:', err);
            setModalFeedback({
                type: 'error',
                text: 'Kuskuren hoto: ' + (err.message || 'Error')
            });
        } finally {
            if (Platform.OS !== 'web') setUploading(false);
        }
    };

    const openAddModal = () => {
        setEditingCategory(null);
        setFormName('');
        setFormSlug('');
        setFormImageUrl('');
        setFormIcon('grid-outline');
        setModalFeedback(null);
        const maxOrder = categories.reduce((max, c) => Math.max(max, parseInt(c.display_order, 10) || 0), 0);
        setFormDisplayOrder(String(maxOrder + 1));
        setFormIsActive(true);
        setModalVisible(true);
    };

    const openEditModal = (cat) => {
        setEditingCategory(cat);
        setFormName(cat.name || '');
        setFormSlug(cat.slug || '');
        setFormImageUrl(cat.image_url || '');
        setFormIcon(cat.icon || 'grid-outline');
        setModalFeedback(null);
        setFormDisplayOrder(String(cat.display_order ?? 0));
        setFormIsActive(cat.is_active !== false);
        setModalVisible(true);
    };

    const handleNameChange = (text) => {
        setFormName(text);
        if (!editingCategory) {
            setFormSlug(generateSlug(text));
        }
    };

    // 1-Tap Category Suggestion Auto-Filler
    const handleSelectSuggestion = (sug) => {
        setFormName(sug.name);
        setFormSlug(sug.slug);
        setFormImageUrl(sug.image);
        setFormIcon(sug.icon);
        setModalFeedback({
            type: 'success',
            text: `An zaɓi "${sug.name}" da hoton alfarma kai tsaye! ✓`
        });
    };

    // 100% Reliable Save Handler with visual in-modal status feedback
    const handleSave = async () => {
        if (!formName.trim()) {
            setModalFeedback({
                type: 'error',
                text: 'Da fatan a saka ko a zaɓi sunan Category (Please enter or select a category name).'
            });
            return;
        }

        const slug = formSlug.trim() || generateSlug(formName);
        const displayOrder = parseInt(formDisplayOrder, 10) || 0;

        try {
            setSaving(true);
            setModalFeedback({
                type: 'loading',
                text: 'Ana ajiye category da bayyana shi a dukkan manhajar...'
            });

            const result = await saveCategory({
                name: formName.trim(),
                slug,
                image_url: formImageUrl.trim() || null,
                icon: formIcon || 'grid-outline',
                display_order: displayOrder,
                is_active: formIsActive === true
            }, editingCategory);

            // Optimistic update of local list
            const savedCat = result?.category || {
                id: editingCategory?.id || `cat_${Date.now()}`,
                name: formName.trim(),
                slug,
                icon: formIcon || 'grid-outline',
                image_url: formImageUrl.trim() || null,
                display_order: displayOrder,
                is_active: formIsActive === true
            };

            setCategories(prev => {
                const idx = prev.findIndex(c => (editingCategory?.id && c.id === editingCategory.id) || c.slug === slug);
                if (idx >= 0) {
                    const next = [...prev];
                    next[idx] = { ...next[idx], ...savedCat };
                    return next;
                }
                return [savedCat, ...prev];
            });

            setModalFeedback({
                type: 'success',
                text: `✓ An Ajiye Cikin Nasara! Category "${formName.trim()}" ya hau kai tsaye 100%.`
            });

            // Refresh counts & database silently
            fetchCategoriesAndCounts(true);

            // Close modal after showing success
            setTimeout(() => {
                setModalVisible(false);
                setModalFeedback(null);
            }, 800);

        } catch (err) {
            console.error('Save failed:', err);
            setModalFeedback({
                type: 'error',
                text: 'Kuskure wajen ajiye: ' + (err.message || 'An kasa ajiye category.')
            });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (cat) => {
        const nextStatus = cat.is_active === false ? true : false;
        // Optimistic UI update
        setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: nextStatus } : c));

        try {
            await toggleCategoryStatus(cat);
        } catch (err) {
            console.error('Toggle status error:', err);
            // Revert
            setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: !nextStatus } : c));
            Alert.alert('Matsalar Status', 'Ba a iya canza matsayin category ba.');
        }
    };

    const deleteCat = (cat) => {
        const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;
        const warning = count > 0 ? `\n\nLURA: Wannan category yana da kayayyaki ${count} da aka danganta da shi.` : '';

        Alert.alert(
            'Goge Category (Delete)',
            `Kana da tabbacin kana son goge "${cat.name}"?${warning}`,
            [
                { text: 'A\'a (Cancel)', style: 'cancel' },
                {
                    text: 'Goge (Delete)',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setCategories(prev => prev.filter(c => c.id !== cat.id && c.slug !== cat.slug));
                            await deleteCategory(cat);
                            Alert.alert('An Goge', `An cire category "${cat.name}" cikin nasara.`);
                        } catch (delErr) {
                            Alert.alert('Delete Failed', delErr.message || 'An kasa goge category.');
                            fetchCategoriesAndCounts(true);
                        }
                    }
                }
            ]
        );
    };

    const filteredCategories = categories.filter(c => {
        const matchesQuery = !searchQuery.trim() ||
            (c.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
            (c.slug || '').toLowerCase().includes(searchQuery.toLowerCase());
        if (!matchesQuery) return false;

        if (statusFilter === 'active') return c.is_active !== false;
        if (statusFilter === 'inactive') return c.is_active === false;
        return true;
    });

    // Stats
    const totalCategories = categories.length;
    const activeCategories = categories.filter(c => c.is_active !== false).length;
    const inactiveCategories = categories.filter(c => c.is_active === false).length;
    const totalLinkedProds = Object.values(productCounts).reduce((sum, n) => sum + n, 0);

    return (
        <View style={s.container}>
            {/* Header Area with Luxury Navy & Gold styling */}
            <LinearGradient
                colors={[BRAND.navyDark, BRAND.navy, BRAND.navyLight]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.header}
            >
                <View style={s.headerTopRow}>
                    {(onBack || navigation?.goBack) && (
                        <TouchableOpacity
                            onPress={onBack || (() => navigation?.goBack())}
                            style={s.backBtn}
                            activeOpacity={0.7}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Ionicons name="arrow-back" size={20} color={BRAND.gold} />
                        </TouchableOpacity>
                    )}
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <View style={s.badgePill}>
                            <Ionicons name="sparkles" size={11} color={BRAND.gold} />
                            <Text style={s.badgePillTxt}>TSARIN KASUWA • TAXONOMY</Text>
                        </View>
                        <Text style={s.headerTitle}>Sarrafa Categories</Text>
                        <Text style={s.headerSubtitle}>
                            Bangarori, jerin fifiko & bayyana kai tsaye a manhaja 100%
                        </Text>
                    </View>

                    <TouchableOpacity
                        onPress={openAddModal}
                        style={s.addBtn}
                        activeOpacity={0.85}
                    >
                        <LinearGradient
                            colors={[BRAND.gold, '#B8860B']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                            style={s.addBtnGrad}
                        >
                            <Ionicons name="add" size={18} color="#071422" />
                            <Text style={s.addBtnTxt}>KARA SABO</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* 4 Top KPI Metric Cards */}
                <View style={s.kpiRow}>
                    <View style={s.kpiCard}>
                        <Text style={s.kpiValue}>{totalCategories}</Text>
                        <Text style={s.kpiLabel}>Duka (Total)</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.emerald }]}>{activeCategories}</Text>
                        <Text style={s.kpiLabel}>Masu Aiki</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.slate }]}>{inactiveCategories}</Text>
                        <Text style={s.kpiLabel}>An Dakatar</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.gold }]}>{totalLinkedProds}</Text>
                        <Text style={s.kpiLabel}>Kayayyaki</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchBar}>
                    <Ionicons name="search" size={16} color={BRAND.gold} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Nemi category ko slug..."
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        style={s.searchInput}
                        placeholderTextColor="#94A3B8"
                    />
                    {searchQuery.length > 0 && (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Ionicons name="close-circle" size={18} color="#94A3B8" />
                        </TouchableOpacity>
                    )}
                </View>

                {/* Filter Pills Row */}
                <View style={s.filterPillsRow}>
                    {[
                        { key: 'all', label: `Duka (${totalCategories})` },
                        { key: 'active', label: `Masu Aiki (${activeCategories})` },
                        { key: 'inactive', label: `An Dakatar (${inactiveCategories})` },
                    ].map(f => (
                        <TouchableOpacity
                            key={f.key}
                            onPress={() => setStatusFilter(f.key)}
                            style={[s.filterPill, statusFilter === f.key && s.filterPillActive]}
                            activeOpacity={0.8}
                        >
                            <Text style={[s.filterPillTxt, statusFilter === f.key && s.filterPillTxtActive]}>
                                {f.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </LinearGradient>

            {/* Content List */}
            {loading && !refreshing ? (
                <View style={s.loadingCenter}>
                    <ActivityIndicator size="large" color={BRAND.gold} />
                    <Text style={s.loadingTxt}>Ana loda categories na kasuwa...</Text>
                </View>
            ) : filteredCategories.length === 0 ? (
                <View style={s.emptyBox}>
                    <View style={s.emptyIconCircle}>
                        <Ionicons name="layers-outline" size={38} color={BRAND.gold} />
                    </View>
                    <Text style={s.emptyTitle}>Babu wani category a halin yanzu</Text>
                    <Text style={s.emptySub}>
                        {searchQuery ? 'Babu sakamako ga bincikenka.' : 'Danna "KARA SABO" a sama domin daura sabon category 100%.'}
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={filteredCategories}
                    keyExtractor={item => String(item.id || item.slug)}
                    contentContainerStyle={s.listContent}
                    refreshControl={
                        <RefreshControl
                            refreshing={refreshing}
                            onRefresh={() => { setRefreshing(true); fetchCategoriesAndCounts(); }}
                            colors={[BRAND.gold, BRAND.navy]}
                            tintColor={BRAND.gold}
                        />
                    }
                    renderItem={({ item }) => {
                        const count = productCounts[(item.name || '').toLowerCase().trim()] || 0;
                        const isActive = item.is_active !== false;

                        return (
                            <View style={s.catCard}>
                                <View style={s.catCardLeft}>
                                    {/* Thumbnail */}
                                    <View style={s.catThumbWrap}>
                                        {item.image_url ? (
                                            <Image source={{ uri: item.image_url }} style={s.catThumbImg} />
                                        ) : (
                                            <Ionicons name={item.icon || "layers"} size={24} color={BRAND.gold} />
                                        )}
                                    </View>

                                    {/* Info */}
                                    <View style={{ flex: 1, marginRight: 6 }}>
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                            <Text numberOfLines={1} style={s.catName}>
                                                {item.name}
                                            </Text>
                                            <View style={[s.statusPill, isActive ? s.statusPillActive : s.statusPillInactive]}>
                                                <Text style={[s.statusPillTxt, isActive ? s.statusPillTxtActive : s.statusPillTxtInactive]}>
                                                    {isActive ? 'YANA AIKI' : 'AN DAKATAR'}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text numberOfLines={1} style={s.catSlug}>
                                            /{item.slug || 'category'}
                                        </Text>

                                        {/* Micro stats */}
                                        <View style={s.catMetaRow}>
                                            <View style={s.metaItem}>
                                                <Ionicons name="cube-outline" size={12} color={BRAND.gold} />
                                                <Text style={s.metaTxt}>{count} kayayyaki</Text>
                                            </View>
                                            <Text style={s.metaDot}>•</Text>
                                            <View style={s.metaItem}>
                                                <Ionicons name="swap-vertical-outline" size={12} color={BRAND.slate} />
                                                <Text style={s.metaTxt}>Lambar #{item.display_order ?? 0}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={s.catActionsCol}>
                                    {/* Quick 1-Tap Toggle */}
                                    <TouchableOpacity
                                        onPress={() => handleToggleStatus(item)}
                                        style={[s.toggleBtn, isActive ? s.toggleBtnActive : s.toggleBtnInactive]}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons
                                            name={isActive ? "checkmark-circle" : "pause-circle-outline"}
                                            size={17}
                                            color={isActive ? BRAND.emerald : BRAND.slate}
                                        />
                                    </TouchableOpacity>

                                    {/* Edit */}
                                    <TouchableOpacity
                                        onPress={() => openEditModal(item)}
                                        style={s.editBtn}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="pencil" size={14} color={BRAND.navy} />
                                    </TouchableOpacity>

                                    {/* Delete */}
                                    <TouchableOpacity
                                        onPress={() => deleteCat(item)}
                                        style={s.delBtn}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="trash-outline" size={14} color={BRAND.danger} />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    }}
                />
            )}

            {/* ════ ADD / EDIT CATEGORY MODAL ════ */}
            <Modal
                visible={modalVisible}
                animationType="slide"
                transparent={true}
                onRequestClose={() => setModalVisible(false)}
            >
                <View style={s.modalBackdrop}>
                    <View style={s.modalSheet}>
                        {/* Modal Header */}
                        <LinearGradient
                            colors={[BRAND.navyDark, BRAND.navy]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={s.modalHeader}
                        >
                            <View style={{ flex: 1, paddingRight: 8 }}>
                                <Text style={s.modalTitle}>
                                    {editingCategory ? 'Gyara Category' : 'Dauki / Kara Sabon Category'}
                                </Text>
                                <Text style={s.modalSub}>
                                    Zai bayyana kai tsaye 100% a dukkan manhajar waya da yanar gizo
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={s.closeBtn}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </LinearGradient>

                        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 18, paddingBottom: 40 }}>
                            {/* In-Modal Feedback Banner */}
                            {modalFeedback && (
                                <View style={[
                                    s.feedbackBanner,
                                    modalFeedback.type === 'success' && s.feedbackBannerSuccess,
                                    modalFeedback.type === 'error' && s.feedbackBannerError,
                                    modalFeedback.type === 'loading' && s.feedbackBannerLoading,
                                ]}>
                                    {modalFeedback.type === 'loading' ? (
                                        <ActivityIndicator size="small" color={BRAND.gold} />
                                    ) : (
                                        <Ionicons
                                            name={modalFeedback.type === 'success' ? "checkmark-circle" : "alert-circle"}
                                            size={18}
                                            color={modalFeedback.type === 'success' ? BRAND.emerald : BRAND.danger}
                                        />
                                    )}
                                    <Text style={[
                                        s.feedbackBannerTxt,
                                        modalFeedback.type === 'success' && s.feedbackBannerTxtSuccess,
                                        modalFeedback.type === 'error' && s.feedbackBannerTxtError,
                                        modalFeedback.type === 'loading' && s.feedbackBannerTxtLoading,
                                    ]}>
                                        {modalFeedback.text}
                                    </Text>
                                </View>
                            )}

                            {/* 1. Image Preview & Upload Controls */}
                            <View style={s.imageUploadSection}>
                                <View style={s.imagePreviewBox}>
                                    {formImageUrl ? (
                                        <Image source={{ uri: formImageUrl }} style={s.imagePreviewImg} />
                                    ) : (
                                        <Ionicons name={formIcon || "image-outline"} size={36} color={BRAND.gold} />
                                    )}
                                    {uploading && (
                                        <View style={s.uploadingOverlay}>
                                            <ActivityIndicator color={BRAND.gold} />
                                        </View>
                                    )}
                                </View>

                                <View style={{ flex: 1, gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={handlePickImage}
                                        disabled={uploading}
                                        style={s.pickImageBtn}
                                        activeOpacity={0.85}
                                    >
                                        <Ionicons name="cloud-upload-outline" size={16} color="#071422" />
                                        <Text style={s.pickImageTxt}>
                                            {uploading ? 'Ana lodawa...' : 'Zabi Hoto (Upload Image)'}
                                        </Text>
                                    </TouchableOpacity>

                                    {formImageUrl ? (
                                        <TouchableOpacity
                                            onPress={() => setFormImageUrl('')}
                                            style={s.removeImageBtn}
                                            activeOpacity={0.75}
                                        >
                                            <Ionicons name="trash-outline" size={13} color={BRAND.danger} />
                                            <Text style={s.removeImageTxt}>Cire Hoton</Text>
                                        </TouchableOpacity>
                                    ) : (
                                        <Text style={s.imageHintTxt}>
                                            Zabi hoto daga waya/kwamfuta ko danna kowanne a kasa.
                                        </Text>
                                    )}
                                </View>
                            </View>

                            {/* 2. Hotunan Alfarma Masu Kyau (Luxury Preset Photo Gallery) */}
                            <View style={s.presetPhotosWrap}>
                                <Text style={s.presetPhotosTitle}>Zaɓi Hoton Alfarma (Luxury Preset Photos):</Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.presetPhotosRail}>
                                    {LUXURY_PHOTO_PRESETS.map((p, idx) => {
                                        const isSelected = formImageUrl === p.uri;
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => {
                                                    setFormImageUrl(p.uri);
                                                    setModalFeedback({
                                                        type: 'success',
                                                        text: `An zaɓi hoton "${p.title}"! ✓`
                                                    });
                                                }}
                                                style={[s.presetPhotoItem, isSelected && s.presetPhotoItemActive]}
                                                activeOpacity={0.8}
                                            >
                                                <Image source={{ uri: p.uri }} style={s.presetPhotoImg} />
                                                {isSelected && (
                                                    <View style={s.presetCheckBadge}>
                                                        <Ionicons name="checkmark" size={12} color="#071422" />
                                                    </View>
                                                )}
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* 3. 💡 Zaɓaɓɓun Sunayen Categories (1-Tap Smart Suggestions) */}
                            <View style={s.suggestionsBox}>
                                <View style={s.suggestionsHeader}>
                                    <Ionicons name="sparkles" size={14} color={BRAND.gold} />
                                    <Text style={s.suggestionsTitle}>Zaɓaɓɓun Sunayen Categories (1-Tap Suggestions):</Text>
                                </View>
                                <Text style={s.suggestionsSub}>
                                    Danna kowanne don cikasa suna, slug da hoton alfarma kai tsaye:
                                </Text>
                                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.suggestionsRail}>
                                    {CATEGORY_SUGGESTIONS.map((item, idx) => {
                                        const isSelected = formName.toLowerCase().trim() === item.name.toLowerCase().trim();
                                        return (
                                            <TouchableOpacity
                                                key={idx}
                                                onPress={() => handleSelectSuggestion(item)}
                                                style={[s.suggestionChip, isSelected && s.suggestionChipActive]}
                                                activeOpacity={0.8}
                                            >
                                                <View style={[s.suggestionChipIconWrap, isSelected && s.suggestionChipIconWrapActive]}>
                                                    <Ionicons
                                                        name={item.icon}
                                                        size={14}
                                                        color={isSelected ? '#071422' : BRAND.gold}
                                                    />
                                                </View>
                                                <View>
                                                    <Text style={[s.suggestionChipTxt, isSelected && s.suggestionChipTxtActive]}>
                                                        {item.name}
                                                    </Text>
                                                    <Text style={[s.suggestionChipSubTxt, isSelected && s.suggestionChipSubTxtActive]}>
                                                        {item.english}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* 4. Category Name */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Sunan Category (Category Name) *</Text>
                                <TextInput
                                    placeholder="misali: Kayan Mata & Turare"
                                    value={formName}
                                    onChangeText={handleNameChange}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* 5. Slug */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Lambar Mahada (Slug / URL Identifier)</Text>
                                <TextInput
                                    placeholder="misali: kayan-mata-turare"
                                    value={formSlug}
                                    onChangeText={setFormSlug}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* 6. Display Order */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Lambar Tsari / Fifiko (Display Order)</Text>
                                <TextInput
                                    placeholder="misali: 1"
                                    value={formDisplayOrder}
                                    onChangeText={setFormDisplayOrder}
                                    keyboardType="numeric"
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* 7. Active Toggle */}
                            <View style={s.switchFieldRow}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text style={s.fieldLabel}>Bude Don Jama'a (Active Visibility)</Text>
                                    <Text style={s.switchSubTxt}>Zai bayyana a shafin farko da shagon kasuwa nan take</Text>
                                </View>
                                <Switch
                                    value={formIsActive}
                                    onValueChange={setFormIsActive}
                                    trackColor={{ false: '#CBD5E1', true: BRAND.emerald }}
                                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                                />
                            </View>

                            {/* 8. Submit Button */}
                            <TouchableOpacity
                                onPress={handleSave}
                                disabled={saving}
                                style={s.submitBtn}
                                activeOpacity={0.85}
                            >
                                <LinearGradient
                                    colors={[BRAND.gold, '#B8860B']}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={s.submitBtnGrad}
                                >
                                    {saving ? (
                                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                            <ActivityIndicator color="#071422" />
                                            <Text style={s.submitBtnTxt}>Ana ajiye category...</Text>
                                        </View>
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={19} color="#071422" />
                                            <Text style={s.submitBtnTxt}>
                                                {editingCategory ? 'Ajiye Gyara (Update Category)' : 'Dauka & Fara Aiki (Create & Publish)'}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8FAFC',
    },
    header: {
        paddingTop: 16,
        paddingHorizontal: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderColor: BRAND.borderGold,
    },
    headerTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
        borderWidth: 1,
        borderColor: BRAND.borderGold,
    },
    badgePill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        alignSelf: 'flex-start',
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 6,
        borderWidth: 0.8,
        borderColor: 'rgba(217, 167, 58, 0.4)',
        marginBottom: 4,
    },
    badgePillTxt: {
        color: BRAND.gold,
        fontSize: 9,
        fontWeight: '900',
        letterSpacing: 0.6,
    },
    headerTitle: {
        fontSize: 19,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.3,
    },
    headerSubtitle: {
        color: '#94A3B8',
        fontSize: 11,
        marginTop: 2,
    },
    addBtn: {
        borderRadius: 12,
        overflow: 'hidden',
        elevation: 3,
        shadowColor: BRAND.gold,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 5,
    },
    addBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },
    addBtnTxt: {
        color: '#071422',
        fontWeight: '900',
        fontSize: 11.5,
        letterSpacing: 0.5,
    },
    kpiRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 12,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderRadius: 12,
        paddingVertical: 8,
        paddingHorizontal: 6,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    kpiValue: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    kpiLabel: {
        fontSize: 9,
        color: '#94A3B8',
        marginTop: 2,
        fontWeight: '600',
    },
    searchBar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderWidth: 1,
        borderColor: BRAND.borderGold,
    },
    searchInput: {
        flex: 1,
        fontSize: 12.5,
        color: BRAND.slateDark,
        fontWeight: '600',
    },
    filterPillsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        marginTop: 10,
    },
    filterPill: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
    },
    filterPillActive: {
        backgroundColor: BRAND.gold,
        borderColor: BRAND.gold,
    },
    filterPillTxt: {
        fontSize: 11,
        fontWeight: '700',
        color: '#CBD5E1',
    },
    filterPillTxtActive: {
        color: '#071422',
        fontWeight: '900',
    },
    loadingCenter: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingTxt: {
        marginTop: 10,
        fontSize: 12,
        fontWeight: '700',
        color: BRAND.slate,
    },
    emptyBox: {
        paddingVertical: 60,
        alignItems: 'center',
        paddingHorizontal: 20,
    },
    emptyIconCircle: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: BRAND.slateDark,
    },
    emptySub: {
        fontSize: 12,
        color: BRAND.slate,
        textAlign: 'center',
        marginTop: 4,
    },
    listContent: {
        padding: 14,
        paddingBottom: 90,
        gap: 10,
    },
    catCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#E2E8F0',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 1,
    },
    catCardLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        flex: 1,
    },
    catThumbWrap: {
        width: 52,
        height: 52,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        borderWidth: 1.2,
        borderColor: BRAND.borderGold,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    catThumbImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    catName: {
        fontSize: 13.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    catSlug: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 1,
    },
    statusPill: {
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 5,
    },
    statusPillActive: {
        backgroundColor: '#ECFDF5',
    },
    statusPillInactive: {
        backgroundColor: '#F1F5F9',
    },
    statusPillTxt: {
        fontSize: 8.5,
        fontWeight: '900',
    },
    statusPillTxtActive: {
        color: BRAND.emerald,
    },
    statusPillTxtInactive: {
        color: BRAND.slate,
    },
    catMetaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 4,
    },
    metaItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    metaTxt: {
        fontSize: 10.5,
        color: BRAND.slate,
        fontWeight: '600',
    },
    metaDot: {
        color: '#CBD5E1',
        fontSize: 10,
    },
    catActionsCol: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    toggleBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleBtnActive: {
        backgroundColor: '#ECFDF5',
    },
    toggleBtnInactive: {
        backgroundColor: '#F1F5F9',
    },
    editBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
    },
    delBtn: {
        width: 32,
        height: 32,
        borderRadius: 8,
        backgroundColor: '#FEF2F2',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Modal
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 20, 34, 0.75)',
        justifyContent: 'flex-end',
    },
    modalSheet: {
        backgroundColor: '#FFFFFF',
        borderTopLeftRadius: 26,
        borderTopRightRadius: 26,
        maxHeight: '92%',
        overflow: 'hidden',
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 18,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderColor: BRAND.borderGold,
    },
    modalTitle: {
        fontSize: 16.5,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    modalSub: {
        fontSize: 11,
        color: '#94A3B8',
        marginTop: 2,
    },
    closeBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Feedback Banner
    feedbackBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderRadius: 12,
        marginBottom: 14,
        borderWidth: 1,
    },
    feedbackBannerSuccess: {
        backgroundColor: '#ECFDF5',
        borderColor: BRAND.emerald,
    },
    feedbackBannerError: {
        backgroundColor: '#FEF2F2',
        borderColor: BRAND.danger,
    },
    feedbackBannerLoading: {
        backgroundColor: '#FFFBEB',
        borderColor: BRAND.gold,
    },
    feedbackBannerTxt: {
        flex: 1,
        fontSize: 12,
        fontWeight: '700',
    },
    feedbackBannerTxtSuccess: {
        color: '#065F46',
    },
    feedbackBannerTxtError: {
        color: '#991B1B',
    },
    feedbackBannerTxtLoading: {
        color: '#92400E',
    },
    // Image Upload
    imageUploadSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginBottom: 14,
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    imagePreviewBox: {
        width: 76,
        height: 76,
        borderRadius: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1.5,
        borderColor: BRAND.borderGold,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    imagePreviewImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    uploadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pickImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: BRAND.gold,
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 10,
    },
    pickImageTxt: {
        color: '#071422',
        fontSize: 12,
        fontWeight: '900',
    },
    removeImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 4,
    },
    removeImageTxt: {
        color: BRAND.danger,
        fontSize: 11,
        fontWeight: '700',
    },
    imageHintTxt: {
        fontSize: 10.5,
        color: BRAND.slate,
        lineHeight: 14,
    },
    // Preset Photos Gallery
    presetPhotosWrap: {
        marginBottom: 16,
    },
    presetPhotosTitle: {
        fontSize: 11.5,
        fontWeight: '800',
        color: BRAND.slateDark,
        marginBottom: 8,
    },
    presetPhotosRail: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 10,
    },
    presetPhotoItem: {
        width: 62,
        height: 62,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: 'transparent',
        position: 'relative',
    },
    presetPhotoItemActive: {
        borderColor: BRAND.gold,
    },
    presetPhotoImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    presetCheckBadge: {
        position: 'absolute',
        top: 3,
        right: 3,
        backgroundColor: BRAND.gold,
        width: 16,
        height: 16,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Smart Suggestions
    suggestionsBox: {
        backgroundColor: '#FFFBEB',
        borderRadius: 14,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.4)',
    },
    suggestionsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 4,
    },
    suggestionsTitle: {
        fontSize: 12,
        fontWeight: '900',
        color: '#92400E',
    },
    suggestionsSub: {
        fontSize: 10.5,
        color: '#78350F',
        marginBottom: 10,
    },
    suggestionsRail: {
        flexDirection: 'row',
        gap: 8,
        paddingRight: 10,
    },
    suggestionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 10,
        borderWidth: 1.2,
        borderColor: '#FDE68A',
    },
    suggestionChipActive: {
        backgroundColor: BRAND.gold,
        borderColor: BRAND.gold,
    },
    suggestionChipIconWrap: {
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#FEF3C7',
        alignItems: 'center',
        justifyContent: 'center',
    },
    suggestionChipIconWrapActive: {
        backgroundColor: '#FFFFFF',
    },
    suggestionChipTxt: {
        fontSize: 11.5,
        fontWeight: '800',
        color: BRAND.slateDark,
    },
    suggestionChipTxtActive: {
        color: '#071422',
        fontWeight: '900',
    },
    suggestionChipSubTxt: {
        fontSize: 9.5,
        color: BRAND.slate,
    },
    suggestionChipSubTxtActive: {
        color: '#3B2404',
        fontWeight: '700',
    },
    // Form fields
    formField: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 12,
        fontWeight: '800',
        color: BRAND.slateDark,
        marginBottom: 6,
    },
    input: {
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 13,
        color: BRAND.slateDark,
        borderWidth: 1,
        borderColor: '#CBD5E1',
        fontWeight: '600',
    },
    switchFieldRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 10,
        marginBottom: 16,
    },
    switchSubTxt: {
        fontSize: 11,
        color: BRAND.slate,
        marginTop: 1,
    },
    submitBtn: {
        borderRadius: 14,
        overflow: 'hidden',
        marginTop: 6,
        marginBottom: 20,
        elevation: 3,
        shadowColor: BRAND.gold,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 6,
    },
    submitBtnGrad: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 14,
    },
    submitBtnTxt: {
        color: '#071422',
        fontSize: 14,
        fontWeight: '900',
    },
});
