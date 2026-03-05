import React, { useEffect, useRef } from 'react';
import { Animated, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export const Toast = ({ message, type = 'success', visible, onHide }) => {
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            Animated.sequence([
                Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
                Animated.delay(2500),
                Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: false })
            ]).start(() => onHide && onHide());
        }
    }, [visible]);

    if (!visible) return null;

    const bgColor = type === 'success' ? '#10B981' : type === 'error' ? '#EF4444' : '#3B82F6';
    const icon = type === 'success' ? 'checkmark-circle' : type === 'error' ? 'alert-circle' : 'information-circle';

    return (
        <Animated.View style={{
            position: 'absolute', top: 64, left: 16, right: 16,
            backgroundColor: 'rgba(255, 255, 255, 0.95)', borderRadius: 20, padding: 16,
            flexDirection: 'row', alignItems: 'center', gap: 16,
            boxShadow: '0px 4px 10px rgba(0,0,0,0.1)',
            borderLeftWidth: 6, borderLeftColor: bgColor, opacity: fadeAnim, zIndex: 1000
        }}>
            <View style={{ padding: 10, backgroundColor: `${bgColor} 20`, borderRadius: 14 }}>
                <Ionicons name={icon} size={28} color={bgColor} />
            </View>
            <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '800', color: '#0F172A', fontSize: 16, marginBottom: 4 }}>{type === 'success' ? 'Success' : type === 'error' ? 'Error' : 'Notice'}</Text>
                <Text style={{ color: '#475569', fontWeight: '500', fontSize: 14, lineHeight: 20 }}>{message}</Text>
            </View>
        </Animated.View>
    );
};
