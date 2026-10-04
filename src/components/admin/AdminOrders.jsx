import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../config/supabase';
import { 
  FiSearch, FiFilter, FiEye, FiCheckCircle, FiXCircle, FiTruck, FiClock, 
  FiUser, FiMapPin, FiPhone, FiMessageCircle, 
  FiPrinter, FiClipboard, FiTrendingUp, FiShoppingBag,
  FiExternalLink, FiSend, FiLayout, FiMaximize2, FiCalendar, FiCopy, FiCheck,
  FiCreditCard, FiDollarSign, FiChevronRight, FiAlertCircle, FiArrowDownRight,
  FiShield, FiRefreshCw, FiShare2
} from 'react-icons/fi';
import { sendEmail } from '../../services/emailService';

const STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];

const STATUS_COLORS = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/10 dark:text-amber-400 border border-amber-300 dark:border-amber-500/20',
  processing: 'bg-blue-100 text-blue-800 dark:bg-blue-500/10 dark:text-blue-400 border border-blue-300 dark:border-blue-500/20',
  shipped: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/10 dark:text-indigo-400 border border-indigo-300 dark:border-indigo-500/20',
  delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/20',
  cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-500/10 dark:text-rose-400 border border-rose-300 dark:border-rose-500/20',
};

// Helper to identify Payment Category
export const getPaymentType = (ord) => {
  if (!ord) return 'prepaid';
  const method = (ord.payment_method || '').toLowerCase();
  const pStatus = (ord.payment_status || '').toLowerCase();
  const hasPlan = !!(ord.installment_plan || ord.shipping_details?.installment_plan || ord.metadata?.installment_plan);

  if (
    hasPlan ||
    method.includes('small') ||
    method.includes('pss') ||
    method.includes('installment') ||
    pStatus.includes('pss') ||
    pStatus.includes('installment')
  ) {
    return 'pss';
  }

  if (
    method.includes('delivery') ||
    method.includes('pod') ||
    method.includes('cod') ||
    method.includes('cash on delivery') ||
    method.includes('pay on delivery')
  ) {
    return 'pod';
  }

  return 'prepaid';
};

// Helper to compute PSS financials
export const parseOrderFinances = (ord) => {
  if (!ord) return { isPss: false, total: 0, paid: 0, remaining: 0, paidCount: 0, count: 1, isFullyPaid: false, schedule: [] };
  const rawPlan = ord.installment_plan || ord.shipping_details?.installment_plan || ord.metadata?.installment_plan;
  const plan = typeof rawPlan === 'string' ? (() => { try { return JSON.parse(rawPlan); } catch (_) { return null; } })() : rawPlan;
  
  const isPss = getPaymentType(ord) === 'pss';
  const total = Number(plan?.total_amount || plan?.totalAmount || ord.total_amount || 0);

  if (!isPss) {
    const isPaid = ord.payment_status === 'paid' || ord.status === 'delivered' || ord.status === 'completed';
    return {
      isPss: false,
      total,
      paid: isPaid ? total : 0,
      remaining: isPaid ? 0 : total,
      paidCount: isPaid ? 1 : 0,
      count: 1,
      isFullyPaid: isPaid,
      schedule: []
    };
  }

  const schedule = Array.isArray(plan?.schedule) ? plan.schedule : [];
  const schedulePaidSum = schedule.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.amount || 0), 0);
  let paid = schedulePaidSum;
  if (paid <= 0) {
    if (plan?.paid_amount !== undefined && plan?.paid_amount !== null) paid = Number(plan.paid_amount);
    else if (plan?.paidAmount !== undefined && plan?.paidAmount !== null) paid = Number(plan.paidAmount);
    else if (plan?.down_payment !== undefined && plan?.down_payment !== null) paid = Number(plan.down_payment);
    else if (plan?.downPayment !== undefined && plan?.downPayment !== null) paid = Number(plan.downPayment);
    else if (plan?.remaining_balance !== undefined && plan?.remaining_balance !== null) paid = Math.max(0, total - Number(plan.remaining_balance));
    else if (plan?.remainingAmount !== undefined && plan?.remainingAmount !== null) paid = Math.max(0, total - Number(plan.remainingAmount));
    else if (ord.payment_status === 'paid') paid = total;
    else paid = Math.round(total * 0.25);
  }

  let remaining = 0;
  if (plan?.remaining_balance !== undefined && plan?.remaining_balance !== null) {
    remaining = Number(plan.remaining_balance);
  } else if (plan?.remainingAmount !== undefined && plan?.remainingAmount !== null) {
    remaining = Number(plan.remainingAmount);
  } else {
    remaining = Math.max(0, total - paid);
  }

  const count = Number(plan?.installmentsCount || plan?.installments_count || schedule.length || 4);
  const paidCount = schedule.filter(s => s.status === 'paid').length || Number(plan?.installments_paid || plan?.installmentsPaid || (paid >= total ? count : (paid > 0 ? 1 : 0)));
  const isFullyPaid = remaining <= 0 || paidCount >= count;

  return {
    isPss: true,
    plan,
    total,
    paid,
    remaining,
    count,
    paidCount,
    isFullyPaid,
    schedule
  };
};

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Primary Payment Type View: 'all', 'pss', 'pod', 'prepaid'
  const [paymentTypeTab, setPaymentTypeTab] = useState('all');
  
  // Secondary Status Filter
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Sub-filter for PSS (all, active, settled)
  const [pssSubFilter, setPssSubFilter] = useState('all');
  
  // Sub-filter for POD (all, pending, collected)
  const [podSubFilter, setPodSubFilter] = useState('all');

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('all'); // all, today, week, month
  
  // Selected order details & modal
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [orderItems, setOrderItems] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  
  // Modal active tab: 'summary', 'items', 'installments', 'logistics', 'timeline'
  const [modalTab, setModalTab] = useState('summary');

  // Actions state
  const [adminNote, setAdminNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [updatingLocation, setUpdatingLocation] = useState(false);
  const [newLocationInput, setNewLocationInput] = useState('');
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
    
    // Subscribe to realtime orders and drivers
    const channel = supabase
      .channel('admin-orders-live-grid')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          fetchOrders();
        } else if (payload.eventType === 'UPDATE') {
          setOrders(prev => prev.map(o => o.id === payload.new.id ? { ...o, ...payload.new } : o));
          setSelectedOrder(prev => (prev?.id === payload.new.id ? { ...prev, ...payload.new } : prev));
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers' }, () => {
        fetchDrivers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    setFetchError(null);
    addLog('Checking session and fetching orders...');
    
    try {
      let ordersData = null;

      // 1. Attempt clean nested query with valid columns (excluding non-existent photo_url)
      const res = await supabase
        .from('orders')
        .select(`
          *,
          user:profiles(full_name, email, phone),
          driver:drivers(id, name, vehicle_type, vehicle_number, phone, xp, rating, status, is_active),
          order_items(id, quantity, price, product:products(name, images))
        `)
        .order('created_at', { ascending: false });

      if (!res.error && res.data) {
        ordersData = res.data;
      } else {
        // 2. Resilient fallback query
        addLog(`Nested query notice: ${res.error?.message}. Using resilient fallback query...`);
        console.warn('Orders nested query notice, using direct fallback:', res.error);

        const fallback = await supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false });

        if (fallback.error) {
          addLog(`Error fetching orders: ${fallback.error.message}`);
          console.error('Direct fallback also failed:', fallback.error);
          setFetchError(fallback.error.message);
          setOrders([]);
          return;
        }

        ordersData = fallback.data || [];
      }

      // 3. Enrich customer profile, driver, and shipping details
      if (ordersData && ordersData.length > 0) {
        const userIds = [...new Set(ordersData.map(o => o.user_id).filter(Boolean))];
        const driverIds = [...new Set(ordersData.map(o => o.driver_id).filter(Boolean))];

        let profileMap = {};
        let driverMap = {};

        if (userIds.length > 0) {
          try {
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, email, phone')
              .in('id', userIds);
            (profiles || []).forEach(p => { profileMap[p.id] = p; });
          } catch (_) {}
        }

        if (driverIds.length > 0) {
          try {
            const { data: drvs } = await supabase
              .from('drivers')
              .select('id, name, vehicle_type, vehicle_number, phone, xp, rating, status, is_active')
              .in('id', driverIds);
            (drvs || []).forEach(d => { driverMap[d.id] = d; });
          } catch (_) {}
        }

        ordersData = ordersData.map(o => {
          let shipping = {};
          if (o.shipping_details && typeof o.shipping_details === 'object') {
            shipping = o.shipping_details;
          } else if (typeof o.shipping_details === 'string') {
            try { shipping = JSON.parse(o.shipping_details); } catch (_) {}
          }
          if (!shipping.full_name && o.shipping_address) {
            if (typeof o.shipping_address === 'object') {
              shipping = { ...shipping, ...o.shipping_address };
            } else if (typeof o.shipping_address === 'string' && o.shipping_address.startsWith('{')) {
              try { shipping = { ...shipping, ...JSON.parse(o.shipping_address) }; } catch (_) {}
            }
          }

          const userObj = o.user || profileMap[o.user_id] || {
            full_name: shipping.full_name || shipping.recipient_name || shipping.name || 'Valued Customer',
            email: shipping.email || 'N/A',
            phone: o.contact_phone || shipping.phone || 'N/A'
          };

          const driverObj = o.driver || driverMap[o.driver_id] || null;

          return {
            ...o,
            user: userObj,
            driver: driverObj
          };
        });
      }

      addLog(`Success: ${ordersData?.length || 0} orders found`);
      setOrders(ordersData || []);
      setFetchError(null);
    } catch (error) {
      addLog(`Notice: ${error.message}`);
      console.warn('Orders error caught:', error);
      setFetchError(error.message);
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

      const { error } = await supabase.from('orders').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', id);
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
        await supabase.rpc('credit_vendors_on_delivery', { p_order_id: id }).catch(() => {});
      }

      // Update local state immediately
      setOrders(prev => prev.map(o => o.id === id ? { ...o, status: newStatus } : o));
      if (selectedOrder?.id === id) {
        setSelectedOrder(prev => ({ ...prev, status: newStatus }));
        fetchOrderDetails(id);
      }

      // Email Notification
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
          }).catch(() => {});
        }
      }
    } catch (e) {
      alert('Error updating status: ' + e.message);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Pay On Delivery Verification Action
  const handleVerifyPodPayment = async (orderId) => {
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_status_logs').insert({
        order_id: orderId,
        status: selectedOrder?.status || 'delivered',
        note: '💵 Kuɗin Pay on Delivery (POD) An Karɓa kuma an Tabbatar (Cash Collected & Verified)',
        changed_by: user?.id
      });

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, payment_status: 'paid' } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, payment_status: 'paid' }));
        fetchOrderDetails(orderId);
      }
      alert('Kuɗin Pay on Delivery an tabbatar da an karɓa lafiya!');
    } catch (e) {
      alert('Error verifying POD payment: ' + e.message);
    }
  };

  // Pay Small Small Installment Payment Logging
  const handleMarkInstallmentPaid = async (order, sliceIndex) => {
    try {
      const fin = parseOrderFinances(order);
      const schedule = [...(fin.schedule || [])];
      if (!schedule[sliceIndex]) return;

      schedule[sliceIndex] = {
        ...schedule[sliceIndex],
        status: 'paid',
        paid_at: new Date().toISOString()
      };

      const newPaidCount = schedule.filter(s => s.status === 'paid').length;
      const newPaidAmount = schedule.filter(s => s.status === 'paid').reduce((sum, s) => sum + Number(s.amount || 0), 0);
      const newRemaining = Math.max(0, fin.total - newPaidAmount);
      const isFullySettled = newRemaining <= 0 || newPaidCount >= schedule.length;

      const updatedPlan = {
        ...fin.plan,
        schedule,
        paid_amount: newPaidAmount,
        remaining_balance: newRemaining,
        installments_paid: newPaidCount,
        is_fully_paid: isFullySettled
      };

      const updatePayload = {
        installment_plan: updatedPlan,
        updated_at: new Date().toISOString()
      };
      if (isFullySettled) {
        updatePayload.payment_status = 'paid';
      }

      const { error } = await supabase
        .from('orders')
        .update(updatePayload)
        .eq('id', order.id);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_status_logs').insert({
        order_id: order.id,
        status: order.status,
        note: `💳 An Tabbatar da Biyan Installment #${sliceIndex + 1} na ₦${Number(schedule[sliceIndex].amount || 0).toLocaleString()} (PSS Contract)`,
        changed_by: user?.id
      });

      setOrders(prev => prev.map(o => o.id === order.id ? { ...o, ...updatePayload } : o));
      if (selectedOrder?.id === order.id) {
        setSelectedOrder(prev => ({ ...prev, ...updatePayload }));
        fetchOrderDetails(order.id);
      }
      alert(`Installment #${sliceIndex + 1} an sanya shi matsayin AN BIYA!`);
    } catch (e) {
      alert('Error updating installment: ' + e.message);
    }
  };

  // Update Live Checkpoint Location
  const handleUpdateLocation = async (orderId) => {
    if (!newLocationInput.trim()) return;
    setUpdatingLocation(true);
    try {
      const loc = newLocationInput.trim();
      const { error } = await supabase
        .from('orders')
        .update({
          current_location: loc,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);

      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_status_logs').insert({
        order_id: orderId,
        status: selectedOrder?.status || 'in_transit',
        note: `📍 Sabuwar Tashar Kaya (Live Hub): ${loc}`,
        changed_by: user?.id
      });

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, current_location: loc } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, current_location: loc }));
        fetchOrderDetails(orderId);
      }
      setNewLocationInput('');
      alert(`An sabunta tashar kaya zuwa: ${loc}`);
    } catch (e) {
      alert('Error updating location: ' + e.message);
    } finally {
      setUpdatingLocation(false);
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
        status: 'shipped',
        delivery_notes: null,
        updated_at: new Date().toISOString()
      }).eq('id', orderId);
      
      if (error) throw error;

      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('order_status_logs').insert({
        order_id: orderId,
        status: 'shipped',
        note: `Driver assigned: ${driver?.name || 'Courier'}`,
        changed_by: user?.id
      });

      setOrders(prev => prev.map(o => o.id === orderId ? { ...o, driver_id: driverId, driver, delivery_notes: null, status: 'shipped' } : o));
      if (selectedOrder?.id === orderId) {
        setSelectedOrder(prev => ({ ...prev, driver_id: driverId, driver, delivery_notes: null, status: 'shipped' }));
        fetchOrderDetails(orderId);
      }

      fetchOrders();
      alert(`Driver assigned: ${driver?.name || 'Courier'}`);
    } catch (e) {
      alert('Error assigning driver: ' + e.message);
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
        note: `📌 Admin Internal Note: ${adminNote.trim()}`,
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

  // High-Level Statistics
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
    
    let totalRevenue = 0;
    let pssCount = 0;
    let pssCollected = 0;
    let pssRemaining = 0;
    let podCount = 0;
    let podCollected = 0;
    let podPending = 0;
    let prepaidCount = 0;
    let prepaidRevenue = 0;

    periodOrders.forEach(o => {
      const pType = getPaymentType(o);
      const fin = parseOrderFinances(o);

      if (pType === 'pss') {
        pssCount++;
        pssCollected += fin.paid || 0;
        pssRemaining += fin.remaining || 0;
        totalRevenue += fin.paid || 0;
      } else if (pType === 'pod') {
        podCount++;
        const amt = Number(o.total_amount || 0);
        if (o.payment_status === 'paid' || o.status === 'delivered') {
          podCollected += amt;
          totalRevenue += amt;
        } else {
          podPending += amt;
        }
      } else {
        prepaidCount++;
        const amt = Number(o.total_amount || 0);
        prepaidRevenue += amt;
        totalRevenue += amt;
      }
    });

    return {
      total: orders.length,
      periodCount: periodOrders.length,
      revenue: totalRevenue,
      pending: orders.filter(o => o.status === 'pending' || o.status === 'processing').length,
      delivered: orders.filter(o => o.status === 'delivered').length,
      shipped: orders.filter(o => o.status === 'shipped').length,
      pss: {
        count: pssCount,
        collected: pssCollected,
        remaining: pssRemaining,
        totalVolume: pssCollected + pssRemaining
      },
      pod: {
        count: podCount,
        collected: podCollected,
        pending: podPending,
        totalVolume: podCollected + podPending
      },
      prepaid: {
        count: prepaidCount,
        revenue: prepaidRevenue
      }
    };
  }, [orders, dateRange]);

  // Main Filtered Orders Logic
  const filteredOrders = useMemo(() => {
    return orders.filter(o => {
      const q = searchTerm.toLowerCase();
      const pType = getPaymentType(o);
      const fin = parseOrderFinances(o);

      // 1. Search filter
      const matchesSearch = 
        !searchTerm.trim() ||
        o.id?.toLowerCase().includes(q) ||
        o.user?.full_name?.toLowerCase().includes(q) ||
        o.user?.email?.toLowerCase().includes(q) ||
        o.user?.phone?.includes(q) ||
        o.contact_phone?.includes(q) ||
        o.tracking_number?.toLowerCase().includes(q) ||
        o.payment_reference?.toLowerCase().includes(q) ||
        o.driver?.name?.toLowerCase().includes(q);

      // 2. Payment Type Tab filter
      const matchesTypeTab = 
        paymentTypeTab === 'all' || 
        pType === paymentTypeTab;

      // 3. Status filter
      const matchesStatus = 
        statusFilter === 'all' || 
        o.status === statusFilter;

      // 4. PSS sub-filter
      let matchesPssSub = true;
      if (paymentTypeTab === 'pss') {
        if (pssSubFilter === 'active') matchesPssSub = !fin.isFullyPaid;
        else if (pssSubFilter === 'settled') matchesPssSub = fin.isFullyPaid;
      }

      // 5. POD sub-filter
      let matchesPodSub = true;
      if (paymentTypeTab === 'pod') {
        const isCollected = o.payment_status === 'paid' || o.status === 'delivered';
        if (podSubFilter === 'pending') matchesPodSub = !isCollected;
        else if (podSubFilter === 'collected') matchesPodSub = isCollected;
      }

      return matchesSearch && matchesTypeTab && matchesStatus && matchesPssSub && matchesPodSub;
    });
  }, [orders, searchTerm, paymentTypeTab, statusFilter, pssSubFilter, podSubFilter]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-slate-500 font-bold tracking-wider text-xs">Cibiyar Ododi tana Lodi...</p>
        <div className="mt-6 p-3 bg-slate-100 dark:bg-slate-800 rounded-xl text-[10px] font-mono text-slate-400">
            {debugLog.map((log, i) => <div key={i}>{log}</div>)}
        </div>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] p-8 text-center bg-white rounded-3xl shadow-sm border border-slate-200">
        <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 mb-4">
            <FiXCircle className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-black text-slate-900 tracking-tight">An Sami Matsalar Hada Sadarwa</h2>
        <p className="text-slate-500 text-sm mt-1 max-w-md">{fetchError}</p>
        <button 
            onClick={fetchOrders}
            className="mt-6 px-8 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl font-black uppercase tracking-wider text-xs shadow-md shadow-amber-500/20 transition-all"
        >
            Sake Gwada Lodi (Retry Terminal)
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500 font-sans">
      
      {/* ── TOP HEADER & TERMINAL ACTIONS ── */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-3xl border border-slate-200/80 dark:border-slate-800 shadow-sm">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 rounded-full text-xs font-black uppercase tracking-wider mb-2">
            <FiShoppingBag className="w-3.5 h-3.5" /> Abu Mafhal Logistics Terminal
          </div>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
            Gudanar da <span className="text-amber-500">Ododi</span> & Isar da Saƙo
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">
            Duba ododin da aka biya kai tsaye, 'yan Pay Small Small (PSS), da 'yan Pay on Delivery (POD) a waje guda.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button 
            onClick={() => setBulkMode(!bulkMode)}
            className={`px-5 py-2.5 rounded-xl border flex items-center gap-2 text-xs font-black uppercase tracking-wider transition-all ${
              bulkMode 
              ? 'bg-amber-500 border-amber-500 text-slate-950 shadow-md shadow-amber-500/30' 
              : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
            }`}
          >
            <FiLayout className="w-4 h-4" /> {bulkMode ? 'Kammala Zabi' : 'Zabi Da Dama (Bulk)'}
          </button>
          
          <button 
            onClick={fetchOrders}
            title="Sake Sabuntawa"
            className="p-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-600 dark:text-slate-300 hover:text-amber-600 hover:bg-slate-100 transition-all"
          >
            <FiRefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── KPI METRICS CARDS (FINANCIAL & LOGISTICS PULSE) ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6">
        {/* Card 1: Gross Orders & Revenue */}
        <div className="bg-gradient-to-br from-slate-900 via-slate-850 to-slate-950 text-white p-5 sm:p-6 rounded-3xl shadow-sm border border-slate-800 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Jimillar Kudi</span>
            <div className="w-8 h-8 rounded-xl bg-amber-400/20 text-amber-400 flex items-center justify-center text-xs font-black">
              ₦
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-amber-400">
              ₦{stats.revenue.toLocaleString()}
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1">
              Daga ododi {stats.periodCount} a tsarin
            </p>
          </div>
        </div>

        {/* Card 2: Pay Small Small (PSS) */}
        <div 
          onClick={() => setPaymentTypeTab('pss')}
          className={`p-5 sm:p-6 rounded-3xl cursor-pointer transition-all border flex flex-col justify-between ${
            paymentTypeTab === 'pss'
              ? 'bg-amber-500/10 border-amber-500 shadow-md shadow-amber-500/10'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-amber-400/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Pay Small Small (PSS)
            </span>
            <div className="w-8 h-8 rounded-xl bg-amber-100 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
              <FiCreditCard className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {stats.pss.count} <span className="text-xs font-bold text-slate-400">ododi</span>
            </h3>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-emerald-600 font-bold">₦{stats.pss.collected.toLocaleString()}</span>
              <span className="text-amber-600 font-bold">Ragowa: ₦{stats.pss.remaining.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 3: Pay on Delivery (POD) */}
        <div 
          onClick={() => setPaymentTypeTab('pod')}
          className={`p-5 sm:p-6 rounded-3xl cursor-pointer transition-all border flex flex-col justify-between ${
            paymentTypeTab === 'pod'
              ? 'bg-blue-500/10 border-blue-500 shadow-md shadow-blue-500/10'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 hover:border-blue-400/50'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">
              Pay On Delivery (POD)
            </span>
            <div className="w-8 h-8 rounded-xl bg-blue-100 dark:bg-blue-500/20 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <FiTruck className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {stats.pod.count} <span className="text-xs font-bold text-slate-400">ododi</span>
            </h3>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-emerald-600 font-bold">Karɓa: ₦{stats.pod.collected.toLocaleString()}</span>
              <span className="text-blue-600 font-bold">Jira: ₦{stats.pod.pending.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Card 4: Fulfillment / Active Deliveries */}
        <div className="bg-white dark:bg-slate-900 p-5 sm:p-6 rounded-3xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Isarwa a Hanya</span>
            <div className="w-8 h-8 rounded-xl bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <FiClock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-4">
            <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-slate-900 dark:text-white">
              {stats.shipped} <span className="text-xs font-bold text-indigo-500">In-Transit</span>
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1">
              An isar: <span className="text-emerald-600">{stats.delivered}</span> • Sauran: <span className="text-amber-600">{stats.pending}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── DEDICATED PAYMENT CATEGORY TABS (ALL, PSS, POD, PREPAID) ── */}
      <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
          {/* Tab 1: All Orders */}
          <button
            onClick={() => setPaymentTypeTab('all')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all whitespace-nowrap ${
              paymentTypeTab === 'all'
                ? 'bg-slate-950 text-white dark:bg-white dark:text-slate-950 shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400'
            }`}
          >
            <span>🌟 Duk Ododi</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900 font-black">
              {stats.total}
            </span>
          </button>

          {/* Tab 2: Pay Small Small (PSS / Installments) */}
          <button
            onClick={() => setPaymentTypeTab('pss')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all whitespace-nowrap ${
              paymentTypeTab === 'pss'
                ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-black'
                : 'text-amber-700 bg-amber-50 hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400'
            }`}
          >
            <FiCreditCard className="w-3.5 h-3.5" />
            <span>💳 Yan Pay Small Small (PSS)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-amber-950 text-amber-200 font-black">
              {stats.pss.count}
            </span>
          </button>

          {/* Tab 3: Pay on Delivery (POD) */}
          <button
            onClick={() => setPaymentTypeTab('pod')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all whitespace-nowrap ${
              paymentTypeTab === 'pod'
                ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20 font-black'
                : 'text-blue-700 bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400'
            }`}
          >
            <FiTruck className="w-3.5 h-3.5" />
            <span>🚚 Yan Pay on Delivery (POD)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-blue-950 text-blue-200 font-black">
              {stats.pod.count}
            </span>
          </button>

          {/* Tab 4: Prepaid / Online */}
          <button
            onClick={() => setPaymentTypeTab('prepaid')}
            className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-2 transition-all whitespace-nowrap ${
              paymentTypeTab === 'prepaid'
                ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20 font-black'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400'
            }`}
          >
            <FiDollarSign className="w-3.5 h-3.5" />
            <span>⚡ Yan Biyan Kai Tsaye (Prepaid)</span>
            <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-950 text-emerald-200 font-black">
              {stats.prepaid.count}
            </span>
          </button>
        </div>

        {/* Date Scope Filter */}
        <div className="flex items-center gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
          {[
            { id: 'all', label: 'Duk Lokaci' },
            { id: 'today', label: 'Yau' },
            { id: 'week', label: 'Wannan Satin' },
            { id: 'month', label: 'Watan Nan' }
          ].map(d => (
            <button
              key={d.id}
              onClick={() => setDateRange(d.id)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${
                dateRange === d.id
                  ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm font-black'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── SPECIAL SUB-FILTER BANNERS (FOR PSS & POD) ── */}
      {paymentTypeTab === 'pss' && (
        <div className="p-4 bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
              <FiCreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-amber-900 dark:text-amber-300">
                Gudanar da Ododin 'Yan Pay Small Small (Installments BNPL)
              </h4>
              <p className="text-xs text-amber-700/80 dark:text-amber-400">
                Ana nuna ododin da ake biya a sashi-sashi, matakin biya da ragowar kudin da za a karba.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'Duk PSS' },
              { id: 'active', label: 'Masu Ragowar Kudi (Active Debt)' },
              { id: 'settled', label: 'An Kammala Biya (Settled)' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setPssSubFilter(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  pssSubFilter === sub.id
                    ? 'bg-amber-500 text-slate-950 font-black shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {paymentTypeTab === 'pod' && (
        <div className="p-4 bg-gradient-to-r from-blue-500/10 via-blue-500/5 to-transparent border border-blue-500/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
              <FiTruck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-blue-900 dark:text-blue-300">
                Gudanar da Ododin 'Yan Pay on Delivery (POD / Cash on Delivery)
              </h4>
              <p className="text-xs text-blue-700/80 dark:text-blue-400">
                Tabbatar da isar da saƙo da kuma karɓar kuɗin hannu daga mai saye ta hannun direba/courier.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {[
              { id: 'all', label: 'Duk POD' },
              { id: 'pending', label: 'Jiran Karɓar Kuɗi (Cash Pending)' },
              { id: 'collected', label: 'An Karɓi Kuɗi (Cash Collected)' }
            ].map(sub => (
              <button
                key={sub.id}
                onClick={() => setPodSubFilter(sub.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  podSubFilter === sub.id
                    ? 'bg-blue-600 text-white font-black shadow-sm'
                    : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700'
                }`}
              >
                {sub.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── SEARCH & SECONDARY STATUS BAR ── */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Search Input */}
        <div className="relative w-full md:w-[380px]">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Nemi Order ID, Suna, Wayar Mai Saye..."
            className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl py-3 pl-11 pr-4 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-400 shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Status Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-x-auto w-full md:w-auto">
          {['all', ...STATUSES].map(s => (
            <button 
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
                statusFilter === s 
                ? 'bg-amber-500 text-slate-950 font-black shadow-sm' 
                : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800'
              }`}
            >
              {s === 'all' ? 'Duk Status' : s}
            </button>
          ))}
        </div>
      </div>

      {/* ── BULK ACTION STRIP (IF ACTIVE) ── */}
      {bulkMode && selectedIds.size > 0 && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-xl border border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400 text-slate-950 flex items-center justify-center font-black">
              {selectedIds.size}
            </div>
            <div>
              <p className="text-xs font-black uppercase text-amber-400">An Zabi Ododi</p>
              <p className="text-sm font-bold text-slate-300">Yi canji a lokaci daya</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => handleBulkUpdate('processing')} 
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold"
            >
              Mark Processing
            </button>
            <button 
              onClick={() => handleBulkUpdate('delivered')} 
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
            >
              Mark Delivered
            </button>
            <button 
              onClick={() => setSelectedIds(new Set())} 
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold"
            >
              Deselect
            </button>
          </div>
        </div>
      )}

      {/* ── ORDERS CARDS / GRID ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredOrders.map(order => {
          const pType = getPaymentType(order);
          const fin = parseOrderFinances(order);
          const isSelected = selectedIds.has(order.id);

          return (
            <div
              key={order.id}
              onClick={() => {
                if (bulkMode) toggleSelect(order.id);
                else {
                  setSelectedOrder(order);
                  fetchOrderDetails(order.id);
                  setShowModal(true);
                }
              }}
              className={`bg-white dark:bg-slate-900 rounded-3xl p-6 border transition-all duration-300 hover:shadow-xl cursor-pointer flex flex-col justify-between group ${
                isSelected 
                  ? 'border-amber-500 shadow-md ring-2 ring-amber-500/20' 
                  : 'border-slate-200/90 dark:border-slate-800 hover:border-amber-400/60'
              }`}
            >
              <div>
                {/* Card Top: Order Number & Badges */}
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-base font-black text-slate-900 dark:text-white tracking-tight">
                        #{order.id.slice(0, 8).toUpperCase()}
                      </h3>
                      <button 
                        onClick={(e) => { e.stopPropagation(); copyToClipboard(order.id); }}
                        className="text-slate-400 hover:text-slate-700"
                        title="Kwafi ID"
                      >
                        {copiedId === order.id ? <FiCheck className="w-3.5 h-3.5 text-emerald-500" /> : <FiCopy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <p className="text-[11px] font-bold text-slate-400 mt-0.5">
                      {new Date(order.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                    </p>
                  </div>

                  <div className="flex flex-col items-end gap-1.5">
                    {/* Status Pill */}
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${STATUS_COLORS[order.status?.toLowerCase()] || 'bg-slate-100 text-slate-700'}`}>
                      {order.status || 'pending'}
                    </span>

                    {/* Payment Category Badge */}
                    {pType === 'pss' ? (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-900 dark:bg-amber-500/20 dark:text-amber-300 flex items-center gap-1">
                        <FiCreditCard className="w-3 h-3" /> PSS BNPL
                      </span>
                    ) : pType === 'pod' ? (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-100 text-blue-900 dark:bg-blue-500/20 dark:text-blue-300 flex items-center gap-1">
                        <FiTruck className="w-3 h-3" /> PAY ON DELIVERY
                      </span>
                    ) : (
                      <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider bg-emerald-100 text-emerald-900 dark:bg-emerald-500/20 dark:text-emerald-300 flex items-center gap-1">
                        <FiCheckCircle className="w-3 h-3" /> PREPAID
                      </span>
                    )}
                  </div>
                </div>

                {/* Customer Contact Info */}
                <div className="p-3 bg-slate-50 dark:bg-slate-800/60 rounded-2xl mb-4 space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-black text-slate-900 dark:text-white truncate">
                      {order.user?.full_name || 'Customer'}
                    </p>
                    {order.user?.phone && (
                      <span className="text-[10px] font-mono text-slate-500 font-bold">
                        {order.user.phone}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 truncate">
                    {order.shipping_address ? (typeof order.shipping_address === 'string' ? order.shipping_address : `${order.shipping_address?.address || ''}, ${order.shipping_address?.city || ''}`) : 'Babu cikakken adireshi'}
                  </p>
                </div>

                {/* Specific Presentation for Pay Small Small (PSS) */}
                {pType === 'pss' && (
                  <div className="mb-4 p-3.5 bg-amber-50/70 dark:bg-amber-500/5 border border-amber-300/60 dark:border-amber-500/20 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-black text-amber-900 dark:text-amber-300">
                        Ci gaban Biya: {fin.paidCount} / {fin.count} Sashi
                      </span>
                      <span className="text-[11px] font-black text-emerald-600">
                        {Math.round(((fin.paid || 0) / (fin.total || 1)) * 100)}%
                      </span>
                    </div>

                    {/* Progress Bar */}
                    <div className="w-full h-2 bg-amber-200/60 dark:bg-amber-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.round(((fin.paid || 0) / (fin.total || 1)) * 100))}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-emerald-700 dark:text-emerald-400">
                        An Karɓa: ₦{fin.paid?.toLocaleString()}
                      </span>
                      <span className="text-amber-800 dark:text-amber-300">
                        Ragowa: ₦{fin.remaining?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                )}

                {/* Specific Presentation for Pay on Delivery (POD) */}
                {pType === 'pod' && (
                  <div className="mb-4 p-3.5 bg-blue-50/70 dark:bg-blue-500/5 border border-blue-300/60 dark:border-blue-500/20 rounded-2xl flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-black text-blue-900 dark:text-blue-300 uppercase tracking-wider">
                        Matsayin Karɓar Kuɗin Hannu
                      </p>
                      <p className={`text-xs font-black mt-0.5 ${
                        order.payment_status === 'paid' || order.status === 'delivered'
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}>
                        {order.payment_status === 'paid' || order.status === 'delivered'
                          ? '✅ An Karɓi Kuɗin (Collected)'
                          : '⏳ Jiran Karɓar Kuɗi a Hannun Mai Saye'}
                      </p>
                    </div>

                    {!(order.payment_status === 'paid' || order.status === 'delivered') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleVerifyPodPayment(order.id);
                        }}
                        className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black"
                      >
                        Tabbatar da Kuɗi
                      </button>
                    )}
                  </div>
                )}

                {/* Items Thumbnails */}
                {order.order_items && order.order_items.length > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    <div className="flex -space-x-3 overflow-hidden">
                      {order.order_items.slice(0, 3).map((oi, i) => (
                        <img 
                          key={i} 
                          src={oi.product?.images?.[0] || 'https://via.placeholder.com/50'} 
                          className="w-10 h-10 rounded-xl border-2 border-white dark:border-slate-800 object-cover shadow-sm bg-slate-100"
                          alt=""
                        />
                      ))}
                    </div>
                    {order.order_items.length > 3 && (
                      <div className="w-8 h-8 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-black text-slate-600">
                        +{order.order_items.length - 3}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer: Total Amount & Driver Assigned */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-end justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase text-slate-400">Jimillar Kudi</p>
                  <p className="text-xl font-black text-slate-900 dark:text-white">
                    ₦{order.total_amount?.toLocaleString()}
                  </p>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-0.5">
                    {order.payment_method || 'Online'}
                  </p>
                </div>

                {order.driver ? (
                  <div className="text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-xs font-black text-indigo-600 dark:text-indigo-400">
                        {order.driver.name}
                      </p>
                    </div>
                    <p className="text-[10px] text-slate-400 font-bold">
                      {order.driver.vehicle_type || 'Fleet Rider'}
                    </p>
                  </div>
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-wider text-amber-600 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-lg">
                    Ba a Ba Direba Ba
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="col-span-full py-20 text-center bg-white dark:bg-slate-900 rounded-3xl border border-dashed border-slate-300 dark:border-slate-800">
            <FiShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-black text-slate-800 dark:text-slate-200">Babu Ododi a Wannan Rukunin</h3>
            <p className="text-xs text-slate-400 mt-1">Babu wata oda da ta dace da bincikenku a halin yanzu.</p>
          </div>
        )}
      </div>

      {/* ── ADVANCED ORDER INSPECTION MODAL ── */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-950/70 backdrop-blur-md overflow-y-auto">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-3xl border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[92vh]">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/75 dark:bg-slate-850 flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center font-black">
                  <FiShoppingBag className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-lg font-black text-slate-900 dark:text-white">
                      Oda #{selectedOrder.id.slice(0, 8).toUpperCase()}
                    </h3>
                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase ${STATUS_COLORS[selectedOrder.status] || 'bg-slate-100'}`}>
                      {selectedOrder.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-bold mt-0.5">
                    {new Date(selectedOrder.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <button 
                onClick={() => setShowModal(false)}
                className="w-9 h-9 rounded-xl bg-slate-200/60 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-200"
              >
                <FiXCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex items-center gap-2 px-6 pt-3 border-b border-slate-100 dark:border-slate-800 overflow-x-auto flex-shrink-0">
              {[
                { id: 'summary', label: 'Bayanin Saye (Summary)' },
                { id: 'items', label: `Kayan da aka Saya (${orderItems.length})` },
                ...(getPaymentType(selectedOrder) === 'pss' ? [{ id: 'installments', label: '💳 Installments Plan' }] : []),
                { id: 'logistics', label: 'Direba & Logistics' },
                { id: 'timeline', label: 'Tarihin Sauye-sauye' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setModalTab(t.id)}
                  className={`px-4 py-2.5 border-b-2 text-xs font-black transition-all whitespace-nowrap ${
                    modalTab === t.id
                      ? 'border-amber-500 text-amber-600 dark:text-amber-400'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Modal Body Content (Scrollable) */}
            <div className="p-6 overflow-y-auto flex-1 space-y-6 custom-scrollbar">
              
              {/* TAB 1: SUMMARY */}
              {modalTab === 'summary' && (
                <div className="space-y-6">
                  {/* Customer Information & Quick Actions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Bayanan Mai Saye</p>
                      <h4 className="text-sm font-black text-slate-900 dark:text-white">
                        {selectedOrder.user?.full_name || 'Customer'}
                      </h4>
                      <p className="text-xs text-slate-500 font-bold">{selectedOrder.user?.email || 'N/A'}</p>
                      <p className="text-xs text-slate-500 font-bold">{selectedOrder.user?.phone || selectedOrder.contact_phone || 'N/A'}</p>
                      
                      {/* WhatsApp Call / Chat Action */}
                      <div className="pt-2 flex items-center gap-2">
                        {selectedOrder.user?.phone && (
                          <a 
                            href={`https://wa.me/234${selectedOrder.user.phone.replace(/^0/, '').replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <FiMessageCircle className="w-3.5 h-3.5" /> WhatsApp Mai Saye
                          </a>
                        )}
                        {selectedOrder.user?.phone && (
                          <a 
                            href={`tel:${selectedOrder.user.phone}`}
                            className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 text-slate-800 dark:text-slate-200 rounded-xl text-xs font-bold inline-flex items-center gap-1.5"
                          >
                            <FiPhone className="w-3.5 h-3.5" /> Kira Ta Waya
                          </a>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60 space-y-2">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Adireshi & Isarwa</p>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200 leading-relaxed">
                        {selectedOrder.shipping_address 
                          ? (typeof selectedOrder.shipping_address === 'string' ? selectedOrder.shipping_address : `${selectedOrder.shipping_address?.address || ''}, ${selectedOrder.shipping_address?.city || ''}, ${selectedOrder.shipping_address?.state || ''}`)
                          : 'Babu adireshi'}
                      </p>
                      {selectedOrder.current_location && (
                        <p className="text-xs font-bold text-amber-600 flex items-center gap-1 mt-2">
                          <FiMapPin className="w-3.5 h-3.5" /> Tashar Kaya: {selectedOrder.current_location}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Financial Breakdown */}
                  <div className="p-5 rounded-2xl bg-slate-900 text-white border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-bold uppercase">Subtotal</span>
                      <span className="text-xs font-bold">₦{(selectedOrder.subtotal || 0).toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                      <span className="text-xs text-slate-400 font-bold uppercase">Kudin Isarwa (Shipping)</span>
                      <span className="text-xs font-bold">₦{(selectedOrder.shipping_fee || 0).toLocaleString()}</span>
                    </div>
                    {selectedOrder.discount_applied > 0 && (
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <span className="text-xs text-emerald-400 font-bold uppercase">Ragi (Discount)</span>
                        <span className="text-xs font-bold text-emerald-400">-₦{selectedOrder.discount_applied.toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-sm font-black uppercase text-amber-400">Jimillar Kudi</span>
                      <span className="text-2xl font-black text-amber-400">₦{(selectedOrder.total_amount || 0).toLocaleString()}</span>
                    </div>
                  </div>

                  {/* Quick Change Status Buttons */}
                  <div className="space-y-2">
                    <p className="text-xs font-black uppercase text-slate-400">Canza Matsayin Oda (Update Status)</p>
                    <div className="flex flex-wrap gap-2">
                      {STATUSES.map(s => (
                        <button
                          key={s}
                          onClick={() => handleUpdateStatus(selectedOrder.id, s)}
                          disabled={updatingStatus || selectedOrder.status === s}
                          className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
                            selectedOrder.status === s
                              ? 'bg-amber-500 text-slate-950 shadow-md font-black'
                              : 'bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: ITEMS ORDERED */}
              {modalTab === 'items' && (
                <div className="space-y-3">
                  {orderItems.map((item, i) => (
                    <div key={i} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700/60">
                      <div className="flex items-center gap-3">
                        <img 
                          src={item.product?.images?.[0] || 'https://via.placeholder.com/60'} 
                          alt="" 
                          className="w-14 h-14 rounded-xl object-cover bg-white"
                        />
                        <div>
                          <h4 className="text-xs font-black text-slate-900 dark:text-white">
                            {item.product?.name || 'Product Item'}
                          </h4>
                          <p className="text-[11px] text-slate-500 font-bold mt-0.5">
                            Yawa: {item.quantity} x ₦{(item.price || 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-black text-slate-900 dark:text-white">
                          ₦{((item.price || 0) * (item.quantity || 1)).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {orderItems.length === 0 && (
                    <p className="text-center text-xs text-slate-400 py-8">Babu bayanai game da kayan da aka saya.</p>
                  )}
                </div>
              )}

              {/* TAB 3: INSTALLMENTS PLAN BREAKDOWN (PSS) */}
              {modalTab === 'installments' && (
                <div className="space-y-6">
                  {(() => {
                    const fin = parseOrderFinances(selectedOrder);
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                          <div className="p-4 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl border border-emerald-200">
                            <p className="text-[10px] font-black uppercase text-emerald-800 dark:text-emerald-400">An Karɓa (Collected)</p>
                            <h3 className="text-xl font-black text-emerald-600 mt-1">₦{fin.paid?.toLocaleString()}</h3>
                          </div>
                          <div className="p-4 bg-amber-50 dark:bg-amber-500/10 rounded-2xl border border-amber-200">
                            <p className="text-[10px] font-black uppercase text-amber-800 dark:text-amber-400">Ragowar Bashi (Due)</p>
                            <h3 className="text-xl font-black text-amber-600 mt-1">₦{fin.remaining?.toLocaleString()}</h3>
                          </div>
                          <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-200">
                            <p className="text-[10px] font-black uppercase text-slate-500">Matakin Biya</p>
                            <h3 className="text-xl font-black text-slate-800 dark:text-white mt-1">
                              {fin.paidCount} na {fin.count} Sashi
                            </h3>
                          </div>
                        </div>

                        {/* Installment Slices Table */}
                        <div className="border border-slate-200 dark:border-slate-700 rounded-2xl overflow-hidden">
                          <div className="p-3 bg-slate-100 dark:bg-slate-800 text-[11px] font-black uppercase text-slate-600 dark:text-slate-300">
                            Jerin Tashoshin Biyan Kuɗi (Installment Schedule)
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-slate-800">
                            {fin.schedule && fin.schedule.length > 0 ? (
                              fin.schedule.map((s, idx) => (
                                <div key={idx} className="p-4 flex items-center justify-between text-xs">
                                  <div>
                                    <p className="font-black text-slate-900 dark:text-white">
                                      {s.label || `Sashi na #${idx + 1}`}
                                    </p>
                                    <p className="text-[10px] text-slate-400 mt-0.5">
                                      Adadin: ₦{Number(s.amount || 0).toLocaleString()}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3">
                                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase ${
                                      s.status === 'paid' 
                                        ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-400' 
                                        : 'bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-400'
                                    }`}>
                                      {s.status === 'paid' ? 'AN BIYA' : 'JIRAN BIYA'}
                                    </span>
                                    {s.status !== 'paid' && (
                                      <button
                                        onClick={() => handleMarkInstallmentPaid(selectedOrder, idx)}
                                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold"
                                      >
                                        Sanya a Matsayin An Biya
                                      </button>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <p className="p-6 text-center text-xs text-slate-400">Babu jerin installments da aka ayyana a cikin wannan odar.</p>
                            )}
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}

              {/* TAB 4: LOGISTICS & DRIVER */}
              {modalTab === 'logistics' && (
                <div className="space-y-6">
                  {/* Driver Assignment Dropdown */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                      Bada Oda Ga Direba / Dispatch Rider
                    </p>
                    <select
                      value={selectedOrder.driver_id || ''}
                      onChange={(e) => handleAssignDriver(selectedOrder.id, e.target.value)}
                      className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-3 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-400 cursor-pointer"
                    >
                      <option value="" disabled>Zabi direba daga cikin jerin...</option>
                      {drivers.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.status === 'active' || d.is_active ? '🟢 [ONLINE]' : '⚪ [OFFLINE]'} {d.name} • {d.vehicle_type || 'Vehicle'} (★{Number(d.rating || 5.0).toFixed(1)})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Live Checkpoint Station Updater */}
                  <div className="p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-200 dark:border-slate-700 space-y-3">
                    <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-300">
                      Sabunta Tashar Kaya ta Yanzu (Live Checkpoint Hub)
                    </p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Misali: Kano Central Sortation Facility..."
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        className="flex-1 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl px-4 py-2.5 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={() => handleUpdateLocation(selectedOrder.id)}
                        disabled={updatingLocation || !newLocationInput.trim()}
                        className="px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-black rounded-xl text-xs disabled:opacity-50"
                      >
                        Sabunta
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: TIMELINE & INTERNAL NOTES */}
              {modalTab === 'timeline' && (
                <div className="space-y-6">
                  {/* Status Timeline */}
                  <div className="space-y-4">
                    {timeline.map((log, i) => (
                      <div key={i} className="flex gap-3 text-xs">
                        <div className="w-2 h-2 rounded-full bg-amber-500 mt-1.5 flex-shrink-0" />
                        <div>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{log.note}</p>
                          <p className="text-[10px] text-slate-400 mt-0.5">
                            {new Date(log.created_at).toLocaleString()} • {log.profile?.full_name || 'Admin'}
                          </p>
                        </div>
                      </div>
                    ))}
                    {timeline.length === 0 && (
                      <p className="text-xs text-slate-400">Babu wani tarihin sauyi da aka yi wa wannan odar ba tukuna.</p>
                    )}
                  </div>

                  {/* Add Internal Admin Note */}
                  <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-2">
                    <p className="text-xs font-black uppercase text-slate-400">Rubuta Bayanin Cikin Gida (Internal Note)</p>
                    <div className="flex gap-2">
                      <input 
                        type="text"
                        placeholder="Bayanin gudanarwa ko kira..."
                        value={adminNote}
                        onChange={(e) => setAdminNote(e.target.value)}
                        className="flex-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-amber-400"
                      />
                      <button
                        onClick={handleAddNote}
                        disabled={savingNote || !adminNote.trim()}
                        className="px-4 py-2 bg-slate-900 text-white dark:bg-white dark:text-slate-900 font-bold rounded-xl text-xs disabled:opacity-50"
                      >
                        Ajiye
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── CANCELLATION PROMPT MODAL ── */}
      {showCancelPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-3xl p-6 shadow-2xl space-y-4">
            <h3 className="text-lg font-black text-rose-600">Soke Wannan Oda</h3>
            <p className="text-xs text-slate-500 font-medium">Da fatan za a rubuta dalilin soke wannan oda domin a ajiye a tsarin.</p>
            <textarea
              placeholder="Rubuta dalilin sokewa anan..."
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 text-xs font-bold outline-none focus:border-rose-500 min-h-[100px]"
            />
            <div className="flex gap-3">
              <button 
                onClick={() => { setShowCancelPrompt(false); setCancelReason(''); }}
                className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                Fasa
              </button>
              <button 
                onClick={() => {
                  handleUpdateStatus(selectedOrder?.id, 'cancelled', `Dalilin Sokewa: ${cancelReason}`);
                  setShowCancelPrompt(false);
                  setCancelReason('');
                }}
                disabled={!cancelReason.trim()}
                className="flex-1 py-2.5 bg-rose-600 text-white rounded-xl text-xs font-bold disabled:opacity-50"
              >
                Tabbatar da Sokewa
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminOrders;