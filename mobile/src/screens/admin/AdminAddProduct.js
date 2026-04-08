import React, { useState, useEffect, useRef } from 'react';
import {
    View, Text, TextInput, TouchableOpacity, ScrollView, Image,
    ActivityIndicator, Alert, Switch, StatusBar, Platform,
    Animated, Dimensions, StyleSheet, Modal, FlatList
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { decode } from 'base64-arraybuffer';
import * as FileSystem from 'expo-file-system/legacy';
import { geminiService } from '../../services/geminiService';
import { parsePrice } from '../../utils/helpers';

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
    { id: 'vital',    label: 'Info',      icon: 'information-circle' },
    { id: 'offer',    label: 'Pricing',   icon: 'pricetag' },
    { id: 'images',   label: 'Media',     icon: 'images' },
    { id: 'details',  label: 'Specs',     icon: 'list' },
    { id: 'variants', label: 'Variants',  icon: 'layers' },
    { id: 'advanced', label: 'Advanced',  icon: 'settings' },
    { id: 'shipping', label: 'SEO',       icon: 'search' },
];

// ─────────────────────────────────────────────────────────────────────────────
export const AdminAddProduct = ({ onCancel, onSuccess, initialData = null }) => {
    const insets = useSafeAreaInsets();
    const isEditing = !!initialData;

    const [activeTab,  setActiveTab]  = useState('vital');
    const [loading,    setLoading]    = useState(false);
    const [aiLoading,  setAiLoading]  = useState(false);
    const [images,     setImages]     = useState(
        initialData?.images?.map(uri => ({ uri, status: 'success', url: uri })) || []
    );
    const [video, setVideo] = useState(initialData?.metadata?.video || null);
    const [vendors, setVendors]         = useState([]);
    const [vendorSearch, setVendorSearch] = useState('');
    const [showVendorModal, setShowVendorModal] = useState(false);
    const [selectedVendor, setSelectedVendor] = useState(null);

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

    // ── Load vendors ───────────────────────────────────────────
    useEffect(() => {
        loadVendors();
        // Pre-select initial vendor if editing
        if (initialData?.vendor_id) {
            supabase.from('profiles')
                .select('id, full_name, email, avatar_url')
                .eq('id', initialData.vendor_id)
                .single()
                .then(({ data }) => { if (data) setSelectedVendor(data); });
        }
    }, []);

    const loadVendors = async () => {
        const { data } = await supabase
            .from('profiles')
            .select('id, full_name, email, avatar_url, role')
            .or('role.eq.vendor,role.eq.admin')
            .order('full_name');
        if (data) setVendors(data);
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
        if (!form.name) return Alert.alert('Name Required', 'Enter a product name first.');
        setAiLoading(true);
        try {
            if (type === 'description') {
                const d = await geminiService.generateDescription(form);
                set('description', d);
            } else {
                const s = await geminiService.generateSEO(form);
                setForm(p => ({ ...p, seoTitle: s.title, seoDesc: s.description, keywords: s.keywords }));
            }
        } catch (e) { Alert.alert('AI Error', e.message); }
        finally { setAiLoading(false); }
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
                original_price:   parsePrice(form.originalPrice) || null,
                cost:             parsePrice(form.cost) || null,
                stock_quantity:   parseInt(form.stock) || 0,
                sku:              form.sku,
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

    // ── Shared Sub-Components ──────────────────────────────────
    const Inp = ({ label, field, placeholder, numeric, multi, hint }) => (
        <View style={SS.inpWrap}>
            <Text style={SS.inpLabel}>{label}</Text>
            <TextInput
                style={[SS.inpBox, multi && { height: 88, textAlignVertical: 'top', paddingTop: 12 }]}
                value={form[field]}
                onChangeText={v => set(field, v)}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                keyboardType={numeric ? 'numeric' : 'default'}
                multiline={multi}
            />
            {hint && <Text style={SS.inpHint}>{hint}</Text>}
        </View>
    );

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

    // ── Vendor Modal ───────────────────────────────────────────
    const filteredVendors = vendors.filter(v =>
        v.full_name?.toLowerCase().includes(vendorSearch.toLowerCase()) ||
        v.email?.toLowerCase().includes(vendorSearch.toLowerCase())
    );

    // ── Tab Renderers ──────────────────────────────────────────
    const renderVital = () => (
        <View style={SS.tabContent}>
            {/* Vendor Selector */}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Assign to Vendor / Admin</Text>
                <TouchableOpacity onPress={() => setShowVendorModal(true)} style={SS.vendorPicker}>
                    {selectedVendor?.avatar_url
                        ? <Image source={{ uri: selectedVendor.avatar_url }} style={SS.vendorAvatar} />
                        : <View style={[SS.vendorAvatar, { backgroundColor: '#EEF2FF', alignItems: 'center', justifyContent: 'center' }]}>
                            <Ionicons name="person" size={20} color="#6366F1" />
                          </View>
                    }
                    <View style={{ flex: 1 }}>
                        <Text style={SS.vendorName}>{selectedVendor?.full_name || 'Select vendor / admin'}</Text>
                        {selectedVendor && <Text style={SS.vendorEmail}>{selectedVendor.email}</Text>}
                    </View>
                    <Ionicons name="chevron-down" size={18} color="#94A3B8" />
                </TouchableOpacity>
            </View>

            <View style={SS.card}>
                <ToggleRow label="Digital Product" desc="No physical shipping needed (e.g. E-books, Keys)"
                    icon="cloud-download" value={form.isDigital} onChange={v => set('isDigital', v)} color="#8B5CF6" />
            </View>

            <View style={SS.card}>
                <Inp label="Product Name *" field="name" placeholder="e.g. Premium Wireless Earbuds" />
                <Inp label="Brand" field="brand" placeholder="e.g. Sony, Samsung, Local Brand" />
            </View>

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
                <Inp label="Description *" field="description" placeholder="Detailed product information..." multi
                    hint="Clear description improves conversions" />
                <TouchableOpacity onPress={() => handleAI('description')} style={SS.aiBtnRow}>
                    {aiLoading ? <ActivityIndicator size="small" color="#8B5CF6" />
                               : <Ionicons name="sparkles" size={16} color="#8B5CF6" />}
                    <Text style={SS.aiBtnTxt}>Rewrite with Gemini AI</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderOffer = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Pricing</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}><Inp label="Selling Price (₦) *" field="price" placeholder="0.00" numeric /></View>
                    <View style={{ flex: 1 }}><Inp label="Original Price (₦)" field="originalPrice" placeholder="0.00" numeric /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}><Inp label="Cost Price (internal)" field="cost" placeholder="0.00" numeric /></View>
                    <View style={{ flex: 1 }}><Inp label="Stock Qty" field="stock" placeholder="0" numeric /></View>
                </View>
                <Inp label="SKU" field="sku" placeholder="PROD-001" hint="Unique product identifier" />
                <Inp label="Barcode / GTIN" field="barcode" placeholder="EAN-13 or UPC" />
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Free Shipping</Text>
                <ToggleRow label="Enable Free Shipping"
                    desc={form.freeShipping ? 'Customers pay ₦0 shipping for this product'
                                            : 'Customers pay the platform shipping fee'}
                    icon="airplane" value={form.freeShipping}
                    onChange={v => set('freeShipping', v)} color="#10B981" />
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Sale Schedule</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}><Inp label="Start Date (YYYY-MM-DD)" field="saleStart" placeholder="2025-01-01" /></View>
                    <View style={{ flex: 1 }}><Inp label="End Date (YYYY-MM-DD)" field="saleEnd" placeholder="2025-12-31" /></View>
                </View>
            </View>

            <View style={SS.card}>
                <Text style={SS.cardTitle}>Visibility Status</Text>
                <ToggleRow label="Published" desc={form.status === 'approved' ? 'Visible to all customers' : 'Hidden draft'}
                    icon="eye" value={form.status === 'approved'}
                    onChange={v => set('status', v ? 'approved' : 'draft')} color="#3B82F6" />
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

    const renderDetails = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Specifications</Text>
                {form.specifications.map((spec, i) => (
                    <View key={i} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                        <TextInput placeholder="Feature" value={spec.key}
                            onChangeText={t => { const a = [...form.specifications]; a[i].key = t; set('specifications', a); }}
                            style={[SS.inpBox, { flex: 1 }]} placeholderTextColor="#94A3B8" />
                        <TextInput placeholder="Value" value={spec.value}
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
                <ToggleRow label="Affiliate Product" desc="Link to an external product page"
                    icon="link" value={form.isAffiliate} onChange={v => set('isAffiliate', v)} color="#F59E0B" />
                {form.isAffiliate && <View style={{ marginTop: 10 }}>
                    <Inp label="Affiliate Link URL" field="affiliateLink" placeholder="https://..." />
                </View>}
            </View>
        </View>
    );

    const renderVariants = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Product Variants</Text>
                <Text style={SS.cardSub}>Manage size, color, or other options</Text>
                {form.variants.map((v, i) => (
                    <View key={i} style={[SS.variantRow, { backgroundColor: '#F8FAFC' }]}>
                        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                            <TextInput placeholder="Option (e.g. Red, XL)" value={v.name}
                                onChangeText={t => { const a = [...form.variants]; a[i].name = t; set('variants', a); }}
                                style={[SS.inpBox, { flex: 1 }]} placeholderTextColor="#94A3B8" />
                            <TouchableOpacity onPress={() => set('variants', form.variants.filter((_, idx) => idx !== i))}
                                style={SS.deleteBtn}>
                                <Ionicons name="trash-outline" size={16} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                            <TextInput placeholder="Price adj." value={v.price?.toString()} keyboardType="numeric"
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
                    <Text style={SS.addRowTxt}>Add Variant</Text>
                </TouchableOpacity>
            </View>
        </View>
    );

    const renderAdvanced = () => (
        <View style={SS.tabContent}>
            <View style={SS.card}>
                <Text style={SS.cardTitle}>Inventory Control</Text>
                <Inp label="Low Stock Alert Threshold" field="lowStockThreshold" placeholder="5" numeric
                    hint="Notify admin when stock falls below this level" />
                <Inp label="Max Quantity Per Order" field="maxQuantity" placeholder="e.g. 10" numeric
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
                    <Inp label="Shipping Weight (kg)" field="weight" placeholder="0.5" numeric />
                </View>
            )}
            <View style={SS.card}>
                <Text style={SS.cardTitle}>SEO Optimization</Text>
                <Inp label="SEO Title" field="seoTitle" placeholder="Optimized title for Google..." />
                <Inp label="SEO Description" field="seoDesc" placeholder="Meta description for search results..."
                    multi hint="Ideal: 150–160 characters" />
                <Inp label="Keywords (comma separated)" field="keywords" placeholder="wireless, earbuds, bluetooth..." multi />
                <Inp label="Product Tags" field="tags" placeholder="Electronics, New Arrival, Sale" />
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
                                    {item.avatar_url
                                        ? <Image source={{ uri: item.avatar_url }} style={SS.vendorAvatar} />
                                        : <Ionicons name="person" size={18} color="#6366F1" />}
                                </View>
                                <View style={{ flex: 1 }}>
                                    <Text style={SS.vendorName}>{item.full_name || 'No name'}</Text>
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
            <StatusBar barStyle="dark-content" backgroundColor="white" />

            {/* Header */}
            <View style={[SS.header, { paddingTop: insets.top + 8 }]}>
                <TouchableOpacity onPress={onCancel} style={SS.iconBtn}>
                    <Ionicons name="close" size={22} color="#0F172A" />
                </TouchableOpacity>

                <View style={{ flex: 1, marginHorizontal: 14 }}>
                    <Text style={SS.headerTitle}>{isEditing ? 'Edit Product' : 'New Product'}</Text>
                    <Text style={SS.headerSub}>{isEditing ? 'Modify product details' : 'Create a new listing'}</Text>
                </View>

                <Animated.View style={{ transform: [{ scale: saveAnim }] }}>
                    <TouchableOpacity onPress={handleSubmit} disabled={loading}
                        style={[SS.saveBtn, loading && { backgroundColor: '#94A3B8' }]}>
                        {loading
                            ? <ActivityIndicator size="small" color="white" />
                            : <><Ionicons name="cloud-upload" size={14} color="white" /><Text style={SS.saveBtnTxt}>{isEditing ? 'Update' : 'Publish'}</Text></>
                        }
                    </TouchableOpacity>
                </Animated.View>
            </View>

            {/* Tabs */}
            <View style={{ backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}
                    contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 10, gap: 6 }}>
                    {TABS.map(tab => {
                        const active = activeTab === tab.id;
                        return (
                            <TouchableOpacity key={tab.id} onPress={() => setActiveTab(tab.id)}
                                style={[SS.tabChip, active && SS.tabChipActive]}>
                                <Ionicons name={tab.icon} size={14} color={active ? '#4F46E5' : '#94A3B8'} />
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
                        <ActivityIndicator size="large" color="#6366F1" />
                        <Text style={SS.loadingTxt}>{isEditing ? 'Updating...' : 'Creating Product...'}</Text>
                    </View>
                </View>
            )}

            <VendorModal />
        </View>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────
const SS = StyleSheet.create({
    header:       { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 16, paddingBottom: 14, borderBottomWidth: 1, borderColor: '#F1F5F9' },
    iconBtn:      { width: 40, height: 40, borderRadius: 12, backgroundColor: '#F8FAFC', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    headerTitle:  { fontSize: 17, fontWeight: '900', color: '#0F172A', letterSpacing: -0.3 },
    headerSub:    { fontSize: 11, color: '#94A3B8', marginTop: 1 },
    saveBtn:      { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#4F46E5', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
    saveBtnTxt:   { color: 'white', fontWeight: '800', fontSize: 13 },
    tabChip:      { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: 'transparent' },
    tabChipActive:{ backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
    tabTxt:       { fontSize: 12, fontWeight: '600', color: '#94A3B8' },
    tabTxtActive: { color: '#4F46E5', fontWeight: '800' },
    tabContent:   { padding: 16 },
    card:         { backgroundColor: 'white', borderRadius: 20, padding: 18, marginBottom: 14, borderWidth: 1, borderColor: '#F1F5F9', shadowColor: '#000', shadowOpacity: 0.03, shadowRadius: 8, elevation: 1 },
    cardTitle:    { fontSize: 14, fontWeight: '900', color: '#0F172A', marginBottom: 14, letterSpacing: -0.2 },
    cardSub:      { fontSize: 12, color: '#64748B', marginTop: -10, marginBottom: 14 },
    inpWrap:      { marginBottom: 14 },
    inpLabel:     { fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 7 },
    inpBox:       { backgroundColor: '#F8FAFC', borderRadius: 12, padding: 13, fontSize: 14, fontWeight: '600', color: '#0F172A', borderWidth: 1, borderColor: '#E2E8F0' },
    inpHint:      { fontSize: 11, color: '#94A3B8', marginTop: 5 },
    toggleRow:    { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#F1F5F9', backgroundColor: '#F8FAFC', marginBottom: 10 },
    toggleIcon:   { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
    toggleLabel:  { fontSize: 14, fontWeight: '800', color: '#0F172A' },
    toggleDesc:   { fontSize: 12, color: '#64748B', marginTop: 2 },
    catChip:      { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1.5, borderColor: '#E2E8F0', marginRight: 4 },
    catLabel:     { fontSize: 13, fontWeight: '700', color: '#475569' },
    aiBtnRow:     { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#EDE9FE', padding: 12, borderRadius: 12, marginTop: 4 },
    aiBtnFull:    { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', backgroundColor: '#EDE9FE', padding: 14, borderRadius: 14, marginBottom: 14 },
    aiBtnTxt:     { color: '#7C3AED', fontWeight: '800', fontSize: 13 },
    imagePicker:  { height: 120, borderWidth: 2, borderColor: '#6366F1', borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF2FF', gap: 6 },
    imagePickerTxt:{ color: '#6366F1', fontWeight: '700', fontSize: 14 },
    imagePickerSub:{ color: '#94A3B8', fontSize: 12 },
    removeImgBtn: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, padding: 4 },
    primaryBadge: { position: 'absolute', bottom: 4, left: 4, backgroundColor: '#6366F1', borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2 },
    addRowBtn:    { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 },
    addRowTxt:    { color: '#3B82F6', fontWeight: '700', fontSize: 14 },
    deleteBtn:    { width: 40, height: 40, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
    variantRow:   { borderRadius: 14, padding: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' },
    taxChip:      { paddingHorizontal: 16, paddingVertical: 9, borderRadius: 12, borderWidth: 1.5, borderColor: '#E2E8F0', backgroundColor: '#F8FAFC' },
    taxChipActive:{ backgroundColor: '#EEF2FF', borderColor: '#6366F1' },
    taxChipTxt:   { fontSize: 13, fontWeight: '700', color: '#64748B', textTransform: 'capitalize' },
    taxChipTxtActive: { color: '#4F46E5' },
    vendorPicker: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#F8FAFC', borderRadius: 14, padding: 14, borderWidth: 1, borderColor: '#E2E8F0' },
    vendorAvatar: { width: 44, height: 44, borderRadius: 12 },
    vendorName:   { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    vendorEmail:  { fontSize: 12, color: '#94A3B8', marginTop: 2 },
    vendorSearchRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC', borderRadius: 14, paddingHorizontal: 14, height: 46, borderWidth: 1, borderColor: '#E2E8F0' },
    vendorItem:   { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderColor: '#F1F5F9', borderRadius: 12 },
    roleBadge:    { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    loadingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(255,255,255,0.88)', alignItems: 'center', justifyContent: 'center' },
    loadingBox:   { alignItems: 'center', gap: 12 },
    loadingTxt:   { fontSize: 15, fontWeight: '700', color: '#6366F1' },
});
