import React from 'react';
import { View, Platform } from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';

// ─── PURE MODERN LUCIDE SVG PATHS (FOR WEB & PIXEL-PERFECT STROKE VISUALS) ───
const SVG_ICONS = {
  package: (
    <>
      <path d="M16.5 9.4 7.55 4.24a1.78 1.78 0 0 0-2.5 1.55v12.42a1.78 1.78 0 0 0 .89 1.55l8.95 5.16a1.78 1.78 0 0 0 2.5-1.55V10.95a1.78 1.78 0 0 0-.89-1.55z" />
      <polyline points="3.29 7 12 12 20.71 7" />
      <line x1="12" y1="22" x2="12" y2="12" />
    </>
  ),
  truck: (
    <>
      <path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2" />
      <path d="M15 18H9" />
      <path d="M19 18h2a1 1 0 0 0 1-1v-5.2a2 2 0 0 0-.58-1.42L18.42 7.4A2 2 0 0 0 17 6.8H14" />
      <circle cx="7" cy="18" r="2" />
      <circle cx="17" cy="18" r="2" />
    </>
  ),
  'map-pin': (
    <>
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </>
  ),
  navigation: <polygon points="3 11 22 2 13 21 11 13 3 11" />,
  wallet: (
    <>
      <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
      <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
    </>
  ),
  phone: (
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  ),
  'message-square': (
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  ),
  'alert-triangle': (
    <>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  'check-circle': (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10" />,
  star: (
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  ),
  'trending-up': (
    <>
      <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
      <polyline points="17 6 23 6 23 12" />
    </>
  ),
  'refresh-cw': (
    <>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
      <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
      <path d="M8 16H3v5" />
    </>
  ),
  power: (
    <>
      <path d="M12 2v10" />
      <path d="M18.36 6.64a9 9 0 1 1-12.73 0" />
    </>
  ),
  award: (
    <>
      <circle cx="12" cy="8" r="6" />
      <path d="M15.477 12.89 17 22l-5-3-5 3 1.523-9.11" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="10" />
      <polyline points="12 6 12 12 16 14" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </>
  ),
  x: (
    <>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </>
  ),
  menu: (
    <>
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="3" y1="6" x2="21" y2="6" />
      <line x1="3" y1="18" x2="21" y2="18" />
    </>
  ),
  'chevron-right': <polyline points="9 18 15 12 9 6" />,
  'chevron-down': <polyline points="6 9 12 15 18 9" />,
  user: (
    <>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  'dollar-sign': (
    <>
      <line x1="12" y1="2" x2="12" y2="22" />
      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
    </>
  ),
  zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  camera: (
    <>
      <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z" />
      <circle cx="12" cy="13" r="3" />
    </>
  ),
  'file-text': (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </>
  ),
  'arrow-up-right': (
    <>
      <line x1="7" y1="17" x2="17" y2="7" />
      <polyline points="7 7 17 7 17 17" />
    </>
  ),
  radio: (
    <>
      <circle cx="12" cy="12" r="2" />
      <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14" />
    </>
  ),
  edit: (
    <>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </>
  ),
  sparkles: (
    <>
      <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3Z" />
    </>
  ),
  'bar-chart': (
    <>
      <line x1="12" y1="20" x2="12" y2="10" />
      <line x1="18" y1="20" x2="18" y2="4" />
      <line x1="6" y1="20" x2="6" y2="16" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="5.5" />
      <path d="m21 2-9.6 9.6" />
      <path d="m15.5 7.5 3 3L22 7l-3-3" />
    </>
  ),
  'credit-card': (
    <>
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <line x1="2" x2="22" y1="10" y2="10" />
    </>
  )
};

// ─── COMPREHENSIVE NAME ALIAS NORMALIZER ───
const ALIAS_MAP = {
  // Package / Items
  'cube-outline': 'package',
  'cube': 'package',
  'box': 'package',
  'package': 'package',

  // Vehicles / Transport
  'bicycle-outline': 'truck',
  'bicycle': 'truck',
  'car-sport-outline': 'truck',
  'car': 'truck',
  'truck': 'truck',

  // Location / Navigation
  'location-outline': 'map-pin',
  'location': 'map-pin',
  'map-pin': 'map-pin',
  'navigate': 'navigation',
  'navigation': 'navigation',

  // Key / Security Handover
  'key': 'key',
  'key-outline': 'key',
  'lock': 'key',

  // Money / Wallet / Cards
  'wallet-outline': 'wallet',
  'wallet': 'wallet',
  'cash-outline': 'dollar-sign',
  'cash': 'dollar-sign',
  'card-outline': 'credit-card',
  'card': 'credit-card',
  'credit-card': 'credit-card',
  'arrow-up-circle-outline': 'arrow-up-right',

  // Contact / Social
  'call': 'phone',
  'call-outline': 'phone',
  'phone': 'phone',
  'logo-whatsapp': 'message-square',
  'chatbubble-ellipses': 'message-square',
  'chatbubbles-outline': 'message-square',
  'message-square': 'message-square',

  // Alerts & Confirmations
  'alert-circle': 'alert-triangle',
  'warning': 'alert-triangle',
  'alert-triangle': 'alert-triangle',
  'checkmark-circle': 'check-circle',
  'checkmark-done': 'check-circle',
  'checkmark-done-circle': 'check-circle',
  'checkmark': 'check-circle',
  'check': 'check-circle',
  'shield-checkmark': 'shield',
  'shield': 'shield',

  // Actions & Controls
  'menu': 'menu',
  'menu-outline': 'menu',
  'bars': 'menu',
  'reload': 'refresh-cw',
  'refresh': 'refresh-cw',
  'power': 'power',
  'search': 'search',
  'close': 'x',
  'x': 'x',
  'chevron-down': 'chevron-down',
  'chevron-forward': 'chevron-right',
  'chevron-right': 'chevron-right',

  // Time & Stats
  'time-outline': 'clock',
  'time': 'clock',
  'clock': 'clock',
  'stopwatch': 'clock',
  'trending-up': 'trending-up',
  'star': 'star',
  'trophy': 'award',
  'award': 'award',
  'flash': 'zap',
  'flash-outline': 'zap',
  'sparkles': 'sparkles',
  'sparkles-outline': 'sparkles',
  'stats-chart': 'bar-chart',
  'bar-chart': 'bar-chart',

  // Media & Documents
  'camera': 'camera',
  'document-text-outline': 'file-text',
  'list': 'file-text',
  'create-outline': 'edit',
  'barcode-outline': 'file-text',
  'radio': 'radio',
  'person': 'user',
  'person-outline': 'user',
  'user': 'user'
};

export const LucideIcon = ({ name, size = 18, color = '#FFFFFF', strokeWidth = 2, style }) => {
  const normalizedKey = ALIAS_MAP[name] || name;

  // On Web: Render pure SVG for guaranteed zero-dependency, ultra-crisp Lucide rendering
  if (Platform.OS === 'web' && SVG_ICONS[normalizedKey]) {
    return (
      <View style={[{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }, style]}>
        <svg
          width={size}
          height={size}
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ display: 'block', verticalAlign: 'middle' }}
        >
          {SVG_ICONS[normalizedKey]}
        </svg>
      </View>
    );
  }

  // On Mobile Native: Clean Feather / Ionicons fallback
  const featherName = (function () {
    switch (normalizedKey) {
      case 'package': return 'package';
      case 'truck': return 'truck';
      case 'map-pin': return 'map-pin';
      case 'navigation': return 'navigation';
      case 'wallet': return 'credit-card';
      case 'phone': return 'phone';
      case 'message-square': return 'message-square';
      case 'alert-triangle': return 'alert-triangle';
      case 'check-circle': return 'check-circle';
      case 'shield': return 'shield';
      case 'star': return 'star';
      case 'trending-up': return 'trending-up';
      case 'refresh-cw': return 'refresh-cw';
      case 'power': return 'power';
      case 'award': return 'award';
      case 'clock': return 'clock';
      case 'search': return 'search';
      case 'x': return 'x';
      case 'chevron-right': return 'chevron-right';
      case 'chevron-down': return 'chevron-down';
      case 'user': return 'user';
      case 'dollar-sign': return 'dollar-sign';
      case 'zap': return 'zap';
      case 'camera': return 'camera';
      case 'file-text': return 'file-text';
      case 'arrow-up-right': return 'arrow-up-right';
      case 'radio': return 'radio';
      case 'edit': return 'edit';
      case 'bar-chart': return 'bar-chart-2';
      case 'menu': return 'menu';
      default: return null;
    }
  })();

  if (featherName) {
    return <Feather name={featherName} size={size} color={color} style={style} />;
  }

  return <Ionicons name={name} size={size} color={color} style={style} />;
};

export default LucideIcon;
