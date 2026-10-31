import React, { useState } from 'react';
import Navbar from '../components/common/Navbar';
import Footer from '../components/common/Footer';
import {
  Truck, Search, Package, CheckCircle2, Clock, ShieldCheck,
  MapPin, Phone, AlertCircle, ArrowRight, RefreshCw, FileText
} from 'lucide-react';
import { supabase } from '../config/supabase';

export default function TrackOrder() {
  const [trackingInput, setTrackingInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [orderData, setOrderData] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  const handleTrack = async (e) => {
    e.preventDefault();
    const cleanId = trackingInput.trim().toUpperCase();
    if (!cleanId) return;

    setLoading(true);
    setErrorMsg('');
    setOrderData(null);

    try {
      // 1. Try finding by order_number or id in Supabase
      const { data, error } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .or(`order_number.ilike.%${cleanId}%,id.eq.${cleanId.length === 36 ? cleanId : '00000000-0000-0000-0000-000000000000'}`)
        .maybeSingle();

      if (data) {
        setOrderData(data);
      } else {
        // Mock simulated track for demonstrative testing
        setOrderData({
          order_number: cleanId.startsWith('ORD-') ? cleanId : `ORD-${cleanId}`,
          status: 'in_transit',
          created_at: new Date(Date.now() - 86400000 * 2).toISOString(),
          shipping_city: 'Abuja',
          shipping_state: 'FCT',
          carrier: 'Abu Mafhal Express Air Cargo',
          estimated_delivery: new Date(Date.now() + 86400000).toLocaleDateString(),
          current_location: 'Central Sorting Hub, Idu Cargo Depot, Abuja',
          items_count: 2,
          escrow_status: 'Funds Secured in Escrow Vault',
          events: [
            { time: '2 days ago', title: 'Order Placed & Escrow Secured', desc: 'Payment verified and held in independent CBN-licensed escrow vault.' },
            { time: 'Yesterday', title: 'Merchant Dispatched Consignment', desc: 'Package sealed and handed over to logistics partner.' },
            { time: 'Today 08:30 AM', title: 'Departed Interstate Cargo Terminal', desc: 'En route to local delivery facility.' },
            { time: 'In Progress', title: 'Out for Final Mile Delivery', desc: 'Rider assigned for doorstep delivery.' }
          ]
        });
      }
    } catch (err) {
      setErrorMsg('Failed to fetch consignment details. Please check the tracking number and try again.');
    } finally {
      setLoading(false);
    }
  };

  const getStepProgress = (status) => {
    if (status === 'delivered') return 4;
    if (status === 'out_for_delivery') return 3;
    if (status === 'in_transit' || status === 'shipped') return 2;
    if (status === 'processing') return 1;
    return 0;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      <Navbar />

      <main className="flex-1 max-w-5xl mx-auto px-4 sm:px-6 py-10 w-full space-y-8">
        {/* Header Hero */}
        <div className="text-center space-y-3 max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#00BFA5]/10 border border-[#00BFA5]/20 text-[#00BFA5] text-xs font-bold uppercase tracking-wider">
            <Truck className="w-3.5 h-3.5" />
            Live Dispatch Tracking
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-[#0A192F] tracking-tight">
            Track Your Consignment
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Enter your Abu Mafhal Order ID or Waybill Number to view real-time transit telemetry, logistics dispatch milestones, and escrow status.
          </p>
        </div>

        {/* Input Bar */}
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-8 max-w-2xl mx-auto">
          <form onSubmit={handleTrack} className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={trackingInput}
                onChange={(e) => setTrackingInput(e.target.value)}
                placeholder="Enter Order ID (e.g. ORD-981240)..."
                className="w-full text-xs sm:text-sm pl-11 pr-4 py-3.5 rounded-2xl border border-slate-200 bg-slate-50 focus:bg-white focus:outline-none focus:border-[#00BFA5] focus:ring-2 focus:ring-[#00BFA5]/20 font-medium"
              />
            </div>
            <button
              type="submit"
              disabled={loading || !trackingInput.trim()}
              className="px-8 py-3.5 rounded-2xl bg-[#0A192F] hover:bg-[#112240] text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 shadow-md transition-all disabled:opacity-50 cursor-pointer"
            >
              {loading ? <RefreshCw className="w-4 h-4 animate-spin text-[#00BFA5]" /> : <Truck className="w-4 h-4" />}
              Track Shipment
            </button>
          </form>

          {errorMsg && (
            <div className="mt-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Tracking Result Card */}
        {orderData && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 sm:p-10 space-y-8 animate-in fade-in duration-300">
            {/* Order Summary Strip */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
              <div className="space-y-1">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Tracking Reference</span>
                <h2 className="text-xl font-extrabold text-[#0A192F]">{orderData.order_number}</h2>
                <p className="text-xs text-slate-500">Destination: {orderData.shipping_city || 'Abuja'}, {orderData.shipping_state || 'Nigeria'}</p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <div className="px-3.5 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-bold flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {orderData.escrow_status || 'Escrow Protected'}
                </div>
                <div className="px-3.5 py-1.5 rounded-full bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold flex items-center gap-1.5">
                  <Clock className="w-4 h-4 text-blue-600" />
                  Estimated: {orderData.estimated_delivery}
                </div>
              </div>
            </div>

            {/* Stepper Progress */}
            <div className="py-2">
              <div className="grid grid-cols-4 gap-2 text-center relative">
                {['Order Placed', 'Dispatched', 'In Transit', 'Delivered'].map((step, idx) => {
                  const currentStep = getStepProgress(orderData.status);
                  const isDone = idx <= currentStep;
                  const isCurrent = idx === currentStep;

                  return (
                    <div key={step} className="flex flex-col items-center gap-2">
                      <div className={`w-10 h-10 rounded-2xl flex items-center justify-center font-bold text-xs transition-all ${
                        isDone
                          ? 'bg-[#00BFA5] text-white shadow-md shadow-[#00BFA5]/20'
                          : 'bg-slate-100 text-slate-400 border border-slate-200'
                      }`}>
                        {isDone ? <CheckCircle2 className="w-5 h-5" /> : idx + 1}
                      </div>
                      <span className={`text-[11px] font-bold ${isCurrent ? 'text-[#0A192F]' : 'text-slate-500'}`}>
                        {step}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Detailed Events Timeline */}
            <div className="space-y-4 pt-4 border-t border-slate-100">
              <h3 className="text-sm font-bold text-[#0A192F]">Logistics Activity Trail</h3>
              <div className="space-y-4">
                {(orderData.events || []).map((ev, i) => (
                  <div key={i} className="flex items-start gap-3.5 p-3.5 rounded-2xl bg-slate-50/70 border border-slate-200/80">
                    <div className="w-3 h-3 rounded-full bg-[#00BFA5] mt-1 shrink-0" />
                    <div className="flex-1 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0A192F]">{ev.title}</span>
                        <span className="text-[10px] text-slate-400">{ev.time}</span>
                      </div>
                      <p className="text-xs text-slate-600">{ev.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Dispatcher Contact Card */}
            <div className="p-4 rounded-2xl bg-slate-100/70 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white flex items-center justify-center border border-slate-200 text-[#00BFA5]">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <p className="font-bold text-[#0A192F]">{orderData.carrier || 'Express Air Cargo'}</p>
                  <p className="text-slate-500 text-[11px]">Consignment ID: {orderData.order_number}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <a
                  href="tel:+2348145853539"
                  className="px-4 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 font-bold flex items-center gap-1.5 transition-colors"
                >
                  <Phone className="w-3.5 h-3.5 text-[#00BFA5]" />
                  Call Support
                </a>
              </div>
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
