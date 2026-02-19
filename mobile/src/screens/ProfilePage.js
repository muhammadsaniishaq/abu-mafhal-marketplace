import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Image, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';

// Helper to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount).replace('NGN', '₦');
};

export const ProfilePage = ({ user, onLogout, onBack, onOpenVendorRegister, onOpenAdmin, onOpenVendor, onNavigate, onUpdateUser }) => {
    const [wallet, setWallet] = useState({ balance: 0, points: 0 });
    const [orders, setOrders] = useState([]);
    const [stats, setStats] = useState({ totalOrders: 0, pending: 0, spend: 0 });
    const [loading, setLoading] = useState(true);
    const [vendorApp, setVendorApp] = useState(null);
    const [driverProfile, setDriverProfile] = useState(null);

    const MENU_ITEMS = [
        { icon: 'chatbubbles-outline', label: 'Messages', screen: 'ConversationsScreen', badge: 'New' },
        { icon: 'bag-handle-outline', label: 'My Orders', screen: 'orders', badge: '2' },
        { icon: 'heart-outline', label: 'Wishlist', screen: 'wishlist' },
        { icon: 'settings-outline', label: 'Settings', screen: 'settings' },
        { icon: 'help-circle-outline', label: 'Help & Support', screen: 'settings' },
    ];

    useEffect(() => {
        if (user) {
            fetchProfileData();
        }
    }, [user?.id]);

    const fetchProfileData = async () => {
        try {
            setLoading(true);

            // 0. REFRESH USER DATA (Role, etc.) to ensure admin status is up to date
            const { data: userData, error: userError } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            if (userData && onUpdateUser) {
                onUpdateUser({ ...user, ...userData });
            }

            // 1. Fetch Wallet
            const { data: walletData, error: walletError } = await supabase
                .from('wallets')
                .select('*')
                .eq('user_id', user.id)
                .single();

            if (walletData) {
                setWallet({
                    balance: walletData.balance || 0,
                    points: walletData.points || 0
                });
            }

            // 2. Fetch Orders
            const { data: ordersData, error: ordersError } = await supabase
                .from('orders')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (ordersData) {
                setOrders(ordersData);

                // Calculate Stats
                const totalOrders = ordersData.length;
                const pending = ordersData.filter(o => {
                    const s = o.status?.toLowerCase();
                    return s === 'pending' || s === 'processing';
                }).length;
                const spend = ordersData.reduce((sum, order) => sum + (order.total_amount || 0), 0);

                setStats({ totalOrders, pending, spend });
            }

            // 3. Fetch Vendor Application (Safe fetch)
            try {
                const { data: appData } = await supabase
                    .from('vendor_applications')
                    .select('status')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (appData) setVendorApp(appData);
            } catch (appErr) {
                console.log("Safe App Fetch Error:", appErr);
            }

            // 4. Fetch Driver Profile
            try {
                const { data: driverData } = await supabase
                    .from('drivers')
                    .select('*')
                    .eq('user_id', user.id)
                    .maybeSingle();

                if (driverData) setDriverProfile(driverData);
            } catch (driverErr) { console.log("Driver Fetch Err", driverErr); }

        } catch (error) {
            console.log("Profile Data Error:", error);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
            <View style={styles.profileHeader}>
                <SafeAreaView style={{ backgroundColor: 'transparent' }}>
                    <View style={styles.profileNav}>
                        <TouchableOpacity onPress={onBack}><Ionicons name="arrow-back" size={24} color="white" /></TouchableOpacity>
                        <Text style={styles.profileNavTitle}>My Profile</Text>
                        <View style={{ width: 24 }} />
                    </View>
                </SafeAreaView>

                {/* PROFILE INFO - LIVE */}
                <View style={styles.profileInfo}>
                    <View style={styles.avatarBox}>
                        {user?.user_metadata?.avatar_url || user?.avatar_url ? (
                            <Image
                                source={{ uri: user.user_metadata?.avatar_url || user.avatar_url }}
                                style={{ width: '100%', height: '100%' }}
                            />
                        ) : (
                            <Text style={styles.avatarText}>{user?.email?.[0]?.toUpperCase() || 'U'}</Text>
                        )}
                    </View>

                    <Text style={styles.profileName}>
                        {user?.fullName || user?.full_name || user?.user_metadata?.full_name || 'User'}
                    </Text>


                    {(user?.username || user?.user_metadata?.username) && (
                        <Text style={{ color: '#94A3B8', fontSize: 14, marginBottom: 4 }}>
                            @{user?.username || user?.user_metadata?.username}
                        </Text>
                    )}

                    {/* ROLE BADGE */}
                    <View style={{ backgroundColor: user?.role === 'admin' ? '#EF4444' : user?.role === 'vendor' ? '#10B981' : '#3B82F6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginTop: 4, marginBottom: 8 }}>
                        <Text style={{ color: 'white', fontSize: 10, fontWeight: '700', textTransform: 'uppercase' }}>
                            {user?.role || 'User'}
                        </Text>
                    </View>

                    {(user?.location || user?.user_metadata?.location) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                            <Ionicons name="location-outline" size={14} color="#CBD5E1" />
                            <Text style={{ color: '#CBD5E1', fontSize: 13, marginLeft: 4 }}>
                                {user?.location || user?.user_metadata?.location}
                            </Text>
                        </View>
                    )}

                    {(user?.phoneNumber || user?.phone_number || user?.user_metadata?.phone_number || user?.phone) && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 8 }}>
                            <Ionicons name="call" size={14} color="#CBD5E1" />
                            <Text style={{ color: '#E2E8F0', fontSize: 13, marginLeft: 6, fontWeight: '500' }}>
                                {user?.phoneNumber || user?.phone_number || user?.user_metadata?.phone_number || user?.phone}
                            </Text>
                        </View>
                    )}

                    {user?.email && (
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                            <Ionicons name="mail" size={14} color="#94A3B8" />
                            <Text style={{ color: '#94A3B8', fontSize: 13, marginLeft: 6 }}>
                                {user?.email}
                            </Text>
                        </View>
                    )}

                    {(user?.bio || user?.user_metadata?.bio) && (
                        <Text style={{ color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 12, paddingHorizontal: 20, lineHeight: 20 }}>
                            {user?.bio || user?.user_metadata?.bio}
                        </Text>
                    )}
                </View>
            </View>

            <View style={styles.profileBody}>
                {/* LIVE STATS */}
                <View style={styles.statsRow}>
                    <View style={styles.statItem}>
                        <Text style={styles.statNum}>{stats.totalOrders}</Text>
                        <Text style={styles.statLabel}>Orders</Text>
                    </View>
                    <View style={styles.statLine} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNum}>{stats.pending}</Text>
                        <Text style={styles.statLabel}>Pending</Text>
                    </View>
                    <View style={styles.statLine} />
                    <View style={styles.statItem}>
                        <Text style={styles.statNum}>₦{(stats.spend / 1000).toFixed(0)}k</Text>
                        {/* Simplified formatting for space, e.g. 45k */}
                        <Text style={styles.statLabel}>Spend</Text>
                    </View>
                </View>

                {/* LIVE WALLET CARD */}
                <View style={styles.walletCard}>
                    <View>
                        <Text style={styles.walletLabel}>Wallet Balance</Text>
                        <Text style={styles.walletBalance}>{formatCurrency(wallet.balance)}</Text>
                        <Text style={styles.walletPoints}><Ionicons name="star" size={12} color="#FBBF24" /> {wallet.points} Points</Text>
                    </View>
                    <TouchableOpacity style={styles.walletBtn}>
                        <Text style={{ color: 'white', fontWeight: '600' }}>Top Up</Text>
                    </TouchableOpacity>
                </View>

                {/* DRIVER DASHBOARD - Show if registered as driver */}


                {/* DASHBOARD ACCESS */}
                {(user?.role === 'admin' || ['muhammadsaniisyaku3@gmail.com', 'muhammadsanish0@gmail.com', 'abumafhalhub@gmail.com'].includes(user?.email)) ? (
                    <View style={[styles.vendorCard, { backgroundColor: '#1E293B' }]}>
                        <View>
                            <Text style={styles.vendorTitle}>Admin Dashboard</Text>
                            <Text style={styles.vendorSub}>Manage users and approvals.</Text>
                        </View>
                        <TouchableOpacity style={styles.vendorBtn} onPress={onOpenAdmin}>
                            <Text style={{ color: '#1E293B', fontWeight: '800' }}>Open</Text>
                        </TouchableOpacity>
                    </View>
                ) : user?.role === 'vendor' ? (
                    <View style={[styles.vendorCard, { backgroundColor: '#10B981' }]}>
                        <View>
                            <Text style={styles.vendorTitle}>Vendor Dashboard</Text>
                            <Text style={styles.vendorSub}>Manage your products & orders.</Text>
                        </View>
                        <TouchableOpacity style={styles.vendorBtn} onPress={onOpenVendor}>
                            <Text style={{ color: '#10B981', fontWeight: '800' }}>Open</Text>
                        </TouchableOpacity>
                    </View>
                ) : user?.role === 'driver' ? (
                    <View style={[styles.vendorCard, { backgroundColor: '#7C3AED' }]}>
                        <View>
                            <Text style={styles.vendorTitle}>Driver Dashboard</Text>
                            <Text style={styles.vendorSub}>View assigned deliveries & earnings.</Text>
                        </View>
                        <TouchableOpacity style={styles.vendorBtn} onPress={() => onNavigate('DriverDashboard')}>
                            <Text style={{ color: '#7C3AED', fontWeight: '800' }}>Open</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.vendorCard}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.vendorTitle}>Become a Seller</Text>
                            <Text style={styles.vendorSub}>
                                {vendorApp?.status === 'pending' ? 'Application is under review.' :
                                    vendorApp?.status === 'rejected' ? 'Application was rejected. Try again.' :
                                        'Start your business and reach millions.'}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.vendorBtn,
                                vendorApp?.status === 'pending' && { backgroundColor: '#FEF3C7' },
                                vendorApp?.status === 'rejected' && { backgroundColor: '#FEE2E2' }
                            ]}
                            onPress={onOpenVendorRegister}
                        >
                            <Text style={{
                                color: vendorApp?.status === 'pending' ? '#D97706' :
                                    vendorApp?.status === 'rejected' ? '#EF4444' : '#4F46E5',
                                fontWeight: '800'
                            }}>
                                {vendorApp?.status === 'pending' ? 'Pending' :
                                    vendorApp?.status === 'rejected' ? 'Re-apply' : 'Apply'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* REFERRAL CARD */}
                <TouchableOpacity style={styles.referCard}>
                    <View style={styles.referIcon}>
                        <Ionicons name="gift" size={20} color="#10B981" />
                    </View>
                    <View>
                        <Text style={styles.referTitle}>Refer & Earn</Text>
                        <Text style={styles.referSub}>Invite friends and get ₦500 bonus</Text>
                    </View>
                    <Ionicons name="chevron-forward" size={16} color="#CBD5E1" style={{ marginLeft: 'auto' }} />
                </TouchableOpacity>

                {/* RECENT ORDERS - LIVE */}
                <Text style={styles.sectionTitle}>Recent Orders ({orders.length})</Text>

                {loading ? (
                    <ActivityIndicator color="#0F172A" style={{ marginTop: 20 }} />
                ) : orders.length > 0 ? (
                    orders.slice(0, 3).map((order) => (
                        <TouchableOpacity key={order.id} style={styles.orderItem}>
                            <View style={styles.orderIcon}>
                                <Ionicons name="cube-outline" size={20} color="#64748B" />
                            </View>
                            <View>
                                {/* Handle ID or UUID */}
                                <Text style={styles.orderId}>#{order.id.toString().slice(0, 8).toUpperCase()}</Text>
                                <Text style={styles.orderDate}>
                                    {new Date(order.created_at).toLocaleDateString()} • {order.items_count || order.items?.length || 1} items
                                </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end', flex: 1 }}>
                                <Text style={styles.orderId}>{formatCurrency(order.total_amount)}</Text>
                                <Text style={[styles.orderStatus, { color: order.status?.toLowerCase() === 'delivered' ? '#10B981' : '#F59E0B' }]}>{order.status}</Text>
                            </View>
                        </TouchableOpacity>
                    ))
                ) : (
                    <View style={{ alignItems: 'center', padding: 20 }}>
                        <Text style={{ color: '#94A3B8' }}>No recent orders</Text>
                    </View>
                )}

                <View style={{ marginTop: 12, paddingBottom: 40 }}>
                    {MENU_ITEMS.map((item, i) => (
                        <TouchableOpacity
                            key={i}
                            style={styles.menuItem}
                            onPress={() => item.screen ? onNavigate(item.screen) : alert('Coming Soon')}
                        >
                            <View style={styles.menuIconBox}>
                                <Ionicons name={item.icon} size={20} color="#0F172A" />
                            </View>
                            <Text style={styles.menuLabel}>{item.label}</Text>
                            <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
                        </TouchableOpacity>
                    ))}

                    <TouchableOpacity
                        style={[styles.modernBtn, { backgroundColor: '#FFEEF2', marginTop: 20 }]}
                        onPress={onLogout}
                    >
                        <Text style={{ color: '#EF4444', fontWeight: '700' }}>Log Out</Text>
                        <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginLeft: 8 }} />
                    </TouchableOpacity>
                </View>
            </View>
        </ScrollView >
    );
};
