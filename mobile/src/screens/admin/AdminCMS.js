import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, ScrollView } from 'react-native';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminCMS = () => {
    const [selectedPage, setSelectedPage] = useState('about');
    const [content, setContent] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        fetchPage();
    }, [selectedPage]);

    const fetchPage = async () => {
        setLoading(true);
        const { data } = await supabase.from('app_pages').select('content').eq('slug', selectedPage).single();
        if (data) setContent(data.content || '');
        else setContent('');
        setLoading(false);
    };

    const handleSave = async () => {
        setLoading(true);
        // Upsert by slug logic manually since we might not have ID
        const { data: existing } = await supabase.from('app_pages').select('id').eq('slug', selectedPage).single();

        let result;
        if (existing) {
            result = await supabase.from('app_pages').update({ content, updated_at: new Date() }).eq('id', existing.id);
        } else {
            result = await supabase.from('app_pages').insert([{
                slug: selectedPage,
                title: selectedPage.charAt(0).toUpperCase() + selectedPage.slice(1) + ' Us', // rough title
                content
            }]);
        }

        if (result.error) Alert.alert('Error', result.error.message);
        else Alert.alert('Success', 'Page Updated');
        setLoading(false);
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: 'white' }} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.sectionTitle}>Content Manager</Text>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
                {['about', 'terms', 'privacy'].map(slug => (
                    <TouchableOpacity
                        key={slug}
                        onPress={() => setSelectedPage(slug)}
                        style={{
                            paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20,
                            backgroundColor: selectedPage === slug ? '#0F172A' : '#F1F5F9'
                        }}
                    >
                        <Text style={{ color: selectedPage === slug ? 'white' : '#64748B', fontWeight: '600', textTransform: 'capitalize' }}>{slug}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <View style={{ backgroundColor: '#F8FAFC', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', minHeight: 400 }}>
                <TextInput
                    style={{ flex: 1, textAlignVertical: 'top', fontSize: 14, color: '#334155' }}
                    multiline
                    placeholder="Enter page content here (Markdown or Plain Text)..."
                    value={content}
                    onChangeText={setContent}
                />
            </View>

            <TouchableOpacity
                onPress={handleSave}
                disabled={loading}
                style={{ backgroundColor: '#3B82F6', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20 }}
            >
                <Text style={{ color: 'white', fontWeight: '700' }}>{loading ? 'Saving...' : 'Save Content'}</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};
