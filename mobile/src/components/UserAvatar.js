import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/**
 * UserAvatar Component
 * A universal avatar component that handles image loading, fallbacks, and consistent sizing.
 * 
 * @param {Object} user - The user object (can be from Auth or Profiles table)
 * @param {number} size - Pixel size (width/height)
 * @param {string} border - Color of the border (optional)
 * @param {number} borderRadius - Custom border radius (optional)
 * @param {string} sourceUrl - Direct URL override (optional)
 */
export const UserAvatar = ({ user, size = 50, border, borderRadius, sourceUrl }) => {
    const [imgError, setImgError] = React.useState(false);

    // 1. Resolve Avatar URL Priority:
    // sourceUrl -> user.avatar_url -> user.user_metadata.avatar_url
    const avatarUrl = sourceUrl || user?.avatar_url || user?.user_metadata?.avatar_url;

    // 2. Resolve Display Name / Initials:
    const fullName = user?.full_name || user?.user_metadata?.full_name || user?.fullName || 'User';
    const initials = fullName.charAt(0).toUpperCase();

    // 3. Dynamic Styles based on Size
    const boxSize = { width: size, height: size, borderRadius: borderRadius ?? size / 2 };
    const fontSize = size * 0.4;

    // Reset imgError if avatarUrl changes
    React.useEffect(() => {
        setImgError(false);
    }, [avatarUrl]);

    return (
        <View style={[
            styles.container,
            boxSize,
            border && { borderWidth: 1.5, borderColor: border },
            { backgroundColor: '#F1F5F9' }
        ]}>
            {avatarUrl && !imgError ? (
                <Image
                    source={{ uri: avatarUrl }}
                    style={[styles.image, { borderRadius: borderRadius ?? size / 2 }]}
                    onError={() => setImgError(true)}
                />
            ) : (
                <View style={[styles.fallback, { borderRadius: borderRadius ?? size / 2 }]}>
                    <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    image: {
        width: '100%',
        height: '100%',
    },
    fallback: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#E2E8F0',
    },
    initials: {
        fontWeight: '800',
        color: '#64748B',
    }
});
