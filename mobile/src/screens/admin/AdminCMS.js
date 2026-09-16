import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView, ActivityIndicator } from 'react-native';
import { supabase } from '../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';

const NAVY = '#0E1A2E';
const GOLD = '#D9A73A';

const PAGES = [
    { slug: 'about', label: 'About Us', icon: 'information-circle-outline' },
    { slug: 'terms', label: 'Terms & Conditions', icon: 'document-text-outline' },
    { slug: 'privacy', label: 'Privacy Policy', icon: 'shield-checkmark-outline' },
    { slug: 'contact', label: 'Contact Us', icon: 'call-outline' },
    { slug: 'faq', label: 'FAQ', icon: 'help-circle-outline' },
    { slug: 'refund', label: 'Refund Policy', icon: 'cash-outline' },
];

export const AdminCMS = () => {
    const [selectedPage, setSelectedPage] = useState('about');
    const [content, setContent] = useState('');
    const [title, setTitle] = useState('');
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [previewMode, setPreviewMode] = useState(false);

    useEffect(() => {
        fetchPage();
    }, [selectedPage]);

    const fetchPage = async () => {
        setLoading(true);
        try {
            const { data } = await supabase
                .from('app_pages')
                .select('*')
                .eq('slug', selectedPage)
                .maybeSingle();

            if (data) {
                setContent(data.content || '');
                setTitle(data.title || selectedPage.toUpperCase());
            } else {
                setContent('');
                const pageMeta = PAGES.find(p => p.slug === selectedPage);
                setTitle(pageMeta ? pageMeta.label : selectedPage);
            }
        } catch (e) {
            console.error('CMS fetch error:', e);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const { data: existing } = await supabase
                .from('app_pages')
                .select('id')
                .eq('slug', selectedPage)
                .maybeSingle();

            let result;
            if (existing) {
                result = await supabase
                    .from('app_pages')
                    .update({ 
                        title, 
                        content, 
                        updated_at: new Date().toISOString() 
                    })
                    .eq('id', existing.id);
            } else {
                result = await supabase
                    .from('app_pages')
                    .insert([{
                        slug: selectedPage,
                        title: title || selectedPage,
                        content
                    }]);
            }

            if (result.error) throw result.error;
            Alert.alert('Success', `Page "${title}" updated successfully.`);
        } catch (err) {
            Alert.alert('Error', err.message || 'Failed to save page.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <ScrollView 
            style={{ flex: 1, backgroundColor: '#F8FAFC' }} 
            contentContainerStyle={{ padding: 16, paddingBottom: 60 }}
            showsVerticalScrollIndicator={false}
        >
            {/* Header */}
            <View style={{ marginBottom: 16 }}>
                <Text style={{ fontSize: 18, fontWeight: '900', color: NAVY }}>
                    Content Management System (CMS)
                </Text>
                <Text style={{ color: '#64748B', fontSize: 11.5, marginTop: 2 }}>
                    Manage and update pages including About, Terms, Privacy, FAQ and more
                </Text>
            </View>

            {/* Page Selector Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginBottom: 16 }}>
                {PAGES.map(page => {
                    const active = selectedPage === page.slug;
                    return (
                        <TouchableOpacity
                            key={page.slug}
                            onPress={() => {
                                setSelectedPage(page.slug);
                                setPreviewMode(false);
                            }}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 6,
                                paddingHorizontal: 14,
                                paddingVertical: 8,
                                borderRadius: 12,
                                backgroundColor: active ? NAVY : '#FFFFFF',
                                borderWidth: 1,
                                borderColor: active ? GOLD : '#E2E8F0',
                                shadowColor: NAVY,
                                shadowOffset: { width: 0, height: 2 },
                                shadowOpacity: active ? 0.1 : 0.03,
                                shadowRadius: 4,
                                elevation: 1
                            }}
                        >
                            <Ionicons name={page.icon} size={15} color={active ? GOLD : '#64748B'} />
                            <Text style={{
                                fontSize: 11.5,
                                fontWeight: '800',
                                color: active ? GOLD : '#64748B'
                            }}>
                                {page.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            {loading ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                    <ActivityIndicator size="large" color={GOLD} />
                    <Text style={{ marginTop: 12, fontSize: 12, fontWeight: '700', color: '#64748B' }}>Loading page content...</Text>
                </View>
            ) : (
                <View style={{
                    backgroundColor: '#FFFFFF',
                    padding: 18,
                    borderRadius: 20,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    shadowColor: NAVY,
                    shadowOffset: { width: 0, height: 2 },
                    shadowOpacity: 0.04,
                    shadowRadius: 6,
                    elevation: 1
                }}>
                    {/* Title & Preview Switch */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase' }}>
                            Taken Shafi (Page Title)
                        </Text>
                        <TouchableOpacity
                            onPress={() => setPreviewMode(!previewMode)}
                            style={{
                                flexDirection: 'row',
                                alignItems: 'center',
                                gap: 4,
                                backgroundColor: previewMode ? 'rgba(217, 167, 58, 0.15)' : '#F1F5F9',
                                paddingHorizontal: 10,
                                paddingVertical: 5,
                                borderRadius: 8,
                                borderWidth: 1,
                                borderColor: previewMode ? GOLD : 'transparent'
                            }}
                        >
                            <Ionicons name={previewMode ? "eye" : "eye-outline"} size={14} color={previewMode ? GOLD : NAVY} />
                            <Text style={{ fontSize: 11, fontWeight: '800', color: previewMode ? GOLD : NAVY }}>
                                {previewMode ? 'Edit Content' : 'Preview'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TextInput
                        style={{
                            backgroundColor: '#F8FAFC',
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            fontSize: 14,
                            fontWeight: '800',
                            color: NAVY,
                            marginBottom: 14
                        }}
                        value={title}
                        onChangeText={setTitle}
                        placeholder="Page Title"
                        placeholderTextColor="#94A3B8"
                    />

                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', textTransform: 'uppercase', marginBottom: 8 }}>
                        {previewMode ? 'Customer View Preview:' : 'Page Content:'}
                    </Text>

                    {previewMode ? (
                        <View style={{
                            backgroundColor: '#F8FAFC',
                            padding: 16,
                            borderRadius: 14,
                            minHeight: 250,
                            borderWidth: 1,
                            borderColor: '#E2E8F0'
                        }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: NAVY, marginBottom: 8 }}>{title}</Text>
                            <Text style={{ fontSize: 13, color: '#334155', lineHeight: 20 }}>
                                {content || 'No content has been entered yet.'}
                            </Text>
                        </View>
                    ) : (
                        <View style={{
                            backgroundColor: '#F8FAFC',
                            borderRadius: 14,
                            borderWidth: 1,
                            borderColor: '#E2E8F0',
                            minHeight: 300,
                            padding: 14
                        }}>
                            <TextInput
                                style={{ flex: 1, textAlignVertical: 'top', fontSize: 13.5, color: NAVY, lineHeight: 20 }}
                                multiline
                                placeholder="Write page content here..."
                                placeholderTextColor="#94A3B8"
                                value={content}
                                onChangeText={setContent}
                            />
                        </View>
                    )}

                    {/* Save Button */}
                    <TouchableOpacity
                        onPress={handleSave}
                        disabled={saving}
                        style={{
                            backgroundColor: NAVY,
                            padding: 15,
                            borderRadius: 14,
                            alignItems: 'center',
                            marginTop: 18,
                            borderWidth: 1,
                            borderColor: GOLD
                        }}
                    >
                        {saving ? (
                            <ActivityIndicator color={GOLD} />
                        ) : (
                            <Text style={{ color: GOLD, fontWeight: '900', fontSize: 13.5, letterSpacing: 0.3 }}>
                                SAVE PAGE CONTENT
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            )}
        </ScrollView>
    );
};
