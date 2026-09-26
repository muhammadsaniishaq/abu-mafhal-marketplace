import React, { useState, useRef, useCallback } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, Image,
    ActivityIndicator, Alert, Switch, StatusBar, Platform,
    Animated, Dimensions, StyleSheet
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { geminiService } from '../services/geminiService';
import { parsePrice } from '../utils/helpers';

const { width: W } = Dimensions.get('window');

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
    { id: 'vital',    label: 'Info',     icon: 'information-circle' },
    { id: 'offer',    label: 'Pricing',  icon: 'pricetag' },
    { id: 'images',   label: 'Media',    icon: 'images' },
    { id: 'details',  label: 'Specs',    icon: 'list' },
    { id: 'variants', label: 'Variants', icon: 'layers' },
    { id: 'advanced', label: 'Advanced', icon: 'settings' },
    { id: 'seo',      label: 'SEO',      icon: 'search' },
];

// ─── Styles ───────────────────────────────────────────────────────────────────
const SS = StyleSheet.create({
    header:          { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    iconBtn:         { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    headerTitle:     { fontSize: 17, fontWeight: '900', color: '#0E1A2E', letterSpacing: -0.3 },
    headerSub:       { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    saveBtn:         { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#0E1A2E', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12, borderWidth: 1, borderColor: '#D9A73A' },
    saveBtnTxt:      { color: 'white', fontWeight: '800', fontSize: 13 },
    tabChip:         { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: 'transparent' },
    tabChipActive:   { backgroundColor: '#0E1A2E', borderColor: '#D9A73A' },
    tabTxt:          { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
    tabTxtActive:    { color: '#D9A73A', fontWeight: '800' },
    tabContent:      { padding: 16 },
    card:            { backgroundColor: 'white', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
    cardTitle:       { fontSize: 14, fontWeight: '900', color: '#0E1A2E', marginBottom: 14, letterSpacing: -0.2 },
    cardSub:         { fontSize: 12, color: '#64748B', marginTop: -10, marginBottom: 14 },
    inpWrap:         { marginBottom: 14 },
    inpLabel:        { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 },
    inpBox:          { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 13, fontSize: 14, fontWeight: '600', color: '#0E1A2E', borderWidth: 1, borderColor: '#E2E8F0' },
    inpHint:         { fontSize: 11, color: '#94A3B8', marginTop: 5 },
    toggleRow:       { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC', marginBottom: 10 },
    toggleIcon:      { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    toggleLabel:     { fontSize: 14, fontWeight: '800', color: '#0E1A2E' },
    toggleDesc:      { fontSize: 12, color: '#64748B', marginTop: 2 },
    catChip:         { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0', marginRight: 4 },
    catLabel:        { fontSize: 13, fontWeight: '700', color: '#475569' },
    aiAutoFillBtn:   { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#0E1A2E', padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: '#D9A73A' },
    aiAutoFillTxt:   { color: '#D9A73A', fontWeight: '900', fontSize: 13.5 },
    aiBtnRow:        { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, marginTop: 6, borderWidth: 1, borderColor: '#FDE68A' },
    aiBtnFull:       { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#FFFBEB', padding: 14, borderRadius: 14, marginBottom: 14, borderWidth: 1, borderColor: '#FDE68A' },
    aiBtnTxt:        { color: '#B45309', fontWeight: '800', fontSize: 13 },
    quickBtn:        { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#F1F5F9', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 10, alignSelf: 'flex-start', marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' },
    quickBtnTxt:     { fontSize: 12, fontWeight: '700', color: '#0E1A2E' },
    imagePickerRow:  { flexDirection: 'row', gap: 10, marginBottom: 12 },
    pickerActionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FFFBEB', paddingVertical: 14, borderRadius: 14, borderWidth: 1.5, borderColor: '#FDE68A' },
    pickerActionTxt: { fontSize: 13, fontWeight: '800', color: '#B45309' },
    removeImgBtn:    { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.65)', borderRadius: 10, padding: 4 },
    primaryBadge:    { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#0E1A2E', borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2, borderWidth: 1, borderColor: '#D9A73A' },
    addRowBtn:       { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    addRowTxt:       { color: '#0E1A2E', fontWeight: '700', fontSize: 14 },
    deleteBtn:       { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
    variantRow:      { borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    taxChip:         { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    taxChipActive:   { backgroundColor: '#FFFBEB', borderColor: '#D9A73A' },
    taxChipTxt:      { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
    taxChipTxtActive:{ color: '#B45309' },
    loadingOverlay:  { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
    loadingBox:      { alignItems: 'center', gap: 12, backgroundColor: 'white', padding: 24, borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
    loadingTxt:      { fontSize: 15, fontWeight: '800', color: '#0E1A2E' },
});

// ─── STABLE SUB-COMPONENTS ───
const Inp = React.memo(({ label, value, onChangeText, placeholder, numeric, multi, hint }) => (
    <View style={SS.inpWrap}>
        <Text style={SS.inpLabel}>{label}</Text>
        <TextInput
            style={[SS.inpBox, multi && { height: 96, textAlignVertical: 'top', paddingTop: 12 }]}
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            placeholderTextColor="#94A3B8"
            keyboardType={numeric ? 'numeric' : 'default'}
            multiline={multi}
        />
        {hint && <Text style={SS.inpHint}>{hint}</Text>}
    </View>
));

const ToggleRow = React.memo(({ label, desc, value, onChange, color = '#3B82F6', icon }) => (
    <TouchableOpacity activeOpacity={0.8} onPress={() => onChange(!value)}
        style={[SS.toggleRow, value && { backgroundColor: color + '12', borderColor: color + '44' }]}>
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
));

export const VendorAddProduct = ({ onCancel, onSuccess, initialData = null }) => {
    const insets = useSafeAreaInsets();
    const isEditing = !!initialData;

    const [activeTab,  setActiveTab]  = useState('vital');
    const [loading,    setLoading]    = useState(false);
    const [aiLoading,  setAiLoading]  = useState(false);
    const [images,     setImages]     = useState(
        initialData?.images?.map(uri => ({ uri, status: 'success', url: uri })) || []
    );
    const [video, setVideo] = useState(initialData?.metadata?.video || initialData?.video_url || null);

    const saveAnim = useRef(new Animated.Value(1)).current;

    const [form, setForm] = useState({
        name:              initialData?.name              || '',
        description:       initialData?.description       || '',
        category:          initialData?.category          || '',
        brand:             initialData?.brand             || '',
        price:             initialData?.price?.toString() || '',
        originalPrice:     (initialData?.compare_at_price || initialData?.original_price)?.toString() || '',
        cost:              initialData?.cost?.toString()  || '',
        stock:             (initialData?.stock_quantity ?? initialData?.stock)?.toString() || '',
        sku:               initialData?.sku               || '',
        status:            initialData?.status            || 'approved',
        barcode:           initialData?.metadata?.barcode || '',
        specifications:    initialData?.metadata?.specifications || [{ key: '', value: '' }],
        variants:          initialData?.metadata?.variants  || [],
        isAffiliate:       initialData?.is_affiliate      || false,
        affiliateLink:     initialData?.affiliate_link    || '',
        weight:            initialData?.shipping_weight?.toString() || '',
        seoTitle:          initialData?.seo_title         || '',
        seoDesc:           initialData?.seo_description   || '',
        keywords:          initialData?.metadata?.keywords || '',
        tags:              (initialData?.tags || []).join(', '),
        saleStart:         initialData?.metadata?.sale_start_date || '',
        saleEnd:           initialData?.metadata?.sale_end_date   || '',
        isDigital:         initialData?.metadata?.is_digital      || false,
        lowStockThreshold: initialData?.metadata?.low_stock_threshold?.toString() || '5',
        allowBackorders:   initialData?.metadata?.allow_backorders || false,
        taxClass:          initialData?.metadata?.tax_class        || 'standard',
        maxQuantity:       initialData?.metadata?.max_quantity?.toString() || '',
        freeShipping:      initialData?.free_shipping     || false,
    });

    const set = useCallback((key, val) => {
        setForm(p => ({ ...p, [key]: val }));
    }, []);

    // ── Quick Helpers ──────────────────────────────────────────
    const handleAutoGenerateSkuBarcode = () => {
        const catClean = (form.category || 'ITEM').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4) || 'PROD';
        const randNum = Math.floor(1000 + Math.random() * 9000);
        const autoSku = `AM-${catClean}-${randNum}`;
        const autoBarcode = `200${Math.floor(1000000000 + Math.random() * 9000000000)}`;
        set('sku', autoSku);
        set('barcode', autoBarcode);
        Alert.alert('Auto-Generated ⚡', `SKU: ${autoSku}\nBarcode: ${autoBarcode}`);
    };

    // ── 100% Reliable Image Helpers (Web & Native) ─────────────
    const processAssets = async (assets) => {
        if (!assets || assets.length === 0) return [];

        return Promise.all(assets.map(async (a) => {
            let b64 = a.base64;
            // On Web or if base64 is missing, convert via fetch to base64
            if (!b64 && a.uri) {
                try {
                    const resp = await fetch(a.uri);
                    const blob = await resp.blob();
                    b64 = await new Promise((resolve) => {
                        const reader = new FileReader();
                        reader.onloadend = () => {
                            const dataUrl = reader.result;
                            if (typeof dataUrl === 'string') {
                                resolve(dataUrl.split(',')[1] || null);
                            } else {
                                resolve(null);
                            }
                        };
                        reader.onerror = () => resolve(null);
                        reader.readAsDataURL(blob);
                    });
                } catch (_) {}
            }
            return {
                uri: a.uri,
                base64: b64,
                type: a.mimeType || 'image/jpeg',
                status: 'pending'
            };
        }));
    };

    const pickImage = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Permission Required', 'Please allow gallery access to select product images.');
                    return;
                }
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsMultipleSelection: true,
                quality: 0.8,
                base64: true
            });

            if (!result.canceled && result.assets) {
                const processed = await processAssets(result.assets);
                setImages(prev => [...prev, ...processed]);
            }
        } catch (e) {
            console.error('Gallery picker error:', e);
            Alert.alert('Image Error', 'Failed to pick image from gallery.');
        }
    };

    const takePhoto = async () => {
        try {
            if (Platform.OS !== 'web') {
                const { status } = await ImagePicker.requestCameraPermissionsAsync();
                if (status !== 'granted') {
                    Alert.alert('Camera Permission Required', 'Please allow camera access to take product photos.');
                    return;
                }
            }

            const result = await ImagePicker.launchCameraAsync({
                quality: 0.8,
                base64: true
            });

            if (!result.canceled && result.assets) {
                const processed = await processAssets(result.assets);
                setImages(prev => [...prev, ...processed]);
            }
        } catch (e) {
            console.error('Camera error:', e);
            Alert.alert('Camera Error', 'Could not open camera.');
        }
    };

    const pickVideo = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Videos, quality: 0.5
            });
            if (!result.canceled && result.assets?.[0]?.uri) {
                setVideo(result.assets[0].uri);
            }
        } catch (_) {}
    };

    const uploadImages = async () => {
        const urls = [];
        for (let i = 0; i < images.length; i++) {
            const img = images[i];
            if (img.status === 'success' && img.url) {
                urls.push(img.url);
                continue;
            }
            if (typeof img === 'string' && img.startsWith('http')) {
                urls.push(img);
                continue;
            }

            const fname = `vendor_${Date.now()}_${i}_${Math.random().toString(36).substring(2, 7)}.jpg`;
            let publicUrl = null;

            // Strategy 1: Web native Blob upload (100% reliable in browsers)
            if (Platform.OS === 'web' && img.uri) {
                try {
                    const resp = await fetch(img.uri);
                    const blob = await resp.blob();
                    const { error } = await supabase.storage.from('products')
                        .upload(fname, blob, { contentType: blob.type || 'image/jpeg', upsert: true });
                    if (!error) {
                        publicUrl = supabase.storage.from('products').getPublicUrl(fname).data.publicUrl;
                    }
                } catch (e) {
                    console.warn('Web blob upload error:', e);
                }
            }

            // Strategy 2: Base64 decode upload
            if (!publicUrl && img.base64) {
                try {
                    const { error } = await supabase.storage.from('products')
                        .upload(fname, decode(img.base64), { contentType: 'image/jpeg', upsert: true });
                    if (!error) {
                        publicUrl = supabase.storage.from('products').getPublicUrl(fname).data.publicUrl;
                    }
                } catch (e) {
                    console.warn('Base64 decode upload error:', e);
                }
            }

            // Strategy 3: Native Mobile FileSystem upload
            if (!publicUrl && img.uri && Platform.OS !== 'web') {
                try {
                    const b64 = await FileSystem.readAsStringAsync(img.uri, { encoding: 'base64' });
                    const { error } = await supabase.storage.from('products')
                        .upload(fname, decode(b64), { contentType: 'image/jpeg', upsert: true });
                    if (!error) {
                        publicUrl = supabase.storage.from('products').getPublicUrl(fname).data.publicUrl;
                    }
                } catch (e) {
                    console.warn('Native FileSystem upload error:', e);
                }
            }

            // Strategy 4: Fallback bucket
            if (!publicUrl) {
                try {
                    let fallbackData = null;
                    if (Platform.OS === 'web' && img.uri) {
                        const r = await fetch(img.uri);
                        fallbackData = await r.blob();
                    } else if (img.base64) {
                        fallbackData = decode(img.base64);
                    }
                    if (fallbackData) {
                        const { error } = await supabase.storage.from('banners')
                            .upload(fname, fallbackData, { contentType: 'image/jpeg', upsert: true });
                        if (!error) {
                            publicUrl = supabase.storage.from('banners').getPublicUrl(fname).data.publicUrl;
                        }
                    }
                } catch (_) {}
            }

            if (publicUrl) {
                urls.push(publicUrl);
            } else if (img.uri && img.uri.startsWith('http')) {
                urls.push(img.uri);
            }
        }
        return urls;
    };

    const uploadVideo = async () => {
        if (!video || video.startsWith('http')) return video || null;
        try {
            const fname = `video_vendor_${Date.now()}.mp4`;
            if (Platform.OS === 'web') {
                const response = await fetch(video);
                const blob = await response.blob();
                const { error } = await supabase.storage.from('products')
                    .upload(fname, blob, { contentType: 'video/mp4', upsert: true });
                if (error) return null;
                return supabase.storage.from('products').getPublicUrl(fname).data.publicUrl;
            } else {
                const info = await FileSystem.getInfoAsync(video);
                if (!info.exists) return null;
                const b64 = await FileSystem.readAsStringAsync(video, { encoding: 'base64' });
                const { error } = await supabase.storage.from('products')
                    .upload(fname, decode(b64), { contentType: 'video/mp4', upsert: true });
                if (error) return null;
                return supabase.storage.from('products').getPublicUrl(fname).data.publicUrl;
            }
        } catch (_) {
            return null;
        }
    };

    // ── Supercharged AI (AI Tana Aiki Sosai) ───────────────────
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
                    Alert.alert('Gemini AI ✨', 'Compelling product description generated successfully!');
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
                    Alert.alert('Gemini AI ✨', 'SEO Title, Meta Description & Keywords optimized!');
                }
            } else if (type === 'specs') {
                const suggested = await geminiService.suggestSpecs(form);
                if (suggested && suggested.length > 0) {
                    setForm(p => ({
                        ...p,
                        specifications: suggested
                    }));
                    Alert.alert('Gemini AI ✨', `Auto-suggested ${suggested.length} accurate specifications!`);
                }
            } else if (type === 'all') {
                const res = await geminiService.autoFillListing(form);
                if (res) {
                    setForm(p => ({
                        ...p,
                        description: res.description || p.description,
                        seoTitle: res.seoTitle || p.seoTitle,
                        seoDesc: res.seoDesc || p.seoDesc,
                        keywords: res.keywords || p.keywords,
                        specifications: res.specifications || p.specifications
                    }));
                    handleAutoGenerateSkuBarcode();
                    Alert.alert('Gemini AI Power ✨', 'Whole listing auto-filled with Description, Specifications, SEO, and SKU/Barcode!');
                }
            }
        } catch (e) {
            Alert.alert('AI Notice', e.message || 'AI service temporarily unavailable. Default templates applied.');
        } finally {
            setAiLoading(false);
        }
    };

    // ── Submit ─────────────────────────────────────────────────
    const handleSubmit = async () => {
        const missing = [];
        if (!form.name || !form.name.trim()) missing.push('Product Name');
        if (!form.price) missing.push('Selling Price');
        if (!form.description || !form.description.trim()) missing.push('Description');
        if (missing.length) return Alert.alert('Required Fields Missing', missing.join(', '));

        const p = parseFloat(form.price.replace(/,/g, ''));
        if (p > 10_000_000) {
            const ok = await new Promise(r => Alert.alert(
                'High Price ⚠️', `You entered ₦${p.toLocaleString()}. Is this correct?`,
                [{ text: 'No, fix it', style: 'cancel', onPress: () => r(false) },
                 { text: 'Yes, save',  onPress: () => r(true) }]
            ));
            if (!ok) return;
        }

        Animated.sequence([
            Animated.spring(saveAnim, { toValue: 0.92, useNativeDriver: true }),
            Animated.spring(saveAnim, { toValue: 1,    useNativeDriver: true }),
        ]).start();

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('Session expired. Please login again.');

            const [imageUrls, videoUrl] = await Promise.all([uploadImages(), uploadVideo()]);

            const payload = {
                vendor_id:        user.id,
                name:             form.name,
                description:      form.description,
                category:         form.category || 'General',
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
                    video:               videoUrl,
                    is_digital:          form.isDigital,
                    low_stock_threshold: parseInt(form.lowStockThreshold) || 5,
                    allow_backorders:    form.allowBackorders,
                    tax_class:           form.taxClass,
                    max_quantity:        parseInt(form.maxQuantity) || null,
                    sale_start_date:     form.saleStart || null,
                    sale_end_date:       form.saleEnd   || null,
                }
            };

            const { error } = isEditing
                ? await supabase.from('products').update(payload).eq('id', initialData.id)
                : await supabase.from('products').insert(payload);

            if (error) throw error;
            Alert.alert('Success ✅', `Product ${isEditing ? 'updated' : 'listed'} successfully!`);
            onSuccess();
        } catch (e) {
            Alert.alert('Error ❌', e.message);
        } finally {
            setLoading(false);
        }
    };

    // ── Photo Grid Component ───────────────────────────────────
    const renderPhotosSection = () => (
        <View style={SS.card}>
            <Text style={SS.cardTitle}>Product Images (Tap to Upload)</Text>
            <Text style={SS.cardSub}>Upload clear photos of your product from your camera or gallery.</Text>

            <View style={SS.imagePickerRow}>
                <TouchableOpacity onPress={pickImage} style={SS.pickerActionBtn} activeOpacity={0.8}>
                    <Ionicons name="images" size={20} color="#D9A73A" />
                    <Text style={SS.pickerActionTxt}>Gallery</Text>
                </TouchableOpacity>

                <TouchableOpacity onPress={takePhoto} style={SS.pickerActionBtn} activeOpacity={0.8}>
                    <Ionicons name="camera" size={20} color="#059669" />
                    <Text style={[SS.pickerActionTxt, { color: '#059669' }]}>Take Photo</Text>
                </TouchableOpacity>
            </View>

            {images.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 4 }}>
                    {images.map((img, i) => (
                        <View key={i} style={{ width: (W - 80) / 3, aspectRatio: 1, borderRadius: 12, overflow: 'hidden', borderWidth: 1, borderColor: '#E2E8F0' }}>
                            <Image source={{ uri: img.uri || img.url }} style={{ width: '100%', height: '100%' }} />
                            <TouchableOpacity onPress={() => setImages(images.filter((_, idx) => idx !== i))}
                                style={SS.removeImgBtn}>
                                <Ionicons name="close" size={13} color="white" />
                            </TouchableOpacity>
                            {i === 0 && (
                                <View style={SS.primaryBadge}>
                                    <Text style={{ color: 'white', fontSize: 8, fontWeight: '800' }}>MAIN</Text>
                                </View>
                            )}
                        </View>
                    ))}
                </View>
            ) : (
                <View style={{ alignItems: 'center', paddingVertical: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed' }}>
                    <Ionicons name="cloud-upload-outline" size={28} color="#94A3B8" />
                    <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '700', marginTop: 4 }}>No images selected yet</Text>
                    <Text style={{ fontSize: 11, color: '#94A3B8' }}>Select up to 10 photos</Text>
                </View>
            )}
        </View>
    );

    // ── Tab Renderers ──────────────────────────────────────────
    const renderVital = () => (
        <View style={SS.tabContent}>
            {/* 1-Click Supercharged AI Button */}
            <TouchableOpacity onPress={() => handleAI('all')} style={SS.aiAutoFillBtn} activeOpacity={0.85} disabled={aiLoading}>
                {aiLoading ? <ActivityIndicator size="small" color="#D9A73A" />
                           : <Ionicons name="sparkles" size={18} color="#D9A73A" />}
                <Text style={SS.aiAutoFillTxt}>1-Click Auto-Fill Listing with Gemini AI ⚡</Text>
            </TouchableOpacity>

            <View style={SS.card}>
                <ToggleRow label="Digital Product" desc="No physical shipping needed (e.g. E-books, Software, Services)"
                    icon="cloud-download" value={form.isDigital} onChange={v => set('isDigital', v)} color="#8B5CF6" />
            </View>

            <View style={SS.card}>
                <Inp label="Product Name *" value={form.name} onChangeText={v => set('name', v)} placeholder="e.g. Sony WH-1000XM5 Wireless Headphones" />
                <Inp label="Brand" value={form.brand} onChangeText={v => set('brand', v)} placeholder="e.g. Sony, Samsung, Apple, Nike" />
            </View>

            {/* Embedded Photo Section right on Tab 1 for immediate visibility */}
            {renderPhotosSection()}

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingTop: 4 }}>
                    {CATEGORIES.map(cat => (
                        <TouchableOpacity key={cat.label} onPress={() => set('category', cat.label)}
                            style={[SS.catChip, form.category === cat.label && { backgroundColor: cat.color, borderColor: cat.color }]}>
                            <Ionicons name={cat.icon} size={14} color={form.category === cat.label ? 'white' : cat.color} />
                            <Text style={[SS.catLabel, form.category === cat.label && { color: 'white' }]}>{cat.label}</Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <View style={SS.card}>
                <Inp label="Description *" value={form.description} onChangeText={v => set('description', v)} placeholder="Describe the product in detail..." multi
                    hint="A detailed, persuasive description increases your conversion rate." />
                <TouchableOpacity onPress={() => handleAI('description')} style={SS.aiBtnRow} disabled={aiLoading}>
                    {aiLoading ? <ActivityIndicator size="small" color="#8B5CF6" />
                               : <Ionicons name="sparkles" size={16} color="#8B5CF6" />}
                    <Text style={SS.aiBtnTxt}>Generate Compelling Description with AI ✨</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderOffer = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Pricing & Stock</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Inp label="Selling Price (₦) *" value={form.price} onChangeText={v => set('price', v)} placeholder="0.00" numeric />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Inp label="Original Price (₦)" value={form.originalPrice} onChangeText={v => set('originalPrice', v)} placeholder="0.00" numeric />
                    </View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Inp label="Cost Price (private)" value={form.cost} onChangeText={v => set('cost', v)} placeholder="0.00" numeric />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Inp label="Stock Quantity" value={form.stock} onChangeText={v => set('stock', v)} placeholder="0" numeric />
                    </View>
                </View>

                {/* Quick Auto-generate SKU & Barcode Feature */}
                <TouchableOpacity onPress={handleAutoGenerateSkuBarcode} style={SS.quickBtn} activeOpacity={0.8}>
                    <Ionicons name="flash" size={14} color="#D9A73A" />
                    <Text style={SS.quickBtnTxt}>Auto-Generate SKU & Barcode ⚡</Text>
                </TouchableOpacity>

                <Inp label="SKU" value={form.sku} onChangeText={v => set('sku', v)} placeholder="PROD-001" hint="Unique product identifier for your store" />
                <Inp label="Barcode / GTIN" value={form.barcode} onChangeText={v => set('barcode', v)} placeholder="EAN-13 or UPC barcode" />
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Free Shipping</Text>
                <ToggleRow label="Enable Free Shipping"
                    desc={form.freeShipping ? 'Customers pay ₦0 shipping on this item' : 'Standard platform shipping fee applies'}
                    icon="airplane" value={form.freeShipping}
                    onChange={v => set('freeShipping', v)} color="#10B981" />
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Sale Window (Optional)</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                        <Inp label="Start Date (YYYY-MM-DD)" value={form.saleStart} onChangeText={v => set('saleStart', v)} placeholder="2025-01-01" />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Inp label="End Date (YYYY-MM-DD)" value={form.saleEnd} onChangeText={v => set('saleEnd', v)} placeholder="2025-12-31" />
                    </View>
                </View>
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Listing Status</Text>
                <ToggleRow label="Published"
                    desc={form.status === 'approved' ? 'Visible to all shoppers on Marketplace' : 'Hidden — saved as draft in your store'}
                    icon="eye" value={form.status === 'approved'}
                    onChange={v => set('status', v ? 'approved' : 'draft')} color="#3B82F6" />
            </View>
        </View>
    );

    const renderMedia = () => (
        <View style={SS.tabContent}>
            {renderPhotosSection()}

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Product Video (Optional)</Text>
                <TouchableOpacity onPress={pickVideo} style={[SS.pickerActionBtn, { paddingVertical: 18 }]} activeOpacity={0.8}>
                    {video
                        ? <><Ionicons name="videocam" size={24} color="#10B981" /><Text style={[SS.pickerActionTxt, { color: '#10B981' }]}>Video Attached ✓</Text></>
                        : <><Ionicons name="videocam-outline" size={24} color="#6366F1" /><Text style={[SS.pickerActionTxt, { color: '#6366F1' }]}>Select Product Demo Video</Text></>
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

    const renderDetails = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={SS.cardTitle}>Specifications</Text>
                    <TouchableOpacity onPress={() => handleAI('specs')} disabled={aiLoading}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: '#FDE68A' }}>
                        <Ionicons name="sparkles" size={13} color="#B45309" />
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#B45309' }}>AI Specs ✨</Text>
                    </TouchableOpacity>
                </View>
                <Text style={SS.cardSub}>Add key features like Color, Material, Battery Life, Warranty, etc.</Text>
                {form.specifications.map((spec, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        <TextInput placeholder="Feature (e.g. Color)" value={spec.key}
                            onChangeText={t => { const a = [...form.specifications]; a[i].key = t; set('specifications', a); }}
                            style={[SS.inpBox, { flex: 1 }]} placeholderTextColor="#94A3B8" />
                        <TextInput placeholder="Value (e.g. Midnight Black)" value={spec.value}
                            onChangeText={t => { const a = [...form.specifications]; a[i].value = t; set('specifications', a); }}
                            style={[SS.inpBox, { flex: 1 }]} placeholderTextColor="#94A3B8" />
                        <TouchableOpacity onPress={() => set('specifications', form.specifications.filter((_, idx) => idx !== i))}
                            style={SS.deleteBtn}>
                            <Ionicons name="trash-outline" size={16} color="#EF4444" />
                        </TouchableOpacity>
                    </View>
                ))}
                <TouchableOpacity onPress={() => set('specifications', [...form.specifications, { key: '', value: '' }])}
                    style={SS.addRowBtn}>
                    <Ionicons name="add-circle" size={20} color="#3B82F6" />
                    <Text style={SS.addRowTxt}>Add Specification</Text>
                </TouchableOpacity>
            </View>

            <View style={SS.card}>
                <ToggleRow label="Affiliate Product" desc="Link to an external third-party product page"
                    icon="link" value={form.isAffiliate} onChange={v => set('isAffiliate', v)} color="#F59E0B" />
                {form.isAffiliate && <View style={{ marginTop: 10 }}>
                    <Inp label="Affiliate Link URL" value={form.affiliateLink} onChangeText={v => set('affiliateLink', v)} placeholder="https://..." />
                </View>}
            </View>
        </View>
    );

    const renderVariants = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Product Variants</Text>
                <Text style={SS.cardSub}>Add different options like Size, Color, or Storage capacity</Text>
                {form.variants.map((v, i) => (
                    <View key={i} style={[SS.variantRow, { backgroundColor: '#F8FAFC' }]}>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            <TextInput placeholder="Option (e.g. Red, XL, 256GB)" value={v.name}
                                onChangeText={t => { const a = [...form.variants]; a[i].name = t; set('variants', a); }}
                                style={[SS.inpBox, { flex: 1 }]} placeholderTextColor="#94A3B8" />
                            <TouchableOpacity onPress={() => set('variants', form.variants.filter((_, idx) => idx !== i))}
                                style={SS.deleteBtn}>
                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput placeholder="Price adj. (₦)" value={v.price?.toString()} keyboardType="numeric"
                                onChangeText={t => { const a = [...form.variants]; a[i].price = t; set('variants', a); }}
                                style={[SS.inpBox, { flex: 1 }]} placeholderTextColor="#94A3B8" />
                            <TextInput placeholder="Stock" value={v.stock?.toString()} keyboardType="numeric"
                                onChangeText={t => { const a = [...form.variants]; a[i].stock = t; set('variants', a); }}
                                style={[SS.inpBox, { flex: 1 }]} placeholderTextColor="#94A3B8" />
                        </View>
                    </View>
                ))}
                <TouchableOpacity onPress={() => set('variants', [...form.variants, { name: '', price: '', stock: '' }])}
                    style={SS.addRowBtn}>
                    <Ionicons name="add-circle" size={20} color="#3B82F6" />
                    <Text style={SS.addRowTxt}>Add Variant Option</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderAdvanced = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Inventory Controls</Text>
                <Inp label="Low Stock Alert (units)" value={form.lowStockThreshold} onChangeText={v => set('lowStockThreshold', v)} placeholder="5" numeric
                    hint="Get notified when stock drops below this number" />
                <Inp label="Max Quantity Per Order" value={form.maxQuantity} onChangeText={v => set('maxQuantity', v)} placeholder="e.g. 10" numeric
                    hint="Leave blank to allow unlimited quantities" />
                <ToggleRow label="Allow Backorders"
                    desc="Continue selling even when stock hits zero"
                    icon="repeat" value={form.allowBackorders}
                    onChange={v => set('allowBackorders', v)} color="#F59E0B" />
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
                    <Inp label="Shipping Weight (kg)" value={form.weight} onChangeText={v => set('weight', v)} placeholder="0.5" numeric />
                </View>
            )}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>SEO Optimization</Text>
                <Inp label="SEO Title" value={form.seoTitle} onChangeText={v => set('seoTitle', v)} placeholder="Optimized title for search engines..." />
                <Inp label="SEO Description" value={form.seoDesc} onChangeText={v => set('seoDesc', v)} placeholder="Meta description (150–160 characters ideal)..." multi
                    hint="This shows up in Google search results" />
                <Inp label="Keywords (comma separated)" value={form.keywords} onChangeText={v => set('keywords', v)} placeholder="wireless, earbuds, bluetooth..." multi />
                <Inp label="Product Tags" value={form.tags} onChangeText={v => set('tags', v)} placeholder="Electronics, New Arrival, Sale" />
                <TouchableOpacity onPress={() => handleAI('seo')} style={SS.aiBtnFull} disabled={aiLoading}>
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
            case 'seo':      return renderSEO();
            default:         return null;
        }
    };

    // ── Main Render ────────────────────────────────────────────
    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Header */}
            <View style={[SS.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={onCancel} style={SS.iconBtn}>
                    <Ionicons name="close" size={22} color="#0E1A2E" />
                </TouchableOpacity>

                <View style={{ flex: 1, marginHorizontal: 14 }}>
                    <Text style={SS.headerTitle}>{isEditing ? 'Edit Product' : 'New Product Listing'}</Text>
                    <Text style={SS.headerSub}>{isEditing ? 'Update product details' : 'List a new product for sale'}</Text>
                </View>

                <Animated.View style={{ transform: [{ scale: saveAnim }] }}>
                    <TouchableOpacity onPress={handleSubmit} disabled={loading}
                        style={[SS.saveBtn, loading && { backgroundColor: '#94A3B8' }]}>
                        {loading
                            ? <ActivityIndicator size="small" color="white" />
                            : <><Ionicons name="cloud-upload" size={14} color="#D9A73A" /><Text style={SS.saveBtnTxt}>{isEditing ? 'Update' : 'Publish'}</Text></>
                        }
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Tab Bar */}
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

            {/* Loading Overlay */}
            {loading && (
                <View style={SS.loadingOverlay}>
                    <View style={SS.loadingBox}>
                        <ActivityIndicator size="large" color="#0E1A2E" />
                        <Text style={SS.loadingTxt}>{isEditing ? 'Updating product & uploading media...' : 'Publishing listing & uploading photos...'}</Text>
                    </View>
                </View>
            )}
        </View>
    );
};
