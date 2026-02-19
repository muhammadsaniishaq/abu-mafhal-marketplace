import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, FlatList, TextInput, Alert, Modal, Switch, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { styles } from '../../styles/theme';

export const AdminCoupons = () => {
    const [coupons, setCoupons] = useState([]);
    const [loading, setLoading] = useState(false);
    const [modalVisible, setModalVisible] = useState(false);

    // Form State
    const [code, setCode] = useState('');
    const [discountType, setDiscountType] = useState('percentage'); // or 'fixed'
    const [value, setValue] = useState('');
    const [usageLimit, setUsageLimit] = useState('');
    const [minOrder, setMinOrder] = useState('');

    useEffect(() => {
        fetchCoupons();
    }, []);

    const fetchCoupons = async () => {
        const { data, error } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
        if (data) setCoupons(data);
    };

    const handleCreateCoupon = async () => {
        if (!code || !value) return Alert.alert('Error', 'Code and Value are required');

        const { error } = await supabase.from('coupons').insert([{
            code: code.toUpperCase(),
            discount_type: discountType,
            discount_value: parseFloat(value),
            usage_limit: usageLimit ? parseInt(usageLimit) : null,
            min_order_amount: minOrder ? parseFloat(minOrder) : 0,
            is_active: true
        }]);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            Alert.alert('Success', 'Coupon Created');
            setModalVisible(false);
            fetchCoupons();
            // Reset Form
            setCode(''); setValue(''); setUsageLimit(''); setMinOrder('');
        }
    };

    const toggleActive = async (id, currentStatus) => {
        const { error } = await supabase.from('coupons').update({ is_active: !currentStatus }).eq('id', id);
        if (!error) {
            setCoupons(prev => prev.map(c => c.id === id ? { ...c, is_active: !currentStatus } : c));
        }
    };

    const deleteCoupon = async (id) => {
        Alert.alert('Delete', 'Are you sure?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    await supabase.from('coupons').delete().eq('id', id);
                    setCoupons(prev => prev.filter(c => c.id !== id));
                }
            }
        ]);
    };

    return (
        <View style={{ flex: 1, backgroundColor: 'white' }}>
            <View style={{ padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={styles.sectionTitle}>Promo Codes</Text>
                <TouchableOpacity onPress={() => setModalVisible(true)} style={{ backgroundColor: '#0F172A', padding: 8, borderRadius: 8 }}>
                    <Ionicons name="add" size={24} color="white" />
                </TouchableOpacity>
            </View>

            <FlatList
                data={coupons}
                keyExtractor={item => item.id}
                contentContainerStyle={{ paddingHorizontal: 20 }}
                renderItem={({ item }) => (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, backgroundColor: '#F8FAFC', borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <View>
                            <Text style={{ fontWeight: '800', fontSize: 18, color: '#0F172A' }}>{item.code}</Text>
                            <Text style={{ color: '#64748B', fontSize: 12 }}>
                                {item.discount_type === 'percentage' ? `${item.discount_value}% OFF` : `₦${item.discount_value} OFF`}
                            </Text>
                            <Text style={{ fontSize: 10, color: '#94A3B8' }}>Used: {item.usage_count} / {item.usage_limit || '∞'}</Text>
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <Switch
                                value={item.is_active}
                                onValueChange={() => toggleActive(item.id, item.is_active)}
                                trackColor={{ false: '#E2E8F0', true: '#10B981' }}
                            />
                            <TouchableOpacity onPress={() => deleteCoupon(item.id)}>
                                <Ionicons name="trash-outline" size={20} color="#EF4444" />
                            </TouchableOpacity>
                        </View>
                    </View>
                )}
            />

            <Modal visible={modalVisible} animationType="slide" transparent>
                <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
                    <View style={{ backgroundColor: 'white', borderRadius: 20, padding: 20 }}>
                        <Text style={{ fontSize: 18, fontWeight: '800', marginBottom: 20 }}>Create New Coupon</Text>

                        <TextInput style={localStyles.input} placeholder="Code (e.g. SUMMER20)" value={code} onChangeText={setCode} autoCapitalize="characters" />

                        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 15 }}>
                            {['percentage', 'fixed'].map(t => (
                                <TouchableOpacity key={t} onPress={() => setDiscountType(t)} style={[localStyles.chip, discountType === t && localStyles.activeChip]}>
                                    <Text style={{ color: discountType === t ? 'white' : '#64748B', fontWeight: '600', textTransform: 'capitalize' }}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>

                        <TextInput style={localStyles.input} placeholder="Value (e.g. 20)" value={value} onChangeText={setValue} keyboardType="numeric" />
                        <TextInput style={localStyles.input} placeholder="Usage Limit (Optional)" value={usageLimit} onChangeText={setUsageLimit} keyboardType="numeric" />
                        <TextInput style={localStyles.input} placeholder="Min Order Amount (Optional)" value={minOrder} onChangeText={setMinOrder} keyboardType="numeric" />

                        <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                            <TouchableOpacity onPress={() => setModalVisible(false)} style={{ flex: 1, padding: 14, backgroundColor: '#F1F5F9', borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ fontWeight: '700', color: '#64748B' }}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={handleCreateCoupon} style={{ flex: 1, padding: 14, backgroundColor: '#0F172A', borderRadius: 12, alignItems: 'center' }}>
                                <Text style={{ fontWeight: '700', color: 'white' }}>Create</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const localStyles = {
    input: { backgroundColor: '#F8FAFC', padding: 14, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16 },
    chip: { flex: 1, padding: 12, borderRadius: 10, backgroundColor: '#F1F5F9', alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
    activeChip: { backgroundColor: '#0F172A', borderColor: '#0F172A' }
};
