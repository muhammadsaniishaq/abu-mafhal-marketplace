import { StyleSheet, Dimensions, Platform } from 'react-native';

const { width } = Dimensions.get('window');
export const COLUMN_WIDTH = (width - 48) / 2;
export const WIDTH = width;

export const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#F8FAFC' },
    safeArea: { backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? 60 : 20 },
    safeAreaWhite: { backgroundColor: 'white', paddingTop: Platform.OS === 'android' ? 60 : 20 },

    // TOP HEADER - Fixed for "Sun Buya"
    topHeader: { backgroundColor: 'white', paddingBottom: 10 },
    headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, height: 60 },
    logoContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    logoImage: { width: 40, height: 40 },
    brandTitle: { fontSize: 16, fontWeight: '900', color: '#0F172A', lineHeight: 18 },
    brandSub: { fontSize: 10, color: '#64748B', lineHeight: 10 },
    headerIcons: { flexDirection: 'row', gap: 16 },
    redDot: { width: 8, height: 8, backgroundColor: '#EF4444', borderRadius: 4, position: 'absolute', top: -2, right: -2, borderWidth: 1, borderColor: 'white' },

    // HERO
    sliderOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', padding: 24, justifyContent: 'flex-end', alignItems: 'flex-start' },
    sliderSub: { color: 'white', fontWeight: '600', fontSize: 12, marginBottom: 4, backgroundColor: 'rgba(0,0,0,0.5)', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
    sliderTitle: { color: 'white', fontWeight: '800', fontSize: 32, marginBottom: 16 },
    shopNowBtn: { backgroundColor: 'white', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 4 },
    shopNowText: { color: 'black', fontWeight: '700', fontSize: 12, textTransform: 'uppercase' },

    // SERVICES / FEATURES
    servicesRow: { flexDirection: 'row', backgroundColor: 'white', paddingVertical: 12, paddingHorizontal: 16, justifyContent: 'space-between', marginBottom: 0 },
    serviceItem: { alignItems: 'center', width: '22%' },
    serviceIconBox: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
    serviceText: { fontSize: 10, fontWeight: '600', color: '#334155', textAlign: 'center' },

    // SECTIONS
    sectionContainer: { backgroundColor: 'white', marginTop: 12, paddingVertical: 16 },
    sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 12, alignItems: 'center' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A' },
    sectionLink: { fontSize: 12, fontWeight: '600', color: '#64748B' },

    // DAILY DEALS
    dealCard: { width: 140, marginRight: 12, borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 8, padding: 8 },
    dealImg: { width: '100%', height: 100, borderRadius: 4, backgroundColor: '#F8FAFC', marginBottom: 8 },
    dealName: { fontSize: 12, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
    dealPrice: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    dealOld: { fontSize: 10, color: '#94A3B8', textDecorationLine: 'line-through' },

    // FLASH
    flashSection: { backgroundColor: 'white', paddingVertical: 16, marginTop: 12 },
    flashHeader: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12, justifyContent: 'space-between' },
    flashTitle: { fontSize: 16, fontWeight: '800', color: '#EF4444' },
    timerBadge: { backgroundColor: '#0F172A', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4, marginLeft: 8 },
    timerText: { color: 'white', fontSize: 10, fontWeight: '700' },
    seeAllRed: { color: '#EF4444', fontWeight: '700', fontSize: 12 },
    flashGrid: { flexDirection: 'row', paddingHorizontal: 16, justifyContent: 'space-between' },
    flashGridItem: { width: '31%' },
    flashGridImg: { width: '100%', height: 100, borderRadius: 4, backgroundColor: '#F1F5F9', marginBottom: 8 },
    discountBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: '#EF4444', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2 },
    discountText: { color: 'white', fontSize: 8, fontWeight: '700' },
    flashGridPrice: { fontSize: 13, fontWeight: '700', color: '#0F172A' },

    // RECOMMENDED
    graySection: { marginTop: 12, backgroundColor: 'white', paddingVertical: 16 },
    grid2Col: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
    recCard: { width: '48%', marginBottom: 16, borderWidth: 1, borderColor: '#F1F5F9', borderRadius: 8, padding: 8 },
    recImg: { width: '100%', height: 120, borderRadius: 4, backgroundColor: '#F8FAFC', marginBottom: 8 },
    recName: { fontSize: 12, color: '#334155', marginBottom: 4, height: 16 },
    recPrice: { fontSize: 14, fontWeight: '700', color: '#0F172A' },

    // BRANDS
    brandCard: { marginRight: 12, width: 80, alignItems: 'center', backgroundColor: 'white', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#F1F5F9' },
    brandLogo: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
    brandText: { fontSize: 10, fontWeight: '600' },

    // MODERN FOOTER
    modernFooter: { backgroundColor: '#0F172A', marginTop: 24, padding: 24, paddingBottom: 40 },
    footerBrandSection: { borderBottomWidth: 1, borderBottomColor: '#1E293B', paddingBottom: 24, marginBottom: 24 },
    footerBrandTitle: { color: 'white', fontSize: 18, fontWeight: '900', letterSpacing: 1 },
    footerBrandSub: { color: '#94A3B8', fontSize: 11, letterSpacing: 2 },
    footerDesc: { color: '#94A3B8', fontSize: 13, lineHeight: 20, marginBottom: 20 },
    socialRow: { flexDirection: 'row', gap: 12 },
    socialBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#1E293B', alignItems: 'center', justifyContent: 'center' },

    footerLinksGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', marginBottom: 24 },
    footerLinkCol: { width: '48%', marginBottom: 24 },
    footerLinkHeader: { color: 'white', fontWeight: '700', fontSize: 14, marginBottom: 16 },
    footerLinkItem: { color: '#94A3B8', fontSize: 13, marginBottom: 12 },

    footerContact: { marginBottom: 32 },
    contactRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
    contactText: { color: '#CBD5E1', fontSize: 13, marginLeft: 12 },

    footerBottom: { alignItems: 'center', borderTopWidth: 1, borderTopColor: '#1E293B', paddingTop: 24 },
    paymentBadge: { backgroundColor: 'white', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 4 },
    secureRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
    copyright: { color: '#475569', fontSize: 11 },

    // SHOP
    shopHeader: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F1F5F9' },
    shopSearch: { flex: 1, flexDirection: 'row', backgroundColor: '#F1F5F9', borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, marginHorizontal: 12, alignItems: 'center' },
    shopCard: { width: COLUMN_WIDTH, backgroundColor: 'white', marginBottom: 16, borderRadius: 8, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6' },
    shopImgBox: { height: 160, backgroundColor: '#F8FAFC' },
    shopDetails: { padding: 8 },
    shopTitle: { fontSize: 12, color: '#334155', height: 32, lineHeight: 16 },
    shopPrice: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginTop: 4 },
    addCartBtn: { position: 'absolute', bottom: 8, right: 8, backgroundColor: '#EF4444', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },

    // NEW STYLES
    catSection: { marginTop: 0, marginBottom: 20 },
    catItem: { alignItems: 'center', marginRight: 16 },
    catIconBox: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
    catName: { fontSize: 12, fontWeight: '600', color: '#334155' },

    promoSection: { marginHorizontal: 16, marginBottom: 20, height: 140, borderRadius: 12, overflow: 'hidden' },
    promoImg: { width: '100%', height: '100%' },

    newArrivalCard: { width: 140, height: 180, marginRight: 12, borderRadius: 8, overflow: 'hidden' },
    newArrivalImg: { width: '100%', height: '100%' },
    newArrivalOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(0,0,0,0.6)', padding: 8 },
    newArrivalPrice: { color: 'white', fontWeight: '700', fontSize: 14 },

    // CART
    cartItem: { flexDirection: 'row', padding: 16, backgroundColor: 'white', borderRadius: 12, marginBottom: 12, alignItems: 'center' },
    cartImg: { width: 60, height: 60, borderRadius: 8, backgroundColor: '#F1F5F9' },
    cartName: { fontSize: 14, fontWeight: '600', color: '#1E293B', marginBottom: 4 },
    cartPrice: { fontSize: 14, fontWeight: '700', color: '#0F172A', marginBottom: 8 },
    qtyRow: { flexDirection: 'row', alignItems: 'center' },
    qtyBtn: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center' },
    qtyText: { marginHorizontal: 12, fontWeight: '600' },

    checkoutBar: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: 'white', padding: 20, paddingBottom: 30, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#F1F5F9' },
    checkoutBtn: { backgroundColor: '#0F172A', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center' },

    // COLLECTIONS (ROUND 2)
    collectionsGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 16, justifyContent: 'space-between' },
    collectionCard: { width: '48%', height: 160, marginBottom: 16, borderRadius: 12, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    collectionImg: { width: '100%', height: '100%', position: 'absolute' },
    collectionOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
    collectionTitle: { color: 'white', fontWeight: '800', fontSize: 18, zIndex: 10, letterSpacing: 1 },

    // TRUST STRIP (ROUND 2)
    trustStrip: { flexDirection: 'row', backgroundColor: 'white', padding: 24, marginTop: 12, justifyContent: 'space-around', alignItems: 'flex-start' },
    trustItem: { alignItems: 'center', width: '30%' },
    trustText: { fontSize: 11, fontWeight: '600', color: '#1E293B', textAlign: 'center', lineHeight: 14 },

    // AUTH
    authContainer: { flex: 1, backgroundColor: '#F8FAFC' },
    circle1: { position: 'absolute', top: -100, left: -60, width: 300, height: 300, borderRadius: 150, backgroundColor: '#DBEAFE', opacity: 0.6 },
    circle2: { position: 'absolute', bottom: -50, right: -60, width: 250, height: 250, borderRadius: 125, backgroundColor: '#F3E8FF', opacity: 0.6 },
    circle3: { position: 'absolute', top: '40%', right: -40, width: 100, height: 100, borderRadius: 50, backgroundColor: '#FEF3C7', opacity: 0.5 },
    circle4: { position: 'absolute', bottom: '20%', left: -30, width: 80, height: 80, borderRadius: 40, backgroundColor: '#FECACA', opacity: 0.5 },
    decorationStrip: { position: 'absolute', top: 100, left: -40, width: 120, height: 12, backgroundColor: '#F1F5F9', transform: [{ rotate: '-45deg' }] },
    decorationSquare: { position: 'absolute', top: '15%', right: 40, width: 40, height: 40, backgroundColor: '#C7D2FE', borderRadius: 8, opacity: 0.4, transform: [{ rotate: '30deg' }] },

    authScroll: { flex: 1, padding: 24, justifyContent: 'center' },
    authHeader: { marginBottom: 32 },
    authLogo: { width: 64, height: 64, borderRadius: 16, marginBottom: 16 },
    authBigTitle: { fontSize: 36, fontWeight: '900', color: '#1E293B', lineHeight: 40 },

    authCard: { backgroundColor: 'white', borderRadius: 24, padding: 24, boxShadow: '0px 10px 20px rgba(0,0,0,0.05)', elevation: 5 },
    modernInput: { backgroundColor: '#F1F5F9', borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 14, color: '#0F172A', fontWeight: '600' },
    modernBtn: { backgroundColor: '#0F172A', borderRadius: 12, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 16, boxShadow: '0px 4px 8px rgba(15,23,42,0.3)', elevation: 4 },
    modernBtnText: { color: 'white', fontWeight: '700', fontSize: 16, marginRight: 8 },

    forgotPass: { color: '#64748B', fontSize: 12, fontWeight: '600', textAlign: 'right', marginTop: 4 },
    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 24 },
    line: { flex: 1, height: 1, backgroundColor: '#E2E8F0' },
    orText: { marginHorizontal: 12, color: '#94A3B8', fontSize: 12, fontWeight: '600' },

    socialRowAuth: { flexDirection: 'row', justifyContent: 'center', gap: 20, marginBottom: 24 },
    socialCircle: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E2E8F0', boxShadow: '0px 0px 4px rgba(0,0,0,0.05)', elevation: 2 },

    switchRow: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
    switchText: { color: '#64748B', fontSize: 13 },
    switchLink: { color: '#0F172A', fontWeight: '800', marginLeft: 4, fontSize: 13 },

    // PROFILE
    profileHeader: { backgroundColor: '#0F172A', paddingTop: 80, paddingBottom: 80, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
    profileNav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 10 },
    profileNavTitle: { color: 'white', fontSize: 18, fontWeight: '700' },
    profileInfo: { alignItems: 'center', marginTop: 20 },
    avatarBox: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center', marginBottom: 12, borderWidth: 4, borderColor: 'rgba(255,255,255,0.1)', overflow: 'hidden' },
    avatarText: { color: 'white', fontSize: 32, fontWeight: '700' },
    editBadge: { position: 'absolute', bottom: 0, right: 0, backgroundColor: '#3B82F6', width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#0F172A' },
    profileName: { color: 'white', fontSize: 20, fontWeight: '800' },
    profileEmail: { color: '#94A3B8', fontSize: 14 },

    profileBody: { paddingHorizontal: 20, marginTop: -35 },
    statsRow: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 16, padding: 16, boxShadow: '0px 4px 10px rgba(0,0,0,0.05)', elevation: 4, justifyContent: 'space-around', alignItems: 'center' },
    statItem: { alignItems: 'center' },
    statNum: { fontSize: 18, fontWeight: '800', color: '#0F172A' },
    statLabel: { fontSize: 12, color: '#64748B' },
    statLine: { width: 1, height: 24, backgroundColor: '#E2E8F0' },

    menuItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', padding: 16, borderRadius: 12, marginBottom: 12 },
    menuIconBox: { width: 36, height: 36, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 16 },
    menuLabel: { flex: 1, fontSize: 14, fontWeight: '600', color: '#1E293B' },
    menuBadge: { backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
    menuBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },

    avatarHead: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center' },
    avatarHeadText: { color: 'white', fontSize: 12, fontWeight: '800' },

    // BOTTOM NAV
    bottomNav: { flexDirection: 'row', backgroundColor: 'white', borderTopWidth: 1, borderTopColor: '#F1F5F9', paddingBottom: Platform.OS === 'ios' ? 24 : 12, paddingTop: 12, height: 85, alignItems: 'flex-start' },
    tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4, height: 50 },
    tabLabel: { fontSize: 10, fontWeight: '600' },
    tabBadge: { position: 'absolute', top: -4, right: -6, backgroundColor: '#EF4444', paddingHorizontal: 4, borderRadius: 4 },
    tabBadgeText: { color: 'white', fontSize: 8, fontWeight: '700' },

    // FLOATING CENTER TAB
    centerTabWrapper: { flex: 1, alignItems: 'center', justifyContent: 'center', top: -25 },
    centerTabBtn: { width: 64, height: 64, borderRadius: 32, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', boxShadow: '0px 8px 12px rgba(15,23,42,0.5)', elevation: 10, borderWidth: 4, borderColor: 'white' },
    centerTabBtnActive: { backgroundColor: '#0F172A' },

    // SHOP FILTERS & ENHANCEMENTS
    filterSection: { paddingHorizontal: 16, paddingBottom: 12, backgroundColor: 'white' },
    filterChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, backgroundColor: '#F1F5F9', marginRight: 8, borderWidth: 1, borderColor: '#F1F5F9' },
    filterChipActive: { backgroundColor: '#0F172A', borderColor: '#0F172A' },
    filterText: { fontSize: 13, fontWeight: '600', color: '#64748B' },
    filterTextActive: { color: 'white' },

    cardBadge: { position: 'absolute', top: 8, left: 8, backgroundColor: '#EF4444', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, zIndex: 10 },
    cardBadgeText: { color: 'white', fontSize: 10, fontWeight: '700' },
    cardLikeBtn: { position: 'absolute', top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: 'white', alignItems: 'center', justifyContent: 'center', zIndex: 10, boxShadow: '0px 0px 4px rgba(0,0,0,0.1)', elevation: 2 },
    ratingRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 2 },
    ratingCount: { fontSize: 10, color: '#94A3B8', marginLeft: 4 },

    emptyStateContainer: { alignItems: 'center', justifyContent: 'center', padding: 40, marginTop: 40 },
    emptyStateText: { color: '#64748B', fontSize: 16, marginTop: 16, fontWeight: '600' },
    emptyStateSub: { color: '#94A3B8', fontSize: 13, textAlign: 'center', marginTop: 8 },

    // SHOP PROMO
    shopBanner: { marginHorizontal: 16, marginTop: 16, marginBottom: 8, height: 140, borderRadius: 12, overflow: 'hidden' },
    shopBannerOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', padding: 20, justifyContent: 'center' },
    shopBannerTitle: { color: 'white', fontSize: 24, fontWeight: '900', marginBottom: 4 },
    shopBannerSub: { color: '#F8FAFC', fontSize: 14, fontWeight: '600' },

    // PRODUCT MODAL
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
    modalContent: { backgroundColor: 'white', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, minHeight: 400 },
    modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 },
    modalImage: { width: '100%', height: 250, borderRadius: 16, marginBottom: 16 },
    modalTitle: { fontSize: 20, fontWeight: '700', color: '#0F172A', flex: 1, marginRight: 16 },
    modalPrice: { fontSize: 24, fontWeight: '800', color: '#3B82F6' },
    modalDesc: { fontSize: 14, color: '#64748B', lineHeight: 22, marginTop: 8, marginBottom: 24 },
    modalActions: { flexDirection: 'row', gap: 16 },
    modalBtnMain: { flex: 1, backgroundColor: '#0F172A', paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
    modalBtnGhost: { paddingVertical: 14, paddingHorizontal: 16, borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', alignItems: 'center', justifyContent: 'center' },
    modalBtnText: { color: 'white', fontWeight: '700', fontSize: 16 },

    // TOAST
    toastContainer: { position: 'absolute', top: 60, alignSelf: 'center', backgroundColor: 'rgba(15, 23, 42, 0.95)', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 30, flexDirection: 'row', alignItems: 'center', boxShadow: '0px 8px 20px rgba(0,0,0,0.2)', elevation: 10, zIndex: 100, backdropFilter: 'blur(10px)' },
    toastText: { color: 'white', fontWeight: 'bold', marginLeft: 12, fontSize: 13, letterSpacing: 0.5 },

    // PROFILE FEATURES
    walletCard: { backgroundColor: '#1E293B', marginHorizontal: 20, marginTop: 24, borderRadius: 16, padding: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', boxShadow: '0px 8px 10px rgba(15,23,42,0.2)', elevation: 5 },
    walletLabel: { color: '#94A3B8', fontSize: 12, fontWeight: '600', marginBottom: 4 },
    walletBalance: { color: 'white', fontSize: 28, fontWeight: '800' },
    walletPoints: { color: '#FBBF24', fontSize: 12, fontWeight: '700', marginTop: 4 },
    walletBtn: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },

    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#0F172A', marginLeft: 20, marginTop: 24, marginBottom: 12 },
    orderItem: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', marginHorizontal: 20, marginBottom: 12, padding: 16, borderRadius: 12, borderWidth: 1, borderColor: '#F1F5F9' },
    orderIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: '#F1F5F9', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    orderId: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    orderDate: { fontSize: 12, color: '#64748B' },
    orderStatus: { fontSize: 12, fontWeight: '600', marginLeft: 'auto' },

    // VENDOR CTA
    vendorCard: { marginHorizontal: 20, marginTop: 12, padding: 20, borderRadius: 16, backgroundColor: '#4F46E5', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', boxShadow: '0px 8px 12px rgba(79,70,229,0.3)', elevation: 6 },
    vendorTitle: { fontSize: 16, fontWeight: '800', color: 'white', marginBottom: 4 },
    vendorSub: { fontSize: 12, color: '#C7D2FE', maxWidth: 180 },
    vendorBtn: { backgroundColor: 'white', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10 },

    // REFERRAL
    referCard: { marginHorizontal: 20, marginTop: 12, paddingTop: 16, paddingBottom: 16, paddingHorizontal: 20, borderRadius: 16, borderWidth: 1, borderColor: '#F1F5F9', borderStyle: 'dashed', flexDirection: 'row', alignItems: 'center', backgroundColor: '#F8FAFC' },
    referIcon: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    referTitle: { fontSize: 14, fontWeight: '700', color: '#0F172A' },
    referSub: { fontSize: 12, color: '#64748B' },

    // INFO PAGES
    infoCard: { backgroundColor: 'white', padding: 24, borderRadius: 16, boxShadow: '0px 0px 10px rgba(0,0,0,0.05)', elevation: 2 },
    infoContent: { color: '#334155', fontSize: 15, lineHeight: 26 }
});
