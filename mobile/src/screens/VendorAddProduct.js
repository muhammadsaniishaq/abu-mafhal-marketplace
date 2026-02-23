import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, Image, ActivityIndicator, Alert, Switch, SafeAreaView, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { decode } from 'base64-arraybuffer'; // Import decode
import * as FileSystem from 'expo-file-system'; // Add Import
import { styles } from '../styles/theme';
import { geminiService } from '../services/geminiService'; // Import Gemini Service

export const VendorAddProduct = ({ onCancel, onSuccess, initialData = null }) => {
    const isEditing = !!initialData;
    const [activeSection, setActiveSection] = useState('vital'); // vital, offer, images, details, shipping, seo
    const [loading, setLoading] = useState(false);
    const [aiLoading, setAiLoading] = useState(false); // New AI state
    const [images, setImages] = useState(initialData?.images?.map(uri => ({ uri, status: 'success', url: uri })) || []);
    const [video, setVideo] = useState(initialData?.metadata?.video || initialData?.video || null); // Check metadata first or fallback

    const [formData, setFormData] = useState({
        name: initialData?.name || '',
        description: initialData?.description || '',
        category: initialData?.category || '',
        brand: initialData?.brand || '',
        price: initialData?.price?.toString() || '',
        originalPrice: initialData?.original_price?.toString() || '',
        cost: initialData?.cost?.toString() || '',
        stock: initialData?.stock_quantity?.toString() || '',
        sku: initialData?.sku || '',
        status: initialData?.status || 'approved',
        barcode: initialData?.metadata?.barcode || initialData?.barcode || '',
        specifications: initialData?.metadata?.specifications || initialData?.specifications || [{ key: '', value: '' }], // Moved to metadata
        variants: initialData?.metadata?.variants || initialData?.variants || [], // Array of { name, price, stock } - Moved to metadata check
        isAffiliate: initialData?.is_affiliate || false,
        affiliateLink: initialData?.affiliate_link || '',
        weight: initialData?.shipping_weight?.toString() || '',
        seoTitle: initialData?.seo_title || '',
        seoDesc: initialData?.seo_description || '',
        keywords: initialData?.metadata?.keywords || '',
        tags: (initialData?.tags || []).join(', '),
        saleStart: initialData?.metadata?.sale_start_date || initialData?.sale_start_date || '', // Check metadata
        saleEnd: initialData?.metadata?.sale_end_date || initialData?.sale_end_date || '', // Check metadata
        // Advanced Features
        isDigital: initialData?.metadata?.is_digital || false,
        lowStockThreshold: initialData?.metadata?.low_stock_threshold?.toString() || '5',
        allowBackorders: initialData?.metadata?.allow_backorders || false,
        taxClass: initialData?.metadata?.tax_class || 'standard', // standard, reduced, zero
        maxQuantity: initialData?.metadata?.max_quantity?.toString() || ''
    });

    const categories = ['Electronics', 'Fashion', 'Home', 'Beauty', 'Sports', 'Books', 'Toys', 'Food', 'Automotive', 'Other'];

    const pickImage = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            allowsMultipleSelection: true,
            quality: 0.7,
            base64: true
        });

        if (!result.canceled) {
            const newImages = result.assets.map(asset => ({
                uri: asset.uri,
                base64: asset.base64,
                type: asset.type || 'image/jpeg',
                status: 'pending' // pending, uploading, success, error
            }));
            setImages([...images, ...newImages]);
        }
    };

    const uploadImages = async () => {
        const uploadedUrls = [];
        for (let img of images) {
            if (img.status === 'success') {
                uploadedUrls.push(img.url);
                continue;
            }

            try {
                if (!img.base64) {
                    throw new Error('Image base64 missing');
                }

                const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`;

                // Use base64-arraybuffer to convert base64 string to ArrayBuffer
                // This is the most reliable way in Expo for Supabase
                const fileData = decode(img.base64);

                const { data, error } = await supabase.storage.from('products').upload(fileName, fileData, {
                    contentType: 'image/jpeg',
                    upsert: false
                });

                if (error) throw error;

                const { data: publicUrl } = supabase.storage.from('products').getPublicUrl(fileName);
                uploadedUrls.push(publicUrl.publicUrl);

            } catch (e) {
                console.log("Upload error:", e);
                Alert.alert('Upload Failed', 'Could not upload some images. Please try again.');
                throw e; // Stop process if upload fails
            }
        }
        return uploadedUrls;
    };

    const uploadImageMock = async () => {
        // Mock upload for stability in demo env
        return images.map(() => `https://placehold.co/600x400?text=${encodeURIComponent(formData.name || 'Product')}`);
    }

    const pickVideo = async () => {
        let result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Videos,
            allowsEditing: true,
            quality: 0.5,
        });

        if (!result.canceled) {
            setVideo(result.assets[0].uri);
        }
    };

    const handleAIGenerate = async (type) => {
        setAiLoading(true);
        try {
            if (type === 'description') {
                if (!formData.name) return Alert.alert('Info Needed', 'Please enter a product name first.');

                const desc = await geminiService.generateDescription(formData);
                setFormData(prev => ({ ...prev, description: desc }));
                Alert.alert('Gemini AI ✨', 'Description generated!');
            } else if (type === 'seo') {
                if (!formData.name) return Alert.alert('Info Needed', 'Please enter a product name first.');

                const seo = await geminiService.generateSEO(formData);
                setFormData(prev => ({
                    ...prev,
                    seoTitle: seo.title,
                    seoDesc: seo.description,
                    keywords: seo.keywords
                }));
                Alert.alert('Gemini AI ✨', 'SEO Optimized!');
            }
        } catch (e) {
            Alert.alert('AI Error', e.message);
        } finally {
            setAiLoading(false);
        }
    };

    const uploadVideo = async () => {
        if (!video) return null;
        if (video.startsWith('http')) return video;

        try {
            const fileName = `video_${Date.now()}.mp4`;
            const fileBase64 = await FileSystem.readAsStringAsync(video, { encoding: 'base64' });
            const arrayBuffer = decode(fileBase64);

            const { error } = await supabase.storage.from('products').upload(fileName, arrayBuffer, {
                contentType: 'video/mp4',
                upsert: false
            });

            if (error) throw error;

            const { data } = supabase.storage.from('products').getPublicUrl(fileName);
            return data.publicUrl;
        } catch (e) {
            console.log("Video Upload Error:", e);
            Alert.alert('Upload Warning', 'Failed to upload video. Product will be saved without it.');
            return null;
        }
    };

    const handleSubmit = async () => {
        // ... validation ...
        const missing = [];
        if (!formData.name) missing.push('Name');
        if (!formData.price) missing.push('Price');
        if (!formData.description) missing.push('Description');

        if (missing.length > 0) {
            Alert.alert('Error', `Please fill required fields: ${missing.join(', ')}`);
            return;
        }

        setLoading(true);
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('You must be logged in to add products');

            const imageUrls = await uploadImages();
            const videoUrl = await uploadVideo(); // Real upload

            const productData = {
                vendor_id: user.id,
                name: formData.name,
                description: formData.description,
                category: formData.category,
                brand: formData.brand,
                price: parseFloat(formData.price),
                original_price: parseFloat(formData.originalPrice) || null,
                cost: parseFloat(formData.cost) || null,
                stock_quantity: parseInt(formData.stock) || 0,
                sku: formData.sku,
                images: imageUrls,
                status: formData.status,
                is_affiliate: formData.isAffiliate,
                affiliate_link: formData.affiliateLink,
                is_new: !isEditing,
                shipping_weight: parseFloat(formData.weight) || null,
                seo_title: formData.seoTitle,
                seo_description: formData.seoDesc,
                tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean),
                metadata: {
                    metrics: initialData?.metadata?.metrics || {},
                    keywords: formData.keywords,
                    barcode: formData.barcode,
                    specifications: formData.specifications.filter(s => s.key && s.value),
                    variants: formData.variants,
                    video: videoUrl, // Saved here
                    is_digital: formData.isDigital,
                    low_stock_threshold: parseInt(formData.lowStockThreshold) || 5,
                    allow_backorders: formData.allowBackorders,
                    tax_class: formData.taxClass,
                    max_quantity: parseInt(formData.maxQuantity) || null,
                    sale_start_date: formData.saleStart || null,
                    sale_end_date: formData.saleEnd || null
                }
            };

            const { error } = isEditing
                ? await supabase.from('products').update(productData).eq('id', initialData.id)
                : await supabase.from('products').insert(productData);

            if (error) throw error;

            Alert.alert('Success', `Product ${isEditing ? 'updated' : 'created'} successfully!`);
            onSuccess();
        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    const renderInput = (label, field, placeholder, numeric = false, multiline = false) => (
        <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 13, fontWeight: '700', color: '#1E293B', marginBottom: 8, letterSpacing: 0.3 }}>{label.toUpperCase()}</Text>
            <TextInput
                value={formData[field]}
                onChangeText={text => setFormData(prev => ({ ...prev, [field]: text }))}
                placeholder={placeholder}
                placeholderTextColor="#94A3B8"
                keyboardType={numeric ? 'numeric' : 'default'}
                multiline={multiline}
                numberOfLines={multiline ? 4 : 1}
                style={{
                    backgroundColor: 'white',
                    borderWidth: 1.5,
                    borderColor: '#E2E8F0',
                    borderRadius: 16,
                    paddingHorizontal: 16,
                    paddingVertical: 14,
                    fontSize: 16,
                    color: '#0F172A',
                    height: multiline ? 120 : 56,
                    textAlignVertical: multiline ? 'top' : 'center',
                    boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
                }}
            />
        </View>
    );


    const Sections = [
        { id: 'vital', label: 'Vital Info', icon: 'information-circle' },
        { id: 'offer', label: 'Offer', icon: 'pricetag' },
        { id: 'images', label: 'Media', icon: 'images' },
        { id: 'details', label: 'Specs', icon: 'list' },
        { id: 'variants', label: 'Variants', icon: 'layers' },
        { id: 'advanced', label: 'Advanced', icon: 'settings' }, // New Tab
        { id: 'shipping', label: 'Ship+SEO', icon: 'boat' },
    ];

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 }}>
            <SafeAreaView style={{ backgroundColor: 'white' }}>
                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#eff6ff' }}>
                    <TouchableOpacity onPress={onCancel} style={{ padding: 8 }}>
                        <Ionicons name="close" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>{isEditing ? 'Edit Product' : 'Add New Product'}</Text>
                    <TouchableOpacity onPress={handleSubmit} disabled={loading}>
                        <Text style={{ color: loading ? '#94A3B8' : '#3B82F6', fontWeight: '700', fontSize: 16 }}>{isEditing ? 'Update' : 'Save'}</Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>

            {/* Tabs */}
            <View style={{ backgroundColor: 'white', paddingBottom: 16 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
                    {Sections.map(section => (
                        <TouchableOpacity
                            key={section.id}
                            onPress={() => setActiveSection(section.id)}
                            style={{
                                marginRight: 20,
                                paddingBottom: 8,
                                borderBottomWidth: 2,
                                borderColor: activeSection === section.id ? '#3B82F6' : 'transparent',
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6
                            }}
                        >
                            <Ionicons name={section.icon} size={16} color={activeSection === section.id ? '#3B82F6' : '#94A3B8'} />
                            <Text style={{
                                color: activeSection === section.id ? '#3B82F6' : '#64748B',
                                fontWeight: activeSection === section.id ? '700' : '500'
                            }}>
                                {section.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>
            </View>

            <ScrollView style={{ flex: 1, padding: 20 }}>
                {activeSection === 'vital' && (
                    <View>
                        <View style={{ marginBottom: 16, backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                            <View>
                                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0F172A' }}>Digital Product?</Text>
                                <Text style={{ fontSize: 11, color: '#64748B' }}>No shipping required (e.g. E-books)</Text>
                            </View>
                            <Switch value={formData.isDigital} onValueChange={v => setFormData({ ...formData, isDigital: v })} />
                        </View>

                        {renderInput('Product Name', 'name', 'e.g. Wireless Headphones')}
                        {renderInput('Brand', 'brand', 'e.g. Sony')}

                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Category</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                            {categories.map(cat => (
                                <TouchableOpacity
                                    key={cat}
                                    onPress={() => setFormData({ ...formData, category: cat })}
                                    style={{
                                        paddingHorizontal: 16,
                                        paddingVertical: 8,
                                        backgroundColor: formData.category === cat ? '#0F172A' : 'white',
                                        borderRadius: 20,
                                        marginRight: 8,
                                        borderWidth: 1,
                                        borderColor: formData.category === cat ? '#0F172A' : '#E2E8F0'
                                    }}
                                >
                                    <Text style={{ color: formData.category === cat ? 'white' : '#64748B', fontSize: 13, fontWeight: '600' }}>{cat}</Text>
                                </TouchableOpacity>
                            ))}
                        </ScrollView>

                        {renderInput('Description', 'description', 'Product details...', false, true)}

                        <TouchableOpacity
                            onPress={() => handleAIGenerate('description')}
                            disabled={aiLoading}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20 }}
                        >
                            {aiLoading ? <ActivityIndicator size="small" color="#3B82F6" /> : <Ionicons name="sparkles" size={18} color="#3B82F6" />}
                            <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Rewrite with AI</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {activeSection === 'offer' && (
                    <View>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <View style={{ flex: 1 }}>{renderInput('Price', 'price', '0.00', true)}</View>
                            <View style={{ flex: 1 }}>{renderInput('Original Price', 'originalPrice', '0.00', true)}</View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <View style={{ flex: 1 }}>{renderInput('Stock', 'stock', '0', true)}</View>
                            <View style={{ flex: 1 }}>{renderInput('SKU', 'sku', 'Item-XS-001')}</View>
                        </View>
                        {renderInput('Barcode / GTIN', 'barcode', 'e.g. 123456789')}
                        {renderInput('Cost (Internal)', 'cost', '0.00', true)}

                        <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Sale Schedule (YYYY-MM-DD)</Text>
                        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 16 }}>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    placeholder="Start Date"
                                    value={formData.saleStart}
                                    onChangeText={t => setFormData({ ...formData, saleStart: t })}
                                    style={{ backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <TextInput
                                    placeholder="End Date"
                                    value={formData.saleEnd}
                                    onChangeText={t => setFormData({ ...formData, saleEnd: t })}
                                    style={{ backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0' }}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            onPress={() => handleAIGenerate('seo')}
                            disabled={aiLoading}
                            style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EFF6FF', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE', marginBottom: 20 }}
                        >
                            {aiLoading ? <ActivityIndicator size="small" color="#3B82F6" /> : <Ionicons name="stats-chart" size={18} color="#3B82F6" />}
                            <Text style={{ color: '#3B82F6', fontWeight: '700' }}>Generate SEO Tags</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, padding: 16, backgroundColor: 'white', borderRadius: 12 }}>
                            <Text style={{ fontWeight: '600', color: '#0F172A' }}>Active Status</Text>
                            <Switch
                                value={formData.status === 'approved'}
                                onValueChange={v => setFormData({ ...formData, status: v ? 'approved' : 'draft' })}
                                trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                            />
                        </View>
                    </View>
                )}

                {activeSection === 'images' && (
                    <View>
                        <TouchableOpacity onPress={pickImage} style={{ height: 150, borderWidth: 2, borderColor: '#3B82F6', borderStyle: 'dashed', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EFF6FF', marginBottom: 20 }}>
                            <Ionicons name="images" size={32} color="#3B82F6" />
                            <Text style={{ color: '#3B82F6', fontWeight: '700', marginTop: 8 }}>Select Images</Text>
                        </TouchableOpacity>

                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                            {images.map((img, i) => (
                                <View key={i} style={{ width: '31%', aspectRatio: 1, borderRadius: 12, overflow: 'hidden', position: 'relative' }}>
                                    <Image
                                        source={{ uri: img.uri }}
                                        style={{ width: '100%', height: '100%' }}
                                        onError={(e) => {
                                            console.log("Image Load Error:", e.nativeEvent.error);
                                            // Fallback to placeholder if load fails
                                            const newImages = [...images];
                                            newImages[i].uri = 'https://placehold.co/600x400?text=Error+Loading';
                                            setImages(newImages);
                                        }}
                                    />
                                    {/* Debug: Show simplified URL */}
                                    {/* <Text style={{fontSize: 8, position: 'absolute', bottom: 0, backgroundColor:'rgba(255,255,255,0.7)', width:'100%'}} numberOfLines={1}>{img.uri.slice(-15)}</Text> */}
                                    <TouchableOpacity
                                        onPress={() => setImages(images.filter((_, idx) => idx !== i))}
                                        style={{ position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: 12, padding: 4 }}
                                    >
                                        <Ionicons name="close" size={12} color="white" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                        </View>


                        <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginTop: 20, marginBottom: 12 }}>Product Video</Text>
                        <TouchableOpacity onPress={pickVideo} style={{ height: 120, borderWidth: 1, borderColor: '#E2E8F0', borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F8FAFC' }}>
                            {video ? (
                                <View style={{ alignItems: 'center' }}>
                                    <Ionicons name="videocam" size={32} color="#3B82F6" />
                                    <Text style={{ color: '#3B82F6', fontSize: 12, marginTop: 4 }}>Video Selected</Text>
                                    <Text style={{ color: '#64748B', fontSize: 10, marginTop: 2 }} numberOfLines={1}>{video.split('/').pop()}</Text>
                                </View>
                            ) : (
                                <View style={{ alignItems: 'center' }}>
                                    <Ionicons name="videocam-outline" size={32} color="#94A3B8" />
                                    <Text style={{ color: '#64748B', fontWeight: '600', marginTop: 8 }}>Add Short Video</Text>
                                </View>
                            )}
                        </TouchableOpacity>
                        {video && (
                            <TouchableOpacity onPress={() => setVideo(null)} style={{ alignSelf: 'flex-end', marginTop: 8 }}>
                                <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '600' }}>Remove Video</Text>
                            </TouchableOpacity>
                        )}

                    </View>
                )}

                {
                    activeSection === 'variants' && (
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 6 }}>Product Variants</Text>
                            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 16 }}>Manage different options like size or color.</Text>

                            {formData.variants.map((variant, i) => (
                                <View key={i} style={{ backgroundColor: 'white', padding: 12, borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: '#E2E8F0' }}>
                                    <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                        <TextInput
                                            placeholder="Option (e.g. Red/XL)"
                                            value={variant.name}
                                            onChangeText={t => {
                                                const newVars = [...formData.variants];
                                                newVars[i].name = t;
                                                setFormData({ ...formData, variants: newVars });
                                            }}
                                            style={{ flex: 2, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                        />
                                        <TouchableOpacity onPress={() => {
                                            const newVars = formData.variants.filter((_, idx) => idx !== i);
                                            setFormData({ ...formData, variants: newVars });
                                        }} style={{ padding: 10 }}>
                                            <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                        </TouchableOpacity>
                                    </View>
                                    <View style={{ flexDirection: 'row', gap: 10 }}>
                                        <TextInput
                                            placeholder="Price (+/-)"
                                            value={variant.price?.toString()}
                                            keyboardType="numeric"
                                            onChangeText={t => {
                                                const newVars = [...formData.variants];
                                                newVars[i].price = t;
                                                setFormData({ ...formData, variants: newVars });
                                            }}
                                            style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                        />
                                        <TextInput
                                            placeholder="Stock"
                                            value={variant.stock?.toString()}
                                            keyboardType="numeric"
                                            onChangeText={t => {
                                                const newVars = [...formData.variants];
                                                newVars[i].stock = t;
                                                setFormData({ ...formData, variants: newVars });
                                            }}
                                            style={{ flex: 1, backgroundColor: '#F8FAFC', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                        />
                                    </View>
                                </View>
                            ))}

                            <TouchableOpacity
                                onPress={() => setFormData({ ...formData, variants: [...formData.variants, { name: '', price: '', stock: '' }] })}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10 }}
                            >
                                <Ionicons name="add-circle" size={24} color="#3B82F6" />
                                <Text style={{ color: '#3B82F6', fontWeight: '700', fontSize: 15 }}>Add Variant</Text>
                            </TouchableOpacity>
                        </View>
                    )
                }

                {
                    activeSection === 'details' && (
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 12 }}>Specifications</Text>
                            {formData.specifications.map((spec, i) => (
                                <View key={i} style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
                                    <TextInput
                                        placeholder="Feature (e.g. Color)"
                                        value={spec.key}
                                        onChangeText={t => {
                                            const newSpecs = [...formData.specifications];
                                            newSpecs[i].key = t;
                                            setFormData({ ...formData, specifications: newSpecs });
                                        }}
                                        style={{ flex: 1, backgroundColor: 'white', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                    />
                                    <TextInput
                                        placeholder="Value (e.g. Red)"
                                        value={spec.value}
                                        onChangeText={t => {
                                            const newSpecs = [...formData.specifications];
                                            newSpecs[i].value = t;
                                            setFormData({ ...formData, specifications: newSpecs });
                                        }}
                                        style={{ flex: 1, backgroundColor: 'white', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#E2E8F0' }}
                                    />
                                    <TouchableOpacity onPress={() => {
                                        const newSpecs = formData.specifications.filter((_, idx) => idx !== i);
                                        setFormData({ ...formData, specifications: newSpecs });
                                    }} style={{ padding: 10 }}>
                                        <Ionicons name="trash-outline" size={20} color="#EF4444" />
                                    </TouchableOpacity>
                                </View>
                            ))}
                            <TouchableOpacity
                                onPress={() => setFormData({ ...formData, specifications: [...formData.specifications, { key: '', value: '' }] })}
                                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 24 }}
                            >
                                <Ionicons name="add-circle" size={20} color="#3B82F6" />
                                <Text style={{ color: '#3B82F6', fontWeight: '600' }}>Add Specification</Text>
                            </TouchableOpacity>

                            <View style={{ height: 1, backgroundColor: '#E2E8F0', marginBottom: 24 }} />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                                <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569' }}>Is Affiliate Product?</Text>
                                <Switch value={formData.isAffiliate} onValueChange={v => setFormData({ ...formData, isAffiliate: v })} />
                            </View>

                            {formData.isAffiliate && (
                                <View>
                                    {renderInput('Affiliate Link', 'affiliateLink', 'https://...')}
                                </View>
                            )}

                            <View style={{ padding: 16, backgroundColor: '#EFF6FF', borderRadius: 12, borderWidth: 1, borderColor: '#BFDBFE' }}>
                                <View style={{ flexDirection: 'row', gap: 8 }}>
                                    <Ionicons name="information-circle" size={20} color="#3B82F6" />
                                    <Text style={{ color: '#1E40AF', fontWeight: '700' }}>Tip</Text>
                                </View>
                                <Text style={{ color: '#1E3A8A', fontSize: 12, marginTop: 4 }}>
                                    You can now add dynamic specifications directly from the app!
                                </Text>
                            </View>
                        </View>
                    )
                }

                {
                    activeSection === 'advanced' && (
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>Inventory Control</Text>

                            {renderInput('Low Stock Threshold', 'lowStockThreshold', '5', true)}
                            {renderInput('Max Quantity (Per Order)', 'maxQuantity', 'e.g. 10', true)}

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, padding: 16, backgroundColor: 'white', borderRadius: 12 }}>
                                <View>
                                    <Text style={{ fontWeight: '600', color: '#0F172A' }}>Allow Backorders</Text>
                                    <Text style={{ fontSize: 12, color: '#64748B' }}>Continue selling when out of stock</Text>
                                </View>
                                <Switch
                                    value={formData.allowBackorders}
                                    onValueChange={v => setFormData({ ...formData, allowBackorders: v })}
                                    trackColor={{ false: '#E2E8F0', true: '#3B82F6' }}
                                />
                            </View>

                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>Tax & Compliance</Text>

                            <Text style={{ fontSize: 13, fontWeight: '600', color: '#475569', marginBottom: 6 }}>Tax Class</Text>
                            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
                                {['standard', 'reduced', 'zero'].map(tax => (
                                    <TouchableOpacity
                                        key={tax}
                                        onPress={() => setFormData({ ...formData, taxClass: tax })}
                                        style={{
                                            padding: 10,
                                            backgroundColor: formData.taxClass === tax ? '#eff6ff' : 'white',
                                            borderWidth: 1,
                                            borderColor: formData.taxClass === tax ? '#3b82f6' : '#e2e8f0',
                                            borderRadius: 8
                                        }}
                                    >
                                        <Text style={{ color: formData.taxClass === tax ? '#3b82f6' : '#64748B', fontWeight: '600', textTransform: 'capitalize' }}>{tax}</Text>
                                    </TouchableOpacity>
                                ))}
                            </View>
                        </View>
                    )
                }

                {
                    activeSection === 'shipping' && !formData.isDigital && (
                        <View>
                            <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A', marginBottom: 16 }}>Shipping & SEO</Text>

                            {renderInput('Shipping Weight (kg)', 'weight', '0.5', true)}
                            {renderInput('SEO Title', 'seoTitle', 'Optimized title for Google')}
                            {renderInput('SEO Description', 'seoDesc', 'Meta description...', false, true)}
                            {renderInput('Keywords', 'keywords', 'comma, separated, tags', false, true)}
                            {renderInput('Product Tags', 'tags', 'Electronics, Sale, New')}
                        </View>
                    )
                }

                {/* Bottom Spacer */}
                <View style={{ height: 100 }} />
            </ScrollView >

            {loading && (
                <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                    <Text style={{ marginTop: 12, fontWeight: '600', color: '#3B82F6' }}>Creating Product...</Text>
                </View>
            )}
        </View >
    );
};
