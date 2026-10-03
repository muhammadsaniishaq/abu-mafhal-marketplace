import React, { useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Modal,
    TouchableOpacity,
    Platform,
    Linking,
    Dimensions
} from 'react-native';
import { LucideIcon } from './LucideIcon';
import { whatsappService } from '../services/whatsappService';

const { width, height } = Dimensions.get('window');

const NAVY = '#0B132B';
const NAVY_CARD = '#1C2541';
const GOLD = '#D9A73A';
const SUCCESS = '#10B981';
const DANGER = '#EF4444';
const TEXT_MUTED = '#94A3B8';
const BORDER_COLOR = '#E2E8F0';

// Known Area Coordinates in Nigeria (Kano / Abuja / Lagos / etc.)
const KNOWN_COORDINATES = {
    'kano hub': { lat: 12.0022, lng: 8.5920 },
    'kano': { lat: 12.0022, lng: 8.5920 },
    'bompai': { lat: 12.0180, lng: 8.5520 },
    'nassarawa': { lat: 12.0100, lng: 8.5400 },
    'fagge': { lat: 12.0250, lng: 8.5200 },
    'sabongari': { lat: 12.0120, lng: 8.5350 },
    'tarauni': { lat: 11.9700, lng: 8.5500 },
    'gwale': { lat: 11.9900, lng: 8.5100 },
    'dala': { lat: 12.0150, lng: 8.5000 },
    'kumbotso': { lat: 11.8900, lng: 8.5000 },
    'ungogo': { lat: 12.0800, lng: 8.4800 },
    'kaduna': { lat: 10.5105, lng: 7.4165 },
    'abuja': { lat: 9.0765, lng: 7.3986 },
    'lagos': { lat: 6.5244, lng: 3.3792 }
};

export const getDestinationCoords = (addrStr) => {
    if (!addrStr) return { lat: 12.0120, lng: 8.5400, label: 'Kano Delivery Zone' };
    const s = String(addrStr).toLowerCase();
    for (const [key, coords] of Object.entries(KNOWN_COORDINATES)) {
        if (s.includes(key)) {
            return { ...coords, label: key.toUpperCase() };
        }
    }
    let hash = 0;
    for (let i = 0; i < s.length; i++) hash = (hash << 5) - hash + s.charCodeAt(i);
    const dLat = ((Math.abs(hash) % 40) - 20) / 1000;
    const dLng = ((Math.abs(hash >> 3) % 40) - 20) / 1000;
    return { lat: 12.0022 + dLat, lng: 8.5920 + dLng, label: 'Delivery Location' };
};

export const calculateDistanceKm = (lat1, lon1, lat2, lon2) => {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 3.2;
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Math.max(0.5, Math.round(R * c * 10) / 10);
};

export const DriverRouteMapModal = ({
    visible,
    onClose,
    order,
    driverProfile,
    userRole = 'driver',
    onArrived
}) => {
    if (!visible || !order) return null;

    const address = useMemo(() => {
        const raw = order.shipping_address;
        if (!raw) return 'Delivery Address';
        if (typeof raw === 'string' && raw.startsWith('{')) {
            try {
                const parsed = JSON.parse(raw);
                return [parsed.address || parsed.street, parsed.city || parsed.lga, parsed.state].filter(Boolean).join(', ');
            } catch (_) {
                return raw;
            }
        }
        if (typeof raw === 'object') {
            return [raw.address || raw.street, raw.city || raw.lga, raw.state].filter(Boolean).join(', ');
        }
        return raw;
    }, [order.shipping_address]);

    const recipientName = order.user?.full_name || order.shipping_details?.full_name || 'Customer Recipient';
    const recipientPhone = order.user?.phone || order.contact_phone || order.shipping_details?.phone || '';

    // Coordinates calculation
    const destCoords = useMemo(() => getDestinationCoords(address), [address]);
    const driverCoords = useMemo(() => {
        const dLat = Number(driverProfile?.latitude) || Number(order.driver_latitude);
        const dLng = Number(driverProfile?.longitude) || Number(order.driver_longitude);
        if (dLat && dLng) return { lat: dLat, lng: dLng };
        return { lat: 12.0022, lng: 8.5920 }; // Default Kano Central Hub
    }, [driverProfile, order]);

    const distanceKm = useMemo(() => {
        return calculateDistanceKm(driverCoords.lat, driverCoords.lng, destCoords.lat, destCoords.lng);
    }, [driverCoords, destCoords]);

    const estimatedMins = useMemo(() => {
        return Math.max(3, Math.round(distanceKm * 3.2 + 2));
    }, [distanceKm]);

    // External GPS Navigation
    const openGoogleMaps = () => {
        const url = `https://www.google.com/maps/dir/?api=1&origin=${driverCoords.lat},${driverCoords.lng}&destination=${destCoords.lat},${destCoords.lng}&travelmode=driving`;
        Linking.openURL(url).catch(() => {});
    };

    const handleCall = () => {
        if (recipientPhone) Linking.openURL(`tel:${recipientPhone}`);
    };

    const handleWhatsApp = () => {
        if (!recipientPhone) return;
        const msg = `Assalamu Alaikum ${recipientName}! I am your Abu Mafhal courier partner en route with your package #${(order.id || '').slice(0, 8).toUpperCase()}. Distance: ~${distanceKm} km (~${estimatedMins} mins).`;
        whatsappService.sendDirect(recipientPhone, msg, order.user_id).catch(() => {
            whatsappService.openWhatsApp(recipientPhone, msg);
        });
    };

    // Interactive In-App Leaflet OpenStreetMap HTML
    const mapHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
        <style>
          html, body, #map { height: 100%; width: 100%; margin: 0; padding: 0; background: #0B132B; }
          .leaflet-popup-content-wrapper { background: #0F172A; color: #FFF; border-radius: 10px; border: 1px solid #334155; }
          .leaflet-popup-tip { background: #0F172A; }
          .pulse-driver {
            width: 22px; height: 22px; border-radius: 50%; background: #38BDF8;
            border: 3px solid #FFFFFF; box-shadow: 0 0 12px #38BDF8;
            display: flex; align-items: center; justify-content: center;
          }
          .pulse-dest {
            width: 26px; height: 26px; border-radius: 50%; background: #D9A73A;
            border: 3px solid #FFFFFF; box-shadow: 0 0 14px #D9A73A;
            display: flex; align-items: center; justify-content: center; font-size: 13px;
          }
        </style>
      </head>
      <body>
        <div id="map"></div>
        <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
        <script>
          const map = L.map('map', { zoomControl: false, attributionControl: false });
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18 }).addTo(map);

          const driverPos = [${driverCoords.lat}, ${driverCoords.lng}];
          const destPos = [${destCoords.lat}, ${destCoords.lng}];

          const driverIcon = L.divIcon({ className: '', html: '<div class="pulse-driver">🏍️</div>', iconSize: [24, 24] });
          const destIcon = L.divIcon({ className: '', html: '<div class="pulse-dest">📍</div>', iconSize: [28, 28] });

          L.marker(driverPos, { icon: driverIcon }).addTo(map).bindPopup("<b>Courier Rider</b><br/>En Route (~${distanceKm} km)").openPopup();
          L.marker(destPos, { icon: destIcon }).addTo(map).bindPopup("<b>${recipientName}</b><br/>${destCoords.label}");

          const polyline = L.polyline([driverPos, destPos], { color: '#2563EB', weight: 4, dashArray: '6, 8', opacity: 0.85 }).addTo(map);
          map.fitBounds([driverPos, destPos], { padding: [50, 50] });
        </script>
      </body>
    </html>
    `;

    return (
        <Modal visible={visible} transparent animationType="slide">
            <View style={styles.modalBackdrop}>
                <View style={styles.sheetContainer}>
                    {/* Header */}
                    <View style={styles.sheetHeader}>
                        <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                                <LucideIcon name="navigation" size={15} color={GOLD} />
                                <Text style={styles.sheetTitle}>
                                    {userRole === 'driver' ? 'Active Route & Navigation' : 'Live Courier Radar'}
                                </Text>
                            </View>
                            <Text style={styles.sheetSub}>
                                Consignment #{(order.id || '').slice(0, 8).toUpperCase()} • Recipient: {recipientName}
                            </Text>
                        </View>
                        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.8}>
                            <LucideIcon name="close" size={18} color="#FFFFFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Telemetry Metric Cards */}
                    <View style={styles.telemetryBar}>
                        <View style={styles.telemetryBox}>
                            <Text style={styles.telemetryLabel}>DISTANCE</Text>
                            <Text style={[styles.telemetryVal, { color: '#38BDF8' }]}>{distanceKm} km</Text>
                        </View>
                        <View style={styles.telemetryDivider} />
                        <View style={styles.telemetryBox}>
                            <Text style={styles.telemetryLabel}>ESTIMATED TIME</Text>
                            <Text style={[styles.telemetryVal, { color: SUCCESS }]}>~{estimatedMins} mins</Text>
                        </View>
                        <View style={styles.telemetryDivider} />
                        <View style={styles.telemetryBox}>
                            <Text style={styles.telemetryLabel}>STATUS</Text>
                            <Text style={[styles.telemetryVal, { color: GOLD }]}>IN TRANSIT</Text>
                        </View>
                    </View>

                    {/* Embedded Interactive Route Map */}
                    <View style={styles.mapCanvasWrapper}>
                        {Platform.OS === 'web' ? (
                            <iframe
                                title="Courier Navigation Map"
                                srcDoc={mapHtml}
                                style={{
                                    width: '100%',
                                    height: '100%',
                                    border: 'none',
                                    borderRadius: 14
                                }}
                            />
                        ) : (
                            <View style={styles.mobileMapFallback}>
                                <LucideIcon name="navigation" size={36} color={GOLD} />
                                <Text style={styles.mobileMapFallbackText}>Live Map Active: {distanceKm} km away</Text>
                                <Text style={styles.mobileMapFallbackSub}>Routing through {destCoords.label}</Text>
                            </View>
                        )}
                    </View>

                    {/* Waypoint Details */}
                    <View style={styles.destinationStrip}>
                        <LucideIcon name="map-pin" size={18} color={GOLD} style={{ marginTop: 2 }} />
                        <View style={{ flex: 1 }}>
                            <Text style={styles.destStripLabel}>DESTINATION ADDRESS</Text>
                            <Text style={styles.destStripAddress} numberOfLines={2}>{address}</Text>
                        </View>
                    </View>

                    {/* Contact & Navigation Actions */}
                    <View style={styles.actionBar}>
                        <TouchableOpacity style={styles.callMiniBtn} onPress={handleCall} activeOpacity={0.85}>
                            <LucideIcon name="phone" size={14} color="#0F172A" />
                            <Text style={styles.callMiniBtnText}>Call</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.whatsappMiniBtn} onPress={handleWhatsApp} activeOpacity={0.85}>
                            <LucideIcon name="message-square" size={14} color="#FFFFFF" />
                            <Text style={styles.whatsappMiniBtnText}>WhatsApp</Text>
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.googleMapsBtn} onPress={openGoogleMaps} activeOpacity={0.85}>
                            <LucideIcon name="navigation" size={14} color="#070D1B" />
                            <Text style={styles.googleMapsBtnText}>Turn-by-Turn GPS</Text>
                        </TouchableOpacity>
                    </View>

                    {userRole === 'driver' && onArrived && (
                        <TouchableOpacity
                            style={styles.arrivedBtn}
                            onPress={() => {
                                onArrived();
                                onClose();
                            }}
                            activeOpacity={0.85}
                        >
                            <LucideIcon name="check-circle" size={16} color="#FFFFFF" />
                            <Text style={styles.arrivedBtnText}>I Have Arrived at Location</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    sheetContainer: {
        backgroundColor: NAVY,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 18,
        paddingBottom: Platform.OS === 'ios' ? 36 : 24,
        maxHeight: '92%',
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    sheetTitle: {
        fontSize: 16,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    sheetSub: {
        fontSize: 11.5,
        color: TEXT_MUTED,
        marginTop: 2,
    },
    closeBtn: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    telemetryBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: NAVY_CARD,
        borderRadius: 14,
        padding: 12,
        marginVertical: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    telemetryBox: {
        flex: 1,
        alignItems: 'center',
    },
    telemetryDivider: {
        width: 1,
        height: 24,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    telemetryLabel: {
        fontSize: 9,
        fontWeight: '800',
        color: TEXT_MUTED,
        letterSpacing: 0.5,
    },
    telemetryVal: {
        fontSize: 14,
        fontWeight: '900',
        marginTop: 2,
    },
    mapCanvasWrapper: {
        height: 240,
        backgroundColor: '#0F172A',
        borderRadius: 14,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        marginBottom: 12,
    },
    mobileMapFallback: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: NAVY_CARD,
        padding: 20,
    },
    mobileMapFallbackText: {
        fontSize: 14,
        fontWeight: '900',
        color: '#FFFFFF',
        marginTop: 8,
    },
    mobileMapFallbackSub: {
        fontSize: 12,
        color: TEXT_MUTED,
        marginTop: 2,
    },
    destinationStrip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: NAVY_CARD,
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    destStripLabel: {
        fontSize: 9,
        fontWeight: '900',
        color: GOLD,
        letterSpacing: 0.5,
    },
    destStripAddress: {
        fontSize: 12.5,
        fontWeight: '700',
        color: '#FFFFFF',
        marginTop: 2,
    },
    actionBar: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 8,
    },
    callMiniBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: '#FFFFFF',
        paddingVertical: 11,
        borderRadius: 10,
    },
    callMiniBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#0F172A',
    },
    whatsappMiniBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: '#25D366',
        paddingVertical: 11,
        borderRadius: 10,
    },
    whatsappMiniBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#FFFFFF',
    },
    googleMapsBtn: {
        flex: 1.4,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
        backgroundColor: GOLD,
        paddingVertical: 11,
        borderRadius: 10,
    },
    googleMapsBtnText: {
        fontSize: 12,
        fontWeight: '900',
        color: '#070D1B',
    },
    arrivedBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: SUCCESS,
        paddingVertical: 13,
        borderRadius: 12,
        marginTop: 4,
    },
    arrivedBtnText: {
        fontSize: 13,
        fontWeight: '900',
        color: '#FFFFFF',
    },
});
