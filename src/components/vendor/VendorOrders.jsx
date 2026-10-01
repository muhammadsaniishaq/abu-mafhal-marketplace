import React, { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "../../config/supabase";
import { useAuth } from "../../context/AuthContext";
import { sendOrderNotification } from "../../services/notificationService";

// ─── Toast ───────────────────────────────────────────────────────────────────
const Toast = ({ toasts, remove }) => (
  <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
    {toasts.map((t) => (
      <div
        key={t.id}
        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-white text-sm font-medium transition-all duration-300 ${
          t.type === "success" ? "bg-emerald-600" : t.type === "error" ? "bg-red-600" : "bg-blue-600"
        }`}
      >
        <span>{t.type === "success" ? "✓" : t.type === "error" ? "✕" : "ℹ"}</span>
        <span className="flex-1">{t.message}</span>
        <button onClick={() => remove(t.id)} className="opacity-70 hover:opacity-100 ml-1">✕</button>
      </div>
    ))}
  </div>
);

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = useCallback((message, type = "info") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, message, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);
  const remove = useCallback((id) => setToasts((p) => p.filter((t) => t.id !== id)), []);
  return {
    toasts,
    toast: { success: (m) => add(m, "success"), error: (m) => add(m, "error"), info: (m) => add(m, "info") },
    remove,
  };
}

// ─── Constants ────────────────────────────────────────────────────────────────
const STATUS = {
  pending:    { label: "Pending",    color: "bg-amber-100 text-amber-800 border-amber-200",       dot: "bg-amber-500",   icon: "⏳" },
  processing: { label: "Processing", color: "bg-blue-100 text-blue-800 border-blue-200",          dot: "bg-blue-500",    icon: "⚙️" },
  shipped:    { label: "Shipped",    color: "bg-purple-100 text-purple-800 border-purple-200",    dot: "bg-purple-500",  icon: "🚚" },
  delivered:  { label: "Delivered",  color: "bg-emerald-100 text-emerald-800 border-emerald-200", dot: "bg-emerald-500", icon: "✅" },
  cancelled:  { label: "Cancelled",  color: "bg-red-100 text-red-800 border-red-200",             dot: "bg-red-500",     icon: "❌" },
};
const FILTERS = ["all", "pending", "processing", "shipped", "delivered", "cancelled"];
const CARRIERS = ["GIG Logistics", "DHL", "UPS", "FedEx", "NIPOST", "Kwik Delivery", "Aramex", "Sendbox"];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) => `₦${Number(n || 0).toLocaleString("en-NG")}`;
const shortId = (id) => (id ? id.toString().substring(0, 8).toUpperCase() : "—");
const fmtDate = (d) => {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-NG", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

// ─── Components ───────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const cfg = STATUS[status] || { label: status, color: "bg-gray-100 text-gray-700 border-gray-200", dot: "bg-gray-400" };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const StatCard = ({ label, value, icon, colorClass, onClick, active }) => (
  <button
    onClick={onClick}
    className={`flex-1 min-w-[100px] rounded-2xl p-4 text-left transition-all duration-200 border ${
      active ? `${colorClass} border-current shadow-lg scale-[1.02]` : "bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:shadow-md"
    }`}
  >
    <div className="text-2xl mb-1">{icon}</div>
    <div className="text-2xl font-bold">{value}</div>
    <div className={`text-xs font-medium mt-0.5 ${active ? "opacity-80" : "text-gray-500 dark:text-gray-400"}`}>{label}</div>
  </button>
);

// ─── Main ─────────────────────────────────────────────────────────────────────
const VendorOrders = () => {
  const { currentUser } = useAuth();
  const { toasts, toast, remove } = useToast();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [trackingData, setTrackingData] = useState({ tracking_number: "", carrier: "", notes: "" });
  const [copiedId, setCopiedId] = useState(null);
  const channelRef = useRef(null);

  // ── Fetch orders ────────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    const vendorId = currentUser?.uid || currentUser?.id;
    if (!vendorId) return;
    try {
      setLoading(true);
      // 1. Get vendor's products
      const { data: vendorProducts } = await supabase
        .from("products").select("id, name, vendor_id, images, price").eq("vendor_id", vendorId);
      const productIds = (vendorProducts || []).map((p) => p.id);
      const productMap = Object.fromEntries((vendorProducts || []).map((p) => [p.id, p]));

      // 2. Fetch order_items
      let q = supabase.from("order_items").select("id, order_id, product_id, vendor_id, quantity, price, variant, created_at, products (id, name, vendor_id, images, price)");
      if (productIds.length > 0) {
        q = q.or(`vendor_id.eq.${vendorId},product_id.in.(${productIds.join(",")})`);
      } else {
        q = q.eq("vendor_id", vendorId);
      }
      const { data: items, error: itemsErr } = await q;
      if (itemsErr) throw itemsErr;

      // 3. Filter items for this vendor
      const myItems = (items || []).filter(
        (i) => i.vendor_id === vendorId || (i.products?.vendor_id === vendorId) || productIds.includes(i.product_id)
      ).map((i) => ({ ...i, products: i.products || productMap[i.product_id] || null }));

      if (!myItems.length) { setOrders([]); return; }

      // 4. Fetch parent orders
      const orderIds = [...new Set(myItems.map((i) => i.order_id).filter(Boolean))];
      const { data: parentOrders, error: ordErr } = await supabase
        .from("orders")
        .select("id, user_id, status, payment_status, payment_method, payment_reference, total_amount, subtotal, shipping_fee, shipping_address, contact_phone, notes, tracking_number, estimated_delivery, current_location, created_at, updated_at")
        .in("id", orderIds)
        .order("created_at", { ascending: false });
      if (ordErr) throw ordErr;

      // 5. Fetch buyer profiles
      const userIds = [...new Set((parentOrders || []).map((o) => o.user_id).filter(Boolean))];
      const profileMap = {};
      if (userIds.length) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name, email, phone").in("id", userIds);
        (profiles || []).forEach((p) => { profileMap[p.id] = p; });
      }

      // 6. Group items by order & build enriched list
      const itemsByOrder = {};
      myItems.forEach((i) => {
        if (!i.order_id) return;
        if (!itemsByOrder[i.order_id]) itemsByOrder[i.order_id] = [];
        itemsByOrder[i.order_id].push(i);
      });
      const enriched = (parentOrders || []).map((ord) => {
        const buyer = profileMap[ord.user_id] || {};
        const ordItems = itemsByOrder[ord.id] || [];
        return {
          ...ord,
          buyer_name: buyer.full_name || "Customer",
          buyer_email: buyer.email || "",
          buyer_phone: buyer.phone || ord.contact_phone || "",
          vendor_items: ordItems,
          vendor_total: ordItems.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0),
        };
      });
      setOrders(enriched);
    } catch (err) {
      console.error("fetchOrders error:", err);
      toast.error("Failed to load orders: " + (err.message || "Unknown error"));
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  // ── Realtime ────────────────────────────────────────────────────────────────
  useEffect(() => {
    fetchOrders();
    const ch = supabase
      .channel("vendor_orders_" + Date.now())
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "order_items" }, fetchOrders)
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [fetchOrders]);

  // ── Update status ────────────────────────────────────────────────────────────
  const updateOrderStatus = async (orderId, newStatus) => {
    setUpdating(true);
    try {
      const now = new Date().toISOString();
      const payload = { status: newStatus, updated_at: now };
      if (trackingData.tracking_number) payload.tracking_number = trackingData.tracking_number;
      if (newStatus === "shipped") payload.current_location = trackingData.notes || "In Transit";
      const { error } = await supabase.from("orders").update(payload).eq("id", orderId);
      if (error) throw error;
      await supabase.from("order_status_logs").insert({
        order_id: orderId, status: newStatus,
        title: STATUS[newStatus]?.label || newStatus,
        description: trackingData.notes || `Status updated to ${STATUS[newStatus]?.label || newStatus}`,
        changed_by: currentUser?.uid || currentUser?.id, created_at: now,
      });
      try {
        const order = orders.find((o) => o.id === orderId);
        if (order?.user_id) {
          await sendOrderNotification(orderId, order.user_id, "buyer", newStatus, {
            total: order.vendor_total, orderNumber: shortId(orderId),
            vendorName: currentUser?.name || currentUser?.full_name || "Vendor",
          });
        }
      } catch (_) {}
      setOrders((prev) => prev.map((o) => o.id === orderId ? { ...o, status: newStatus, tracking_number: trackingData.tracking_number || o.tracking_number } : o));
      if (selectedOrder?.id === orderId) setSelectedOrder((prev) => ({ ...prev, status: newStatus, tracking_number: trackingData.tracking_number || prev.tracking_number }));
      toast.success(`Order #${shortId(orderId)} → ${STATUS[newStatus]?.label || newStatus}`);
      setTrackingData({ tracking_number: "", carrier: "", notes: "" });
      await fetchOrders();
    } catch (err) {
      toast.error("Update failed: " + err.message);
    } finally {
      setUpdating(false);
    }
  };

  const copyId = async (id) => {
    try { await navigator.clipboard.writeText(id); setCopiedId(id); setTimeout(() => setCopiedId(null), 2000); toast.info("Copied!"); } catch (_) {}
  };
  const openOrder = (order) => {
    setSelectedOrder(order);
    setTrackingData({ tracking_number: order.tracking_number || "", carrier: "", notes: "" });
    setShowModal(true);
  };
  const getNextActions = (status) => ({
    pending:    [{ to: "processing", label: "Accept Order", color: "bg-blue-600 hover:bg-blue-700" }, { to: "cancelled", label: "Reject", color: "bg-red-600 hover:bg-red-700" }],
    processing: [{ to: "shipped", label: "Mark Shipped 🚚", color: "bg-purple-600 hover:bg-purple-700" }, { to: "cancelled", label: "Cancel", color: "bg-red-600 hover:bg-red-700" }],
    shipped:    [{ to: "delivered", label: "Mark Delivered ✅", color: "bg-emerald-600 hover:bg-emerald-700" }],
    delivered: [], cancelled: [],
  }[status] || []);

  const stats = {
    all: orders.length,
    pending: orders.filter((o) => o.status === "pending").length,
    processing: orders.filter((o) => o.status === "processing").length,
    shipped: orders.filter((o) => o.status === "shipped").length,
    delivered: orders.filter((o) => o.status === "delivered").length,
    cancelled: orders.filter((o) => o.status === "cancelled").length,
    revenue: orders.filter((o) => o.status === "delivered").reduce((s, o) => s + o.vendor_total, 0),
  };

  const filtered = orders.filter((o) => {
    if (filter !== "all" && o.status !== filter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      shortId(o.id).toLowerCase().includes(q) ||
      (o.buyer_name || "").toLowerCase().includes(q) ||
      (o.buyer_email || "").toLowerCase().includes(q) ||
      (o.tracking_number || "").toLowerCase().includes(q) ||
      (o.vendor_items || []).some((i) => (i.products?.name || "").toLowerCase().includes(q))
    );
  });

  if (loading && orders.length === 0) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-xl w-48 animate-pulse" />
        <div className="flex gap-3">{[...Array(5)].map((_, i) => <div key={i} className="h-24 flex-1 bg-gray-200 dark:bg-gray-700 rounded-2xl animate-pulse" />)}</div>
        <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
        <div className="bg-gray-200 dark:bg-gray-700 rounded-2xl h-64 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 min-h-screen bg-gray-50 dark:bg-gray-950">
      <Toast toasts={toasts} remove={remove} />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900 dark:text-white">Orders</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">{orders.length} total · {stats.delivered} delivered · Revenue {fmt(stats.revenue)}</p>
        </div>
        <button onClick={fetchOrders} className="self-start flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors shadow-sm">
          <span className={loading ? "animate-spin inline-block" : ""}>↻</span> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="flex flex-wrap gap-3">
        <StatCard label="All" value={stats.all} icon="📦" colorClass="bg-gray-900 text-white" active={filter === "all"} onClick={() => setFilter("all")} />
        <StatCard label="Pending" value={stats.pending} icon="⏳" colorClass="bg-amber-500 text-white" active={filter === "pending"} onClick={() => setFilter("pending")} />
        <StatCard label="Processing" value={stats.processing} icon="⚙️" colorClass="bg-blue-600 text-white" active={filter === "processing"} onClick={() => setFilter("processing")} />
        <StatCard label="Shipped" value={stats.shipped} icon="🚚" colorClass="bg-purple-600 text-white" active={filter === "shipped"} onClick={() => setFilter("shipped")} />
        <StatCard label="Delivered" value={stats.delivered} icon="✅" colorClass="bg-emerald-600 text-white" active={filter === "delivered"} onClick={() => setFilter("delivered")} />
        <StatCard label="Cancelled" value={stats.cancelled} icon="❌" colorClass="bg-red-600 text-white" active={filter === "cancelled"} onClick={() => setFilter("cancelled")} />
        <div className="flex-1 min-w-[140px] rounded-2xl p-4 bg-gradient-to-br from-emerald-500 to-teal-600 text-white border border-emerald-400">
          <div className="text-2xl mb-1">💰</div>
          <div className="text-xl font-bold">{fmt(stats.revenue)}</div>
          <div className="text-xs opacity-80 mt-0.5">Revenue (Delivered)</div>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input type="text" placeholder="Search order, customer, product..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-9 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
          {search && <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">✕</button>}
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)}
          className="px-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
          {FILTERS.map((f) => <option key={f} value={f}>{f === "all" ? "All Statuses" : STATUS[f]?.label || f}</option>)}
        </select>
      </div>

      {/* Orders */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700">
          <div className="text-6xl mb-4">📭</div>
          <h3 className="text-xl font-semibold text-gray-700 dark:text-gray-300 mb-2">No orders found</h3>
          <p className="text-gray-500 text-sm">{search ? "Try a different search." : filter !== "all" ? `No ${STATUS[filter]?.label} orders yet.` : "Customer orders appear here."}</p>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                  {["Order", "Customer", "Items", "Total", "Date", "Status", ""].map((h, i) => (
                    <th key={i} className="text-left py-3.5 px-4 font-semibold text-gray-500 dark:text-gray-400">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {filtered.map((order) => (
                  <tr key={order.id} onClick={() => openOrder(order)} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer">
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-blue-600 dark:text-blue-400">#{shortId(order.id)}</span>
                        <button onClick={(e) => { e.stopPropagation(); copyId(order.id); }} className="text-gray-400 hover:text-gray-600">{copiedId === order.id ? "✓" : "⧉"}</button>
                      </div>
                      {order.tracking_number && <div className="text-xs text-gray-400 mt-0.5">📦 {order.tracking_number}</div>}
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium text-gray-900 dark:text-white">{order.buyer_name}</div>
                      <div className="text-xs text-gray-400">{order.buyer_email}</div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="font-medium">{order.vendor_items?.length || 0} item{order.vendor_items?.length !== 1 ? "s" : ""}</div>
                      <div className="text-xs text-gray-400 line-clamp-1">{order.vendor_items?.map((i) => i.products?.name).filter(Boolean).join(", ")}</div>
                    </td>
                    <td className="py-4 px-4 font-bold text-gray-900 dark:text-white">{fmt(order.vendor_total)}</td>
                    <td className="py-4 px-4 text-gray-500 text-xs">{fmtDate(order.created_at)}</td>
                    <td className="py-4 px-4"><StatusBadge status={order.status} /></td>
                    <td className="py-4 px-4">
                      <button onClick={(e) => { e.stopPropagation(); openOrder(order); }} className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-medium">Manage →</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Mobile Cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((order) => (
              <div key={order.id} onClick={() => openOrder(order)} className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="font-mono font-bold text-blue-600 dark:text-blue-400">#{shortId(order.id)}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{fmtDate(order.created_at)}</div>
                  </div>
                  <StatusBadge status={order.status} />
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{order.buyer_name}</div>
                    <div className="text-xs text-gray-400">{order.vendor_items?.length || 0} items</div>
                  </div>
                  <div className="font-bold text-lg">{fmt(order.vendor_total)}</div>
                </div>
                {order.vendor_items?.[0]?.products?.name && (
                  <div className="mt-2 text-xs text-gray-400 bg-gray-50 dark:bg-gray-900 rounded-lg px-2 py-1 line-clamp-1">
                    📦 {order.vendor_items.map((i) => i.products?.name).filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Order Detail Modal */}
      {showModal && selectedOrder && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false); }}>
          <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4 flex items-center justify-between rounded-t-3xl z-10">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Order #{shortId(selectedOrder.id)}</h2>
                <p className="text-xs text-gray-400">{fmtDate(selectedOrder.created_at)}</p>
              </div>
              <div className="flex items-center gap-3">
                <StatusBadge status={selectedOrder.status} />
                <button onClick={() => setShowModal(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 text-lg">✕</button>
              </div>
            </div>
            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Your Total</div>
                  <div className="text-xl font-bold text-gray-900 dark:text-white">{fmt(selectedOrder.vendor_total)}</div>
                </div>
                <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                  <div className="text-xs text-gray-500">Payment</div>
                  <div className="font-semibold text-gray-900 dark:text-white capitalize">{selectedOrder.payment_method || "—"}</div>
                  <div className={`text-xs mt-0.5 ${selectedOrder.payment_status === "paid" ? "text-emerald-600" : "text-amber-600"}`}>{selectedOrder.payment_status || "unpaid"}</div>
                </div>
                {selectedOrder.tracking_number && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="text-xs text-gray-500">Tracking</div>
                    <div className="font-mono text-sm font-bold text-blue-600">{selectedOrder.tracking_number}</div>
                  </div>
                )}
              </div>
              {/* Customer */}
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-4 border border-blue-100 dark:border-blue-800">
                <h3 className="font-semibold text-gray-800 dark:text-white mb-3">👤 Customer</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  <div><span className="text-gray-500">Name: </span><span className="font-medium text-gray-900 dark:text-white">{selectedOrder.buyer_name}</span></div>
                  {selectedOrder.buyer_email && <div><span className="text-gray-500">Email: </span><a href={`mailto:${selectedOrder.buyer_email}`} className="text-blue-600">{selectedOrder.buyer_email}</a></div>}
                  {selectedOrder.buyer_phone && <div><span className="text-gray-500">Phone: </span><span className="font-medium">{selectedOrder.buyer_phone}</span></div>}
                  {selectedOrder.shipping_address && (
                    <div className="sm:col-span-2">
                      <span className="text-gray-500">Address: </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {typeof selectedOrder.shipping_address === "string" ? selectedOrder.shipping_address
                          : `${selectedOrder.shipping_address?.address || ""}, ${selectedOrder.shipping_address?.city || ""}, ${selectedOrder.shipping_address?.state || ""}`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
              {/* Items */}
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-white mb-3">📦 Items ({selectedOrder.vendor_items?.length || 0})</h3>
                <div className="space-y-3">
                  {(selectedOrder.vendor_items || []).map((item, idx) => {
                    const prod = item.products || {};
                    const img = Array.isArray(prod.images) ? prod.images[0] : prod.images || null;
                    return (
                      <div key={item.id || idx} className="flex gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        {img ? <img src={img} alt={prod.name} className="w-16 h-16 rounded-xl object-cover flex-shrink-0" />
                          : <div className="w-16 h-16 rounded-xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-2xl flex-shrink-0">📦</div>}
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-900 dark:text-white">{prod.name || "Product"}</div>
                          {item.variant && <div className="text-xs text-gray-500 mt-0.5">Variant: {item.variant}</div>}
                          <div className="text-xs text-gray-500 mt-1">{fmt(item.price)} × {item.quantity}</div>
                        </div>
                        <div className="font-bold text-gray-900 dark:text-white flex-shrink-0">{fmt(item.price * item.quantity)}</div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 flex justify-between items-center px-4 py-3 bg-gray-900 dark:bg-black rounded-xl">
                  <span className="text-gray-300 text-sm font-medium">Total</span>
                  <span className="text-xl font-bold text-white">{fmt(selectedOrder.vendor_total)}</span>
                </div>
              </div>
              {/* Notes */}
              {selectedOrder.notes && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 rounded-xl p-4">
                  <h3 className="font-semibold text-amber-900 dark:text-amber-300 text-sm mb-1">📝 Customer Note</h3>
                  <p className="text-sm text-amber-800 dark:text-amber-200">{selectedOrder.notes}</p>
                </div>
              )}
              {/* Update Actions */}
              {getNextActions(selectedOrder.status).length > 0 && (
                <div className="border-t border-gray-200 dark:border-gray-800 pt-5">
                  <h3 className="font-semibold text-gray-800 dark:text-white mb-4">🔄 Update Order</h3>
                  <div className="space-y-3 mb-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Tracking Number</label>
                        <input type="text" value={trackingData.tracking_number} onChange={(e) => setTrackingData((p) => ({ ...p, tracking_number: e.target.value }))} placeholder="e.g. GIG-1234567890"
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Carrier</label>
                        <select value={trackingData.carrier} onChange={(e) => setTrackingData((p) => ({ ...p, carrier: e.target.value }))}
                          className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white">
                          <option value="">Select Carrier</option>
                          {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">Update Note</label>
                      <textarea rows={2} value={trackingData.notes} onChange={(e) => setTrackingData((p) => ({ ...p, notes: e.target.value }))} placeholder="e.g. Order dispatched, in transit to Lagos..."
                        className="w-full px-3 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:text-white resize-none" />
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {getNextActions(selectedOrder.status).map((action) => (
                      <button key={action.to} onClick={() => updateOrderStatus(selectedOrder.id, action.to)} disabled={updating}
                        className={`flex items-center justify-center gap-2 px-5 py-3 ${action.color} text-white rounded-xl font-semibold text-sm transition-all disabled:opacity-50`}>
                        {updating ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating...</> : <>{STATUS[action.to]?.icon} {action.label}</>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* Done/Cancelled */}
              {["delivered", "cancelled"].includes(selectedOrder.status) && (
                <div className={`rounded-2xl p-4 text-center border ${selectedOrder.status === "delivered" ? "bg-emerald-50 dark:bg-emerald-900/20 border-emerald-200" : "bg-red-50 dark:bg-red-900/20 border-red-200"}`}>
                  <div className="text-3xl mb-2">{selectedOrder.status === "delivered" ? "🎉" : "❌"}</div>
                  <div className={`font-semibold ${selectedOrder.status === "delivered" ? "text-emerald-700" : "text-red-700"}`}>
                    {selectedOrder.status === "delivered" ? "Order delivered successfully!" : "Order has been cancelled."}
                  </div>
                </div>
              )}
              {/* Footer */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button onClick={() => copyId(selectedOrder.id)} className="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 rounded-xl text-sm font-medium text-gray-700 dark:text-gray-300">
                  {copiedId === selectedOrder.id ? "✓ Copied!" : "⧉ Copy ID"}
                </button>
                {selectedOrder.buyer_email && (
                  <a href={`mailto:${selectedOrder.buyer_email}?subject=Order %23${shortId(selectedOrder.id)}`} className="flex-1 px-4 py-2.5 bg-blue-50 hover:bg-blue-100 rounded-xl text-sm font-medium text-blue-700 text-center">
                    ✉️ Email Customer
                  </a>
                )}
                {selectedOrder.buyer_phone && (
                  <a href={`https://wa.me/${selectedOrder.buyer_phone.replace(/\D/g, "")}?text=Hi! Regarding order %23${shortId(selectedOrder.id)}`} target="_blank" rel="noopener noreferrer"
                    className="flex-1 px-4 py-2.5 bg-green-50 hover:bg-green-100 rounded-xl text-sm font-medium text-green-700 text-center">
                    💬 WhatsApp
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default VendorOrders;