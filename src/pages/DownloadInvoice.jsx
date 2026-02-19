import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import html2pdf from 'html2pdf.js';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2 } from 'lucide-react';

const DownloadInvoice = () => {
    const { id } = useParams();
    const [loading, setLoading] = useState(true);
    const [downloading, setDownloading] = useState(false);
    const [invoice, setInvoice] = useState(null);
    const pdfRef = useRef(null);

    useEffect(() => {
        const fetchInvoice = async () => {
            try {
                if (!id) return;

                // Fetch Invoice
                const { data, error } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('id', id)
                    .single(); // Use single()

                if (error) throw error;
                if (data) {
                    setInvoice(data);
                    // Trigger download after a short delay to ensure render
                    setTimeout(() => handleDownload(data), 1000);
                }
            } catch (e) {
                console.error("Error fetching invoice", e);
            } finally {
                setLoading(false);
            }
        };

        fetchInvoice();
    }, [id]);

    const handleDownload = async (data) => {
        if (!pdfRef.current) return;
        setDownloading(true);
        try {
            const element = pdfRef.current;
            const opt = {
                margin: 0,
                filename: `Invoice_${data.id || 'download'}.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true, logging: false },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            };

            await html2pdf().set(opt).from(element).save();
            // Optional: Close window or redirect after download?
            // window.close();
        } catch (e) {
            console.error("PDF Generation Error", e);
            alert("Could not generate PDF");
        } finally {
            setDownloading(false);
        }
    };

    if (loading || !invoice) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
                <Loader2 className="w-10 h-10 animate-spin text-brand-teal mb-4" />
                <p className="text-gray-500 font-medium">Preparing Invoice...</p>
            </div>
        );
    }

    // A4 Template (Read-Only)
    // Using defaults if business/fields missing
    const business = invoice.business || {
        name: "ABU MAFHAL LTD",
        address: "123 Goni Aji Street, Gashua, Yobe State",
        phone: "+234 814 585 3539",
        email: "support@abumafhal.com",
        footer: "Thank you for your patronage!"
    };

    // Fallbacks
    const items = invoice.items || [];
    const subtotal = invoice.subtotal || 0;
    const vat = invoice.vat || 0;
    const discount = invoice.discount || 0;
    const grandTotal = invoice.grandTotal || 0;
    const taxRate = invoice.taxRate || 0;

    return (
        <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
            <div className="mb-4 text-center">
                <h1 className="text-xl font-bold text-gray-800">Downloading Invoice...</h1>
                <p className="text-sm text-gray-500">If download doesn't start, <button onClick={() => handleDownload(invoice)} className="text-blue-600 underline">click here</button>.</p>
            </div>

            {/* Visual Container (Centered) */}
            <div className="shadow-2xl opacity-100 bg-white" style={{ width: '794px', height: '1123px' }}> {/* A4 Dimensions */}
                <div ref={pdfRef} className="w-full h-full bg-white relative flex flex-col">

                    {/* Dark Header */}
                    <div className="bg-[#0E1A2E] text-white p-10 pb-16 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-teal/5 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none"></div>
                        <div className="flex justify-between items-start relative z-10">
                            <div className="flex gap-6 items-start">
                                <div className="w-24 h-24 bg-white rounded-2xl flex items-center justify-center p-2 shadow-lg">
                                    {(business.logo) ? (
                                        <img src={business.logo} className="w-full h-full object-contain" alt="Logo" />
                                    ) : (
                                        <span className="text-3xl font-black text-brand-blue">{business.name?.charAt(0) || 'A'}</span>
                                    )}
                                </div>
                                <div className="mt-1">
                                    <h1 className="text-2xl font-black tracking-tight uppercase text-white mb-1">{business.name}</h1>
                                    <p className="text-brand-teal text-[10px] font-bold uppercase tracking-[0.2em] mb-4">Official Invoice</p>
                                    <div className="text-gray-400 text-xs space-y-1 font-medium"><p>{business.address}</p><p>{business.phone}</p><p>{business.email}</p></div>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="mb-6"><p className="text-[10px] font-bold text-brand-teal uppercase tracking-widest mb-1">Invoice No</p><p className="text-3xl font-mono font-bold text-white tracking-tight">{invoice.id}</p></div>
                                <div className="mb-6"><p className="text-[10px] font-bold text-brand-teal uppercase tracking-widest mb-1">Issued Date</p><p className="text-lg font-mono font-bold text-white">{new Date(invoice.issuedAt || Date.now()).toLocaleDateString()}</p></div>
                                <div className="inline-block border border-[#D9A73A] px-4 py-1 rounded text-[#D9A73A] text-xs font-bold uppercase tracking-widest">{invoice.status}</div>
                            </div>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex-1 px-10 py-10">
                        <div className="mb-12 flex justify-between items-center">
                            <div><p className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Bill To</p><h2 className="text-3xl font-bold text-[#0E1A2E] mb-1">{invoice.customerName || "Customer Name"}</h2><p className="text-gray-500 font-medium">{invoice.customerPhone || "Mobile / Email Address"}</p></div>
                            <div className="text-right"><QRCodeSVG value={`https://abumafhal.com/verify/${invoice.id}`} size={80} fgColor="#0E1A2E" /><p className="text-[8px] font-bold text-gray-300 uppercase mt-2 tracking-widest">Scan to Verify</p></div>
                        </div>
                        <table className="w-full mb-12">
                            <thead><tr className="border-b-2 border-[#0E1A2E]"><th className="py-3 text-left font-black text-[#0E1A2E] text-[10px] uppercase tracking-widest w-16">Item #</th><th className="py-3 text-left font-black text-[#0E1A2E] text-[10px] uppercase tracking-widest">Description</th><th className="py-3 text-right font-black text-[#0E1A2E] text-[10px] uppercase tracking-widest w-24">QTY</th><th className="py-3 text-right font-black text-[#0E1A2E] text-[10px] uppercase tracking-widest w-32">Price (₦)</th><th className="py-3 text-right font-black text-[#0E1A2E] text-[10px] uppercase tracking-widest w-32">Total (₦)</th></tr></thead>
                            <tbody className="divide-y divide-gray-100">
                                {items.map((item, i) => (
                                    <tr key={i}><td className="py-4 text-xs font-mono text-gray-400 font-bold">{(i + 1).toString().padStart(2, '0')}</td><td className="py-4 text-sm font-bold text-gray-800">{item.description}<p className="text-[10px] text-brand-teal uppercase font-bold tracking-wider mt-1">Verified Product</p></td><td className="py-4 text-right text-sm font-mono text-gray-600">{item.quantity}</td><td className="py-4 text-right text-sm font-mono text-gray-600">{Number(item.price).toLocaleString()}</td><td className="py-4 text-right text-sm font-mono font-black text-[#0E1A2E]">{(Number(item.price) * Number(item.quantity)).toLocaleString()}</td></tr>
                                ))}
                                {/* Spacers */}
                                {Array.from({ length: Math.max(0, 5 - items.length) }).map((_, i) => <tr key={`spacer-${i}`} className="h-16"><td colSpan={5}></td></tr>)}
                            </tbody>
                        </table>

                        <div className="flex justify-between items-end">
                            {/* Notes & Branding */}
                            <div className="w-1/2">
                                <div className="mb-8">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Terms & Notes</p>
                                    <p className="text-xs text-gray-500 max-w-xs">{business.footer}</p>
                                </div>
                                {(business.authorizedSignature || business.businessStamp) && (
                                    <div className="flex items-end gap-6">
                                        {business.authorizedSignature && <div>
                                            <img src={business.authorizedSignature} alt="Signature" className="h-16 object-contain mb-2" />
                                            <div className="border-t border-gray-300 w-32 pt-1"><p className="text-[8px] font-bold text-gray-400 uppercase tracking-widest">Authorized Sign</p></div>
                                        </div>}
                                        {business.businessStamp && <img src={business.businessStamp} alt="Stamp" className="h-20 w-20 object-contain opacity-80" />}
                                    </div>
                                )}
                            </div>

                            <div className="bg-gray-50 rounded-2xl p-8 flex justify-end w-1/2">
                                <div className="w-full space-y-4">
                                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase"><span>Subtotal</span><span className="font-mono text-gray-900">₦{Number(subtotal).toLocaleString()}</span></div>
                                    <div className="flex justify-between text-xs font-bold text-gray-500 uppercase"><span>VAT ({taxRate}%)</span><span className="font-mono text-gray-900">₦{Number(vat).toLocaleString()}</span></div>
                                    {(discount > 0) && <div className="flex justify-between text-xs font-bold text-brand-gold uppercase"><span>Discount</span><span className="font-mono text-brand-gold">- ₦{Number(discount).toLocaleString()}</span></div>}
                                    <div className="border-t border-gray-200 pt-4 mt-2 flex justify-between items-center"><span className="font-black text-[#0E1A2E] uppercase tracking-widest text-lg">Total Due</span><span className="font-black text-[#0E1A2E] font-mono text-2xl">₦{Number(grandTotal).toLocaleString()}</span></div>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="bg-[#0E1A2E] text-white p-4 text-center"><div className="flex justify-between items-center max-w-2xl mx-auto text-[8px] font-bold uppercase tracking-[0.2em] text-gray-400"><span>Bank: Moniepoint MFB</span><span>Acc: 8145853539</span><span>Abu Mafhal Ltd</span></div></div>
                </div>
            </div>
        </div>
    );
};

export default DownloadInvoice;
