import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

const CheckoutAddressCard = ({ address, onSelect, selected }) => {
    if (!address) return null;

    const getIcon = (title) => {
        const t = (title || '').toLowerCase();
        if (t.includes('home')) return 'home-outline';
        if (t.includes('office') || t.includes('work')) return 'briefcase-outline';
        if (t.includes('shop') || t.includes('store')) return 'storefront-outline';
        if (t.includes('warehouse')) return 'cube-outline';
        if (t.includes('family') || t.includes('parents')) return 'people-outline';
        return 'location-outline';
    };

    const lgaName = address.lga || address.city;

    return (
        <TouchableOpacity
            onPress={onSelect}
            style={[
                styles.card,
                selected && styles.selectedCard
            ]}
            activeOpacity={0.8}
        >
            <View style={[styles.iconContainer, selected && styles.selectedIconContainer]}>
                <Ionicons
                    name={getIcon(address.title)}
                    size={22}
                    color={selected ? '#D9A73A' : '#64748B'}
                />
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.title, selected && styles.selectedTitle]}>
                        {address.title || 'Address'}
                    </Text>
                    {address.is_default && (
                        <View style={styles.defaultBadge}>
                            <Text style={styles.defaultText}>Default</Text>
                        </View>
                    )}
                </View>

                {/* LGA & State Prominent Highlight */}
                <View style={styles.lgaBadgeRow}>
                    {lgaName ? (
                        <View style={styles.lgaBadge}>
                            <Ionicons name="location-sharp" size={11} color="#D9A73A" />
                            <Text style={styles.lgaBadgeText}>{lgaName} LGA</Text>
                        </View>
                    ) : null}
                    <Text style={styles.stateBadgeText}>
                        {address.state ? `${address.state} State` : ''}
                    </Text>
                </View>

                <Text style={styles.addressLine} numberOfLines={2}>
                    {address.address}
                </Text>

                {address.phone ? (
                    <View style={styles.phoneRow}>
                        <Ionicons name="call-outline" size={12} color="#64748B" />
                        <Text style={styles.phoneLine}>{address.phone}</Text>
                    </View>
                ) : null}
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
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 10,
        elevation: 2,
    },
    selectedCard: {
        borderColor: '#D9A73A',
        backgroundColor: '#FAFAF9',
    },
    iconContainer: {
        width: 44,
        height: 44,
        borderRadius: 14,
        backgroundColor: '#F8FAFC',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 14,
        marginTop: 2,
    },
    selectedIconContainer: {
        backgroundColor: '#0E1A2E',
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
        fontSize: 15,
        fontWeight: '800',
        color: '#0E1A2E',
        marginRight: 8,
    },
    selectedTitle: {
        color: '#0E1A2E',
    },
    defaultBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 6,
    },
    defaultText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#92400E',
        textTransform: 'uppercase',
    },
    lgaBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginVertical: 4,
        flexWrap: 'wrap',
    },
    lgaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: '#0E1A2E',
        paddingHorizontal: 8,
        paddingVertical: 2.5,
        borderRadius: 8,
    },
    lgaBadgeText: {
        fontSize: 11,
        fontWeight: '800',
        color: '#D9A73A',
    },
    stateBadgeText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    addressLine: {
        fontSize: 13,
        color: '#475569',
        lineHeight: 18,
        marginTop: 2,
        marginBottom: 6,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    phoneLine: {
        fontSize: 12,
        fontWeight: '600',
        color: '#64748B',
    },
    radioContainer: {
        marginLeft: 12,
        marginTop: 4,
    },
    radio: {
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 2,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioActive: {
        borderColor: '#0E1A2E',
    },
    radioInner: {
        width: 12,
        height: 12,
        borderRadius: 6,
        backgroundColor: '#D9A73A',
    },
});

export default CheckoutAddressCard;
