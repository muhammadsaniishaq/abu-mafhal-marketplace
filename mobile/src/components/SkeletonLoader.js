import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

export const Skeleton = ({ width, height, style }) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 800,
                    useNativeDriver: false,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 800,
                    useNativeDriver: false,
                }),
            ])
        ).start();
    }, []);

    return (
        <Animated.View style={[{ width, height, backgroundColor: '#E2E8F0', borderRadius: 8, opacity }, style]} />
    );
};

export const HomeSkeleton = () => (
    <View style={{ padding: 16 }}>
        {/* Header Skeleton */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Skeleton width={40} height={40} style={{ borderRadius: 20, marginRight: 12 }} />
                <View>
                    <Skeleton width={80} height={12} style={{ marginBottom: 6 }} />
                    <Skeleton width={120} height={16} />
                </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
                <Skeleton width={32} height={32} />
                <Skeleton width={32} height={32} />
            </View>
        </View>

        {/* Search */}
        <Skeleton width="100%" height={48} style={{ borderRadius: 12, marginBottom: 20 }} />

        {/* Hero Banner */}
        <Skeleton width="100%" height={180} style={{ borderRadius: 16, marginBottom: 24 }} />

        {/* Categories */}
        <Skeleton width={100} height={20} style={{ marginBottom: 12 }} />
        <View style={{ flexDirection: 'row', gap: 16, marginBottom: 24 }}>
            <Skeleton width={64} height={64} style={{ borderRadius: 32 }} />
            <Skeleton width={64} height={64} style={{ borderRadius: 32 }} />
            <Skeleton width={64} height={64} style={{ borderRadius: 32 }} />
            <Skeleton width={64} height={64} style={{ borderRadius: 32 }} />
        </View>
    </View>
);
