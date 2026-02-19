import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, SafeAreaView, Image, Platform, Alert, Share } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { styles } from '../styles/theme';

export const InvoicePage = ({ route, navigation }) => {
    const { order } = route.params || {};

    if (!order) {
        return (
            <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
                <Text>Order not found</Text>
            </SafeAreaView>
        );
    }

    // Robust parsing for shipping_address
    let shipping = order.shipping_address;
    try {
        if (typeof shipping === 'string') {
            shipping = JSON.parse(shipping);
        }
    } catch (e) {
        console.log('Error parsing shipping:', e);
        shipping = {};
    }

    const formatDate = (dateString) => {
        return new Date(dateString).toLocaleDateString('en-GB', {
            day: 'numeric', month: 'long', year: 'numeric'
        });
    };

    const generatePdf = async () => {
        const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                *, *::before, *::after { box-sizing: border-box; }
                body { 
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                    margin: 0; 
                    padding: 10px; 
                    background-color: #E2E8F0; 
                    color: #334155; 
                    -webkit-text-size-adjust: 100%; 
                }
                .container { 
                    width: 100%; 
                    max-width: 560px; 
                    margin: 0 auto;
                    background-color: #ffffff; 
                    overflow: hidden;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    border-radius: 0 0 16px 16px;
                    min-height: 600px; 
                }
                .header { 
                    position: relative;
                    padding: 40px 20px 60px; 
                    text-align: center;
                    color: #FFFFFF;
                    border-radius: 0 0 16px 16px; 
                    overflow: hidden;
                    border-bottom: 3px solid #FCD34D;
                    box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                    background-color: #0F172A;
                    background-image: 
                        radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 25%),
                        linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(2, 6, 23, 0.8) 100%),
                        linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
                }
                .header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 4px;
                    background: #FCD34D;
                    z-index: 5;
                }
                .logo-box { 
                    width: 80px; 
                    height: 80px; 
                    background: white; 
                    border-radius: 50%;
                    margin: 0 auto 16px;
                    display: flex; 
                    align-items: center; 
                    justify-content: center; 
                    overflow: hidden; 
                    box-shadow: 0 10px 25px rgba(0,0,0,0.2), 0 0 0 4px rgba(252, 211, 77, 0.3);
                    border: 3px solid #FCD34D;
                    position: relative;
                    z-index: 10;
                }
                .logo-text { color: #0F172A; font-size: 24px; font-weight: 900; }
                .company-name { font-size: 20px; font-weight: 900; margin: 0; letter-spacing: 0.5px; text-transform: uppercase; text-shadow: 0 2px 4px rgba(0,0,0,0.3); }
                .tagline { color: #FCD34D; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 2px; margin-top: 4px; opacity: 0.9; }
                .invoice-badge {
                    position: absolute;
                    top: 20px;
                    right: 20px;
                    background: rgba(255,255,255,0.1);
                    padding: 4px 10px;
                    border-radius: 12px;
                    border: 1px solid rgba(255,255,255,0.1);
                }
                .invoice-number { font-family: monospace; font-size: 12px; font-weight: 700; color: #F8FAFC; }
                .content { padding: 24px 20px 10px; }
                .row { display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px dashed #E2E8F0; padding-bottom: 16px; }
                .col { flex: 1; }
                .col-right { text-align: right; }
                .label { font-size: 9px; text-transform: uppercase; color: #94A3B8; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px; }
                .value { font-size: 13px; color: #0F172A; font-weight: 600; line-height: 1.3; }
                .table-container { 
                    margin: 0 -20px; 
                    padding: 0 20px; 
                    background: #F8FAFC; 
                    border-top: 1px solid #E2E8F0; 
                    border-bottom: 1px solid #E2E8F0; 
                }
                .item-row { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #E2E8F0; }
                .item-row:last-child { border-bottom: none; }
                .item-desc { flex: 2; font-size: 12px; font-weight: 600; color: #334155; }
                .item-qty { font-size: 10px; color: #64748B; margin-top: 2px; }
                .item-price { flex: 1; text-align: right; font-family: monospace; font-size: 12px; font-weight: 700; color: #0F172A; }
                .totals { margin-top: 16px; }
                .total-row { display: flex; justify-content: space-between; margin-bottom: 6px; font-size: 12px; color: #64748B; font-weight: 500; }
                .total-row.grand { 
                    color: #0F172A; 
                    font-weight: 900; 
                    font-size: 18px; 
                    margin-top: 12px; 
                    border-top: 2px dashed #0F172A; 
                    padding-top: 12px; 
                    align-items: center; 
                }
                .auth-grid {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-end;
                    margin-top: 40px;
                    padding-top: 20px;
                    border-top: 1px solid #E2E8F0;
                }
                .auth-item {
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    width: 30%;
                }
                .qr-img { width: 70px; height: 70px; }
                .label-sm { font-size: 8px; color: #94A3B8; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }
                .footer-details { margin-top: 20px; }
                .footer-info { font-size: 9px; color: #64748B; line-height: 1.4; text-align: center; margin-top: 16px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <div class="invoice-badge">
                        <span class="invoice-number">#${order.id.slice(0, 8).toUpperCase()}</span>
                    </div>
                    <div class="logo-box">
                        <span class="logo-text">A</span>
                    </div>
                    <h1 class="company-name">ABU MAFHAL LTD</h1>
                    <div class="tagline">Official Invoice</div>
                </div>

                <div class="content">
                    <div class="row">
                        <div class="col">
                            <div class="label">Billed To</div>
                            <div class="value">${shipping?.fullName || shipping?.name || 'Customer'}</div>
                            <div class="value" style="color: #64748B; font-size: 11px;">${shipping?.phone || ''}</div>
                            <div class="value" style="color: #64748B; font-size: 11px;">
                                ${shipping?.city || ''}, ${shipping?.state || ''}
                            </div>
                            <div class="value" style="color: #64748B; font-size: 11px;">
                                ${shipping?.address || shipping?.street || ''}
                            </div>
                        </div>
                        <div class="col col-right">
                            <div class="label">Total Due</div>
                            <div class="value" style="color: #0F172A; font-size: 18px;">₦${(order.total_amount || 0).toLocaleString()}</div>
                            <div style="font-size: 10px; color: #10B981; font-weight: 800; text-transform: uppercase; margin-top: 4px;">• ${order.status} •</div>
                        </div>
                    </div>
                </div>

                <div class="table-container">
                    <div style="padding: 10px 0;">
                    <div style="padding: 0 24px; margin-bottom: 8px; font-size: 10px; text-transform: uppercase; color: #94A3B8; font-weight: 800; letter-spacing: 1px;">Item Details</div>
                    ${(order.order_items || []).map(item => `
                        <div class="item-row" style="padding: 10px 20px; align-items: center;">
                            <div style="flex: 2;">
                                <div class="item-desc" style="font-size: 13px; font-weight: 700;">${item.products?.name || item.name || 'Item'}</div>
                                <div class="item-qty" style="font-size: 11px;">${item.quantity} x ₦${(item.price || 0).toLocaleString()}</div>
                            </div>
                            <div class="item-price" style="font-size: 13px;">₦${((item.price || 0) * item.quantity).toLocaleString()}</div>
                        </div>
                    `).join('')}
                    </div>
                </div>

                <div class="content">
                    <div class="totals">
                        <div class="total-row">
                            <span>Subtotal</span>
                            <span>₦${(order.total_amount || 0).toLocaleString()}</span>
                        </div>
                        <div class="total-row grand">
                            <span>Total Paid</span>
                            <span>₦${(order.total_amount || 0).toLocaleString()}</span>
                        </div>
                    </div>

                    <div class="auth-grid">
                        <div class="auth-item">
                            <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://abumafhal.com/verify/${order.id}" class="qr-img" />
                            <span class="label-sm" style="margin-top: 4px;">Scan to Verify</span>
                        </div>
                        <div class="auth-item"></div>
                        <div class="auth-item"></div>
                    </div>

                    <div class="footer-details">
                        <div class="footer-info">
                            <strong>ABU MAFHAL LTD</strong><br>
                            Gashua, Yobe State • +234 814 585 3539
                            <div style="margin-top: 8px; font-style: italic; color: #94A3B8; font-family:serif; font-size: 9px;">"Thank you for your business!"</div>
                        </div>
                    </div>
                </div>
            </div>
        </body>
        </html>
        `;

        try {
            const { uri } = await Print.printToFileAsync({ html: htmlContent });
            await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
        } catch (error) {
            Alert.alert("Error", "Could not generate invoice PDF");
            console.error(error);
        }
    };

    return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#F8FAFC' }}>
            {/* Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', padding: 20, backgroundColor: 'white', borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={{ padding: 8, marginRight: 8 }}>
                    <Ionicons name="arrow-back" size={24} color="#0F172A" />
                </TouchableOpacity>
                <Text style={{ fontSize: 20, fontWeight: '900', color: '#0F172A' }}>Invoice #{order.id.slice(0, 8).toUpperCase()}</Text>
            </View>

            <ScrollView contentContainerStyle={{ padding: 20 }}>
                {/* Invoice Preview Card */}
                <View style={{ backgroundColor: 'white', borderRadius: 24, padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 12, elevation: 4 }}>

                    {/* Brand Header */}
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32, paddingBottom: 24, borderBottomWidth: 1, borderColor: '#F1F5F9' }}>
                        <View>
                            <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A', letterSpacing: -1 }}>ABU MAFHAL</Text>
                            <Text style={{ fontSize: 13, color: '#64748B', marginTop: 4 }}>MARKETPLACE</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 12, fontWeight: '700', color: '#94A3B8' }}>ISSUED DATE</Text>
                            <Text style={{ fontSize: 15, fontWeight: '600', color: '#0F172A', marginTop: 4 }}>{formatDate(order.created_at)}</Text>
                        </View>
                    </View>

                    {/* Customer Details */}
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 12, letterSpacing: 0.5 }}>BILLED TO</Text>
                        <Text style={{ fontSize: 18, fontWeight: '700', color: '#0F172A', marginBottom: 4 }}>{shipping?.fullName || shipping?.name || 'Customer'}</Text>
                        <Text style={{ fontSize: 15, color: '#64748B', lineHeight: 22 }}>
                            {shipping?.address || shipping?.street}{'\n'}
                            {shipping?.city}, {shipping?.state}
                        </Text>
                    </View>

                    {/* Items List */}
                    <View style={{ marginBottom: 32 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#94A3B8', marginBottom: 16, letterSpacing: 0.5 }}>ORDER SUMMARY</Text>
                        {order.order_items?.map((item, index) => (
                            <View key={index} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 }}>
                                <View style={{ flex: 1, marginRight: 16 }}>
                                    <Text style={{ fontSize: 15, fontWeight: '600', color: '#0F172A' }}>{item.products?.name || item.name}</Text>
                                    <Text style={{ fontSize: 13, color: '#64748B', marginTop: 2 }}>Qty: {item.quantity} × ₦{item.price?.toLocaleString()}</Text>
                                </View>
                                <Text style={{ fontSize: 15, fontWeight: '700', color: '#0F172A' }}>
                                    ₦{((item.price || 0) * item.quantity).toLocaleString()}
                                </Text>
                            </View>
                        ))}
                    </View>

                    {/* Total */}
                    <View style={{ backgroundColor: '#F8FAFC', padding: 20, borderRadius: 16, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 16, fontWeight: '600', color: '#0F172A' }}>Grand Total</Text>
                        <Text style={{ fontSize: 24, fontWeight: '900', color: '#0F172A' }}>₦{order.total_amount?.toLocaleString()}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Footer Actions */}
            <View style={{ padding: 20, backgroundColor: 'white', borderTopWidth: 1, borderColor: '#F1F5F9' }}>
                <TouchableOpacity
                    onPress={generatePdf}
                    style={{ backgroundColor: '#0F172A', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 18, borderRadius: 16, shadowColor: "#0F172A", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 16 }}
                >
                    <Ionicons name="download-outline" size={24} color="white" style={{ marginRight: 12 }} />
                    <Text style={{ fontSize: 16, fontWeight: '800', color: 'white' }}>Download PDF Invoice</Text>
                </TouchableOpacity>
            </View>
        </SafeAreaView>
    );
};
