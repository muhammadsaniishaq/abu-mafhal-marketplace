import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';

const SkeletonItem = ({ width, height, borderRadius = 8, marginBottom = 10 }) => {
    const opacity = useRef(new Animated.Value(0.3)).current;

    useEffect(() => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(opacity, {
                    toValue: 0.7,
                    duration: 1000,
                    useNativeDriver: true,
                }),
                Animated.timing(opacity, {
                    toValue: 0.3,
                    duration: 1000,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    }, [opacity]);

    return (
        <Animated.View
            style={[
                styles.skeleton,
                { width, height, borderRadius, marginBottom, opacity },
            ]}
        />
    );
};

export const CheckoutAddressSkeleton = () => (
    <View style={styles.card}>
        <View style={styles.icon} />
        <View style={styles.content}>
            <SkeletonItem width="40%" height={20} />
            <SkeletonItem width="80%" height={14} />
            <SkeletonItem width="60%" height={14} />
            <SkeletonItem width="30%" height={16} />
        </View>
    </View>
);

export const CheckoutSummarySkeleton = () => (
    <View style={styles.summaryBox}>
        <SkeletonItem width="50%" height={18} marginBottom={20} />
        <View style={styles.row}>
            <SkeletonItem width="60%" height={14} />
            <SkeletonItem width="20%" height={14} />
        </View>
        <View style={styles.row}>
            <SkeletonItem width="60%" height={14} />
            <SkeletonItem width="20%" height={14} />
        </View>
        <View style={styles.divider} />
        <View style={styles.row}>
            <SkeletonItem width="40%" height={20} />
            <SkeletonItem width="30%" height={20} />
        </View>
    </View>
);

const styles = StyleSheet.create({
    skeleton: {
        backgroundColor: '#E2E8F0',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 16,
        marginBottom: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    icon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        backgroundColor: '#F1F5F9',
        marginRight: 16,
    },
    content: {
        flex: 1,
    },
    summaryBox: {
        backgroundColor: '#FFFFFF',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1.5,
        borderColor: '#F1F5F9',
    },
    row: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
    },
    divider: {
        height: 1,
        backgroundColor: '#F1F5F9',
        marginVertical: 16,
    }
});
