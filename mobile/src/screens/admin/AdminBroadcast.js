import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ActivityIndicator, FlatList, Animated, ScrollView, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useAppSettings } from '../../context/AppSettingsContext';
import * as ImagePicker from 'expo-image-picker';
import { UploadService } from '../../services/uploadService';
import { Image } from 'react-native';

export const AdminBroadcast = () => {
    const { settings } = useAppSettings();
    const [title, setTitle] = useState('');
    const [message, setMessage] = useState('');
    const [actionText, setActionText] = useState('');
    const [actionLink, setActionLink] = useState('');
    const [imageUrl, setImageUrl] = useState(null);
    const [imageBase64, setImageBase64] = useState(null);
    const [imageMimeType, setImageMimeType] = useState(null);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [sending, setSending] = useState(false);
    const [history, setHistory] = useState([]);
    const [target, setTarget] = useState('all'); // all, vendors, customers, drivers
    const [aiPrompt, setAiPrompt] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);

    // Custom Modal State
    const [modalVisible, setModalVisible] = useState(false);
    const [modalConfig, setModalConfig] = useState({ title: '', message: '', type: 'info', onConfirm: null });

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        const { data } = await supabase.from('notifications').select('*').eq('type', 'system').limit(15).order('created_at', { ascending: false });
        if (data) setHistory(data);
    };

    const showAlert = (title, message, type = 'info', onConfirm = null) => {
        setModalConfig({ title, message, type, onConfirm });
        setModalVisible(true);
    };

    const handleGenerateAI = async () => {
        const apiKey = settings?.gemini_api_key || process.env.EXPO_PUBLIC_GEMINI_API_KEY;

        if (!apiKey) {
            showAlert('Missing API Key', 'Please add your Gemini API Key in the Admin Settings screen.', 'error');
            return;
        }

        if (!aiPrompt.trim()) {
            showAlert('Wait!', 'Please tell the AI briefly what the broadcast is about.', 'info');
            return;
        }

        setIsGenerating(true);
        try {
            const genAI = new GoogleGenerativeAI(apiKey);
            const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

            const prompt = `Act as an expert communications manager for the 'Abu Mafhal Marketplace' app. 
            I need to send a push notification broadcast to our users targetted at: ${target}. 
            Based on this rough idea: "${aiPrompt}"
            ${imageBase64 ? "IMPORTANT CHECK: I have attached an image. Please analyze this image and incorporate its context/details to make the title and message extremely relevant to the visual." : ""}
            
            Write a professional, engaging title and a concise, clear message body.
            Format your exact response as a JSON object with two keys: "title" and "message". 
            Do NOT include markdown formatting or backticks around the JSON. Return ONLY the raw JSON object.`;

            let result;
            if (imageBase64) {
                result = await model.generateContent([
                    prompt,
                    { inlineData: { data: imageBase64, mimeType: imageMimeType || 'image/jpeg' } }
                ]);
            } else {
                result = await model.generateContent(prompt);
            }
            const responseText = result.response.text().trim().replace(/```json/g, '').replace(/```/g, '');

            const parsed = JSON.parse(responseText);

            if (parsed.title) setTitle(parsed.title);
            if (parsed.message) setMessage(parsed.message);

            setAiPrompt('');
            setAiPrompt('');
        } catch (error) {
            console.error('--- GEMINI API EXACT ERROR ---');
            console.error(error);
            if (error.response) {
                console.error('Response details:', JSON.stringify(error.response, null, 2));
            }
            if (error.message) {
                console.error('Error MESSAGE:', error.message);
            }
            showAlert('AI Error', 'Could not generate text. Check your terminal logs for the exact reason.', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handlePickImage = async () => {
        try {
            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                quality: 0.8,
                base64: true,
            });

            if (!result.canceled && result.assets && result.assets.length > 0) {
                const asset = result.assets[0];
                setImageBase64(asset.base64);
                setImageMimeType(asset.mimeType || 'image/jpeg');

                setUploadingImage(true);
                try {
                    const publicUrl = await UploadService.uploadFile(asset, 'app-assets', 'broadcasts');
                    setImageUrl(publicUrl);
                } catch (err) {
                    console.log('Upload error:', err);
                    showAlert('Upload Failed', 'Could not upload image. Make sure image is not too large.', 'error');
                } finally {
                    setUploadingImage(false);
                }
            }
        } catch (error) {
            console.log('Pick error:', error);
        }
    };

    const handleSend = async () => {
        if (!title.trim() || !message.trim()) {
            showAlert('Incomplete', 'Please provide both a title and a message.', 'info');
            return;
        }

        showAlert(
            'Confirm Broadcast',
            `Are you sure you want to send this alert to ${target.toUpperCase()} users?`,
            'confirm',
            async () => {
                setModalVisible(false);
                setSending(true);

                try {
                    // 1. Fetch Target Users (Need emails too)
                    let query = supabase.from('profiles').select('id, email, full_name');
                    if (target === 'vendors') query = query.eq('role', 'vendor');
                    else if (target === 'customers') query = query.eq('role', 'customer');
                    else if (target === 'drivers') query = query.eq('role', 'driver');

                    const { data: users, error } = await query;
                    if (error || !users) throw new Error('Could not fetch target audience.');
                    if (users.length === 0) throw new Error(`No users found in the '${target}' segment.`);

                    // 2. Prepare Notifications & Emails
                    const notifications = [];
                    const emails = [];

                    users.forEach(u => {
                        notifications.push({
                            userId: u.id,
                            title: title,
                            message: message,
                            type: 'system',
                            image_url: imageUrl,
                            is_read: false
                        });

                        if (u.email) {
                            const htmlTemplate = `
                            <!DOCTYPE html>
                            <html>
                            <head>
                                <meta charset="UTF-8">
                                <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
                            </head>
                            <body style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 40px 20px;">
                                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; box-shadow: 0 10px 25px rgba(0,0,0,0.05); overflow: hidden;">
                                    
                                    <!-- Header -->
                                    <div style="background: linear-gradient(135deg, #0F172A 0%, #1E293B 100%); text-align: center; padding: 40px 20px;">
                                        <img src="https://abumafhal.com/logo.png" alt="Abu Mafhal" style="width: 160px; margin-bottom: 25px;" onerror="this.style.display='none'">
                                        <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.3;">${title}</h1>
                                    </div>
                                    
                                    <!-- Content -->
                                    <div style="padding: 40px 30px;">
                                        <p style="font-size: 16px; color: #475569; margin-bottom: 24px; line-height: 1.6;">Hi <strong style="color: #0F172A;">${u.full_name || 'User'}</strong>,</p>
                                        
                                        ${imageUrl ? `<img src="${imageUrl}" alt="Announcement Banner" style="width: 100%; border-radius: 12px; margin-bottom: 30px; box-shadow: 0 4px 12px rgba(0,0,0,0.06);" />` : ''}
                                        
                                        <div style="font-size: 16px; color: #1E293B; line-height: 1.7; white-space: pre-wrap; margin-bottom: 30px;">${message}</div>
                                        
                                        <!-- Action Button -->
                                        ${actionLink && actionText ? `
                                        <div style="text-align: center; margin-top: 35px; margin-bottom: 10px;">
                                            <a href="${actionLink}" style="display: inline-block; background-color: #3B82F6; color: #ffffff; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-size: 16px; font-weight: 700; box-shadow: 0 4px 14px rgba(59, 130, 246, 0.4);">
                                                ${actionText}
                                            </a>
                                        </div>
                                        ` : ''}
                                    </div>
                                    
                                    <!-- Footer -->
                                    <div style="background-color: #F1F5F9; border-top: 1px solid #E2E8F0; padding: 30px 20px; text-align: center;">
                                        <p style="margin: 0 0 20px 0; color: #64748B; font-size: 14px; font-weight: 600;">Connect with us via our social platforms:</p>
                                        
                                        <div style="margin-bottom: 20px;">
                                            <a href="https://facebook.com/abumafhal" style="display: inline-block; margin: 0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733547.png" width="28" alt="Facebook"></a>
                                            <a href="https://twitter.com/abumafhal" style="display: inline-block; margin: 0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733590.png" width="28" alt="X (Twitter)"></a>
                                            <a href="https://instagram.com/abumafhal" style="display: inline-block; margin: 0 10px;"><img src="https://cdn-icons-png.flaticon.com/512/733/733558.png" width="28" alt="Instagram"></a>
                                        </div>
                                        
                                        <p style="margin: 0; color: #94A3B8; font-size: 12px;">This is an automated broadcast from Abu-Mafhal Marketplace.</p>
                                        <p style="margin: 6px 0 0 0; color: #CBD5E1; font-size: 12px;">&copy; ${new Date().getFullYear()} ABU MAFHAL LTD. All rights reserved.</p>
                                    </div>
                                </div>
                            </body>
                            </html>`;

                            emails.push({
                                to_email: u.email,
                                subject: title,
                                html: htmlTemplate,
                                type: 'broadcast',
                                status: 'pending'
                            });
                        }
                    });

                    // 3. Insert in Chunks
                    const chunkSize = 100;
                    for (let i = 0; i < notifications.length; i += chunkSize) {
                        const notifChunk = notifications.slice(i, i + chunkSize);
                        const { error: notifError } = await supabase.from('notifications').insert(notifChunk);
                        if (notifError) console.error("Notif Error:", notifError);
                    }

                    for (let i = 0; i < emails.length; i += chunkSize) {
                        const emailChunk = emails.slice(i, i + chunkSize);
                        const { error: emailError } = await supabase.from('mail').insert(emailChunk);
                        if (emailError) console.error("Mail Error:", emailError);
                    }

                    showAlert('Success! 🎉', `Broadcast successfully delivered to ${users.length} users.`, 'success');
                    setTitle('');
                    setMessage('');
                    setActionLink('');
                    setActionText('');
                    setImageUrl(null);
                    setImageBase64(null);
                    setImageMimeType(null);
                    fetchHistory();

                } catch (e) {
                    showAlert('Failed', e.message, 'error');
                } finally {
                    setSending(false);
                }
            }
        );
    };

    const CustomModal = () => (
        <Modal transparent visible={modalVisible} animationType="fade">
            <View style={{ flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.6)', justifyContent: 'center', alignItems: 'center', padding: 20 }}>
                <View style={{ backgroundColor: 'white', borderRadius: 24, width: '100%', maxWidth: 400, padding: 24, alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 10 }}>
                    <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: modalConfig.type === 'error' ? '#FEF2F2' : modalConfig.type === 'success' ? '#F0FDF4' : '#EFF6FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                        <Ionicons
                            name={modalConfig.type === 'error' ? 'alert-circle' : modalConfig.type === 'success' ? 'checkmark-circle' : modalConfig.type === 'confirm' ? 'paper-plane' : 'information-circle'}
                            size={32}
                            color={modalConfig.type === 'error' ? '#EF4444' : modalConfig.type === 'success' ? '#22C55E' : '#3B82F6'}
                        />
                    </View>
                    <Text style={{ fontSize: 20, fontWeight: '800', color: '#0F172A', marginBottom: 8, textAlign: 'center' }}>{modalConfig.title}</Text>
                    <Text style={{ fontSize: 15, color: '#64748B', textAlign: 'center', marginBottom: 24, lineHeight: 22 }}>{modalConfig.message}</Text>

                    <View style={{ flexDirection: 'row', gap: 12, width: '100%' }}>
                        {modalConfig.type === 'confirm' && (
                            <TouchableOpacity style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center' }} onPress={() => setModalVisible(false)}>
                                <Text style={{ color: '#475569', fontWeight: '700', fontSize: 16 }}>Cancel</Text>
                            </TouchableOpacity>
                        )}
                        <TouchableOpacity
                            style={{ flex: 1, padding: 14, borderRadius: 12, backgroundColor: modalConfig.type === 'error' ? '#EF4444' : '#3B82F6', alignItems: 'center', shadowColor: modalConfig.type === 'error' ? '#EF4444' : '#3B82F6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 }}
                            onPress={() => {
                                if (modalConfig.onConfirm) modalConfig.onConfirm();
                                else setModalVisible(false);
                            }}
                        >
                            <Text style={{ color: 'white', fontWeight: '700', fontSize: 16 }}>{modalConfig.type === 'confirm' ? 'Send Now' : 'Got it'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );

    return (
        <View style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            <LinearGradient colors={['#0F172A', '#1E293B']} style={{ padding: 24, paddingTop: 40, paddingBottom: 60, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                    <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="megaphone" size={20} color="#60A5FA" />
                    </View>
                    <Text style={{ fontSize: 28, fontWeight: '800', color: 'white' }}>Broadcast Hub</Text>
                </View>
                <Text style={{ color: '#94A3B8', fontSize: 15, lineHeight: 22 }}>Instantly notify your entire fleet, vendors, or customer base with AI-powered announcements.</Text>
            </LinearGradient>

            <ScrollView contentContainerStyle={{ padding: 20, marginTop: -40 }} showsVerticalScrollIndicator={false}>

                {/* Compose Card */}
                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 15, elevation: 4, marginBottom: 20 }}>

                    <Text style={localStyles.label}>Target Audience</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                            {['all', 'customers', 'vendors', 'drivers'].map(t => (
                                <TouchableOpacity
                                    key={t}
                                    onPress={() => setTarget(t)}
                                    style={[localStyles.chip, target === t && localStyles.activeChip]}
                                >
                                    <Ionicons
                                        name={t === 'all' ? 'globe-outline' : t === 'customers' ? 'people-outline' : t === 'vendors' ? 'storefront-outline' : 'car-outline'}
                                        size={16}
                                        color={target === t ? 'white' : '#64748B'}
                                    />
                                    <Text style={{ color: target === t ? 'white' : '#64748B', fontWeight: '700', textTransform: 'capitalize', fontSize: 13 }}>{t}</Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </ScrollView>

                    {/* Gemini AI Assist */}
                    <View style={{ backgroundColor: '#F0FDF4', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: '#DCFCE7' }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                            <Ionicons name="sparkles" size={18} color="#059669" />
                            <Text style={{ fontWeight: '700', color: '#065F46', fontSize: 14 }}>Gemini AI Writer</Text>
                        </View>
                        <TextInput
                            style={{ backgroundColor: 'white', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#BBF7D0', marginBottom: 12, fontSize: 14, color: '#064E3B' }}
                            placeholder="Briefly describe what you want to announce..."
                            placeholderTextColor="#9CA3AF"
                            value={aiPrompt}
                            onChangeText={setAiPrompt}
                        />
                        <TouchableOpacity
                            style={{ backgroundColor: '#10B981', padding: 12, borderRadius: 12, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 }}
                            onPress={handleGenerateAI}
                            disabled={isGenerating}
                        >
                            {isGenerating ? <ActivityIndicator color="white" size="small" /> : (
                                <>
                                    <Ionicons name="color-wand" size={16} color="white" />
                                    <Text style={{ color: 'white', fontWeight: '700' }}>Generate Message</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>

                    {/* Optional Image */}
                    <Text style={localStyles.label}>Optional Image Attachment</Text>
                    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                        <TouchableOpacity
                            style={{ width: 80, height: 80, borderRadius: 16, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0', borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', marginRight: 15, overflow: 'hidden' }}
                            onPress={handlePickImage}
                            disabled={uploadingImage}
                        >
                            {uploadingImage ? <ActivityIndicator color="#3B82F6" /> : imageUrl ? (
                                <Image source={{ uri: imageUrl }} style={{ width: '100%', height: '100%' }} />
                            ) : (
                                <Ionicons name="image-outline" size={28} color="#94A3B8" />
                            )}
                        </TouchableOpacity>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontSize: 13, color: '#64748B', marginBottom: 4 }}>Add a banner or promotional image to make your message stand out.</Text>
                            {imageUrl && (
                                <TouchableOpacity onPress={() => { setImageUrl(null); setImageBase64(null); setImageMimeType(null); }}>
                                    <Text style={{ color: '#EF4444', fontWeight: '600', fontSize: 13 }}>Remove Image</Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>

                    <Text style={localStyles.label}>Broadcast Title</Text>
                    <TextInput
                        style={localStyles.input}
                        placeholder="e.g. Important System Update"
                        placeholderTextColor="#94A3B8"
                        value={title}
                        onChangeText={setTitle}
                    />

                    <Text style={localStyles.label}>Broadcast Message</Text>
                    <TextInput
                        style={[localStyles.input, { height: 120, textAlignVertical: 'top', paddingTop: 16 }]}
                        placeholder="Type the full announcement here..."
                        placeholderTextColor="#94A3B8"
                        value={message}
                        onChangeText={setMessage}
                        multiline
                    />

                    <Text style={localStyles.label}>Optional Button Link</Text>
                    <TextInput
                        style={localStyles.input}
                        placeholder="e.g. https://abumafhal.com/promo"
                        placeholderTextColor="#94A3B8"
                        keyboardType="url"
                        autoCapitalize="none"
                        value={actionLink}
                        onChangeText={setActionLink}
                    />

                    {actionLink.length > 0 && (
                        <>
                            <Text style={localStyles.label}>Button Text</Text>
                            <TextInput
                                style={localStyles.input}
                                placeholder="e.g. Shop Now"
                                placeholderTextColor="#94A3B8"
                                value={actionText}
                                onChangeText={setActionText}
                            />
                        </>
                    )}

                    <TouchableOpacity
                        style={{ backgroundColor: '#3B82F6', padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 8, shadowColor: '#3B82F6', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.3, shadowRadius: 10, elevation: 6 }}
                        onPress={handleSend}
                        disabled={sending}
                    >
                        {sending ? <ActivityIndicator color="white" /> : (
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                                <Ionicons name="send" size={20} color="white" />
                                <Text style={{ color: 'white', fontWeight: '800', fontSize: 16, letterSpacing: 0.5 }}>Broadcast Now</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>

                {/* History Section */}
                <Text style={{ fontWeight: '800', fontSize: 18, color: '#0F172A', marginBottom: 16, marginLeft: 4 }}>Recent Broadcasts</Text>

                {history.map((item, index) => (
                    <View key={item.id || index} style={{ backgroundColor: 'white', borderRadius: 16, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#F1F5F9' }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                            <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flex: 1, paddingRight: 10 }}>
                                <Text style={{ fontWeight: '700', color: '#0F172A', fontSize: 15 }} numberOfLines={1}>{item.title}</Text>
                            </View>
                            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                                <View style={{ backgroundColor: '#F1F5F9', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                                    <Text style={{ fontSize: 11, color: '#64748B', fontWeight: '600' }}>{new Date(item.created_at).toLocaleDateString()}</Text>
                                </View>
                                <TouchableOpacity
                                    style={{ backgroundColor: '#DBEAFE', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 4 }}
                                    onPress={() => {
                                        setTitle(item.title);
                                        setMessage(item.message);
                                        if (item.image_url) setImageUrl(item.image_url);
                                    }}
                                >
                                    <Ionicons name="reload" size={12} color="#2563EB" />
                                    <Text style={{ fontSize: 11, color: '#2563EB', fontWeight: '700' }}>Resend</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                        <Text style={{ fontSize: 14, color: '#475569', lineHeight: 20 }} numberOfLines={2}>{item.message}</Text>
                        {item.image_url && (
                            <Image source={{ uri: item.image_url }} style={{ width: '100%', height: 150, borderRadius: 12, marginTop: 12 }} resizeMode="cover" />
                        )}
                    </View>
                ))}

                {history.length === 0 && (
                    <View style={{ alignItems: 'center', padding: 30, opacity: 0.5 }}>
                        <Ionicons name="chatbubbles-outline" size={40} color="#94A3B8" style={{ marginBottom: 10 }} />
                        <Text style={{ color: '#64748B', fontWeight: '500' }}>No recent broadcasts</Text>
                    </View>
                )}

            </ScrollView>

            <CustomModal />
        </View>
    );
};

const localStyles = {
    label: { fontSize: 13, color: '#475569', fontWeight: '700', marginBottom: 8, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
    input: { backgroundColor: '#F8FAFC', padding: 16, borderRadius: 16, borderWidth: 1, borderColor: '#E2E8F0', marginBottom: 20, fontSize: 15, color: '#0F172A' },
    chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 18, paddingVertical: 12, borderRadius: 20, backgroundColor: '#F1F5F9', borderWidth: 1, borderColor: '#E2E8F0' },
    activeChip: { backgroundColor: '#0F172A', borderColor: '#0F172A' }
};
