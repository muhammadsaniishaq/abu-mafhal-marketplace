import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, Image,
    ActivityIndicator, Alert, Switch, StatusBar, Platform,
    Animated, Dimensions, StyleSheet, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { geminiService } from '../../services/geminiService';
import { parsePrice } from '../../utils/helpers';
import { LinearGradient } from 'expo-linear-gradient';

const { width: W } = Dimensions.get('window');
const SB_H = Platform.OS === 'android' ? (StatusBar.currentHeight || 24) : 0;
const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

const CATEGORIES = [
    { label: 'Electronics',  icon: 'phone-portrait',   color: '#3B82F6' },
    { label: 'Fashion',      icon: 'shirt',             color: '#EC4899' },
    { label: 'Home',         icon: 'home',              color: '#10B981' },
    { label: 'Beauty',       icon: 'flower',            color: '#F472B6' },
    { label: 'Sports',       icon: 'football',          color: '#F59E0B' },
    { label: 'Books',        icon: 'book',              color: '#8B5CF6' },
    { label: 'Toys',         icon: 'game-controller',   color: '#EF4444' },
    { label: 'Food',         icon: 'fast-food',         color: '#F97316' },
    { label: 'Automotive',   icon: 'car',               color: '#6366F1' },
    { label: 'Other',        icon: 'grid',              color: '#64748B' },
];

const TABS = [
    { id: 'vital',    label: 'Info',      icon: 'information-circle' },
    { id: 'offer',    label: 'Pricing',   icon: 'pricetag' },
    { id: 'images',   label: 'Media',     icon: 'images' },
    { id: 'details',  label: 'Specs',     icon: 'list' },
    { id: 'variants', label: 'Variants',  icon: 'layers' },
    { id: 'advanced', label: 'Advanced',  icon: 'settings' },
    { id: 'shipping', label: 'SEO',       icon: 'search' },
];

// ─── Inp: MUST be defined OUTSIDE component to avoid keyboard dismiss ─────────
const Inp = ({ label, field, form, onSet, placeholder, numeric, multi, hint }) => (
    <View style={SS.inpWrap}>
        <Text style={SS.inpLabel}>{label}</Text>
        <TextInput
            style={[SS.inpBox, multi && { height: 88, textAlignVertical: 'top', paddingTop: 12 }]}
            value={form[field]}
            onChangeText={v => onSet(field, v)}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            keyboardType={numeric ? 'numeric' : 'default'}
            multiline={multi}
            returnKeyType={multi ? 'default' : 'next'}
        />
        {hint && <Text style={SS.inpHint}>{hint}</Text>}
    </View>
);

// ─── ToggleRow: MUST be defined OUTSIDE component ────────────────────────────
const ToggleRow = ({ label, desc, value, onChange, color = '#3B82F6', icon }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onChange(!value)}
        style={[SS.toggleRow, value && { backgroundColor: color + '10', borderColor: color + '40' }]}>
        <View style={[SS.toggleIcon, { backgroundColor: value ? color + '20' : '#F1F5F9' }]}>
            <Ionicons name={icon} size={18} color={value ? color : '#94A3B8'} />
        </View>
        <View style={{ flex: 1 }}>
            <Text style={[SS.toggleLabel, value && { color }]}>{label}</Text>
            {desc ? <Text style={SS.toggleDesc}>{desc}</Text> : null}
        </View>
        <Switch value={!!value} onValueChange={onChange}
            trackColor={{ false: '#E2E8F0', true: color }}
            thumbColor="white" />
    </TouchableOpacity>
);

// ─────────────────────────────────────────────────────────────────────────────
export const AdminAddProduct = ({ onCancel, onSuccess, initialData = null }) => {
    const isEditing = !!initialData;

    const [activeTab,  setActiveTab]  = useState('vital');
    const [loading,    setLoading]    = useState(false);
    const [aiLoading,  setAiLoading]  = useState(false);
    const [images,     setImages]     = useState(
        initialData?.images?.map(uri => ({ uri, status: 'success', url: uri })) || []
    );
    const [video, setVideo] = useState(initialData?.metadata?.video || initialData?.video_url || null);
    const [vendors, setVendors]         = useState([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState(null);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [deleting, setDeleting] = useState(false);

    const saveAnim = useRef(new Animated.Value(1)).current;

    const [form, setForm] = useState({
        name:              initialData?.name || '',
        description:       initialData?.description || '',
        category:          initialData?.category || '',
        brand:             initialData?.brand || '',
        price:             initialData?.price?.toString() || '',
        originalPrice:     initialData?.original_price?.toString() || '',
        cost:              initialData?.cost?.toString() || '',
        stock:             initialData?.stock_quantity?.toString() || '',
        sku:               initialData?.sku || '',
        status:            initialData?.status || 'approved',
        barcode:           initialData?.metadata?.barcode || '',
        specifications:    initialData?.metadata?.specifications || [{ key: '', value: '' }],
        variants:          initialData?.metadata?.variants || [],
        warrantyPolicy:    initialData?.metadata?.warranty_policy || '1 Year Official Warranty',
        boxContents:       initialData?.metadata?.box_contents || '',
        highlights:        initialData?.metadata?.highlights || ['', '', ''],
        isAffiliate:       initialData?.is_affiliate || false,
        affiliateLink:     initialData?.affiliate_link || '',
        weight:            initialData?.shipping_weight?.toString() || '',
        seoTitle:          initialData?.seo_title || '',
        seoDesc:           initialData?.seo_description || '',
        keywords:          initialData?.metadata?.keywords || '',
        tags:              (initialData?.tags || []).join(', '),
        saleStart:         initialData?.metadata?.sale_start_date || '',
        saleEnd:           initialData?.metadata?.sale_end_date || '',
        isDigital:         initialData?.metadata?.is_digital || false,
        lowStockThreshold: initialData?.metadata?.low_stock_threshold?.toString() || '5',
        allowBackorders:   initialData?.metadata?.allow_backorders || false,
        taxClass:          initialData?.metadata?.tax_class || 'standard',
        maxQuantity:       initialData?.metadata?.max_quantity?.toString() || '',
        freeShipping:      initialData?.free_shipping || false,
    });

    const set = (key, val) => setForm(p => ({ ...p, [key]: val }));

    // Helper to pass to Inp/ToggleRow (stable reference)
    const onSet = set;

    // ── Load vendors ───────────────────────────────────────────
    useEffect(() => {
        loadVendors();
        // Pre-select initial vendor if editing
        if (initialData?.vendor_id) {
            Promise.all([
                supabase.from('profiles').select('id, full_name, email, avatar_url, role').eq('id', initialData.vendor_id).maybeSingle(),
                supabase.from('stores').select('id, vendor_id, name, logo').eq('vendor_id', initialData.vendor_id).maybeSingle()
            ]).then(([{ data: p }, { data: st }]) => {
                if (p) {
                    setSelectedVendor({
                        ...p,
                        storeName: st?.name || (p.role === 'admin' ? 'ABU MAFHAL Official Mall' : p.full_name),
                        storeLogo: st?.logo || p.avatar_url,
                        storeId: st?.id
                    });
                }
            }).catch(() => {});
        }
    }, []);

    const loadVendors = async () => {
        try {
            const [{ data: profs }, { data: storeList }] = await Promise.all([
                supabase.from('profiles')
                    .select('id, full_name, email, avatar_url, role')
                    .or('role.eq.vendor,role.eq.admin')
                    .order('full_name'),
                supabase.from('stores')
                    .select('id, vendor_id, name, logo')
            ]);

            const storeMap = {};
            (storeList || []).forEach(st => {
                if (st.vendor_id) storeMap[st.vendor_id] = st;
            });

            const enriched = (profs || []).map(p => ({
                ...p,
                storeName: storeMap[p.id]?.name || (p.role === 'admin' ? 'ABU MAFHAL Official Mall' : (p.full_name || 'Vendor Store')),
                storeLogo: storeMap[p.id]?.logo || p.avatar_url,
                storeId: storeMap[p.id]?.id
            }));
            setVendors(enriched);
        } catch (_) {
            const { data } = await supabase
                .from('profiles')
                .select('id, full_name, email, avatar_url, role')
                .or('role.eq.vendor,role.eq.admin')
                .order('full_name');
            if (data) setVendors(data);
        }
    };

    // ── Image helpers ──────────────────────────────────────────
    const pickImage = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true, quality: 0.75, base64: true
        });
        if (!result.canceled) {
            setImages(prev => [...prev, ...result.assets.map(a => ({
                uri: a.uri, base64: a.base64, type: 'image/jpeg', status: 'pending'
            }))]);
        }
    };

    const pickVideo = async () => {
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 0.5
        });
        if (!result.canceled) setVideo(result.assets[0].uri);
    };

    const uploadImages = async () => {
        const urls = [];
        for (const img of images) {
            if (img.status === 'success') { urls.push(img.url); continue; }
            const fname = `${Date.now()}_${Math.random().toString(36).substr(2,8)}.jpg`;
            const { data, error } = await supabase.storage.from('products')
                .upload(fname, decode(img.base64), { contentType: 'image/jpeg', upsert: false });
            if (error) throw error;
            urls.push(supabase.storage.from('products').getPublicUrl(fname).data.publicUrl);
        }
        return urls;
    };

    const uploadVideo = async () => {
        if (!video || video.startsWith('http')) return video || null;
        try {
            const info = await FileSystem.getInfoAsync(video);
            if (!info.exists) return null;
            const fname = `video_admin_${Date.now()}.mp4`;
            const b64 = await FileSystem.readAsStringAsync(video, { encoding: 'base64' });
            const { error } = await supabase.storage.from('products')
                .upload(fname, decode(b64), { contentType: 'video/mp4', upsert: false });
            if (error) return null;
            return supabase.storage.from('products').getPublicUrl(fname).data.publicUrl;
        } catch { return null; }
    };

    // ── AI ─────────────────────────────────────────────────────
    const handleAI = async (type) => {
        if (!form.name || !form.name.trim()) {
            return Alert.alert('Product Name Required', 'Please enter a product name first so AI knows what to generate.');
        }
        setAiLoading(true);
        try {
            if (type === 'description') {
                const d = await geminiService.generateDescription(form);
                if (d) {
                    set('description', d);
                    Alert.alert('Description Generated ✨', 'Product description has been generated!');
                }
            } else if (type === 'seo') {
                const s = await geminiService.generateSEO(form);
                if (s) {
                    setForm(p => ({
                        ...p,
                        seoTitle: s.title || p.seoTitle,
                        seoDesc: s.description || p.seoDesc,
                        keywords: s.keywords || p.keywords
                    }));
                    Alert.alert('SEO Generated ✨', 'SEO Title, Description, and Keywords generated successfully!');
                }
            } else if (type === 'specs') {
                const suggested = await geminiService.suggestSpecs(form);
                if (suggested && suggested.length > 0) {
                    setForm(p => {
                        const existing = (p.specifications || []).filter(x => x.key && x.value);
                        return {
                            ...p,
                            specifications: [...existing, ...suggested]
                        };
                    });
                    Alert.alert('Specs Generated ✨', `Auto-suggested ${suggested.length} specifications!`);
                }
            }
        } catch (e) {
            Alert.alert('AI Notice', e.message || 'Could not complete AI request at this time.');
        } finally {
            setAiLoading(false);
        }
    };

    // ── Submit ─────────────────────────────────────────────────
    const handleSubmit = async () => {
        const missing = [];
        if (!form.name)        missing.push('Product Name');
        if (!form.price)       missing.push('Price');
        if (!form.description) missing.push('Description');
        if (missing.length)    return Alert.alert('Missing Fields', missing.join(', '));

        const p = parseFloat(form.price.replace(/,/g,''));
        if (p > 10_000_000) {
            const ok = await new Promise(r => Alert.alert(
                'High Price ⚠️', `You entered ₦${p.toLocaleString()}. Correct?`,
                [{ text: 'No, fix it', style: 'cancel', onPress: () => r(false) },
                 { text: 'Yes, save',  onPress: () => r(true) }]
            ));
            if (!ok) return;
        }

        // Animate save button
        Animated.sequence([
            Animated.spring(saveAnim, { toValue: 0.9, useNativeDriver: true }),
            Animated.spring(saveAnim, { toValue: 1,   useNativeDriver: true }),
        ]).start();

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Session expired. Please login again.');

            const [imageUrls, videoUrl] = await Promise.all([uploadImages(), uploadVideo()]);

            const payload = {
                vendor_id:        selectedVendor?.id || user.id,
                name:             form.name,
                description:      form.description,
                category:         form.category,
                brand:            form.brand,
                price:            parsePrice(form.price),
                compare_at_price: parsePrice(form.originalPrice) || null,
                original_price:   parsePrice(form.originalPrice) || null,
                cost:             parsePrice(form.cost) || null,
                stock:            parseInt(form.stock) || 0,
                stock_quantity:   parseInt(form.stock) || 0,
                sku:              form.sku,
                image_url:        imageUrls[0] || null,
                images:           imageUrls,
                video_url:        videoUrl,
                status:           form.status,
                is_affiliate:     form.isAffiliate,
                affiliate_link:   form.affiliateLink,
                is_new:           !isEditing,
                shipping_weight:  parseFloat(form.weight) || null,
                free_shipping:    form.freeShipping,
                seo_title:        form.seoTitle,
                seo_description:  form.seoDesc,
                tags:             form.tags.split(',').map(t => t.trim()).filter(Boolean),
                metadata: {
                    metrics:             initialData?.metadata?.metrics || {},
                    keywords:            form.keywords,
                    barcode:             form.barcode,
                    specifications:      form.specifications.filter(s => s.key && s.value),
                    variants:            form.variants,
                    warranty_policy:     form.warrantyPolicy,
                    box_contents:        form.boxContents,
                    highlights:          (form.highlights || []).filter(Boolean),
                    video:               videoUrl,
                    is_digital:          form.isDigital,
                    low_stock_threshold: parseInt(form.lowStockThreshold) || 5,
                    allow_backorders:    form.allowBackorders,
                    tax_class:           form.taxClass,
                    max_quantity:        parseInt(form.maxQuantity) || null,
                    sale_start_date:     form.saleStart || null,
                    sale_end_date:       form.saleEnd || null,
                }
            };

            const { error } = isEditing
                ? await supabase.from('products').update(payload).eq('id', initialData.id)
                : await supabase.from('products').insert(payload);

            if (error) throw error;
            Alert.alert('Success ✅', `Product ${isEditing ? 'updated' : 'created'} successfully!`);
            onSuccess();
        } catch (e) {
            Alert.alert('Error ❌', e.message);
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteProduct = () => {
        setShowDeleteModal(true);
    };

    const confirmDeleteProduct = async () => {
        if (!initialData?.id) return;
        setDeleting(true);
        try {
            // 1. Attempt hard delete with .select()
            const { data: delData, error: delErr } = await supabase
                .from('products')
                .delete()
                .eq('id', initialData.id)
                .select('id');

            if (!delErr && delData && delData.length > 0) {
                setShowDeleteModal(false);
                if (Platform.OS === 'web') alert('Product successfully deleted.');
                else Alert.alert('Deleted ✅', 'Product successfully removed.');
                onSuccess();
                return;
            }

            console.warn('Hard delete in edit affected 0 rows, archiving instead:', delErr?.message);

            // 2. Fallback: Archive product
            const { data: arcData, error: arcErr } = await supabase.from('products').update({
                status: 'archived',
                is_active: false,
                stock: 0,
                stock_quantity: 0
            }).eq('id', initialData.id).select('id');

            if (!arcErr && arcData && arcData.length > 0) {
                setShowDeleteModal(false);
                if (Platform.OS === 'web') alert('Product archived & removed from store.');
                else Alert.alert('Archived ✅', 'Product has past orders, so it was safely hidden from store.');
                onSuccess();
                return;
            }

            // 3. Fallback without select
            const { error: simpleArcErr } = await supabase.from('products').update({
                status: 'archived',
                is_active: false,
                stock: 0
            }).eq('id', initialData.id);

            if (!simpleArcErr) {
                setShowDeleteModal(false);
                if (Platform.OS === 'web') alert('Product archived & removed from store.');
                else Alert.alert('Archived ✅', 'Product has been removed from store.');
                onSuccess();
                return;
            }

            throw delErr || arcErr || simpleArcErr || new Error('Could not delete product.');
        } catch (e) {
            if (Platform.OS === 'web') alert('Delete Failed: ' + (e.message || 'Could not delete product.'));
            else Alert.alert('Delete Failed ❌', e.message || 'Could not delete product.');
        } finally {
            setDeleting(false);
        }
    };

    // ── Tab Renderers ──────────────────────────────────────────
    const renderVital = () => (
        <View style={SS.tabContent}>

            {/* Card 1: Core fields — Name, Brand, Price, Stock */}
            <View style={SS.card}>
                <Inp label="Product Name *" field="name" form={form} onSet={onSet} placeholder="e.g. Premium Wireless Earbuds" />
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Inp label="Brand" field="brand" form={form} onSet={onSet} placeholder="e.g. Sony" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Inp label="Stock Qty *" field="stock" form={form} onSet={onSet} placeholder="0" numeric />
                    </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}>
                        <Inp label="Price (₦) *" field="price" form={form} onSet={onSet} placeholder="0.00" numeric />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Inp label="Original Price (₦)" field="originalPrice" form={form} onSet={onSet} placeholder="0.00" numeric />
                    </View>
                </View>
            </View>

            {/* Card 2: Category */}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ gap: 6, paddingVertical: 2 }}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity key={cat.label} onPress={() => set('category', cat.label)}
                            style={[SS.catChip, form.category === cat.label && { backgroundColor: cat.color, borderColor: cat.color }]}>
                            <Ionicons name={cat.icon} size={12} color={form.category === cat.label ? 'white' : cat.color} />
                            <Text style={[SS.catLabel, form.category === cat.label && { color: 'white' }]}>{cat.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            {/* Card 3: Description + AI */}
            <View style={SS.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={SS.cardTitle}>Description *</Text>
                    <TouchableOpacity onPress={() => handleAI('description')}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#C084FC' }}>
                        {aiLoading
                            ? <ActivityIndicator size="small" color="#8B5CF6" />
                            : <Ionicons name="sparkles" size={13} color="#8B5CF6" />}
                        <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 11 }}>AI Write</Text>
                    </TouchableOpacity>
                </View>
                <TextInput
                    style={[SS.inpBox, { height: 80, textAlignVertical: 'top', paddingTop: 9 }]}
                    value={form.description}
                    onChangeText={v => onSet('description', v)}
                    placeholder="Detailed product information..."
                    placeholderTextColor="#94A3B8"
                    multiline
                />
            </View>

            {/* Card 4: Vendor + Status (compact) */}
            <View style={SS.card}>
                <TouchableOpacity onPress={() => setShowVendorModal(true)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 }}>
                    <View style={{ width: 32, height: 32, borderRadius: 9, backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }}>
                        {selectedVendor?.storeLogo || selectedVendor?.avatar_url
                            ? <Image source={{ uri: selectedVendor.storeLogo || selectedVendor.avatar_url }} style={{ width: 32, height: 32, borderRadius: 9 }} />
                            : <Ionicons name="storefront" size={16} color="#6366F1" />}
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>VENDOR</Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0E1A2E' }} numberOfLines={1}>
                            {selectedVendor ? (selectedVendor.storeName || selectedVendor.full_name) : 'Tap to select vendor'}
                        </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#94A3B8" />
                </TouchableOpacity>

                <View style={{ height: 1, backgroundColor: '#F1F5F9', marginVertical: 8 }} />

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View>
                        <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.5 }}>STATUS</Text>
                        <Text style={{ fontSize: 12.5, fontWeight: '700', color: form.status === 'approved' ? '#059669' : '#B45309' }}>
                            {form.status === 'approved' ? '✓ Published' : '⏸ Draft'}
                        </Text>
                    </View>
                    <Switch
                        value={form.status === 'approved'}
                        onValueChange={v => set('status', v ? 'approved' : 'draft')}
                        trackColor={{ false: '#E2E8F0', true: '#059669' }}
                        thumbColor="white"
                    />
                </View>
            </View>
        </View>
    );

    const renderOffer = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Extra Pricing Info</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Inp label="Cost Price (internal)" field="cost" form={form} onSet={onSet} placeholder="0.00" numeric /></View>
                    <View style={{ flex: 1 }}><Inp label="Max Qty Per Order" field="maxQuantity" form={form} onSet={onSet} placeholder="e.g. 5" numeric /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Inp label="SKU" field="sku" form={form} onSet={onSet} placeholder="PROD-001" /></View>
                    <View style={{ flex: 1 }}><Inp label="Barcode" field="barcode" form={form} onSet={onSet} placeholder="EAN-13 / UPC" /></View>
                </View>
                <Inp label="Low Stock Alert At" field="lowStockThreshold" form={form} onSet={onSet} placeholder="5" numeric hint="Alert when stock falls below this number" />
            </View>

            <View style={SS.card}>
                <ToggleRow label="Free Shipping" desc={form.freeShipping ? 'Customers pay ₦0' : 'Standard shipping fee applies'}
                    icon="airplane" value={form.freeShipping} onChange={v => set('freeShipping', v)} color="#10B981" />
                <ToggleRow label="Allow Backorders" desc="Let customers order even when out of stock"
                    icon="refresh" value={form.allowBackorders} onChange={v => set('allowBackorders', v)} color="#F59E0B" />
                <ToggleRow label="Digital Product" desc="No physical shipping needed"
                    icon="cloud-download" value={form.isDigital} onChange={v => set('isDigital', v)} color="#8B5CF6" />
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Sale Schedule</Text>
                <View style={{ flexDirection: 'row', gap: 10 }}>
                    <View style={{ flex: 1 }}><Inp label="Start (YYYY-MM-DD)" field="saleStart" form={form} onSet={onSet} placeholder="2025-01-01" /></View>
                    <View style={{ flex: 1 }}><Inp label="End (YYYY-MM-DD)" field="saleEnd" form={form} onSet={onSet} placeholder="2025-12-31" /></View>
                </View>
            </View>

            <TouchableOpacity onPress={() => handleAI('seo')} style={SS.aiBtnFull}>
                {aiLoading ? <ActivityIndicator size="small" color="#8B5CF6" />
                           : <Ionicons name="sparkles" size={16} color="#8B5CF6" />}
                <Text style={SS.aiBtnTxt}>Generate SEO with AI</Text>
            </TouchableOpacity>
        </View>
    );

    const renderMedia = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Product Images</Text>
                <TouchableOpacity onPress={pickImage} style={SS.imagePicker}>
                    <Ionicons name="cloud-upload" size={28} color="#6366F1" />
                    <Text style={SS.imagePickerTxt}>Tap to upload images</Text>
                    <Text style={SS.imagePickerSub}>{images.length} / 10 selected</Text>
                </TouchableOpacity>

                {images.length > 0 && (
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 14 }}>
                        {images.map((img, i) => (
                            <View key={i} style={{ width: (W - 72) / 3, aspectRatio: 1, borderRadius: 12, overflow: 'hidden' }}>
                                <Image source={{ uri: img.uri }} style={{ width: '100%', height: '100%' }} />
                                <TouchableOpacity onPress={() => setImages(images.filter((_, idx) => idx !== i))}
                                    style={SS.removeImgBtn}>
                                    <Ionicons name="close" size={12} color="white" />
                                </TouchableOpacity>
                                {i === 0 && (
                                    <View style={SS.primaryBadge}>
                                        <Text style={{ color: 'white', fontSize: 8, fontWeight: '800' }}>MAIN</Text>
                                    </View>
                                )}
                            </View>
                        ))}
                    </View>
                )}
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Product Video (optional)</Text>
                <TouchableOpacity onPress={pickVideo} style={[SS.imagePicker, { height: 90 }]}>
                    {video
                        ? <><Ionicons name="videocam" size={24} color="#10B981" /><Text style={[SS.imagePickerTxt, { color: '#10B981' }]}>Video Selected ✓</Text></>
                        : <><Ionicons name="videocam-outline" size={24} color="#94A3B8" /><Text style={SS.imagePickerTxt}>Select short product video</Text></>
                    }
                </TouchableOpacity>
                {video && (
                    <TouchableOpacity onPress={() => setVideo(null)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                        <Text style={{ color: '#EF4444', fontWeight: '700', fontSize: 13 }}>Remove Video</Text>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );

    const SPEC_PRESETS = ['RAM', 'Storage', 'Battery', 'Material', 'Warranty', 'Dimensions', 'Color', 'Weight', 'Display', 'Connectivity', 'Condition'];
    const WARRANTY_OPTIONS = ['No Warranty', '7 Days Return', '14 Days Replacement', '6 Months Warranty', '1 Year Official Warranty', '2 Years Warranty'];
    const COLOR_PRESETS = [
        { name: 'Black',  hex: '#0F172A', border: '#334155' },
        { name: 'White',  hex: '#FFFFFF', border: '#CBD5E1' },
        { name: 'Blue',   hex: '#2563EB', border: '#1D4ED8' },
        { name: 'Red',    hex: '#DC2626', border: '#B91C1C' },
        { name: 'Green',  hex: '#16A34A', border: '#15803D' },
        { name: 'Gold',   hex: '#EAB308', border: '#CA8A04' },
        { name: 'Purple', hex: '#9333EA', border: '#7E22CE' },
        { name: 'Silver', hex: '#94A3B8', border: '#64748B' },
    ];
    const SIZE_PRESETS = ['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '39', '40', '41', '42', '43', '44'];
    const STORAGE_PRESETS = ['64GB', '128GB', '256GB', '512GB', '1TB'];

    const renderDetails = () => (
        <View style={SS.tabContent}>
            {/* Card 1: Technical Specifications */}
            <View style={SS.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={SS.cardTitle}>Technical Specifications</Text>
                        <Text style={SS.cardSub}>Features shown in the specs section on the product page</Text>
                    </View>
                    <TouchableOpacity
                        onPress={() => handleAI('specs')}
                        disabled={aiLoading}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F3E8FF', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, borderWidth: 1, borderColor: '#C084FC' }}
                    >
                        {aiLoading ? <ActivityIndicator size="small" color="#7C3AED" /> : <Ionicons name="sparkles" size={13} color="#7C3AED" />}
                        <Text style={{ color: '#7C3AED', fontWeight: '800', fontSize: 11 }}>AI Suggest</Text>
                    </TouchableOpacity>
                </View>

                {/* Quick Add Preset Chips */}
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>Quick Add Preset:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {SPEC_PRESETS.map(item => (
                            <TouchableOpacity
                                key={item}
                                onPress={() => {
                                    const a = [...(form.specifications || [])];
                                    a.push({ key: item, value: '' });
                                    set('specifications', a);
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                            >
                                <Ionicons name="add" size={12} color="#3B82F6" />
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155' }}>{item}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Specs List */}
                {(form.specifications || []).map((spec, i) => (
                    <View key={i} style={{ backgroundColor: '#F8FAFC', borderRadius: 12, padding: 10, marginBottom: 8, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ backgroundColor: '#0E1A2E', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ color: '#D9A73A', fontSize: 10, fontWeight: '900' }}>#{i + 1}</Text>
                                </View>
                                <Text style={{ fontSize: 11, fontWeight: '700', color: '#475569' }}>{spec.key || 'Custom Feature'}</Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => set('specifications', form.specifications.filter((_, idx) => idx !== i))}
                                style={{ width: 26, height: 26, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    placeholder="Feature (e.g. Battery)"
                                    value={spec.key}
                                    onChangeText={t => { const a = [...form.specifications]; a[i].key = t; set('specifications', a); }}
                                    style={[SS.inpBox, { height: 38, fontSize: 12 }]}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 1.3 }}>
                                <TextInput
                                    placeholder="Value (e.g. 5000 mAh)"
                                    value={spec.value}
                                    onChangeText={t => { const a = [...form.specifications]; a[i].value = t; set('specifications', a); }}
                                    style={[SS.inpBox, { height: 38, fontSize: 12 }]}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>
                    </View>
                ))}

                <TouchableOpacity
                    onPress={() => set('specifications', [...(form.specifications || []), { key: '', value: '' }])}
                    style={[SS.addRowBtn, { justifyContent: 'center', backgroundColor: '#EFF6FF', borderRadius: 10, paddingVertical: 8, marginTop: 4, borderWidth: 1, borderColor: '#BFDBFE' }]}
                >
                    <Ionicons name="add-circle" size={18} color="#2563EB" />
                    <Text style={[SS.addRowTxt, { color: '#2563EB', fontSize: 12 }]}>Add New Specification</Text>
                </TouchableOpacity>
            </View>

            {/* Card 2: Key Product Highlights (Bullet Points) */}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Product Key Highlights</Text>
                <Text style={SS.cardSub}>Quick bullet points displayed prominently under the title</Text>
                {[0, 1, 2].map(idx => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#0E1A2E', alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#D9A73A', fontSize: 11, fontWeight: '900' }}>{idx + 1}</Text>
                        </View>
                        <TextInput
                            placeholder={`Key highlight #${idx + 1} (e.g. 100% Genuine, 2-day battery)`}
                            value={(form.highlights || [])[idx] || ''}
                            onChangeText={t => {
                                const h = [...(form.highlights || ['', '', ''])];
                                h[idx] = t;
                                set('highlights', h);
                            }}
                            style={[SS.inpBox, { flex: 1, height: 38, fontSize: 12 }]}
                            placeholderTextColor="#94A3B8"
                        />
                    </View>
                ))}
            </View>

            {/* Card 3: Warranty & Return Policy */}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Warranty & Return Policy</Text>
                <Text style={SS.cardSub}>Select buyer protection and warranty terms</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
                    {WARRANTY_OPTIONS.map(opt => {
                        const sel = form.warrantyPolicy === opt;
                        return (
                            <TouchableOpacity
                                key={opt}
                                onPress={() => set('warrantyPolicy', opt)}
                                style={[{ paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' }, sel && { backgroundColor: '#FFFBEB', borderColor: '#D9A73A' }]}
                            >
                                <Text style={[{ fontSize: 11.5, fontWeight: '700', color: '#64748B' }, sel && { color: '#B45309', fontWeight: '800' }]}>{opt}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Card 4: What's in the Box */}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>What's in the Box?</Text>
                <TextInput
                    placeholder="e.g. 1x Phone, 1x 67W Charger, 1x USB Cable, 1x User Manual"
                    value={form.boxContents}
                    onChangeText={v => set('boxContents', v)}
                    style={[SS.inpBox, { fontSize: 12 }]}
                    placeholderTextColor="#94A3B8"
                />
            </View>

            {/* Card 5: Affiliate Product */}
            <View style={SS.card}>
                <ToggleRow
                    label="Affiliate Product"
                    desc="Redirect buyers to an external website"
                    icon="link"
                    value={form.isAffiliate}
                    onChange={v => set('isAffiliate', v)}
                    color="#F59E0B"
                />
                {form.isAffiliate && (
                    <View style={{ marginTop: 8 }}>
                        <Inp label="Affiliate Redirect URL" field="affiliateLink" form={form} onSet={onSet} placeholder="https://external-store.com/item" />
                    </View>
                )}
            </View>
        </View>
    );

    const renderVariants = () => (
        <View style={SS.tabContent}>
            {/* Card 1: Quick Generators */}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Quick Variant Generator</Text>
                <Text style={SS.cardSub}>Tap any option below to instantly add it to your product variants</Text>

                {/* Color swatches */}
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>1. Colors:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, alignItems: 'center' }}>
                        {COLOR_PRESETS.map(c => (
                            <TouchableOpacity
                                key={c.name}
                                onPress={() => {
                                    const baseSku = form.sku || 'PRD';
                                    const newVar = {
                                        name: c.name,
                                        price: form.price || '0',
                                        stock: form.stock || '10',
                                        sku: `${baseSku}-${c.name.substring(0, 3).toUpperCase()}`,
                                        color: c.hex,
                                        inStock: true
                                    };
                                    set('variants', [...(form.variants || []), newVar]);
                                }}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F8FAFC', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0' }}
                            >
                                <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.hex, borderWidth: 1, borderColor: c.border }} />
                                <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#1E293B' }}>{c.name}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Size Pills */}
                <View style={{ marginBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>2. Sizes:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {SIZE_PRESETS.map(s => (
                            <TouchableOpacity
                                key={s}
                                onPress={() => {
                                    const baseSku = form.sku || 'PRD';
                                    const newVar = {
                                        name: `Size ${s}`,
                                        price: form.price || '0',
                                        stock: form.stock || '10',
                                        sku: `${baseSku}-${s}`,
                                        inStock: true
                                    };
                                    set('variants', [...(form.variants || []), newVar]);
                                }}
                                style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                            >
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#334155' }}>{s}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>

                {/* Storage / Memory */}
                <View style={{ marginBottom: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#64748B', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>3. Storage / Capacity:</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
                        {STORAGE_PRESETS.map(cap => (
                            <TouchableOpacity
                                key={cap}
                                onPress={() => {
                                    const baseSku = form.sku || 'PRD';
                                    const newVar = {
                                        name: cap,
                                        price: form.price || '0',
                                        stock: form.stock || '10',
                                        sku: `${baseSku}-${cap}`,
                                        inStock: true
                                    };
                                    set('variants', [...(form.variants || []), newVar]);
                                }}
                                style={{ backgroundColor: '#EFF6FF', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: '#BFDBFE' }}
                            >
                                <Text style={{ fontSize: 11.5, fontWeight: '800', color: '#1D4ED8' }}>{cap}</Text>
                            </TouchableOpacity>
                        ))}
                    </ScrollView>
                </View>
            </View>

            {/* Card 2: Batch Actions Bar */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <TouchableOpacity
                    onPress={() => {
                        if (!form.price) return Alert.alert('Price Required', 'Enter base product price in Info tab first.');
                        const updated = (form.variants || []).map(v => ({ ...v, price: form.price }));
                        set('variants', updated);
                        Alert.alert('Synced ✅', `Updated price of ${updated.length} variants to ₦${form.price}`);
                    }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#ECFDF5', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#A7F3D0' }}
                >
                    <Ionicons name="flash" size={13} color="#059669" />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#059669' }}>Sync Price</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    onPress={() => {
                        const updated = (form.variants || []).map(v => ({ ...v, stock: form.stock || '10' }));
                        set('variants', updated);
                        Alert.alert('Synced ✅', `Updated stock of ${updated.length} variants to ${form.stock || '10'}`);
                    }}
                    style={{ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, backgroundColor: '#EFF6FF', paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#BFDBFE' }}
                >
                    <Ionicons name="cube" size={13} color="#2563EB" />
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#2563EB' }}>Sync Stock</Text>
                </TouchableOpacity>

                {(form.variants || []).length > 0 && (
                    <TouchableOpacity
                        onPress={() => {
                            Alert.alert('Clear Variants', 'Are you sure you want to remove all variants?', [
                                { text: 'Cancel', style: 'cancel' },
                                { text: 'Clear All', style: 'destructive', onPress: () => set('variants', []) }
                            ]);
                        }}
                        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: '#FECACA' }}
                    >
                        <Ionicons name="trash-outline" size={13} color="#DC2626" />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#DC2626' }}>Clear</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Card 3: Variants List */}
            {(form.variants || []).length === 0 ? (
                <View style={[SS.card, { alignItems: 'center', paddingVertical: 28 }]}>
                    <Ionicons name="layers-outline" size={36} color="#94A3B8" />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#334155', marginTop: 10 }}>No Variants Created</Text>
                    <Text style={{ fontSize: 12, color: '#64748B', textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>
                        Tap any quick color, size, or storage option above, or tap the button below to add custom variations.
                    </Text>
                </View>
            ) : (
                (form.variants || []).map((v, i) => (
                    <View key={i} style={[SS.card, { padding: 12, marginBottom: 8 }]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <View style={{ backgroundColor: '#0E1A2E', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 }}>
                                    <Text style={{ color: '#D9A73A', fontSize: 10, fontWeight: '900' }}>#{i + 1}</Text>
                                </View>
                                {v.color && (
                                    <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: v.color, borderWidth: 1, borderColor: '#CBD5E1' }} />
                                )}
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#0E1A2E' }}>
                                    {v.name || `Variant #${i + 1}`}
                                </Text>
                            </View>
                            <TouchableOpacity
                                onPress={() => set('variants', form.variants.filter((_, idx) => idx !== i))}
                                style={{ width: 28, height: 28, borderRadius: 8, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' }}
                            >
                                <Ionicons name="trash-outline" size={14} color="#EF4444" />
                            </TouchableOpacity>
                        </View>

                        {/* Option name input */}
                        <View style={{ marginBottom: 8 }}>
                            <Text style={SS.inpLabel}>Option Name (e.g. Midnight Black / 128GB)</Text>
                            <TextInput
                                placeholder="Option Name"
                                value={v.name}
                                onChangeText={t => { const a = [...form.variants]; a[i].name = t; set('variants', a); }}
                                style={[SS.inpBox, { height: 38, fontSize: 12 }]}
                                placeholderTextColor="#94A3B8"
                            />
                        </View>

                        {/* 3 columns: SKU, Price, Stock */}
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <View style={{ flex: 1.2 }}>
                                <Text style={SS.inpLabel}>SKU</Text>
                                <TextInput
                                    placeholder="SKU"
                                    value={v.sku}
                                    onChangeText={t => { const a = [...form.variants]; a[i].sku = t; set('variants', a); }}
                                    style={[SS.inpBox, { height: 38, fontSize: 12 }]}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={SS.inpLabel}>Price (₦)</Text>
                                <TextInput
                                    placeholder="Price"
                                    value={v.price?.toString()}
                                    keyboardType="numeric"
                                    onChangeText={t => { const a = [...form.variants]; a[i].price = t; set('variants', a); }}
                                    style={[SS.inpBox, { height: 38, fontSize: 12 }]}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                            <View style={{ flex: 0.8 }}>
                                <Text style={SS.inpLabel}>Stock</Text>
                                <TextInput
                                    placeholder="Qty"
                                    value={v.stock?.toString()}
                                    keyboardType="numeric"
                                    onChangeText={t => { const a = [...form.variants]; a[i].stock = t; set('variants', a); }}
                                    style={[SS.inpBox, { height: 38, fontSize: 12 }]}
                                    placeholderTextColor="#94A3B8"
                                />
                            </View>
                        </View>
                    </View>
                ))
            )}

            {/* Add Custom Variant Button */}
            <TouchableOpacity
                onPress={() => set('variants', [...(form.variants || []), { name: '', price: form.price || '', stock: form.stock || '10', sku: `${form.sku || 'PRD'}-${(form.variants || []).length + 1}` }])}
                style={[SS.addRowBtn, { justifyContent: 'center', backgroundColor: '#0E1A2E', borderRadius: 12, paddingVertical: 11, marginTop: 4 }]}
            >
                <Ionicons name="add-circle" size={18} color="#D9A73A" />
                <Text style={[SS.addRowTxt, { color: '#D9A73A', fontSize: 13 }]}>+ Add Custom Variant</Text>
            </TouchableOpacity>
        </View>
    );

    const renderAdvanced = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Inventory Control</Text>
                <Inp label="Low Stock Alert Threshold" field="lowStockThreshold" form={form} onSet={onSet} placeholder="5" numeric
                    hint="Notify admin when stock falls below this level" />
                <Inp label="Max Quantity Per Order" field="maxQuantity" form={form} onSet={onSet} placeholder="e.g. 10" numeric
                    hint="Leave blank for unlimited" />
                <ToggleRow label="Allow Backorders" desc="Continue selling when stock hits zero"
                    icon="repeat" value={form.allowBackorders} onChange={v => set('allowBackorders', v)} color="#F59E0B" />
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Tax Class</Text>
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    {['standard', 'reduced', 'zero'].map(tc => (
                        <TouchableOpacity key={tc} onPress={() => set('taxClass', tc)}
                            style={[SS.taxChip, form.taxClass === tc && SS.taxChipActive]}>
                            <Text style={[SS.taxChipTxt, form.taxClass === tc && SS.taxChipTxtActive]}>{tc}</Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        </View>
    );

    const renderSEO = () => (
        <View style={SS.tabContent}>
            {!form.isDigital && (
                <View style={SS.card}>
                    <Inp label="Shipping Weight (kg)" field="weight" form={form} onSet={onSet} placeholder="0.5" numeric />
                </View>
            )}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>SEO Optimization</Text>
                <Inp label="SEO Title" field="seoTitle" form={form} onSet={onSet} placeholder="Optimized title for Google..." />
                <Inp label="SEO Description" field="seoDesc" form={form} onSet={onSet}
                    placeholder="Meta description for search results..." multi hint="Ideal: 150–160 characters" />
                <Inp label="Keywords (comma separated)" field="keywords" form={form} onSet={onSet}
                    placeholder="wireless, earbuds, bluetooth..." multi />
                <Inp label="Product Tags" field="tags" form={form} onSet={onSet} placeholder="Electronics, New Arrival, Sale" />
                <TouchableOpacity onPress={() => handleAI('seo')} style={SS.aiBtnFull}>
                    {aiLoading ? <ActivityIndicator size="small" color="#8B5CF6" />
                               : <Ionicons name="sparkles" size={16} color="#8B5CF6" />}
                    <Text style={SS.aiBtnTxt}>Auto-generate SEO with Gemini AI ✨</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderContent = () => {
        switch (activeTab) {
            case 'vital':    return renderVital();
            case 'offer':    return renderOffer();
            case 'images':   return renderMedia();
            case 'details':  return renderDetails();
            case 'variants': return renderVariants();
            case 'advanced': return renderAdvanced();
            case 'shipping': return renderSEO();
            default:         return null;
        }
    };

    // ── Vendor Modal Filter ────────────────────────────────────
    const filteredVendors = vendors.filter(v =>
        v.full_name?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.email?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.storeName?.toLowerCase().includes(vendorSearch.toLowerCase())
    );

    // ── Vendor Picker Modal ────────────────────────────────────
    const VendorModal = () => (
        <Modal visible={showVendorModal} transparent animationType="slide" onRequestClose={() => setShowVendorModal(false)}>
            <View style={{ flex: 1, backgroundColor: '#00000066', justifyContent: 'flex-end' }}>
                <View style={{ backgroundColor: 'white', borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: '75%', padding: 20 }}>
                    <Text style={[SS.cardTitle, { marginBottom: 14 }]}>Select Vendor / Admin</Text>
                    <View style={SS.vendorSearchRow}>
                        <Ionicons name="search" size={16} color="#94A3B8" />
                        <TextInput placeholder="Search name or email…" placeholderTextColor="#94A3B8"
                            value={vendorSearch} onChangeText={setVendorSearch}
                            style={{ flex: 1, marginLeft: 8, fontSize: 14, fontWeight: '600', color: '#0F172A' }} />
                    </View>
                    <FlatList data={filteredVendors} keyExtractor={i => i.id} style={{ marginTop: 10 }}
                        renderItem={({ item }) => (
                            <TouchableOpacity onPress={() => { setSelectedVendor(item); setShowVendorModal(false); setVendorSearch(''); }}
                                style={[SS.vendorItem, selectedVendor?.id === item.id && { backgroundColor: '#EEF2FF' }]}>
                                <View style={[SS.vendorAvatar, { backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }]}>
                                    {item.storeLogo || item.avatar_url
                                        ? <Image source={{ uri: item.storeLogo || item.avatar_url }} style={SS.vendorAvatar} />
                                        : <Ionicons name="storefront" size={18} color="#6366F1" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={SS.vendorName}>{item.storeName ? `${item.storeName} (${item.full_name})` : (item.full_name || 'No name')}</Text>
                                    <Text style={SS.vendorEmail}>{item.email}</Text>
                                </View>
                                <View style={[SS.roleBadge, { backgroundColor: item.role === 'admin' ? '#FEF3C7' : '#EEF2FF' }]}>
                                    <Text style={{ fontSize: 10, fontWeight: '700', color: item.role === 'admin' ? '#92400E' : '#4F46E5' }}>
                                        {item.role?.toUpperCase()}
                                    </Text>
                                </View>
                            </TouchableOpacity>
                        )}
                    />
                    <TouchableOpacity onPress={() => setShowVendorModal(false)}
                        style={{ marginTop: 16, paddingVertical: 16, backgroundColor: '#F1F5F9', borderRadius: 16, alignItems: 'center' }}>
                        <Text style={{ fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                    </TouchableOpacity>
                </View>
            </View>
        </Modal>
    );

    // ── Main Render ────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="light-content" backgroundColor={NAVY} />

            {/* Navy Header */}
            <LinearGradient
                colors={[NAVY, '#162235']}
                start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                style={[SS.header, { paddingTop: SB_H + 6 }]}
            >
                <TouchableOpacity onPress={onCancel} style={SS.iconBtn}>
                    <Ionicons name="arrow-back" size={18} color={GOLD} />
                </TouchableOpacity>

                <View style={{ flex: 1, marginHorizontal: 12 }}>
                    <Text style={SS.headerTitle}>{isEditing ? '✏️ Edit Product' : '+ New Product'}</Text>
                    <Text style={SS.headerSub}>{isEditing ? 'Modify product details' : 'Create a new listing'}</Text>
                </View>

                {isEditing && (
                    <TouchableOpacity onPress={handleDeleteProduct} disabled={loading}
                        style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(239, 68, 68, 0.15)', alignItems: 'center', justifyContent: 'center', marginRight: 8, borderWidth: 1, borderColor: 'rgba(239, 68, 68, 0.3)' }}>
                        <Ionicons name="trash-outline" size={15} color="#F87171" />
                    </TouchableOpacity>
                )}

                <Animated.View style={{ transform: [{ scale: saveAnim }] }}>
                    <TouchableOpacity onPress={handleSubmit} disabled={loading}
                        style={[SS.saveBtn, loading && { backgroundColor: '#94A3B8' }]}>
                        {loading
                            ? <ActivityIndicator size="small" color="white" />
                            : <><Ionicons name="cloud-upload" size={13} color={GOLD} /><Text style={SS.saveBtnTxt}>{isEditing ? 'Update' : 'Publish'}</Text></>
                        }
                    </TouchableOpacity>
                </Animated.View>
            </LinearGradient>

            {/* Tabs */}
            <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
                    {TABS.map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)}
                                style={[SS.tabChip, active && SS.tabChipActive]}>
                                <Ionicons name={tab.icon} size={14} color={active ? '#D9A73A' : '#94A3B8'} />
                                <Text style={[SS.tabTxt, active && SS.tabTxtActive]}>{tab.label}</Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Body */}
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 100 }}
                showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
                {renderContent()}
            </ScrollView>

            {/* Loading overlay */}
            {loading && (
                <View style={SS.loadingOverlay}>
                    <View style={SS.loadingBox}>
                        <ActivityIndicator size="large" color="#0E1A2E" />
                        <Text style={SS.loadingTxt}>{isEditing ? 'Updating...' : 'Creating Product...'}</Text>
                    </View>
                </View>
            )}

            <VendorModal />

            {/* ── IN-APP DELETE CONFIRMATION MODAL ── */}
            <Modal
                visible={showDeleteModal}
                transparent
                animationType="fade"
                onRequestClose={() => !deleting && setShowDeleteModal(false)}
            >
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
                    <View style={{ width: '100%', maxWidth: 360, backgroundColor: '#FFFFFF', borderRadius: 18, padding: 22, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8 }}>
                        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                            <Ionicons name="trash" size={26} color="#DC2626" />
                        </View>
                        <Text style={{ fontSize: 17, fontWeight: '900', color: '#0F172A', marginBottom: 8 }}>Delete Product</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', textAlign: 'center', lineHeight: 18, marginBottom: 20 }}>
                            Are you sure you want to permanently delete <Text style={{ fontWeight: '800', color: '#0F172A' }}>"{form.name}"</Text>? This action cannot be undone.
                        </Text>
                        <View style={{ flexDirection: 'row', gap: 10, width: '100%' }}>
                            <TouchableOpacity
                                disabled={deleting}
                                onPress={() => setShowDeleteModal(false)}
                                style={{ flex: 1, paddingVertical: 11, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}
                            >
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                disabled={deleting}
                                onPress={confirmDeleteProduct}
                                style={{ flex: 1.2, paddingVertical: 11, borderRadius: 10, backgroundColor: '#DC2626', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                            >
                                {deleting ? (
                                    <ActivityIndicator size="small" color="#FFFFFF" />
                                ) : (
                                    <>
                                        <Ionicons name="trash-outline" size={14} color="#FFFFFF" />
                                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#FFFFFF' }}>Delete Now</Text>
                                    </>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const SS = StyleSheet.create({
    header:       { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 12, borderBottomWidth: 1, borderColor: 'rgba(217,167,58,0.2)' },
    iconBtn:      { width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.09)', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)' },
    headerTitle:  { fontSize: 16, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.3 },
    headerSub:    { fontSize: 10.5, color: 'rgba(255,255,255,0.45)', marginTop: 1 },
    saveBtn:      { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: 'rgba(217,167,58,0.15)', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 11, borderWidth: 1, borderColor: GOLD },
    saveBtnTxt:   { color: GOLD, fontWeight: '800', fontSize: 12 },
    tabChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: 'transparent' },
    tabChipActive:{ backgroundColor: '#0E1A2E', borderColor: '#D9A73A' },
    tabTxt:       { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
    tabTxtActive: { color: '#D9A73A', fontWeight: '800' },
    tabContent:   { padding: 12 },
    card:         { backgroundColor: 'white', borderRadius: 16, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 6, elevation: 1 },
    cardTitle:    { fontSize: 13, fontWeight: '900', color: '#0E1A2E', marginBottom: 10, letterSpacing: -0.2 },
    cardSub:      { fontSize: 11.5, color: '#64748B', marginTop: -8, marginBottom: 10 },
    inpWrap:      { marginBottom: 10 },
    inpLabel:     { fontSize: 10, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 5 },
    inpBox:       { backgroundColor: '#F8FAFC', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: '600', color: '#0E1A2E', borderWidth: 1, borderColor: '#E2E8F0' },
    inpHint:      { fontSize: 10.5, color: '#94A3B8', marginTop: 4 },
    toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC', marginBottom: 8 },
    toggleIcon:   { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    toggleLabel:  { fontSize: 13, fontWeight: '800', color: '#0E1A2E' },
    toggleDesc:   { fontSize: 11, color: '#64748B', marginTop: 1 },
    catChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0', marginRight: 4 },
    catLabel:     { fontSize: 13, fontWeight: '700', color: '#475569' },
    aiBtnRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, marginTop: 4, borderWidth: 1, borderColor: '#FDE68A' },
    aiBtnFull:    { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#FFFBEB', padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A' },
    aiBtnTxt:     { color: '#B45309', fontWeight: '800', fontSize: 13 },
    imagePicker:  { height: 120, borderWidth: 2, borderColor: '#D9A73A', borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFFBEB', gap: 6 },
    imagePickerTxt:{ color: '#B45309', fontWeight: '700', fontSize: 14 },
    imagePickerSub:{ color: '#94A3B8', fontSize: 12 },
    removeImgBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 4 },
    primaryBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#0E1A2E', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2, borderWidth: 1, borderColor: '#D9A73A' },
    addRowBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    addRowTxt:    { color: '#0E1A2E', fontWeight: '700', fontSize: 14 },
    deleteBtn:    { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
    variantRow:   { borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    taxChip:      { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    taxChipActive:{ backgroundColor: '#FFFBEB', borderColor: '#D9A73A' },
    taxChipTxt:   { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
    taxChipTxtActive: { color: '#B45309' },
    vendorPicker: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    vendorAvatar: { width: 44, height: 44, borderRadius: 12 },
    vendorName:   { fontSize: 14, fontWeight: '700', color: '#0E1A2E' },
    vendorEmail:  { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    vendorSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: '#E2E8F0' },
    vendorItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#F1F5F9', borderRadius: 12 },
    roleBadge:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
    loadingBox:   { alignItems: 'center', gap: 12 },
    loadingTxt:   { fontSize: 15, fontWeight: '700', color: '#0E1A2E' },
});
