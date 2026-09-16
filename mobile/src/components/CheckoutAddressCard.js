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
                    size={18}
                    color={selected ? '#D9A73A' : '#64748B'}
                />
            </View>

            <View style={styles.content}>
                <View style={styles.header}>
                    <Text style={[styles.title, selected && styles.selectedTitle]}>
                        {address.title || 'Delivery Address'}
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
                            <Ionicons name="location-sharp" size={10} color="#D9A73A" />
                            <Text style={styles.lgaBadgeText}>{lgaName} LGA</Text>
                        </View>
                    ) : null}
                    {address.state ? (
                        <Text style={styles.stateBadgeText}>
                            {address.state} State
                        </Text>
                    ) : null}
                </View>

                {address.address ? (
                    <Text style={styles.addressLine} numberOfLines={2}>
                        {address.address}
                    </Text>
                ) : null}

                {address.phone ? (
                    <View style={styles.phoneRow}>
                        <Ionicons name="call-outline" size={11} color="#64748B" />
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
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#E2E8F0',
        shadowColor: '#0E1A2E',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.03,
        shadowRadius: 4,
        elevation: 1,
    },
    selectedCard: {
        borderColor: '#D9A73A',
        backgroundColor: '#FEFDF8',
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        backgroundColor: '#F1F5F9',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 10,
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
        marginBottom: 3,
    },
    title: {
        fontSize: 13.5,
        fontWeight: '800',
        color: '#0E1A2E',
        marginRight: 6,
    },
    selectedTitle: {
        color: '#0E1A2E',
    },
    defaultBadge: {
        backgroundColor: '#FEF3C7',
        paddingHorizontal: 6,
        paddingVertical: 1.5,
        borderRadius: 4,
    },
    defaultText: {
        fontSize: 9.5,
        fontWeight: '800',
        color: '#92400E',
        textTransform: 'uppercase',
    },
    lgaBadgeRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        marginVertical: 2,
        flexWrap: 'wrap',
    },
    lgaBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
        backgroundColor: '#0E1A2E',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
    },
    lgaBadgeText: {
        fontSize: 10,
        fontWeight: '800',
        color: '#D9A73A',
    },
    stateBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#64748B',
    },
    addressLine: {
        fontSize: 12,
        color: '#475569',
        lineHeight: 16,
        marginTop: 2,
        marginBottom: 3,
    },
    phoneRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    phoneLine: {
        fontSize: 11,
        fontWeight: '600',
        color: '#64748B',
    },
    radioContainer: {
        marginLeft: 8,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 1.5,
        borderColor: '#CBD5E1',
        alignItems: 'center',
        justifyContent: 'center',
    },
    radioActive: {
        borderColor: '#D9A73A',
    },
    radioInner: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#D9A73A',
    },
});

export default CheckoutAddressCard;
