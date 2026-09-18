import React from 'react';
import { StyleSheet, Modal, View, Animated, TouchableWithoutFeedback, Text, Alert, Dimensions, Easing, TouchableOpacity, Platform, ActivityIndicator } from 'react-native';
import WebView from 'react-native-webview';
import { colors } from './flw_configs.js';
import { Ionicons } from '@expo/vector-icons';

var borderRadiusDimension = 24 / 896;
var windowHeight = Dimensions.get('window').height;

var getRedirectParams = function (url) {
    var res = {};
    if (url.split('?').length > 1) {
        var params = url.split('?')[1].split('&');
        for (var i = 0; i < params.length; i++) {
            var param = params[i].split('=');
            var val = decodeURIComponent(param[1]).trim();
            res[param[0]] = String(val);
        }
    }
    return res;
};

var FlutterwaveCheckout = function FlutterwaveCheckout(props) {
    var link = props.link, visible = props.visible, onRedirect = props.onRedirect, onAbort = props.onAbort;
    var _a = React.useState(false), show = _a[0], setShow = _a[1];
    var webviewRef = React.useRef(null);
    var animation = React.useRef(new Animated.Value(0));

    var animateIn = React.useCallback(function () {
        setShow(true);
        Animated.timing(animation.current, {
            toValue: 1,
            duration: 700,
            easing: Easing["in"](Easing.elastic(0.72)),
            useNativeDriver: false
        }).start();
    }, []);

    var animateOut = React.useCallback(function () {
        return new Promise(function (resolve) {
            Animated.timing(animation.current, {
                toValue: 0,
                duration: 400,
                useNativeDriver: false
            }).start(function () {
                setShow(false);
                resolve();
            });
        });
    }, []);

    var handleReload = React.useCallback(function () {
        if (webviewRef.current) {
            webviewRef.current.reload();
        }
    }, []);

    var handleAbort = React.useCallback(function (confirmed) {
        if (confirmed === void 0) { confirmed = false; }
        if (!confirmed) {
            Alert.alert('', 'Are you sure you want to cancel this payment?', [
                { text: 'No' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: function () { return handleAbort(true); }
                },
            ]);
            return;
        }
        animateOut().then(onAbort);
    }, [onAbort, animateOut]);

    var handleNavigationStateChange = React.useCallback(function (ev) {
        var url = (ev && ev.url) ? String(ev.url) : '';
        if (!url) return true;

        var isSuccess = (
            url.includes('standard.paystack.co/close') ||
            url.includes('status=successful') ||
            url.includes('status=success') ||
            url.includes('status=completed') ||
            url.includes('/payment/verify') ||
            url.includes('/payment/success') ||
            /\/flutterwave\.com\/rn-redirect/.test(url) ||
            url.includes('trxref=')
        );

        var isCancelled = (
            url.includes('status=cancelled') ||
            url.includes('status=failed') ||
            url.includes('/payment/cancel')
        );

        if (!isSuccess && !isCancelled) {
            return true;
        }

        animateOut().then(function () {
            if (isCancelled) {
                if (onAbort) onAbort();
            } else if (onRedirect) {
                var params = getRedirectParams(url);
                if (!params.status) {
                    params.status = 'successful';
                }
                onRedirect(params);
            }
        });
        return false;
    }, [onRedirect, onAbort, animateOut]);

    // Listen to postMessage on Web
    React.useEffect(function () {
        if (Platform.OS !== 'web' || typeof window === 'undefined') return;
        var handleMsg = function (e) {
            var d = e && e.data;
            if (!d) return;
            var data = d;
            if (typeof d === 'string') {
                try { data = JSON.parse(d); } catch (_) {}
            }
            if (typeof data === 'object' && data !== null) {
                if (data.status === 'successful' || data.event === 'charge.success') {
                    animateOut().then(function () {
                        if (onRedirect) onRedirect(data);
                    });
                    return;
                }
                if (data.status === 'cancelled' || data.event === 'checkout.closed') {
                    animateOut().then(function () {
                        if (onAbort) onAbort();
                    });
                    return;
                }
            }
        };
        window.addEventListener('message', handleMsg);
        return function () {
            window.removeEventListener('message', handleMsg);
        };
    }, [onRedirect, onAbort, animateOut]);

    var doAnimate = React.useCallback(function () {
        if (visible === show) {
            return;
        }
        if (visible) {
            return animateIn();
        }
        animateOut().then(function () { });
    }, [visible, show, animateOut, animateIn]);

    React.useEffect(function () {
        doAnimate();
        return function () { };
    }, [doAnimate]);

    var marginTop = animation.current.interpolate({
        inputRange: [0, 1],
        outputRange: [windowHeight, 0]
    });

    var opacity = animation.current.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [0, 1, 1]
    });

    var isHtml = typeof link === 'string' && (link.trim().startsWith('<') || link.trim().startsWith('<!DOCTYPE'));

    return (<Modal transparent={true} animated={false} hardwareAccelerated={false} visible={show}>
        <FlutterwaveCheckoutBackdrop onPress={function () { return handleAbort(); }} animation={animation.current} />
        <Animated.View style={[
            styles.webviewContainer,
            {
                marginTop: marginTop,
                opacity: opacity
            }
        ]} testID='flw-checkout-dialog'>
            {/* Native Clean Header */}
            <View style={{
                height: 48,
                backgroundColor: '#FFFFFF',
                borderBottomWidth: 1,
                borderBottomColor: '#E2E8F0',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 16
            }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="shield-checkmark" size={16} color="#10B981" />
                    <Text style={{ fontSize: 13, fontWeight: '800', color: '#0F172A' }}>
                        Secure Escrow Checkout
                    </Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <TouchableOpacity onPress={handleReload} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="refresh" size={18} color="#64748B" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={function () { return handleAbort(); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                        <Ionicons name="close" size={22} color="#0F172A" />
                    </TouchableOpacity>
                </View>
            </View>

            {Platform.OS === 'web' ? (
                <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
                    {isHtml ? (
                        <iframe
                            srcDoc={link}
                            style={{ width: '100%', flex: 1, border: 'none', height: '100%' }}
                            title="Secure Checkout"
                            allow="payment; camera; microphone; geolocation"
                        />
                    ) : (
                        <iframe
                            src={link || ''}
                            style={{ width: '100%', flex: 1, border: 'none', height: '100%' }}
                            title="Secure Checkout"
                            allow="payment; camera; microphone; geolocation"
                        />
                    )}
                </View>
            ) : (
                <WebView
                    ref={webviewRef}
                    source={isHtml ? { html: link } : { uri: link || '' }}
                    style={styles.webview}
                    startInLoadingState={true}
                    scalesPageToFit={true}
                    javaScriptEnabled={true}
                    domStorageEnabled={true}
                    originWhitelist={['*']}
                    mixedContentMode="always"
                    allowsInlineMediaPlayback={true}
                    onShouldStartLoadWithRequest={handleNavigationStateChange}
                    onNavigationStateChange={handleNavigationStateChange}
                    renderError={function () { return <FlutterwaveCheckoutError hasLink={!!link} onTryAgain={handleReload} />; }}
                    renderLoading={function () { return <FlutterwaveCheckoutLoader />; }}
                />
            )}
        </Animated.View>
    </Modal>);
};

var FlutterwaveCheckoutBackdrop = function FlutterwaveCheckoutBackdrop(_a) {
    var animation = _a.animation, onPress = _a.onPress;
    var backgroundColor = animation.interpolate({
        inputRange: [0, 0.3, 1],
        outputRange: [colors.transparent, colors.transparent, 'rgba(0,0,0,0.5)']
    });
    return (<TouchableWithoutFeedback testID='flw-checkout-backdrop' onPress={onPress}>
        <Animated.View style={Object.assign({}, styles.backdrop, { backgroundColor: backgroundColor })} />
    </TouchableWithoutFeedback>);
};

export var FlutterwaveCheckoutError = function (_a) {
    var hasLink = _a.hasLink, onTryAgain = _a.onTryAgain;
    return (<View style={styles.error} testID="flw-checkout-error">
        {hasLink ? (<>
            <Text style={styles.errorText}>
                An error occurred, please tap below to try again.
            </Text>
            <TouchableOpacity style={styles.errorActionButton} onPress={onTryAgain}>
                <Text style={styles.errorActionButtonText}>Try Again</Text>
            </TouchableOpacity>
        </>) : (<Text style={styles.errorText}>
            An error occurred, please close the checkout dialog and try again.
        </Text>)}
    </View>);
};

var FlutterwaveCheckoutLoader = function () {
    return (<View style={styles.loading} testID="flw-checkout-loader">
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={{ marginTop: 14, fontSize: 13, fontWeight: '700', color: '#64748B' }}>
            Securing payment session...
        </Text>
    </View>);
};

var styles = StyleSheet.create({
    webviewContainer: {
        flex: 1,
        backgroundColor: colors.white,
        marginTop: 40,
        borderTopLeftRadius: borderRadiusDimension * windowHeight,
        borderTopRightRadius: borderRadiusDimension * windowHeight,
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
        backgroundColor: colors.white,
    },
    backdrop: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    loading: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
    },
    error: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: colors.white,
        padding: 24,
    },
    errorText: {
        fontSize: 14,
        color: '#64748B',
        textAlign: 'center',
        marginBottom: 16,
    },
    errorActionButton: {
        backgroundColor: colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 12,
    },
    errorActionButtonText: {
        color: colors.white,
        fontWeight: '700',
        fontSize: 14,
    }
});

export default FlutterwaveCheckout;
