import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';

export const ChangePasswordPage = ({ onBack }) => {
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);

    const handleUpdate = async () => {
        if (!password || !confirmPassword) {
            Alert.alert('Error', 'Please enter your new password.');
            return;
        }

        if (password !== confirmPassword) {
            Alert.alert('Error', 'Passwords do not match.');
            return;
        }

        if (password.length < 6) {
            Alert.alert('Error', 'Password must be at least 6 characters.');
            return;
        }

        setLoading(true);
        try {
            const { error } = await supabase.auth.updateUser({
                password: password
            });

            if (error) throw error;

            Alert.alert('Success', 'Your password has been updated.');
            onBack();

        } catch (error) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.topHeader}>
                <SafeAreaView style={styles.safeArea}>
                    <View style={[styles.headerRow, { justifyContent: 'flex-start', gap: 16 }]}>
                        <TouchableOpacity onPress={onBack}>
                            <Ionicons name="arrow-back" size={24} color="#0F172A" />
                        </TouchableOpacity>
                        <Text style={styles.sectionTitle}>Change Password</Text>
                    </View>
                </SafeAreaView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <TextInput
                        style={styles.modernInput}
                        value={password}
                        onChangeText={setPassword}
                        placeholder="••••••••"
                        secureTextEntry
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <TextInput
                        style={styles.modernInput}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        placeholder="••••••••"
                        secureTextEntry
                    />
                </View>

                <TouchableOpacity 
                    style={[styles.modernBtn, { marginTop: 24 }]} 
                    onPress={handleUpdate}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={styles.modernBtnText}>Update Password</Text>
                    )}
                </TouchableOpacity>
            </ScrollView>
        </View>
    );
};
