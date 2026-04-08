import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { 
  FiSearch, FiFilter, FiEye, FiCheckCircle, FiXCircle, FiTruck, FiClock, 
  FiUser, FiMapPin, FiPhone, FiMessageCircle, 
  FiPrinter, FiClipboard, FiTrendingUp, FiShoppingBag,
  FiExternalLink, FiSend, FiLayout, FiMaximize2, FiCalendar, FiCopy, FiCheck
} from 'react-icons/fi';
import { sendEmail } from '../../services/emailService';

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
  processing: 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  shipped: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-400',
  delivered: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  cancelled: 'bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('all'); // all, today, week, month
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkMode, setBulkMode] = useState(false);
  const [copiedId, setCopiedId] = useState(null);
  const [showCancelPrompt, setShowCancelPrompt] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [fetchError, setFetchError] = useState(null);
  const [debugLog, setDebugLog] = useState([]);

  const addLog = (msg) => setDebugLog(prev => [...prev.slice(-4), msg]);

  useEffect(() => {
    fetchOrders();
    fetchDrivers();
    
    // Subscribe to realtime orders
    const channel = supabase
      .channel('admin-orders-live-grid')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchOrders();
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
          // Real-time Modal Update
          setSelectedOrder(prev => (prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setFetchError(null);
    addLog('Checking session...');
    
    // Check if we have a Supabase session (required for RLS/Mobile parity)
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      addLog('Warning: No Supabase session. RLS might block orders.');
      console.warn('No active Supabase session found. Orders may be restricted by RLS.');
    } else {
      addLog(`Authenticated as: ${session.user.email}`);
    }

    addLog('Fetching orders...');
    try {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles(full_name, email, phone),
          driver:drivers(name, vehicle_type, phone, xp),
          order_items(id, quantity, price, product:products(name, images))
        `)
        .order('created_at', { ascending: false });

      if (error) {
        addLog(`Error: ${error.message}`);
        console.error('Error fetching orders:', error);
        setFetchError(error.message);
        return;
      }
      addLog(`Success: ${data?.length || 0} orders found`);
      setOrders(data || []);
    } catch (error) {
      addLog(`Crash: ${error.message}`);
      setFetchError(error.message);
      console.error('Error fetching orders:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchDrivers = async () => {
    try {
      const { data } = await supabase.from('drivers').select('*');
      setDrivers(data || []);
    } catch (e) {
      console.error('Error fetching drivers:', e);
    }
  };

  const fetchOrderDetails = async (orderId) => {
    setLoadingDetails(true);
    try {
      const [itemsRes, logsRes] = await Promise.all([
        supabase.from('order_items').select('*, product:products(name, images)').eq('order_id', orderId),
        supabase.from('order_status_logs').select('*, profile:profiles(full_name)').eq('order_id', orderId).order('created_at', { ascending: false })
      ]);
      setOrderItems(itemsRes.data || []);
      setTimeline(logsRes.data || []);
    } catch (e) {
      console.error('Error fetching order details:', e);
    } finally {
      setLoadingDetails(false);
    }
  };

  const handleUpdateStatus = async (id, newStatus, note = '') => {
    if (newStatus === 'cancelled' && !showCancelPrompt && !note) {
      setShowCancelPrompt(true);
      return;
    }
    
    setUpdatingStatus(true);
    try {
      if (newStatus === 'cancelled') {
        const { data: items } = await supabase.from('order_items').select('product_id, quantity').eq('order_id', id);
        if (items) {
          for (const item of items) {
            if (item.product_id && item.quantity) {
              const { data: prod } = await supabase.from('products').select('stock_quantity').eq('id', item.product_id).single();
              if (prod) {
                await supabase.from('products').update({ stock_quantity: (prod.stock_quantity || 0) + item.quantity }).eq('id', item.product_id);
              }
            }
          }
        }
      }

      const { error } = await supabase.from('orders').update({ status: newStatus }).eq('id', id);
      if (error) throw error;

      // Log status change
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_status_logs').insert({
        order_id: id,
        status: newStatus,
        note: note || `Status updated to ${newStatus}`,
        changed_by: user?.id
      });

      // Credit vendors if delivered
      if (newStatus === 'delivered') {
        await supabase.rpc('credit_vendors_on_delivery', { p_order_id: id });
      }

      fetchOrders();
      
      // Email Notification (Web Parity)
      const orderToNotify = selectedOrder || orders.find(o => o.id === id);
      if (orderToNotify?.user?.email) {
        const templateMap = {
          'processing': 'orderConfirmation',
          'shipped': 'orderShipped',
          'delivered': 'orderDelivered',
        };
        const template = templateMap[newStatus];
        if (template) {
          sendEmail(orderToNotify.user.email, template, {
            id: id,
            customerName: orderToNotify.user.full_name || 'Customer',
            createdAt: orderToNotify.created_at,
            items: orderItems,
            subtotal: orderToNotify.subtotal || 0,
            shippingFee: orderToNotify.shipping_fee || 0,
            discount: orderToNotify.discount_applied || 0,
            total: orderToNotify.total_amount || 0,
            shippingAddress: orderToNotify.shipping_address,
            customerPhone: orderToNotify.user?.phone || 'N/A',
            trackingNumber: id.slice(0, 8),
            carrier: 'Abu Mafhal Express'
          });
        }
      }

      if (selectedOrder?.id === id) {
        fetchOrderDetails(id);
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
      }
    } catch (e) {
      alert('Error updating status: ' + e.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  const handleBulkUpdate = async (newStatus) => {
    if (selectedIds.size === 0) return;
    setUpdatingStatus(true);
    try {
       const ids = Array.from(selectedIds);
       await Promise.all(ids.map(id => handleUpdateStatus(id, newStatus)));
       setSelectedIds(new Set());
       setBulkMode(false);
    } catch (e) {
       alert('Bulk update failed');
    } finally {
       setUpdatingStatus(false);
    }
  };

  const toggleSelect = (id) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleAssignDriver = async (orderId, driverId) => {
    try {
      const driver = drivers.find(d => d.id === driverId);
      const { error } = await supabase.from('orders').update({ 
        driver_id: driverId,
        status: 'shipped' 
      }).eq('id', orderId);
      
      if (error) throw error;

      // Log
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_status_logs').insert({
        order_id: orderId,
        status: 'shipped',
        note: `Driver assigned: ${driver?.name || 'Unknown'}`,
        changed_by: user?.id
      });

      fetchOrders();
      if (selectedOrder?.id === orderId) fetchOrderDetails(orderId);

      // Email Driver Notification
      if (driver?.email) {
        sendEmail(driver.email, 'driverAssignment', {
          id: orderId,
          driverName: driver.name,
          customerName: selectedOrder?.user?.full_name || 'Customer',
          address: typeof selectedOrder?.shipping_address === 'string' 
            ? selectedOrder.shipping_address 
            : `${selectedOrder?.shipping_address?.address}, ${selectedOrder?.shipping_address?.city}`,
          customerPhone: selectedOrder?.user?.phone || 'N/A'
        });
      }
    } catch (e) {
      alert('Error assigning driver');
    }
  };

  const handleAddNote = async () => {
    if (!adminNote.trim() || !selectedOrder) return;
    setSavingNote(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_status_logs').insert({
        order_id: selectedOrder.id,
        status: selectedOrder.status,
        note: `📌 Admin Note: ${adminNote}`,
        changed_by: user?.id
      });
      setAdminNote('');
      fetchOrderDetails(selectedOrder.id);
    } catch (e) {
      alert('Error saving note');
    } finally {
      setSavingNote(false);
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedId(text);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const stats = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const filterByDate = (date) => {
        if (dateRange === 'today') return date >= startOfToday;
        if (dateRange === 'week') return date >= startOfWeek;
        if (dateRange === 'month') return date >= startOfMonth;
        return true;
    };

    const periodOrders = orders.filter(o => filterByDate(new Date(o.created_at)));
    const totalRevenue = periodOrders.reduce((sum, o) => sum + (o.payment_status === 'paid' ? (o.total_amount || 0) : 0), 0);

    return {
      total: orders.length,
      pending: orders.filter(o => o.status === 'pending' || o.status === 'processing').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      revenue: totalRevenue,
      periodCount: periodOrders.length
    };
  }, [orders, dateRange]);

  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const q = searchTerm.toLowerCase();
      const matchesSearch = 
        o.id.toLowerCase().includes(q) ||
        o.user?.full_name?.toLowerCase().includes(q) ||
        o.user?.email?.toLowerCase().includes(q) ||
        o.payment_reference?.toLowerCase().includes(q);
      const matchesFilter = filter === 'all' || o.status === filter;
      return matchesSearch && matchesFilter;
    });
  }, [orders, searchTerm, filter]);

  const getDriverLevel = (xp) => {
    if (!xp || xp < 100) return 'Bronze';
    if (xp < 500) return 'Silver';
    if (xp < 2000) return 'Gold';
    return 'Elite';
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-500 font-medium lowercase tracking-widest">Syncing Logistics Terminal...</p>
        <div className="mt-8 p-4 bg-gray-100 rounded-xl text-[10px] font-mono text-gray-400">
            {debugLog.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-8 text-center">
        <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center text-rose-500 mb-6">
            <FiXCircle className="w-10 h-10" />
        </div>
        <h2 className="text-3xl font-black text-gray-900 tracking-tighter">Connection Interrupted</h2>
        <p className="text-gray-500 mt-2 max-w-sm">{fetchError}</p>
        <button 
            onClick={fetchOrders}
            className="mt-8 px-10 py-4 bg-indigo-600 text-white rounded-[2rem] font-black uppercase tracking-widest text-[10px] shadow-xl shadow-indigo-600/30"
        >
            Re-Initialize Terminal
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-10 p-4 md:p-8 animate-in fade-in duration-700 bg-gray-50/50 dark:bg-transparent min-h-screen">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-full text-xs font-black uppercase tracking-widest">
            <FiShoppingBag className="w-3.5 h-3.5" /> Direct Sales Terminal
          </div>
          <h1 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">
            Order <span className="text-indigo-500">Logistics</span>
          </h1>
          <p className="text-gray-500 dark:text-gray-400 font-medium text-lg max-w-xl leading-relaxed">
            Manage your supply chain, track customer deliveries, and analyze revenue flow in real-time.
          </p>
        </div>

        <div className="flex flex-wrap gap-4">
          <button 
            onClick={() => setBulkMode(!bulkMode)}
            className={`px-6 py-4 rounded-2xl border flex items-center gap-3 transition-all duration-300 font-black uppercase tracking-widest text-xs ${
              bulkMode 
              ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl shadow-indigo-600/30' 
              : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-700 dark:text-gray-300 hover:shadow-xl'
            }`}
          >
            <FiLayout className="w-4 h-4" /> {bulkMode ? 'Cancel Bulk' : 'Bulk Edit'}
          </button>
          <button 
            onClick={fetchOrders}
            className="p-4 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl hover:shadow-xl transition-all"
          >
            <FiClock className="w-5 h-5 text-indigo-500" />
          </button>
        </div>
      </div>

      {/* Stats Section with Date Pickers (Mobile Parity) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-8 bg-gray-900 p-8 md:p-10 rounded-[3rem] text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:scale-110 transition-transform duration-700">
                <FiTrendingUp className="w-64 h-64" />
            </div>
            <div className="relative z-10 space-y-8">
                <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-60">Revenue Intelligence</p>
                    <div className="flex gap-2 p-1 bg-white/10 rounded-xl">
                        {['all', 'today', 'week', 'month'].map(r => (
                            <button 
                                key={r}
                                onClick={() => setDateRange(r)}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                                    dateRange === r ? 'bg-white text-gray-900 shadow-lg' : 'hover:bg-white/5 opacity-50 hover:opacity-100'
                                }`}
                            >
                                {r}
                            </button>
                        ))}
                    </div>
                </div>
                <div>
                    <h2 className="text-6xl font-black tracking-tighter">₦{stats.revenue.toLocaleString()}</h2>
                    <p className="mt-4 text-indigo-300 font-bold flex items-center gap-2">
                        <FiShoppingBag /> {stats.periodCount} orders processed in selected period
                    </p>
                </div>
            </div>
        </div>
        
        <div className="lg:col-span-4 grid grid-cols-2 gap-6">
            <MiniStat title="Pending" value={stats.pending} icon={<FiClock />} color="amber" />
            <MiniStat title="Delivered" value={stats.delivered} icon={<FiCheckCircle />} color="emerald" />
        </div>
      </div>

      {/* Bulk Action Strip */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="bg-indigo-600 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between text-white shadow-2xl animate-in slide-in-from-top-4 duration-500 gap-6">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-white/20 rounded-2xl">
              <FiCheckCircle className="w-6 h-6" />
            </div>
            <div>
              <p className="font-black uppercase tracking-widest text-[10px] opacity-70">Logistics Fleet Managed</p>
              <p className="text-2xl font-black italic">{selectedIds.size} Target Selected</p>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => handleBulkUpdate('delivered')} className="px-8 py-4 bg-white text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Mark Delivered</button>
             <button onClick={() => handleBulkUpdate('cancelled')} className="px-8 py-4 bg-rose-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 transition-all shadow-xl">Cancel All</button>
             <button onClick={() => setSelectedIds(new Set())} className="px-8 py-4 bg-white/10 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-white/20 transition-all">Deselect</button>
          </div>
        </div>
      )}

      {/* Cancellation Reason Prompt */}
      {showCancelPrompt && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md animate-in fade-in duration-300">
           <div className="bg-white dark:bg-gray-900 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl space-y-8 animate-in zoom-in-95">
                <div className="space-y-4 text-center">
                    <div className="w-20 h-20 bg-rose-500/10 rounded-full flex items-center justify-center mx-auto text-rose-500">
                        <FiXCircle className="w-10 h-10" />
                    </div>
                    <h2 className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter">Cancellation Protocol</h2>
                    <p className="text-gray-500 font-medium lowercase tracking-widest text-xs">A professional reason is required for synchronization.</p>
                </div>
                <textarea 
                    placeholder="Enter reason for cancellation/refund..."
                    className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent rounded-[2rem] p-6 text-sm font-bold min-h-[120px] outline-none focus:border-rose-500 transition-all"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                />
                <div className="flex gap-4">
                    <button 
                        onClick={() => { setShowCancelPrompt(false); setCancelReason(''); }}
                        className="flex-1 py-4 bg-gray-100 dark:bg-white/5 rounded-2xl font-black uppercase tracking-widest text-[10px] text-gray-500"
                    >
                        Abort
                    </button>
                    <button 
                        onClick={() => {
                            handleUpdateStatus(selectedOrder.id, 'cancelled', `Refund/Cancel Reason: ${cancelReason}`);
                            setShowCancelPrompt(false);
                            setCancelReason('');
                        }}
                        disabled={!cancelReason.trim()}
                        className="flex-1 py-4 bg-rose-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-xl shadow-rose-500/30 disabled:opacity-50"
                    >
                        Confirm Cancellation
                    </button>
                </div>
           </div>
        </div>
      )}

      {/* Filters Area */}
      <div className="flex flex-col md:flex-row gap-6 items-center justify-between pb-2">
        <div className="relative w-full md:w-[400px] group">
            <FiSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within:text-indigo-500 transition-colors w-5 h-5" />
            <input 
              type="text" 
              placeholder="Search Orders, Customers, Ref..."
              className="w-full bg-white dark:bg-white/5 border-2 border-transparent dark:border-white/5 rounded-[2rem] py-5 pl-14 pr-6 focus:bg-white focus:border-indigo-500 dark:focus:border-indigo-500 transition-all outline-none shadow-xl shadow-gray-200/50 dark:shadow-none font-bold"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
        </div>

        <div className="flex gap-2 p-2 bg-white dark:bg-white/5 rounded-3xl border border-gray-100 dark:border-white/10 shadow-lg overflow-x-auto w-full md:w-auto overflow-hidden">
            {['all', ...STATUSES].map(s => (
              <button 
                key={s}
                onClick={() => setFilter(s)}
                className={`px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${
                  filter === s 
                  ? 'bg-indigo-600 text-white shadow-lg' 
                  : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-50 dark:hover:bg-white/5'
                }`}
              >
                {s}
              </button>
            ))}
        </div>
      </div>

      {/* Orders Grid (Mobile Parity UI) */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
        {filteredOrders.map(order => (
          <OrderCard 
            key={order.id} 
            order={order} 
            bulkMode={bulkMode}
            isSelected={selectedIds.has(order.id)}
            onSelect={() => toggleSelect(order.id)}
            onAnalyze={() => {
                setSelectedOrder(order);
                fetchOrderDetails(order.id);
                setShowModal(true);
            }}
            getDriverLevel={getDriverLevel}
          />
        ))}
        {filteredOrders.length === 0 && (
          <div className="col-span-full py-32 text-center bg-white dark:bg-white/5 rounded-[3rem] border-2 border-dashed border-gray-200 dark:border-white/10">
            <div className="w-24 h-24 bg-gray-50 dark:bg-white/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <FiShoppingBag className="w-10 h-10 text-gray-300" />
            </div>
            <h3 className="text-xl font-black text-gray-900 dark:text-white">Strategic Silence</h3>
            <p className="text-gray-500 font-medium">No orders found matching your search parameters.</p>
          </div>
        )}
      </div>

      {/* Advanced Details Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-10 backdrop-blur-3xl bg-white/40 dark:bg-black/60 overflow-y-auto">
          <div className="bg-white dark:bg-[#080808] w-full max-w-7xl min-h-[90vh] rounded-[4rem] border border-gray-100 dark:border-white/10 shadow-2xl flex flex-col md:flex-row overflow-hidden relative animate-in zoom-in-95 duration-500">
            
            {/* Main Content Area */}
            <div className="flex-1 p-8 md:p-14 overflow-y-auto custom-scrollbar space-y-12">
                <div className="flex flex-col md:flex-row justify-between items-start gap-8">
                    <div className="space-y-4">
                        <div className={`inline-flex px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest ${STATUS_COLORS[selectedOrder.status]}`}>
                            {selectedOrder.status}
                        </div>
                        <h2 className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter uppercase">
                            Order <span className="text-indigo-500">#{selectedOrder.id.slice(0, 8)}</span>
                        </h2>
                        <div className="flex items-center gap-6 text-gray-400 font-bold text-xs uppercase tracking-widest">
                            <span className="flex items-center gap-2"><FiCalendar className="text-indigo-500"/> {new Date(selectedOrder.created_at).toLocaleDateString()}</span>
                            <span className="flex items-center gap-2"><FiClock className="text-indigo-500"/> {new Date(selectedOrder.created_at).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                    </div>
                    <div className="flex gap-4">
                        <button onClick={() => window.print()} className="p-5 bg-gray-100 dark:bg-white/5 rounded-3xl hover:bg-white dark:hover:bg-white/10 shadow-lg hover:-translate-y-1 transition-all">
                            <FiPrinter className="w-6 h-6 text-gray-900 dark:text-white" />
                        </button>
                        <button onClick={() => setShowModal(false)} className="p-5 bg-gray-100 dark:bg-white/5 rounded-3xl hover:bg-rose-500 hover:text-white shadow-lg hover:-translate-y-1 transition-all">
                            <FiXCircle className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                {/* Info Cards Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="bg-gray-50 dark:bg-white/5 p-10 rounded-[3rem] space-y-6 border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Customer Protocol</p>
                        <div className="space-y-2">
                            <h3 className="text-2xl font-black text-gray-900 dark:text-white">{selectedOrder.user?.full_name}</h3>
                            <p className="text-gray-500 font-bold underline cursor-pointer">{selectedOrder.user?.email}</p>
                        </div>
                        <div className="flex gap-4 pt-4">
                            <a href={`tel:${selectedOrder.user?.phone}`} className="flex-1 py-4 bg-white dark:bg-white/10 rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-gray-200/50 dark:shadow-none hover:-translate-y-1 transition-all">
                                <FiPhone className="text-indigo-500" /> Call
                            </a>
                            <a href={`https://wa.me/${selectedOrder.user?.phone?.replace(/\D/g,'')}`} target="_blank" className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl flex items-center justify-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-emerald-500/30 hover:-translate-y-1 transition-all">
                                <FiMessageCircle /> WhatsApp
                            </a>
                        </div>
                    </div>

                    <div className="bg-gray-50 dark:bg-white/5 p-10 rounded-[3rem] space-y-6 border border-gray-100 dark:border-white/5">
                        <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">Logistics Target</p>
                        <p className="text-lg font-bold text-gray-700 dark:text-gray-300 leading-relaxed">
                            {typeof selectedOrder.shipping_address === 'string' 
                                ? selectedOrder.shipping_address 
                                : `${selectedOrder.shipping_address?.address}, ${selectedOrder.shipping_address?.city}, ${selectedOrder.shipping_address?.state}`}
                        </p>
                        <a 
                          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                            typeof selectedOrder.shipping_address === 'string' 
                            ? selectedOrder.shipping_address 
                            : `${selectedOrder.shipping_address?.address} ${selectedOrder.shipping_address?.city}`
                          )}`}
                          target="_blank"
                          className="inline-flex py-4 px-10 bg-indigo-600 text-white rounded-2xl items-center gap-3 font-black uppercase text-[10px] tracking-widest shadow-xl shadow-indigo-600/30 hover:-translate-y-1 transition-all"
                        >
                          <FiMapPin /> Open Logistics Map
                        </a>
                    </div>
                </div>

                {/* Items Section */}
                <div className="space-y-8">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Inventory Dispatched</h3>
                    <div className="space-y-4">
                        {loadingDetails ? (
                            <div className="animate-pulse space-y-4">
                                {[1,2].map(i => <div key={i} className="h-24 bg-gray-100 dark:bg-white/5 rounded-3xl" />)}
                            </div>
                        ) : orderItems.map((item, id) => (
                            <div key={id} className="flex items-center gap-8 p-8 bg-gray-50 dark:bg-white/5 rounded-[2.5rem] group hover:border-indigo-500/50 border border-transparent transition-all">
                                <div className="w-24 h-24 rounded-3xl overflow-hidden shadow-2xl bg-white">
                                    <img src={item.product?.images?.[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-xl font-black text-gray-900 dark:text-white uppercase tracking-tighter">{item.product?.name}</h4>
                                    <p className="text-gray-500 font-bold uppercase text-[10px] tracking-widest mt-2 px-3 py-1 bg-white dark:bg-white/5 inline-block rounded-lg">Qty: {item.quantity}</p>
                                </div>
                                <div className="text-right">
                                    <p className="text-2xl font-black text-indigo-600 dark:text-indigo-400 tracking-tight">₦{item.price?.toLocaleString()}</p>
                                    <p className="text-[10px] font-black text-gray-400 uppercase mt-1">Net Unit Value</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Driver Fleet Assignment */}
                <div className="bg-indigo-900 p-12 rounded-[4rem] text-white space-y-10 shadow-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-16 opacity-10">
                        <FiTruck className="w-48 h-48" />
                    </div>
                    <div className="relative z-10 flex flex-col md:flex-row items-center gap-10">
                        <div className="w-28 h-28 bg-white/10 rounded-[2.5rem] flex items-center justify-center border border-white/20 backdrop-blur-xl shrink-0">
                            <FiTruck className="w-12 h-12 text-indigo-300" />
                        </div>
                        <div className="flex-1 space-y-4">
                            {selectedOrder.driver ? (
                                <div>
                                    <p className="text-4xl font-black italic">{selectedOrder.driver.name}</p>
                                    <p className="text-indigo-300 font-black uppercase tracking-[0.2em] text-[10px] mt-2">
                                        Fleet Specialist • {selectedOrder.driver.vehicle_type} • Level {getDriverLevel(selectedOrder.driver.xp)}
                                    </p>
                                </div>
                            ) : (
                                <p className="text-indigo-200/60 font-medium text-lg leading-relaxed">No logistics specialist has been assigned to this terminal yet.</p>
                            )}
                            
                            <div className="pt-4">
                                <select 
                                    onChange={(e) => handleAssignDriver(selectedOrder.id, e.target.value)}
                                    className="w-full md:w-auto bg-white/10 border-2 border-white/20 rounded-2xl px-8 py-5 text-sm font-black uppercase tracking-widest outline-none focus:bg-white focus:text-gray-900 transition-all cursor-pointer shadow-2xl"
                                    value={selectedOrder.driver_id || ''}
                                >
                                    <option value="" disabled className="text-gray-900">Assign Fleet Operator...</option>
                                    {drivers.map(d => (
                                        <option key={d.id} value={d.id} className="text-gray-900">{d.name} ({d.vehicle_type})</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Sidebar Inspector Panel */}
            <div className="w-full md:w-[450px] bg-gray-50/50 dark:bg-black/40 border-l border-gray-100 dark:border-white/5 flex flex-col">
                <div className="p-10 space-y-10">
                    <div className="space-y-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Financial Summary</p>
                        <div className="space-y-4">
                            <SummaryLine label="Gross Subtotal" value={selectedOrder.subtotal} />
                            <SummaryLine label="Logistics Fee" value={selectedOrder.shipping_fee} />
                            <SummaryLine label="Promotional Discount" value={selectedOrder.discount_applied} negative />
                            <div className="h-px bg-gray-200 dark:bg-white/10 my-6" />
                            <div className="flex justify-between items-end">
                                <span className="text-[10px] font-black text-indigo-500 uppercase tracking-widest pb-2">Settlement Total</span>
                                <span className="text-5xl font-black text-gray-900 dark:text-white tracking-tighter">₦{selectedOrder.total_amount?.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Payment Security</p>
                        <div className="bg-white dark:bg-white/5 p-6 rounded-3xl border border-gray-100 dark:border-white/5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase text-gray-400">Reference ID</p>
                                <p className="text-sm font-black text-gray-900 dark:text-white mt-1 uppercase leading-none">{selectedOrder.payment_reference || 'N/A'}</p>
                            </div>
                            <button 
                                onClick={() => copyToClipboard(selectedOrder.payment_reference)}
                                className={`p-4 rounded-2xl transition-all ${copiedId === selectedOrder.payment_reference ? 'bg-emerald-500 text-white' : 'bg-gray-100 dark:bg-white/10 text-gray-500'}`}
                            >
                                {copiedId === selectedOrder.payment_reference ? <FiCheck /> : <FiCopy />}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Protocol Operations</p>
                        <div className="grid grid-cols-2 gap-3">
                            {STATUSES.map(s => (
                                <button 
                                    key={s}
                                    onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                                    disabled={updatingStatus || selectedOrder.status === s}
                                    className={`py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all ${
                                        selectedOrder.status === s
                                        ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30'
                                        : 'bg-white dark:bg-white/5 text-gray-500 border border-gray-100 dark:border-white/5 hover:bg-gray-100 dark:hover:bg-white/10'
                                    }`}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="flex-1 bg-white dark:bg-[#0c0c0c] border-t border-gray-100 dark:border-white/5 p-10 space-y-8 overflow-y-auto custom-scrollbar">
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Event Timeline</p>
                    <div className="space-y-10 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-gray-100 dark:before:bg-white/5">
                        {loadingDetails ? (
                            <div className="space-y-8 pl-8">
                                {[1,2,3].map(i => <div key={i} className="h-4 bg-gray-100 dark:bg-white/5 rounded-full w-3/4 animate-pulse" />)}
                            </div>
                        ) : timeline.map((log, i) => (
                            <div key={i} className="relative pl-10 group">
                                <div className={`absolute left-0 top-1 w-4 h-4 rounded-full border-[3px] border-white dark:border-[#0c0c0c] z-10 transition-transform group-hover:scale-125 ${
                                    log.status === 'delivered' ? 'bg-emerald-500' : 'bg-indigo-500'
                                }`} />
                                <div className="space-y-2">
                                    <p className="text-[10px] font-black text-gray-900 dark:text-white uppercase tracking-widest">{log.status}</p>
                                    <p className="text-sm text-gray-500 font-medium leading-relaxed">{log.note}</p>
                                    <div className="flex items-center gap-3 pt-1">
                                        <p className="text-[9px] font-black text-indigo-500 uppercase">{log.profile?.full_name || 'System Override'}</p>
                                        <span className="w-1 h-1 bg-gray-300 rounded-full" />
                                        <p className="text-[9px] text-gray-400 font-bold uppercase">{new Date(log.created_at).toLocaleString([], {month:'short', day:'numeric', hour:'2-digit', minute:'2-digit'})}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    
                    <div className="pt-6 relative group">
                        <textarea 
                          placeholder="Inject administrative internal note..."
                          className="w-full bg-gray-50 dark:bg-white/5 border-2 border-transparent rounded-3xl p-6 text-sm outline-none focus:border-indigo-500 transition-all font-bold min-h-[140px] resize-none"
                          value={adminNote}
                          onChange={(e) => setAdminNote(e.target.value)}
                        />
                        <button 
                           onClick={handleAddNote}
                           disabled={savingNote || !adminNote.trim()}
                           className="absolute bottom-6 right-6 p-4 bg-indigo-600 text-white rounded-2xl shadow-2xl hover:scale-110 active:scale-95 transition-all disabled:opacity-50"
                        >
                           <FiSend className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

/* ── UI Components ── */

const OrderCard = ({ order, bulkMode, isSelected, onSelect, onAnalyze, getDriverLevel }) => {
    const status = order.status?.toLowerCase() || 'pending';
    
    return (
        <div 
            className={`group bg-white dark:bg-white/5 rounded-[3rem] p-8 border-2 transition-all duration-500 cursor-pointer relative flex flex-col h-full hover:shadow-2xl hover:-translate-y-2 ${
                isSelected ? 'border-indigo-500 shadow-2xl' : 'border-transparent dark:border-white/5 shadow-xl shadow-gray-200/50 dark:shadow-none'
            }`}
            onClick={bulkMode ? onSelect : onAnalyze}
        >
            {/* Bulk Selection Indicator */}
            {bulkMode && (
                <div className={`absolute top-6 right-6 w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                    isSelected ? 'bg-indigo-600 text-white shadow-xl shadow-indigo-600/30' : 'bg-gray-100 dark:bg-white/10 text-gray-300'
                }`}>
                    {isSelected && <FiCheck className="w-5 h-5" />}
                </div>
            )}

            <div className="flex justify-between items-start mb-6">
                <div>
                    <h3 className="text-xl font-black text-gray-900 dark:text-white tracking-tighter uppercase whitespace-nowrap">
                        #{order.id.slice(0, 8)}
                    </h3>
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-1">
                        {new Date(order.created_at).toLocaleDateString()}
                    </p>
                </div>
                <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${STATUS_COLORS[status] || 'bg-gray-100'}`}>
                    {status}
                </span>
            </div>

            <div className="flex-1 space-y-6">
                <div className="space-y-1">
                    <p className="text-sm font-black text-gray-900 dark:text-white uppercase tracking-tight">{order.user?.full_name}</p>
                    <p className="text-[10px] text-gray-500 font-bold lowercase tracking-wider">{order.user?.email}</p>
                </div>

                {/* Product Thumbnails (Mobile Parity) */}
                <div className="flex items-center gap-3">
                    <div className="flex -space-x-4 overflow-hidden">
                        {order.order_items?.slice(0, 3).map((oi, i) => (
                            <img 
                                key={i} 
                                src={oi.product?.images?.[0] || 'https://via.placeholder.com/50'} 
                                className="w-14 h-14 rounded-2xl border-4 border-white dark:border-gray-900 object-cover shadow-lg"
                                alt=""
                            />
                        ))}
                    </div>
                    {order.order_items?.length > 3 && (
                        <div className="w-14 h-14 rounded-2xl bg-indigo-600 flex items-center justify-center text-white text-xs font-black shadow-lg border-4 border-white dark:border-gray-900">
                            +{order.order_items.length - 3}
                        </div>
                    )}
                </div>

                <div className="flex items-end justify-between border-t border-gray-50 dark:border-white/5 pt-6">
                    <div>
                        <p className="text-3xl font-black text-indigo-600 dark:text-indigo-400 tracking-tighter">₦{order.total_amount?.toLocaleString()}</p>
                        <p className="text-[10px] font-black text-gray-400 uppercase mt-1 opacity-70">{order.payment_method}</p>
                    </div>
                    {order.driver && (
                        <div className="flex items-center gap-3 text-right">
                            <div>
                                <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest">{order.driver.name}</p>
                                <p className="text-[9px] text-gray-400 font-bold tracking-tighter uppercase whitespace-nowrap">Fleet Lvl: {getDriverLevel(order.driver.xp)}</p>
                            </div>
                            <div className="p-3 bg-indigo-50 rounded-xl dark:bg-white/5">
                                <FiTruck className="w-5 h-5 text-indigo-500" />
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            <button className="mt-8 w-full py-4 bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-2xl text-[10px] font-black uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-xl shadow-gray-900/10 dark:shadow-none">
                Analyze Logistics
            </button>
        </div>
    );
};

const MiniStat = ({ title, value, icon, color }) => {
    const colors = {
      blue: 'text-blue-600 bg-blue-500/10',
      amber: 'text-amber-600 bg-amber-500/10',
      emerald: 'text-emerald-600 bg-emerald-500/10',
      indigo: 'text-indigo-600 bg-indigo-500/10',
    };
    return (
        <div className="bg-white dark:bg-white/5 p-8 rounded-[2.5rem] shadow-xl shadow-gray-200/50 dark:shadow-none border border-gray-100 dark:border-white/10 flex flex-col justify-between group hover:-translate-y-2 transition-transform duration-500">
            <div className={`p-4 rounded-2xl w-fit ${colors[color]}`}>
                {React.cloneElement(icon, { className: 'w-6 h-6' })}
            </div>
            <div className="mt-6">
                <p className="text-3xl font-black text-gray-900 dark:text-white tracking-tighter leading-none">{value}</p>
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-3">{title}</p>
            </div>
        </div>
    );
};

const SummaryLine = ({ label, value, negative }) => (
    <div className="flex justify-between text-xs">
        <span className="text-gray-500 font-bold uppercase tracking-widest text-[9px]">{label}</span>
        <span className={`font-black ${negative ? 'text-emerald-500' : 'text-gray-900 dark:text-white'}`}>
            {negative && '-'}₦{value?.toLocaleString()}
        </span>
    </div>
);

export default AdminOrders;