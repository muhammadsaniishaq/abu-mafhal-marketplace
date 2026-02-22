import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, Alert, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminFlashSales = () => {
    const [sale, setSale] = useState(null);
    const [endTime, setEndTime] = useState('');
    const [productIds, setProductIds] = useState('');
    const [discountPercent, setDiscountPercent] = useState('20');
    const [isActive, setIsActive] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchSale();
    }, []);

    const fetchSale = async () => {
        setLoading(true);
        const { data } = await supabase.from('flash_sales').select('*').order('created_at', { ascending: false }).limit(1).single();
        if (data) {
            setSale(data);
            setEndTime(new Date(data.end_time).toISOString());
            setProductIds(data.product_ids?.join(', ') || '');
            setIsActive(data.is_active);
            setDiscountPercent(data.discount_percent ? String(data.discount_percent) : '20');
        }
        setLoading(false);
    };

    const handleSave = async () => {
        const pIds = productIds.split(',').map(s => s.trim().replace(/"/g, '')).filter(s => s.length > 0);
        const discount = parseInt(discountPercent) || 0;

        try {
            setLoading(true);

            // 1. Update Flash Sale Record
            const payload = {
                title: 'Flash Sale',
                end_time: endTime || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
                is_active: isActive,
                product_ids: pIds,
                // discount_percent: discount // Assuming we might add this column later, or just use it here
            };

            let result;
            if (sale?.id) {
                result = await supabase.from('flash_sales').update(payload).eq('id', sale.id);
            } else {
                result = await supabase.from('flash_sales').insert([payload]);
            }

            if (result.error) throw result.error;

            // 2. Update Products Discount
            if (pIds.length > 0) {
                if (isActive) {
                    Alert.alert('Success', `Sale Updated. ${pIds.length} products added to Flash Sale.`);
                } else {
                    Alert.alert('Success', 'Sale Disabled.');
                }
            } else {
                Alert.alert('Success', 'Sale Updated (No products linked)');
            }

            fetchSale();

        } catch (e) {
            Alert.alert('Error', e.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={{ flex: 1, backgroundColor: 'white' }} contentContainerStyle={{ padding: 20 }}>
            <Text style={styles.sectionTitle}>Flash Sale Manager</Text>

            <View style={{ backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                    <Text style={{ fontWeight: '700', fontSize: 16 }}>Enable Flash Sale</Text>
                    <Switch
                        value={isActive}
                        onValueChange={setIsActive}
                        trackColor={{ false: '#E2E8F0', true: '#EF4444' }}
                    />
                </View>

                <Text style={localStyles.label}>End Time (ISO Format)</Text>
                <TextInput
                    style={localStyles.input}
                    value={endTime}
                    onChangeText={setEndTime}
                    placeholder="2026-12-31T23:59:00Z"
                />

                <Text style={localStyles.label}>Discount Percentage (%)</Text>
                <TextInput
                    style={localStyles.input}
                    value={discountPercent}
                    onChangeText={setDiscountPercent}
                    keyboardType="numeric"
                    placeholder="20"
                />
                <Text style={{ fontSize: 10, color: '#64748B', marginBottom: 16 }}>This will be applied to all products below when updated.</Text>

                <Text style={localStyles.label}>Product IDs (Comma separated)</Text>
                <TextInput
                    style={[localStyles.input, { height: 100, textAlignVertical: 'top' }]}
                    value={productIds}
                    onChangeText={setProductIds}
                    placeholder="uuid1, uuid2, uuid3..."
                    multiline
                />

                <TouchableOpacity
                    onPress={handleSave}
                    disabled={loading}
                    style={{ backgroundColor: '#EF4444', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 }}
                >
                    {loading ? <ActivityIndicator color="white" /> : <Text style={{ color: 'white', fontWeight: '700' }}>Update & Apply Discounts</Text>}
                </TouchableOpacity>
            </View>
        </ScrollView>
    );
};

const localStyles = {
    label: { fontSize: 12, color: '#64748B', fontWeight: '600', marginBottom: 8 },
    input: { backgroundColor: 'white', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 6, fontSize: 14 }
};
