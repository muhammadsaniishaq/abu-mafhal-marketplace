import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const BottomNav = ({ activeTab, onTabChange, cartCount }) => {
    const TABS = [
        { id: 'home', icon: 'home', label: 'Home' },
        { id: 'wishlist', icon: 'heart', label: 'Wishlist' },
        { id: 'shop', icon: 'bag-handle', label: 'Shop', isCenter: true },
        { id: 'cart', icon: 'cart', label: 'Cart', badge: cartCount },
        { id: 'profile', icon: 'person', label: 'Profile' },
    ];

    return (
        <View style={styles.bottomNav}>
            {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                if (tab.isCenter) {
                    return (
                        <View key={tab.id} style={styles.centerTabWrapper}>
                            <TouchableOpacity
                                style={[styles.centerTabBtn, isActive && styles.centerTabBtnActive]}
                                onPress={() => onTabChange(tab.id)}
                            >
                                <Ionicons name={tab.icon} size={32} color="white" />
                            </TouchableOpacity>
                            <Text style={[styles.tabLabel, { marginTop: 4, color: isActive ? '#0F172A' : '#94A3B8' }]}>{tab.label}</Text>
                        </View>
                    );
                }
                return (
                    <TouchableOpacity key={tab.id} style={styles.tabItem} onPress={() => onTabChange(tab.id)}>
                        <View>
                            <Ionicons
                                name={isActive ? tab.icon : `${tab.icon}-outline`}
                                size={24}
                                color={isActive ? '#0F172A' : '#94A3B8'}
                            />
                            {tab.badge > 0 && <View style={styles.tabBadge}><Text style={styles.tabBadgeText}>{tab.badge}</Text></View>}
                        </View>
                        <Text style={[styles.tabLabel, { color: isActive ? '#0F172A' : '#94A3B8' }]}>{tab.label}</Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};
