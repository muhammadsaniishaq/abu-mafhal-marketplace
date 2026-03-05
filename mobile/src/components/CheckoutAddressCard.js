import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CheckoutAddressCard = ({ address, onSelect, selected }) => {
    if (!address) return null;

    const getIcon = (title) => {
        const t = (title || '').toLowerCase();
        if (t.includes('home')) return 'home';
        if (t.includes('office') || t.includes('work')) return 'briefcase';
        if (t.includes('school')) return 'school';
        return 'location';
    };

    return (
        <TouchableOpacity
            onPress={onSelect}
            style={[
                styles.card,
                selected && styles.selectedCard
            ]}
            activeOpacity={0.7}
        >
            <View style={[styles.iconContainer, selected && styles.selectedIconContainer]}>
                <Ionicons
                    name={getIcon(address.title)}
                    size={22}
                    color={selected ? '#FFFFFF' : '#64748B'}
                />
            </View>
            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.title, selected && styles.selectedText]}>{address.title || 'Address'}</Text>
                    {address.is_default && (
                        <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>Default</Text>
                        </View>
                    )}
                </View>
                <Text style={[styles.addressLine, selected && styles.selectedSubText]} numberOfLines={1}>
                    {address.address}
                </Text>
                <Text style={[styles.locationLine, selected && styles.selectedSubText]}>
                    {address.city}, {address.state}
                </Text>
                <Text style={[styles.phoneLine, selected && styles.selectedText]}>
                    {address.phone}
                </Text>
            </View>
            <View style={styles.radioContainer}>
                <View style={[styles.radio, selected && styles.radioActive]}>
                    {selected && <View style={styles.radioInner} />}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 15,
        elevation: 2,
    },
    selectedCard: {
        borderColor: '#0F172A',
        backgroundColor: '#F8FAFC',
    },
    iconContainer: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 16,
    },
    selectedIconContainer: {
        backgroundColor: '#0F172A',
    },
    content: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 4,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        color: '#0F172A',
        marginRight: 8,
    },
    selectedText: {
        color: '#0F172A',
    },
    defaultBadge: {
        backgroundColor: '#F1F5F9',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    defaultText: {
        fontSize: 10,
        fontWeight: '700',
        color: '#64748B',
        textTransform: 'uppercase',
    },
    addressLine: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 2,
    },
    locationLine: {
        fontSize: 14,
        color: '#64748B',
        marginBottom: 4,
    },
    selectedSubText: {
        color: '#475569',
    },
    phoneLine: {
        fontSize: 14,
        fontWeight: '600',
        color: '#0F172A',
    },
    radioContainer: {
        marginLeft: 12,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#E2E8F0',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioActive: {
        borderColor: '#0F172A',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#0F172A',
    },
});

export default CheckoutAddressCard;
