import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, ScrollView, SafeAreaView, Alert, ActivityIndicator, Image, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { styles } from '../styles/theme';
import { supabase } from '../lib/supabase';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';
import DateTimePicker from '@react-native-community/datetimepicker';

export const EditProfilePage = ({ user, onBack, onUpdateUser }) => {
    const [fullName, setFullName] = useState(
        user?.fullName || user?.user_metadata?.full_name || user?.full_name || ''
    );
    const [phone, setPhone] = useState(
        user?.phoneNumber || user?.user_metadata?.phone_number || user?.phone || user?.phone_number || ''
    );
    const [gender, setGender] = useState(user?.gender || user?.user_metadata?.gender || '');
    const [bio, setBio] = useState(user?.bio || user?.user_metadata?.bio || '');
    const [username, setUsername] = useState(user?.username || user?.user_metadata?.username || '');
    const [location, setLocation] = useState(user?.location || user?.user_metadata?.location || '');

    const [dob, setDob] = useState(user?.dob || user?.user_metadata?.dob || null);
    const [showDatePicker, setShowDatePicker] = useState(false);

    const [loading, setLoading] = useState(false);
    const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || user?.user_metadata?.avatar_url || null);
    const [uploading, setUploading] = useState(false);

    // DEBUG VERSION of pickImage
    const pickImage = async () => {
        // 1. Confirm Button Press
        // console.log("Button Pressed"); 
        // Alert.alert("Debug", "Opening Gallery..."); 

        try {
            // 2. Request Permission
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();

            if (status !== 'granted') {
                Alert.alert('Permission Denied', 'Please go to Settings > Apps and enable permission for this app.');
                return;
            }

            // 3. Launch Library
            let result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images, // Reverted to known working Enum
                quality: 0.5,
                base64: true,
                // allowsEditing: true, // KEEP DISABLED
            });

            if (!result.canceled) {
                uploadImage(result.assets[0]);
            }
        } catch (error) {
            Alert.alert('Gallery Error', error.message);
        }
    };

    const uploadImage = async (imageAsset) => {
        try {
            setUploading(true);
            const fileExt = imageAsset.uri.split('.').pop();
            const fileName = `${user.id}/${Date.now()}.${fileExt}`;
            const filePath = `${fileName}`;

            const { error: uploadError } = await supabase.storage
                .from('avatars')
                .upload(filePath, decode(imageAsset.base64), {
                    contentType: imageAsset.mimeType,
                });

            if (uploadError) throw uploadError;

            const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
            setAvatarUrl(data.publicUrl);

        } catch (error) {
            console.log("Upload error:", error);
            // setAvatarUrl(imageAsset.uri); // REMOVED: Do not save local path on error!

            // Show the actual error message to help debug
            Alert.alert("Upload Failed", "Error: " + (error.message || "Unknown error"));
        } finally {
            setUploading(false);
        }
    };

    const onDateChange = (event, selectedDate) => {
        const currentDate = selectedDate || dob;
        setShowDatePicker(Platform.OS === 'ios');
        if (selectedDate) {
            const formatted = currentDate.toISOString().split('T')[0];
            setDob(formatted);
        }
    };

    const handleSave = async () => {
        if (!fullName || !phone) {
            Alert.alert('Error', 'Full Name and Phone Number are required.');
            return;
        }

        setLoading(true);
        try {
            const updates = {
                fullName: fullName,
                phoneNumber: phone,
                gender: gender,
                bio: bio,
                dob: dob,
                username: username,
                location: location,
                avatar_url: avatarUrl,
                updated_at: new Date(),
            };

            // 1. Update Auth (User Metadata)
            const { error: authError } = await supabase.auth.updateUser({
                data: {
                    full_name: fullName,
                    phone_number: phone,
                    avatar_url: avatarUrl,
                    bio: bio,
                    dob: dob,
                    username: username,
                    location: location,
                    gender: gender
                }
            });

            if (authError) throw authError;

            // 2. Update 'users' table (Legacy/Private)
            try {
                await supabase
                    .from('users')
                    .update(updates)
                    .eq('id', user.id);
            } catch (ignore) {
                console.warn("DB update ignored", ignore);
            }

            // 3. Update 'profiles' table (Public Visibility)
            try {
                const profileUpdates = {
                    id: user.id,
                    full_name: fullName,
                    username: username,
                    avatar_url: avatarUrl,
                    updated_at: new Date(),
                    // Flatten other fields if needed or store as json
                    role: user.role || 'user' // Preserve role
                };

                const { error: profileError } = await supabase
                    .from('profiles')
                    .upsert(profileUpdates);

                if (profileError) console.log("Profile sync error:", profileError);

            } catch (e) {
                console.log("Profile update failed:", e);
            }

            Alert.alert('Success', 'Profile updated successfully');

            onUpdateUser({
                ...user,
                ...updates,
                full_name: fullName,
                phone_number: phone
            });

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
                        <Text style={styles.sectionTitle}>Edit Profile</Text>
                    </View>
                </SafeAreaView>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                <View style={{ alignItems: 'center', marginBottom: 30 }}>
                    <TouchableOpacity onPress={pickImage} style={{ position: 'relative' }}>
                        <View style={{
                            width: 100, height: 100, borderRadius: 50, backgroundColor: '#E2E8F0',
                            justifyContent: 'center', alignItems: 'center', overflow: 'hidden',
                            borderWidth: 4, borderColor: 'white', boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
                        }}>
                            {avatarUrl ? (
                                <Image source={{ uri: avatarUrl }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Ionicons name="person" size={50} color="#94A3B8" />
                            )}
                            {uploading && (
                                <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}>
                                    <ActivityIndicator color="white" />
                                </View>
                            )}
                        </View>
                        <View style={{
                            position: 'absolute', bottom: 0, right: 0, backgroundColor: '#0F172A',
                            padding: 8, borderRadius: 20, borderWidth: 2, borderColor: 'white'
                        }}>
                            <Ionicons name="camera" size={16} color="white" />
                        </View>
                    </TouchableOpacity>
                    <Text style={{ marginTop: 12, color: '#64748B', fontSize: 14 }}>Tap to change photo</Text>
                </View>

                {/* FIELDS */}
                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Full Name</Text>
                    <TextInput
                        style={styles.modernInput}
                        value={fullName}
                        onChangeText={setFullName}
                        placeholder="e.g. Sani Ishaq"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                        style={styles.modernInput}
                        value={username}
                        onChangeText={setUsername}
                        placeholder="@username"
                        autoCapitalize="none"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Phone Number</Text>
                    <TextInput
                        style={styles.modernInput}
                        value={phone}
                        onChangeText={setPhone}
                        placeholder="e.g. 08012345678"
                        keyboardType="phone-pad"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Location</Text>
                    <TextInput
                        style={styles.modernInput}
                        value={location}
                        onChangeText={setLocation}
                        placeholder="City, State (e.g. Kano, Nigeria)"
                    />
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Gender</Text>
                    <View style={{ flexDirection: 'row', gap: 12 }}>
                        {['Male', 'Female'].map((option) => (
                            <TouchableOpacity
                                key={option}
                                onPress={() => setGender(option)}
                                style={{
                                    flex: 1, padding: 14, borderRadius: 12, borderWidth: 1,
                                    borderColor: gender === option ? '#0F172A' : '#E2E8F0',
                                    backgroundColor: gender === option ? '#F1F5F9' : 'white',
                                    alignItems: 'center'
                                }}
                            >
                                <Text style={{
                                    fontWeight: '600',
                                    color: gender === option ? '#0F172A' : '#64748B'
                                }}>{option}</Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Date of Birth</Text>
                    {Platform.OS === 'android' && (
                        <TouchableOpacity
                            onPress={() => setShowDatePicker(true)}
                            style={[styles.modernInput, { justifyContent: 'center' }]}
                        >
                            <Text style={{ color: dob ? '#0F172A' : '#94A3B8' }}>
                                {dob ? dob : 'Select Date of Birth'}
                            </Text>
                        </TouchableOpacity>
                    )}

                    {showDatePicker && (
                        <DateTimePicker
                            value={dob ? new Date(dob) : new Date()}
                            mode="date"
                            display="default"
                            onChange={onDateChange}
                            maximumDate={new Date()}
                        />
                    )}
                </View>

                <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                        style={[styles.modernInput, { height: 80, textAlignVertical: 'top' }]}
                        value={bio}
                        onChangeText={setBio}
                        placeholder="Tell us about yourself..."
                        multiline
                    />
                </View>

                <View style={[styles.inputGroup, { opacity: 0.6 }]}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                        style={[styles.modernInput, { backgroundColor: '#F8FAFC' }]}
                        value={user?.email}
                        editable={false}
                    />
                </View>

                <TouchableOpacity
                    style={[styles.modernBtn, { marginTop: 24, height: 56, marginBottom: 40 }]}
                    onPress={handleSave}
                    disabled={loading}
                >
                    {loading ? (
                        <ActivityIndicator color="white" />
                    ) : (
                        <Text style={[styles.modernBtnText, { fontSize: 16 }]}>Save Changes</Text>
                    )}
                </TouchableOpacity>

            </ScrollView>
        </View>
    );
};
