import * as React from 'react';
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, Alert, TextInput, Image, RefreshControl, ScrollView, Share, Modal, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { NotificationService } from '../../lib/notifications';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AdminUserDetails } from './AdminUserDetails';

// Sub-components defined outside to avoid re-creation and fix scoping
const FilterTab = ({ title, id, activeFilter, onSelect }) => (
    <TouchableOpacity
        onPress={() => onSelect(id)}
        style={{
            paddingHorizontal: 12,
            paddingVertical: 6,
            backgroundColor: activeFilter === id ? '#3B82F6' : 'white',
            borderRadius: 20,
            marginRight: 8,
            borderWidth: 1,
            borderColor: activeFilter === id ? '#3B82F6' : '#E2E8F0',
            flexDirection: 'row',
            alignItems: 'center'
        }}
    >
        <Text style={{
            color: activeFilter === id ? 'white' : '#64748B',
            fontWeight: '700',
            fontSize: 12
        }}>{title}</Text>
    </TouchableOpacity>
);

const StatCard = ({ label, value, color, icon }) => (
    <View style={{ flex: 1, backgroundColor: 'white', padding: 12, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', alignItems: 'center' }}>
        <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: `${color}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <Ionicons name={icon} size={16} color={color} />
        </View>
        <Text style={{ fontSize: 18, fontWeight: '800', color: '#0F172A' }}>{value}</Text>
        <Text style={{ fontSize: 10, color: '#94A3B8', fontWeight: '600', textTransform: 'uppercase' }}>{label}</Text>
    </View>
);

const getTierInfo = (spend) => {
    if (spend >= 1000000) return { label: 'DIAMOND', color: '#7C3AED', icon: 'diamond' };
    if (spend >= 250000) return { label: 'GOLD', color: '#D97706', icon: 'medal' };
    if (spend >= 50000) return { label: 'SILVER', color: '#64748B', icon: 'ribbon' };
    return { label: 'BRONZE', color: '#B45309', icon: 'shield' };
};

const QuickActionButton = ({ icon, label, color, onPress }) => (
    <TouchableOpacity onPress={onPress} style={{ alignItems: 'center', width: '25%' }}>
        <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: `${color}15`, alignItems: 'center', justifyContent: 'center', marginBottom: 6 }}>
            <Ionicons name={icon} size={20} color={color} />
        </View>
        <Text style={{ fontSize: 10, fontWeight: '600', color: '#64748B' }}>{label}</Text>
    </TouchableOpacity>
);

export const AdminUsers = ({ navigation: propNavigation }) => {
    const internalNavigation = useNavigation();
    const navigation = propNavigation || internalNavigation;
    const insets = useSafeAreaInsets();
    const [users, setUsers] = React.useState([]);
    const [stats, setStats] = React.useState({ total: 0, admin: 0, banned: 0, verified: 0 });
    const [loading, setLoading] = React.useState(true);
    const [refreshing, setRefreshing] = React.useState(false);
    const [search, setSearch] = React.useState('');
    const [filter, setFilter] = React.useState('all');
    const [sortBy, setSortBy] = React.useState('newest');

    const [selectedUser, setSelectedUser] = React.useState(null);
    const [detailsVisible, setDetailsVisible] = React.useState(false);

    // Quick Actions
    const [quickActionsVisible, setQuickActionsVisible] = React.useState(false);
    const [actionUser, setActionUser] = React.useState(null);

    // Bulk Actions State
    const [selectionMode, setSelectionMode] = React.useState(false);
    const [selectedIds, setSelectedIds] = React.useState([]);

    React.useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const { data: { user: me } } = await supabase.auth.getUser();

        // Fetch Data
        const { data, error } = await supabase
            .from('profiles')
            .select('*, orders:orders(id, total_amount, created_at, status)')
            .order('created_at', { ascending: false })
            .range(0, 4999);

        if (error) {
            Alert.alert('Error', error.message);
        } else {
            // Fetch last chats for all users
            const { data: lastChats } = await supabase
                .from('messages')
                .select('*')
                .or(`sender_id.eq.${me?.id},receiver_id.eq.${me?.id}`)
                .order('created_at', { ascending: false });

            const usersWithStats = (data || []).map(u => {
                const userOrders = u.orders || [];
                // ... (existing mapping logic)
                const spend = userOrders.reduce((sum, o) => sum + (o.total_amount || 0), 0) || 0;

                // Find last chat with this specific user
                const chatWithUser = lastChats?.find(m => m.sender_id === u.id || m.receiver_id === u.id);

                const lastOrderDate = userOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at))[0]?.created_at || null;
                const topCategory = userOrders.length > 0 ? 'High Interest' : 'New User';

                // Predictive Churn Analysis
                const isChurnRisk = lastOrderDate && (new Date() - new Date(lastOrderDate)) > 2592000000; // 30 days

                return {
                    ...u,
                    order_count: userOrders.length,
                    total_spend: spend,
                    is_online: u.last_seen ? (new Date() - new Date(u.last_seen)) < 300000 : false,
                    is_restricted: u.is_restricted || false,
                    last_order_date: lastOrderDate,
                    is_churn_risk: isChurnRisk,
                    recent_orders: userOrders.sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 3),
                    last_message: chatWithUser ? (chatWithUser.message_type === 'image' ? '📷 Image' : chatWithUser.message) : null,
                    tier: getTierInfo(spend),
                    top_category: topCategory
                };
            });
            setUsers(usersWithStats);
            setStats({
                total: usersWithStats.length,
                admin: usersWithStats.filter(u => u.role === 'admin').length,
                banned: usersWithStats.filter(u => u.is_banned).length,
                verified: usersWithStats.filter(u => u.is_verified).length
            });
        }
        setLoading(false);
        setRefreshing(false);
    };

    const handleRefresh = () => {
        setRefreshing(true);
        fetchUsers();
    };

    const toggleSelection = (id) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(prev => prev.filter(item => item !== id));
        } else {
            setSelectedIds(prev => [...prev, id]);
        }
    };

    const handleBulkAction = async (action) => {
        if (selectedIds.length === 0) return;

        Alert.alert(
            'Bulk Action',
            `Are you sure you want to ${action} ${selectedIds.length} users?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Confirm',
                    style: 'destructive',
                    onPress: async () => {
                        setLoading(true);
                        let updateData = {};
                        if (action === 'verify') updateData = { is_verified: true };
                        if (action === 'ban') updateData = { is_banned: true };
                        if (action === 'unban') updateData = { is_banned: false };

                        const { error } = await supabase
                            .from('profiles')
                            .update(updateData)
                            .in('id', selectedIds);

                        if (error) {
                            Alert.alert('Error', error.message);
                        } else {
                            Alert.alert('Success', 'Bulk action completed.');
                            setSelectionMode(false);
                            setSelectedIds([]);
                            fetchUsers();
                        }
                        setLoading(false);
                    }
                }
            ]
        );
    };

    const handleBroadcast = () => {
        if (filteredUsers.length === 0) return;
        Alert.prompt(
            'Targeted Broadcast',
            `Send push notification to all ${filteredUsers.length} users in current filter?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Send',
                    onPress: async (msg) => {
                        if (!msg) return;
                        setLoading(true);
                        // Bulk notification logic
                        for (const u of filteredUsers) {
                            await NotificationService.send({
                                userId: u.id,
                                title: 'Special Update! 🎉',
                                message: msg,
                                type: 'system',
                                email: u.email
                            });
                        }
                        setLoading(false);
                        Alert.alert('Success', `Broadcast sent to ${filteredUsers.length} users.`);
                    }
                }
            ],
            'plain-text'
        );
    };

    const exportToCSV = async () => {
        const header = 'Full Name,Email,Phone,Role,Verified,Banned,Orders,Spent,Tags,Tier\n';
        const rows = users.map(u => {
            const tagsStr = (u.tags || []).join(';');
            return `${u.full_name || ''},${u.email || ''},${u.phone || ''},${u.role || ''},${u.is_verified || false},${u.is_banned || false},${u.order_count},${u.total_spend},"${tagsStr}",${u.tier.label}`;
        }).join('\n');

        const csvContent = header + rows;
        try {
            await Share.share({
                title: 'Users Export',
                message: csvContent,
            });
        } catch (error) {
            Alert.alert('Error', 'Failed to export users.');
        }
    };

    const filteredUsers = React.useMemo(() => {
        // [FIX] Immediate return if no search/filter to ensure we don't hide bad data
        if (search === '' && filter === 'all') return users;

        return users.filter(u => {
            // 1. Search Logic
            let matchesSearch = true;
            if (search.length > 0) {
                const searchLower = search.toLowerCase();
                matchesSearch = (u.email?.toLowerCase().includes(searchLower)) ||
                    (u.full_name?.toLowerCase().includes(searchLower)) ||
                    (u.phone?.includes(search)) ||
                    (u.tags?.some(t => t.toLowerCase().includes(searchLower)));
            }

            if (!matchesSearch) return false;

            // 2. Tab Filter Logic
            if (filter === 'admin') return u.role === 'admin';
            if (filter === 'banned') return u.is_banned === true;
            if (filter === 'vip') return u.total_spend > 250000;

            return true;
        });
    }, [users, search, filter]);

    const sortedUsers = React.useMemo(() => {
        return [...filteredUsers].sort((a, b) => {
            if (sortBy === 'name') return (a.full_name || '').localeCompare(b.full_name || '');
            if (sortBy === 'spend') return b.total_spend - a.total_spend;
            return new Date(b.created_at) - new Date(a.created_at);
        });
    }, [filteredUsers, sortBy]);

    const toggleVerify = async (u) => {
        const { error } = await supabase.from('profiles').update({ is_verified: !u.is_verified }).eq('id', u.id);
        if (error) Alert.alert('Error', error.message);
        else fetchUsers();
    }

    const toggleBan = async (u) => {
        const { error } = await supabase.from('profiles').update({ is_banned: !u.is_banned }).eq('id', u.id);
        if (error) Alert.alert('Error', error.message);
        else fetchUsers();
    }

    const promptForDriver = (u) => {
        Alert.prompt(
            'Make Driver',
            `Add ${u.full_name} to the drivers list?\nEnter Vehicle Type (e.g., Bike, Car, Van):`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Add',
                    onPress: async (vehicleType) => {
                        if (!vehicleType) return;
                        setLoading(true);
                        const { error } = await supabase.from('drivers').insert({
                            name: u.full_name,
                            phone: u.phone,
                            vehicle_type: vehicleType,
                            user_id: u.id // Link if possible, otherwise just info
                        });

                        if (error) {
                            Alert.alert('Error', error.message);
                        } else {
                            Alert.alert('Success', `${u.full_name} is now a driver!`);
                        }
                        setLoading(false);
                    }
                }
            ],
            'plain-text',
            'Bike'
        );
    };

    const renderUserItem = ({ item }) => {
        const isSelected = selectedIds.includes(item.id);

        return (
            <TouchableOpacity
                onLongPress={() => {
                    if (selectionMode) {
                        toggleSelection(item.id);
                    } else {
                        setActionUser(item);
                        setQuickActionsVisible(true);
                    }
                }}
                onPress={() => {
                    if (selectionMode) {
                        toggleSelection(item.id);
                    } else {
                        setSelectedUser(item);
                        setDetailsVisible(true);
                    }
                }}
                style={[styles.userCard, { borderColor: isSelected ? '#3B82F6' : '#F1F5F9', borderWidth: isSelected ? 2 : 1 }]}
            >
                {selectionMode && (
                    <View style={{ marginRight: 12 }}>
                        <Ionicons
                            name={isSelected ? "checkbox" : "square-outline"}
                            size={24}
                            color={isSelected ? "#3B82F6" : "#CBD5E1"}
                        />
                    </View>
                )}

                <View style={styles.avatarContainer}>
                    {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} style={styles.avatar} />
                    ) : (
                        <View style={[styles.avatar, { backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' }]}>
                            <Text style={{ fontSize: 18, fontWeight: '700', color: '#64748B' }}>{item.email?.[0]?.toUpperCase()}</Text>
                        </View>
                    )}
                    {item.is_online && <View style={styles.onlineBadge} />}
                    {item.is_restricted && (
                        <View style={[styles.onlineBadge, { backgroundColor: '#EA580C', left: -2, right: undefined }]}>
                            <Ionicons name="lock-closed" size={8} color="white" />
                        </View>
                    )}
                </View>

                <View style={{ flex: 1 }}>
                    <View style={styles.cardHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}>
                            <Text style={[styles.userName, item.is_restricted && { color: '#94A3B8' }]} numberOfLines={1}>{item.full_name || 'No Name'}</Text>
                            {item.is_verified && <Ionicons name="checkmark-circle" size={16} color="#3B82F6" />}
                            <View style={[styles.tierBadge, { backgroundColor: `${item.tier.color}15` }]}>
                                <Ionicons name={item.tier.icon} size={10} color={item.tier.color} style={{ marginRight: 4 }} />
                                <Text style={[styles.tierText, { color: item.tier.color }]}>{item.tier.label}</Text>
                            </View>
                            {item.is_churn_risk && (
                                <View style={{ backgroundColor: '#FEF2F2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, borderWeight: 1, borderColor: '#FEE2E2' }}>
                                    <Text style={{ fontSize: 8, color: '#EF4444', fontWeight: '800' }}>AT RISK</Text>
                                </View>
                            )}
                        </View>
                        {!selectionMode && (
                            <TouchableOpacity
                                onPress={() => navigation.navigate('Chat', { vendorId: item.id, vendorName: item.full_name })}
                                style={{ padding: 4 }}
                            >
                                <Ionicons name="chatbubble-ellipses" size={20} color="#3B82F6" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {item.last_message ? (
                        <Text style={styles.lastMessage} numberOfLines={1}>
                            <Ionicons name="chatbubble-outline" size={12} color="#94A3B8" /> {item.last_message}
                        </Text>
                    ) : (
                        <Text style={styles.email} numberOfLines={1}>{item.email}</Text>
                    )}

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Ionicons name="pie-chart-outline" size={12} color="#94A3B8" style={{ marginRight: 4 }} />
                            <Text style={styles.statText}>{item.top_category}</Text>
                        </View>
                        <View style={styles.statItem}>
                            <Text style={styles.statTextBold}>₦{item.total_spend?.toLocaleString()}</Text>
                        </View>
                    </View>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header */}
            <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                    <TouchableOpacity
                        onPress={() => selectionMode ? (setSelectionMode(false), setSelectedIds([])) : navigation.goBack()}
                        style={{ marginRight: 16 }}
                    >
                        <Ionicons name={selectionMode ? "close" : "arrow-back"} size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>
                        {selectionMode ? `${selectedIds.length} Selected` : 'Elite Users'}
                    </Text>
                </View>
                {!selectionMode && (
                    <View style={{ flexDirection: 'row', gap: 16 }}>
                        <TouchableOpacity onPress={handleBroadcast}>
                            <Ionicons name="megaphone-outline" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={exportToCSV}>
                            <Ionicons name="cloud-download-outline" size={24} color="#3B82F6" />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setSelectionMode(true); setSelectedIds([]); }}>
                            <Ionicons name="list" size={24} color="#0F172A" />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Bulk Actions Bar */}
            {selectionMode && (
                <View style={styles.bulkBar}>
                    <TouchableOpacity
                        onPress={() => handleBulkAction('verify')}
                        style={[styles.bulkBtn, { borderColor: '#3B82F6' }]}
                    >
                        <Text style={[styles.bulkBtnText, { color: '#3B82F6' }]}>Verify Selected</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={() => handleBulkAction('ban')}
                        style={[styles.bulkBtn, { backgroundColor: '#FEF2F2', borderColor: '#EF4444' }]}
                    >
                        <Text style={[styles.bulkBtnText, { color: '#EF4444' }]}>Ban Selected</Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Stats */}
            {!selectionMode && (
                <View style={styles.statsGrid}>
                    <StatCard label="Total" value={stats.total} color="#0F172A" icon="people" />
                    <StatCard label="VIPs" value={users.filter(u => u.total_spend > 250000).length} color="#7C3AED" icon="diamond" />
                    <StatCard label="Verified" value={stats.verified} color="#22C55E" icon="checkmark-done-circle" />
                    <StatCard label="Banned" value={stats.banned} color="#EF4444" icon="ban" />
                </View>
            )}

            {/* Search & Filter */}
            <View style={styles.searchContainer}>
                <View style={styles.searchBar}>
                    <Ionicons name="search" size={18} color="#94A3B8" />
                    <TextInput
                        placeholder="Search Elite Users..."
                        value={search}
                        onChangeText={setSearch}
                        placeholderTextColor="#94A3B8"
                        style={styles.searchInput}
                    />
                </View>

                <View style={styles.filterRow}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                        <FilterTab title="Everyone" id="all" activeFilter={filter} onSelect={setFilter} />
                        <FilterTab title="VIP Only" id="vip" activeFilter={filter} onSelect={setFilter} />
                        <FilterTab title="Staff" id="admin" activeFilter={filter} onSelect={setFilter} />
                        <FilterTab title="Banned" id="banned" activeFilter={filter} onSelect={setFilter} />
                    </ScrollView>

                    <TouchableOpacity
                        onPress={() => {
                            const sequence = ['newest', 'spend', 'name'];
                            setSortBy(sequence[(sequence.indexOf(sortBy) + 1) % sequence.length]);
                        }}
                        style={styles.sortBtn}
                    >
                        <Ionicons name="funnel-outline" size={14} color="#3B82F6" style={{ marginRight: 4 }} />
                        <Text style={styles.sortText}>{sortBy.toUpperCase()}</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* User List */}
            {loading ? (
                <View style={{ flex: 1, justifyContent: 'center' }}>
                    <ActivityIndicator size="large" color="#3B82F6" />
                </View>
            ) : (
                <FlatList
                    data={sortedUsers}
                    keyExtractor={item => item.id}
                    renderItem={renderUserItem}
                    contentContainerStyle={{ padding: 20, paddingTop: 0 }}
                    refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
                    ListEmptyComponent={
                        <View style={styles.emptyContainer}>
                            <Ionicons name="search-outline" size={48} color="#CBD5E1" />
                            <Text style={styles.emptyText}>No matches in Elite database</Text>
                        </View>
                    }
                />
            )}

            {/* Quick Actions Modal */}
            <Modal visible={quickActionsVisible} transparent animationType="fade" onRequestClose={() => setQuickActionsVisible(false)}>
                <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={() => setQuickActionsVisible(false)}>
                    <View style={styles.quickActionSheet}>
                        <View style={styles.sheetHeader}>
                            <Text style={styles.sheetTitle}>{actionUser?.full_name || 'Quick Actions'}</Text>
                        </View>
                        <View style={styles.actionGrid}>
                            <QuickActionButton icon="chatbubble" label="Chat" color="#3B82F6" onPress={() => { setQuickActionsVisible(false); navigation.navigate('Chat', { vendorId: actionUser.id, vendorName: actionUser.full_name }); }} />
                            <QuickActionButton icon={actionUser?.is_verified ? "close-circle" : "checkmark-circle"} label={actionUser?.is_verified ? "Unverify" : "Verify"} color={actionUser?.is_verified ? "#EF4444" : "#22C55E"} onPress={() => { setQuickActionsVisible(false); toggleVerify(actionUser); }} />
                            <QuickActionButton icon={actionUser?.is_banned ? "shield-checkmark" : "ban"} label={actionUser?.is_banned ? "Unban" : "Ban"} color={actionUser?.is_banned ? "#22C55E" : "#F59E0B"} onPress={() => { setQuickActionsVisible(false); toggleBan(actionUser); }} />
                            <QuickActionButton icon="bicycle" label="Make Driver" color="#8B5CF6" onPress={() => { setQuickActionsVisible(false); promptForDriver(actionUser); }} />
                            <QuickActionButton icon="person-outline" label="Profile" color="#64748B" onPress={() => { setQuickActionsVisible(false); setSelectedUser(actionUser); setDetailsVisible(true); }} />
                        </View>
                    </View>
                </TouchableOpacity>
            </Modal>

            <AdminUserDetails
                visible={detailsVisible}
                user={selectedUser}
                navigation={navigation}
                onClose={() => setDetailsVisible(false)}
                onUpdate={handleRefresh}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    header: { paddingBottom: 16, paddingHorizontal: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    headerTitle: { fontSize: 20, fontWeight: '900', color: '#0F172A', letterSpacing: -0.5 },
    userCard: { backgroundColor: 'white', padding: 16, borderRadius: 20, marginBottom: 12, flexDirection: 'row', alignItems: 'center', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)', },
    avatarContainer: { width: 52, height: 52, borderRadius: 26, marginRight: 16, position: 'relative' },
    avatar: { width: 52, height: 52, borderRadius: 26 },
    onlineBadge: { position: 'absolute', bottom: 2, right: 2, width: 14, height: 14, borderRadius: 7, backgroundColor: '#22C55E', borderWidth: 2, borderColor: 'white' },
    cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 },
    userName: { fontSize: 16, fontWeight: '800', color: '#1E293B' },
    tierBadge: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexDirection: 'row', alignItems: 'center', marginLeft: 6 },
    tierText: { fontSize: 8, fontWeight: '900' },
    lastMessage: { fontSize: 13, color: '#334155', fontWeight: '500', marginBottom: 4 },
    email: { fontSize: 13, color: '#64748B', marginBottom: 4 },
    statsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    statItem: { flexDirection: 'row', alignItems: 'center' },
    statText: { fontSize: 11, color: '#94A3B8', fontWeight: '500' },
    statTextBold: { fontSize: 11, color: '#0F172A', fontWeight: '800' },
    bulkBar: { flexDirection: 'row', backgroundColor: '#EFF6FF', padding: 12, gap: 10, borderBottomWidth: 1, borderColor: '#3B82F6' },
    bulkBtn: { flex: 1, backgroundColor: 'white', padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
    bulkBtnText: { fontWeight: '800', fontSize: 12 },
    statsGrid: { flexDirection: 'row', gap: 10, paddingHorizontal: 20, marginVertical: 12 },
    searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
    searchBar: { backgroundColor: 'white', padding: 12, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    searchInput: { flex: 1, marginLeft: 10, fontSize: 15, fontWeight: '600', color: '#0F172A' },
    filterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sortBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#F1F5F9' },
    sortText: { fontSize: 10, fontWeight: '800', color: '#3B82F6' },
    emptyContainer: { alignItems: 'center', marginTop: 60 },
    emptyText: { color: '#94A3B8', marginTop: 12, fontSize: 15, fontWeight: '600' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'flex-end' },
    quickActionSheet: { backgroundColor: 'white', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: 40 },
    sheetHeader: { alignItems: 'center', marginBottom: 20 },
    sheetTitle: { fontSize: 18, fontWeight: '900', color: '#0F172A' },
    actionGrid: { flexDirection: 'row', justifyContent: 'space-between' }
});
