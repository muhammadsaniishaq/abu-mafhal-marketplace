import React, { useState, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, FlatList, Image, Alert,
    Modal, TextInput, ActivityIndicator, RefreshControl, StyleSheet,
    ScrollView, Platform, Switch
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import {
    fetchAllCategories,
    saveCategory,
    deleteCategory,
    toggleCategoryStatus,
    subscribeToCategoryChanges,
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
    slate: '#64748B',
    slateDark: '#0F172A',
    bg: '#F8FAFC',
    card: '#FFFFFF',
    border: '#E2E8F0',
    borderGold: 'rgba(217, 167, 58, 0.35)',
    danger: '#EF4444',
};

// Comprehensive Global Marketplace Categories List (35+ Major World Categories)
export const GLOBAL_CATEGORIES = [
    { name: "Phones & Tablets", slug: "phones-tablets", icon: "phone-portrait-outline", image: "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&auto=format&fit=crop&q=80" },
    { name: "Electronics & Gadgets", slug: "electronics-gadgets", icon: "hardware-chip-outline", image: "https://images.unsplash.com/photo-1550009158-9ebf69173e03?w=600&auto=format&fit=crop&q=80" },
    { name: "Computers & IT Accessories", slug: "computers-it-accessories", icon: "laptop-outline", image: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?w=600&auto=format&fit=crop&q=80" },
    { name: "Women's Fashion & Apparel", slug: "womens-fashion", icon: "sparkles-outline", image: "https://images.unsplash.com/photo-1483985988355-763728e1935b?w=600&auto=format&fit=crop&q=80" },
    { name: "Men's Fashion & Clothing", slug: "mens-fashion", icon: "shirt-outline", image: "https://images.unsplash.com/photo-1507679799987-c73779587ccf?w=600&auto=format&fit=crop&q=80" },
    { name: "Traditional & Cultural Attire", slug: "traditional-cultural-attire", icon: "color-palette-outline", image: "https://images.unsplash.com/photo-1589465885857-44edb59bbff2?w=600&auto=format&fit=crop&q=80" },
    { name: "Islamic Fashion & Abayas", slug: "islamic-fashion-abayas", icon: "ribbon-outline", image: "https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=600&auto=format&fit=crop&q=80" },
    { name: "Shoes & Footwear", slug: "shoes-footwear", icon: "footsteps-outline", image: "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600&auto=format&fit=crop&q=80" },
    { name: "Bags, Luggage & Backpacks", slug: "bags-luggage", icon: "bag-handle-outline", image: "https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=600&auto=format&fit=crop&q=80" },
    { name: "Watches & Fine Jewelry", slug: "watches-fine-jewelry", icon: "watch-outline", image: "https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=600&auto=format&fit=crop&q=80" },
    { name: "Perfumes & Luxury Fragrances", slug: "perfumes-luxury-fragrances", icon: "flame-outline", image: "https://images.unsplash.com/photo-1541643600914-78b084683601?w=600&auto=format&fit=crop&q=80" },
    { name: "Beauty, Cosmetics & Skincare", slug: "beauty-cosmetics-skincare", icon: "brush-outline", image: "https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=600&auto=format&fit=crop&q=80" },
    { name: "Health, Wellness & Pharmacy", slug: "health-wellness-pharmacy", icon: "heart-outline", image: "https://images.unsplash.com/photo-1505751172876-fa1923c5c528?w=600&auto=format&fit=crop&q=80" },
    { name: "Herbal & Organic Remedies", slug: "herbal-organic-remedies", icon: "leaf-outline", image: "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600&auto=format&fit=crop&q=80" },
    { name: "Home, Living & Furniture", slug: "home-living-furniture", icon: "home-outline", image: "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600&auto=format&fit=crop&q=80" },
    { name: "Kitchen & Dining Appliances", slug: "kitchen-dining-appliances", icon: "restaurant-outline", image: "https://images.unsplash.com/photo-1556911220-e15b29be8c8f?w=600&auto=format&fit=crop&q=80" },
    { name: "Groceries & Supermarket", slug: "groceries-supermarket", icon: "cart-outline", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&auto=format&fit=crop&q=80" },
    { name: "Food, Drinks & Beverages", slug: "food-drinks-beverages", icon: "nutrition-outline", image: "https://images.unsplash.com/photo-1610348725531-843dff563e2c?w=600&auto=format&fit=crop&q=80" },
    { name: "Baby, Kids & Toys", slug: "baby-kids-toys", icon: "happy-outline", image: "https://images.unsplash.com/photo-1515488042361-ee00e0ddd4e4?w=600&auto=format&fit=crop&q=80" },
    { name: "Sports, Fitness & Outdoor", slug: "sports-fitness-outdoor", icon: "barbell-outline", image: "https://images.unsplash.com/photo-1517838277536-f5f99be501cd?w=600&auto=format&fit=crop&q=80" },
    { name: "Automotive, Parts & Accessories", slug: "automotive-parts-accessories", icon: "car-sport-outline", image: "https://images.unsplash.com/photo-1486006920555-c77dce18193b?w=600&auto=format&fit=crop&q=80" },
    { name: "Books, Stationery & Education", slug: "books-stationery-education", icon: "book-outline", image: "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=600&auto=format&fit=crop&q=80" },
    { name: "Gaming, Consoles & VR", slug: "gaming-consoles-vr", icon: "game-controller-outline", image: "https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=600&auto=format&fit=crop&q=80" },
    { name: "Industrial Tools & Hardware", slug: "industrial-tools-hardware", icon: "construct-outline", image: "https://images.unsplash.com/photo-1581783342308-f792dbdd27c5?w=600&auto=format&fit=crop&q=80" },
    { name: "Solar, Inverters & Energy", slug: "solar-inverters-energy", icon: "sunny-outline", image: "https://images.unsplash.com/photo-1509391365360-2e959784a276?w=600&auto=format&fit=crop&q=80" },
    { name: "Pet Supplies & Animal Care", slug: "pet-supplies-animal-care", icon: "paw-outline", image: "https://images.unsplash.com/photo-1583337130417-3346a1be7dee?w=600&auto=format&fit=crop&q=80" },
    { name: "Arts, Crafts & Sewing", slug: "arts-crafts-sewing", icon: "cut-outline", image: "https://images.unsplash.com/photo-1513519245088-0e12902e5a38?w=600&auto=format&fit=crop&q=80" },
    { name: "Music, Instruments & Audio", slug: "music-instruments-audio", icon: "musical-notes-outline", image: "https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=600&auto=format&fit=crop&q=80" },
    { name: "Building & Construction Materials", slug: "building-construction-materials", icon: "business-outline", image: "https://images.unsplash.com/photo-1541888946425-d0fbb186f5f7?w=600&auto=format&fit=crop&q=80" },
    { name: "Security & Surveillance", slug: "security-surveillance", icon: "shield-checkmark-outline", image: "https://images.unsplash.com/photo-1557597774-9d273605dfa9?w=600&auto=format&fit=crop&q=80" },
    { name: "Office Furniture & Supplies", slug: "office-furniture-supplies", icon: "briefcase-outline", image: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&auto=format&fit=crop&q=80" },
    { name: "Gifts, Souvenirs & Hampers", slug: "gifts-souvenirs-hampers", icon: "gift-outline", image: "https://images.unsplash.com/photo-1513885535751-8b9238bd345a?w=600&auto=format&fit=crop&q=80" },
    { name: "Travel, Camping & Outdoors", slug: "travel-camping-outdoors", icon: "compass-outline", image: "https://images.unsplash.com/photo-1506744038136-46273834b3fb?w=600&auto=format&fit=crop&q=80" },
    { name: "General Merchandise", slug: "general-merchandise", icon: "grid-outline", image: "https://images.unsplash.com/photo-1472851294608-062f824d29cc?w=600&auto=format&fit=crop&q=80" }
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
    const [modalFeedback, setModalFeedback] = useState(null);

    // Dropdown picker modal state
    const [dropdownVisible, setDropdownVisible] = useState(false);
    const [dropdownSearch, setDropdownSearch] = useState('');

    useEffect(() => {
        fetchCategoriesAndCounts();

        const unsubscribe = subscribeToCategoryChanges((newCats) => {
            if (Array.isArray(newCats)) {
                setCategories(newCats);
            }
        });

        const channel = supabase
            .channel('admin-categories-unified-v8')
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
            console.error('[AdminCategories] Fetch error:', e);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    // Client-side lightweight image compression for web
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

    // Image Picker & Upload Handler
    const handlePickImage = async () => {
        setUploading(true);
        setModalFeedback(null);
        try {
            // WEB BROWSER: HTML File Input
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
                                setModalFeedback({ type: 'success', text: 'Image uploaded successfully!' });
                            });
                        } else {
                            setUploading(false);
                        }
                    };
                    reader.onerror = () => {
                        setUploading(false);
                        setModalFeedback({ type: 'error', text: 'Failed to read image file.' });
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

            // NATIVE MOBILE: Expo Image Picker
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                Alert.alert('Permission Needed', 'Media library access is required to select category images.');
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
                    setFormImageUrl(`data:image/jpeg;base64,${asset.base64}`);
                } else if (asset.uri) {
                    setFormImageUrl(asset.uri);
                }
                setModalFeedback({ type: 'success', text: 'Image selected successfully!' });
            }
        } catch (err) {
            console.error('Image pick error:', err);
            setModalFeedback({ type: 'error', text: 'Image selection error: ' + (err.message || 'Error') });
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

    // Selecting from Global Categories Dropdown
    const handleSelectDropdownItem = (item) => {
        setFormName(item.name);
        setFormSlug(item.slug);
        setFormImageUrl(item.image);
        setFormIcon(item.icon);
        setDropdownVisible(false);
        setModalFeedback({ type: 'success', text: `Selected "${item.name}"!` });
    };

    // Save Category Handler
    const handleSave = async () => {
        if (!formName.trim()) {
            setModalFeedback({ type: 'error', text: 'Please select or enter a category name.' });
            return;
        }

        const slug = formSlug.trim() || generateSlug(formName);
        const displayOrder = parseInt(formDisplayOrder, 10) || 0;

        try {
            setSaving(true);
            setModalFeedback({ type: 'loading', text: 'Saving category across platform...' });

            const result = await saveCategory({
                name: formName.trim(),
                slug,
                image_url: formImageUrl.trim() || null,
                icon: formIcon || 'grid-outline',
                display_order: displayOrder,
                is_active: formIsActive === true
            }, editingCategory);

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

            setModalFeedback({ type: 'success', text: `Category "${formName.trim()}" saved successfully!` });
            fetchCategoriesAndCounts(true);

            setTimeout(() => {
                setModalVisible(false);
                setModalFeedback(null);
            }, 650);

        } catch (err) {
            console.error('Save failed:', err);
            setModalFeedback({ type: 'error', text: 'Save Error: ' + (err.message || 'Failed to save.') });
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (cat) => {
        const nextStatus = cat.is_active === false ? true : false;
        setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: nextStatus } : c));

        try {
            await toggleCategoryStatus(cat);
        } catch (err) {
            console.error('Toggle status error:', err);
            setCategories(prev => prev.map(c => (c.id === cat.id || c.slug === cat.slug) ? { ...c, is_active: !nextStatus } : c));
            Alert.alert('Status Error', 'Could not toggle category visibility.');
        }
    };

    const deleteCat = (cat) => {
        const count = productCounts[(cat.name || '').toLowerCase().trim()] || 0;
        const warning = count > 0 ? `\n\nNote: This category currently has ${count} linked products.` : '';

        Alert.alert(
            'Delete Category',
            `Are you sure you want to delete "${cat.name}"?${warning}`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            setCategories(prev => prev.filter(c => c.id !== cat.id && c.slug !== cat.slug));
                            await deleteCategory(cat);
                            fetchCategoriesAndCounts(true);
                        } catch (delErr) {
                            Alert.alert('Delete Failed', delErr.message || 'Failed to delete category.');
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

    const filteredDropdownList = GLOBAL_CATEGORIES.filter(item =>
        !dropdownSearch.trim() ||
        item.name.toLowerCase().includes(dropdownSearch.toLowerCase()) ||
        item.slug.toLowerCase().includes(dropdownSearch.toLowerCase())
    );

    const totalCategories = categories.length;
    const activeCategories = categories.filter(c => c.is_active !== false).length;
    const inactiveCategories = categories.filter(c => c.is_active === false).length;
    const totalLinkedProds = Object.values(productCounts).reduce((sum, n) => sum + n, 0);

    return (
        <View style={s.container}>
            {/* Header Area */}
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
                            <Text style={s.badgePillTxt}>PLATFORM TAXONOMY</Text>
                        </View>
                        <Text style={s.headerTitle}>Category Management</Text>
                        <Text style={s.headerSubtitle}>
                            Configure marketplace catalog, display order & live visibility
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
                            <Text style={s.addBtnTxt}>ADD CATEGORY</Text>
                        </LinearGradient>
                    </TouchableOpacity>
                </View>

                {/* 4 KPI Metric Cards */}
                <View style={s.kpiRow}>
                    <View style={s.kpiCard}>
                        <Text style={s.kpiValue}>{totalCategories}</Text>
                        <Text style={s.kpiLabel}>Total</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.emerald }]}>{activeCategories}</Text>
                        <Text style={s.kpiLabel}>Active</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.slate }]}>{inactiveCategories}</Text>
                        <Text style={s.kpiLabel}>Inactive</Text>
                    </View>
                    <View style={s.kpiCard}>
                        <Text style={[s.kpiValue, { color: BRAND.gold }]}>{totalLinkedProds}</Text>
                        <Text style={s.kpiLabel}>Products</Text>
                    </View>
                </View>

                {/* Search Bar */}
                <View style={s.searchBar}>
                    <Ionicons name="search" size={16} color={BRAND.gold} style={{ marginRight: 8 }} />
                    <TextInput
                        placeholder="Search category name or slug..."
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

                {/* Filter Tabs */}
                <View style={s.filterPillsRow}>
                    {[
                        { key: 'all', label: `All (${totalCategories})` },
                        { key: 'active', label: `Active (${activeCategories})` },
                        { key: 'inactive', label: `Inactive (${inactiveCategories})` },
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

            {/* Category List */}
            {loading && !refreshing ? (
                <View style={s.loadingCenter}>
                    <ActivityIndicator size="large" color={BRAND.gold} />
                    <Text style={s.loadingTxt}>Loading categories...</Text>
                </View>
            ) : filteredCategories.length === 0 ? (
                <View style={s.emptyBox}>
                    <View style={s.emptyIconCircle}>
                        <Ionicons name="layers-outline" size={38} color={BRAND.gold} />
                    </View>
                    <Text style={s.emptyTitle}>No categories found</Text>
                    <Text style={s.emptySub}>
                        {searchQuery ? 'Try clearing your search query.' : 'Tap "ADD CATEGORY" above to create your first category.'}
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
                                            <Ionicons name={item.icon || "layers"} size={22} color={BRAND.gold} />
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
                                                    {isActive ? 'ACTIVE' : 'INACTIVE'}
                                                </Text>
                                            </View>
                                        </View>

                                        <Text numberOfLines={1} style={s.catSlug}>
                                            /{item.slug || 'category'}
                                        </Text>

                                        <View style={s.catMetaRow}>
                                            <View style={s.metaItem}>
                                                <Ionicons name="cube-outline" size={12} color={BRAND.gold} />
                                                <Text style={s.metaTxt}>{count} products</Text>
                                            </View>
                                            <Text style={s.metaDot}>•</Text>
                                            <View style={s.metaItem}>
                                                <Ionicons name="swap-vertical-outline" size={12} color={BRAND.slate} />
                                                <Text style={s.metaTxt}>Order #{item.display_order ?? 0}</Text>
                                            </View>
                                        </View>
                                    </View>
                                </View>

                                {/* Action Buttons */}
                                <View style={s.catActionsCol}>
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

                                    <TouchableOpacity
                                        onPress={() => openEditModal(item)}
                                        style={s.editBtn}
                                        activeOpacity={0.75}
                                    >
                                        <Ionicons name="pencil" size={14} color={BRAND.navy} />
                                    </TouchableOpacity>

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
                                    {editingCategory ? 'Edit Category' : 'Create New Category'}
                                </Text>
                                <Text style={s.modalSub}>
                                    Changes sync instantly across web and mobile platforms
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

                            {/* 1. Global Categories Dropdown Selector */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Select Category from Global Catalog</Text>
                                <TouchableOpacity
                                    onPress={() => {
                                        setDropdownSearch('');
                                        setDropdownVisible(true);
                                    }}
                                    style={s.dropdownTrigger}
                                    activeOpacity={0.8}
                                >
                                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                                        <Ionicons name={formIcon || "list-outline"} size={18} color={BRAND.gold} />
                                        <Text style={[s.dropdownTriggerTxt, !formName && { color: '#94A3B8' }]}>
                                            {formName || "Choose from 35+ world categories..."}
                                        </Text>
                                    </View>
                                    <Ionicons name="chevron-down" size={18} color={BRAND.slate} />
                                </TouchableOpacity>
                            </View>

                            {/* 2. Category Name Input (Pre-filled by Dropdown or Custom) */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Category Name *</Text>
                                <TextInput
                                    placeholder="e.g. Phones & Tablets"
                                    value={formName}
                                    onChangeText={handleNameChange}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* 3. URL Slug */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>URL Slug / Identifier</Text>
                                <TextInput
                                    placeholder="e.g. phones-tablets"
                                    value={formSlug}
                                    onChangeText={setFormSlug}
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                    autoCapitalize="none"
                                />
                            </View>

                            {/* 4. Image Upload & Preview Section */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Category Cover Image</Text>
                                <View style={s.imageUploadSection}>
                                    <View style={s.imagePreviewBox}>
                                        {formImageUrl ? (
                                            <Image source={{ uri: formImageUrl }} style={s.imagePreviewImg} />
                                        ) : (
                                            <Ionicons name={formIcon || "image-outline"} size={32} color={BRAND.gold} />
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
                                                {uploading ? 'Uploading...' : 'Upload Image'}
                                            </Text>
                                        </TouchableOpacity>

                                        {formImageUrl ? (
                                            <TouchableOpacity
                                                onPress={() => setFormImageUrl('')}
                                                style={s.removeImageBtn}
                                                activeOpacity={0.75}
                                            >
                                                <Ionicons name="trash-outline" size={13} color={BRAND.danger} />
                                                <Text style={s.removeImageTxt}>Remove Image</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <Text style={s.imageHintTxt}>
                                                Select a photo from device or choose a preset above.
                                            </Text>
                                        )}
                                    </View>
                                </View>
                            </View>

                            {/* 5. Display Order */}
                            <View style={s.formField}>
                                <Text style={s.fieldLabel}>Display Order (Priority)</Text>
                                <TextInput
                                    placeholder="e.g. 1"
                                    value={formDisplayOrder}
                                    onChangeText={setFormDisplayOrder}
                                    keyboardType="numeric"
                                    style={s.input}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>

                            {/* 6. Active Visibility */}
                            <View style={s.switchFieldRow}>
                                <View style={{ flex: 1, paddingRight: 12 }}>
                                    <Text style={s.fieldLabel}>Active Public Visibility</Text>
                                    <Text style={s.switchSubTxt}>Display category in store navigation and homepage</Text>
                                </View>
                                <Switch
                                    value={formIsActive}
                                    onValueChange={setFormIsActive}
                                    trackColor={{ false: '#CBD5E1', true: BRAND.emerald }}
                                    thumbColor={Platform.OS === 'android' ? '#FFFFFF' : undefined}
                                />
                            </View>

                            {/* 7. Submit Button */}
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
                                            <Text style={s.submitBtnTxt}>Saving Category...</Text>
                                        </View>
                                    ) : (
                                        <>
                                            <Ionicons name="checkmark-circle" size={19} color="#071422" />
                                            <Text style={s.submitBtnTxt}>
                                                {editingCategory ? 'Update Category' : 'Save & Publish Category'}
                                            </Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>
                        </ScrollView>
                    </View>
                </View>
            </Modal>

            {/* ════ GLOBAL CATEGORIES DROPDOWN MODAL ════ */}
            <Modal
                visible={dropdownVisible}
                animationType="fade"
                transparent={true}
                onRequestClose={() => setDropdownVisible(false)}
            >
                <View style={s.dropdownBackdrop}>
                    <View style={s.dropdownSheet}>
                        <View style={s.dropdownHeader}>
                            <View style={{ flex: 1 }}>
                                <Text style={s.dropdownTitle}>Select Category</Text>
                                <Text style={s.dropdownSub}>Choose from global marketplace categories</Text>
                            </View>
                            <TouchableOpacity onPress={() => setDropdownVisible(false)} style={s.closeBtn}>
                                <Ionicons name="close" size={18} color="#FFFFFF" />
                            </TouchableOpacity>
                        </View>

                        {/* Search in Dropdown */}
                        <View style={s.dropdownSearchWrap}>
                            <Ionicons name="search" size={16} color={BRAND.gold} style={{ marginRight: 8 }} />
                            <TextInput
                                placeholder="Filter categories..."
                                value={dropdownSearch}
                                onChangeText={setDropdownSearch}
                                style={s.dropdownSearchInput}
                                placeholderTextColor="#94A3B8"
                                autoFocus={Platform.OS === 'web'}
                            />
                            {dropdownSearch.length > 0 && (
                                <TouchableOpacity onPress={() => setDropdownSearch('')}>
                                    <Ionicons name="close-circle" size={16} color="#94A3B8" />
                                </TouchableOpacity>
                            )}
                        </View>

                        {/* Categories List */}
                        <FlatList
                            data={filteredDropdownList}
                            keyExtractor={item => item.slug}
                            contentContainerStyle={{ padding: 12 }}
                            renderItem={({ item }) => {
                                const isSelected = formSlug === item.slug;
                                return (
                                    <TouchableOpacity
                                        onPress={() => handleSelectDropdownItem(item)}
                                        style={[s.dropdownItem, isSelected && s.dropdownItemActive]}
                                        activeOpacity={0.7}
                                    >
                                        <View style={s.dropdownItemThumb}>
                                            <Image source={{ uri: item.image }} style={s.dropdownItemImg} />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={[s.dropdownItemTxt, isSelected && s.dropdownItemTxtActive]}>
                                                {item.name}
                                            </Text>
                                            <Text style={s.dropdownItemSlug}>
                                                /{item.slug}
                                            </Text>
                                        </View>
                                        {isSelected && (
                                            <Ionicons name="checkmark-circle" size={18} color={BRAND.emerald} />
                                        )}
                                    </TouchableOpacity>
                                );
                            }}
                        />
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
        width: 50,
        height: 50,
        borderRadius: 12,
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
    dropdownTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: '#F8FAFC',
        borderRadius: 12,
        paddingHorizontal: 14,
        paddingVertical: 12,
        borderWidth: 1.2,
        borderColor: BRAND.borderGold,
    },
    dropdownTriggerTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: BRAND.slateDark,
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
    // Image Upload
    imageUploadSection: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 12,
        backgroundColor: '#F8FAFC',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E2E8F0',
    },
    imagePreviewBox: {
        width: 72,
        height: 72,
        borderRadius: 14,
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
    // Global Categories Dropdown Modal Styles
    dropdownBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(7, 20, 34, 0.8)',
        justifyContent: 'center',
        padding: 20,
    },
    dropdownSheet: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        maxHeight: '80%',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: BRAND.borderGold,
    },
    dropdownHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        backgroundColor: BRAND.navyDark,
        borderBottomWidth: 1,
        borderColor: BRAND.borderGold,
    },
    dropdownTitle: {
        fontSize: 15,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    dropdownSub: {
        fontSize: 10.5,
        color: '#94A3B8',
        marginTop: 1,
    },
    dropdownSearchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#F8FAFC',
        borderBottomWidth: 1,
        borderColor: '#E2E8F0',
        paddingHorizontal: 14,
        paddingVertical: 8,
    },
    dropdownSearchInput: {
        flex: 1,
        fontSize: 13,
        color: BRAND.slateDark,
        fontWeight: '600',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        marginBottom: 4,
    },
    dropdownItemActive: {
        backgroundColor: '#FEF3C7',
    },
    dropdownItemThumb: {
        width: 38,
        height: 38,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#E2E8F0',
    },
    dropdownItemImg: {
        width: '100%',
        height: '100%',
        resizeMode: 'cover',
    },
    dropdownItemTxt: {
        fontSize: 13,
        fontWeight: '700',
        color: BRAND.slateDark,
    },
    dropdownItemTxtActive: {
        color: BRAND.navyDark,
        fontWeight: '900',
    },
    dropdownItemSlug: {
        fontSize: 10.5,
        color: BRAND.slate,
        marginTop: 1,
    },
});
