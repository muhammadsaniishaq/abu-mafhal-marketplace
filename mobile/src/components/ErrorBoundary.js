import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught error:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReload = () => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'Main');
                window.location.hash = '';
            }
        } catch (_) {}

        this.setState({ hasError: false, error: null, errorInfo: null });

        if (this.props.onReset) {
            this.props.onReset();
        } else if (typeof window !== 'undefined') {
            window.location.href = '/mobile';
        }
    };

    handleGoHome = () => {
        try {
            if (typeof window !== 'undefined' && window.localStorage) {
                window.localStorage.setItem('@abumafhal_last_screen', 'Main');
                window.location.hash = '';
            }
        } catch (_) {}

        this.setState({ hasError: false, error: null, errorInfo: null });

        if (typeof window !== 'undefined') {
            window.location.href = '/mobile';
        }
    };

    render() {
        if (this.state.hasError) {
            const errorMsg = String(this.state.error?.message || 'Wani kuskure ya faru a manhajar.');

            return (
                <View style={s.container}>
                    <View style={s.card}>
                        <View style={s.iconWrap}>
                            <Ionicons name="warning" size={36} color="#D9A73A" />
                        </View>
                        <Text style={s.title}>Abu Mafhal Marketplace</Text>
                        <Text style={s.subTitle}>Wani kuskure ya faru / Something went wrong</Text>
                        
                        <ScrollView style={s.errScroll} contentContainerStyle={{ padding: 10 }}>
                            <Text style={s.errTxt}>{errorMsg}</Text>
                        </ScrollView>

                        <View style={s.btnRow}>
                            <TouchableOpacity style={s.primaryBtn} onPress={this.handleReload} activeOpacity={0.85}>
                                <Ionicons name="reload" size={16} color="#0E1A2E" />
                                <Text style={s.primaryBtnTxt}>Sake Gwadawa (Reload)</Text>
                            </TouchableOpacity>

                            <TouchableOpacity style={s.secondaryBtn} onPress={this.handleGoHome} activeOpacity={0.85}>
                                <Ionicons name="home" size={16} color="#FFFFFF" />
                                <Text style={s.secondaryBtnTxt}>Koma Babban Shafi</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const s = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0E1A2E',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 420,
        backgroundColor: '#16253D',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.3,
        shadowRadius: 16,
        elevation: 8,
    },
    iconWrap: {
        width: 68,
        height: 68,
        borderRadius: 34,
        backgroundColor: 'rgba(217, 167, 58, 0.15)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(217, 167, 58, 0.3)',
        marginBottom: 16,
    },
    title: {
        fontSize: 18,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: 0.5,
        textAlign: 'center',
        marginBottom: 4,
    },
    subTitle: {
        fontSize: 12,
        color: '#94A3B8',
        textAlign: 'center',
        marginBottom: 16,
    },
    errScroll: {
        maxHeight: 100,
        width: '100%',
        backgroundColor: 'rgba(14, 26, 46, 0.8)',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        marginBottom: 20,
    },
    errTxt: {
        color: '#F87171',
        fontSize: 11,
        fontFamily: 'monospace',
    },
    btnRow: {
        width: '100%',
        gap: 10,
    },
    primaryBtn: {
        backgroundColor: '#D9A73A',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        borderRadius: 12,
        width: '100%',
    },
    primaryBtnTxt: {
        color: '#0E1A2E',
        fontWeight: '900',
        fontSize: 13.5,
    },
    secondaryBtn: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        borderRadius: 12,
        width: '100%',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
    },
    secondaryBtnTxt: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 13,
    },
});
