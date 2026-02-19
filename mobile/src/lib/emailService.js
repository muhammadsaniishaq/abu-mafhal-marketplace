import { Alert, Platform } from 'react-native';
import * as Print from 'expo-print';
import * as FileSystem from 'expo-file-system';
import { decode } from 'base64-arraybuffer';
import { supabase } from './supabase';

const RESEND_KEY = 're_jog5a7d6_5uofEsHm57R6re2SJX5stpAR';

// Helper to generate HTML (Shared with Admin Preview)
export function generateInvoiceHTML(invoice, business = {}) {
    // Default config
    const config = {
        name: 'ABU MAFHAL LTD',
        address: 'Gashua, Yobe State',
        phone: '+234 814 585 3539',
        email: 'support@abumafhal.com',
        footer_text: 'Thank you for your patronage!',
        downloadLink: null, // Default to null, will be populated if passed
        ...business
    };

    const formatCurrency = (amount) => `₦${(amount || 0).toLocaleString()}`;
    // ... existing helpers ...
    const { name, address, phone, email: bizEmail, logo_url, stamp_url, signature_url, footer_text, downloadLink } = config;

    // Use passed downloadLink OR fallback to web preview
    const finalDownloadLink = downloadLink || `https://abumafhal.com/download/invoice/${invoice.id}`;

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            /* ... (Styles kept same) ... */
            /* Reset & Base */
            *, *::before, *::after { box-sizing: border-box; }
            body { 
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                margin: 0; 
                padding: 10px; 
                background-color: #E2E8F0; 
                color: #334155; 
                -webkit-text-size-adjust: 100%; 
            }
            
            /* A5 Container - Optimized Height */
            .container { 
                width: 100%; 
                max-width: 560px; 
                margin: 0 auto;
                background-color: #ffffff; 
                overflow: hidden;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                border-radius: 0 0 16px 16px;
                /* Min height for A5 feel, but content defines actual height */
                min-height: 600px; 
            }

            /* Header - Super Professional */
            .header { 
                position: relative;
                padding: 40px 20px 60px; 
                text-align: center;
                color: #FFFFFF;
                border-radius: 0 0 16px 16px; 
                overflow: hidden;
                border-bottom: 3px solid #FCD34D;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                
                /* Deep Executive Blue */
                background-color: #0F172A;
                
                /* Professional Gradient */
                background-image: 
                    /* Subtle Highlight at Top Left */
                    radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.08) 0%, transparent 25%),
                    
                    /* Deep Bottom Shadow for Depth */
                    linear-gradient(180deg, rgba(15, 23, 42, 0) 0%, rgba(2, 6, 23, 0.8) 100%),
                    
                    /* Base Color */
                    linear-gradient(135deg, #0F172A 0%, #1E293B 100%);
            }
            
            /* Clean Gold Accent Line at Top */
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

            /* No messy background shapes */
            .header::after { display: none; }

            .logo-box { 
                width: 80px; 
                height: 80px; 
                background: white; 
                border-radius: 50%; /* Circle Logo for Premium Feel */
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
            .logo-img { width: 100%; height: 100%; object-fit: contain; padding: 4px; }
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

            /* Content - Compacted */
            .content { padding: 24px 20px 10px; }
            
            .row { display: flex; justify-content: space-between; margin-bottom: 16px; border-bottom: 1px dashed #E2E8F0; padding-bottom: 16px; }
            .col { flex: 1; }
            .col-right { text-align: right; }
            
            .label { font-size: 9px; text-transform: uppercase; color: #94A3B8; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 2px; }
            .value { font-size: 13px; color: #0F172A; font-weight: 600; line-height: 1.3; }
            
            /* Table */
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

            /* Totals */
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
            
            /* Footer Grid Layout - Adjusted */
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
            
            .signature { height: 50px; border-bottom: 1px solid #0F172A; padding-bottom: 4px; margin-bottom: 4px; width: 100%; object-fit: contain; }
            .stamp { height: 70px; opacity: 0.9; transform: rotate(-5deg); object-fit: contain; }
            .label-sm { font-size: 8px; color: #94A3B8; text-transform: uppercase; font-weight: 800; letter-spacing: 1px; }

            .qr-img { width: 70px; height: 70px; }

            /* Buttons & Actions */
            .action-btn { 
                display: block; 
                background: #0F172A; 
                color: white; 
                text-align: center; 
                padding: 14px; 
                border-radius: 8px; 
                text-decoration: none; 
                font-weight: 700; 
                font-size: 12px; 
                text-transform: uppercase; 
                letter-spacing: 1px;
                box-shadow: 0 4px 6px -1px rgba(15, 23, 42, 0.2);
                margin: 24px 0 16px;
                background: linear-gradient(to right, #0F172A, #334155);
            }

            .footer-info { font-size: 9px; color: #64748B; line-height: 1.4; text-align: center; margin-top: 16px; }

            /* Desktop Scale */
            @media (min-width: 600px) {
                .container { margin: 20px auto; border-radius: 16px; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1); }
            }
        </style>
    </head>
    <body>
        <div class="container">
            <!-- HEADER -->
            <div class="header">
                <div class="invoice-badge">
                    <span class="invoice-number">#${invoice.id}</span>
                </div>
                
                <div class="logo-box">
                    ${logo_url ? `<img src="${logo_url}" class="logo-img" />` : `<span class="logo-text">${name.charAt(0)}</span>`}
                </div>
                <h1 class="company-name">${name}</h1>
                <div class="tagline">Official Invoice</div>
            </div>

            <!-- CUSTOMER -->
            <div class="content">
                <div class="row">
                    <div class="col">
                        <div class="label">Billed To</div>
                        <div class="value">${invoice.customerName || 'Valued Customer'}</div>
                        <div class="value" style="color: #64748B; font-size: 11px;">${invoice.customerPhone || ''}</div>
                    </div>
                    <div class="col col-right">
                        <div class="label">Total Due</div>
                        <div class="value" style="color: #0F172A; font-size: 18px;">${formatCurrency(invoice.grandTotal)}</div>
                        <div style="font-size: 10px; color: #10B981; font-weight: 800; text-transform: uppercase; margin-top: 4px;">• ${invoice.status} •</div>
                    </div>
                </div>
            </div>

            <!-- TABLE -->
            <div class="table-container">
                <div style="padding: 10px 0;">
                <div style="padding: 0 24px; margin-bottom: 8px; font-size: 10px; text-transform: uppercase; color: #94A3B8; font-weight: 800; letter-spacing: 1px;">Item Details</div>
                ${(invoice.items || []).map(item => `
                    <div class="item-row" style="padding: 10px 20px;">
                        <div style="flex: 2;">
                            <div class="item-desc">${item.description}</div>
                            <div class="item-qty">${item.quantity} x ${formatCurrency(item.price)}</div>
                        </div>
                        <div class="item-price">${formatCurrency(item.price * item.quantity)}</div>
                    </div>
                `).join('')}
                </div>
            </div>

            <!-- TOTALS & FOOTER -->
            <div class="content">
                <div class="totals">
                    <div class="total-row">
                        <span>Subtotal</span>
                        <span>${formatCurrency(invoice.subtotal)}</span>
                    </div>
                    <div class="total-row grand">
                        <span>Total Paid</span>
                        <span>${formatCurrency(invoice.grandTotal)}</span>
                    </div>
                </div>

                <div class="auth-grid">
                    <div class="auth-item">
                        <img src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://abumafhal.com/verify/${invoice.id}" class="qr-img" />
                        <span class="label-sm" style="margin-top: 4px;">Scan to Verify</span>
                    </div>

                    ${stamp_url ? `
                    <div class="auth-item">
                        <img src="${stamp_url}" class="stamp" />
                    </div>` : '<div class="auth-item"></div>'}
                    
                    ${signature_url ? `
                    <div class="auth-item">
                        <img src="${signature_url}" class="signature" />
                        <span class="label-sm">Authorized Sign</span>
                    </div>` : '<div class="auth-item"></div>'}
                </div>

                <div class="footer-details">
                    
                    <div class="footer-info">
                        <strong>${name}</strong><br>
                        ${address} • ${phone}
                        <div style="margin-top: 8px; font-style: italic; color: #94A3B8; font-family:serif; font-size: 9px;">"${footer_text}"</div>
                    </div>
                </div>
            </div>
        </div>
    </body>
    </html>
    `;
}

// Internal helper to generate PDF and Upload
const generateAndUploadPDF = async (invoice, businessSettings) => {
    try {
        console.log("Generating PDF for Invoice:", invoice.id);

        // Use a simpler template or same template for the PDF itself
        const html = generateInvoiceHTML(invoice, businessSettings);

        const { uri } = await Print.printToFileAsync({
            html,
            base64: true
        });

        console.log("PDF Generated at:", uri);

        const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
        const fileName = `invoices/${invoice.id}_${Date.now()}.pdf`;

        console.log("Uploading to Supabase...");

        const { data, error } = await supabase.storage
            .from('app-assets')
            .upload(fileName, decode(base64), {
                contentType: 'application/pdf',
                upsert: true
            });

        if (error) {
            console.error("Supabase Upload Error:", error);
            throw error;
        }

        const { data: { publicUrl } } = supabase.storage
            .from('app-assets')
            .getPublicUrl(fileName);

        console.log("PDF URL:", publicUrl);
        return publicUrl;

    } catch (e) {
        console.error("PDF Generation/Upload Failed:", e);
        Alert.alert("PDF Error", "Failed to generate/upload PDF: " + e.message);
        return null; // Fallback to null (will use default link)
    }
};

export async function sendInvoiceEmail(invoice, email, businessSettings = {}) {
    console.log(`Attempting to email invoice ${invoice.id} to ${email}...`);

    let downloadLink = null;

    // PDF Generation Disabled (User Request)
    /*
    // Try generating PDF if we are on a platform that supports it (Native)
    // On web, printToFileAsync might behave differently. 
    // We'll wrap in try-catch and platform check if needed, but for now try always.
    if (Platform.OS !== 'web') {
        downloadLink = await generateAndUploadPDF(invoice, businessSettings);
    }
    */

    // Generate HTML for email, passing the PDF link (which is null now)
    const htmlContent = generateInvoiceHTML(invoice, { ...businessSettings, downloadLink });

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${RESEND_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: businessSettings.sender_email || 'onboarding@resend.dev',
                to: email,
                subject: `Invoice ${invoice.id} - Abu Mafhal Marketplace`,
                html: htmlContent
            })
        });

        const data = await response.json();

        if (!response.ok) {
            console.error('Resend Error:', data);

            // Check for specific Resend Test Mode limitation
            if (data.message?.includes('only send testing emails') || data.message?.includes('domain is not verified')) {
                Alert.alert(
                    'Resend Free Tier Limit',
                    `You are in Resend Test Mode.\n\nYou can ONLY send emails to: muhammadsaniisyaku3@gmail.com\n\nTo send to other customers, you must verify your domain on Resend.com.`
                );
            } else {
                Alert.alert('Email Error', data.message || 'Failed to send email');
            }
            return false;
        }

        console.log('Email sent successfully:', data.id);
        return true;

    } catch (error) {
        console.error('Email Exception:', error);
        return false;
    }
}
