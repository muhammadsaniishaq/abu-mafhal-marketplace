import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, RefreshControl, Modal, ActivityIndicator, Animated, Dimensions, Platform, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { ServiceIcon } from '../../components/ServiceIcon';
// import { LinearGradient } from 'expo-linear-gradient'; // REMOVED to fix crash

// --- MODERN UI COMPONENTS ---

const SectionHeader = ({ title, count, onAdd, icon }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 24, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {icon && <Ionicons name={icon} size={20} color="#0F172A" />}
            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 }}>{title}</Text>
            {count !== undefined && (
                <View style={{ backgroundColor: '#E2E8F0', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#475569' }}>{count}</Text>
                </View>
            )}
        </View>
        {onAdd && (
            <TouchableOpacity onPress={onAdd} style={{ backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                <Ionicons name="add" size={18} color="white" />
                <Text style={{ color: 'white', fontWeight: '700', fontSize: 13 }}>Add New</Text>
            </TouchableOpacity>
        )}
    </View>
);

const FeatureCard = ({ image, title, subtitle, isActive, onToggle, activeLabel = "Active", inactiveLabel = "Inactive", activeColor = "#10B981" }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
        <Image
            source={{ uri: image || 'https://placehold.co/100' }}
            style={{ width: 56, height: 56, borderRadius: 28, marginRight: 16, backgroundColor: '#F1F5F9' }}
        />
        <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 16, marginBottom: 4 }} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.7}
            style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 24,
                backgroundColor: isActive ? `${activeColor}15` : '#F1F5F9',
                borderWidth: 1, borderColor: isActive ? activeColor : '#E2E8F0',
                flexDirection: 'row', alignItems: 'center', gap: 6
            }}
        >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isActive ? activeColor : '#94A3B8' }} />
            <Text style={{ fontSize: 13, fontWeight: '700', color: isActive ? activeColor : '#64748B' }}>
                {isActive ? activeLabel : inactiveLabel}
            </Text>
        </TouchableOpacity>
    </View>
);

const StatsRail = ({ stats }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 20 }}>
        {stats.map((stat, i) => (
            <View key={i} style={{ backgroundColor: 'white', padding: 16, borderRadius: 20, minWidth: 150, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ padding: 10, backgroundColor: `${stat.color}15`, borderRadius: 12 }}>
                        <Ionicons name={stat.icon} size={20} color={stat.color} />
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#64748B', letterSpacing: 0.5 }}>{stat.label.toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: '#0F172A' }}>{stat.value}</Text>
            </View>
        ))}
    </ScrollView>
);

const Toast = ({ message, type = 'success', visible, onHide }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
                Animated.delay(2500),
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: false })
            ]).start(() => onHide && onHide());
        }
    }, [visible]);

    if (!visible) return null;

    const bgColor = type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6';
    const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';

    return (
        <Animated.View style={{
            position: 'absolute', top: 64, left: 16, right: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 20, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 16,
            boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
            borderLeftWidth: 6, borderLeftColor: bgColor, opacity: fadeAnim, zIndex: 1000
        }}>
            <View style={{ padding: 10, backgroundColor: `${bgColor}20`, borderRadius: 14 }}>
                <Ionicons name={icon} size={28} color={bgColor} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 16, marginBottom: 4 }}>{type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice'}</Text>
                <Text style={{ color: '#475569', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{message}</Text>
            </View>
        </Animated.View>
    );
};

const SearchModal = ({ visible, onClose, title, onSearch, results, onSelect, placeholder, creating, onCreate }) => {
    const [query, setQuery] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSearch = async (text) => {
        setQuery(text);
        if (text.length > 2) {
            setLoading(true);
            await onSearch(text);
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" presentationStyle="pageSheet">
            <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, borderBottomWidth: 1, borderColor: '#F1F5F9', backgroundColor: 'white' }}>
                    <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>{title}</Text>
                    <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: '#F1F5F9', borderRadius: 20 }}>
                        <Ionicons name="close" size={24} color="#64748B" />
                    </TouchableOpacity>
                </View>

                <View style={{ padding: 20 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', height: 64, marginBottom: 20, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowRadius: 8 }}>
                        <Ionicons name="search" size={24} color="#94A3B8" />
                        <TextInput
                            placeholder={placeholder}
                            value={query}
                            onChangeText={handleSearch}
                            style={{ flex: 1, marginLeft: 16, fontSize: 17, fontWeight: '600', color: '#0F172A' }}
                            placeholderTextColor="#94A3B8"
                            autoFocus
                        />
                        {loading && <ActivityIndicator size="small" color="#3B82F6" />}
                    </View>

                    <ScrollView contentContainerStyle={{ paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
                        {results.map((item, i) => (
                            <TouchableOpacity
                                key={i}
                                onPress={() => { onSelect(item); onClose(); }}
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowRadius: 4 }}
                            >
                                <Image source={{ uri: item.image || 'https://placehold.co/100' }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 16, backgroundColor: '#F1F5F9' }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 17 }}>{item.title}</Text>
                                    {item.subtitle && <Text style={{ fontSize: 14, color: '#64748B', marginTop: 4, fontWeight: '500' }}>{item.subtitle}</Text>}
                                </View>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center' }}>
                                    <Ionicons name="add" size={22} color="#3B82F6" />
                                </View>
                            </TouchableOpacity>
                        ))}

                        {!loading && results.length === 0 && query.length > 2 && (
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <View style={{ width: 100, height: 100, borderRadius: 50, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                                    <Ionicons name="search-outline" size={48} color="#94A3B8" />
                                </View>
                                <Text style={{ color: '#0F172A', fontWeight: '800', fontSize: 18, marginBottom: 8 }}>No results found</Text>
                                <Text style={{ color: '#64748B', fontSize: 15, textAlign: 'center' }}>We couldn't find anything matching "{query}"</Text>

                                {onCreate && (
                                    <TouchableOpacity onPress={() => { onCreate(query); onClose(); }} style={{ marginTop: 32, backgroundColor: '#0F172A', paddingHorizontal: 32, paddingVertical: 16, borderRadius: 32, flexDirection: 'row', alignItems: 'center', gap: 10, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowRadius: 10 }}>
                                        <Ionicons name="add-circle" size={22} color="white" />
                                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 16 }}>Create "{query}"</Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                        )}
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
};

// --- MAIN SCREEN ---

export const AdminHomeSettings = () => {
    const [activeTab, setActiveTab] = useState('marketplace');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    const [vendors, setVendors] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [brands, setBrands] = useState([]);
    const [services, setServices] = useState([]);
    const [editingService, setEditingService] = useState(null);

    const [searchResults, setSearchResults] = useState([]);
    const [modalConfig, setModalConfig] = useState({ visible: false, type: null });
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });

    const [systemStatus, setSystemStatus] = useState({
        dbConnection: null,
        columns: { is_featured: null, is_displayed: null }
    });

    const showToast = (message, type = 'success') => {
        setToast({ visible: true, message, type });
    };

    const fetchData = useCallback(async () => {
        try {
            // 1. Vendors
            const { data: vData } = await supabase.from('vendors').select('*').eq('is_verified', true);
            setVendors(vData || []);

            // 2. Customers
            const { data: cData } = await supabase.from('profiles').select('*').eq('is_featured', true);
            setTopCustomers(cData || []);

            // 3. Reviews
            // 3. Reviews (Fetch ALL so admin can choose)
            const { data: rData } = await supabase
                .from('reviews')
                .select('*, user:user_id(full_name, avatar_url)')
                .order('is_displayed', { ascending: false }) // Active first
                .order('rating', { ascending: false })       // Then 5 stars
                .order('created_at', { ascending: false })
                .limit(20);
            setReviews(rData || []);

            // 4. Brands
            const { data: bData } = await supabase.from('brands').select('*').eq('is_featured', true).order('name');
            setBrands(bData || []);

            // 5. Services
            const { data: sData } = await supabase.from('home_services').select('*').order('display_order');
            setServices(sData || []);

        } catch (e) {
            console.error('Fetch Error:', e);
            showToast('Failed to load dashboard data. Check connection.', 'error');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    const checkSystemHealth = async () => {
        try {
            const { error: bError } = await supabase.from('brands').select('is_featured').limit(1);
            const { error: rError } = await supabase.from('reviews').select('is_displayed').limit(1);

            setSystemStatus({
                dbConnection: true,
                columns: { is_featured: !bError, is_displayed: !rError }
            });
        } catch (e) {
            setSystemStatus(prev => ({ ...prev, dbConnection: false }));
        }
    };

    useEffect(() => {
        fetchData();
        checkSystemHealth();
    }, [fetchData]);

    const onRefresh = () => {
        setRefreshing(true);
        fetchData();
        checkSystemHealth();
    };

    // --- LOGIC ---

    const performSearch = async (query, type) => {
        let results = [];
        try {
            if (type === 'vendor') {
                // Handle different implementations of search (RPC vs raw query)
                // Fallback to simpler ILIKE if .or() causes issues, but .or() is standard
                const { data, error } = await supabase.from('vendors').select('*').or(`store_name.ilike.%${query}%,business_name.ilike.%${query}%`).limit(10);

                if (error) throw error;

                results = data?.map(v => ({
                    ...v,
                    title: v.store_name || v.business_name || 'Unnamed Vendor',
                    subtitle: v.subscription_plan || 'No Plan',
                    image: v.logo_url
                })) || [];

            } else if (type === 'brand') {
                const { data } = await supabase.from('brands').select('*').ilike('name', `%${query}%`).limit(10);
                results = data?.map(b => ({ ...b, title: b.name, image: b.logo_url })) || [];

            } else if (type === 'customer') {
                const { data } = await supabase.from('profiles').select('*').ilike('full_name', `%${query}%`).limit(10);
                results = data?.map(c => ({ ...c, title: c.full_name || 'Unknown User', subtitle: c.email, image: c.avatar_url })) || [];
            }
            setSearchResults(results);
        } catch (e) {
            console.error(e);
            showToast('Search encountered an error', 'error');
        }
    };

    const handleAddItem = async (item) => {
        const type = modalConfig.type;
        try {
            let error = null;
            if (type === 'vendor') {
                const { error: e } = await supabase.from('vendors').update({ is_verified: true }).eq('id', item.id);
                if (!e) setVendors(prev => [...prev.filter(v => v.id !== item.id), { ...item, is_verified: true }]);
                error = e;
            } else if (type === 'brand') {
                const { error: e } = await supabase.from('brands').update({ is_featured: true }).eq('id', item.id);
                if (!e) setBrands(prev => [...prev.filter(b => b.id !== item.id), { ...item, is_featured: true }]);
                error = e;
            } else if (type === 'customer') {
                const { error: e } = await supabase.from('profiles').update({ is_featured: true }).eq('id', item.id);
                if (!e) setTopCustomers(prev => [...prev.filter(c => c.id !== item.id), { ...item, is_featured: true }]);
                error = e;
            }

            if (error) throw error;
            showToast(`${type} added successfully!`, 'success');

        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const handleCreateBrand = async (name) => {
        try {
            const { data, error } = await supabase.from('brands').insert([{ name, is_featured: true }]).select().single();
            if (error) throw error;
            setBrands(prev => [...prev, data]);
            showToast(`Brand "${name}" created!`, 'success');
        } catch (e) {
            showToast(e.message, 'error');
        }
    };

    const toggleStatus = async (table, id, field, currentVal) => {
        // Optimistic Remove
        const removeFromList = (setter) => setter(prev => prev.filter(i => i.id !== id));

        if (currentVal === true) {
            if (table === 'vendors') removeFromList(setVendors);
            if (table === 'profiles') removeFromList(setTopCustomers);
            if (table === 'brands') removeFromList(setBrands);
            if (table === 'reviews') removeFromList(setReviews);
        }

        const { error } = await supabase.from(table).update({ [field]: !currentVal }).eq('id', id);
        if (error) {
            showToast('Failed to update status', 'error');
            onRefresh(); // Revert logic by refreshing
        } else {
            showToast('Updated successfully', 'success');
        }
    };

    const handleSaveService = async () => {
        if (!editingService.title || !editingService.icon) return showToast('Title & Icon required', 'error');

        setLoading(true);
        const { error } = await supabase.from('home_services').upsert(editingService);
        setLoading(false);

        if (error) showToast(error.message, 'error');
        else {
            showToast('Service saved successfully!', 'success');
            setEditingService(null);
            fetchData();
        }
    };

    // --- RENDER SECTIONS ---

    const renderMarketplace = () => (
        <View style={{ paddingBottom: 100 }}>
            <StatsRail stats={[
                { label: 'Verified Sellers', value: vendors.length, icon: 'shield-checkmark', color: '#3B82F6' },
                { label: 'Featured Brands', value: brands.length, icon: 'pricetag', color: '#8B5CF6' },
                { label: 'Total Revenue', value: '₦4.2M', icon: 'wallet', color: '#10B981' }
            ]} />

            <View style={{ padding: 20 }}>
                <SectionHeader title="Verified Sellers" count={vendors.length} onAdd={() => setModalConfig({ visible: true, type: 'vendor' })} />
                {vendors.map(vendor => (
                    <FeatureCard
                        key={vendor.id}
                        title={vendor.store_name || vendor.business_name || 'Unnamed Vendor'}
                        subtitle={vendor.subscription_plan || 'Basic Plan'}
                        image={vendor.logo_url}
                        isActive={true}
                        activeLabel="Verified"
                        activeColor="#3B82F6"
                        onToggle={() => toggleStatus('vendors', vendor.id, 'is_verified', true)}
                    />
                ))}

                <SectionHeader title="Featured Brands" count={brands.length} onAdd={() => setModalConfig({ visible: true, type: 'brand' })} />
                {brands.map(brand => (
                    <FeatureCard
                        key={brand.id}
                        title={brand.name}
                        image={brand.logo_url}
                        isActive={true}
                        activeLabel="Featured"
                        activeColor="#8B5CF6"
                        onToggle={() => toggleStatus('brands', brand.id, 'is_featured', true)}
                    />
                ))}
            </View>
        </View>
    );

    const renderEngagement = () => (
        <View style={{ paddingBottom: 100 }}>
            <StatsRail stats={[
                { label: 'Elite Members', value: topCustomers.length, icon: 'star', color: '#F59E0B' },
                { label: 'Reviews', value: reviews.length, icon: 'chatbox-ellipses', color: '#EC4899' },
            ]} />

            <View style={{ padding: 20 }}>
                <SectionHeader title="Elite Customers" count={topCustomers.length} onAdd={() => setModalConfig({ visible: true, type: 'customer' })} />
                {topCustomers.map(customer => (
                    <FeatureCard
                        key={customer.id}
                        title={customer.full_name || 'Anonymous User'}
                        subtitle={`Total Spend: ₦${(customer.total_spend || 0).toLocaleString()}`}
                        image={customer.avatar_url}
                        isActive={true}
                        activeLabel="VIP Status"
                        activeColor="#F59E0B"
                        onToggle={() => toggleStatus('profiles', customer.id, 'is_featured', true)}
                    />
                ))}

                <SectionHeader title="Customer Testimonials" count={reviews.length} />
                {reviews.map(review => (
                    <View key={review.id} style={{ backgroundColor: 'white', padding: 20, borderRadius: 24, marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Image source={{ uri: review.user?.avatar_url || 'https://placehold.co/50' }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9' }} />
                                <View>
                                    <Text style={{ fontWeight: '800', fontSize: 15, color: '#0F172A' }}>{review.user?.full_name}</Text>
                                    <View style={{ flexDirection: 'row', gap: 2 }}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Ionicons key={s} name="star" size={12} color={s <= review.rating ? "#F59E0B" : "#E2E8F0"} />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>
                        <Text style={{ fontSize: 16, color: '#334155', lineHeight: 24, marginBottom: 16, fontWeight: '500' }}>"{review.comment}"</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <TouchableOpacity
                                onPress={() => toggleStatus('reviews', review.id, 'is_displayed', review.is_displayed)}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 8,
                                    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24,
                                    backgroundColor: review.is_displayed ? '#DBEAFE' : '#F1F5F9',
                                    borderWidth: 1, borderColor: review.is_displayed ? '#3B82F6' : '#E2E8F0'
                                }}
                            >
                                <Ionicons name={review.is_displayed ? "eye" : "eye-off"} size={18} color={review.is_displayed ? "#3B82F6" : "#64748B"} />
                                <Text style={{ fontSize: 13, fontWeight: '700', color: review.is_displayed ? "#1E40AF" : "#64748B" }}>
                                    {review.is_displayed ? "Published on Home" : "Hidden"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );

    const renderServiceConfig = () => (
        <View style={{ padding: 20, paddingBottom: 100 }}>
            <StatsRail stats={[
                { label: 'Active Services', value: services.filter(s => s.is_active).length, icon: 'apps', color: '#14B8A6' },
            ]} />

            <SectionHeader title="Service Highlights" onAdd={() => setEditingService({ title: '', icon: '', lib: 'mc', bg_color: '#3B82F6', display_order: services.length + 1 })} />

            {editingService && (
                <View style={{ backgroundColor: 'white', padding: 24, borderRadius: 24, marginBottom: 24, borderWidth: 1, borderColor: '#3B82F6', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', }}>
                    <Text style={{ fontWeight: '900', marginBottom: 24, fontSize: 20, color: '#0F172A' }}>{editingService.id ? 'Edit Service' : 'New Service'}</Text>

                    <View style={{ gap: 20 }}>
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>SERVICE TITLE</Text>
                            <TextInput
                                placeholder="e.g. Fast Shipping"
                                value={editingService.title}
                                onChangeText={t => setEditingService({ ...editingService, title: t })}
                                style={{ backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 16, fontWeight: '600', color: '#0F172A' }}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 16 }}>
                            <View style={{ flex: 2 }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>ICON NAME</Text>
                                <TextInput
                                    placeholder="e.g. truck"
                                    value={editingService.icon}
                                    onChangeText={t => setEditingService({ ...editingService, icon: t })}
                                    style={{ backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#0F172A' }}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>LIB</Text>
                                <TextInput
                                    placeholder="mc"
                                    value={editingService.lib}
                                    onChangeText={t => setEditingService({ ...editingService, lib: t })}
                                    style={{ backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#0F172A' }}
                                />
                            </View>
                        </View>
                        <View>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>BRAND COLOR</Text>
                            <TextInput
                                placeholder="#HEX"
                                value={editingService.bg_color}
                                onChangeText={t => setEditingService({ ...editingService, bg_color: t })}
                                style={{ backgroundColor: '#F8FAFC', padding: 18, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#0F172A' }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 16, marginTop: 32 }}>
                        <TouchableOpacity onPress={() => setEditingService(null)} style={{ flex: 1, padding: 18, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 16 }}>
                            <Text style={{ color: '#64748B', fontWeight: '800', fontSize: 15 }}>Discard</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSaveService} style={{ flex: 1, backgroundColor: '#0F172A', padding: 18, borderRadius: 16, alignItems: 'center', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowRadius: 10 }}>
                            <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {services.map(svc => (
                <View key={svc.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowRadius: 4 }}>
                    <View style={{ marginRight: 20 }}>
                        <ServiceIcon icon={svc.icon} label="" color={svc.bg_color || '#3B82F6'} lib={svc.lib} onPress={() => { }} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 17 }}>{svc.title}</Text>
                        <Text style={{ fontSize: 14, color: '#64748B', fontWeight: '600', marginTop: 2 }}>Order: {svc.display_order}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setEditingService(svc)} style={{ width: 44, height: 44, backgroundColor: '#EFF6FF', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name="pencil" size={20} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleStatus('home_services', svc.id, 'is_active', svc.is_active)} style={{ width: 44, height: 44, backgroundColor: svc.is_active ? '#ECFDF5' : '#F1F5F9', borderRadius: 16, alignItems: 'center', justifyContent: 'center' }}>
                            <Ionicons name={svc.is_active ? "eye" : "eye-off"} size={20} color={svc.is_active ? "#10B981" : "#94A3B8"} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderSystemStatus = () => (
        <View style={{ padding: 20 }}>
            <View style={{ backgroundColor: '#0F172A', padding: 28, borderRadius: 28, marginBottom: 24, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',shadowRadius: 16 }}>
                <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Ionicons name="hardware-chip-outline" size={32} color="white" />
                </View>
                <Text style={{ fontSize: 26, fontWeight: '900', color: 'white', marginBottom: 10 }}>System Health</Text>
                <Text style={{ color: '#94A3B8', fontSize: 16, lineHeight: 24 }}>Real-time diagnostics of database connections, schema integrity, and API status.</Text>
            </View>

            <View style={{ gap: 16 }}>
                {[
                    { label: 'Database Connection', status: systemStatus.dbConnection, activeText: 'Operational', inactiveText: 'Failed' },
                    { label: 'Brand Features Schema', status: systemStatus.columns.is_featured, activeText: 'Active', inactiveText: 'Missing Schema' },
                    { label: 'Review Management Schema', status: systemStatus.columns.is_displayed, activeText: 'Active', inactiveText: 'Missing Schema' }
                ].map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, backgroundColor: 'white', borderRadius: 24, borderWidth: 1, borderColor: '#E2E8F0' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                            <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: item.status ? '#10B981' : '#EF4444', shadowColor: item.status ? '#10B981' : '#EF4444', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.5, shadowRadius: 4 }} />
                            <Text style={{ fontWeight: '700', fontSize: 16, color: '#0F172A' }}>{item.label}</Text>
                        </View>
                        <Text style={{ color: item.status ? '#10B981' : '#EF4444', fontWeight: '800' }}>
                            {item.status ? item.activeText : item.inactiveText}
                        </Text>
                    </View>
                ))}
            </View>

            {(!systemStatus.columns.is_featured || !systemStatus.columns.is_displayed) && (
                <View style={{ marginTop: 32, padding: 24, backgroundColor: '#FEF2F2', borderRadius: 24, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Ionicons name="warning" size={36} color="#EF4444" style={{ marginBottom: 16 }} />
                    <Text style={{ color: '#7F1D1D', fontWeight: '900', fontSize: 20, marginBottom: 12 }}>Action Required</Text>
                    <Text style={{ color: '#991B1B', fontSize: 16, lineHeight: 24 }}>
                        Your database is missing critical columns. Please run the `admin_home_customization.sql` script immediately to prevent app crashes.
                    </Text>
                </View>
            )}
        </View>
    );

    const TabButton = ({ id, label, icon }) => (
        <TouchableOpacity
            onPress={() => setActiveTab(id)}
            style={{
                flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12,
                borderRadius: 16,
                backgroundColor: activeTab === id ? 'white' : 'transparent',
                shadowColor: activeTab === id ? "#000" : "transparent", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4
            }}
        >
            <Text style={{ fontWeight: '800', color: activeTab === id ? '#0F172A' : '#94A3B8', fontSize: 13 }}>{label}</Text>
        </TouchableOpacity>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(t => ({ ...t, visible: false }))} />

            {/* Header Tabs */}
            <View style={{ paddingHorizontal: 12, paddingVertical: 16, backgroundColor: '#F1F5F9', paddingTop: 20 }}>
                <View style={{ flexDirection: 'row', backgroundColor: '#E2E8F0', padding: 4, borderRadius: 20 }}>
                    <TabButton id="marketplace" label="Marketplace" />
                    <TabButton id="engagement" label="Social" />
                    <TabButton id="services" label="Services" />
                    <TouchableOpacity onPress={() => setActiveTab('system')} style={{ width: 50, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="settings-sharp" size={20} color={activeTab === 'system' ? '#0F172A' : '#94A3B8'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                {activeTab === 'marketplace' && renderMarketplace()}
                {activeTab === 'engagement' && renderEngagement()}
                {activeTab === 'services' && renderServiceConfig()}
                {activeTab === 'system' && renderSystemStatus()}
            </ScrollView>

            <SearchModal
                visible={modalConfig.visible}
                onClose={() => setModalConfig({ visible: false, type: null })}
                title={`Add ${modalConfig.type === 'vendor' ? 'Verified Seller' : modalConfig.type === 'brand' ? 'Featured Brand' : 'Elite Customer'}`}
                placeholder={`Search ${modalConfig.type}s...`}
                onSearch={(q) => performSearch(q, modalConfig.type)}
                results={searchResults}
                onSelect={handleAddItem}
                creating={modalConfig.type === 'brand'}
                onCreate={modalConfig.type === 'brand' ? handleCreateBrand : null}
            />
        </View>
    );
};
