import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, RefreshControl, Modal, ActivityIndicator, Animated, Platform, ImageBackground } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../../lib/supabase';
import { ServiceIcon } from '../../components/ServiceIcon';
import { Toast } from '../../components/Toast';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';
// import { LinearGradient } from 'expo-linear-gradient'; // REMOVED to fix crash

// --- MODERN UI COMPONENTS ---

const SectionHeader = ({ title, count, onAdd, icon }) => (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, marginTop: 24, paddingHorizontal: 4 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            {icon && <Ionicons name={icon} size={20} color="#0E1A2E" />}
            <Text style={{ fontSize: 18, fontWeight: '900', color: '#0E1A2E', letterSpacing: -0.5 }}>{title}</Text>
            {count !== undefined && (
                <View style={{ backgroundColor: '#FFFBEB', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, borderWidth: 1, borderColor: '#FDE68A' }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: '#D9A73A' }}>{count}</Text>
                </View>
            )}
        </View>
        {onAdd && (
            <TouchableOpacity onPress={onAdd} style={{ backgroundColor: '#0E1A2E', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D9A73A', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2 }}>
                <Ionicons name="add" size={18} color="#D9A73A" />
                <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 13 }}>Add New</Text>
            </TouchableOpacity>
        )}
    </View>
);

const FeatureCard = ({ image, title, subtitle, isActive, onToggle, activeLabel = "Active", inactiveLabel = "Inactive", activeColor = "#10B981" }) => (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
        <Image
            source={{ uri: image || 'https://placehold.co/100' }}
            style={{ width: 56, height: 56, borderRadius: 28, marginRight: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }}
        />
        <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 15, marginBottom: 4 }} numberOfLines={1}>{title}</Text>
            {subtitle && <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '500' }} numberOfLines={1}>{subtitle}</Text>}
        </View>
        <TouchableOpacity
            onPress={onToggle}
            activeOpacity={0.7}
            style={{
                paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                backgroundColor: isActive ? `${activeColor}15` : '#F1F5F9',
                borderWidth: 1, borderColor: isActive ? activeColor : '#E2E8F0',
                flexDirection: 'row', alignItems: 'center', gap: 6
            }}
        >
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: isActive ? activeColor : '#94A3B8' }} />
            <Text style={{ fontSize: 12, fontWeight: '800', color: isActive ? activeColor : '#64748B' }}>
                {isActive ? activeLabel : inactiveLabel}
            </Text>
        </TouchableOpacity>
    </View>
);

const StatsRail = ({ stats }) => (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 20 }}>
        {stats.map((stat, i) => (
            <View key={i} style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, minWidth: 150, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                    <View style={{ padding: 10, backgroundColor: `${stat.color}15`, borderRadius: 12 }}>
                        <Ionicons name={stat.icon} size={20} color={stat.color} />
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', letterSpacing: 0.5 }}>{stat.label.toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 24, fontWeight: '900', color: '#0E1A2E' }}>{stat.value}</Text>
            </View>
        ))}
    </ScrollView>
);
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
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 16, borderRadius: 20, borderWidth: 1, borderColor: '#E2E8F0', height: 64, marginBottom: 20, boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', shadowRadius: 8 }}>
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
                                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 20, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}
                            >
                                <Image source={{ uri: item.image || 'https://placehold.co/100' }} style={{ width: 56, height: 56, borderRadius: 28, marginRight: 16, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }} />
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 16 }}>{item.title}</Text>
                                    {item.subtitle && <Text style={{ fontSize: 13, color: '#64748B', marginTop: 3, fontWeight: '500' }}>{item.subtitle}</Text>}
                                </View>
                                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#FFFBEB', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDE68A' }}>
                                    <Ionicons name="add" size={20} color="#D9A73A" />
                                </View>
                            </TouchableOpacity>
                        ))}

                        {!loading && results.length === 0 && query.length > 2 && (
                            <View style={{ alignItems: 'center', marginTop: 60 }}>
                                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                                    <Ionicons name="search-outline" size={40} color="#94A3B8" />
                                </View>
                                <Text style={{ color: '#0E1A2E', fontWeight: '800', fontSize: 17, marginBottom: 6 }}>No results found</Text>
                                <Text style={{ color: '#64748B', fontSize: 14, textAlign: 'center' }}>We couldn't find anything matching "{query}"</Text>

                                {onCreate && (
                                    <TouchableOpacity onPress={() => { onCreate(query); onClose(); }} style={{ marginTop: 24, backgroundColor: '#0E1A2E', paddingHorizontal: 26, paddingVertical: 14, borderRadius: 20, flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1, borderColor: '#D9A73A' }}>
                                        <Ionicons name="add-circle" size={20} color="#D9A73A" />
                                        <Text style={{ color: 'white', fontWeight: '800', fontSize: 15 }}>Create "{query}"</Text>
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

export const AdminHomeSettings = ({ navigation, onBack }) => {
    const [activeTab, setActiveTab] = useState('marketplace');
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [uploadingBanner, setUploadingBanner] = useState(false);

    const [vendors, setVendors] = useState([]);
    const [topCustomers, setTopCustomers] = useState([]);
    const [reviews, setReviews] = useState([]);
    const [brands, setBrands] = useState([]);
    const [services, setServices] = useState([]);
    const [editingService, setEditingService] = useState(null);
    const [totalRevenue, setTotalRevenue] = useState(0);

    const [searchResults, setSearchResults] = useState([]);
    const [modalConfig, setModalConfig] = useState({ visible: false, type: null });
    const [toast, setToast] = useState({ visible: false, message: '', type: 'success' });
    const [showDatePicker, setShowDatePicker] = useState(false);

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

            // 3. Reviews (Fetch ALL so admin can choose)
            const { data: rData } = await supabase
                .from('reviews')
                .select('*, user:user_id(full_name, avatar_url)')
                .order('is_displayed', { ascending: false })
                .order('rating', { ascending: false })
                .order('created_at', { ascending: false })
                .limit(20);
            setReviews(rData || []);

            // 4. Brands
            const { data: bData } = await supabase.from('brands').select('*').eq('is_featured', true).order('name');
            setBrands(bData || []);

            // 5. Services
            const { data: sData } = await supabase.from('home_services').select('*').order('display_order');
            setServices(sData || []);

            // 6. Live Total Revenue (Delivered / Completed)
            const { data: revData } = await supabase.from('orders').select('total_amount').or('status.eq.delivered,status.eq.completed');
            const rev = (revData || []).reduce((sum, item) => sum + (Number(item.total_amount) || 0), 0);
            setTotalRevenue(rev);

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
            } else if (type === 'product') {
                const { data } = await supabase.from('products').select('*').eq('status', 'approved').ilike('name', `%${query}%`).limit(10);
                results = data?.map(p => ({ ...p, title: p.name, subtitle: `₦${p.price}`, image: p.images?.[0] })) || [];
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
            } else if (type === 'product') {
                // Only selecting product for banner, not adding to a list
                setPromoBanner(prev => ({
                    ...prev,
                    linkData: { ...Object(prev.linkData), productId: item.id, productName: item.title }
                }));
                showToast(`Product attached to promo`, 'success');
                return; // Early return as we don't need the general success message
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
                { label: 'Verified Sellers', value: vendors.length, icon: 'shield-checkmark', color: '#0E1A2E' },
                { label: 'Featured Brands', value: brands.length, icon: 'pricetag', color: '#D9A73A' },
                { label: 'Total Revenue', value: `₦${totalRevenue >= 1000000 ? (totalRevenue / 1000000).toFixed(1) + 'M' : totalRevenue.toLocaleString()}`, icon: 'wallet', color: '#10B981' }
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
                        activeColor="#0E1A2E"
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
                        activeColor="#D9A73A"
                        onToggle={() => toggleStatus('brands', brand.id, 'is_featured', true)}
                    />
                ))}
            </View>
        </View>
    );

    const renderEngagement = () => (
        <View style={{ paddingBottom: 100 }}>
            <StatsRail stats={[
                { label: 'Elite Members', value: topCustomers.length, icon: 'star', color: '#D9A73A' },
                { label: 'Reviews', value: reviews.length, icon: 'chatbox-ellipses', color: '#0E1A2E' },
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
                        activeColor="#D9A73A"
                        onToggle={() => toggleStatus('profiles', customer.id, 'is_featured', true)}
                    />
                ))}

                <SectionHeader title="Customer Testimonials" count={reviews.length} />
                {reviews.map(review => (
                    <View key={review.id} style={{ backgroundColor: '#FFFFFF', padding: 20, borderRadius: 20, marginBottom: 14, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 6, elevation: 1 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                                <Image source={{ uri: review.user?.avatar_url || 'https://placehold.co/50' }} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F8FAFC', borderWidth: 1, borderColor: '#F1F5F9' }} />
                                <View>
                                    <Text style={{ fontWeight: '800', fontSize: 15, color: '#0E1A2E' }}>{review.user?.full_name || 'Customer'}</Text>
                                    <View style={{ flexDirection: 'row', gap: 2, marginTop: 2 }}>
                                        {[1, 2, 3, 4, 5].map(s => (
                                            <Ionicons key={s} name="star" size={13} color={s <= review.rating ? "#D9A73A" : "#E2E8F0"} />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        </View>
                        <Text style={{ fontSize: 14, color: '#334155', lineHeight: 22, marginBottom: 14, fontWeight: '500' }}>"{review.comment}"</Text>
                        <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
                            <TouchableOpacity
                                onPress={() => toggleStatus('reviews', review.id, 'is_displayed', review.is_displayed)}
                                style={{
                                    flexDirection: 'row', alignItems: 'center', gap: 8,
                                    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
                                    backgroundColor: review.is_displayed ? '#FFFBEB' : '#F1F5F9',
                                    borderWidth: 1, borderColor: review.is_displayed ? '#D9A73A' : '#E2E8F0'
                                }}
                            >
                                <Ionicons name={review.is_displayed ? "eye" : "eye-off"} size={16} color={review.is_displayed ? "#D9A73A" : "#64748B"} />
                                <Text style={{ fontSize: 12, fontWeight: '800', color: review.is_displayed ? "#B45309" : "#64748B" }}>
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
                { label: 'Active Services', value: services.filter(s => s.is_active).length, icon: 'apps', color: '#0E1A2E' },
            ]} />

            <SectionHeader title="Service Highlights" onAdd={() => setEditingService({ title: '', icon: '', lib: 'mc', bg_color: '#0E1A2E', display_order: services.length + 1 })} />

            {editingService && (
                <View style={{ backgroundColor: '#FFFFFF', padding: 22, borderRadius: 20, marginBottom: 20, borderWidth: 1.5, borderColor: '#D9A73A', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}>
                    <Text style={{ fontWeight: '900', marginBottom: 20, fontSize: 18, color: '#0E1A2E' }}>{editingService.id ? 'Edit Service' : 'New Service'}</Text>

                    <View style={{ gap: 16 }}>
                        <View>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>SERVICE TITLE</Text>
                            <TextInput
                                placeholder="e.g. Fast Shipping"
                                placeholderTextColor="#94A3B8"
                                value={editingService.title}
                                onChangeText={t => setEditingService({ ...editingService, title: t })}
                                style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', fontSize: 15, fontWeight: '600', color: '#0E1A2E' }}
                            />
                        </View>
                        <View style={{ flexDirection: 'row', gap: 12 }}>
                            <View style={{ flex: 2 }}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>ICON NAME</Text>
                                <TextInput
                                    placeholder="e.g. truck"
                                    placeholderTextColor="#94A3B8"
                                    value={editingService.icon}
                                    onChangeText={t => setEditingService({ ...editingService, icon: t })}
                                    style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#0E1A2E' }}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>LIB</Text>
                                <TextInput
                                    placeholder="mc"
                                    placeholderTextColor="#94A3B8"
                                    value={editingService.lib}
                                    onChangeText={t => setEditingService({ ...editingService, lib: t })}
                                    style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#0E1A2E' }}
                                />
                            </View>
                        </View>
                        <View>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#64748B', marginBottom: 8, marginLeft: 4, letterSpacing: 0.5 }}>BRAND COLOR</Text>
                            <TextInput
                                placeholder="#HEX"
                                placeholderTextColor="#94A3B8"
                                value={editingService.bg_color}
                                onChangeText={t => setEditingService({ ...editingService, bg_color: t })}
                                style={{ backgroundColor: '#F8FAFC', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: '#E2E8F0', fontWeight: '600', color: '#0E1A2E' }}
                            />
                        </View>
                    </View>

                    <View style={{ flexDirection: 'row', gap: 14, marginTop: 24 }}>
                        <TouchableOpacity onPress={() => setEditingService(null)} style={{ flex: 1, padding: 16, alignItems: 'center', backgroundColor: '#F1F5F9', borderRadius: 14 }}>
                            <Text style={{ color: '#64748B', fontWeight: '800', fontSize: 14 }}>Discard</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSaveService} style={{ flex: 1, backgroundColor: '#0E1A2E', padding: 16, borderRadius: 14, alignItems: 'center', borderWidth: 1, borderColor: '#D9A73A' }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: '800', fontSize: 14 }}>Save Changes</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {services.map(svc => (
                <View key={svc.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#FFFFFF', padding: 16, borderRadius: 18, marginBottom: 12, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 }}>
                    <View style={{ marginRight: 16 }}>
                        <ServiceIcon icon={svc.icon} label="" color={svc.bg_color || '#0E1A2E'} lib={svc.lib} onPress={() => { }} />
                    </View>
                    <View style={{ flex: 1 }}>
                        <Text style={{ fontWeight: '800', color: '#0E1A2E', fontSize: 15 }}>{svc.title}</Text>
                        <Text style={{ fontSize: 13, color: '#64748B', fontWeight: '600', marginTop: 2 }}>Order: {svc.display_order}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={() => setEditingService(svc)} style={{ width: 40, height: 40, backgroundColor: '#FFFBEB', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FDE68A' }}>
                            <Ionicons name="pencil" size={18} color="#D9A73A" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => toggleStatus('home_services', svc.id, 'is_active', svc.is_active)} style={{ width: 40, height: 40, backgroundColor: svc.is_active ? '#ECFDF5' : '#F1F5F9', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: svc.is_active ? '#A7F3D0' : '#E2E8F0' }}>
                            <Ionicons name={svc.is_active ? "eye" : "eye-off"} size={18} color={svc.is_active ? "#10B981" : "#94A3B8"} />
                        </TouchableOpacity>
                    </View>
                </View>
            ))}
        </View>
    );

    const renderSystemStatus = () => (
        <View style={{ padding: 20 }}>
            <View style={{ backgroundColor: '#0E1A2E', padding: 24, borderRadius: 24, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(217, 167, 58, 0.3)', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 10, elevation: 3 }}>
                <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: 'rgba(217, 167, 58, 0.15)', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <Ionicons name="hardware-chip-outline" size={26} color="#D9A73A" />
                </View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: 'white', marginBottom: 6 }}>System Diagnostics</Text>
                <Text style={{ color: '#94A3B8', fontSize: 14, lineHeight: 22 }}>Real-time diagnostics of database connections, schema integrity, and API status.</Text>
            </View>

            <View style={{ gap: 12 }}>
                {[
                    { label: 'Database Connection', status: systemStatus.dbConnection, activeText: 'Operational', inactiveText: 'Failed' },
                    { label: 'Brand Features Schema', status: systemStatus.columns.is_featured, activeText: 'Active', inactiveText: 'Missing Schema' },
                    { label: 'Review Management Schema', status: systemStatus.columns.is_displayed, activeText: 'Active', inactiveText: 'Missing Schema' }
                ].map((item, i) => (
                    <View key={i} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 18, backgroundColor: '#FFFFFF', borderRadius: 18, borderWidth: 1, borderColor: '#E2E8F0', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.03, shadowRadius: 3, elevation: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: item.status ? '#10B981' : '#EF4444' }} />
                            <Text style={{ fontWeight: '700', fontSize: 15, color: '#0E1A2E' }}>{item.label}</Text>
                        </View>
                        <Text style={{ color: item.status ? '#10B981' : '#EF4444', fontWeight: '800', fontSize: 13 }}>
                            {item.status ? item.activeText : item.inactiveText}
                        </Text>
                    </View>
                ))}
            </View>

            {(!systemStatus.columns.is_featured || !systemStatus.columns.is_displayed) && (
                <View style={{ marginTop: 24, padding: 20, backgroundColor: '#FEF2F2', borderRadius: 20, borderWidth: 1, borderColor: '#FECACA' }}>
                    <Ionicons name="warning" size={30} color="#EF4444" style={{ marginBottom: 10 }} />
                    <Text style={{ color: '#7F1D1D', fontWeight: '900', fontSize: 17, marginBottom: 8 }}>Action Required</Text>
                    <Text style={{ color: '#991B1B', fontSize: 14, lineHeight: 22 }}>
                        Your database is missing critical columns. Please run the `admin_home_customization.sql` script immediately to ensure smooth operation.
                    </Text>
                </View>
            )}
        </View>
    );

    const TabButton = ({ id, label }) => {
        const active = activeTab === id;
        return (
            <TouchableOpacity
                onPress={() => setActiveTab(id)}
                style={{
                    flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 10,
                    borderRadius: 12,
                    backgroundColor: active ? '#0E1A2E' : 'transparent',
                }}
            >
                <Text style={{ fontWeight: '800', color: active ? '#D9A73A' : '#64748B', fontSize: 13 }}>{label}</Text>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <Toast visible={toast.visible} message={toast.message} type={toast.type} onHide={() => setToast(t => ({ ...t, visible: false }))} />

            {/* Header */}
            <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderColor: '#E2E8F0' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                        {(navigation?.canGoBack?.() || onBack) && (
                            <TouchableOpacity onPress={onBack || (() => navigation.goBack())} style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0' }}>
                                <Ionicons name="arrow-back" size={20} color="#0E1A2E" />
                            </TouchableOpacity>
                        )}
                        <View>
                            <Text style={{ fontSize: 20, fontWeight: '900', color: '#0E1A2E', letterSpacing: -0.5 }}>Home Settings</Text>
                            <Text style={{ fontSize: 12, color: '#64748B', fontWeight: '500' }}>Customization & Featured Sections</Text>
                        </View>
                    </View>
                    <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10, backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A' }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#D9A73A' }}>LIVE</Text>
                    </View>
                </View>

                {/* Tabs */}
                <View style={{ flexDirection: 'row', backgroundColor: '#F1F5F9', padding: 4, borderRadius: 16, marginTop: 16 }}>
                    <TabButton id="marketplace" label="Marketplace" />
                    <TabButton id="engagement" label="Social" />
                    <TabButton id="services" label="Services" />
                    <TouchableOpacity onPress={() => setActiveTab('system')} style={{ width: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: activeTab === 'system' ? '#0E1A2E' : 'transparent' }}>
                        <Ionicons name="settings-sharp" size={18} color={activeTab === 'system' ? '#D9A73A' : '#64748B'} />
                    </TouchableOpacity>
                </View>
            </View>

            <ScrollView
                contentContainerStyle={{ paddingTop: 10, paddingBottom: 40 }}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#0E1A2E']} />}
            >
                {activeTab === 'marketplace' && renderMarketplace()}
                {activeTab === 'engagement' && renderEngagement()}
                {activeTab === 'services' && renderServiceConfig()}
                {activeTab === 'system' && renderSystemStatus()}
            </ScrollView>

            <SearchModal
                visible={modalConfig.visible}
                onClose={() => setModalConfig({ visible: false, type: null })}
                title={`Add ${modalConfig.type === 'vendor' ? 'Verified Seller' : modalConfig.type === 'brand' ? 'Featured Brand' : modalConfig.type === 'customer' ? 'Elite Customer' : 'Linked Product'}`}
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
