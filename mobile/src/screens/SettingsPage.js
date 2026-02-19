import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Switch, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const SettingsPage = ({ onBack, onLogout, onNavigate }) => {
    return (
        <View style={styles.container}>
            <View style={styles.topHeader}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={[styles.headerRow, { justifyContent: 'flex-start', gap: 16 }]}>
                        <TouchableOpacity onPress={onBack}>
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Settings</Text>
                    </View>
                </SafeAreaView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <Text style={[styles.sectionTitle, { marginLeft: 0, marginTop: 10 }]}>Account</Text>
                <SettingItem label="Edit Profile" icon="person-outline" onPress={() => onNavigate('editProfile')} />
                <SettingItem label="Change Password" icon="lock-closed-outline" onPress={() => onNavigate('changePassword')} />
                <SettingItem label="Shipping Address" icon="location-outline" onPress={() => onNavigate('address')} />
                <SettingItem label="Payment Methods" icon="card-outline" onPress={() => onNavigate('paymentMethods')} />

                <Text style={[styles.sectionTitle, { marginLeft: 0 }]}>Preferences</Text>
                <View style={[styles.menuItem, { justifyContent: 'space-between' }]}>
                    <TouchableOpacity style={{ flexDirection: 'row', alignItems: 'center' }} onPress={() => onNavigate('notifications')}>
                        <View style={styles.menuIconBox}><Ionicons name="notifications-outline" size={20} color="#0F172A" /></View>
                        <Text style={styles.menuLabel}>Notifications</Text>
                    </TouchableOpacity>
                    <Switch value={true} trackColor={{ false: '#E2E8F0', true: '#0F172A' }} />
                </View>
                <View style={[styles.menuItem, { justifyContent: 'space-between' }]}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={styles.menuIconBox}><Ionicons name="moon-outline" size={20} color="#0F172A" /></View>
                        <Text style={styles.menuLabel}>Dark Mode</Text>
                    </View>
                    <Switch value={false} trackColor={{ false: '#E2E8F0', true: '#0F172A' }} />
                </View>

                <TouchableOpacity
                    style={[styles.modernBtn, { backgroundColor: '#EF4444', marginTop: 40 }]}
                    onPress={onLogout}
                >
                    <Text style={{ color: 'white', fontWeight: '700' }}>Log Out</Text>
                    <Ionicons name="log-out-outline" size={20} color="white" style={{ marginLeft: 8 }} />
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};

const SettingItem = ({ label, icon, onPress }) => (
    <TouchableOpacity style={styles.menuItem} onPress={onPress}>
        <View style={styles.menuIconBox}>
            <Ionicons name={icon} size={20} color="#0F172A" />
        </View>
        <Text style={styles.menuLabel}>{label}</Text>
        <Ionicons name="chevron-forward" size={16} color="#CBD5E1" />
    </TouchableOpacity>
);
