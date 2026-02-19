import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';

export const NewsletterCard = () => {
    const [email, setEmail] = useState('');

    const handleSubscribe = () => {
        if (!email.includes('@')) {
            Alert.alert('Error', 'Please enter a valid email.');
            return;
        }
        Alert.alert('Success', 'Thank you for subscribing!');
        setEmail('');
    };

    return (
        <View style={{ margin: 16, backgroundColor: '#1E293B', borderRadius: 16, padding: 24, overflow: 'hidden' }}>
            {/* Background Pattern Mock */}
            <View style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: 50, backgroundColor: 'rgba(255,255,255,0.05)' }} />

            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <Ionicons name="mail-unread-outline" size={24} color="#3B82F6" />
                <Text style={{ color: 'white', fontSize: 18, fontWeight: '700', marginLeft: 8 }}>Get 10% Off</Text>
            </View>
            <Text style={{ color: '#94A3B8', marginBottom: 16 }}>Subscribe to our newsletter and get exclusive offers directly to your inbox.</Text>

            <View style={{ flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8, padding: 4 }}>
                <TextInput
                    placeholder="Enter your email"
                    placeholderTextColor="#64748B"
                    value={email}
                    onChangeText={setEmail}
                    style={{ flex: 1, color: 'white', paddingHorizontal: 12 }}
                />
                <TouchableOpacity onPress={handleSubscribe} style={{ backgroundColor: '#3B82F6', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 6 }}>
                    <Text style={{ color: 'white', fontWeight: '700' }}>Join</Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};
