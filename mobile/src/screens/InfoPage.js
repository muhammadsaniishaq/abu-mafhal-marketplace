import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, SafeAreaView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const InfoPage = ({ title, content, onBack }) => {
    return (
        <View style={styles.container}>
            <SafeAreaView style={styles.safeArea}>
                <View style={[styles.shopHeader, { borderBottomWidth: 0 }]}>
                    <TouchableOpacity onPress={onBack} style={{ padding: 4 }}>
                        <Ionicons name="arrow-back" size={24} color="#0F172A" />
                    </TouchableOpacity>
                    <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginLeft: 16 }}>
                        {title}
                    </Text>
                </View>
            </SafeAreaView>

            <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
                <View style={styles.infoCard}>
                    <Text style={styles.infoContent}>{content}</Text>
                </View>
            </ScrollView>
        </View>
    );
};
