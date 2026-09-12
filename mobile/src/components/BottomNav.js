import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export const BottomNav = ({ activeTab, onTabChange, cartCount = 0 }) => {
    const insets = useSafeAreaInsets();

    const TABS = [
        { id: 'home',       icon: 'home',       label: 'Home' },
        { id: 'categories', icon: 'grid',       label: 'Categories' },
        { id: 'stores',     icon: 'storefront', label: 'Stores' },
        { id: 'cart',       icon: 'cart',       label: 'Cart', badge: cartCount },
        { id: 'profile',    icon: 'person',     label: 'Account' },
    ];

    return (
        <View style={[
            s.navBar,
            { paddingBottom: Math.max(insets.bottom, Platform.OS === 'ios' ? 20 : 10) }
        ]}>
            {TABS.map(tab => {
                const isActive = activeTab === tab.id;
                return (
                    <TouchableOpacity
                        key={tab.id}
                        style={s.tabItem}
                        onPress={() => onTabChange(tab.id)}
                        activeOpacity={0.7}
                    >
                        <View style={s.iconWrapper}>
                            <Ionicons
                                name={isActive ? tab.icon : `${tab.icon}-outline`}
                                size={22}
                                color={isActive ? '#0284C7' : '#94A3B8'}
                            />
                            {tab.badge > 0 && (
                                <View style={s.badge}>
                                    <Text style={s.badgeTxt}>
                                        {tab.badge > 99 ? '99+' : tab.badge}
                                    </Text>
                                </View>
                            )}
                        </View>
                        <Text style={[
                            s.tabLabel,
                            isActive && s.tabLabelActive
                        ]}>
                            {tab.label}
                        </Text>
                    </TouchableOpacity>
                );
            })}
        </View>
    );
};

const s = StyleSheet.create({
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-around',
        backgroundColor: '#FFFFFF',
        borderTopWidth: 1,
        borderTopColor: '#F1F5F9',
        paddingTop: 8,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
    },
    tabItem: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 2,
    },
    iconWrapper: {
        position: 'relative',
        padding: 2,
    },
    badge: {
        position: 'absolute',
        top: -4,
        right: -8,
        backgroundColor: '#F59E0B',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 3,
    },
    badgeTxt: {
        color: '#FFFFFF',
        fontSize: 9,
        fontWeight: '900',
    },
    tabLabel: {
        fontSize: 10.5,
        fontWeight: '500',
        color: '#94A3B8',
        marginTop: 3,
    },
    tabLabelActive: {
        color: '#0284C7',
        fontWeight: '700',
    },
});
