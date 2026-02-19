import React from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, StyleSheet, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const PaymentMethodsPage = ({ onBack }) => {
    return (
        <View style={styles.container}>
            <View style={styles.topHeader}>
                <SafeAreaView style={{ backgroundColor: 'transparent' }}>
                    <View style={[styles.headerRow, { justifyContent: 'flex-start', gap: 16 }]}>
                        <TouchableOpacity onPress={onBack}>
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Payment Methods</Text>
                    </View>
                </SafeAreaView>
            </View>

            <View style={[styles.emptyStateContainer, { marginTop: 100 }]}>
                <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                    <Ionicons name="card-outline" size={40} color="#3B82F6" />
                </View>
                <Text style={styles.emptyStateText}>No Saved Cards</Text>
                <Text style={{ color: '#64748B', textAlign: 'center', marginTop: 8, maxWidth: 250 }}>
                    Securely save your payment details for faster checkout.
                </Text>

                <TouchableOpacity style={[styles.modernBtn, { marginTop: 24, width: '100%' }]}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>Add New Card</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};
